---
title: "[Rust 클로저 시리즈] 04. 클로저 고급 패턴"
author: anonymous.rs
date: 2025-12-25
tags: ["rust", "closure", "advanced", "HRTB", "impl-fn", "dyn-fn", "lifetime", "성능"]
---

# 클로저 고급 패턴

## 한 줄 요약

클로저를 반환하고, 저장하고, 라이프타임과 결합하는 **고급 패턴**을 다룬다.

## 1. 클로저 반환하기

### `impl Fn` — 정적 디스패치

```rust
fn make_adder(x: i32) -> impl Fn(i32) -> i32 {
    move |y| x + y
}

let add5 = make_adder(5);
println!("{}", add5(3));  // 8
```

`impl Fn(...)`은 "구체적인 타입은 숨기지만 `Fn` 트레이트를 구현한 뭔가를 반환한다"는 뜻이다. 컴파일러가 실제 타입을 알고 있어 인라이닝이 가능하다.

### `impl Fn`의 제약: 조건부 반환 불가

```rust
// 컴파일 에러! 두 클로저는 서로 다른 타입
fn make_op(add: bool) -> impl Fn(i32) -> i32 {
    if add {
        |x| x + 1   // 타입 A
    } else {
        |x| x * 2   // 타입 B — A와 다른 타입!
    }
}
```

`impl Fn`은 **하나의 구체적 타입**만 반환할 수 있다. 분기에 따라 다른 클로저를 반환해야 하면 `Box<dyn Fn>`을 써야 한다.

### `Box<dyn Fn>` — 동적 디스패치

```rust
fn make_op(add: bool) -> Box<dyn Fn(i32) -> i32> {
    if add {
        Box::new(|x| x + 1)
    } else {
        Box::new(|x| x * 2)
    }
}

let op = make_op(true);
println!("{}", op(5));  // 6
```

힙 할당 + vtable 호출 오버헤드가 있지만, 런타임에 다른 클로저를 선택할 수 있다.

### `impl Fn` vs `Box<dyn Fn>` 선택

| 특성 | `impl Fn` | `Box<dyn Fn>` |
|------|-----------|--------------|
| 메모리 | 스택 (제로 코스트) | 힙 할당 |
| 디스패치 | 정적 (인라이닝 가능) | 동적 (vtable) |
| 조건부 반환 | 불가 | 가능 |
| 컬렉션 저장 | 불가 | 가능 |
| 성능 | 최적 | 약간의 오버헤드 |

## 2. 클로저를 컬렉션에 저장하기

서로 다른 클로저는 서로 다른 타입이므로, `Vec`에 넣으려면 `Box<dyn Fn>`이 필요하다.

```rust
let handlers: Vec<Box<dyn Fn(i32) -> i32>> = vec![
    Box::new(|x| x + 1),
    Box::new(|x| x * 2),
    Box::new(|x| x * x),
];

for (i, handler) in handlers.iter().enumerate() {
    println!("handler[{}](5) = {}", i, handler(5));
}
// handler[0](5) = 6
// handler[1](5) = 10
// handler[2](5) = 25
```

### 이벤트 시스템

```rust
use std::collections::HashMap;

struct EventEmitter {
    listeners: HashMap<String, Vec<Box<dyn Fn(&str)>>>,
}

impl EventEmitter {
    fn new() -> Self {
        EventEmitter { listeners: HashMap::new() }
    }

    fn on(&mut self, event: &str, callback: impl Fn(&str) + 'static) {
        self.listeners
            .entry(event.to_string())
            .or_default()
            .push(Box::new(callback));
    }

    fn emit(&self, event: &str, data: &str) {
        if let Some(callbacks) = self.listeners.get(event) {
            for cb in callbacks {
                cb(data);
            }
        }
    }
}

fn main() {
    let mut emitter = EventEmitter::new();

    emitter.on("click", |data| println!("클릭 핸들러 1: {}", data));
    emitter.on("click", |data| println!("클릭 핸들러 2: {}", data));
    emitter.on("hover", |data| println!("호버: {}", data));

    emitter.emit("click", "버튼A");
    // 클릭 핸들러 1: 버튼A
    // 클릭 핸들러 2: 버튼A
}
```

## 3. 클로저와 라이프타임

### 참조를 캡처하는 클로저의 수명

```rust
fn make_printer(s: &str) -> impl Fn() + '_ {
    move || println!("{}", s)
}

fn main() {
    let msg = String::from("hello");
    let print = make_printer(&msg);
    print();  // OK
    // drop(msg); print();  // msg를 drop하면 print도 사용 불가
}
```

`+ '_`는 "반환하는 클로저의 수명은 입력 참조의 수명과 같다"는 뜻이다.

### 명시적 라이프타임

```rust
fn make_filter<'a>(threshold: &'a i32) -> impl Fn(&i32) -> bool + 'a {
    move |x| x > threshold
}

fn main() {
    let min = 5;
    let is_big = make_filter(&min);

    let numbers = vec![1, 3, 5, 7, 9];
    let big: Vec<_> = numbers.iter().filter(|x| is_big(x)).collect();
    println!("{:?}", big);  // [7, 9]
}
```

## 4. Higher-Ranked Trait Bounds (HRTB)

`for<'a>`는 "**모든 라이프타임 `'a`에 대해**" 성립해야 한다는 뜻이다. 클로저가 참조를 받을 때 자주 등장한다.

### 문제 상황

```rust
// 이 함수는 "참조를 받아서 뭔가 하는 클로저"를 받고 싶다
fn apply_to_ref<F>(f: F)
where
    F: Fn(&str),  // 이게 사실은 for<'a> Fn(&'a str) 와 같다
{
    let owned = String::from("hello");
    f(&owned);
}
```

`Fn(&str)`은 컴파일러가 자동으로 `for<'a> Fn(&'a str)`로 해석한다. "어떤 라이프타임의 `&str`이든 받을 수 있어야 한다"는 뜻이다.

### 명시적 HRTB

```rust
fn apply_twice<F>(f: F)
where
    F: for<'a> Fn(&'a str) -> &'a str,
{
    let s1 = String::from("hello");
    let s2 = String::from("world");

    println!("{}", f(&s1));
    println!("{}", f(&s2));
}

fn main() {
    apply_twice(|s| &s[..3]);  // "hel", "wor"
}
```

`for<'a> Fn(&'a str) -> &'a str`는 "어떤 수명의 `&str`을 받든, 그와 같은 수명의 `&str`을 반환한다"는 의미다.

### HRTB가 필요한 실전 사례

```rust
// 파서 콤비네이터
fn map_parser<'input, P, F, A, B>(parser: P, f: F) -> impl Fn(&'input str) -> Option<B>
where
    P: Fn(&'input str) -> Option<A>,
    F: Fn(A) -> B,
{
    move |input| parser(input).map(|a| f(a))
}

// 정렬 비교자를 받는 함수
fn sort_with<T, F>(slice: &mut [T], compare: F)
where
    F: for<'a> Fn(&'a T, &'a T) -> std::cmp::Ordering,
{
    slice.sort_by(|a, b| compare(a, b));
}
```

## 5. 재귀 클로저

클로저는 직접적으로 자기 자신을 호출할 수 없다. 몇 가지 우회법이 있다.

### 함수로 추출

가장 간단한 해결책. 재귀가 필요하면 클로저 대신 함수를 쓴다.

```rust
fn factorial(n: u64) -> u64 {
    if n <= 1 { 1 } else { n * factorial(n - 1) }
}
```

### 클로저를 인자로 넘기기

```rust
fn fix<F, T>(f: &F, n: T) -> T
where
    F: Fn(&dyn Fn(T) -> T, T) -> T,
    T: Copy,
{
    f(&|x| fix(f, x), n)
}

fn main() {
    let factorial = |recurse: &dyn Fn(u64) -> u64, n: u64| -> u64 {
        if n <= 1 { 1 } else { n * recurse(n - 1) }
    };

    println!("{}", fix(&factorial, 10));  // 3628800
}
```

이건 Y 콤비네이터의 변형이다. FP 이론적으로는 흥미롭지만, 실전에서는 그냥 함수를 쓰는 게 낫다.

## 6. 클로저와 async

async 블록도 일종의 클로저다. `Future`를 반환하는 클로저를 다룰 때 특수한 패턴이 필요하다.

```rust
use std::future::Future;

// async 클로저를 받는 함수
async fn retry<F, Fut, T, E>(f: F, max_attempts: usize) -> Result<T, E>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T, E>>,
{
    let mut last_err = None;
    for _ in 0..max_attempts {
        match f().await {
            Ok(val) => return Ok(val),
            Err(e) => last_err = Some(e),
        }
    }
    Err(last_err.unwrap())
}

// 사용
async fn fetch_data() -> Result<String, String> {
    // ...
    Ok("data".into())
}

// retry(|| fetch_data(), 3).await;
```

### async 클로저 (nightly / 2024 edition)

```rust
// 안정화 진행 중
let fetch = async |url: &str| -> Result<String, Error> {
    reqwest::get(url).await?.text().await
};
```

현재는 `|| async { ... }` 패턴으로 우회한다.

```rust
let fetch = |url: String| async move {
    // url을 move로 캡처
    reqwest::get(&url).await
};
```

## 7. 성능: 클로저는 정말 제로 코스트인가

### 정적 디스패치 — 제로 코스트

```rust
fn apply<F: Fn(i32) -> i32>(f: F, x: i32) -> i32 {
    f(x)
}

let result = apply(|x| x * 2, 5);
```

컴파일러는 이걸 이렇게 최적화한다:

```rust
// 인라이닝 후 (개념적)
let result = 5 * 2;  // 함수 호출 자체가 사라짐
```

제네릭 + 클로저 = **모노모피제이션** → 각 클로저마다 특화된 코드가 생성됨 → 인라이닝 가능 → 함수 호출 오버헤드 0.

### 동적 디스패치 — 약간의 비용

```rust
fn apply(f: &dyn Fn(i32) -> i32, x: i32) -> i32 {
    f(x)
}
```

vtable을 통한 간접 호출. 인라이닝 불가. 하지만 실제 오버헤드는 나노초 수준이다.

### 벤치마크 가이드

```
제네릭 (impl Fn)  ≈ 일반 함수 호출  ≈ 인라이닝 가능    → 최적
Box<dyn Fn>       ≈ vtable 호출     ≈ 힙 할당 1회     → 보통
&dyn Fn           ≈ vtable 호출     ≈ 힙 할당 없음    → 보통
```

99%의 경우 성능 차이는 무시할 수 있다. 핫 루프에서 나노초가 중요한 경우에만 `impl Fn`을 고집하면 된다.

## 8. 고급 패턴: 클로저로 빌더

```rust
struct QueryBuilder {
    filters: Vec<Box<dyn Fn(&Record) -> bool>>,
    transforms: Vec<Box<dyn Fn(Record) -> Record>>,
}

impl QueryBuilder {
    fn new() -> Self {
        QueryBuilder {
            filters: Vec::new(),
            transforms: Vec::new(),
        }
    }

    fn where_clause(mut self, predicate: impl Fn(&Record) -> bool + 'static) -> Self {
        self.filters.push(Box::new(predicate));
        self
    }

    fn map(mut self, transform: impl Fn(Record) -> Record + 'static) -> Self {
        self.transforms.push(Box::new(transform));
        self
    }

    fn execute(self, data: Vec<Record>) -> Vec<Record> {
        data.into_iter()
            .filter(|record| self.filters.iter().all(|f| f(record)))
            .map(|mut record| {
                for transform in &self.transforms {
                    record = transform(record);
                }
                record
            })
            .collect()
    }
}

// 사용
let results = QueryBuilder::new()
    .where_clause(|r| r.age > 18)
    .where_clause(|r| r.active)
    .map(|mut r| { r.name = r.name.to_uppercase(); r })
    .execute(records);
```

## 9. `fn` 포인터와 클로저의 통합

함수 포인터 타입 `fn`도 `Fn`, `FnMut`, `FnOnce`를 구현한다.

```rust
fn double(x: i32) -> i32 { x * 2 }

// fn 포인터를 Fn을 요구하는 곳에 넘길 수 있다
let v: Vec<i32> = (1..=5).map(double as fn(i32) -> i32).collect();

// 또는 그냥
let v: Vec<i32> = (1..=5).map(double).collect();

// fn 포인터 배열 (같은 타입이므로 Box 불필요)
let ops: [fn(i32) -> i32; 3] = [
    |x| x + 1,
    |x| x * 2,
    |x| x * x,
];
```

캡처가 없는 클로저는 `fn` 포인터로 변환 가능하다. `fn` 포인터 배열은 `Box` 없이 컬렉션에 넣을 수 있어서, 캡처가 필요 없다면 이쪽이 더 효율적이다.

## 정리

| 패턴 | 용도 |
|------|------|
| `impl Fn` 반환 | 정적 디스패치, 제로 코스트 반환 |
| `Box<dyn Fn>` 반환 | 조건부 반환, 컬렉션 저장 |
| 라이프타임 + 클로저 | 참조를 캡처하는 클로저의 수명 명시 |
| HRTB (`for<'a>`) | 모든 라이프타임에 대해 성립하는 바운드 |
| async + 클로저 | `Fn() -> impl Future` 패턴 |
| `fn` 포인터 | 캡처 없는 클로저의 경량 대안 |

## 시리즈 정리

1. **클로저란 무엇인가** — 역사, 다른 언어 비교, 기본 문법, 익명 타입
2. **캡처와 Fn 트레이트** — &, &mut, move 캡처, Fn/FnMut/FnOnce 계층
3. **클로저와 FP** — 커링, 합성, STD API 활용, 이터레이터 체이닝
4. **고급 패턴** — 반환, 저장, 라이프타임, HRTB, async, 성능

러스트의 클로저는 GC 언어의 편리함과 C++의 성능을 동시에 달성한다. 소유권 시스템 덕분에 안전성까지. 이것이 "제로 코스트 추상화"의 실체다.
