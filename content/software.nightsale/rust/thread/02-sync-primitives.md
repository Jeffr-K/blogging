---
title: "[Rust 스레드 시리즈] 02. 동기화 프리미티브"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "mutex", "rwlock", "atomic", "condvar", "동기화"]
---

# 동기화 프리미티브

## 한 줄 요약

`Mutex`, `RwLock`, `Atomic`, `Condvar`는 **여러 스레드가 안전하게 데이터를 공유하고 조율하는 도구**다.

## `Mutex<T>` — 상호 배제

한 번에 하나의 스레드만 데이터에 접근할 수 있도록 잠금(lock)을 건다.

```rust
use std::sync::Mutex;

let m = Mutex::new(5);

{
    let mut num = m.lock().unwrap();  // 잠금 획득 → MutexGuard 반환
    *num = 6;
}   // MutexGuard가 drop되면 자동으로 잠금 해제

println!("{:?}", m.lock().unwrap());  // 6
```

### `lock()` vs `try_lock()`

```rust
let m = Mutex::new(0);

// lock(): 잠금을 얻을 때까지 블로킹
let guard = m.lock().unwrap();

// try_lock(): 블로킹하지 않고 즉시 반환
match m.try_lock() {
    Ok(guard) => println!("잠금 획득: {}", *guard),
    Err(_) => println!("다른 스레드가 잠금 중"),
}
```

### 독 처리 (Poisoned Mutex)

스레드가 Mutex를 잠근 상태에서 패닉하면, Mutex는 **독(poisoned)** 상태가 된다.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

let lock = Arc::new(Mutex::new(0));

let handle = {
    let lock = Arc::clone(&lock);
    thread::spawn(move || {
        let _guard = lock.lock().unwrap();
        panic!("스레드 패닉!");  // 잠금을 잡은 채 패닉
    })
};

let _ = handle.join();

// 이후 lock() 시도 → Err (PoisonError)
match lock.lock() {
    Ok(guard) => println!("{}", *guard),
    Err(poisoned) => {
        // 독 무시하고 데이터에 접근 가능
        let guard = poisoned.into_inner();
        println!("독 무시, 값: {}", *guard);
    }
}
```

### 데드락 주의

```rust
let a = Mutex::new(1);
let b = Mutex::new(2);

// 스레드 1: a → b 순서로 잠금
// 스레드 2: b → a 순서로 잠금
// → 데드락!

// 해결: 항상 같은 순서로 잠금을 획득
```

러스트 컴파일러는 데드락을 잡아주지 **않는다**. 데이터 경쟁은 방지하지만 논리적 교착은 프로그래머의 책임이다.

## `RwLock<T>` — 읽기/쓰기 분리

여러 스레드가 **동시에 읽기**는 가능하지만, **쓰기는 독점**이다.

```rust
use std::sync::RwLock;

let lock = RwLock::new(5);

// 여러 읽기 잠금 동시 가능
{
    let r1 = lock.read().unwrap();
    let r2 = lock.read().unwrap();
    println!("r1={}, r2={}", *r1, *r2);
}

// 쓰기 잠금은 독점
{
    let mut w = lock.write().unwrap();
    *w += 1;
}
```

### `Mutex` vs `RwLock`

| 특성 | `Mutex<T>` | `RwLock<T>` |
|------|-----------|-------------|
| 동시 읽기 | 불가 (하나만) | **가능** |
| 쓰기 | 독점 | 독점 |
| 오버헤드 | 낮음 | 약간 높음 |
| 용도 | 읽기/쓰기 빈도 비슷 | 읽기가 압도적으로 많을 때 |
| Writer Starvation | 없음 | 가능 |

읽기 90%, 쓰기 10%인 설정(config) 같은 데이터에 적합하다.

## `Atomic` 타입 — 잠금 없는 동기화

잠금 없이 CPU의 원자적 연산을 직접 사용한다. 단순한 카운터나 플래그에 적합.

```rust
use std::sync::atomic::{AtomicU64, AtomicBool, Ordering};

let counter = AtomicU64::new(0);
let flag = AtomicBool::new(false);

// 원자적 증가
counter.fetch_add(1, Ordering::Relaxed);
counter.fetch_add(1, Ordering::Relaxed);
println!("{}", counter.load(Ordering::Relaxed));  // 2

// 원자적 교환
flag.store(true, Ordering::Release);
let was = flag.swap(false, Ordering::AcqRel);
println!("이전 값: {}", was);  // true
```

### `Ordering` — 메모리 순서

| Ordering | 의미 | 용도 |
|----------|------|------|
| `Relaxed` | 순서 보장 없음 | 단순 카운터 |
| `Acquire` | 이전의 Release 쓰기를 볼 수 있음 | 읽기 쪽 |
| `Release` | 이후의 Acquire 읽기에 보임 | 쓰기 쪽 |
| `AcqRel` | Acquire + Release | read-modify-write |
| `SeqCst` | 전역 순서 보장 (가장 강함) | 확실하지 않을 때 |

확실하지 않으면 `SeqCst`를 쓰자. 성능 차이는 대부분 무시할 수 있다.

### 멀티 스레드 카운터

```rust
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;

let counter = Arc::new(AtomicUsize::new(0));

let handles: Vec<_> = (0..10).map(|_| {
    let counter = Arc::clone(&counter);
    thread::spawn(move || {
        for _ in 0..1000 {
            counter.fetch_add(1, Ordering::Relaxed);
        }
    })
}).collect();

for h in handles { h.join().unwrap(); }
println!("{}", counter.load(Ordering::Relaxed));  // 10000
```

### Compare-And-Swap (CAS)

잠금 없는 자료구조의 핵심 연산이다.

```rust
use std::sync::atomic::{AtomicI32, Ordering};

let value = AtomicI32::new(5);

// "현재 값이 5면 10으로 바꿔라"
match value.compare_exchange(5, 10, Ordering::SeqCst, Ordering::SeqCst) {
    Ok(prev) => println!("성공, 이전값: {}", prev),   // 5
    Err(current) => println!("실패, 현재값: {}", current),
}
```

### `Mutex` vs `Atomic` 선택

| 상황 | 선택 |
|------|------|
| 단순 카운터, 플래그 | `Atomic` |
| 복잡한 데이터 구조 | `Mutex` |
| 여러 필드를 한꺼번에 수정 | `Mutex` |
| 최대 성능 (핫 루프) | `Atomic` |

## `Condvar` — 조건 변수

"특정 조건이 만족될 때까지 기다린다." Mutex와 함께 사용한다.

```rust
use std::sync::{Arc, Mutex, Condvar};
use std::thread;

let pair = Arc::new((Mutex::new(false), Condvar::new()));

// 대기 스레드
let pair_clone = Arc::clone(&pair);
let waiter = thread::spawn(move || {
    let (lock, cvar) = &*pair_clone;
    let mut ready = lock.lock().unwrap();

    while !*ready {
        ready = cvar.wait(ready).unwrap();  // 조건 만족될 때까지 대기
    }

    println!("조건 만족! 작업 시작");
});

// 알림 스레드
thread::sleep(std::time::Duration::from_secs(1));
let (lock, cvar) = &*pair;
{
    let mut ready = lock.lock().unwrap();
    *ready = true;
}
cvar.notify_one();  // 대기 중인 스레드 하나를 깨움

waiter.join().unwrap();
```

### 생산자-소비자 패턴

```rust
use std::sync::{Arc, Mutex, Condvar};
use std::collections::VecDeque;
use std::thread;

struct BoundedQueue<T> {
    queue: Mutex<VecDeque<T>>,
    not_empty: Condvar,
    not_full: Condvar,
    capacity: usize,
}

impl<T> BoundedQueue<T> {
    fn new(capacity: usize) -> Self {
        BoundedQueue {
            queue: Mutex::new(VecDeque::new()),
            not_empty: Condvar::new(),
            not_full: Condvar::new(),
            capacity,
        }
    }

    fn push(&self, item: T) {
        let mut queue = self.queue.lock().unwrap();
        while queue.len() >= self.capacity {
            queue = self.not_full.wait(queue).unwrap();
        }
        queue.push_back(item);
        self.not_empty.notify_one();
    }

    fn pop(&self) -> T {
        let mut queue = self.queue.lock().unwrap();
        while queue.is_empty() {
            queue = self.not_empty.wait(queue).unwrap();
        }
        let item = queue.pop_front().unwrap();
        self.not_full.notify_one();
        item
    }
}
```

## `Once` / `OnceLock` — 한 번만 초기화

```rust
use std::sync::OnceLock;

static CONFIG: OnceLock<String> = OnceLock::new();

fn get_config() -> &'static String {
    CONFIG.get_or_init(|| {
        println!("초기화 실행 (한 번만)");
        "production".to_string()
    })
}

// 여러 스레드에서 호출해도 초기화는 한 번만
```

## `Barrier` — 동시 시작

모든 스레드가 특정 지점에 도달할 때까지 기다린다.

```rust
use std::sync::{Arc, Barrier};
use std::thread;

let barrier = Arc::new(Barrier::new(3));

let handles: Vec<_> = (0..3).map(|i| {
    let barrier = Arc::clone(&barrier);
    thread::spawn(move || {
        println!("스레드 {} 준비 완료", i);
        barrier.wait();  // 3개 모두 도착할 때까지 대기
        println!("스레드 {} 시작!", i);
    })
}).collect();

for h in handles { h.join().unwrap(); }
```

## 정리

| 프리미티브 | 용도 | 특징 |
|-----------|------|------|
| `Mutex<T>` | 독점적 데이터 접근 | 간단, 범용 |
| `RwLock<T>` | 읽기 많은 데이터 | 동시 읽기 가능 |
| `Atomic*` | 단순 값 (카운터, 플래그) | 잠금 없음, 최고 성능 |
| `Condvar` | 조건 대기 | Mutex와 함께 사용 |
| `OnceLock` | 지연 초기화 | 한 번만 실행 보장 |
| `Barrier` | 동시 시작 | N개 도달 시 해제 |

다음 글에서는 **채널(channel)**을 통한 메시지 패싱 방식을 다룬다.
