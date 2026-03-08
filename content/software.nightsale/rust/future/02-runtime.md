---
title: "[Rust 비동기 시리즈] 02. 런타임과 tokio"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "tokio", "runtime", "executor", "reactor", "이벤트루프"]
---

# 런타임과 tokio

## 한 줄 요약

런타임은 Future를 **폴링하고, I/O 이벤트를 감시하고, 태스크를 스케줄링하는 엔진**이다.

## 런타임이 하는 일

```
1. Executor  — Future를 poll()하고, Pending이면 파킹
2. Reactor   — OS의 I/O 이벤트(epoll/kqueue/IOCP)를 감시
3. Scheduler — 어떤 태스크를 어떤 스레드에서 실행할지 결정
4. Timer     — sleep, timeout 등 시간 기반 이벤트
```

```
┌────────────────────────────────────┐
│            Application             │
│  async fn → .await → async fn     │
├────────────────────────────────────┤
│            Executor                │
│  poll() → Ready? → 결과 반환       │
│  poll() → Pending? → park         │
├────────────────────────────────────┤
│            Reactor                 │
│  epoll/kqueue/IOCP 감시           │
│  I/O 준비되면 → wake() 호출       │
├────────────────────────────────────┤
│              OS                    │
└────────────────────────────────────┘
```

## 러스트 비동기 런타임 생태계

| 런타임 | 특징 | 용도 |
|--------|------|------|
| `tokio` | 가장 인기, 멀티스레드 | 서버, 네트워크, 범용 |
| `async-std` | std 라이브러리 미러링 API | 학습, 소규모 프로젝트 |
| `smol` | 경량, 최소한의 API | 임베디드, 경량 앱 |
| `embassy` | no_std, 임베디드 전용 | 마이크로컨트롤러 |

이 글에서는 가장 널리 쓰이는 `tokio`를 다룬다.

## tokio 런타임 구성

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
```

### `#[tokio::main]` 매크로

```rust
#[tokio::main]
async fn main() {
    println!("비동기 세계");
}

// 이것은 사실 이것과 같다
fn main() {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            println!("비동기 세계");
        });
}
```

### 런타임 직접 생성

```rust
// 멀티 스레드 런타임 (기본)
let rt = tokio::runtime::Builder::new_multi_thread()
    .worker_threads(4)        // 워커 스레드 수
    .enable_io()              // I/O 리액터 활성화
    .enable_time()            // 타이머 활성화
    .build()
    .unwrap();

// 싱글 스레드 런타임 (현재 스레드에서)
let rt = tokio::runtime::Builder::new_current_thread()
    .enable_all()
    .build()
    .unwrap();

rt.block_on(async {
    // 비동기 코드
});
```

| 런타임 모드 | 스레드 | 용도 |
|------------|--------|------|
| `new_multi_thread()` | N개 워커 스레드 | 서버, 고성능 |
| `new_current_thread()` | 현재 스레드 1개 | CLI, 스크립트, 테스트 |

## `tokio::spawn` — 태스크 생성

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    // 독립적인 태스크 생성
    let handle = tokio::spawn(async {
        sleep(Duration::from_secs(1)).await;
        42
    });

    // 다른 작업 수행
    println!("태스크 실행 중...");

    // 태스크 결과 대기
    let result = handle.await.unwrap();
    println!("결과: {}", result);
}
```

`tokio::spawn`은 `thread::spawn`과 비슷하지만 **OS 스레드가 아닌 비동기 태스크**를 생성한다. 수십만 개를 만들어도 된다.

### `spawn`의 제약: `'static + Send`

```rust
// OK
tokio::spawn(async {
    println!("독립 태스크");
});

// 에러! 참조를 캡처하면 'static이 아님
let data = String::from("hello");
// tokio::spawn(async {
//     println!("{}", data);  // data를 빌림 → !static
// });

// 해결: move로 소유권 이전
tokio::spawn(async move {
    println!("{}", data);  // OK
});
```

## tokio I/O

### TCP 서버

```rust
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    println!("서버 시작: 8080");

    loop {
        let (mut socket, addr) = listener.accept().await?;
        println!("연결: {}", addr);

        tokio::spawn(async move {
            let mut buf = [0u8; 1024];

            loop {
                let n = match socket.read(&mut buf).await {
                    Ok(0) => break,  // 연결 종료
                    Ok(n) => n,
                    Err(_) => break,
                };

                // 에코: 받은 데이터를 그대로 돌려보냄
                socket.write_all(&buf[..n]).await.unwrap();
            }
        });
    }
}
```

각 연결을 `tokio::spawn`으로 처리한다. 10,000개의 동시 연결도 스레드 4개로 처리 가능하다.

### HTTP 클라이언트 (reqwest)

```rust
// reqwest = tokio 기반 HTTP 클라이언트
use reqwest;

#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let body = reqwest::get("https://httpbin.org/ip")
        .await?
        .text()
        .await?;

    println!("{}", body);
    Ok(())
}
```

### 파일 I/O

```rust
use tokio::fs;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // 비동기 파일 읽기
    let content = fs::read_to_string("config.toml").await?;
    println!("{}", content);

    // 비동기 파일 쓰기
    fs::write("output.txt", "hello async").await?;

    Ok(())
}
```

## tokio 타이머

```rust
use tokio::time::{sleep, timeout, interval, Duration};

#[tokio::main]
async fn main() {
    // sleep: 비동기 대기
    sleep(Duration::from_secs(1)).await;

    // timeout: 시간 초과 설정
    match timeout(Duration::from_secs(5), slow_operation()).await {
        Ok(result) => println!("결과: {:?}", result),
        Err(_) => println!("타임아웃!"),
    }

    // interval: 주기적 실행
    let mut ticker = interval(Duration::from_secs(1));
    for _ in 0..5 {
        ticker.tick().await;
        println!("틱");
    }
}
```

## `spawn_blocking` — CPU 바운드 작업

비동기 런타임에서 CPU 집약적 작업을 하면 다른 태스크가 굶는다. `spawn_blocking`으로 별도 스레드에서 실행한다.

```rust
#[tokio::main]
async fn main() {
    // 나쁜 예: 비동기 런타임을 블로킹
    // let hash = compute_hash(data);  // CPU 작업이 다른 태스크를 멈춤

    // 좋은 예: 블로킹 스레드풀에서 실행
    let result = tokio::task::spawn_blocking(move || {
        compute_hash(data)  // 별도 스레드에서 실행
    }).await.unwrap();
}
```

| 메서드 | 스레드 | 용도 |
|--------|--------|------|
| `tokio::spawn` | 비동기 워커 스레드 | I/O 바운드 태스크 |
| `spawn_blocking` | 블로킹 스레드풀 | CPU 바운드, 동기 라이브러리 호출 |

## Waker 메커니즘 — 어떻게 깨우는가

`Pending`을 반환한 Future는 어떻게 다시 폴링되는가?

```
1. Future가 poll() → Pending 반환
2. Future는 내부적으로 Waker를 등록함
3. I/O가 준비되면 OS가 Reactor에 알림
4. Reactor가 Waker::wake() 호출
5. Executor가 해당 Future를 다시 poll()
```

```rust
// 개념적인 Waker 사용 예시
impl Future for MyFuture {
    type Output = ();

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<()> {
        if self.is_ready() {
            Poll::Ready(())
        } else {
            // "준비되면 나를 깨워줘"
            let waker = cx.waker().clone();
            self.register_callback(move || waker.wake());
            Poll::Pending
        }
    }
}
```

## 정리

| 개념 | 역할 |
|------|------|
| Executor | Future를 poll()하는 주체 |
| Reactor | OS I/O 이벤트를 감시, Waker 호출 |
| Scheduler | 태스크를 워커 스레드에 분배 |
| Waker | "이 Future 다시 폴링해줘" 신호 |
| `tokio::spawn` | 비동기 태스크 생성 |
| `spawn_blocking` | CPU 바운드 작업을 별도 스레드에서 |

다음 글에서는 `join!`, `select!`, 스트림 등 **비동기 동시성 패턴**을 다룬다.
