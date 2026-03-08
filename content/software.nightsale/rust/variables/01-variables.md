---
title: "[Rust 변수 시리즈] 01. 변수와 바인딩"
author: anonymous.rs
date: 2025-12-22
tags: ["rust", "variables", "let", "mut", "const", "shadowing", "기초"]
---

# 변수와 바인딩

## 한 줄 요약

러스트의 변수는 기본적으로 **불변**이고, 값에 이름을 **바인딩(binding)**하는 개념이다.

## 다른 언어와 비교

- JavaScript의 `const`/`let`과 비슷하지만, 러스트는 기본이 불변이다
- C/C++의 변수 선언과 달리, 타입 추론이 강력하다
- Go의 `:=`처럼 `let`으로 선언과 동시에 바인딩한다

## `let` 바인딩

러스트에서 변수를 만드는 건 "값에 이름표를 붙이는 것"이다.

```rust
let x = 5;
let name = String::from("ferris");
```

### 기본은 불변

```rust
let x = 5;
// x = 6;  // 컴파일 에러! 불변 변수에 재할당 불가
```

"왜 기본이 불변인가?" — 컴파일러가 "이 값은 절대 안 바뀐다"를 보장해주면, 버그를 추적하기 훨씬 쉽다. 멀티스레드 환경에서는 특히 그렇다.

### `mut` - 가변 변수

값을 바꿔야 하면 `mut`를 명시한다.

```rust
let mut count = 0;
count += 1;
count += 1;
println!("{}", count);  // 2
```

`mut`는 "이 변수는 바뀔 수 있다"는 **의도를 명시**하는 것이다. 코드를 읽는 사람이 "아, 이건 나중에 바뀌는구나"를 바로 알 수 있다.

## 타입 추론과 명시

러스트 컴파일러는 대부분의 타입을 추론한다.

```rust
let x = 5;           // i32로 추론
let y = 3.14;        // f64로 추론
let name = "ferris"; // &str로 추론
let active = true;   // bool로 추론
```

명시적으로 타입을 지정할 수도 있다.

```rust
let x: i32 = 5;
let y: f64 = 3.14;
let z: u8 = 255;
```

타입을 명시해야 하는 경우:

```rust
// parse()는 여러 타입으로 변환 가능 → 컴파일러가 추론 불가
let guess: u32 = "42".parse().expect("숫자가 아님");

// turbofish 문법으로도 가능
let guess = "42".parse::<u32>().expect("숫자가 아님");
```

## 섀도잉 (Shadowing)

같은 이름으로 새 변수를 선언하면 이전 변수를 **가린다(shadow)**.

```rust
let x = 5;
let x = x + 1;      // 새로운 x = 6
let x = x * 2;      // 새로운 x = 12

println!("{}", x);   // 12
```

### 섀도잉 vs `mut`

```rust
// 섀도잉: 타입이 바뀔 수 있다
let spaces = "   ";          // &str
let spaces = spaces.len();   // usize — OK!

// mut: 타입이 바뀔 수 없다
let mut spaces = "   ";
// spaces = spaces.len();    // 컴파일 에러! &str에 usize 할당 불가
```

| 특징 | 섀도잉 (`let x = ...`) | 가변 변수 (`let mut x = ...`) |
|------|----------------------|----------------------------|
| 타입 변경 | 가능 | 불가능 |
| 실제 동작 | 새 변수 생성 | 같은 변수 수정 |
| 이전 값 | 접근 불가 (가려짐) | 덮어써짐 |
| 용도 | 타입 변환, 값 변환 | 상태 변경 |

### 섀도잉이 유용한 실전 패턴

```rust
// 입력값을 단계별로 변환할 때
let input = "  42  ";
let input = input.trim();        // &str → &str (공백 제거)
let input: u32 = input.parse().unwrap();  // &str → u32

// 의미는 같은데 타입만 달라지는 경우 이름을 유지할 수 있다
```

## 상수 (`const`)

컴파일 타임에 확정되는 값이다. `let`과 다르다.

```rust
const MAX_POINTS: u32 = 100_000;
const PI: f64 = 3.141592653589793;
const APP_NAME: &str = "rust-app";
```

### `const` vs `let` (불변)

| 특징 | `const` | `let` (불변) |
|------|---------|-------------|
| 타입 명시 | **필수** | 추론 가능 |
| 값 결정 시점 | 컴파일 타임 | 런타임 가능 |
| 섀도잉 | 불가 | 가능 |
| 스코프 | 전역 가능 | 블록 내 |
| 함수 호출 | 불가 (const fn만 가능) | 가능 |

```rust
const MAX: u32 = 100;                    // OK
const COMPUTED: u32 = 50 + 50;           // OK (컴파일 타임 연산)
// const RUNTIME: u32 = some_function(); // 에러! (일반 함수 호출 불가)

let runtime_value = some_function();     // OK
```

### `static` - 전역 변수

`const`와 비슷하지만, 메모리에 고정된 위치를 가진다.

```rust
static GREETING: &str = "Hello";
static mut COUNTER: u32 = 0;  // 가변 static은 unsafe 필요

fn main() {
    println!("{}", GREETING);

    // 가변 static 접근은 unsafe
    unsafe {
        COUNTER += 1;
        println!("{}", COUNTER);
    }
}
```

| 특징 | `const` | `static` |
|------|---------|----------|
| 메모리 | 사용 시 인라인됨 | 고정 주소에 하나만 존재 |
| 가변성 | 항상 불변 | `static mut` 가능 (unsafe) |
| 용도 | 매직 넘버 대체, 설정값 | 전역 상태, FFI |

대부분의 경우 `const`를 쓰면 된다. `static`은 FFI나 전역 상태가 꼭 필요할 때만 쓴다.

## 스코프와 블록 표현식

러스트에서 `{}`는 표현식이다. 블록의 마지막 값이 반환된다.

```rust
let y = {
    let x = 3;
    x + 1  // 세미콜론 없음 = 이 값이 블록의 결과
};

println!("{}", y);  // 4
```

변수는 선언된 블록 안에서만 유효하다.

```rust
{
    let inner = 42;
    println!("{}", inner);  // OK
}
// println!("{}", inner);  // 컴파일 에러! 스코프 밖
```

### 블록으로 임시 스코프 만들기

```rust
let config = {
    let raw = std::fs::read_to_string("config.toml").unwrap();
    let parsed = parse_config(&raw);
    validate(parsed)  // 최종 결과만 config에 바인딩
};
// raw, parsed는 여기서 접근 불가 — 깔끔하다
```

## 정리

- `let` = 불변 바인딩 (기본)
- `let mut` = 가변 바인딩 (명시적 의도)
- 섀도잉 = 같은 이름으로 새 변수 (타입 변경 가능)
- `const` = 컴파일 타임 상수 (타입 명시 필수)
- `static` = 전역 변수 (가변이면 unsafe)
- `{}` 블록은 표현식이다

다음 글에서는 `let` 바인딩의 진짜 힘인 **패턴 매칭과 구조분해**를 다룰 예정이다.
