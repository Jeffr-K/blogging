---
title: "[Rust 트레이트 시리즈] 16. Default: 타입의 기본값 생성하기"
author: anonymous.rs
date: 2025-12-31
tags: ["rust", "trait", "default", "struct", "initialization"]
---

# `Default`: 타입의 기본값 생성하기

`Default` 트레이트는 타입에 대한 '기본(default)' 또는 '빈(empty)' 인스턴스를 생성하는 표준적인 방법을 제공합니다. 이 트레이트를 구현하는 타입은 `Default::default()`라는 연관 함수(associated function)를 갖게 되며, 이를 통해 해당 타입의 기본값을 손쉽게 만들 수 있습니다.

이는 특히 설정(configuration) 구조체나 빌더(builder) 패턴, 또는 많은 필드를 가진 구조체를 초기화할 때 매우 유용합니다.

## `Default` 트레이트 사용하기

`Default`의 핵심은 `default()` 함수입니다.

```rust
pub trait Default {
    fn default() -> Self;
}
```

숫자 타입의 기본값은 `0`이고, `String`과 `Vec`의 기본값은 비어 있는 인스턴스입니다.

```rust
fn main() {
    let i: i32 = Default::default();
    let s: String = Default::default();
    let v: Vec<i32> = Default::default();

    println!("i = {}, s = \"{}\", v = {:?}", i, s, v);
    // 출력: i = 0, s = "", v = []
}
```

구조체를 초기화할 때 `..Default::default()` 문법을 사용하면, 명시적으로 값을 지정하지 않은 필드들을 해당 필드 타입의 기본값으로 채울 수 있어 매우 편리합니다.

```rust
#[derive(Debug, Default)]
struct AppConfig {
    theme: String,
    font_size: u32,
    show_toolbar: bool,
}

fn main() {
    let config = AppConfig {
        theme: "dark".to_string(),
        ..Default::default() // font_size와 show_toolbar는 기본값으로 채워짐
    };

    println!("{:#?}", config);
    // 출력:
    // AppConfig {
    //     theme: "dark",
    //     font_size: 0,
    //     show_toolbar: false,
    // }
}
```

## `#[derive(Default)]`: 간편한 `Default` 구현

구조체나 열거형의 모든 필드가 `Default` 트레이트를 구현한다면, `#[derive(Default)]` 속성을 사용하여 컴파일러가 `Default` 구현을 자동으로 생성하도록 할 수 있습니다. 컴파일러는 각 필드를 해당 타입의 `default()` 값으로 초기화하는 코드를 만들어 줍니다.

```rust
#[derive(Debug, Default)]
struct MyPoint {
    x: i32, // i32의 기본값은 0
    y: i32, // i32의 기본값은 0
}

fn main() {
    let origin = MyPoint::default();
    println!("{:?}", origin); // 출력: MyPoint { x: 0, y: 0 }
}
```

## `Default` 수동 구현

때로는 타입의 기본값이 단순히 필드들의 기본값 조합이 아닌, 특별한 값을 가져야 할 경우가 있습니다. 이럴 때는 `Default`를 직접 수동으로 구현할 수 있습니다.

예를 들어, 어떤 네트워크 연결 설정에서 기본 재시도 횟수를 `3`으로 설정하고 싶다고 가정해 봅시다.

```rust
#[derive(Debug)]
struct ConnectionConfig {
    retries: u32,
    timeout_ms: u64,
}

// ConnectionConfig에 대한 Default를 수동으로 구현
impl Default for ConnectionConfig {
    fn default() -> Self {
        ConnectionConfig {
            retries: 3, // 기본 재시도 횟수는 0이 아닌 3
            timeout_ms: 5000,
        }
    }
}

fn main() {
    let config = ConnectionConfig::default();
    println!("{:?}", config); // 출력: ConnectionConfig { retries: 3, timeout_ms: 5000 }
}
```

## 제네릭과 `Default`

`Default` 트레이트는 제네릭 코드에서도 유용하게 사용됩니다. 어떤 타입 `T`의 기본 인스턴스를 생성해야 할 때, `T: Default` 라는 트레이트 경계(bound)를 추가하여 `T::default()`를 호출할 수 있습니다.

## 결론

`Default` 트레이트는 타입의 인스턴스화를 더 간단하고 표현력 있게 만들어주는 작지만 강력한 도구입니다. `#[derive]`를 통해 대부분의 경우 손쉽게 적용할 수 있으며, `..Default::default()` 문법과 결합될 때 구조체 초기화 코드를 훨씬 간결하게 만들어 줍니다. 라이브러리나 애플리케이션의 설정 객체를 정의할 때 `Default`를 구현하는 것은 매우 좋은 습관입니다.
