---
title: "[Rust 소유권 시리즈] 01. 소유권이란 무엇인가"
author: anonymous.rs
date: 2025-12-22
tags: ["rust", "ownership", "move", "copy", "drop", "기초"]
---

# 소유권(Ownership)이란 무엇인가

## 한 줄 요약

소유권은 **"모든 값에는 단 하나의 주인이 있고, 주인이 사라지면 값도 사라진다"**는 규칙이다.

## 왜 소유권이 필요한가

다른 언어들의 메모리 관리 방식:

| 언어 | 방식 | 문제점 |
|------|------|--------|
| C/C++ | 수동 관리 (`malloc`/`free`) | 해제 안 하면 메모리 누수, 두 번 해제하면 크래시 |
| Java/Go/Python | 가비지 컬렉터 (GC) | 런타임 오버헤드, GC 멈춤(pause) |
| Rust | 소유권 시스템 | **컴파일 타임에 해결. 런타임 비용 0** |

러스트는 GC 없이, 수동 해제 없이, 컴파일러가 메모리를 관리한다.

## 소유권의 3가지 규칙

1. **모든 값에는 소유자(owner)가 있다**
2. **소유자는 한 번에 하나만 존재한다**
3. **소유자가 스코프를 벗어나면 값은 자동으로 해제(drop)된다**

```rust
{
    let s = String::from("hello");  // s가 "hello"의 소유자
    println!("{}", s);
}   // s가 스코프를 벗어남 → "hello" 메모리 자동 해제
```

## 이동 (Move)

값을 다른 변수에 할당하면 소유권이 **이동**한다.

```rust
let s1 = String::from("hello");
let s2 = s1;  // 소유권이 s1 → s2로 이동

// println!("{}", s1);  // 컴파일 에러! s1은 이미 주인이 아님
println!("{}", s2);     // OK
```

### 왜 복사가 아니라 이동인가

`String`의 구조를 보면:

```
스택               힙
s1: [ptr][len][cap] → "hello"
```

`let s2 = s1;` 하면:

```
스택               힙
s1: (무효화됨)
s2: [ptr][len][cap] → "hello"
```

만약 s1과 s2가 같은 힙 데이터를 가리키면, 둘 다 스코프를 벗어날 때 **같은 메모리를 두 번 해제**하게 된다(double free). 러스트는 이동으로 이 문제를 원천 차단한다.

### 함수에 값 전달 = 이동

```rust
fn take_ownership(s: String) {
    println!("{}", s);
}   // s가 drop됨

fn main() {
    let greeting = String::from("hello");
    take_ownership(greeting);  // 소유권 이동

    // println!("{}", greeting);  // 컴파일 에러! 이미 이동됨
}
```

### 함수에서 값 반환 = 소유권 돌려주기

```rust
fn give_back(s: String) -> String {
    s  // 소유권을 호출자에게 반환
}

fn main() {
    let s1 = String::from("hello");
    let s2 = give_back(s1);  // s1 → 함수 → s2
    println!("{}", s2);       // OK
}
```

매번 소유권을 주고받는 건 불편하다. 이 문제를 해결하는 게 다음 글에서 다룰 **빌림(borrowing)**이다.

## 복사 (Copy)

스택에만 존재하는 단순한 타입은 이동이 아니라 **복사**된다.

```rust
let x = 5;
let y = x;  // 복사. x도 여전히 유효

println!("x={}, y={}", x, y);  // 둘 다 OK
```

`Copy` 트레이트를 구현한 타입은 이동 대신 복사가 일어난다.

### `Copy` 가능한 타입들

| 타입 | Copy 여부 |
|------|----------|
| `i32`, `u64`, `f64` 등 정수/실수 | O |
| `bool` | O |
| `char` | O |
| `(i32, bool)` 등 Copy 타입만으로 된 튜플 | O |
| `String` | X (힙 데이터 소유) |
| `Vec<T>` | X (힙 데이터 소유) |
| `&T` (참조) | O |

규칙: **힙에 데이터를 소유하는 타입은 Copy가 아니다.**

## `Clone` - 명시적 복제

`Copy`가 안 되는 타입을 복제하려면 `.clone()`을 명시적으로 호출한다.

```rust
let s1 = String::from("hello");
let s2 = s1.clone();  // 힙 데이터까지 깊은 복사

println!("s1={}, s2={}", s1, s2);  // 둘 다 OK
```

`clone()`은 힙 메모리를 새로 할당하는 **비싼 연산**이다. 꼭 필요할 때만 쓴다.

### `Copy` vs `Clone` 정리

| 특징 | `Copy` | `Clone` |
|------|--------|---------|
| 동작 | 암묵적 (자동) | 명시적 (`.clone()`) |
| 비용 | 매우 저렴 (비트 복사) | 비쌀 수 있음 (힙 할당) |
| 대상 | 스택 데이터만 | 모든 데이터 |
| 관계 | `Copy`이면 반드시 `Clone` | `Clone`이라고 `Copy`는 아님 |

## `Drop` - 소유자가 사라질 때

소유자가 스코프를 벗어나면 `Drop` 트레이트의 `drop()` 메서드가 자동 호출된다.

```rust
struct DatabaseConn {
    name: String,
}

impl Drop for DatabaseConn {
    fn drop(&mut self) {
        println!("DB 연결 해제: {}", self.name);
    }
}

fn main() {
    let conn1 = DatabaseConn { name: "primary".into() };
    let conn2 = DatabaseConn { name: "replica".into() };
    println!("연결 생성 완료");
}
// 출력:
// 연결 생성 완료
// DB 연결 해제: replica   ← conn2가 먼저 (스택: 후입선출)
// DB 연결 해제: primary
```

Drop 순서는 **선언의 역순**이다. 스택의 LIFO(후입선출)와 같다.

### 조기 해제 - `drop()`

스코프 끝까지 기다리지 않고 바로 해제하고 싶을 때:

```rust
let conn = DatabaseConn { name: "temp".into() };
// 더 이상 필요 없다
drop(conn);  // 여기서 바로 해제
// println!("{}", conn.name);  // 컴파일 에러! 이미 drop됨
```

`conn.drop()`은 직접 호출할 수 없다. `std::mem::drop()` 함수를 사용한다.

## 소유권이 이동하는 상황 정리

```rust
let s = String::from("hello");

// 1. 변수 할당
let s2 = s;

// 2. 함수 인자
fn foo(s: String) {}
foo(s);

// 3. 함수 반환
fn bar() -> String { String::from("hi") }

// 4. 구조체 필드
struct Wrapper { data: String }
let w = Wrapper { data: s };

// 5. 벡터에 push
let mut v = Vec::new();
v.push(s);
```

모두 소유권 이동이 발생한다. 이동 후 원래 변수는 사용할 수 없다.

## 정리

- 모든 값에는 딱 하나의 소유자가 있다
- 할당, 함수 전달 시 소유권이 이동한다 (Move)
- 스택 데이터는 복사된다 (Copy)
- 힙 데이터는 명시적으로 `.clone()` 해야 복제된다
- 소유자가 스코프를 벗어나면 자동 해제된다 (Drop)

소유권은 러스트의 가장 핵심적인 개념이다. 다음 글에서는 소유권을 이전하지 않고 값을 빌려쓰는 **참조와 빌림(Borrowing)**을 다룬다.
