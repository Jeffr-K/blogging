---
title: "Episode 13. Rust Smart Pointers: Interior Mutability with `RefCell<T>`"
author: anonymous.rs
date: 2025-12-27
tags: ["rust", "smart-pointer", "refcell", "interior-mutability", "borrow-checker", "runtime"]
---

# Interior Mutability: Bending the Rules with `RefCell<T>`

Rust's borrow checker enforces a strict set of rules at compile time to ensure memory safety: you can have either multiple immutable references (`&T`) or exactly one mutable reference (`&mut T`), but never both. This is a pillar of Rust's safety guarantees.

However, sometimes this rigidity can be limiting. What if you have a value that is externally immutable, but you need to modify its internal parts? This is the **interior mutability** pattern, and `RefCell<T>` is a primary tool for achieving it.

## 1. The Problem: When Compile-Time Checks Are Too Strict

Imagine you are creating a mock object for a test. You want to record how many times a method is called. The method signature, dictated by a trait, might only give you an immutable reference `&self`.

```rust,ignore
pub trait Messenger {
    fn send(&self, msg: &str);
}

pub struct MockMessenger {
    sent_messages: Vec<String>,
}

impl Messenger for MockMessenger {
    fn send(&self, msg: &str) {
        // Error! `self` is an immutable reference (`&self`),
        // so we cannot mutate `sent_messages`.
        self.sent_messages.push(String::from(msg));
    }
}
```
This code fails because the borrow checker correctly sees that we are trying to mutate `self` through an immutable reference.

## 2. The Solution: `RefCell<T>`

`RefCell<T>` provides a way to escape this compile-time check. It moves the borrow checking from compile time to **runtime**.

Instead of using `&` and `&mut`, you use the methods on `RefCell<T>`:
-   `borrow()`: Returns a smart pointer `Ref<T>` that provides immutable access. The `RefCell` keeps track of how many active `Ref`s exist.
-   `borrow_mut()`: Returns a smart pointer `RefMut<T>` that provides mutable access. The `RefCell` tracks if a `RefMut` exists.

The borrowing rules still apply, but they are enforced when you run the program:
-   You can have multiple `borrow()`s at once.
-   You can have only one `borrow_mut()` at a time.
-   You cannot have a `borrow()` if a `borrow_mut()` is active.

**If you violate these rules at runtime, your program will panic and crash.**

### Mock Object Example with `RefCell<T>`:

Let's fix our `MockMessenger` using `RefCell`.

```rust
use std::cell::RefCell;

pub trait Messenger {
    fn send(&self, msg: &str);
}

pub struct MockMessenger {
    // Wrap the field we want to mutate in a RefCell.
    sent_messages: RefCell<Vec<String>>,
}

impl MockMessenger {
    fn new() -> MockMessenger {
        MockMessenger { sent_messages: RefCell::new(vec![]) }
    }
}

impl Messenger for MockMessenger {
    fn send(&self, msg: &str) {
        // Use `borrow_mut()` to get a mutable reference at runtime.
        self.sent_messages.borrow_mut().push(String::from(msg));
    }
}

fn main() {
    let mock_messenger = MockMessenger::new();
    mock_messenger.send("Hello, world!");
    
    // We can check the messages. Use `borrow()` for immutable access.
    assert_eq!(mock_messenger.sent_messages.borrow().len(), 1);
    println!("It works!");
}
```
Now, even though `send` takes `&self`, we can legally mutate the internal state because `RefCell` defers the borrow check to runtime.

## 3. The `Rc<RefCell<T>>` Combination

`RefCell<T>` on its own doesn't allow for multiple owners. What if you need to share a value among multiple owners *and* mutate it? You can combine `Rc` and `RefCell`.

-   `Rc<T>` allows multiple owners of the same data.
-   `RefCell<T>` allows interior mutability.

Together, `Rc<RefCell<T>>` gives you a value that can be referenced by multiple owners, any of which can use it to mutate the inner data (one at a time, of course). This is a very common pattern for managing shared, mutable state in complex single-threaded applications.

## 4. `RefCell<T>` vs. `Mutex<T>`

`RefCell<T>` is often compared to `Mutex<T>`.
-   **`RefCell<T>`**: For single-threaded scenarios. It is not `Sync`, so it can't be shared between threads. Violating the borrow rules causes a **panic**.
-   **`Mutex<T>`**: For multi-threaded scenarios. It is `Sync`. Attempting to acquire a lock that is already held will cause the current thread to **block** and wait, not panic.

## Conclusion

`RefCell<T>` is a powerful but sharp tool. It gives you the flexibility to bend Rust's strict compile-time borrowing rules by deferring checks to runtime. While this enables patterns like interior mutability, it comes at the cost of potential runtime panics. It's an essential part of the Rust toolbox for specific use cases, but it should be used judiciously when the borrow checker's static guarantees are too restrictive for the problem at hand.