---
title: "[Rust 트레이트 시리즈] 10. TryFrom/TryInto: 실패 가능한 타입 변환"
author: anonymous.rs
date: 2025-12-30
tags: ["rust", "trait", "conversion", "tryfrom", "tryinto", "타입변환", "에러처리"]
---

# `TryFrom`과 `TryInto`: 실패 가능한 타입 변환

`From`/`Into` 트레이트가 항상 성공하는, 즉 실패하지 않는(infallible) 타입 변환을 다루는 반면, 실제 프로그래밍에서는 변환이 실패할 수 있는 경우가 많습니다. 예를 들어, 모든 `i32` 정수가 '양수'가 될 수는 없으며, 모든 문자열이 유효한 IP 주소는 아닙니다.

이러한 **실패 가능한(fallible) 변환**을 다루기 위해 러스트는 `TryFrom`과 `TryInto` 트레이트를 제공합니다. 이들은 변환의 결과로 `Result` 타입을 반환하여, 성공과 실패 케이스를 명확하게 처리하도록 강제합니다.

## `TryFrom`과 `TryInto`의 관계

`From`/`Into`와 마찬가지로, `TryFrom`과 `TryInto`도 서로 쌍을 이룹니다. `TryFrom<A> for B`를 구현하면, `TryInto<B> for A`는 자동으로 구현됩니다. 따라서 우리는 항상 `TryFrom`을 구현하는 것을 목표로 해야 합니다.

```rust
pub trait TryFrom<T>: Sized {
    // 변환 실패 시 반환될 에러 타입을 지정합니다.
    type Error;

    // T 타입의 값을 `Self` 타입으로 변환 시도합니다.
    fn try_from(value: T) -> Result<Self, Self::Error>;
}
```

## `TryFrom` 구현하기

양수만을 표현하는 `PositiveNumber` 타입을 만들고, `i32`로부터 이 타입으로 변환하는 `TryFrom` 구현을 작성해 보겠습니다. 음수가 입력되면 변환은 실패해야 합니다.

```rust
#[derive(Debug, PartialEq)]
struct PositiveNumber(i32);

// i32에서 PositiveNumber로의 변환은 실패할 수 있으므로 TryFrom을 구현합니다.
impl TryFrom<i32> for PositiveNumber {
    // 실패 시 에러 타입을 정의합니다. 여기서는 간단히 String을 사용합니다.
    type Error = String;

    fn try_from(value: i32) -> Result<Self, Self::Error> {
        if value > 0 {
            // 성공: Ok variant에 변환된 값을 담아 반환합니다.
            Ok(PositiveNumber(value))
        } else {
            // 실패: Err variant에 에러 메시지를 담아 반환합니다.
            Err(format!("양수만 허용됩니다. 입력된 값: {}", value))
        }
    }
}

fn main() {
    // 성공하는 경우
    let num1 = PositiveNumber::try_from(10);
    assert_eq!(num1, Ok(PositiveNumber(10)));
    println!("10 변환 성공: {:?}", num1);

    // 실패하는 경우
    let num2 = PositiveNumber::try_from(-5);
    assert!(num2.is_err());
    println!("-5 변환 실패: {:?}", num2);

    // .try_into() 사용
    let num3: Result<PositiveNumber, String> = 100.try_into();
    assert_eq!(num3, Ok(PositiveNumber(100)));
    println!("100 .try_into() 성공: {:?}", num3);
}
```

## `TryFrom`의 실제 사용 예

`TryFrom`은 값의 범위를 제한하거나, 특정 형식을 검증하는 등 다양한 상황에서 유용하게 사용됩니다.

-   **정수 타입 간의 변환**: 더 큰 범위의 정수(`u64`)를 더 작은 범위의 정수(`u32`)로 변환할 때, 값이 잘릴(truncate) 위험이 있다면 `TryFrom`을 사용하여 안전하게 처리할 수 있습니다.
-   **문자열 파싱**: 특정 형식을 가진 문자열(예: "R,G,B")을 `Color` 구조체로 변환할 때, 형식이 맞지 않으면 실패할 수 있습니다.
-   **열거형 변환**: 숫자 값을 특정 의미를 가진 열거형으로 변환할 때, 유효하지 않은 숫자 값에 대해 실패 처리를 할 수 있습니다.

```rust
#[derive(Debug, PartialEq)]
enum Color {
    Red,
    Green,
    Blue,
}

impl TryFrom<u8> for Color {
    type Error = &'static str;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Color::Red),
            1 => Ok(Color::Green),
            2 => Ok(Color::Blue),
            _ => Err("유효하지 않은 색상 코드입니다."),
        }
    }
}

fn main() {
    let color = Color::try_from(1);
    assert_eq!(color, Ok(Color::Green));
    
    let invalid_color = Color::try_from(99);
    assert_eq!(invalid_color, Err("유효하지 않은 색상 코드입니다."));
}
```

## 결론

`TryFrom`과 `TryInto`는 실패의 가능성을 타입 시스템에 명확하게 표현하여, 런타임 에러를 컴파일 타임에 잡을 수 있도록 돕는 강력한 도구입니다. 변환 과정에서 유효성 검사가 필요하거나 값이 소실될 위험이 있는 모든 경우에 `TryFrom`을 사용하는 것은 코드를 훨씬 더 견고하고 예측 가능하게 만들어 줍니다. `Result`와 `?` 연산자와 함께 사용될 때 그 진가가 더욱 발휘됩니다.
