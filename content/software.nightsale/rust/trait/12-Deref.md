---
title: "[Rust 트레이트 시리즈] 12. Deref: 스마트 포인터의 마법"
author: anonymous.rs
date: 2025-12-31
tags: ["rust", "trait", "deref", "deref-coercion", "스마트포인터"]
---

# `Deref`와 `DerefMut`: 스마트 포인터의 마법

`Deref` 트레이트는 러스트의 스마트 포인터(Smart Pointers)가 일반 참조(reference)처럼 자연스럽게 동작하도록 만드는 핵심 메커니즘입니다. 이 트레이트를 구현하면, 특정 타입의 인스턴스에 역참조 연산자(`*`)를 사용했을 때의 동작을 직접 정의할 수 있습니다. `Box<T>`, `String`, `Arc<T>`와 같은 표준 라이브러리의 많은 타입들이 이 `Deref`의 마법 위에서 동작합니다.

## `Deref` 트레이트란?

`Deref` 트레이트는 `deref`라는 단 하나의 메서드를 요구합니다.

```rust
pub trait Deref {
    // 역참조했을 때 얻게 될 목표 타입을 지정합니다.
    type Target: ?Sized;

    // `&self`를 받아 내부 데이터에 대한 참조 `&Self::Target`을 반환합니다.
    fn deref(&self) -> &Self::Target;
}
```
`Deref`를 구현한 타입의 값 `x`에 대해 `*x`를 사용하면, 컴파일러는 이를 `*(x.deref())`로 변환하여 처리합니다.

## 직접 `Deref` 구현하기: `MyBox<T>`

`Box<T>`와 유사한 우리만의 스마트 포인터 `MyBox<T>`를 만들어 `Deref`를 구현해 보겠습니다.

```rust
use std::ops::Deref;

struct MyBox<T>(T);

impl<T> MyBox<T> {
    fn new(x: T) -> MyBox<T> {
        MyBox(x)
    }
}

// MyBox<T>에 대해 Deref를 구현합니다.
impl<T> Deref for MyBox<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        // 튜플 구조체의 첫 번째 필드(데이터)에 대한 참조를 반환합니다.
        &self.0
    }
}

fn main() {
    let x = 5;
    let y = MyBox::new(x);

    assert_eq!(5, x);
    // `*y`는 컴파일러에 의해 `*(y.deref())`로 처리되어,
    // MyBox 내부의 값 5에 접근할 수 있게 됩니다.
    assert_eq!(5, *y);
}
```

## `Deref`의 꽃: 역참조 강제 변환 (Deref Coercion)

`Deref`의 진정한 강력함은 **역참조 강제 변환(Deref Coercion)**이라는 기능에서 나옵니다. `Deref`를 구현한 타입의 참조(`&MyBox<T>`)가 함수나 메서드 호출 시 인자로 전달될 때, 컴파일러는 필요에 따라 `deref` 메서드를 연쇄적으로 호출하여 타입을 자동으로 변환해 줍니다.

이는 다음과 같은 편리함을 제공합니다.

```rust
// (MyBox 구현은 위와 동일)

// 이 함수는 `&str` 슬라이스를 인자로 받습니다.
fn display_str(s: &str) {
    println!("{}", s);
}

fn main() {
    // `MyBox`로 감싼 `String`
    let m = MyBox::new(String::from("Rust"));

    // `&m`의 타입은 `&MyBox<String>` 입니다.
    // 하지만 `display_str` 함수는 `&str` 타입을 요구합니다.
    // 그런데도 아래 코드는 완벽하게 동작합니다!
    display_str(&m);
}
```
어떻게 이것이 가능할까요? 컴파일러는 다음 순서로 Deref Coercion을 수행합니다.

1.  `&m` (`&MyBox<String>`)에서 `.deref()`를 호출하여 `&String`을 얻습니다.
2.  `String` 또한 `Deref<Target = str>`을 구현하므로, `&String`에서 `.deref()`를 한 번 더 호출하여 `&str`을 얻습니다.
3.  최종적으로 얻어진 `&str` 타입이 `display_str` 함수가 요구하는 타입과 일치하므로, 함수 호출이 성공합니다.

이러한 자동 변환 덕분에 우리는 번거로운 `&(*m)[..]` 같은 코드를 작성할 필요 없이, 스마트 포인터를 마치 내부 데이터인 것처럼 편리하게 사용할 수 있습니다.

## `DerefMut`: 가변 역참조

`DerefMut` 트레이트는 `Deref`의 가변(mutable) 버전입니다. `deref_mut` 메서드를 구현하여 `*` 연산자를 통해 내부 데이터에 대한 가변 참조를 얻고 값을 수정할 수 있게 해줍니다.

## 결론

`Deref` 트레이트는 단순한 문법적 설탕을 넘어, 스마트 포인터와 같은 래퍼(wrapper) 타입을 만들 때 사용성과 표현력을 극대화하는 강력한 도구입니다. 역참조 강제 변환(Deref Coercion)을 통해 서로 다른 타입들을 매끄럽게 연결해 줌으로써, 러스트 코드를 더욱 유연하고 간결하게 만들어주는 일등공신이라 할 수 있습니다.
