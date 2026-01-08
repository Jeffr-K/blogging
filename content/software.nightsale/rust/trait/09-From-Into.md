---
title: "[Rust 트레이트 시리즈] 09. From/Into: 소유권을 이전하는 타입 변환"
author: anonymous.rs
date: 2025-12-30
tags: ["rust", "trait", "conversion", "from", "into", "타입변환"]
---

# `From`과 `Into`: 소유권을 이전하는 타입 변환

러스트에서 타입 변환은 명시적이며, 안전성을 최우선으로 합니다. `From`과 `Into` 트레이트는 이러한 타입 변환을 위한 가장 기본적이고 관용적인 방법을 제공합니다. 두 트레이트는 값의 소유권을 이전하면서 한 타입에서 다른 타입으로 변환하는, 실패하지 않는(infallible) 변환을 다룹니다.

## `From`과 `Into`의 관계

`From`과 `Into`는 동전의 양면과 같습니다.

-   **`From<T>`**: `T` 타입의 값으로부터 `Self` 타입의 인스턴스를 생성하는 방법을 정의합니다. **주로 이 트레이트를 직접 구현합니다.**
-   **`Into<T>`**: `self`를 `T` 타입의 값으로 변환하는 방법을 정의합니다.

러스트 표준 라이브러리에는 다음과 같은 '블랭킷 구현(blanket implementation)'이 있습니다.
```rust
impl<T, U> Into<U> for T where U: From<T> {
    fn into(self) -> U {
        U::from(self)
    }
}
```
이것의 의미는, **`From<A> for B`를 구현하면, `A.into()`를 통해 `B`로 변환하는 `Into<B> for A`는 자동으로 구현된다**는 것입니다.

따라서, 우리는 항상 `From` 트레이트를 구현하는 것을 목표로 해야 합니다.

## `From` 트레이트 구현하기

사용자 정의 `Point` 구조체를 만들고, `(i32, i32)` 튜플로부터 `Point`를 생성하는 `From` 구현을 추가해 보겠습니다.

```rust
#[derive(Debug)]
struct Point {
    x: i32,
    y: i32,
}

// (i32, i32) 튜플로부터 Point를 생성하는 방법을 정의합니다.
impl From<(i32, i32)> for Point {
    fn from(tuple: (i32, i32)) -> Self {
        Point { x: tuple.0, y: tuple.1 }
    }
}

// &str로부터 String을 만드는 것은 표준 라이브러리에 이미 구현된 대표적인 예시입니다.
// impl From<&str> for String { ... }

fn main() {
    let my_tuple = (10, 20);

    // 1. `From::from()`을 직접 사용하기
    let p1 = Point::from(my_tuple);

    // 2. `.into()`를 사용하기 (From 구현 덕분에 자동으로 사용 가능)
    //    컴파일러가 변환될 타입을 추론해야 하므로 타입 명시가 필요할 수 있습니다.
    let p2: Point = my_tuple.into();

    println!("p1: {:?}, p2: {:?}", p1, p2);

    // &str -> String 변환 예시
    let hello_str = "hello";
    let hello_string = String::from(hello_str); // From 사용
    let world_string: String = "world".into();   // Into 사용
    println!("{} {}", hello_string, world_string);
}
```

## 왜 `Into`보다 `From`을 구현해야 하는가?

`From`을 구현하면 `Into`가 자동으로 생긴다는 점 외에도, `From`을 구현하는 것이 더 명확하고 유연합니다.

-   **명확성**: `MyType::from(other_value)`는 어떤 타입으로 변환되는지가 코드상에서 명확합니다. `other_value.into()`는 타입 추론에 의존하므로 때로는 모호할 수 있습니다.
-   **유연성**: 제네릭 함수에서 `T: From<MyType>` 과 같은 경계(bound)를 사용하는 것이 `T: Into<MyType>` 보다 더 유연한 경우가 많습니다.

## `From`의 활용: 에러 처리

`From` 트레이트는 에러 처리를 간소화하는 데에도 매우 유용하게 사용됩니다. 여러 다른 종류의 에러를 하나의 공통된 에러 타입으로 변환할 때 `?` 연산자는 내부적으로 `From::from`을 호출하여 에러 타입을 자동으로 변환해 줍니다.

```rust
use std::fs;
use std::io;

// 우리의 커스텀 에러 타입
#[derive(Debug)]
enum AppError {
    Io(io::Error),
    Parse(std::num::ParseIntError),
}

// io::Error가 발생하면 AppError::Io로 변환되도록 `From`을 구현
impl From<io::Error> for AppError {
    fn from(error: io::Error) -> Self {
        AppError::Io(error)
    }
}

// ParseIntError가 발생하면 AppError::Parse로 변환되도록 `From`을 구현
impl From<std::num::ParseIntError> for AppError {
    fn from(error: std::num::ParseIntError) -> Self {
        AppError::Parse(error)
    }
}

fn read_and_parse() -> Result<i32, AppError> {
    let content = fs::read_to_string("number.txt")?; // `?`가 io::Error를 AppError::Io로 자동 변환
    let number = content.trim().parse::<i32>()?;      // `?`가 ParseIntError를 AppError::Parse로 자동 변환
    Ok(number)
}
```

## 결론

`From`과 `Into` 트레이트는 러스트의 타입 시스템에서 명확하고 안전한 변환을 제공하는 핵심 도구입니다. 항상 `From` 트레이트를 구현함으로써 코드의 재사용성과 명확성을 높이고, `into()`의 편리함을 누리는 것이 가장 좋은 방법입니다. 또한 에러 처리와 같은 고급 패턴에서도 중요한 역할을 하므로 반드시 숙지해야 할 트레이트입니다.
