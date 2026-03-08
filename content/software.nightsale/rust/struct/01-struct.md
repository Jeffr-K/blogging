---
title: "[Rust 구조체 시리즈] 01. 구조체란 무엇인가"
author: anonymous.rs
date: 2025-12-28
tags: ["rust", "struct", "기초", "소유권"]
---

# 구조체(Struct)란 무엇인가

## 한 줄 요약

구조체는 **관련 있는 데이터를 하나로 묶는 사용자 정의 타입**이다.

## 다른 언어와 비교

- C의 `struct`와 가장 비슷하다
- Java/C#의 `class`에서 상속을 빼고 데이터만 남긴 것과 유사하다
- Go의 `struct`와 거의 같은 개념이다
- 러스트에는 클래스가 없다. **구조체 + 트레이트**가 그 역할을 대신한다

## 기본 문법

### 1. 일반 구조체 (Named Struct)

가장 흔하게 쓰이는 형태다. 각 필드에 이름이 있다.

```rust
struct User {
    username: String,
    email: String,
    age: u32,
    active: bool,
}

fn main() {
    let user = User {
        username: String::from("ferris"),
        email: String::from("ferris@rust-lang.org"),
        age: 10,
        active: true,
    };

    println!("이름: {}", user.username);
}
```

### 2. 튜플 구조체 (Tuple Struct)

필드에 이름 대신 순서로 접근한다. 타입에 의미를 부여하고 싶을 때 쓴다.

```rust
struct Color(u8, u8, u8);
struct Point(f64, f64, f64);

fn main() {
    let red = Color(255, 0, 0);
    let origin = Point(0.0, 0.0, 0.0);

    println!("R: {}", red.0);
    println!("x: {}", origin.0);
}
```

`Color`와 `Point`는 둘 다 숫자 3개를 담지만, **서로 다른 타입**이다. 컴파일러가 실수를 잡아준다.

```rust
fn paint(color: Color) { /* ... */ }

paint(origin);  // 컴파일 에러! Point는 Color가 아님
```

### 3. 유닛 구조체 (Unit Struct)

필드가 없는 구조체다. 트레이트 구현의 "그릇" 역할을 할 때 쓴다.

```rust
struct Marker;

impl Marker {
    fn ping(&self) {
        println!("pong");
    }
}
```

트레이트 시리즈에서 다뤘던 것처럼, 특정 트레이트를 구현하기 위한 껍데기로 자주 사용된다.

```rust
trait Greet {
    fn say_hello(&self) -> String {
        String::from("안녕")
    }
}

struct Silent;
impl Greet for Silent {}  // 기본 구현 그대로 사용
```

## 소유권과 구조체

구조체는 러스트의 소유권 시스템과 밀접하게 연결된다.

### 필드의 소유권

구조체가 데이터를 **소유**하려면 `String` 같은 소유 타입을 써야 한다.

```rust
// 소유하는 구조체 (일반적)
struct User {
    name: String,  // 데이터를 소유함
}

// 참조하는 구조체 (라이프타임 필요)
struct UserRef<'a> {
    name: &'a str,  // 데이터를 빌림
}
```

초보 때는 필드에 `String`을 쓰고, 라이프타임이 익숙해지면 `&str` 참조도 활용하면 된다.

### 구조체의 이동(Move)

구조체는 기본적으로 이동 시맨틱을 따른다.

```rust
let user1 = User {
    name: String::from("ferris"),
};

let user2 = user1;  // user1의 소유권이 user2로 이동
// println!("{}", user1.name);  // 컴파일 에러! user1은 이미 이동됨
```

복제가 필요하면 `Clone` 트레이트를 구현하면 된다.

```rust
#[derive(Clone)]
struct User {
    name: String,
}

let user1 = User { name: String::from("ferris") };
let user2 = user1.clone();  // 깊은 복사
println!("{}", user1.name);  // OK, user1 여전히 유효
```

## 구조체 업데이트 문법

기존 구조체에서 일부 필드만 바꿔 새 인스턴스를 만들 때 `..` 문법을 쓴다.

```rust
struct Config {
    debug: bool,
    verbose: bool,
    max_retries: u32,
}

let default_config = Config {
    debug: false,
    verbose: false,
    max_retries: 3,
};

let dev_config = Config {
    debug: true,
    ..default_config  // 나머지는 default_config에서 가져옴
};
```

주의: `..`는 소유권 이동이 발생한다. `String` 같은 필드가 있으면 원본을 더 이상 쓸 수 없다.

```rust
struct User {
    name: String,
    age: u32,
}

let user1 = User { name: String::from("ferris"), age: 10 };
let user2 = User { age: 20, ..user1 };  // name이 이동됨

// println!("{}", user1.name);  // 에러!
println!("{}", user1.age);      // OK, u32는 Copy 타입이라 이동 안 됨
```

## `#[derive]`로 자주 쓰는 트레이트 자동 구현

구조체를 실전에서 쓸 때는 거의 항상 `derive`와 함께 쓴다.

```rust
#[derive(Debug, Clone, PartialEq)]
struct Point {
    x: f64,
    y: f64,
}

fn main() {
    let p1 = Point { x: 1.0, y: 2.0 };
    let p2 = p1.clone();

    println!("{:?}", p1);       // Debug
    println!("{}", p1 == p2);   // PartialEq
}
```

| derive 트레이트 | 효과 |
|----------------|------|
| `Debug` | `{:?}`로 출력 가능 |
| `Clone` | `.clone()`으로 복제 가능 |
| `PartialEq` | `==` 비교 가능 |
| `Default` | 기본값 생성 가능 |
| `Copy` | 암묵적 복사 가능 (모든 필드가 Copy일 때) |

## 가시성 (Visibility)

구조체와 필드는 기본적으로 **비공개(private)**다. 외부 모듈에서 접근하려면 `pub`을 붙여야 한다.

```rust
pub struct Config {
    pub debug: bool,       // 외부에서 접근 가능
    pub verbose: bool,     // 외부에서 접근 가능
    secret_key: String,    // 외부에서 접근 불가
}
```

구조체에 `pub`을 붙여도 필드는 여전히 비공개다. **각 필드에 개별적으로** `pub`을 붙여야 한다.

## 정리

- 구조체 = 관련 데이터를 묶는 사용자 정의 타입
- 일반 구조체, 튜플 구조체, 유닛 구조체 세 종류가 있다
- 소유권 규칙이 구조체에도 그대로 적용된다
- `..` 문법으로 기존 값 기반 새 인스턴스 생성 가능
- `#[derive]`로 표준 트레이트를 간편하게 구현한다
- 필드의 가시성은 구조체와 별개로 관리된다

다음 글에서는 `impl` 블록으로 구조체에 메서드를 붙이는 방법을 다룰 예정이다.
