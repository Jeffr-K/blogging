---
title: "[Rust 클로저 시리즈] 02. 캡처 메커니즘과 Fn 트레이트"
author: anonymous.rs
date: 2025-12-23
tags: ["rust", "closure", "Fn", "FnMut", "FnOnce", "capture", "move", "소유권"]
---

# 캡처 메커니즘과 Fn 트레이트

## 한 줄 요약

러스트 클로저는 캡처하는 방식에 따라 **`Fn`, `FnMut`, `FnOnce`** 중 하나(이상)의 트레이트를 자동으로 구현한다.

## 캡처의 3가지 방식

클로저가 외부 변수를 캡처할 때, 컴파일러는 **가장 제한적인(가장 저비용의) 방식**을 자동으로 선택한다.

### 1. 불변 참조 캡처 (`&T`)

캡처한 값을 읽기만 할 때.

```rust
let name = String::from("ferris");

let greet = || println!("hello, {}", name);  // name을 &String으로 캡처

greet();
greet();  // 여러 번 호출 가능
println!("{}", name);  // name 여전히 유효
```

### 2. 가변 참조 캡처 (`&mut T`)

캡처한 값을 수정할 때.

```rust
let mut count = 0;

let mut increment = || {
    count += 1;  // count를 &mut i32로 캡처
    println!("count: {}", count);
};

increment();  // count: 1
increment();  // count: 2
// println!("{}", count);  // 에러! 클로저가 가변 빌림 중
drop(increment);           // 클로저 drop → 빌림 해제
println!("{}", count);     // OK, count: 2
```

클로저 자체도 `mut`로 선언해야 한다. 호출할 때마다 내부 상태가 바뀌니까.

### 3. 소유권 이동 캡처 (move)

캡처한 값의 소유권을 클로저 안으로 가져올 때.

```rust
let name = String::from("ferris");

let greet = || {
    let _owned = name;  // name의 소유권을 사용
    println!("consumed");
};

greet();
// greet();  // 컴파일 에러! name이 이미 이동됨 → 한 번만 호출 가능
```

## 컴파일러의 캡처 결정 로직

컴파일러는 클로저 본문에서 캡처한 변수를 **어떻게 사용하는지** 보고 결정한다.

```
읽기만 한다    → &T     (불변 참조)
수정한다       → &mut T (가변 참조)
소유권을 쓴다  → T      (이동)
```

```rust
let s = String::from("hello");

let c1 = || println!("{}", s);          // &s — 읽기만
let c2 = || { let _ = s.len(); };       // &s — 메서드 호출 (읽기)

let mut v = vec![1, 2, 3];
let c3 = || v.push(4);                  // &mut v — 수정

let s2 = String::from("world");
let c4 = || { drop(s2); };              // s2 이동 — 소유권 소비
```

## `move` 키워드

캡처 방식을 **강제로 소유권 이동**으로 바꾼다.

```rust
let name = String::from("ferris");

// move 없이: &String으로 캡처
let greet = || println!("{}", name);

// move: String을 클로저 안으로 이동
let greet = move || println!("{}", name);
// println!("{}", name);  // 에러! name은 클로저가 소유
```

### `move`가 필수인 상황: 스레드

```rust
use std::thread;

let name = String::from("ferris");

// 스레드는 언제 끝날지 모름 → 참조가 댕글링될 수 있음
// let handle = thread::spawn(|| println!("{}", name));  // 에러!

// move로 소유권을 스레드에 넘겨야 안전
let handle = thread::spawn(move || {
    println!("스레드: {}", name);
});

handle.join().unwrap();
```

스레드는 생성한 스코프보다 오래 살 수 있으므로, 참조 캡처는 안전하지 않다.

### `move` + Copy 타입

`Copy` 타입은 `move`해도 복사된다.

```rust
let x = 42;  // i32는 Copy

let add = move || x + 1;  // x가 "복사"되어 클로저 안으로 들어감

println!("{}", x);     // OK! x는 여전히 유효
println!("{}", add()); // 43
```

`move`는 "소유권을 이동하라"가 아니라 "값으로 캡처하라"가 정확한 의미다. Copy 타입은 값으로 캡처 = 복사다.

## Fn 트레이트 3형제

캡처 방식에 따라 클로저가 구현하는 트레이트가 결정된다.

### `FnOnce` - 한 번만 호출 가능

```rust
trait FnOnce<Args> {
    type Output;
    fn call_once(self, args: Args) -> Self::Output;
    //           ^^^^ self를 소비
}
```

캡처한 값의 소유권을 사용하는 클로저. 호출하면 자기 자신이 소비되므로 한 번만 호출 가능.

```rust
let name = String::from("ferris");

let consume = move || {
    drop(name);  // 소유권을 소비
};

consume();
// consume();  // 에러! 이미 소비됨
```

### `FnMut` - 여러 번 호출 가능, 내부 상태 변경

```rust
trait FnMut<Args>: FnOnce<Args> {
    fn call_mut(&mut self, args: Args) -> Self::Output;
    //          ^^^^^^^^^ &mut self
}
```

캡처한 값을 수정하는 클로저. 여러 번 호출 가능하지만 호출 시 가변 접근이 필요.

```rust
let mut count = 0;

let mut counter = || {
    count += 1;
    count
};

println!("{}", counter());  // 1
println!("{}", counter());  // 2
```

### `Fn` - 여러 번 호출 가능, 상태 변경 없음

```rust
trait Fn<Args>: FnMut<Args> {
    fn call(&self, args: Args) -> Self::Output;
    //      ^^^^^ &self — 불변 참조로 충분
}
```

캡처한 값을 읽기만 하는 클로저. 가장 유연하다.

```rust
let name = String::from("ferris");

let greet = || println!("hello, {}", name);

greet();
greet();
greet();  // 몇 번이든 OK
```

## 트레이트 계층 구조

```
FnOnce   ← 모든 클로저가 구현 (최소 한 번은 호출 가능)
  ↑
FnMut    ← 소유권을 소비하지 않는 클로저가 구현
  ↑
Fn       ← 캡처한 값을 수정하지 않는 클로저가 구현
```

`Fn`은 `FnMut`의 서브트레이트이고, `FnMut`은 `FnOnce`의 서브트레이트다.

```
Fn ⊂ FnMut ⊂ FnOnce

Fn을 구현하면 FnMut, FnOnce도 자동으로 구현
FnMut을 구현하면 FnOnce도 자동으로 구현
```

### 함수 매개변수에서의 선택

```rust
// Fn: 가장 제한적인 요구 → 가장 많은 클로저를 받을 수 있음...은 아니다!
// 정확히는 반대다:

// FnOnce: 모든 클로저를 받을 수 있음 (가장 관대)
fn call_once<F: FnOnce()>(f: F) { f(); }

// FnMut: FnMut + Fn 클로저를 받을 수 있음
fn call_mut<F: FnMut()>(mut f: F) { f(); }

// Fn: Fn 클로저만 받을 수 있음 (가장 엄격)
fn call_fn<F: Fn()>(f: F) { f(); }
```

**호출자 관점**: `FnOnce`가 가장 관대하게 받는다.
**구현자 관점**: `Fn`이 가장 유연하게 쓸 수 있다 (여러 번, 동시에 호출 가능).

### 어떤 바운드를 쓸까

```
콜백을 한 번만 호출한다         → FnOnce
콜백을 여러 번 호출할 수 있다    → FnMut
콜백을 동시에 여러 곳에서 호출   → Fn
확실하지 않다                   → FnOnce로 시작하고, 필요에 따라 FnMut/Fn으로 강화
```

## 실전 예시: 표준 라이브러리의 Fn 트레이트 사용

```rust
// Option::map — FnOnce (한 번만 호출)
let x: Option<String> = Some("hello".into());
let y = x.map(|s| s.len());  // FnOnce<(String,)> -> usize

// Vec::sort_by — FnMut (여러 번 호출, 비교할 때마다)
let mut v = vec![3, 1, 2];
v.sort_by(|a, b| a.cmp(b));  // FnMut<(&i32, &i32)> -> Ordering

// Iterator::filter — FnMut (각 요소마다 호출)
let evens: Vec<_> = (0..10).filter(|&x| x % 2 == 0).collect();

// thread::spawn — FnOnce + Send + 'static
use std::thread;
thread::spawn(move || {
    println!("스레드");
});
```

## 캡처 방식 판별 연습

```rust
let s = String::from("hello");
let v = vec![1, 2, 3];
let mut count = 0;

// 이 클로저는 무엇을 구현할까?
let c1 = || println!("{}", s);             // Fn (읽기만)
let c2 = || s;                             // FnOnce (소유권 이동)
let c3 = || { count += 1; };              // FnMut (수정)
let c4 = move || println!("{}", s);        // Fn (move지만 읽기만)
let c5 = || drop(v);                       // FnOnce (소유권 소비)
let c6 = || { let _ = &s; };             // Fn (참조만)
```

`move`는 캡처 방식(값 vs 참조)을 결정하는 거지, Fn 트레이트 종류를 결정하는 게 아니다. `move || println!("{}", s)`는 `s`를 값으로 캡처하지만, 본문에서 읽기만 하므로 `Fn`이다.

## 정리

| 트레이트 | self | 호출 횟수 | 캡처 사용 |
|---------|------|----------|----------|
| `FnOnce` | `self` | 1번 | 소유권 소비 가능 |
| `FnMut` | `&mut self` | 여러 번 | 가변 참조까지 |
| `Fn` | `&self` | 여러 번 + 동시 | 불변 참조만 |

- 컴파일러가 캡처 방식을 자동 결정한다 (& → &mut → move)
- `move` 키워드는 값 캡처를 강제한다 (스레드에서 필수)
- `Fn ⊂ FnMut ⊂ FnOnce` 계층 구조를 이해하면 API 설계가 명확해진다

다음 글에서는 **FP(함수형 프로그래밍)에서 클로저가 왜 핵심인지**, 그리고 표준 라이브러리 API에서 클로저가 어떻게 활용되는지를 다룬다.
