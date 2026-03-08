---
title: "[Rust 스레드 시리즈] 01. 스레드 기초"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "thread", "spawn", "join", "concurrency", "기초"]
---

# 스레드 기초

## 한 줄 요약

러스트의 스레드는 **OS 스레드를 직접 사용**하되, **컴파일 타임에 데이터 경쟁을 방지**한다.

## 다른 언어와 비교

| 언어 | 스레드 모델 | 안전성 |
|------|-----------|--------|
| C/C++ | OS 스레드, pthreads | 프로그래머 책임 (data race = UB) |
| Java | OS 스레드 + JVM | synchronized 키워드 (런타임 검사) |
| Go | 고루틴 (경량 스레드) | 채널 권장, 공유 메모리도 가능 |
| Python | OS 스레드 + GIL | GIL이 동시 실행을 막음 (CPU 병렬 X) |
| Rust | OS 스레드 (1:1) | **컴파일 타임에 데이터 경쟁 방지** |

러스트만의 차별점: 잘못된 공유 접근은 컴파일 에러다. 런타임에 크래시나는 게 아니라 빌드가 안 된다.

## `thread::spawn` — 스레드 생성

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handle = thread::spawn(|| {
        for i in 1..=5 {
            println!("스레드: {}", i);
            thread::sleep(Duration::from_millis(100));
        }
    });

    for i in 1..=3 {
        println!("메인: {}", i);
        thread::sleep(Duration::from_millis(100));
    }

    handle.join().unwrap();  // 스레드 종료 대기
}
```

`thread::spawn`은 새 OS 스레드를 생성하고 `JoinHandle`을 반환한다.

### `join()` — 스레드 대기

```rust
let handle = thread::spawn(|| {
    42  // 스레드의 반환값
});

let result = handle.join().unwrap();  // 42
println!("스레드 결과: {}", result);
```

`join()`은 `Result<T, Box<dyn Any>>`를 반환한다. 스레드가 패닉하면 `Err`이 된다.

```rust
let handle = thread::spawn(|| {
    panic!("스레드에서 패닉!");
});

match handle.join() {
    Ok(_) => println!("정상 종료"),
    Err(_) => println!("스레드가 패닉함"),
}
// 메인 스레드는 죽지 않는다
```

## `move`와 스레드

스레드에 데이터를 넘기려면 `move` 클로저가 필수다.

```rust
let name = String::from("ferris");

// move 없이: 컴파일 에러!
// thread::spawn(|| println!("{}", name));
// → name의 참조가 스레드보다 오래 사는 걸 보장할 수 없음

// move로 소유권 이전
thread::spawn(move || {
    println!("스레드: {}", name);
});
// println!("{}", name);  // 에러! name은 스레드가 소유
```

왜 `move`가 필수인가: 스레드는 생성한 스코프보다 오래 살 수 있다. 참조가 댕글링될 위험이 있으므로 소유권을 넘겨야 안전하다.

## 스코프 스레드 (`thread::scope`)

`move` 없이 참조를 공유하고 싶을 때 쓴다. Rust 1.63에 안정화되었다.

```rust
let data = vec![1, 2, 3, 4, 5];
let mut result = 0;

thread::scope(|s| {
    // &data를 빌릴 수 있다 — scope가 끝나기 전에 스레드가 종료되므로
    s.spawn(|| {
        let sum: i32 = data.iter().sum();
        println!("합: {}", sum);
    });

    s.spawn(|| {
        let max = data.iter().max().unwrap();
        println!("최대: {}", max);
    });
});
// scope 블록이 끝나면 모든 스레드가 join됨
// data는 여전히 유효
println!("데이터: {:?}", data);
```

`thread::scope`가 보장하는 것: 블록이 끝나기 전에 모든 스레드가 종료된다. 따라서 스코프 내 참조는 안전하다.

### `spawn` vs `scope`

| 특성 | `thread::spawn` | `thread::scope` |
|------|----------------|----------------|
| 데이터 전달 | `move` (소유권 이전) | 참조 빌림 가능 |
| 스레드 수명 | 무제한 | 스코프 블록 내 |
| join | 수동 (`handle.join()`) | 자동 (블록 끝에서) |
| 용도 | 독립적인 백그라운드 작업 | 데이터 병렬 처리 |

## 여러 스레드 생성

```rust
let mut handles = vec![];

for i in 0..5 {
    let handle = thread::spawn(move || {
        println!("스레드 {} 시작", i);
        thread::sleep(Duration::from_millis(100));
        i * i
    });
    handles.push(handle);
}

let results: Vec<i32> = handles
    .into_iter()
    .map(|h| h.join().unwrap())
    .collect();

println!("결과: {:?}", results);  // [0, 1, 4, 9, 16]
```

## 스레드 설정

```rust
let handle = thread::Builder::new()
    .name("worker-1".to_string())
    .stack_size(4 * 1024 * 1024)  // 4MB 스택
    .spawn(|| {
        println!("스레드 이름: {:?}", thread::current().name());
    })
    .unwrap();

handle.join().unwrap();
```

| 설정 | 기본값 | 설명 |
|------|-------|------|
| `name` | 없음 | 디버깅용 스레드 이름 |
| `stack_size` | 플랫폼 기본 (보통 8MB) | 스택 크기 |

## 공유 데이터 — `Arc`

여러 스레드에서 같은 데이터를 읽으려면 `Arc`(Atomic Reference Counting)를 쓴다.

```rust
use std::sync::Arc;

let data = Arc::new(vec![1, 2, 3, 4, 5]);

let mut handles = vec![];
for i in 0..3 {
    let data = Arc::clone(&data);  // 참조 카운트 증가 (데이터 복사 아님)
    handles.push(thread::spawn(move || {
        let sum: i32 = data.iter().sum();
        println!("스레드 {}: 합 = {}", i, sum);
    }));
}

for h in handles {
    h.join().unwrap();
}
```

`Rc`는 스레드 안전하지 않다 (`!Send`). 멀티 스레드에서는 반드시 `Arc`를 써야 한다.

## 공유 + 수정 — `Arc<Mutex<T>>`

여러 스레드에서 같은 데이터를 **수정**하려면 `Mutex`로 감싼다.

```rust
use std::sync::{Arc, Mutex};

let counter = Arc::new(Mutex::new(0));

let mut handles = vec![];
for _ in 0..10 {
    let counter = Arc::clone(&counter);
    handles.push(thread::spawn(move || {
        let mut num = counter.lock().unwrap();
        *num += 1;
    }));
}

for h in handles {
    h.join().unwrap();
}

println!("결과: {}", *counter.lock().unwrap());  // 10
```

이 패턴은 다음 글에서 자세히 다룬다.

## `Send`와 `Sync` — 컴파일 타임 안전성의 비밀

러스트가 스레드 안전성을 컴파일 타임에 보장하는 핵심이 이 두 마커 트레이트다.

```rust
// Send: 이 타입의 소유권을 다른 스레드로 보낼 수 있다
// Sync: 이 타입의 참조(&T)를 여러 스레드에서 동시에 접근할 수 있다
```

| 타입 | Send | Sync |
|------|------|------|
| `i32`, `String`, `Vec<T>` | O | O |
| `Arc<T>` | O (T가 Send+Sync면) | O |
| `Mutex<T>` | O (T가 Send면) | O |
| `Rc<T>` | **X** | **X** |
| `RefCell<T>` | O | **X** |
| `*mut T` (raw pointer) | **X** | **X** |

```rust
use std::rc::Rc;

let data = Rc::new(42);
// thread::spawn(move || println!("{}", data));
// 컴파일 에러! Rc<i32>: !Send
// → "Rc는 스레드 간에 보낼 수 없다"
```

컴파일러가 `Send`/`Sync` 바운드를 자동으로 검사하기 때문에, 스레드 안전하지 않은 타입을 스레드에 넘기면 빌드 자체가 안 된다.

## 정리

- `thread::spawn` — OS 스레드 생성, `move` 클로저로 데이터 전달
- `handle.join()` — 스레드 종료 대기, 반환값/패닉 처리
- `thread::scope` — 참조 빌림 가능한 스코프 스레드
- `Arc` — 멀티 스레드 공유 소유권
- `Arc<Mutex<T>>` — 멀티 스레드 공유 + 수정
- `Send`/`Sync` — 컴파일 타임 스레드 안전성 보장

다음 글에서는 `Mutex`, `RwLock`, `Atomic` 등 **동기화 프리미티브**를 깊이 다룬다.
