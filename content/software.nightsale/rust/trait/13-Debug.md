---
title: "[Rust 트레이트 시리즈] 13. Debug: 개발자를 위한 출력 포맷"
author: anonymous.rs
date: 2025-12-31
tags: ["rust", "trait", "debug", "formatting", "derive", "dbg"]
---

# `Debug`: 개발자를 위한 손쉬운 디버깅 출력

프로그래밍 과정에서 변수나 객체의 현재 상태를 확인하는 것은 디버깅의 가장 기본적인 활동입니다. `Debug` 트레이트는 러스트의 타입(구조체, 열거형 등)이 이러한 디버깅 목적의 출력 형식을 가질 수 있도록 지원하는 표준 트레이트입니다.

`Debug`의 주된 목적은 **개발자에게 유용한 정보를 제공**하는 것입니다. 최종 사용자에게 보여주기 위한 깔끔한 출력(`Display` 트레이트)과는 그 목적이 다릅니다.

## `Debug` 트레이트 사용하기: `{:?}`

`Debug` 트레이트를 구현한 타입은 `println!`, `format!`, `dbg!` 같은 포매팅 매크로에서 `{:?}` 지정자를 통해 출력할 수 있습니다. 더 읽기 좋게 여러 줄로 출력하고 싶다면 `{:#?}` (pretty-print)를 사용할 수 있습니다.

```rust
#[derive(Debug)] // Debug 트레이트를 자동으로 구현
struct Point {
    x: i32,
    y: i32,
}

#[derive(Debug)]
struct User {
    username: String,
    id: u64,
    active: bool,
}

fn main() {
    let p = Point { x: 10, y: 20 };
    let u = User {
        username: "alice".to_string(),
        id: 101,
        active: true,
    };

    // `{:?}`를 사용한 기본 출력
    println!("Debug Point: {:?}", p);
    
    // `{:#?}`를 사용한 "Pretty Print"
    println!("Debug User:\n{:#?}", u);
}
```
**출력:**
```
Debug Point: Point { x: 10, y: 20 }
Debug User:
User {
    username: "alice",
    id: 101,
    active: true,
}
```

## `#[derive(Debug)]`: 마법의 자동 구현

대부분의 경우, 우리는 `Debug` 트레이트를 직접 구현할 필요가 없습니다. 구조체나 열거형 정의 위에 `#[derive(Debug)]` 속성을 추가하기만 하면, 컴파일러가 해당 타입의 모든 필드를 재귀적으로 출력하는 표준적인 `Debug` 구현을 자동으로 생성해 줍니다. 이는 해당 타입의 모든 필드 또한 `Debug`를 구현해야 함을 의미합니다.

## `Debug` 수동 구현하기

때로는 `#[derive]`가 생성하는 기본 출력 대신, 출력을 직접 제어하고 싶을 수 있습니다. 예를 들어, 비밀번호와 같은 민감한 정보를 출력에서 제외하거나 특정 형식으로 값을 표현하고 싶을 때 `Debug`를 수동으로 구현할 수 있습니다.

```rust
use std::fmt;

struct User {
    username: String,
    password_hash: String, // 이 필드는 출력하고 싶지 않다.
}

impl fmt::Debug for User {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("User")
         .field("username", &self.username)
         .field("password_hash", &"***REDACTED***") // 민감한 정보는 가린다.
         .finish()
    }
}

fn main() {
    let user = User {
        username: "bob".to_string(),
        password_hash: "a1b2c3d4e5f6".to_string(),
    };

    println!("{:?}", user);
}
```
**출력:**
```
User { username: "bob", password_hash: "***REDACTED***" }
```

## `dbg!` 매크로: 더 나은 디버깅 도우미

`dbg!` 매크로는 `Debug`를 활용하는 매우 유용한 디버깅 도구입니다. `dbg!(expression)`은 `expression`의 파일명, 라인 넘버, 값(Debug 형식)을 표준 에러(stderr)에 출력하고, `expression`의 **소유권을 다시 반환**합니다.

따라서 코드 중간에 값을 확인하기 위해 `println!`을 삽입하고 소유권 문제로 고생할 필요 없이, `dbg!`를 간편하게 끼워 넣을 수 있습니다.

```rust
fn factorial(n: u32) -> u32 {
    if dbg!(n <= 1) {
        dbg!(1)
    } else {
        dbg!(n * factorial(n - 1))
    }
}

fn main() {
    factorial(3);
}
```
**출력 (stderr):**
```
[src/main.rs:2] n <= 1 = false
[src/main.rs:2] n <= 1 = false
[src/main.rs:2] n <= 1 = true
[src/main.rs:3] 1 = 1
[src/main.rs:5] n * factorial(n - 1) = 2
[src/main.rs:5] n * factorial(n - 1) = 6
```

## 결론

`Debug` 트레이트는 러스트의 개발 경험을 윤택하게 만드는 필수적인 요소입니다. `#[derive(Debug)]`를 통해 대부분의 타입에 손쉽게 적용할 수 있으며, `dbg!` 매크로와 함께 사용하면 코드의 흐름을 방해하지 않으면서도 강력한 디버깅이 가능해집니다. 잘 구현된 `Debug` 출력은 복잡한 애플리케이션의 문제를 진단하고 해결하는 데 드는 시간을 크게 단축시켜 줍니다.
