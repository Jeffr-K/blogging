---
title: "[Rust 스레드 시리즈] 04. 스레드 고급 - 스레드 풀, Rayon, 실전 아키텍처"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "thread-pool", "rayon", "send", "sync", "고급", "실전"]
---

# 스레드 고급 - 스레드 풀, Rayon, 실전 아키텍처

## 한 줄 요약

매번 스레드를 만드는 건 비싸다. **스레드 풀과 작업 분배** 전략으로 효율적인 병렬 처리를 구현한다.

## 왜 스레드를 매번 만들면 안 되는가

```rust
// 요청마다 스레드 생성 — 비효율
for request in incoming_requests {
    thread::spawn(move || handle(request));
}
```

OS 스레드 생성 비용: 스택 할당 (기본 8MB), 커널 자원 등록, 컨텍스트 스위칭. 요청이 초당 10,000개면 10,000개의 OS 스레드가 만들어진다.

## 직접 스레드 풀 구현

원리를 이해하기 위해 간단한 스레드 풀을 만들어보자.

```rust
use std::sync::{mpsc, Arc, Mutex};
use std::thread;

type Job = Box<dyn FnOnce() + Send + 'static>;

struct ThreadPool {
    workers: Vec<thread::JoinHandle<()>>,
    sender: Option<mpsc::Sender<Job>>,
}

impl ThreadPool {
    fn new(size: usize) -> Self {
        let (sender, receiver) = mpsc::channel::<Job>();
        let receiver = Arc::new(Mutex::new(receiver));

        let workers: Vec<_> = (0..size).map(|id| {
            let receiver = Arc::clone(&receiver);
            thread::spawn(move || {
                loop {
                    let job = receiver.lock().unwrap().recv();
                    match job {
                        Ok(job) => {
                            println!("Worker {} 실행", id);
                            job();
                        }
                        Err(_) => break,  // 채널 닫힘 → 종료
                    }
                }
            })
        }).collect();

        ThreadPool { workers, sender: Some(sender) }
    }

    fn execute<F: FnOnce() + Send + 'static>(&self, f: F) {
        self.sender.as_ref().unwrap().send(Box::new(f)).unwrap();
    }
}

impl Drop for ThreadPool {
    fn drop(&mut self) {
        drop(self.sender.take());  // 채널 닫기
        for worker in self.workers.drain(..) {
            worker.join().unwrap();
        }
    }
}

fn main() {
    let pool = ThreadPool::new(4);

    for i in 0..8 {
        pool.execute(move || {
            println!("작업 {} 시작", i);
            thread::sleep(std::time::Duration::from_millis(500));
            println!("작업 {} 완료", i);
        });
    }
}  // pool drop → 모든 작업 완료 대기
```

구조: 고정된 N개의 워커 스레드가 채널에서 작업을 꺼내서 실행한다.

## Rayon — 데이터 병렬 처리

`rayon`은 **작업 훔치기(work-stealing)** 알고리즘 기반의 병렬 처리 라이브러리다.

```toml
[dependencies]
rayon = "1"
```

### `par_iter()` — 병렬 이터레이터

```rust
use rayon::prelude::*;

let numbers: Vec<i32> = (0..1_000_000).collect();

// 순차 처리
let sum: i32 = numbers.iter().sum();

// 병렬 처리 — iter()를 par_iter()로 바꾸기만 하면 됨
let sum: i32 = numbers.par_iter().sum();
```

한 줄 바꿔서 병렬화. Rayon이 CPU 코어 수에 맞춰 자동으로 분배한다.

### 병렬 map, filter, reduce

```rust
use rayon::prelude::*;

let data: Vec<f64> = (0..10_000_000).map(|x| x as f64).collect();

// 병렬 map + filter + sum
let result: f64 = data.par_iter()
    .map(|&x| x.sin())
    .filter(|&x| x > 0.0)
    .sum();

// 병렬 정렬
let mut v = vec![5, 2, 8, 1, 9, 3];
v.par_sort();

// 병렬 for_each
data.par_iter().for_each(|x| {
    // 각 요소에 대해 병렬 실행
    process(x);
});
```

### `par_chunks()`

```rust
let data: Vec<u8> = load_huge_file();

// 1MB 단위로 병렬 처리
let checksums: Vec<u32> = data.par_chunks(1_000_000)
    .map(|chunk| compute_checksum(chunk))
    .collect();
```

### `join()` — 두 작업을 병렬로

```rust
use rayon::join;

fn parallel_quicksort(slice: &mut [i32]) {
    if slice.len() <= 1 { return; }

    let pivot = partition(slice);
    let (left, right) = slice.split_at_mut(pivot);

    // 왼쪽과 오른쪽을 동시에 정렬
    rayon::join(
        || parallel_quicksort(left),
        || parallel_quicksort(&mut right[1..]),
    );
}
```

### Rayon이 적합하지 않은 경우

- I/O 바운드 작업 (파일, 네트워크) → **async/await가 적합**
- 작업 단위가 너무 작을 때 → 오버헤드가 이득보다 큼
- 순서가 중요한 작업 → `par_iter()`는 순서를 보장하지 않음

## `Send`와 `Sync` 심화

### 구현 규칙

```rust
// 자동 구현: 모든 필드가 Send면 구조체도 Send
struct MyData {
    a: String,   // Send
    b: Vec<i32>, // Send
}
// MyData는 자동으로 Send

// 수동으로 Send 해제
struct NotSend {
    ptr: *mut u8,  // raw pointer는 !Send
}

// 수동으로 Send 구현 (unsafe)
unsafe impl Send for NotSend {}
```

### `!Send` / `!Sync` 타입을 스레드에서 쓰려면

```rust
use std::rc::Rc;

// Rc는 !Send — 스레드에 보낼 수 없음
let data = Rc::new(42);
// thread::spawn(move || println!("{}", data));  // 컴파일 에러!

// 해결: Arc로 교체
use std::sync::Arc;
let data = Arc::new(42);
thread::spawn(move || println!("{}", data));  // OK
```

### `Sync`의 실체

`T: Sync`는 `&T: Send`와 같은 의미다. "이 타입의 불변 참조를 다른 스레드에 보내도 안전하다."

```rust
// Mutex<T>는 T가 Send면 Sync
// → &Mutex<T>를 여러 스레드에서 공유 가능
// → lock()으로 한 번에 하나만 접근하니까

// RefCell<T>는 !Sync
// → &RefCell<T>를 여러 스레드에서 공유하면 위험
// → borrow()가 스레드 안전하지 않으니까
```

## 스레드 vs async — 언제 무엇을

| 기준 | 스레드 | async |
|------|--------|-------|
| I/O 바운드 (네트워크, 파일) | 비효율 (스레드가 대기) | **적합** |
| CPU 바운드 (계산, 변환) | **적합** | 비효율 (런타임이 블로킹됨) |
| 동시 연결 수천~수만 | 메모리 부족 | **적합** (경량 태스크) |
| 단순 병렬 루프 | Rayon | 부적합 |
| 실시간 응답 | 예측 가능 | 스케줄러에 의존 |

### 혼합 사용 (실전)

```rust
// tokio (async) + rayon (CPU 병렬) 조합
async fn handle_request(data: Vec<u8>) -> Vec<u8> {
    // CPU 집약적 작업은 rayon에게
    let result = tokio::task::spawn_blocking(move || {
        use rayon::prelude::*;
        data.par_chunks(1024)
            .map(|chunk| process_chunk(chunk))
            .flatten()
            .collect()
    }).await.unwrap();

    result
}
```

## 실전 아키텍처: 워커 패턴

```rust
use std::sync::{mpsc, Arc, Mutex};
use std::thread;

struct Worker {
    id: usize,
    handle: Option<thread::JoinHandle<()>>,
}

struct WorkerPool<T: Send + 'static> {
    workers: Vec<Worker>,
    sender: mpsc::Sender<T>,
}

impl<T: Send + 'static> WorkerPool<T> {
    fn new<F>(size: usize, handler: F) -> Self
    where
        F: Fn(usize, T) + Send + Sync + 'static,
    {
        let (sender, receiver) = mpsc::channel::<T>();
        let receiver = Arc::new(Mutex::new(receiver));
        let handler = Arc::new(handler);

        let workers: Vec<_> = (0..size).map(|id| {
            let receiver = Arc::clone(&receiver);
            let handler = Arc::clone(&handler);

            let handle = thread::spawn(move || {
                while let Ok(item) = receiver.lock().unwrap().recv() {
                    handler(id, item);
                }
            });

            Worker { id, handle: Some(handle) }
        }).collect();

        WorkerPool { workers, sender }
    }

    fn submit(&self, item: T) {
        self.sender.send(item).unwrap();
    }
}

fn main() {
    let pool = WorkerPool::new(4, |worker_id, task: String| {
        println!("[Worker {}] 처리: {}", worker_id, task);
        thread::sleep(std::time::Duration::from_millis(100));
    });

    for i in 0..20 {
        pool.submit(format!("작업 {}", i));
    }
}
```

## 시리즈 정리

| 편 | 주제 | 핵심 |
|---|------|------|
| 01 | 스레드 기초 | spawn, join, move, scope, Arc |
| 02 | 동기화 프리미티브 | Mutex, RwLock, Atomic, Condvar |
| 03 | 채널 | mpsc, crossbeam, 액터 패턴, 파이프라인 |
| 04 | 고급 | 스레드 풀, Rayon, Send/Sync 심화, 스레드 vs async |

스레드는 CPU 바운드 병렬 처리의 기본이다. I/O 바운드 동시성은 다음 시리즈인 **async/Future**에서 다룬다.
