---
title: "[Rust 스레드 시리즈] 03. 채널과 메시지 패싱"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "channel", "mpsc", "crossbeam", "메시지패싱"]
---

# 채널과 메시지 패싱

## 한 줄 요약

**"메모리를 공유하지 말고, 메시지를 보내라."** 채널은 스레드 간 안전한 통신 파이프라인이다.

## 공유 메모리 vs 메시지 패싱

| 방식 | 도구 | 장점 | 단점 |
|------|------|------|------|
| 공유 메모리 | `Arc<Mutex<T>>` | 직관적 | 데드락 위험, 잠금 경합 |
| 메시지 패싱 | 채널 | 데드락 적음, 깔끔한 설계 | 데이터 복사/이동 비용 |

Go의 철학: *"Don't communicate by sharing memory; share memory by communicating."*
러스트도 같은 철학을 채널로 지원한다.

## `mpsc` — 표준 라이브러리 채널

**Multiple Producer, Single Consumer.** 여러 보내는 쪽, 하나의 받는 쪽.

```rust
use std::sync::mpsc;
use std::thread;

let (tx, rx) = mpsc::channel();

thread::spawn(move || {
    tx.send("hello from thread").unwrap();
});

let msg = rx.recv().unwrap();  // 블로킹 대기
println!("받음: {}", msg);
```

### `send()` / `recv()` 동작

```rust
let (tx, rx) = mpsc::channel();

// send: 보내기 (비블로킹 — 버퍼에 넣고 즉시 반환)
tx.send(42).unwrap();

// recv: 블로킹 대기
let val = rx.recv().unwrap();

// try_recv: 비블로킹 (없으면 즉시 Err)
match rx.try_recv() {
    Ok(val) => println!("받음: {}", val),
    Err(mpsc::TryRecvError::Empty) => println!("아직 없음"),
    Err(mpsc::TryRecvError::Disconnected) => println!("채널 닫힘"),
}

// recv_timeout: 제한 시간 대기
use std::time::Duration;
match rx.recv_timeout(Duration::from_secs(5)) {
    Ok(val) => println!("받음: {}", val),
    Err(_) => println!("타임아웃"),
}
```

### 여러 메시지 보내기

```rust
let (tx, rx) = mpsc::channel();

thread::spawn(move || {
    let messages = vec!["안녕", "나는", "스레드야"];
    for msg in messages {
        tx.send(msg).unwrap();
        thread::sleep(Duration::from_millis(200));
    }
    // tx가 drop됨 → 채널 닫힘
});

// 이터레이터로 수신 (채널이 닫힐 때까지)
for msg in rx {
    println!("수신: {}", msg);
}
println!("채널 종료");
```

`rx`를 이터레이터로 쓰면 채널이 닫힐 때까지 자동으로 `recv()`를 반복한다.

### Multiple Producer — `tx.clone()`

```rust
let (tx, rx) = mpsc::channel();

for i in 0..5 {
    let tx = tx.clone();
    thread::spawn(move || {
        tx.send(format!("스레드 {} 메시지", i)).unwrap();
    });
}
drop(tx);  // 원본 tx도 drop해야 채널이 닫힘

for msg in rx {
    println!("{}", msg);
}
```

`tx.clone()`으로 여러 생산자를 만들 수 있다. **모든** `tx`가 drop되어야 채널이 닫힌다.

### `sync_channel` — 바운디드 채널

```rust
// 버퍼 크기 3
let (tx, rx) = mpsc::sync_channel(3);

tx.send(1).unwrap();  // 즉시 반환
tx.send(2).unwrap();  // 즉시 반환
tx.send(3).unwrap();  // 즉시 반환
// tx.send(4).unwrap();  // 블로킹! 버퍼가 가득 참

// 버퍼 크기 0 = 랑데부 채널
let (tx, rx) = mpsc::sync_channel(0);
// tx.send(...)는 rx.recv()가 호출될 때까지 블로킹
```

| 채널 종류 | 생성 | 버퍼 | send 동작 |
|----------|------|------|----------|
| `channel()` | 무한 버퍼 | 무제한 | 항상 즉시 반환 |
| `sync_channel(n)` | 바운디드 | n개 | 버퍼 찰 때 블로킹 |
| `sync_channel(0)` | 랑데부 | 없음 | recv 올 때까지 블로킹 |

## 채널로 구조화된 메시지 보내기

```rust
enum Command {
    Increment(u64),
    Decrement(u64),
    GetValue(mpsc::Sender<u64>),  // 응답용 채널 포함
    Shutdown,
}

fn counter_actor(rx: mpsc::Receiver<Command>) {
    let mut value: u64 = 0;

    for cmd in rx {
        match cmd {
            Command::Increment(n) => value += n,
            Command::Decrement(n) => value -= n,
            Command::GetValue(reply_tx) => {
                reply_tx.send(value).unwrap();
            }
            Command::Shutdown => break,
        }
    }
}

fn main() {
    let (tx, rx) = mpsc::channel();

    let handle = thread::spawn(move || counter_actor(rx));

    tx.send(Command::Increment(10)).unwrap();
    tx.send(Command::Increment(5)).unwrap();
    tx.send(Command::Decrement(3)).unwrap();

    // 값 조회 (응답 채널)
    let (reply_tx, reply_rx) = mpsc::channel();
    tx.send(Command::GetValue(reply_tx)).unwrap();
    println!("현재 값: {}", reply_rx.recv().unwrap());  // 12

    tx.send(Command::Shutdown).unwrap();
    handle.join().unwrap();
}
```

이것이 **액터(Actor) 패턴**이다. 상태를 소유하는 스레드 하나가 메시지로만 상호작용한다. 잠금이 필요 없다.

## `crossbeam-channel` — 고성능 채널

표준 라이브러리의 `mpsc`보다 더 유연하고 빠른 서드파티 채널이다.

```toml
[dependencies]
crossbeam-channel = "0.5"
```

### MPMC (Multiple Producer, Multiple Consumer)

```rust
use crossbeam_channel::unbounded;
use std::thread;

let (tx, rx) = unbounded();

// 여러 생산자
for i in 0..3 {
    let tx = tx.clone();
    thread::spawn(move || {
        tx.send(format!("생산자 {}", i)).unwrap();
    });
}

// 여러 소비자
for i in 0..3 {
    let rx = rx.clone();
    thread::spawn(move || {
        if let Ok(msg) = rx.recv() {
            println!("소비자 {}: {}", i, msg);
        }
    });
}
```

### `select!` — 여러 채널 동시 대기

```rust
use crossbeam_channel::{select, unbounded, tick, after};
use std::time::Duration;

let (tx1, rx1) = unbounded();
let (tx2, rx2) = unbounded();
let timeout = after(Duration::from_secs(5));
let ticker = tick(Duration::from_secs(1));

loop {
    select! {
        recv(rx1) -> msg => println!("채널 1: {:?}", msg),
        recv(rx2) -> msg => println!("채널 2: {:?}", msg),
        recv(ticker) -> _ => println!("1초 경과"),
        recv(timeout) -> _ => {
            println!("타임아웃!");
            break;
        }
    }
}
```

Go의 `select` 문과 유사하다. 여러 채널 중 먼저 준비된 것을 처리한다.

### `mpsc` vs `crossbeam-channel`

| 특성 | `std::sync::mpsc` | `crossbeam-channel` |
|------|-------------------|-------------------|
| 소비자 | 1개 (Single Consumer) | 여러 개 (MPMC) |
| `select!` | 없음 | 있음 |
| 성능 | 보통 | 더 빠름 |
| 바운디드 채널 | `sync_channel` | `bounded(n)` |
| 타이머 채널 | 없음 | `tick()`, `after()` |

실전에서는 `crossbeam-channel`이 거의 표준처럼 쓰인다.

## 파이프라인 패턴

여러 단계의 처리를 채널로 연결한다.

```rust
use std::sync::mpsc;
use std::thread;

fn pipeline() {
    let (tx1, rx1) = mpsc::channel::<i32>();  // 입력 → 단계1
    let (tx2, rx2) = mpsc::channel::<i32>();  // 단계1 → 단계2
    let (tx3, rx3) = mpsc::channel::<String>(); // 단계2 → 출력

    // 단계 1: 필터 (짝수만)
    thread::spawn(move || {
        for val in rx1 {
            if val % 2 == 0 {
                tx2.send(val).unwrap();
            }
        }
    });

    // 단계 2: 변환
    thread::spawn(move || {
        for val in rx2 {
            tx3.send(format!("결과: {}", val * val)).unwrap();
        }
    });

    // 입력
    for i in 1..=10 {
        tx1.send(i).unwrap();
    }
    drop(tx1);  // 입력 완료

    // 출력 수집
    for result in rx3 {
        println!("{}", result);
    }
}
```

## 정리

| 패턴 | 도구 | 설명 |
|------|------|------|
| 단방향 통신 | `mpsc::channel` | 생산자 → 소비자 |
| 요청-응답 | 응답 채널 동봉 | 액터 패턴 |
| 다중 소비자 | `crossbeam-channel` | MPMC |
| 다중 채널 대기 | `crossbeam::select!` | Go의 select 유사 |
| 파이프라인 | 채널 체이닝 | 단계별 처리 |
| 백프레셔 | `sync_channel(n)` | 생산 속도 제한 |

다음 글에서는 **스레드 풀, Rayon, Send/Sync 심화** 등 고급 주제를 다룬다.
