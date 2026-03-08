---
title: "[Rust 비동기 시리즈] 03. 비동기 동시성 패턴"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "async", "join", "select", "stream", "semaphore", "패턴"]
---

# 비동기 동시성 패턴

## 한 줄 요약

`join!`으로 **모두 기다리고**, `select!`로 **먼저 온 것만 처리**하고, Stream으로 **비동기 시퀀스**를 다룬다.

## 1. `join!` — 모든 Future를 동시에

여러 Future를 동시에 실행하고, **전부 완료될 때까지** 기다린다.

```rust
use tokio::time::{sleep, Duration};

async fn fetch_user() -> String {
    sleep(Duration::from_millis(500)).await;
    "ferris".into()
}

async fn fetch_posts() -> Vec<String> {
    sleep(Duration::from_millis(300)).await;
    vec!["post1".into(), "post2".into()]
}

async fn fetch_comments() -> Vec<String> {
    sleep(Duration::from_millis(400)).await;
    vec!["comment1".into()]
}

#[tokio::main]
async fn main() {
    // 순차 실행: 500 + 300 + 400 = 1200ms
    let user = fetch_user().await;
    let posts = fetch_posts().await;
    let comments = fetch_comments().await;

    // 동시 실행: max(500, 300, 400) = 500ms
    let (user, posts, comments) = tokio::join!(
        fetch_user(),
        fetch_posts(),
        fetch_comments(),
    );
}
```

### `try_join!` — 에러 시 즉시 반환

```rust
use tokio::try_join;

async fn fetch_a() -> Result<String, String> { Ok("A".into()) }
async fn fetch_b() -> Result<String, String> { Err("B 실패".into()) }
async fn fetch_c() -> Result<String, String> { Ok("C".into()) }

#[tokio::main]
async fn main() {
    match try_join!(fetch_a(), fetch_b(), fetch_c()) {
        Ok((a, b, c)) => println!("{}, {}, {}", a, b, c),
        Err(e) => println!("에러: {}", e),  // "B 실패"
    }
}
```

하나라도 `Err`이면 나머지를 취소하고 즉시 반환한다.

### 동적 개수의 Future

`join!`은 컴파일 타임에 개수가 정해져야 한다. 동적 개수는 `JoinSet`을 쓴다.

```rust
use tokio::task::JoinSet;

#[tokio::main]
async fn main() {
    let urls = vec!["url1", "url2", "url3", "url4", "url5"];

    let mut set = JoinSet::new();
    for url in urls {
        set.spawn(async move {
            fetch(url).await
        });
    }

    // 완료되는 순서대로 결과 수집
    while let Some(result) = set.join_next().await {
        match result {
            Ok(data) => println!("완료: {:?}", data),
            Err(e) => println!("에러: {}", e),
        }
    }
}
```

## 2. `select!` — 가장 먼저 완료된 것

여러 Future 중 **가장 먼저 완료된 하나**만 처리한다. 나머지는 취소된다.

```rust
use tokio::select;
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    select! {
        _ = sleep(Duration::from_secs(1)) => {
            println!("1초 경과");
        }
        _ = sleep(Duration::from_secs(2)) => {
            println!("2초 경과");  // 이건 실행 안 됨
        }
    }
}
```

### 타임아웃 패턴

```rust
use tokio::select;
use tokio::time::{sleep, Duration};

async fn slow_operation() -> String {
    sleep(Duration::from_secs(10)).await;
    "결과".into()
}

#[tokio::main]
async fn main() {
    select! {
        result = slow_operation() => {
            println!("완료: {}", result);
        }
        _ = sleep(Duration::from_secs(3)) => {
            println!("타임아웃!");
        }
    }
}
```

### 취소 안전 (Cancellation Safety)

`select!`는 선택되지 않은 Future를 **drop**한다. 이때 진행 중이던 작업의 상태가 유실될 수 있다.

```rust
// 주의: 읽기 작업이 중간에 취소될 수 있음
let mut buf = [0u8; 1024];

select! {
    result = socket.read(&mut buf) => {
        // 데이터 처리
    }
    _ = sleep(Duration::from_secs(5)) => {
        // 타임아웃 — read가 중간에 취소됨
        // 일부 데이터가 읽혔지만 버려질 수 있음
    }
}
```

취소 안전한 대안:

```rust
// tokio::time::timeout 사용 (취소 안전)
match timeout(Duration::from_secs(5), socket.read(&mut buf)).await {
    Ok(Ok(n)) => println!("읽음: {} bytes", n),
    Ok(Err(e)) => println!("I/O 에러: {}", e),
    Err(_) => println!("타임아웃"),
}
```

### `select!` 루프 — 이벤트 루프 패턴

```rust
use tokio::sync::mpsc;
use tokio::signal;

async fn event_loop() {
    let (tx, mut rx) = mpsc::channel::<String>(32);
    let mut interval = tokio::time::interval(Duration::from_secs(1));

    loop {
        select! {
            Some(msg) = rx.recv() => {
                println!("메시지: {}", msg);
            }
            _ = interval.tick() => {
                println!("하트비트");
            }
            _ = signal::ctrl_c() => {
                println!("종료 신호");
                break;
            }
        }
    }
}
```

## 3. 비동기 채널 — `tokio::sync`

스레드 시리즈의 `mpsc`와 비슷하지만, `.await`와 함께 동작한다.

### `mpsc` — 다생산자 단소비자

```rust
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel::<String>(32);  // 버퍼 크기 32

    tokio::spawn(async move {
        tx.send("hello".into()).await.unwrap();
        tx.send("world".into()).await.unwrap();
    });

    while let Some(msg) = rx.recv().await {
        println!("{}", msg);
    }
}
```

### `oneshot` — 일회성 응답

```rust
use tokio::sync::oneshot;

async fn request_handler(reply: oneshot::Sender<String>) {
    let result = process().await;
    reply.send(result).unwrap();
}

#[tokio::main]
async fn main() {
    let (tx, rx) = oneshot::channel();

    tokio::spawn(request_handler(tx));

    let response = rx.await.unwrap();
    println!("응답: {}", response);
}
```

### `broadcast` — 다생산자 다소비자

```rust
use tokio::sync::broadcast;

#[tokio::main]
async fn main() {
    let (tx, _) = broadcast::channel::<String>(16);

    let mut rx1 = tx.subscribe();
    let mut rx2 = tx.subscribe();

    tokio::spawn(async move {
        while let Ok(msg) = rx1.recv().await {
            println!("구독자 1: {}", msg);
        }
    });

    tokio::spawn(async move {
        while let Ok(msg) = rx2.recv().await {
            println!("구독자 2: {}", msg);
        }
    });

    tx.send("공지사항".into()).unwrap();
}
```

### `watch` — 최신 값 관찰

```rust
use tokio::sync::watch;

#[tokio::main]
async fn main() {
    let (tx, mut rx) = watch::channel("초기값".to_string());

    tokio::spawn(async move {
        loop {
            rx.changed().await.unwrap();
            println!("새 값: {}", *rx.borrow());
        }
    });

    tx.send("업데이트 1".into()).unwrap();
    tx.send("업데이트 2".into()).unwrap();
}
```

| 채널 | 생산자 | 소비자 | 버퍼 | 용도 |
|------|--------|--------|------|------|
| `mpsc` | N | 1 | 바운디드 | 명령 큐, 작업 분배 |
| `oneshot` | 1 | 1 | 1 | 요청-응답 |
| `broadcast` | N | N | 바운디드 | 이벤트 알림 |
| `watch` | 1 | N | 최신 1개 | 설정 변경 관찰 |

## 4. `Semaphore` — 동시 접근 제한

```rust
use std::sync::Arc;
use tokio::sync::Semaphore;

#[tokio::main]
async fn main() {
    let semaphore = Arc::new(Semaphore::new(3));  // 동시 최대 3개

    let mut handles = vec![];
    for i in 0..10 {
        let sem = Arc::clone(&semaphore);
        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            println!("작업 {} 시작", i);
            sleep(Duration::from_secs(1)).await;
            println!("작업 {} 완료", i);
            // _permit drop → 슬롯 반환
        }));
    }

    for h in handles { h.await.unwrap(); }
}
```

API 호출 속도 제한(rate limiting)에 유용하다.

## 5. Stream — 비동기 이터레이터

`Iterator`의 비동기 버전이다. `next()`가 Future를 반환한다.

```rust
use tokio_stream::{self as stream, StreamExt};

#[tokio::main]
async fn main() {
    let mut stream = stream::iter(vec![1, 2, 3, 4, 5]);

    while let Some(val) = stream.next().await {
        println!("{}", val);
    }
}
```

### 실전: 웹소켓 메시지 스트림

```rust
// 개념적 예시
async fn handle_websocket(mut ws: WebSocketStream) {
    while let Some(msg) = ws.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                println!("받음: {}", text);
                ws.send(Message::Text(format!("에코: {}", text))).await.unwrap();
            }
            Ok(Message::Close(_)) => break,
            Err(e) => { eprintln!("에러: {}", e); break; }
            _ => {}
        }
    }
}
```

### Stream 어댑터

```rust
use tokio_stream::StreamExt;

let stream = stream::iter(1..=100);

let result: Vec<i32> = stream
    .filter(|&x| x % 2 == 0)          // 짝수만
    .map(|x| x * x)                    // 제곱
    .take(10)                           // 10개만
    .collect()
    .await;
```

## 6. 재시도 패턴

```rust
use tokio::time::{sleep, Duration};

async fn retry<F, Fut, T, E>(f: F, max_attempts: usize) -> Result<T, E>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut last_err = None;
    for attempt in 1..=max_attempts {
        match f().await {
            Ok(val) => return Ok(val),
            Err(e) => {
                println!("시도 {}/{} 실패: {}", attempt, max_attempts, e);
                last_err = Some(e);
                if attempt < max_attempts {
                    let backoff = Duration::from_millis(100 * 2u64.pow(attempt as u32));
                    sleep(backoff).await;  // 지수 백오프
                }
            }
        }
    }
    Err(last_err.unwrap())
}
```

## 정리

| 패턴 | 도구 | 설명 |
|------|------|------|
| 모두 대기 | `join!` / `try_join!` | 모든 Future 완료 |
| 먼저 온 것 | `select!` | 가장 빠른 하나만 |
| 동적 태스크 | `JoinSet` | 런타임에 개수 결정 |
| 메시지 패싱 | `mpsc`, `oneshot`, `broadcast`, `watch` | 비동기 채널 |
| 동시성 제한 | `Semaphore` | 최대 동시 접근 수 |
| 비동기 시퀀스 | `Stream` | 비동기 이터레이터 |
| 재시도 | 지수 백오프 | 네트워크 복원력 |

다음 글에서는 `Pin`, 자기 참조 Future, 성능 함정 등 **비동기 고급 주제**를 다룬다.
