---
title: "[Rust 트레이트 시리즈] 25. ops::Index: 인덱싱 연산자([]) 오버로딩"
author: anonymous.rs
date: 2026-01-03
tags: ["rust", "trait", "ops", "index", "indexmut", "operator-overloading", "연산자"]
---

# `ops::Index`와 `IndexMut`: 인덱싱 연산자(`[]`) 오버로딩

`Index`와 `IndexMut` 트레이트는 배열이나 `Vec`처럼, 사용자 정의 컬렉션 타입이 인덱싱 연산자 `[]`를 사용하여 내부에 있는 요소에 접근할 수 있도록 해줍니다. 이를 통해 표준 라이브러리의 컬렉션과 동일한, 직관적이고 편리한 API를 제공할 수 있습니다.

-   **`Index`**: `collection[index]`와 같이 값을 읽기 위한 **불변(immutable)** 인덱싱을 구현합니다.
-   **`IndexMut`**: `collection[index] = value`와 같이 값을 수정하기 위한 **가변(mutable)** 인덱싱을 구현합니다.

## `Index` 트레이트: 불변 인덱싱

`Index` 트레이트는 `index`라는 하나의 필수 메서드를 가집니다.

```rust
pub trait Index<Idx: ?Sized> {
    // 인덱싱 결과로 반환될 값의 타입을 지정합니다.
    type Output: ?Sized;

    // 인덱스를 받아 내부 값에 대한 불변 참조를 반환합니다.
    fn index(&self, index: Idx) -> &Self::Output;
}
```
- `Idx`: 인덱스로 사용될 타입입니다. 보통 `usize`이지만, `Range`, `&str` 등 다른 타입도 가능합니다.
- `Output`: `&self.index(idx)`의 결과 타입, 즉 인덱싱을 통해 얻게 될 값의 타입입니다.

### `Index` 구현 예제

`String`을 단어(whitespace 기준)들로 분리하여 저장하는 간단한 `Sentence` 구조체를 만들고, `usize` 인덱스로 각 단어에 접근할 수 있도록 `Index`를 구현해 보겠습니다.

```rust
use std::ops::Index;

struct Sentence {
    words: Vec<String>,
}

impl Sentence {
    fn new(text: &str) -> Self {
        let words = text.split_whitespace().map(|s| s.to_string()).collect();
        Sentence { words }
    }
}

// Sentence에 대해 usize 인덱싱을 구현합니다.
impl Index<usize> for Sentence {
    type Output = String; // 결과 타입은 String

    fn index(&self, index: usize) -> &Self::Output {
        &self.words[index] // 내부 Vec의 인덱싱을 그대로 사용
    }
}

fn main() {
    let sentence = Sentence::new("Rust traits are powerful");

    // 이제 `[]` 연산자를 사용할 수 있습니다.
    assert_eq!(sentence[0], "Rust");
    assert_eq!(sentence[2], "are");
    
    println!("첫 번째 단어: {}", sentence[0]);

    // 범위를 벗어나는 인덱스는 panic을 발생시킵니다.
    // let _ = sentence[4]; // panics
}
```

## `IndexMut` 트레이트: 가변 인덱싱

`IndexMut`는 `Index`와 유사하지만, `index_mut` 메서드를 통해 내부 값에 대한 **가변 참조**를 반환하여 값을 수정할 수 있게 해줍니다.

```rust
pub trait IndexMut<Idx: ?Sized>: Index<Idx> {
    fn index_mut(&mut self, index: Idx) -> &mut Self::Output;
}
```
`IndexMut`를 구현하려면 `Index`도 반드시 구현해야 합니다.

### `IndexMut` 구현 예제

위 `Sentence` 구조체에 `IndexMut`를 추가하여 단어를 수정할 수 있게 만들어 보겠습니다.

```rust
use std::ops::{Index, IndexMut};

// ... (Sentence 구조체 및 Index 구현은 위와 동일) ...

impl IndexMut<usize> for Sentence {
    fn index_mut(&mut self, index: usize) -> &mut Self::Output {
        &mut self.words[index]
    }
}

fn main() {
    let mut sentence = Sentence::new("This is a test");
    
    // `IndexMut` 덕분에 인덱싱으로 값을 수정할 수 있습니다.
    sentence[1] = "was".to_string();
    
    assert_eq!(sentence[1], "was");
    println!("수정된 문장의 두 번째 단어: {}", sentence[1]);
}
```

## 다양한 인덱스 타입

`Index` 트레이트의 `Idx`는 제네릭이므로, `usize` 외에 다른 타입을 인덱스로 사용할 수도 있습니다.
- **`Range`**: `my_vec[1..3]` 처럼 슬라이스를 얻기 위해 `Range`를 인덱스로 사용할 수 있습니다.
- **`&str`**: `HashMap`은 `&str`을 인덱스로 받아 값을 찾습니다 (`map["key"]`).

## 결론

`Index`와 `IndexMut`는 사용자 정의 컬렉션 타입을 만들 때 매우 유용한 트레이트입니다. 이들을 구현함으로써, 우리는 표준 라이브러리의 `Vec`이나 `HashMap`처럼 사용자들이 기대하는 직관적이고 편리한 인덱싱 문법을 제공할 수 있습니다. 이는 라이브러리의 사용성을 크게 향상시키고, 코드를 더 읽기 쉽게 만들어 줍니다.
