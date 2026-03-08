---
title: "[Rust 클로저 시리즈] 01. 클로저란 무엇인가"
author: anonymous.rs
date: 2025-12-22
tags: ["rust", "closure", "lambda", "역사", "기초"]
---

# 클로저(Closure)란 무엇인가

## 한 줄 요약

클로저는 **주변 환경의 변수를 캡처할 수 있는 익명 함수**다.

## 클로저의 탄생 — 왜 나오게 되었는가

클로저의 역사는 1960년대로 거슬러 올라간다.

### 함수만으로는 부족했다

```
1. 함수는 자신의 매개변수와 지역 변수만 접근할 수 있다
2. "함수가 정의된 시점의 환경"을 기억하고 싶다
3. 함수를 값처럼 넘기고 싶다
```

1964년, Peter Landin이 SECD 머신에서 "함수 + 그 함수가 정의된 환경"을 하나로 묶는 개념을 제안했다. 이게 **클로저(closure)**다. "환경을 닫아서(close over) 가두어 둔다"는 뜻이다.

### 예시로 이해하기

```rust
fn make_adder(x: i32) -> impl Fn(i32) -> i32 {
    move |y| x + y  // x를 "닫아서" 기억한다
}

fn main() {
    let add5 = make_adder(5);
    let add10 = make_adder(10);

    println!("{}", add5(3));   // 8
    println!("{}", add10(3));  // 13
}
```

`make_adder(5)`가 반환한 클로저는 `x = 5`라는 환경을 기억하고 있다. `make_adder` 함수가 끝난 뒤에도 `x`에 접근할 수 있다. 이것이 일반 함수와의 결정적 차이다.

## 다른 언어의 클로저와 비교

### JavaScript

```javascript
function makeAdder(x) {
    return (y) => x + y;  // x를 캡처
}
const add5 = makeAdder(5);
add5(3);  // 8
```

GC가 `x`의 메모리를 관리한다. 클로저가 `x`를 참조하는 한 해제되지 않는다. 개발자는 메모리를 신경 쓸 필요가 없지만, GC 오버헤드가 있다.

### Python

```python
def make_adder(x):
    return lambda y: x + y

add5 = make_adder(5)
add5(3)  # 8
```

Python도 GC 기반이다. 주의할 점은 Python의 클로저는 **변수를 값이 아닌 이름으로 캡처**한다는 것이다.

```python
funcs = [lambda: i for i in range(3)]
[f() for f in funcs]  # [2, 2, 2] — 전부 마지막 i를 참조!
```

### C++

```cpp
auto make_adder(int x) {
    return [x](int y) { return x + y; };  // [x]: 값으로 캡처
}
// [&x]: 참조로 캡처 — 댕글링 위험!
```

C++은 캡처 방식을 `[]` 안에 명시한다. 참조 캡처 시 원본이 사라지면 정의되지 않은 동작(UB)이다. 프로그래머가 안전을 책임져야 한다.

### Rust

```rust
let x = 5;
let add = |y| x + y;  // x를 자동으로 캡처
add(3);  // 8
```

러스트의 클로저는:
- **GC 없이** 메모리를 안전하게 관리한다
- 캡처 방식을 **컴파일러가 자동으로 결정**한다 (참조, 가변 참조, 소유권 이동)
- 참조 캡처의 안전성을 **빌림 검사기(borrow checker)가 보장**한다
- 캡처하는 값에 따라 **각 클로저마다 고유한 익명 타입**이 생긴다

| 언어 | 캡처 방식 | 메모리 관리 | 안전성 |
|------|----------|-----------|--------|
| JavaScript | 항상 참조 | GC | GC가 보장 |
| Python | 이름으로 참조 | GC | GC가 보장 |
| C++ | `[=]`값 / `[&]`참조 (수동 지정) | 수동 | 프로그래머 책임 |
| Rust | 자동 결정 (& / &mut / move) | 소유권 시스템 | 컴파일러가 보장 |

## 기본 문법

### 클로저 선언

```rust
// 매개변수와 반환 타입
let add = |a: i32, b: i32| -> i32 { a + b };

// 타입 추론 (대부분 생략 가능)
let add = |a, b| a + b;

// 매개변수 없음
let greet = || println!("hello");

// 여러 줄
let process = |x: i32| {
    let doubled = x * 2;
    let result = doubled + 1;
    result
};
```

### 함수 vs 클로저

```rust
// 함수: 환경을 캡처할 수 없다
fn add_five(x: i32) -> i32 {
    // let offset = ???;  // 외부 변수에 접근 불가
    x + 5
}

// 클로저: 환경을 캡처할 수 있다
let offset = 5;
let add_offset = |x| x + offset;  // offset을 캡처
```

| 특성 | 함수 (`fn`) | 클로저 (`\|...\| ...`) |
|------|-----------|---------------------|
| 환경 캡처 | 불가 | 가능 |
| 타입 | `fn(T) -> U` (함수 포인터) | 각 클로저마다 고유한 익명 타입 |
| 타입 추론 | 매개변수/반환 타입 명시 필수 | 대부분 생략 가능 |
| `fn` 포인터로 변환 | 자동 | 캡처하지 않는 클로저만 가능 |

### 클로저는 호출할 수 있다

```rust
let double = |x| x * 2;

// 직접 호출
let result = double(5);  // 10

// 즉시 호출 (IIFE 패턴)
let result = (|x| x * 2)(5);  // 10
```

### 타입 추론의 제약

클로저의 타입은 **최초 사용 시 고정**된다.

```rust
let identity = |x| x;

let s = identity("hello");  // &str로 추론됨
// let n = identity(42);    // 컴파일 에러! 이미 &str로 고정됨
```

함수는 제네릭으로 만들 수 있지만, 클로저는 직접적으로는 제네릭이 될 수 없다. 이건 뒤에서 다룬다.

## 클로저를 함수 인자로 넘기기

클로저의 가장 흔한 용도다.

```rust
fn apply<F: Fn(i32) -> i32>(f: F, value: i32) -> i32 {
    f(value)
}

fn main() {
    let double = |x| x * 2;
    let result = apply(double, 5);  // 10

    // 인라인으로 바로 넘기기
    let result = apply(|x| x + 1, 5);  // 6
}
```

`F: Fn(i32) -> i32`는 "i32를 받아 i32를 반환하는 호출 가능한 것"이라는 트레이트 바운드다. `Fn`, `FnMut`, `FnOnce`의 차이는 다음 글에서 깊이 다룬다.

## 클로저는 왜 익명 타입인가

```rust
let a = |x: i32| x + 1;
let b = |x: i32| x + 1;
// a와 b는 같은 코드지만 서로 다른 타입이다!
```

컴파일러는 각 클로저에 대해 고유한 구조체를 생성한다.

```rust
// 컴파일러가 내부적으로 만드는 것 (개념적 예시)
// let offset = 5;
// let add = |x| x + offset;

struct __Closure_add {
    offset: &i32,  // 캡처한 변수
}

impl Fn(i32) -> i32 for __Closure_add {
    fn call(&self, x: i32) -> i32 {
        x + *self.offset
    }
}
```

이 익명 구조체 덕분에:
- 캡처한 변수의 크기를 컴파일 타임에 알 수 있다
- 힙 할당 없이 스택에 저장된다
- 인라이닝 최적화가 가능하다 (제로 코스트 추상화)

## 정리

- 클로저 = 환경을 캡처하는 익명 함수
- 1960년대 람다 계산법에서 유래, 현대 언어 대부분이 지원
- 러스트 클로저는 GC 없이 소유권 시스템으로 안전성 보장
- 각 클로저마다 고유한 익명 타입이 생성됨 (제로 코스트)
- 캡처 방식은 컴파일러가 자동 결정

다음 글에서는 클로저의 핵심인 **캡처 메커니즘과 Fn/FnMut/FnOnce 트레이트**를 다룬다.
