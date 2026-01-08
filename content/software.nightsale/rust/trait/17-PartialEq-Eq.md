---
title: "[Rust 트레이트 시리즈] 17. PartialEq와 Eq: 동등성 비교"
author: anonymous.rs
date: 2026-01-01
tags: ["rust", "trait", "partialeq", "eq", "comparison", "연산자"]
---

# `PartialEq`와 `Eq`: 동등성 비교 연산자 구현하기

`PartialEq`와 `Eq` 트레이트는 사용자 정의 타입에 `==`(같음)와 `!=`(같지 않음) 연산자를 사용할 수 있게 해주는 핵심적인 비교 트레이트입니다. 이들을 구현하면 타입의 인스턴스들이 서로 같은지 여부를 비교할 수 있게 되어, `if`문, `match` 표현식, 컬렉션의 `contains` 메서드 등 다양한 곳에서 활용될 수 있습니다.

## `PartialEq`: 부분 동등성

`PartialEq`는 '부분 동등성(Partial Equality)'을 의미합니다. 이름에 '부분'이 붙은 이유는, 해당 타입의 모든 값이 항상 서로 비교 가능하지는 않을 수 있음을 시사하기 때문입니다.

`PartialEq` 트레이트는 `eq` 메서드 하나만 요구합니다 (`ne` 메서드는 `eq`의 결과를 반전시키는 기본 구현을 가집니다).

```rust
pub trait PartialEq<Rhs: ?Sized = Self> {
    fn eq(&self, other: &Rhs) -> bool;
    // ...
}
```
`PartialEq`의 대표적인 예는 부동소수점 타입(`f32`, `f64`)입니다. 부동소수점에는 '숫자가 아님'을 의미하는 `NaN`(Not a Number) 값이 있는데, 명세상 `NaN == NaN`은 항상 `false`입니다. 즉, 자기 자신과도 동등하지 않은 값이 존재합니다. 이처럼 완벽한 동등성 관계가 성립하지 않기 때문에 부동소수점 타입은 `PartialEq`만 구현하고, `Eq`는 구현하지 않습니다.

### `#[derive(PartialEq)]`

대부분의 구조체는 `#[derive(PartialEq)]` 속성을 통해 `PartialEq`를 쉽게 구현할 수 있습니다. 이 경우, 두 인스턴스의 모든 필드가 순서대로 동일해야 `true`를 반환하는 코드가 자동으로 생성됩니다.

```rust
#[derive(Debug, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let p1 = Point { x: 10, y: 20 };
    let p2 = Point { x: 10, y: 20 };
    let p3 = Point { x: 30, y: 20 };

    assert!(p1 == p2);
    assert!(p1 != p3);
    println!("p1과 p2는 같습니다.");
}
```

## `Eq`: 완전 동등성

`Eq`는 '완전 동등성(Total Equality)'을 의미하는 마커 트레이트입니다. `Eq`는 아무런 메서드도 가지지 않으며, 단지 `PartialEq`로 정의된 동등성 비교가 다음의 수학적 '동치 관계(Equivalence Relation)'를 만족함을 컴파일러에게 알려주는 표식입니다.

1.  **반사성(Reflexive)**: `a == a`는 항상 `true`이다.
2.  **대칭성(Symmetric)**: `a == b`이면, `b == a`도 `true`이다.
3.  **타동성(Transitive)**: `a == b`이고 `b == c`이면, `a == c`도 `true`이다.

`NaN` 때문에 `f32`와 `f64`는 `Eq`를 구현하지 않지만, 대부분의 다른 타입(정수, `String`, 필드가 모두 `Eq`인 구조체 등)은 `Eq`를 구현할 수 있습니다.

**`HashMap`의 키나 `HashSet`의 원소로 사용될 타입은 반드시 `Eq`와 `Hash`를 구현해야 합니다.**

```rust
#[derive(Debug, PartialEq, Eq)] // Eq를 파생하려면 PartialEq가 먼저 필요합니다.
struct UserId(u64);

fn main() {
    let user1 = UserId(101);
    let user2 = UserId(101);

    // Eq가 보장되므로, 완벽한 동등성 비교가 가능합니다.
    assert!(user1 == user2);
}
```

## 수동 구현

때로는 특정 필드만으로 동등성을 비교하고 싶을 수 있습니다. 예를 들어, 사용자의 `id`가 같다면 다른 정보(`last_login` 등)가 달라도 같은 사용자로 간주하고 싶을 때 `PartialEq`를 직접 구현할 수 있습니다.

```rust
struct User {
    id: u32,
    username: String,
}

impl PartialEq for User {
    fn eq(&self, other: &Self) -> bool {
        // id 필드만으로 동등성을 판단합니다.
        self.id == other.id
    }
}
// 이 경우, username이 달라도 id만 같으면 `==`가 true가 되므로
// 반사성, 대칭성, 타동성이 완벽히 보장되지 않을 수 있어 Eq는 구현하지 않는 것이 안전할 수 있습니다.

fn main() {
    let user1 = User { id: 1, username: "Alice".to_string() };
    let user2 = User { id: 1, username: "Alicia".to_string() };
    assert!(user1 == user2); // id가 같으므로 true
}
```

## 결론

`PartialEq`와 `Eq`는 러스트의 타입 시스템에 비교의 의미를 부여하는 중요한 트레이트입니다. `#[derive]`를 통해 대부분의 경우 쉽게 구현할 수 있으며, 이를 통해 사용자 정의 타입이 언어의 기본 연산자와 자연스럽게 통합되어 코드의 가독성과 표현력을 높여줍니다.
