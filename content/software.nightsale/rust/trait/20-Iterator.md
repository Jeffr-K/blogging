---
title: "[Rust 트레이트 시리즈] 20. Iterator: 데이터 시퀀스를 다루는 우아한 방법"
author: anonymous.rs
date: 2026-01-02
tags: ["rust", "trait", "iterator", "functional-programming", "next", "lazy-evaluation"]
---

# `Iterator`: 데이터 시퀀스를 다루는 우아한 방법

`Iterator` 트레이트는 러스트의 표준 라이브러리에서 가장 강력하고 널리 사용되는 추상화 중 하나입니다. `for` 루프의 기반이 될 뿐만 아니라, `map`, `filter`, `fold` 등 강력한 함수형 프로그래밍 스타일의 메서드 체이닝을 가능하게 하여 데이터 시퀀스를 효율적이고 우아하게 처리할 수 있도록 돕습니다.

## `Iterator`의 핵심: `next` 메서드

`Iterator` 트레이트의 정의를 살펴보면, 수많은 메서드가 있지만 단 하나, `next` 메서드만이 필수적으로 구현해야 하는 유일한 메서드입니다.

```rust
pub trait Iterator {
    // 이터레이터가 생성하는 요소의 타입을 지정합니다.
    type Item;

    // 시퀀스의 다음 요소를 반환합니다. 시퀀스가 끝나면 `None`을 반환합니다.
    fn next(&mut self) -> Option<Self::Item>;

    // map, filter, fold 등 수많은 다른 메서드들은
    // next를 사용하여 기본적으로 구현되어 있습니다.
}
```
- `next()` 메서드는 호출될 때마다 시퀀스의 다음 요소를 `Some(value)` 형태로 반환합니다.
- 순회가 끝나 더 이상 반환할 요소가 없으면, `None`을 반환합니다.
- 이 `Option` 기반의 디자인 덕분에, 개발자는 시퀀스의 끝을 명시적으로 확인하고 안전하게 처리를 중단할 수 있습니다.

## 커스텀 이터레이터 구현하기

1부터 5까지 숫자를 생성하는 간단한 `Counter` 이터레이터를 직접 만들어 보겠습니다.

```rust
struct Counter {
    current: u32,
    max: u32,
}

impl Counter {
    fn new(max: u32) -> Self {
        Counter { current: 0, max }
    }
}

// Counter에 대해 Iterator 트레이트를 구현합니다.
impl Iterator for Counter {
    type Item = u32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current < self.max {
            self.current += 1;
            Some(self.current)
        } else {
            None // 5까지 모두 생성했으면 None을 반환하여 순회 종료를 알립니다.
        }
    }
}

fn main() {
    let mut counter = Counter::new(5);

    assert_eq!(counter.next(), Some(1));
    assert_eq!(counter.next(), Some(2));
    assert_eq!(counter.next(), Some(3));
    assert_eq!(counter.next(), Some(4));
    assert_eq!(counter.next(), Some(5));
    assert_eq!(counter.next(), None); // 이제부터는 계속 None
}
```

## 이터레이터의 진정한 힘: 어댑터(Adapters)와 소비자(Consumers)

`next` 메서드 하나만 구현했을 뿐인데, 우리는 수십 개의 강력한 메서드를 공짜로 얻게 됩니다. 이들은 크게 '어댑터'와 '소비자'로 나뉩니다.

### 1. 어댑터 (Adapters)
어댑터는 이터레이터를 받아서 새로운, 변형된 이터레이터를 반환하는 메서드입니다. 이들은 **게으르게(lazily)** 동작합니다. 즉, 실제로 값이 필요하기 전까지는 아무런 계산도 하지 않습니다.
- **`map`**: 각 요소에 클로저를 적용하여 새로운 이터레이터를 생성합니다.
- **`filter`**: 각 요소에 대해 클로저(predicate)를 실행하여, `true`를 반환하는 요소만 남깁니다.
- **`take`**: 처음 `n`개의 요소만 취합니다.
- **`rev`**: 순서를 뒤집습니다.

### 2. 소비자 (Consumers)
소비자는 이터레이터를 '소비'하여 최종적인 값을 만들어내는 메서드입니다. 소비자가 호출될 때 비로소 모든 게으른 연산들이 실제로 실행됩니다.
- **`collect`**: 이터레이터의 모든 요소를 모아 `Vec<T>`와 같은 컬렉션으로 만듭니다.
- **`sum`**: 모든 요소의 합을 구합니다.
- **`fold`**: 초기값과 클로저를 사용하여 모든 요소를 하나의 값으로 누적시킵니다.
- **`for_each`**: 각 요소에 대해 클로저를 실행합니다.

### 체이닝 예시

어댑터와 소비자를 연결(chaining)하여 복잡한 데이터 처리를 간결하게 표현할 수 있습니다.

```rust
// (Counter 구현은 위와 동일)

fn main() {
    let sum_of_even_squares: u32 = Counter::new(10)      // 1..10 이터레이터 생성
        .map(|n| n * n)             // 각 숫자를 제곱 (1, 4, 9, ..., 100)
        .filter(|sq| sq % 2 == 0)   // 짝수만 필터링 (4, 16, 36, 64, 100)
        .sum();                     // 최종 합계를 계산 (소비)

    println!("1부터 10까지 숫자 중, 제곱값이 짝수인 것들의 합: {}", sum_of_even_squares);
    assert_eq!(sum_of_even_squares, 220);
}
```
이러한 메서드 체이닝은 컴파일러에 의해 고도로 최적화되어, 직접 `for` 루프를 작성한 것과 거의 동일하거나 더 빠른 성능을 내는 **제로 비용 추상화(Zero-cost Abstraction)**의 대표적인 예입니다.

## 결론

`Iterator` 트레이트는 러스트의 핵심 철학을 보여주는 가장 우아한 예시 중 하나입니다. 최소한의 요구사항(`next` 메서드)으로 최대한의 기능(수많은 어댑터와 소비자)을 제공하며, 이를 통해 개발자는 안전하고, 빠르며, 매우 표현력 있는 코드를 작성할 수 있습니다.
