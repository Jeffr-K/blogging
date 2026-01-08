---
title: "Episode 12. Rust Smart Pointers: Thread-Safe `Arc<T>`"
author: anonymous.rs
date: 2025-12-26
tags: ["rust", "smart-pointer", "arc", "concurrency", "multi-thread", "atomic", "mutex"]
---

# Thread-Safe Shared Ownership with `Arc<T>`

While `Rc<T>` is perfect for managing shared ownership in a single thread, modern applications are often multi-threaded. When you need to share data between threads, you need a pointer that can safely manage its reference count in a concurrent environment.

Enter `Arc<T>`, the **Atomically Reference Counted** smart pointer.

## 1. Why `Rc<T>` Isn't Enough

The reference count inside an `Rc<T>` is a simple integer. Incrementing or decrementing it involves reading the value, adding/subtracting one, and writing it back. In a multi-threaded context, a "race condition" can occur:

1.  Thread 1 reads the count (e.g., 2).
2.  Thread 2 reads the count (also 2).
3.  Thread 1 increments its value to 3 and writes it back.
4.  Thread 2 increments *its* value to 3 and writes it back.

The count should be 4, but it's only 3. This can lead to premature deallocation (a memory safety bug) or memory leaks. `Rc<T>` is not `Send` or `Sync`, so the Rust compiler prevents you from even trying to use it across threads.

## 2. `Arc<T>`: The Atomic Solution

`Arc<T>` is the multi-threaded equivalent of `Rc<T>`. It works in almost the exact same way, but with one critical difference: it uses **atomic operations** to manage its reference count.

An atomic operation is an indivisible instruction that is guaranteed by the hardware and operating system to execute to completion without being interrupted by other threads. This prevents the race conditions described above and ensures the reference count is always correct.

The API is virtually identical to `Rc<T>`:
-   `Arc::new(value)`
-   `Arc::clone(&arc_value)`
-   `Arc::strong_count(&arc_value)`

This makes it easy to switch between `Rc` and `Arc` if your program's threading requirements change.

### Example: Sharing Data Across Threads

Here's how you can use `Arc<T>` to share ownership of data with multiple threads:
```rust
use std::sync::Arc;
use std::thread;
use std::time::Duration;

fn main() {
    // Create data wrapped in an Arc.
    let shared_data = Arc::new(vec![1, 2, 3]);
    let mut handles = vec![];

    for i in 0..3 {
        // Clone the Arc for each thread. This is a cheap operation.
        let data_clone = Arc::clone(&shared_data);
        
        let handle = thread::spawn(move || {
            println!("Thread {}: Shared data is {:?}", i, data_clone);
            // This thread now shares ownership of the data.
        });
        handles.push(handle);
    }
    
    // Wait for all threads to finish.
    for handle in handles {
        handle.join().unwrap();
    }
    
    // After all threads are done, the strong count will be 1.
    println!("Final strong count: {}", Arc::strong_count(&shared_data));
}
```
This code compiles and runs safely because `Arc<T>` is `Send` and `Sync`, signaling to the compiler that it's safe for cross-thread usage.

## 3. The Ultimate Combo: `Arc<Mutex<T>>` for Shared Mutability

`Arc<T>` by itself provides shared, *immutable* access. But what if multiple threads need to *change* the shared data?

You cannot get a mutable reference `&mut T` from an `Arc<T>`. To solve this, you combine `Arc` with another concurrency primitive like `Mutex` (Mutual Exclusion).

The `Arc<Mutex<T>>` pattern is a cornerstone of Rust concurrency:
-   **`Arc<T>`** handles the *shared ownership* of the data across threads.
-   **`Mutex<T>`** handles the *mutability*, ensuring that only one thread can acquire a "lock" and access the inner data at a time.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    // A counter shared across multiple threads.
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter_clone = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            // Lock the mutex to get mutable access.
            let mut num = counter_clone.lock().unwrap();
            *num += 1;
            // The lock is automatically released when `num` goes out of scope.
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Result: {}", *counter.lock().unwrap()); // Prints "Result: 10"
}
```

## Conclusion

`Arc<T>` is the robust, thread-safe solution for managing shared ownership in concurrent Rust. While it has a slight performance cost over `Rc<T>` due to atomic operations, it is essential for building safe and correct multi-threaded applications. When combined with `Mutex` or `RwLock`, it provides the power to safely share and mutate data across any number of threads.