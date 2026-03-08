---
title: "[Rust 소유권 시리즈] 04. 스마트 포인터"
author: anonymous.rs
date: 2025-12-25
tags: ["rust", "box", "rc", "arc", "refcell", "cow", "smart-pointer"]
---

# 스마트 포인터

## 한 줄 요약

스마트 포인터는 **포인터처럼 동작하면서 추가 기능(소유권, 참조 카운팅 등)을 제공하는 타입**이다.

## 일반 참조 vs 스마트 포인터

| 특성 | `&T` (참조) | 스마트 포인터 |
|------|------------|-------------|
| 데이터 소유 | 아니오 (빌림) | **예** (소유) |
| 메타데이터 | 없음 | 있음 (카운트, 플래그 등) |
| 추가 동작 | 없음 | `Deref`, `Drop` 구현 |

사실 `String`과 `Vec<T>`도 스마트 포인터다. 힙 데이터를 소유하고, `Deref`와 `Drop`을 구현한다.

## 1. `Box<T>` - 힙에 넣기

가장 단순한 스마트 포인터. 값을 스택이 아닌 **힙**에 할당한다.

```rust
let b = Box::new(5);
println!("{}", b);  // Deref 덕분에 그냥 i32처럼 사용 가능
```

### 언제 쓰는가

**컴파일 타임에 크기를 알 수 없는 타입:**

```rust
// 재귀적 타입 — 크기가 무한대
// enum List { Cons(i32, List), Nil }  // 컴파일 에러!

// Box로 감싸면 포인터 크기(고정)가 됨
enum List {
    Cons(i32, Box<List>),
    Nil,
}

use List::{Cons, Nil};
let list = Cons(1, Box::new(Cons(2, Box::new(Cons(3, Box::new(Nil))))));
```

**트레이트 객체:**

```rust
trait Animal {
    fn speak(&self);
}

// dyn Animal의 크기를 모르니 Box로 감쌈
let animals: Vec<Box<dyn Animal>> = vec![
    Box::new(Dog),
    Box::new(Cat),
];
```

**큰 데이터를 이동 비용 없이 전달:**

```rust
// 스택에 1MB 배열 → 이동 시 복사 비용
let big = [0u8; 1_000_000];

// Box로 감싸면 힙에 할당, 이동 시 포인터만 복사 (8바이트)
let big = Box::new([0u8; 1_000_000]);
```

## 2. `Rc<T>` - 참조 카운팅 (단일 스레드)

하나의 값에 **여러 소유자**가 필요할 때 쓴다. 참조 카운트가 0이 되면 자동 해제.

```rust
use std::rc::Rc;

let a = Rc::new(String::from("공유 데이터"));
println!("카운트: {}", Rc::strong_count(&a));  // 1

let b = Rc::clone(&a);  // 카운트 증가 (데이터 복사 아님!)
println!("카운트: {}", Rc::strong_count(&a));  // 2

let c = Rc::clone(&a);
println!("카운트: {}", Rc::strong_count(&a));  // 3

drop(c);
println!("카운트: {}", Rc::strong_count(&a));  // 2
```

### 그래프, 트리에서의 활용

```rust
use std::rc::Rc;

struct Node {
    value: i32,
    children: Vec<Rc<Node>>,
}

let shared_child = Rc::new(Node { value: 3, children: vec![] });

let parent1 = Node {
    value: 1,
    children: vec![Rc::clone(&shared_child)],
};
let parent2 = Node {
    value: 2,
    children: vec![Rc::clone(&shared_child)],  // 같은 자식을 공유
};
```

### `Rc`의 제약

- **불변**이다. `Rc<T>`를 통해 데이터를 수정할 수 없다
- **단일 스레드 전용**이다. `Send`를 구현하지 않음
- 수정이 필요하면 `Rc<RefCell<T>>`를 쓴다

## 3. `Arc<T>` - 참조 카운팅 (멀티 스레드)

`Rc`의 스레드 안전 버전. Atomic Reference Counting.

```rust
use std::sync::Arc;
use std::thread;

let data = Arc::new(vec![1, 2, 3]);

let handles: Vec<_> = (0..3).map(|i| {
    let data = Arc::clone(&data);
    thread::spawn(move || {
        println!("스레드 {}: {:?}", i, data);
    })
}).collect();

for h in handles {
    h.join().unwrap();
}
```

### `Rc` vs `Arc`

| 특성 | `Rc<T>` | `Arc<T>` |
|------|---------|----------|
| 스레드 안전 | X | O (atomic 연산) |
| 성능 | 더 빠름 | 약간의 오버헤드 |
| 용도 | 단일 스레드 | 멀티 스레드 |

단일 스레드에서는 `Rc`를 쓰자. `Arc`의 atomic 연산은 불필요한 비용이다.

### `Arc<Mutex<T>>` - 멀티 스레드에서 수정 가능한 공유 데이터

```rust
use std::sync::{Arc, Mutex};
use std::thread;

let counter = Arc::new(Mutex::new(0));

let handles: Vec<_> = (0..10).map(|_| {
    let counter = Arc::clone(&counter);
    thread::spawn(move || {
        let mut num = counter.lock().unwrap();
        *num += 1;
    })
}).collect();

for h in handles {
    h.join().unwrap();
}

println!("결과: {}", *counter.lock().unwrap());  // 10
```

이게 러스트에서 멀티 스레드 공유 상태를 다루는 표준 패턴이다.

## 4. `Rc<RefCell<T>>` - 단일 스레드에서 공유 + 수정

`Rc`는 불변, `RefCell`은 런타임 빌림 검사로 내부 가변성 제공. 둘을 합치면:

```rust
use std::cell::RefCell;
use std::rc::Rc;

#[derive(Debug)]
struct Node {
    value: i32,
    children: RefCell<Vec<Rc<Node>>>,
}

let leaf = Rc::new(Node {
    value: 3,
    children: RefCell::new(vec![]),
});

let branch = Rc::new(Node {
    value: 5,
    children: RefCell::new(vec![Rc::clone(&leaf)]),
});

// 나중에 자식 추가 가능 (branch는 불변인데도!)
branch.children.borrow_mut().push(Rc::new(Node {
    value: 7,
    children: RefCell::new(vec![]),
}));

println!("{:?}", branch);
```

### 조합 패턴 정리

| 패턴 | 소유 | 수정 | 스레드 |
|------|------|------|--------|
| `Box<T>` | 단일 | O | O (Send면) |
| `Rc<T>` | 공유 | X | 단일 |
| `Rc<RefCell<T>>` | 공유 | O (런타임) | 단일 |
| `Arc<T>` | 공유 | X | 멀티 |
| `Arc<Mutex<T>>` | 공유 | O (잠금) | 멀티 |
| `Arc<RwLock<T>>` | 공유 | O (읽기/쓰기 잠금) | 멀티 |

## 5. `Cow<T>` - 필요할 때만 복제

Clone on Write. 읽기만 하면 참조, 수정이 필요하면 그때 복제한다.

```rust
use std::borrow::Cow;

fn process(input: &str) -> Cow<str> {
    if input.contains("bad") {
        // 수정이 필요 → 복제해서 소유
        let cleaned = input.replace("bad", "good");
        Cow::Owned(cleaned)
    } else {
        // 수정 불필요 → 그냥 참조
        Cow::Borrowed(input)
    }
}

let result1 = process("hello");         // Borrowed — 복사 없음
let result2 = process("bad word");      // Owned — 복사 발생
```

대부분의 입력이 수정 불필요할 때 성능 최적화에 유용하다.

## 6. `Weak<T>` - 순환 참조 방지

`Rc`/`Arc`는 순환 참조가 생기면 카운트가 0이 되지 않아 메모리 누수가 발생한다.

```rust
use std::rc::{Rc, Weak};
use std::cell::RefCell;

struct Node {
    value: i32,
    parent: RefCell<Weak<Node>>,      // 부모는 약한 참조
    children: RefCell<Vec<Rc<Node>>>,  // 자식은 강한 참조
}

let parent = Rc::new(Node {
    value: 1,
    parent: RefCell::new(Weak::new()),
    children: RefCell::new(vec![]),
});

let child = Rc::new(Node {
    value: 2,
    parent: RefCell::new(Rc::downgrade(&parent)),  // Weak 참조 생성
    children: RefCell::new(vec![]),
});

parent.children.borrow_mut().push(Rc::clone(&child));

// 부모에 접근 (Weak → Option<Rc>)
if let Some(p) = child.parent.borrow().upgrade() {
    println!("부모 값: {}", p.value);
}
```

| 참조 | 카운트 영향 | 해제 방지 | 접근 |
|------|-----------|----------|------|
| `Rc` (강한) | O | O | 직접 |
| `Weak` (약한) | X | X | `.upgrade()` → `Option<Rc>` |

## 정리

| 스마트 포인터 | 용도 |
|-------------|------|
| `Box<T>` | 힙 할당, 재귀 타입, 트레이트 객체 |
| `Rc<T>` | 단일 스레드 공유 소유권 |
| `Arc<T>` | 멀티 스레드 공유 소유권 |
| `RefCell<T>` | 런타임 내부 가변성 |
| `Mutex<T>` / `RwLock<T>` | 멀티 스레드 내부 가변성 |
| `Cow<T>` | 필요할 때만 복제 |
| `Weak<T>` | 순환 참조 방지 |

소유권 시리즈를 정리하면:
1. **소유권** — 값에는 하나의 주인
2. **빌림** — 소유권 이전 없이 참조
3. **라이프타임** — 참조의 유효 범위
4. **스마트 포인터** — 소유권 규칙을 유연하게

이 4가지를 이해하면 러스트의 메모리 관리를 완전히 이해한 것이다.
