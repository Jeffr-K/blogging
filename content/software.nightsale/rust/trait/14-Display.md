---
title: "[Rust 트레이트 시리즈] 14. Display: 사용자를 위한 미려한 출력"
author: anonymous.rs
date: 2025-12-31
tags: ["rust", "trait", "display", "formatting", "tostring"]
---

# `Display`: 사용자를 위한 미려한 출력 포맷

`Display` 트레이트는 `Debug`와는 달리, 최종 사용자(end-user)에게 보여주기 위한 깔끔하고 읽기 좋은 문자열 표현을 정의하기 위해 사용됩니다. `println!`과 같은 포매팅 매크로에서 `{}` 지정자를 사용하면 `Display` 트레이트의 구현이 호출됩니다.

`Debug`가 "개발자가 무엇을 보고 싶어 하는가?"에 초점을 맞춘다면, `Display`는 "사용자가 무엇을 봐야 하는가?"에 대한 답을 제공합니다.

## `Debug` vs `Display`

| 특징         | `Debug`                               | `Display`                              |
|--------------|---------------------------------------|----------------------------------------|
| **목적**     | 개발자의 디버깅                       | 최종 사용자를 위한 표시                |
| **포맷 지정자** | `{:?}`, `{:#?}`                       | `{}`                                   |
| **구현 방식**  | `#[derive]`로 자동 구현 가능          | 항상 수동으로 구현해야 함              |
| **출력 형태**  | 타입 이름과 필드를 명확히 표시        | 간결하고 의미 있는 형태로 자유롭게 정의 |

타입의 '공식적인' 문자열 표현을 제공하고 싶다면 `Display`를 구현해야 합니다.

## `Display` 트레이트 수동 구현하기

`Display`는 어떻게 보여줄지에 대한 의도가 중요하기 때문에 `#[derive]`로 자동 구현할 수 없습니다. `std::fmt` 모듈의 `Formatter`를 사용하여 직접 구현해야 합니다.

`Point` 구조체를 `(x, y)` 형식의 좌표로 출력하도록 `Display`를 구현해 보겠습니다.

```rust
use std::fmt;

struct Point {
    x: i32,
    y: i32,
}

// Point에 대해 Display를 구현합니다.
impl fmt::Display for Point {
    // `f`는 출력이 기록될 버퍼 역할을 하는 Formatter입니다.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // `write!` 매크로를 사용하여 원하는 형식으로 문자열을 `f`에 씁니다.
        // `?` 연산자를 사용하여 쓰기 작업 중 발생할 수 있는 에러를 처리합니다.
        write!(f, "({}, {})", self.x, self.y)
    }
}

fn main() {
    let p = Point { x: 10, y: 20 };

    // `{}`를 사용하면 Display 구현이 호출됩니다.
    println!("좌표: {}", p);

    // `{:?}`를 사용하면 Debug 구현이 필요합니다.
    // println!("디버그: {:?}", p); // Debug를 구현하지 않으면 컴파일 에러
}
```
**출력:**
```
좌표: (10, 20)
```

## `ToString` 트레이트와의 연동

어떤 타입에 대해 `Display`를 구현하면, 해당 타입은 자동으로 `ToString` 트레이트를 만족하게 됩니다. 이는 `.to_string()` 메서드를 사용하여 해당 객체를 `String`으로 손쉽게 변환할 수 있음을 의미합니다.

```rust
// (위 Point의 Display 구현이 있다고 가정)

fn main() {
    let p = Point { x: 10, y: 20 };

    // .to_string() 메서드를 사용할 수 있습니다.
    let point_as_string: String = p.to_string();

    assert_eq!(point_as_string, "(10, 20)");
    println!("String으로 변환된 좌표: {}", point_as_string);
}
```

## 에러 타입과 `Display`

사용자 정의 에러 타입을 만들 때 `Display`를 구현하는 것은 매우 좋은 습관입니다. 이를 통해 사용자에게 친절하고 이해하기 쉬운 에러 메시지를 제공할 수 있습니다. 많은 라이브러리와 애플리케이션이 에러를 출력할 때 `Display` 구현을 사용합니다.

```rust
use std::fmt;

#[derive(Debug)]
enum MyError {
    FileNotFound(String),
    ConnectionTimeout,
}

impl fmt::Display for MyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MyError::FileNotFound(path) => write!(f, "파일을 찾을 수 없습니다: {}", path),
            MyError::ConnectionTimeout => write!(f, "연결 시간이 초과되었습니다."),
        }
    }
}
// `std::error::Error` 트레이트를 구현하려면 `Debug`와 `Display`가 모두 필요합니다.
impl std::error::Error for MyError {}
```

## 결론

`Display` 트레이트는 당신의 타입을 러스트의 포매팅 시스템에 완벽하게 통합시켜주는 공식적인 창구입니다. `Debug`가 개발의 편의성을 위한 것이라면, `Display`는 프로그램의 완성도와 사용자 경험을 높이는 데 기여합니다. `.to_string()`과의 자동 연동, 에러 메시지 표현 등 다양한 곳에서 활용되므로, 사용자에게 보여줄 필요가 있는 모든 타입에 대해 `Display`를 구현하는 것을 적극적으로 고려해야 합니다.
