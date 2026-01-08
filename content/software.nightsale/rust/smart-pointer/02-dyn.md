---
title: "Episode 9. Dynamic Dispatch with `dyn`"
author: anonymous.rs
date: 2025-12-23
tags: ["rust", "polymorphism", "vtable", "smart-pointer", "dst"]
---

# Deep Dive: `dyn` Keyword and Dynamic Dispatch

In Rust, the `dyn` keyword is central to achieving **Dynamic Dispatch**, a concept similar to using interfaces in languages like Java or C#. While Rust prioritizes resolving all types at compile time for maximum performance, there are situations where the concrete type of a value can only be known at runtime. This is where `dyn` comes into play.

Let's explore the role of `dyn` using a common example: `Box<dyn Transaction>`.

---

## 1. Static vs. Dynamic Dispatch

To understand `dyn`, we must first distinguish between two method dispatch strategies in Rust.

### A. Static Dispatch (Compile-Time)

Static dispatch is the default in Rust. When you use generics (`<T: Trait>`), the compiler performs **monomorphization**. It generates a specialized version of the function for each concrete type used.

- **Pros:** Extremely fast runtime performance as the exact function to call is known, allowing for inlining and other optimizations.
- **Cons:** Can lead to longer compile times and larger binary sizes due to code duplication.

### B. Dynamic Dispatch (Runtime)

When you use a trait object like `dyn Trait`, the compiler doesn't need to know the concrete type. Instead, it uses a **Virtual Method Table (VTable)** at runtime to look up which method to call.

- **Pros:** Offers great flexibility, allowing you to handle a collection of different types that share the same interface (polymorphism). It can also reduce binary size.
- **Cons:** Incurs a minor runtime overhead due to the VTable lookup (an extra pointer indirection).

---

## 2. Why `dyn Trait` Must Live Behind a Pointer

A fundamental rule in Rust is that every variable must have a size known at compile time (i.e., it must implement the `Sized` trait). However, a `dyn Transaction` is a **Dynamically Sized Type (DST)**, also known as an "unsized type." Its size is unknown because it could be a `PostgresTransaction`, a `MysqlTransaction`, or any other struct that implements the `Transaction` trait.

Since the compiler cannot allocate a variable amount of space on the stack, we must place the DST behind a pointer. The pointer itself has a fixed, known size.

Common smart pointers used for this are:
- `Box<dyn Transaction>`: An owned, heap-allocated trait object.
- `&dyn Transaction`: A borrowed reference to a trait object.
- `Arc<dyn Transaction>`: A reference-counted, shared trait object.

---

## 3. The Inner Workings: VTable and Fat Pointers

When you create a trait object, Rust uses a special kind of pointer called a **Fat Pointer**. It is typically twice the size of a regular pointer (e.g., 16 bytes on a 64-bit system) and contains two components:

1.  **Data Pointer**: Points to the actual instance data (e.g., the `PostgresTransaction` struct in memory).
2.  **VTable Pointer**: Points to the Virtual Method Table, which is a static table containing pointers to the concrete implementation of each method in the trait for that specific type.

When `transaction.commit()` is called on a `Box<dyn Transaction>`:
1.  The program follows the VTable pointer.
2.  It looks up the address for the `commit` method in the VTable.
3.  It jumps to that address and executes the function, passing the data pointer as `self`.

---

## 4. Example: The `TransactionManager`

Consider this function signature from a transaction manager:

```rust
async fn begin(
    &self,
    options: TransactionOptions,
) -> Result<Box<dyn Transaction>, Error>;
```

The `begin` function returns a `Box<dyn Transaction>`. Why? Because the manager might create a `PostgresTransaction` or a `MysqlTransaction` depending on the configuration. The caller doesn't care about the specific database type; it only needs to be able to call methods defined in the `Transaction` trait, like `.commit()` or `.rollback()`.

The `dyn` keyword is essential here for abstracting away the implementation details and exposing only the required interface.

---

## 5. Object Safety

Not all traits can be used to create trait objects. A trait must be **object-safe**. The main rules for object safety are:

-   All methods in the trait must not return `Self`.
-   All methods in the trait must not use generic type parameters.
-   The trait must not have `Sized` as a supertrait.

This is because the concrete type `Self` is erased when using a trait object, so the compiler cannot know what type to substitute.

### Summary Table

| Feature              | Static Dispatch (`<T: Trait>`)     | Dynamic Dispatch (`dyn Trait`)         |
| -------------------- | ---------------------------------- | -------------------------------------- |
| **Resolution Time**  | Compile-Time                       | Runtime                                |
| **Performance**      | Very fast (inlining possible)      | Slightly slower (VTable lookup)        |
| **Flexibility**      | Low (types are fixed)              | High (accepts various concrete types)  |
| **Binary Size**      | Larger (code is duplicated)        | Smaller (code is shared)               |

> **A Word from anonymous.rs:**
> "`dyn` is the point where Rust momentarily trades a fraction of its raw performance for a great deal of flexibility."

In conclusion, `dyn` provides a powerful mechanism for runtime polymorphism, and smart pointers like `Box` are the tools that make it possible by giving a home to unsized types. This combination of `dyn` and smart pointers is the key to building flexible, abstract components in Rust, such as middleware chains or plugin systems.