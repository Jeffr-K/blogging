---
title: "[Rust 소유권 시리즈] 03. 라이프타임"
author: anonymous.rs
date: 2025-12-24
tags: ["rust", "lifetime", "borrowing", "elision", "static"]
---

# 라이프타임 (Lifetime)

## 한 줄 요약

라이프타임은 **"이 참조가 얼마나 오래 유효한지"**를 컴파일러에게 알려주는 주석이다.

## 왜 라이프타임이 필요한가

```rust
fn longest(x: &str, y: &str) -> &str {
    if x.len() > y.len() { x } else { y }
}
```

이 코드는 컴파일 에러다. 반환하는 참조가 `x`에서 왔는지 `y`에서 왔는지 컴파일러가 모른다. 반환된 참조가 유효한지 검증할 수 없다.

```
error[E0106]: missing lifetime specifier
 --> src/main.rs:1:33
  |
  = help: this function's return type contains a borrowed value,
    but the signature does not say whether it is borrowed from `x` or `y`
```

## 라이프타임 문법

`'a` (아포스트로피 + 이름)으로 표기한다.

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

`'a`의 의미: "반환하는 참조는 `x`와 `y` 중 **더 짧은 수명** 동안 유효하다"

### 동작 확인

```rust
fn main() {
    let string1 = String::from("long string");

    {
        let string2 = String::from("xyz");
        let result = longest(string1.as_str(), string2.as_str());
        println!("더 긴 쪽: {}", result);  // OK — string2가 아직 살아있음
    }
    // 여기서 result를 쓰면 에러. string2가 이미 죽었으니까.
}
```

```rust
fn main() {
    let string1 = String::from("long string");
    let result;
    {
        let string2 = String::from("xyz");
        result = longest(string1.as_str(), string2.as_str());
    }
    // println!("{}", result);  // 컴파일 에러! string2의 수명이 끝남
}
```

## 라이프타임은 범위를 바꾸지 않는다

라이프타임 주석은 참조의 수명을 **늘리거나 줄이지 않는다**. 컴파일러에게 "이 참조들의 관계가 이렇다"를 알려줄 뿐이다.

```rust
// 'a는 "x와 반환값의 수명이 연결되어 있다"는 의미
fn first<'a>(x: &'a str, _y: &str) -> &'a str {
    x  // 항상 x를 반환하니까 y에는 라이프타임이 필요 없음
}
```

## 구조체의 라이프타임

구조체가 참조를 필드로 가지면 라이프타임이 필수다.

```rust
struct Excerpt<'a> {
    text: &'a str,
}

fn main() {
    let novel = String::from("Call me Ishmael. Some years ago...");
    let first = novel.split('.').next().unwrap();

    let excerpt = Excerpt { text: first };
    println!("{}", excerpt.text);
}
```

의미: "`Excerpt`는 `text`가 가리키는 데이터(`novel`)보다 오래 살 수 없다"

### 여러 라이프타임

```rust
struct Pair<'a, 'b> {
    first: &'a str,
    second: &'b str,
}
```

각 참조가 서로 다른 수명을 가질 수 있음을 표현한다.

## 라이프타임 생략 규칙 (Elision Rules)

매번 라이프타임을 쓰는 건 귀찮다. 컴파일러가 **자동 추론**하는 3가지 규칙이 있다.

### 규칙 1: 각 입력 참조에 별도 라이프타임 부여

```rust
fn foo(x: &str) → fn foo<'a>(x: &'a str)
fn foo(x: &str, y: &str) → fn foo<'a, 'b>(x: &'a str, y: &'b str)
```

### 규칙 2: 입력 라이프타임이 하나면, 출력에도 그것을 적용

```rust
fn foo(x: &str) -> &str → fn foo<'a>(x: &'a str) -> &'a str
```

### 규칙 3: 메서드에서 `&self`가 있으면, self의 라이프타임을 출력에 적용

```rust
impl<'a> Excerpt<'a> {
    // 이것은
    fn level(&self) -> &str { ... }
    // 사실 이것과 같다
    fn level<'b>(&'b self) -> &'b str { ... }
}
```

이 3규칙으로 해결 안 되면 명시적으로 써야 한다.

### 생략 가능한 경우 vs 불가능한 경우

```rust
// 생략 가능 (규칙 2 적용)
fn first_word(s: &str) -> &str { ... }

// 생략 가능 (규칙 3 적용)
impl Config {
    fn name(&self) -> &str { &self.name }
}

// 생략 불가 (입력이 2개인데 어느 것이 출력과 연결되는지 모호)
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str { ... }
```

## `'static` 라이프타임

프로그램 전체 실행 기간 동안 유효한 참조다.

```rust
let s: &'static str = "이 문자열은 바이너리에 저장됨";
```

문자열 리터럴은 모두 `'static`이다. 프로그램이 끝날 때까지 메모리에 있으니까.

### `'static`이 요구되는 상황

```rust
// 스레드에 넘기는 데이터는 'static이어야 함
use std::thread;

fn main() {
    let data = String::from("hello");

    thread::spawn(move || {
        println!("{}", data);  // data의 소유권을 이동 → 'static 충족
    });
}
```

`T: 'static`은 "T가 임시 참조를 포함하지 않는다"는 의미다. 소유된 데이터(`String`, `Vec<T>`)는 전부 `'static`을 만족한다.

### `'static` 오해 주의

```rust
// 이건 "영원히 살아있는 참조"
let s: &'static str = "hello";

// 이건 "임시 참조를 포함하지 않는 타입"
fn foo<T: 'static>(val: T) { ... }

// String은 T: 'static을 만족한다. 참조가 아니라 소유된 데이터니까.
foo(String::from("hello"));  // OK
```

## 라이프타임 바운드

제네릭과 라이프타임을 함께 쓸 때:

```rust
use std::fmt::Display;

fn longest_with_announcement<'a, T>(
    x: &'a str,
    y: &'a str,
    ann: T,
) -> &'a str
where
    T: Display,
{
    println!("알림: {}", ann);
    if x.len() > y.len() { x } else { y }
}
```

라이프타임 파라미터, 제네릭 타입 파라미터, 트레이트 바운드를 모두 조합할 수 있다.

## 실전 팁

### 1. 라이프타임과 싸우지 마라

```rust
// 라이프타임이 복잡해지면 → 소유된 타입을 쓰자
struct Config {
    name: String,     // &str 대신 String
    values: Vec<i32>, // &[i32] 대신 Vec<i32>
}
```

대부분의 경우 `String`과 `Vec`으로 충분하다. 성능이 문제가 될 때 참조로 최적화하면 된다.

### 2. 라이프타임이 필요한 진짜 상황

```rust
// 파서: 원본 텍스트의 일부를 가리킬 때
struct Token<'a> {
    text: &'a str,
    line: usize,
}

// 캐시: 원본 데이터의 참조를 저장할 때
struct Cache<'a> {
    data: &'a [u8],
    index: HashMap<&'a str, usize>,
}
```

큰 데이터를 복사하지 않고 참조로 다루는 게 성능상 중요할 때 라이프타임을 쓴다.

## 정리

| 개념 | 설명 |
|------|------|
| `'a` | 라이프타임 파라미터. 참조들의 수명 관계를 명시 |
| 생략 규칙 | 3가지 규칙으로 대부분 자동 추론 |
| `'static` | 프로그램 전체 기간 유효. 문자열 리터럴, 소유된 데이터 |
| 구조체 라이프타임 | 참조 필드가 있으면 필수 |

- 라이프타임은 참조의 유효 범위를 **설명**하는 것이지, **변경**하는 것이 아니다
- 복잡해지면 소유된 타입(`String`, `Vec`)을 먼저 쓰고 나중에 최적화하라
- 생략 규칙 3개를 알면 대부분의 경우 명시하지 않아도 된다

다음 글에서는 소유권을 유연하게 다루는 **스마트 포인터**를 다룬다.
