---
title: "[Rust 비동기 시리즈] 01. async/await와 Future"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "async", "await", "future", "비동기", "기초"]
---

# async/await와 Future

## 한 줄 요약

`async`는 함수를 **즉시 실행하지 않고 Future를 반환**하게 만들고, `await`는 그 Future가 **완료될 때까지 양보**한다.

## 왜 비동기가 필요한가

웹 서버가 10,000개의 동시 연결을 처리해야 한다고 하자.

```
스레드 방식:
- 연결당 1스레드 → 10,000개 OS 스레드
- 스레드당 8MB 스택 → 80GB 메모리
- 대부분의 시간은 I/O 대기 → CPU 낭비

비동기 방식:
- 소수의 스레드 (CPU 코어 수만큼)
- I/O 대기 중에는 다른 작업을 실행
- 메모리: 태스크당 수백 바이트 ~ 수 KB
```

비동기는 **I/O 대기 시간을 활용**하는 것이다.

## 다른 언어와 비교

| 언어 | 비동기 모델 | 런타임 |
|------|-----------|--------|
| JavaScript | 이벤트 루프 + Promise | V8 내장 |
| Python | asyncio + coroutine | asyncio 내장 |
| Go | 고루틴 (M:N 스케줄링) | 런타임 내장 |
| C# | Task + async/await | .NET 런타임 내장 |
| Rust | Future + async/await | **런타임이 없음** (직접 선택) |

러스트만의 차별점: **런타임이 언어에 포함되지 않는다.** `tokio`, `async-std` 등 외부 런타임을 선택한다. 이 덕분에 임베디드부터 서버까지 환경에 맞는 런타임을 쓸 수 있다.

## `async fn` — 비동기 함수

```rust
async fn fetch_data() -> String {
    // 비동기 작업
    "데이터".to_string()
}
```

`async fn`은 호출해도 즉시 실행되지 않는다. **Future를 반환**한다.

```rust
let future = fetch_data();  // 아직 실행 안 됨!
// future를 .await 해야 실행됨
```

### `await` — Future 실행

```rust
async fn main_work() {
    let data = fetch_data().await;  // 여기서 실행되고, 완료될 때까지 양보
    println!("{}", data);
}
```

`.await`가 하는 일:
1. Future를 폴링(poll)한다
2. 아직 완료 안 됐으면 → 현재 태스크를 **양보(yield)**하고 다른 태스크 실행
3. 완료되면 → 결과를 꺼내서 반환

## `Future` 트레이트

```rust
pub trait Future {
    type Output;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}

pub enum Poll<T> {
    Ready(T),    // 완료됨, 결과는 T
    Pending,     // 아직 안 됨, 나중에 다시 폴링해줘
}
```

`async fn`은 이 `Future` 트레이트를 구현하는 **상태 머신**으로 변환된다.

### 컴파일러가 하는 일

```rust
// 이 코드는
async fn example() -> i32 {
    let a = step_one().await;
    let b = step_two(a).await;
    a + b
}

// 개념적으로 이런 상태 머신이 된다
enum ExampleFuture {
    State0,                          // 시작
    State1 { step_one_future: ... }, // step_one을 기다리는 중
    State2 { a: i32, step_two_future: ... }, // step_two를 기다리는 중
    Done,
}
```

각 `.await` 지점이 상태 전이 포인트다. `Pending`이면 현재 상태를 저장하고 양보, `Ready`면 다음 상태로 진행.

## `async` 블록

함수 전체가 아니라 코드 블록만 비동기로 만들 수 있다.

```rust
let future = async {
    let data = fetch_data().await;
    data.len()
};

// future는 impl Future<Output = usize>
```

### `async move` 블록

클로저의 `move`와 같다. 변수의 소유권을 블록 안으로 이동한다.

```rust
let name = String::from("ferris");

let future = async move {
    println!("hello, {}", name);  // name의 소유권 이동
};

// println!("{}", name);  // 에러! name은 async 블록이 소유
```

## 첫 번째 비동기 프로그램

러스트 표준 라이브러리에는 비동기 런타임이 없다. `tokio`를 사용하자.

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
```

```rust
use tokio::time::{sleep, Duration};

async fn say_hello() {
    println!("hello...");
    sleep(Duration::from_secs(1)).await;  // 1초 비동기 대기
    println!("...world!");
}

#[tokio::main]
async fn main() {
    say_hello().await;
}
```

`#[tokio::main]`은 tokio 런타임을 생성하고 `main` 함수를 그 위에서 실행한다.

### 동시에 여러 작업

```rust
async fn task(name: &str, ms: u64) {
    println!("{} 시작", name);
    sleep(Duration::from_millis(ms)).await;
    println!("{} 완료 ({}ms)", name, ms);
}

#[tokio::main]
async fn main() {
    // 순차 실행: 총 3초
    task("A", 1000).await;
    task("B", 1000).await;
    task("C", 1000).await;

    // 동시 실행: 총 1초 (가장 느린 것 기준)
    tokio::join!(
        task("A", 1000),
        task("B", 500),
        task("C", 300),
    );
}
```

`join!`은 여러 Future를 **동시에** 폴링한다. 모든 Future가 완료되면 결과를 반환한다.

## `async fn`의 반환 타입

```rust
// 이것은
async fn foo() -> i32 { 42 }

// 사실 이것과 같다
fn foo() -> impl Future<Output = i32> {
    async { 42 }
}
```

`async fn`의 실제 반환 타입은 컴파일러가 생성하는 익명 Future 타입이다.

### 트레이트에서 async fn

```rust
// Rust 1.75부터 트레이트에 async fn 가능
trait DataFetcher {
    async fn fetch(&self, url: &str) -> Result<String, Error>;
}

struct HttpFetcher;

impl DataFetcher for HttpFetcher {
    async fn fetch(&self, url: &str) -> Result<String, Error> {
        // reqwest 등으로 HTTP 요청
        Ok("response".into())
    }
}
```

## `.await`는 어디서 쓸 수 있는가

`async fn` 또는 `async` 블록 안에서만 `.await`를 쓸 수 있다.

```rust
// OK
async fn example() {
    let data = fetch().await;
}

// 에러! 동기 함수에서 .await 불가
fn sync_function() {
    // let data = fetch().await;  // 컴파일 에러!
}
```

동기 함수에서 Future를 실행하려면 런타임을 직접 사용해야 한다.

```rust
fn sync_function() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let data = rt.block_on(fetch());
}
```

## 정리

| 개념 | 설명 |
|------|------|
| `async fn` | Future를 반환하는 함수 (즉시 실행 안 됨) |
| `.await` | Future를 폴링하고 완료될 때까지 양보 |
| `Future` 트레이트 | `poll()` → `Ready` 또는 `Pending` |
| `async` 블록 | 코드 블록을 Future로 만듦 |
| `async move` | 소유권을 Future 안으로 이동 |
| 런타임 | Future를 실행하는 엔진 (tokio 등) |

- `async`는 상태 머신으로 컴파일된다 (제로 코스트)
- 런타임은 언어에 포함되지 않음 → 선택의 자유
- I/O 대기 시간을 활용하는 것이 핵심 목적

다음 글에서는 **런타임의 내부 동작과 tokio** 를 깊이 다룬다.
