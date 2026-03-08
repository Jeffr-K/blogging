---
title: "[Rust 트레이트 시리즈] 01. 트레이트란 무엇인가"
author: anonymous.rs
date: 2025-12-28
tags: ["rust", "trait", "기초"]
---

# 트레이트(Trait)란 무엇인가

## 한 줄 요약

트레이트는 **"이 타입은 이런 행동을 할 수 있다"**를 정의하는 계약서이다.

## 다른 언어와 비교

- Java/C#의 `interface` 와 비슷하다
- Go의 `interface` 와도 유사하지만, 러스트는 명시적으로 구현해야 한다
- 상속이 아니라 **조합(Composition)**의 개념이다

## 기본 문법

```rust
// 트레이트 정의
trait Greet {
    fn say_hello(&self) -> String;
}

// 구조체 정의
struct Dog {
    name: String,
}

// 트레이트 구현
impl Greet for Dog {
    fn say_hello(&self) -> String {
        format!("멍멍! 나는 {}임", self.name)
    }
}
```

트레이트를 정의하고, 원하는 타입에 `impl <Trait> for <Type|Struct>` 문법으로 구현한다.

## 왜 트레이트를 쓰는가

### 1. 다형성(Polymorphism)

서로 다른 타입이 같은 인터페이스를 공유할 수 있다.

```rust
struct Cat { name: String }
struct Robot { id: u32 }

impl Greet for Cat {
    fn say_hello(&self) -> String {
        format!("야옹~ 난 {}", self.name)
    }
}

impl Greet for Robot {
    fn say_hello(&self) -> String {
        format!("삐빅. 유닛 {} 인사함.", self.id)
    }
}
```

`Dog`, `Cat`, `Robot` 전부 `Greet` 을 구현했으니 같은 방식으로 다룰 수 있다.

### 2. 제네릭 제약

함수가 "아무 타입이나 받는 게 아니라, 특정 능력이 있는 타입만 받는다" 를 명시할 수 있다.

```rust
fn greet_all<T: Greet>(items: Vec<T>) {
    for item in items {
        println!("{}", item.say_hello());
    }
}
```

`T: Greet` 은 "T는 반드시 Greet 트레이트를 구현해야 한다" 라는 뜻이다.

### 3. 기본 구현 제공

트레이트에서 기본 동작을 미리 정의해둘 수 있다.

```rust
trait Greet {
    fn say_hello(&self) -> String {
        String::from("안녕")  // 기본 구현
    }
}

struct Silent;
impl Greet for Silent {}  // 기본 구현 그대로 사용
```

## 표준 라이브러리의 트레이트들

러스트 표준 라이브러리는 수많은 트레이트를 제공한다.

| 트레이트 | 역할 |
|---------|------|
| `Clone` | `.clone()`으로 복제 가능 |
| `Copy` | 암묵적 복사 가능 (스택 데이터) |
| `Debug` | `{:?}`로 디버그 출력 |
| `Display` | `{}`로 사용자 친화적 출력 |
| `PartialEq` | `==` 비교 가능 |
| `Default` | 기본값 생성 가능 |

대부분 `#[derive(...)]` 매크로로 자동 구현 가능하다.

```rust
#[derive(Debug, Clone, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}
```

## 정리

- 트레이트 = 타입이 가져야 할 행동의 명세
- `impl Trait for Type`으로 구현한다
- 제네릭과 결합하면 강력한 추상화가 가능하다
- 러스트의 다형성은 상속이 아닌 트레이트 기반이다

다음 글에서는 트레이트를 실제로 어디에 쓰는지 구체적인 유스케이스를 살펴볼 예정이다.
