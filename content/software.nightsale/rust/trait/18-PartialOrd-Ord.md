---
title: "[Rust 트레이트 시리즈] 18. PartialOrd와 Ord: 순서 비교와 정렬"
author: anonymous.rs
date: 2026-01-01
tags: ["rust", "trait", "partialord", "ord", "comparison", "sort", "ordering"]
---

# `PartialOrd`와 `Ord`: 순서 비교와 정렬

`PartialOrd`와 `Ord` 트레이트는 `<`(보다 작음), `>`(보다 큼), `<=`(작거나 같음), `>=`(크거나 같음)와 같은 순서 비교 연산자를 사용자 정의 타입에 적용할 수 있게 해줍니다. 더 나아가, 타입의 인스턴스들을 정렬(sorting)하는 기준을 제공하여 `Vec::sort` 같은 표준 라이브러리 기능을 활용할 수 있게 합니다.

## `PartialOrd`: 부분 순서

`PartialOrd`는 '부분 순서(Partial Ordering)'를 의미하며, 이름에서 알 수 있듯이 타입의 모든 값들 사이에 항상 명확한 순서를 정할 수 없는 경우에 사용됩니다.

`PartialOrd` 트레이트는 `partial_cmp` 메서드를 구현해야 합니다.

```rust
pub trait PartialOrd<Rhs: ?Sized = Self>: PartialEq<Rhs> {
    fn partial_cmp(&self, other: &Rhs) -> Option<Ordering>;
    // ... <, >, <=, >= 메서드들은 partial_cmp를 사용한 기본 구현을 가짐 ...
}
```
- `partial_cmp`는 `Option<Ordering>`을 반환합니다. `Ordering`은 `Less`, `Equal`, `Greater` 세 가지 값을 가지는 열거형입니다.
- 두 값을 비교할 수 없는 경우 `None`을 반환합니다. 이 때문에 '부분' 순서라고 불립니다.
- `PartialEq`와 마찬가지로, 부동소수점 타입(`f32`, `f64`)이 대표적인 예입니다. `NaN`은 다른 어떤 숫자와도 크기 비교가 불가능하므로, `partial_cmp`는 `None`을 반환합니다.

### `#[derive(PartialOrd)]`

`PartialOrd` 역시 `#[derive]`를 통해 쉽게 구현할 수 있습니다. 이 경우, 구조체의 필드들이 위에서 아래 순서대로 사전식(lexicographical)으로 비교됩니다.

```rust
#[derive(Debug, PartialEq, PartialOrd)] // PartialOrd는 PartialEq를 요구합니다.
struct HighScore {
    score: u32,
    player_name: String,
}

fn main() {
    let s1 = HighScore { score: 100, player_name: "Alice".to_string() };
    let s2 = HighScore { score: 100, player_name: "Bob".to_string() };
    let s3 = HighScore { score: 90, player_name: "Charlie".to_string() };

    // score가 같으므로, player_name으로 비교합니다. 'A' < 'B' 이므로 s1 < s2 입니다.
    assert!(s1 < s2);
    // score가 다르므로, score로 비교합니다. 100 > 90 이므로 s2 > s3 입니다.
    assert!(s2 > s3);
}
```

## `Ord`: 완전 순서

`Ord`는 '완전 순서(Total Ordering)'를 의미하며, 타입의 모든 값들 사이에 명확한 순서가 존재함을 보장합니다. `None`을 반환하는 경우가 없으므로, 비교 불가능한 상황이 없습니다.

`Ord` 트레이트는 `cmp` 메서드를 구현하며, `PartialOrd`와 `Eq`를 모두 구현해야 합니다.

```rust
pub trait Ord: Eq + PartialOrd<Self> {
    fn cmp(&self, other: &Self) -> Ordering;
}
```
- `cmp`는 `Option`으로 감싸지 않은 `Ordering`을 직접 반환합니다.
- **타입이 `Ord`를 구현해야만 `Vec::sort()`를 호출하거나 `BTreeMap`의 키로 사용할 수 있습니다.**

### `#[derive(Ord)]`

`Ord` 역시 `#[derive]`로 구현할 수 있으며, `PartialOrd`, `PartialEq`, `Eq`를 함께 파생해야 합니다.

```rust
#[derive(Debug, Eq, PartialEq, Ord, PartialOrd)]
struct Person {
    age: u32,
    name: String,
}

fn main() {
    let mut people = vec![
        Person { age: 30, name: "Alice".to_string() },
        Person { age: 25, name: "Bob".to_string() },
        Person { age: 30, name: "Aaron".to_string() },
    ];

    // `Person`이 `Ord`를 구현했으므로, .sort()를 호출할 수 있습니다.
    // 기본적으로 age 오름차순, age가 같으면 name 오름차순으로 정렬됩니다.
    people.sort();

    // 정렬 결과: [Person { age: 25, ... }, Person { age: 30, name: "Aaron"... }, Person { age: 30, name: "Alice"... }]
    println!("{:#?}", people);
}
```

## 수동 구현

만약 기본 사전식 순서가 아닌 다른 기준으로 정렬하고 싶다면 `Ord`와 관련 트레이트들을 직접 구현해야 합니다. 예를 들어, `HighScore`를 점수 내림차순으로 정렬하고 싶다면 `cmp` 메서드의 로직을 반대로 구현할 수 있습니다.

```rust
use std::cmp::Ordering;

#[derive(Debug, Eq, PartialEq)]
struct HighScore {
    score: u32,
    player_name: String,
}

// `Ord`를 수동으로 구현하여 점수(score) 내림차순으로 정렬
impl Ord for HighScore {
    fn cmp(&self, other: &Self) -> Ordering {
        // self와 other의 순서를 바꿔서 비교하면 정렬 순서가 반대가 됩니다.
        other.score.cmp(&self.score)
    }
}

// `PartialOrd`는 `Ord`의 `cmp`를 사용하여 간단히 구현할 수 있습니다.
impl PartialOrd for HighScore {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
// ...
```

## 결론

`PartialOrd`와 `Ord`는 사용자 정의 타입에 순서를 부여하는 강력한 도구입니다. `#[derive]`를 통해 대부분의 경우 쉽게 정렬 기준을 만들 수 있으며, 이를 통해 벡터를 정렬하거나 `BTreeMap`과 같은 순서 기반의 자료구조를 활용하는 등 러스트의 풍부한 표준 라이브러리 기능을 최대한 활용할 수 있게 됩니다.
