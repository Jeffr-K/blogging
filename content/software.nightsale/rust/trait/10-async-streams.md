---
title: "Rust Traits: Async, Futures, and Streams"
author: anonymous.rs
date: 2025-12-29
tags: ["rust", "trait", "async", "future", "stream", "concurrency", "futures-rs"]
---

# The Engine of Asynchronous Rust: `Future` and `Stream` Traits

Rust's modern `async`/`await` syntax provides a powerful, ergonomic way to write non-blocking, asynchronous code. But this high-level syntax is built on a foundation of traits. The `std::future::Future` trait is the core building block of the entire async ecosystem, representing a value that may not be ready yet. Its cousin, the `Stream` trait, represents a sequence of asynchronous values.

## 1. The `std::future::Future` Trait

An `async fn` is syntactic sugar for a function that returns a type implementing the `Future` trait. A `Future` is essentially a state machine that represents a computation that can be paused and resumed.

The definition of the trait is:
```rust
pub trait Future {
    // The type of value that the future will produce when it's complete.
    type Output;

    // The method that drives the future towards completion.
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}
```

Let's break this down:
-   `Output`: The value that will be returned when the computation finishes (e.g., `String` from a database query).
-   `poll`: This is the engine of the future. An "async runtime" (like Tokio or async-std) calls `poll` repeatedly.
    -   `self: Pin<&mut Self>`: The `Pin` ensures that the future cannot be moved in memory while it's being polled. This is critical for futures that store pointers to their own data.
    -   `cx: &mut Context<'_>`: The context contains a `Waker`. The future must store this `Waker` and call its `wake()` method when it's ready to make progress again (e.g., when a network socket receives data). This tells the runtime to schedule the future to be `poll`ed again.
-   `Poll<T>`: This is an enum that `poll` returns.
    -   `Poll::Ready(value)`: The future has completed, and here is its `Output` value.
    -   `Poll::Pending`: The future is not yet finished. It has arranged for the `Waker` to be called, and the runtime should wait before polling it again.

When you write `my_future.await`, the compiler generates code that calls `poll`. If it returns `Pending`, the current function suspends and returns control to the runtime. When the `Waker` is called, the runtime knows to resume this function from where it left off.

## 2. The `futures::stream::Stream` Trait

A `Stream` is to `async` what an `Iterator` is to sync code. It represents a sequence of values that become available asynchronously over time. The `Stream` trait is not yet in the standard library but is a cornerstone of the `futures` crate.

Its definition is very similar to `Future`:
```rust
pub trait Stream {
    // The type of item that the stream yields.
    type Item;

    // Attempts to pull the next item from the stream.
    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>>;
}
```
The `poll_next` method can return:
-   `Poll::Ready(Some(value))`: The stream has yielded a new value.
-   `Poll::Ready(None)`: The stream has finished and will not produce any more values.
-   `Poll::Pending`: The stream is not ready to produce a value yet.

## 3. Working with Streams

You typically consume a stream using a `while let` loop provided by the `StreamExt` trait (which you must bring into scope).

```rust
use futures::stream::{self, StreamExt};

#[tokio::main]
async fn main() {
    // Create a simple stream that yields numbers 1, 2, 3
    let mut my_stream = stream::iter(vec![1, 2, 3]);

    // Asynchronously iterate over the stream
    while let Some(value) = my_stream.next().await {
        println!("Got value: {}", value);
    }
}
```
Like iterators, streams also have a rich set of adapters available through `StreamExt`, such as `map`, `filter`, and `for_each`. These allow you to build complex data processing pipelines that operate asynchronously.

```rust
use futures::stream::{self, StreamExt};

#[tokio::main]
async fn main() {
    stream::iter(1..=10)
        .map(|n| async move {
            // Simulate an async operation
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            n * n
        })
        .buffer_unordered(5) // Process up to 5 futures concurrently
        .for_each(|n_squared| async move {
            println!("Processed square: {}", n_squared);
        })
        .await;
}
```

## Conclusion

The `Future` and `Stream` traits are the low-level foundation that enables Rust's high-performance, safe, and ergonomic asynchronous ecosystem. While you may not implement these traits manually very often, understanding how they work provides deep insight into how `async`/`await` functions and how to debug and reason about asynchronous code.
