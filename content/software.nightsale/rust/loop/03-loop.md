---
title: "[Rust 반복문 시리즈] 03. 고급 제어 흐름"
author: anonymous.rs
date: 2026-01-08
tags: ["rust", "while-let", "loop-label", "control-flow", "고급"]
---

# 고급 제어 흐름

01에서 `loop`/`while`/`for` 기본을 다뤘고, 02에서 이터레이터를 다뤘다. 이번 글에서는 `while let`, 루프 라벨, 그리고 러스트만의 독특한 제어 흐름 패턴들을 정리한다.

## 1. `while let` - 패턴이 매칭되는 동안 반복

`if let`의 반복문 버전이다. 패턴이 매칭되는 동안 계속 루프를 돈다.

```rust
let mut stack = vec![1, 2, 3, 4, 5];

// pop()이 Some을 반환하는 동안 반복
while let Some(top) = stack.pop() {
    println!("{}", top);
}
// 출력: 5, 4, 3, 2, 1
```

### `while let` vs `while` + `match`

```rust
// while let 없이
loop {
    match stack.pop() {
        Some(top) => println!("{}", top),
        None => break,
    }
}

// while let으로 깔끔하게
while let Some(top) = stack.pop() {
    println!("{}", top);
}
```

### 채널에서 메시지 받기 (실전)

```rust
use std::sync::mpsc;
use std::thread;

let (tx, rx) = mpsc::channel();

thread::spawn(move || {
    for msg in ["hello", "world", "done"] {
        tx.send(msg).unwrap();
    }
});

// 채널이 열려 있는 동안 메시지를 계속 받는다
while let Ok(msg) = rx.recv() {
    println!("수신: {}", msg);
}
```

### 이터레이터의 `.next()`와 함께

```rust
let mut iter = [10, 20, 30].iter();

while let Some(val) = iter.next() {
    println!("{}", val);
}
```

사실 이건 `for val in iter`와 같다. 하지만 `while let`은 이터레이터 외의 패턴에도 쓸 수 있어서 더 범용적이다.

## 2. 루프 라벨 (Loop Label)

중첩된 루프에서 **바깥 루프를 제어**할 때 쓴다.

```rust
'outer: for i in 0..5 {
    for j in 0..5 {
        if i + j == 6 {
            println!("탈출: i={}, j={}", i, j);
            break 'outer;  // 바깥 루프를 탈출
        }
    }
}
```

`break`와 `continue`는 기본적으로 가장 안쪽 루프에만 적용된다. 라벨을 붙이면 어떤 루프를 대상으로 할지 명시할 수 있다.

### `continue`에도 라벨

```rust
'outer: for i in 0..3 {
    for j in 0..3 {
        if j == 1 {
            continue 'outer;  // 안쪽 루프가 아닌 바깥 루프의 다음 반복으로
        }
        println!("i={}, j={}", i, j);
    }
}
// 출력:
// i=0, j=0
// i=1, j=0
// i=2, j=0
```

### 라벨 + `loop`에서 값 반환

```rust
let result = 'search: loop {
    for row in 0..10 {
        for col in 0..10 {
            if row * col == 42 {
                break 'search (row, col);  // 라벨 루프에서 값 반환
            }
        }
    }
    break 'search (0, 0);  // 찾지 못한 경우
};

println!("찾은 위치: {:?}", result);
```

## 3. `loop` + `match` 패턴 (상태 머신)

`loop` 안에서 `match`를 쓰면 상태 머신을 깔끔하게 표현할 수 있다.

```rust
enum State {
    Init,
    Running(u32),
    Paused,
    Done,
}

let mut state = State::Init;

loop {
    state = match state {
        State::Init => {
            println!("초기화...");
            State::Running(0)
        }
        State::Running(n) if n >= 5 => {
            println!("완료 조건 도달");
            State::Done
        }
        State::Running(n) => {
            println!("실행 중: {}", n);
            if n == 3 {
                State::Paused
            } else {
                State::Running(n + 1)
            }
        }
        State::Paused => {
            println!("일시정지 → 재개");
            State::Running(4)
        }
        State::Done => {
            println!("종료");
            break;
        }
    };
}
```

## 4. 범위(Range) 패턴 총정리

`for` 루프에서 자주 쓰는 범위 문법을 정리한다.

```rust
// 반개방 범위 (끝 미포함)
for i in 0..5 {
    // 0, 1, 2, 3, 4
}

// 닫힌 범위 (끝 포함)
for i in 0..=5 {
    // 0, 1, 2, 3, 4, 5
}

// 역순
for i in (0..5).rev() {
    // 4, 3, 2, 1, 0
}

// step_by — n칸씩 건너뛰기
for i in (0..20).step_by(3) {
    // 0, 3, 6, 9, 12, 15, 18
}

// 문자 범위
for c in 'a'..='f' {
    // 'a', 'b', 'c', 'd', 'e', 'f'
}
```

## 5. `for`와 인덱스

러스트에서는 인덱스 기반 루프보다 이터레이터를 권장하지만, 인덱스가 필요할 때 `enumerate`를 쓴다.

```rust
let items = vec!["apple", "banana", "cherry"];

// 나쁜 예: 인덱스로 접근
for i in 0..items.len() {
    println!("{}: {}", i, items[i]);  // 범위 오류 가능성
}

// 좋은 예: enumerate
for (i, item) in items.iter().enumerate() {
    println!("{}: {}", i, item);  // 안전
}
```

두 컬렉션을 동시에 순회할 때:

```rust
let keys = vec!["name", "age", "city"];
let values = vec!["ferris", "10", "ocean"];

// zip으로 병렬 순회
for (key, value) in keys.iter().zip(values.iter()) {
    println!("{} = {}", key, value);
}
```

## 6. `loop`를 활용한 재시도 패턴

```rust
fn unreliable_operation() -> Result<String, String> {
    // 가끔 실패하는 작업
    Err("네트워크 에러".into())
}

let result = {
    let mut attempts = 0;
    loop {
        attempts += 1;
        match unreliable_operation() {
            Ok(data) => break data,
            Err(e) if attempts < 3 => {
                println!("시도 {} 실패: {}. 재시도...", attempts, e);
                continue;
            }
            Err(e) => {
                panic!("{}회 시도 후 최종 실패: {}", attempts, e);
            }
        }
    }
};
```

## 7. `matches!` 매크로

`match`나 `if let`으로 쓰기엔 과한, 단순한 패턴 확인에 쓴다.

```rust
let value = Some(42);

// if let
if let Some(_) = value {
    println!("값이 있다");
}

// matches! — 더 간결
if matches!(value, Some(_)) {
    println!("값이 있다");
}

// 복잡한 패턴도 가능
let status = 404;
let is_client_error = matches!(status, 400..=499);

let ch = 'A';
let is_alphanumeric = matches!(ch, 'a'..='z' | 'A'..='Z' | '0'..='9');
```

`matches!`는 `bool`을 반환해서 `.filter()`나 조건문에서 바로 쓸 수 있다.

```rust
let items = vec![Some(1), None, Some(3), None, Some(5)];

let count = items.iter().filter(|x| matches!(x, Some(_))).count();
println!("Some 개수: {}", count);  // 3
```

## 정리

| 문법 | 용도 |
|------|------|
| `while let` | 패턴 매칭이 성공하는 동안 반복 |
| `'label: loop` | 중첩 루프에서 바깥 루프 제어 |
| `loop` + `match` | 상태 머신 구현 |
| `(0..n).step_by(k)` | k칸씩 건너뛰며 순회 |
| `enumerate` | 인덱스 + 값 동시 순회 |
| `zip` | 두 컬렉션 병렬 순회 |
| `matches!` | 간단한 패턴 확인 (bool 반환) |

러스트의 제어 흐름은 패턴 매칭과 깊이 연결되어 있다. `if let`, `while let`, `match`, `let-else`, `matches!` 모두 같은 패턴 시스템 위에서 동작한다. 이 점을 이해하면 어떤 상황에서 어떤 구문을 쓸지 자연스럽게 결정할 수 있다.
