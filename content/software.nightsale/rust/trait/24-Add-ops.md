---
title: "[Rust 트레이트 시리즈] 24. ops::Add: 덧셈 연산자(+) 오버로딩"
author: anonymous.rs
date: 2026-01-03
tags: ["rust", "trait", "ops", "add", "operator-overloading", "연산자"]
---

# `ops::Add`: 덧셈 연산자(+) 오버로딩

러스트는 다른 언어들처럼 임의의 연산자를 새로 만들 수는 없지만, `std::ops` 모듈에 정의된 트레이트들을 구현함으로써 기존 연산자(`+`, `-`, `*`, `[]` 등)의 동작을 사용자 정의 타입에 맞게 재정의(오버로딩)할 수 있습니다. 이를 통해 우리가 만든 타입을 마치 언어에 내장된 숫자 타입처럼 자연스럽고 직관적으로 다룰 수 있게 됩니다.

이번 글에서는 가장 대표적인 연산자 트레이트인 `Add`를 살펴보겠습니다.

## `Add` 트레이트 정의

`Add` 트레이트는 덧셈 연산자 `+`의 동작을 정의합니다.

```rust
pub trait Add<Rhs = Self> {
    // 덧셈 연산의 결과로 반환될 타입을 지정합니다.
    type Output;

    // `self` (좌항)와 `rhs` (우항)을 더하는 로직을 구현합니다.
    fn add(self, rhs: Rhs) -> Self::Output;
}
```
-   `Rhs`(Right-Hand Side): 덧셈의 우항에 오는 타입을 지정합니다. 기본값은 `Self`이므로, 같은 타입끼리의 덧셈을 주로 정의합니다.
-   `Output`: 덧셈의 결과 타입을 지정합니다. 보통 `Self`이지만, 다른 타입(예: 인치 + 센티미터 = 센티미터)이 될 수도 있습니다.
-   `add` 메서드는 `self`의 소유권을 가져간다는 점에 유의해야 합니다. 참조를 더하고 싶다면 `impl Add for &MyType`과 같이 구현해야 합니다.

## `Add` 구현 예제: `Point` 더하기

2차원 좌표를 나타내는 `Point` 구조체에 두 좌표를 더하는 `Add` 트레이트를 구현해 보겠습니다.

```rust
use std::ops::Add;

#[derive(Debug, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}

// Point 타입에 대해 Add 트레이트를 구현합니다.
impl Add for Point {
    type Output = Self; // 결과물도 Point 타입입니다.

    fn add(self, other: Self) -> Self::Output {
        Point {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

fn main() {
    let p1 = Point { x: 1, y: 5 };
    let p2 = Point { x: 2, y: -2 };

    // 이제 `+` 연산자를 Point 타입에 직접 사용할 수 있습니다.
    let p3 = p1 + p2;

    assert_eq!(p3, Point { x: 3, y: 3 });
    println!("두 점의 합: {:?}", p3);
}
```

## `AddAssign` (`+=`) 과 다른 연산자들

`std::ops` 모듈은 `+` 연산뿐만 아니라 다양한 연산자에 대한 트레이트를 제공합니다.

-   **`AddAssign` (`+=`)**: `a = a + b` 보다 효율적인 인플레이스(in-place) 덧셈을 위해 `AddAssign` 트레이트를 구현할 수 있습니다.
-   `Sub` (`-`), `SubAssign` (`-=`)
-   `Mul` (`*`), `MulAssign` (`*=`)
-   `Div` (`/`), `DivAssign` (`/=`)
-   `Rem` (`%`), `RemAssign` (`%=`)
-   `Neg` (`-` 단항), `Not` (`!`)

이들 모두 `Add`와 유사한 방식으로 구현할 수 있습니다.

## 제네릭과 연산자 트레이트

연산자 트레이트는 제네릭 코드에서 특히 유용합니다. 숫자처럼 덧셈이 가능한 모든 타입을 인자로 받는 함수를 작성할 수 있습니다.

```rust
use std::ops::Add;

// T는 덧셈이 가능하고, 그 결과가 T 타입이어야 하며,
// 디버그 출력이 가능해야 한다는 것을 명시합니다.
fn sum<T: Add<Output = T> + std::fmt::Debug>(a: T, b: T) {
    println!("{:?} + {:?} = {:?}", a, b, a + b);
}

fn main() {
    sum(5, 3); // i32는 Add를 구현함
    sum(Point { x: 1, y: 1 }, Point { x: -1, y: -1 }); // 우리가 구현한 Point
}
```

## 결론

`std::ops`의 연산자 트레이트들은 사용자 정의 타입을 언어의 기본 문법에 자연스럽게 녹아들게 하는 강력한 다리 역할을 합니다. 특히 벡터, 행렬, 복소수, 화폐 단위 등 수학적 개념을 표현하는 타입을 만들 때, 연산자 오버로딩은 코드의 가독성을 극적으로 향상시키고, 타입을 사용하는 개발자의 경험을 즐겁게 만들어 줍니다.
