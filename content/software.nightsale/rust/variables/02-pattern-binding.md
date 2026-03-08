---
title: "[Rust 변수 시리즈] 02. 패턴 바인딩과 구조분해"
author: anonymous.rs
date: 2025-12-23
tags: ["rust", "pattern", "destructuring", "if-let", "let-else", "match"]
---

# 패턴 바인딩과 구조분해

## 한 줄 요약

러스트의 `let`은 단순한 변수 선언이 아니라 **패턴 매칭**이다.

## `let`은 패턴이다

```rust
let x = 5;
```

이건 사실 "5를 `x`라는 패턴에 매칭시켜라"라는 뜻이다. 단순한 변수명도 패턴의 일종이다. 이 사실을 알면 `let`으로 할 수 있는 일이 훨씬 많아진다.

## 1. 튜플 구조분해

```rust
let (x, y, z) = (1, 2, 3);
println!("x={}, y={}, z={}", x, y, z);

// 일부만 필요할 때
let (first, _, third) = (10, 20, 30);
println!("first={}, third={}", first, third);  // 20은 무시
```

`_`는 "이 값은 신경 안 쓴다"는 와일드카드 패턴이다.

### 함수 반환값 분해

```rust
fn min_max(list: &[i32]) -> (i32, i32) {
    let mut min = list[0];
    let mut max = list[0];
    for &val in &list[1..] {
        if val < min { min = val; }
        if val > max { max = val; }
    }
    (min, max)
}

let (min, max) = min_max(&[3, 1, 4, 1, 5, 9]);
println!("최솟값: {}, 최댓값: {}", min, max);
```

## 2. 구조체 구조분해

```rust
struct Point {
    x: i32,
    y: i32,
}

let p = Point { x: 10, y: 20 };

// 필드 이름과 같은 변수로 분해
let Point { x, y } = p;
println!("x={}, y={}", x, y);

// 다른 이름으로 받기
let Point { x: px, y: py } = p;
println!("px={}, py={}", px, py);

// 일부만 꺼내기
let Point { x, .. } = p;
println!("x만: {}", x);
```

## 3. 열거형과 `match`

러스트 제어 흐름의 핵심이다.

```rust
enum Coin {
    Penny,
    Nickel,
    Dime,
    Quarter,
}

fn value(coin: Coin) -> u32 {
    match coin {
        Coin::Penny => 1,
        Coin::Nickel => 5,
        Coin::Dime => 10,
        Coin::Quarter => 25,
    }
}
```

`match`는 **모든 경우를 다뤄야 한다(exhaustive)**. 하나라도 빠뜨리면 컴파일 에러다.

### 값을 꺼내는 패턴

```rust
enum Message {
    Quit,
    Echo(String),
    Move { x: i32, y: i32 },
    Color(u8, u8, u8),
}

fn process(msg: Message) {
    match msg {
        Message::Quit => println!("종료"),
        Message::Echo(text) => println!("에코: {}", text),
        Message::Move { x, y } => println!("이동: ({}, {})", x, y),
        Message::Color(r, g, b) => println!("색상: #{:02x}{:02x}{:02x}", r, g, b),
    }
}
```

### `_`와 `..` 패턴

```rust
let value = 42;

match value {
    1 => println!("하나"),
    2 | 3 => println!("둘 또는 셋"),        // OR 패턴
    4..=10 => println!("4에서 10 사이"),     // 범위 패턴
    _ => println!("그 외"),                  // 나머지 전부
}
```

## 4. `if let` - 한 가지 패턴만 관심 있을 때

`match`로 모든 경우를 다루는 게 번거로울 때, 딱 하나의 패턴만 확인하고 싶다면 `if let`을 쓴다.

```rust
let some_value: Option<i32> = Some(42);

// match로 쓰면
match some_value {
    Some(val) => println!("값: {}", val),
    None => {},  // 아무것도 안 함 — 귀찮다
}

// if let으로 쓰면
if let Some(val) = some_value {
    println!("값: {}", val);
}
```

### `if let`과 `else`

```rust
let config: Option<String> = None;

if let Some(cfg) = config {
    println!("설정: {}", cfg);
} else {
    println!("기본 설정 사용");
}
```

### 열거형과 `if let`

```rust
enum Command {
    Run(String),
    Stop,
    Pause(u32),
}

let cmd = Command::Pause(5);

if let Command::Pause(seconds) = cmd {
    println!("{}초 동안 일시정지", seconds);
}
```

## 5. `let-else` - 매칭 실패 시 빠져나가기

Rust 1.65에 추가된 문법이다. 패턴이 매칭되지 않으면 `else` 블록에서 **반드시 분기를 벗어나야** 한다 (`return`, `break`, `continue`, `panic!`).

```rust
fn get_username(id: u32) -> Option<String> {
    if id == 1 { Some("ferris".into()) } else { None }
}

fn greet(id: u32) {
    let Some(name) = get_username(id) else {
        println!("유저를 찾을 수 없음");
        return;
    };

    // 여기서부터 name은 확실히 String
    println!("안녕, {}!", name);
}
```

### `if let` vs `let-else`

```rust
// if let: "값이 있으면 이걸 해라"
if let Some(val) = maybe_value {
    // val 사용 (이 블록 안에서만)
}

// let-else: "값이 없으면 빠져나가라"
let Some(val) = maybe_value else {
    return;  // 또는 break, continue, panic!
};
// val 사용 (이후 코드 전체에서)
```

`let-else`는 **얼리 리턴 패턴**과 궁합이 좋다. 들여쓰기 지옥(pyramid of doom)을 방지한다.

```rust
// let-else 없이 (들여쓰기 지옥)
fn process(input: &str) -> Result<(), String> {
    if let Ok(parsed) = input.parse::<u32>() {
        if let Some(validated) = validate(parsed) {
            if let Ok(result) = execute(validated) {
                println!("{}", result);
                return Ok(());
            }
        }
    }
    Err("실패".into())
}

// let-else로 평탄하게
fn process(input: &str) -> Result<(), String> {
    let Ok(parsed) = input.parse::<u32>() else {
        return Err("파싱 실패".into());
    };
    let Some(validated) = validate(parsed) else {
        return Err("검증 실패".into());
    };
    let Ok(result) = execute(validated) else {
        return Err("실행 실패".into());
    };

    println!("{}", result);
    Ok(())
}
```

## 6. 가드 (Match Guard)

패턴에 추가 조건을 걸 수 있다.

```rust
let num = Some(4);

match num {
    Some(x) if x < 5 => println!("5 미만: {}", x),
    Some(x) => println!("5 이상: {}", x),
    None => println!("없음"),
}
```

```rust
struct Request {
    method: String,
    path: String,
    auth: bool,
}

fn route(req: Request) {
    match req {
        Request { ref method, ref path, .. } if method == "GET" && path == "/" => {
            println!("홈페이지");
        }
        Request { auth: false, .. } => {
            println!("인증 필요");
        }
        Request { ref method, ref path, .. } => {
            println!("{} {}", method, path);
        }
    }
}
```

## 7. `@` 바인딩

패턴 매칭과 동시에 값을 변수에 바인딩한다.

```rust
match age {
    n @ 0..=12 => println!("어린이 ({}세)", n),
    n @ 13..=19 => println!("청소년 ({}세)", n),
    n @ 20..=64 => println!("성인 ({}세)", n),
    n => println!("시니어 ({}세)", n),
}
```

범위 패턴으로 분기하면서, 실제 값도 `n`에 바인딩해서 사용할 수 있다.

```rust
enum Version {
    V1,
    V2,
    V3(String),
}

match version {
    v @ Version::V1 | v @ Version::V2 => {
        println!("구버전: {:?}", v);
    }
    Version::V3(ref detail) => {
        println!("V3: {}", detail);
    }
}
```

## 정리

| 문법 | 용도 |
|------|------|
| `let (a, b) = ...` | 튜플 구조분해 |
| `let Struct { x, .. } = ...` | 구조체 구조분해 |
| `match` | 모든 경우를 빠짐없이 처리 |
| `if let` | 한 가지 패턴만 관심 있을 때 |
| `let ... else` | 매칭 실패 시 얼리 리턴 |
| `if` 가드 | 패턴에 추가 조건 |
| `@` 바인딩 | 패턴 매칭 + 값 캡처 |

러스트의 패턴 매칭은 단순한 `switch-case`가 아니다. 변수 선언, 구조분해, 조건 분기가 하나의 문법으로 통합된 강력한 시스템이다.
