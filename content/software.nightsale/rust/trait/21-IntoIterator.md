---
title: "[Rust 트레이트 시리즈] 21. IntoIterator: `for` 루프의 마법"
author: anonymous.rs
date: 2026-01-02
tags: ["rust", "trait", "intoiterator", "iterator", "for-loop", "소유권"]
---

# `IntoIterator`: `for` 루프는 어떻게 동작하는가?

러스트의 `for` 루프는 `Vec<T>`, `&[T]`, `HashMap<K, V>` 등 다양한 타입의 컬렉션을 아주 자연스럽게 순회할 수 있습니다.
```rust
let my_vec = vec![1, 2, 3];
for item in &my_vec {
    println!("{}", item);
}
```
어떻게 이것이 가능할까요? `for` 루프가 이 모든 타입을 개별적으로 아는 것일까요? 정답은 '아니오'입니다. `for` 루프의 마법 뒤에는 `IntoIterator`라는 단 하나의 트레이트가 있습니다.

## `for` 루프의 실제 모습

러스트에서 `for item in collection` 구문은 사실 다음과 같은 코드의 문법적 설탕(syntactic sugar)입니다.
```rust
let mut iterator = collection.into_iter();
while let Some(item) = iterator.next() {
    // 루프 본문
}
```
즉, `for` 루프는 `collection` 자체를 직접 다루는 것이 아니라, `collection`에 대해 `.into_iter()` 메서드를 호출하여 이터레이터(`Iterator`)를 얻어낸 뒤, 그 이터레이터의 `next()` 메서드가 `None`을 반환할 때까지 `while let` 루프를 도는 것과 같습니다.

`IntoIterator` 트레이트는 바로 이 `.into_iter()` 메서드를 제공하는 역할을 합니다.

## `IntoIterator` 트레이트 정의

```rust
pub trait IntoIterator {
    // 순회할 아이템의 타입
    type Item;
    // `into_iter`가 반환할 이터레이터의 타입
    type IntoIter: Iterator<Item = Self::Item>;

    // `self`를 소비하여 이터레이터를 생성합니다.
    fn into_iter(self) -> Self::IntoIter;
}
```
어떤 타입이 `IntoIterator`를 구현한다는 것은, 해당 타입이 `.into_iter()` 메서드를 통해 자신을 이터레이터로 변환할 수 있음을 의미합니다.

## 세 종류의 이터레이션: `into_iter`, `iter`, `iter_mut`

대부분의 표준 컬렉션은 세 가지 방식으로 이터레이터를 생성하는 메서드를 제공하며, 이는 `for` 루프가 소유권과 상호작용하는 방식을 결정합니다.

### 1. `into_iter()` (소유권 이전)
-   **호출 방식**: `collection.into_iter()` 또는 `for item in collection`
-   **동작**: 컬렉션의 **소유권**을 가져와서, 각 요소를 값(`T`)으로 반환하는 이터레이터를 생성합니다. 루프가 끝나면 컬렉션은 더 이상 사용할 수 없습니다.

```rust
let strings = vec!["hello".to_string(), "world".to_string()];
for s in strings {
    // s의 타입은 `String`입니다. (소유권 이전)
    println!("{}", s);
}
// println!("{:?}", strings); // 에러! `strings`의 소유권이 이동되었음
```

### 2. `iter()` (불변 참조)
-   **호출 방식**: `collection.iter()` 또는 `for item in &collection`
-   **동작**: 컬렉션에 대한 **불변 참조**를 통해, 각 요소에 대한 불변 참조(`&T`)를 반환하는 이터레이터를 생성합니다. 루프가 끝나도 컬렉션은 그대로 유지됩니다.

```rust
let strings = vec!["hello".to_string(), "world".to_string()];
for s_ref in &strings {
    // s_ref의 타입은 `&String`입니다. (불변 참조)
    println!("{}", s_ref);
}
println!("{:?}", strings); // 정상 동작
```

### 3. `iter_mut()` (가변 참조)
-   **호출 방식**: `collection.iter_mut()` 또는 `for item in &mut collection`
-   **동작**: 컬렉션에 대한 **가변 참조**를 통해, 각 요소에 대한 가변 참조(`&mut T`)를 반환하는 이터레이터를 생성합니다. 루프 내에서 요소를 수정할 수 있습니다.

```rust
let mut numbers = vec![1, 2, 3];
for num_mut in &mut numbers {
    // num_mut의 타입은 `&mut i32`입니다. (가변 참조)
    *num_mut *= 2; // 값을 수정
}
println!("{:?}", numbers); // 출력: [2, 4, 6]
```

## 사용자 정의 타입에 `IntoIterator` 구현하기

우리가 직접 만든 컬렉션 타입에 `IntoIterator`를 구현하면, `for` 루프에서 자연스럽게 사용할 수 있습니다.

```rust
// 간단한 책장 구조체
struct Bookcase {
    books: Vec<String>,
}

// Bookcase에 대해 IntoIterator를 구현
impl IntoIterator for Bookcase {
    type Item = String;
    type IntoIter = std::vec::IntoIter<Self::Item>;

    fn into_iter(self) -> Self::IntoIter {
        // 내부 Vec의 이터레이터를 반환
        self.books.into_iter()
    }
}

fn main() {
    let bookcase = Bookcase {
        books: vec!["The Rust Book".to_string(), "Design Patterns".to_string()],
    };

    // 이제 `for` 루프로 Bookcase를 순회할 수 있습니다!
    for book in bookcase {
        println!("- {}", book);
    }
}
```

## 결론

`IntoIterator` 트레이트는 러스트의 다양한 컬렉션 타입과 `for` 루프를 연결하는 핵심적인 접착제(glue) 역할을 합니다. `into_iter`, `iter`, `iter_mut`가 각각 소유권, 불변 참조, 가변 참조를 어떻게 다루는지 이해하는 것은, 러스트의 소유권 시스템 하에서 데이터를 효율적이고 안전하게 순회하는 코드를 작성하는 데 매우 중요합니다.
