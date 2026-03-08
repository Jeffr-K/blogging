---
title: "[Rust 소유권 시리즈] 02. 참조와 빌림"
author: anonymous.rs
date: 2025-12-23
tags: ["rust", "borrowing", "reference", "mutable", "규칙"]
---

# 참조와 빌림 (Borrowing)

## 한 줄 요약

빌림은 **소유권을 이전하지 않고 값을 사용하는 방법**이다.

## 문제: 매번 소유권을 넘기면 불편하다

```rust
fn calculate_length(s: String) -> (String, usize) {
    let len = s.len();
    (s, len)  // 소유권을 돌려줘야 함
}

fn main() {
    let s1 = String::from("hello");
    let (s1, len) = calculate_length(s1);
    println!("'{}' 길이: {}", s1, len);
}
```

값을 쓸 때마다 소유권을 넘기고 돌려받는 건 너무 번거롭다.

## 해결: 참조 (`&`)

소유권을 넘기지 않고 **빌려주면** 된다.

```rust
fn calculate_length(s: &String) -> usize {
    s.len()
}

fn main() {
    let s1 = String::from("hello");
    let len = calculate_length(&s1);  // 빌려줌
    println!("'{}' 길이: {}", s1, len);  // s1 여전히 유효
}
```

`&s1`은 s1의 **참조(reference)**를 만든다. 참조는 값을 가리키지만 소유하지 않는다.

```
s1: [ptr][len][cap] → "hello"
      ↑
&s1: [ptr]  (s1을 가리킴)
```

참조가 스코프를 벗어나도 원본은 해제되지 않는다. 소유자가 아니니까.

## 불변 참조 (`&T`)

기본 참조는 읽기 전용이다.

```rust
fn print_name(name: &String) {
    println!("{}", name);
    // name.push_str("!");  // 컴파일 에러! 불변 참조로는 수정 불가
}
```

불변 참조는 **여러 개** 동시에 만들 수 있다.

```rust
let s = String::from("hello");
let r1 = &s;
let r2 = &s;
let r3 = &s;
println!("{}, {}, {}", r1, r2, r3);  // 전부 OK
```

읽기만 하니까 여러 명이 동시에 봐도 문제없다.

## 가변 참조 (`&mut T`)

값을 수정하려면 가변 참조를 써야 한다.

```rust
fn append_world(s: &mut String) {
    s.push_str(", world!");
}

fn main() {
    let mut s = String::from("hello");
    append_world(&mut s);
    println!("{}", s);  // "hello, world!"
}
```

`mut` 키워드가 3곳에 필요하다:
1. `let mut s` — 변수 자체가 가변
2. `&mut s` — 가변 참조 생성
3. `s: &mut String` — 함수가 가변 참조를 받음

## 빌림 규칙

러스트 컴파일러가 **컴파일 타임에** 강제하는 규칙이다:

### 규칙 1: 가변 참조는 동시에 하나만

```rust
let mut s = String::from("hello");

let r1 = &mut s;
// let r2 = &mut s;  // 컴파일 에러! 가변 참조가 이미 있음

println!("{}", r1);
```

왜? 두 개의 가변 참조가 같은 데이터를 동시에 수정하면 **데이터 경쟁(data race)**이 발생한다. 러스트는 이걸 원천 차단한다.

### 규칙 2: 불변 참조와 가변 참조는 동시에 존재할 수 없다

```rust
let mut s = String::from("hello");

let r1 = &s;      // 불변 참조 OK
let r2 = &s;      // 불변 참조 또 OK
// let r3 = &mut s;  // 컴파일 에러! 불변 참조가 있는 동안 가변 참조 불가

println!("{}, {}", r1, r2);
```

누군가 읽고 있는데 다른 사람이 바꾸면 읽는 사람 입장에서 데이터가 갑자기 변한다. 이것도 차단.

### NLL (Non-Lexical Lifetimes)

참조의 수명은 마지막 사용 시점까지다. 스코프 끝이 아니다.

```rust
let mut s = String::from("hello");

let r1 = &s;
let r2 = &s;
println!("{}, {}", r1, r2);  // r1, r2의 마지막 사용

let r3 = &mut s;  // OK! r1, r2는 이미 안 쓰이니까
println!("{}", r3);
```

Rust 2018 이후 NLL 덕분에 빌림 규칙이 훨씬 유연해졌다.

## 댕글링 참조 방지

러스트는 댕글링 참조(이미 해제된 메모리를 가리키는 참조)를 컴파일 타임에 잡는다.

```rust
// 이건 안 된다
fn dangle() -> &String {
    let s = String::from("hello");
    &s  // s는 이 함수가 끝나면 해제됨
}       // s drop → &s는 댕글링 참조!
```

```
error[E0106]: missing lifetime specifier
```

컴파일러가 "참조가 가리키는 데이터가 먼저 사라진다"를 감지하고 막아준다.

해결: 소유권을 반환하면 된다.

```rust
fn no_dangle() -> String {
    let s = String::from("hello");
    s  // 소유권을 반환
}
```

## 슬라이스 - 컬렉션의 일부를 빌리기

슬라이스는 컬렉션의 연속된 부분에 대한 참조다.

### 문자열 슬라이스 (`&str`)

```rust
let s = String::from("hello world");

let hello = &s[0..5];    // "hello"
let world = &s[6..11];   // "world"

// 축약
let hello = &s[..5];     // 처음부터
let world = &s[6..];     // 끝까지
let whole = &s[..];      // 전체
```

문자열 리터럴도 슬라이스다:

```rust
let s: &str = "hello world";  // 바이너리에 저장된 문자열의 슬라이스
```

### 슬라이스의 안전성

```rust
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    for (i, &byte) in bytes.iter().enumerate() {
        if byte == b' ' {
            return &s[..i];
        }
    }
    &s[..]
}

fn main() {
    let mut s = String::from("hello world");
    let word = first_word(&s);

    // s.clear();  // 컴파일 에러! word가 s를 빌리고 있는 동안 수정 불가
    println!("{}", word);
}
```

슬라이스가 있는 동안 원본을 수정할 수 없다. 빌림 규칙이 그대로 적용된다.

### 배열 슬라이스

```rust
let arr = [1, 2, 3, 4, 5];
let slice = &arr[1..3];  // [2, 3]

fn sum(numbers: &[i32]) -> i32 {
    numbers.iter().sum()
}

println!("{}", sum(&arr));      // 배열 전체
println!("{}", sum(&arr[..3])); // 앞 3개만
```

## 참조 규칙 총정리

| 규칙 | 내용 |
|------|------|
| 불변 참조 (`&T`) | 여러 개 동시 가능 |
| 가변 참조 (`&mut T`) | 동시에 하나만 |
| 불변 + 가변 | 동시에 불가 |
| 참조 수명 | 원본보다 오래 살 수 없음 |
| NLL | 마지막 사용 시점까지만 수명 |

```rust
// 이것만 기억하면 된다:
// 여러 명이 읽거나 (&&&&), 한 명이 쓰거나 (&mut). 둘 다는 안 된다.
```

## 정리

- `&T` = 불변 참조 (읽기만, 여러 개 가능)
- `&mut T` = 가변 참조 (읽기+쓰기, 하나만)
- 빌림 규칙은 데이터 경쟁을 컴파일 타임에 방지한다
- 댕글링 참조는 컴파일러가 잡아준다
- 슬라이스 = 컬렉션 일부의 참조

다음 글에서는 참조의 유효 범위를 명시하는 **라이프타임**을 다룬다.
