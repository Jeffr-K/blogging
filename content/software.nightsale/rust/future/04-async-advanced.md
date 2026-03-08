---
title: "[Rust 비동기 시리즈] 04. 비동기 고급 - Pin, 성능, 실전 아키텍처"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "async", "pin", "unpin", "성능", "고급", "실전"]
---

# 비동기 고급 - Pin, 성능, 실전 아키텍처

## 한 줄 요약

async/await의 이면에는 **자기 참조 구조체, Pin, 그리고 주의해야 할 성능 함정**이 있다.

## 1. 왜 `Pin`이 필요한가

### async가 만드는 자기 참조

```rust
async fn example() {
    let data = vec![1, 2, 3];
    let reference = &data;    // data를 참조
    sleep(Duration::from_secs(1)).await;  // ← 여기서 양보
    println!("{:?}", reference);
}
```

이 async fn은 상태 머신으로 변환된다:

```rust
// 개념적 구조
struct ExampleFuture {
    data: Vec<i32>,
    reference: *const Vec<i32>,  // data를 가리키는 포인터
    state: State,
}
```

`reference`가 같은 구조체의 `data`를 가리킨다 — **자기 참조 구조체**다.

이 구조체가 메모리에서 이동(move)하면? `data`의 주소가 바뀌는데 `reference`는 옛날 주소를 가리킨다. **댕글링 포인터.**

### `Pin`의 역할

`Pin<&mut T>`는 "이 값은 메모리에서 **이동하지 않는다**"를 보장한다.

```rust
use std::pin::Pin;
use std::future::Future;

// Future::poll의 시그니처
fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
//           ^^^^^^^^^^^^ Pin으로 감싸져 있음 → 이동 불가
```

Future의 `poll()`이 `Pin<&mut Self>`를 받는 이유: Future(상태 머신)가 자기 참조를 포함할 수 있으므로, 이동하면 안 되기 때문이다.

### `Unpin` — "이동해도 괜찮다"

대부분의 타입은 `Unpin`을 자동 구현한다. 자기 참조가 없으니 이동해도 안전하다.

```rust
// Unpin인 타입: 이동 가능
let x = 42;  // i32: Unpin
let s = String::from("hello");  // String: Unpin

// !Unpin인 타입: async fn이 만드는 Future
async fn foo() { /* ... */ }
let future = foo();  // impl Future + !Unpin
```

```rust
// Pin<&mut T>에서 T: Unpin이면 Pin은 아무 효과 없음
let mut val = 42;
let pinned = Pin::new(&mut val);  // OK — i32는 Unpin

// T: !Unpin이면 unsafe 없이 Pin을 만들 수 없음
// → Box::pin() 사용
let future = Box::pin(async { 42 });
```

### 실전에서 Pin을 마주치는 경우

```rust
// 1. Future를 Box에 넣을 때
let future: Pin<Box<dyn Future<Output = i32>>> = Box::pin(async { 42 });

// 2. select!에서 재사용할 Future를 Pin할 때
use tokio::pin;

let future = async { slow_operation().await };
pin!(future);  // future를 핀

select! {
    result = &mut future => println!("{:?}", result),
    _ = sleep(Duration::from_secs(1)) => println!("타임아웃"),
}

// 3. Stream을 사용할 때
use tokio_stream::StreamExt;
let stream = some_stream();
tokio::pin!(stream);
while let Some(item) = stream.next().await {
    // ...
}
```

### `pin!` 매크로

```rust
use tokio::pin;

async fn my_future() -> i32 { 42 }

let future = my_future();
pin!(future);  // future를 스택에 핀

// 이제 &mut future가 Pin<&mut impl Future>로 동작
```

## 2. 비동기 함수의 성능 특성

### Future의 크기

각 `.await` 지점마다 상태를 저장해야 하므로, Future의 크기는 커질 수 있다.

```rust
async fn small() -> i32 {
    42
}
// 크기: 매우 작음 (상태 없음)

async fn large() {
    let a = [0u8; 1024];
    something().await;   // a를 .await 너머로 유지
    let b = [0u8; 1024];
    something().await;   // b를 .await 너머로 유지
    println!("{} {}", a.len(), b.len());
}
// 크기: ~2KB+ (a, b를 상태 머신에 저장)
```

### `Box::pin` — 큰 Future 힙 할당

재귀적 async fn이나 매우 큰 Future는 `Box::pin`으로 힙에 넣는다.

```rust
// 재귀 async fn — 컴파일 에러! 크기 무한
// async fn recursive(n: u32) -> u32 {
//     if n == 0 { return 0; }
//     recursive(n - 1).await + 1
// }

// 해결: Box::pin으로 힙 할당
fn recursive(n: u32) -> Pin<Box<dyn Future<Output = u32> + Send>> {
    Box::pin(async move {
        if n == 0 { return 0; }
        recursive(n - 1).await + 1
    })
}
```

## 3. 비동기 코드의 흔한 함정

### 함정 1: 블로킹 코드를 async에서 실행

```rust
// 나쁜 예: 비동기 런타임을 블로킹
async fn bad() {
    std::thread::sleep(Duration::from_secs(1));  // OS 스레드를 멈춤!
    std::fs::read_to_string("file.txt").unwrap();  // 동기 I/O!
}

// 좋은 예
async fn good() {
    tokio::time::sleep(Duration::from_secs(1)).await;  // 비동기 대기
    tokio::fs::read_to_string("file.txt").await.unwrap();  // 비동기 I/O
}

// 어쩔 수 없이 동기 코드를 써야 할 때
async fn acceptable() {
    let result = tokio::task::spawn_blocking(|| {
        std::fs::read_to_string("file.txt").unwrap()
    }).await.unwrap();
}
```

### 함정 2: `Mutex` 잘못 사용

```rust
// 나쁜 예: std::sync::Mutex를 .await 너머로 잡고 있음
use std::sync::Mutex;

async fn bad(data: &Mutex<Vec<i32>>) {
    let mut guard = data.lock().unwrap();
    expensive_async_operation().await;  // 잠금을 잡은 채 양보!
    guard.push(42);
}
// → 다른 태스크가 잠금을 획득할 수 없음

// 좋은 예 1: 잠금 범위를 최소화
async fn good(data: &Mutex<Vec<i32>>) {
    expensive_async_operation().await;
    let mut guard = data.lock().unwrap();
    guard.push(42);
    // guard는 .await 전에 drop됨
}

// 좋은 예 2: tokio::sync::Mutex 사용 (await 지원)
use tokio::sync::Mutex;

async fn also_good(data: &Mutex<Vec<i32>>) {
    let mut guard = data.lock().await;  // 비동기 잠금
    expensive_async_operation().await;
    guard.push(42);
}
```

| Mutex | `.await` 넘기기 | 성능 | 용도 |
|-------|---------------|------|------|
| `std::sync::Mutex` | 위험 | 빠름 | 잠금 범위가 짧을 때 |
| `tokio::sync::Mutex` | 안전 | 약간 느림 | `.await` 넘겨야 할 때 |

### 함정 3: Future를 만들고 await 안 하기

```rust
async fn important_work() {
    println!("중요한 작업!");
}

async fn main() {
    important_work();  // 경고! Future를 만들었지만 await 안 함
    // → "중요한 작업!"은 출력되지 않음

    important_work().await;  // 이래야 실행됨
}
```

## 4. `dyn Future`와 트레이트 객체

```rust
use std::future::Future;
use std::pin::Pin;

// 타입 별칭 (자주 쓰는 패턴)
type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

// 동적 디스패치 필요할 때
async fn dynamic_dispatch(condition: bool) -> BoxFuture<'static, String> {
    if condition {
        Box::pin(async { "A".to_string() })
    } else {
        Box::pin(async { "B".to_string() })
    }
}

// 트레이트에서 async fn을 dyn-safe하게
trait Service {
    fn call(&self, req: Request) -> BoxFuture<'_, Response>;
}
```

## 5. Graceful Shutdown 패턴

```rust
use tokio::sync::broadcast;
use tokio::signal;

#[tokio::main]
async fn main() {
    let (shutdown_tx, _) = broadcast::channel::<()>(1);

    // 워커 태스크 생성
    for i in 0..4 {
        let mut shutdown_rx = shutdown_tx.subscribe();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    // 정상 작업
                    _ = do_work(i) => {}
                    // 종료 신호
                    _ = shutdown_rx.recv() => {
                        println!("Worker {} 종료 중...", i);
                        cleanup(i).await;
                        println!("Worker {} 종료 완료", i);
                        break;
                    }
                }
            }
        });
    }

    // Ctrl+C 대기
    signal::ctrl_c().await.unwrap();
    println!("종료 신호 수신, 워커 종료 중...");
    let _ = shutdown_tx.send(());

    // 모든 워커 종료 대기
    tokio::time::sleep(Duration::from_secs(5)).await;
}
```

## 6. 실전 아키텍처: 비동기 웹 서버

```rust
use std::sync::Arc;
use tokio::sync::RwLock;

// 공유 상태
struct AppState {
    db: DatabasePool,
    cache: RwLock<HashMap<String, String>>,
    config: Config,
}

// 요청 핸들러
async fn handle_get_user(
    state: Arc<AppState>,
    user_id: u32,
) -> Result<User, AppError> {
    // 1. 캐시 확인
    {
        let cache = state.cache.read().await;
        if let Some(cached) = cache.get(&user_id.to_string()) {
            return Ok(serde_json::from_str(cached)?);
        }
    }

    // 2. DB 조회
    let user = state.db.query_user(user_id).await?;

    // 3. 캐시 저장
    {
        let mut cache = state.cache.write().await;
        cache.insert(user_id.to_string(), serde_json::to_string(&user)?);
    }

    Ok(user)
}

// 동시 요청 제한 + 재시도 + 타임아웃
async fn fetch_external_api(url: &str) -> Result<String, AppError> {
    let client = reqwest::Client::new();

    for attempt in 1..=3 {
        match tokio::time::timeout(
            Duration::from_secs(5),
            client.get(url).send(),
        ).await {
            Ok(Ok(response)) => return Ok(response.text().await?),
            Ok(Err(e)) if attempt < 3 => {
                tokio::time::sleep(Duration::from_millis(100 * attempt)).await;
                continue;
            }
            Ok(Err(e)) => return Err(e.into()),
            Err(_) => {
                if attempt == 3 { return Err(AppError::Timeout); }
            }
        }
    }
    unreachable!()
}
```

## 7. 스레드 vs async 최종 정리

```
CPU 바운드                    I/O 바운드
(계산, 변환, 암호화)          (네트워크, 파일, DB)
      │                           │
      ▼                           ▼
  OS 스레드                    async/await
  Rayon                        tokio
      │                           │
      │       혼합 워크로드        │
      └──────────┬───────────────┘
                 ▼
         spawn_blocking으로
         CPU 작업을 분리
```

## 시리즈 정리

| 편 | 주제 | 핵심 |
|---|------|------|
| 01 | async/await 기초 | Future 트레이트, 상태 머신, 런타임 없음 |
| 02 | 런타임과 tokio | Executor, Reactor, Waker, spawn, spawn_blocking |
| 03 | 동시성 패턴 | join!, select!, 채널, Semaphore, Stream |
| 04 | 고급 | Pin, 성능 함정, dyn Future, Graceful Shutdown |

러스트의 비동기는 다른 언어보다 복잡하다. 하지만 그 대가로 **GC 없는 제로 코스트 비동기**를 얻는다. OS 스레드의 성능과 GC 언어의 편리함 사이에서 최적의 균형을 잡은 설계다.
