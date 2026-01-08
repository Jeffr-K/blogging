---
title: "Rust Traits: Operator Overloading with `std::ops`"
author: anonymous.rs
date: 2025-12-29
tags: ["rust", "trait", "operator-overloading", "ops", "add", "index", "neg"]
---

# Making Custom Types Feel Native: Operator Overloading with `std::ops`

In many languages, operator overloading can be a source of confusion, leading to unreadable code. Rust takes a more principled approach: you can't create new operators, but you can implement traits from the `std::ops` module to overload existing operators (`+`, `*`, `-`, `[]`, etc.) for your custom types. This allows types like vectors, complex numbers, or color representations to be manipulated with natural, mathematical syntax.

## 1. Arithmetic Operators (`Add`, `Sub`, `Mul`, `Div`)

The most common use case for operator overloading is for arithmetic operations. By implementing the `Add` trait, for instance, you can define what `a + b` means when `a` and `b` are instances of your struct.

Let's implement `Add` for a simple `Point` struct.

```rust
use std::ops::Add;

#[derive(Debug, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}

// Implement the `Add` trait for our `Point` struct.
impl Add for Point {
    type Output = Self; // The type returned by the `+` operation.

    fn add(self, other: Self) -> Self::Output {
        Point {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

fn main() {
    let p1 = Point { x: 1, y: 0 };
    let p2 = Point { x: 2, y: 3 };

    // We can now use the `+` operator on our Point instances.
    let p3 = p1 + p2;

    assert_eq!(p3, Point { x: 3, y: 3 });
    println!("p1 + p2 = {:?}", p3);
}
```

Similarly, you can implement:
-   `Sub` for `-`
-   `Mul` for `*`
-   `Div` for `/`
-   `Rem` for `%`

The `std::ops` module also includes corresponding "Assign" traits like `AddAssign` (`+=`), `SubAssign` (`-=`), etc., for efficient in-place operations.

## 2. Unary Operators (`Neg`, `Not`)

You can also overload unary operators.
-   `Neg` is used to implement the negation operator (`-`).
-   `Not` is used to implement the logical or bitwise NOT operator (`!`).

```rust
use std::ops::Neg;

#[derive(Debug, PartialEq)]
struct Point { x: i32, y: i32 } // Using a simplified Point

impl Neg for Point {
    type Output = Self;

    fn neg(self) -> Self::Output {
        Point {
            x: -self.x,
            y: -self.y,
        }
    }
}

fn main() {
    let p = Point { x: 1, y: -2 };
    let negated_p = -p;
    assert_eq!(negated_p, Point { x: -1, y: 2 });
    println!("The negation is {:?}", negated_p);
}
```

## 3. Indexing Operators (`Index`, `IndexMut`)

The `Index` and `IndexMut` traits allow you to overload the square bracket indexing operator (`[]`), which is perfect for custom collection types.

-   `Index`: For immutable indexing (`collection[i]`).
-   `IndexMut`: For mutable indexing (`collection[i] = value`).

```rust
use std::ops::{Index, IndexMut};

struct Color(u8, u8, u8); // A simple RGB color

// Implement immutable indexing to get R(0), G(1), or B(2)
impl Index<usize> for Color {
    type Output = u8;

    fn index(&self, index: usize) -> &Self::Output {
        match index {
            0 => &self.0,
            1 => &self.1,
            2 => &self.2,
            _ => panic!("Index out of bounds for Color"),
        }
    }
}

// Implement mutable indexing
impl IndexMut<usize> for Color {
    fn index_mut(&mut self, index: index) -> &mut Self::Output {
        match index {
            0 => &mut self.0,
            1 => &mut self.1,
            2 => &mut self.2,
            _ => panic!("Index out of bounds for Color"),
        }
    }
}


fn main() {
    let mut color = Color(255, 128, 0); // Orange
    
    // Immutable access
    assert_eq!(color[1], 128); // Get green component

    // Mutable access
    color[1] = 165; // Change green component
    assert_eq!(color[1], 165);
}
```

## Conclusion

Operator overloading via the `std::ops` traits is a powerful feature for writing ergonomic and intuitive APIs in Rust. By implementing these traits, you allow your custom types to participate in common operations, making them feel like a natural extension of the language itself. This leads to code that is not only safer but also more readable and expressive.
