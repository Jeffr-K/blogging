---
title: "[Rust 클로저 시리즈] 03. 클로저와 함수형 프로그래밍"
author: anonymous.rs
date: 2025-12-24
tags: ["rust", "closure", "fp", "iterator", "함수형", "고차함수", "STD"]
---

# 클로저와 함수형 프로그래밍

## 한 줄 요약

클로저는 함수형 프로그래밍의 **핵심 재료**다. 러스트는 이터레이터 API를 통해 FP 스타일을 자연스럽게 지원한다.

## FP에서 클로저가 꼭 필요한가

결론부터: **그렇다.** 클로저 없이 FP는 성립하지 않는다.

함수형 프로그래밍의 핵심 개념 3가지:

1. **일급 함수 (First-class function)** — 함수를 값처럼 변수에 넣고, 인자로 넘기고, 반환할 수 있다
2. **고차 함수 (Higher-order function)** — 함수를 받거나 반환하는 함수
3. **환경 캡처** — 함수가 정의된 시점의 변수를 기억

1, 2는 함수 포인터만으로도 가능하다. 하지만 3은 **클로저 없이 불가능**하다.

```rust
// 함수 포인터로는 이게 안 된다
fn make_multiplier(factor: i32) -> ??? {
    // factor를 기억하는 함수를 반환하고 싶지만,
    // 일반 함수는 외부 변수를 캡처할 수 없다
}

// 클로저로는 된다
fn make_multiplier(factor: i32) -> impl Fn(i32) -> i32 {
    move |x| x * factor  // factor를 캡처
}
```

### 커링(Currying)

FP의 대표적 기법. 다인자 함수를 단인자 함수의 연쇄로 바꾼다.

```rust
// add(a, b) → add(a)(b)
fn add(a: i32) -> impl Fn(i32) -> i32 {
    move |b| a + b
}

let add5 = add(5);
let add10 = add(10);

println!("{}", add5(3));   // 8
println!("{}", add10(3));  // 13
```

이건 클로저 없이는 표현할 수 없다. `a`를 기억하는 함수를 반환해야 하니까.

### 합성(Composition)

함수를 조합해서 새 함수를 만든다.

```rust
fn compose<A, B, C>(
    f: impl Fn(A) -> B,
    g: impl Fn(B) -> C,
) -> impl Fn(A) -> C {
    move |x| g(f(x))
}

let double = |x: i32| x * 2;
let add_one = |x: i32| x + 1;

let double_then_add = compose(double, add_one);
println!("{}", double_then_add(5));  // 11 = (5 * 2) + 1
```

## 표준 라이브러리의 클로저 활용 API

러스트 표준 라이브러리는 클로저를 매개변수로 받는 API가 매우 많다. 카테고리별로 정리한다.

### Iterator 메서드

이터레이터 시리즈에서 다뤘지만, 클로저 관점에서 다시 보자.

```rust
let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// map: 각 요소 변환 (FnMut)
let squared: Vec<i32> = numbers.iter()
    .map(|&x| x * x)
    .collect();

// filter: 조건으로 거르기 (FnMut)
let evens: Vec<&i32> = numbers.iter()
    .filter(|&&x| x % 2 == 0)
    .collect();

// fold: 누적 (FnMut)
let sum = numbers.iter()
    .fold(0, |acc, &x| acc + x);

// for_each: 부수효과 실행 (FnMut)
numbers.iter()
    .for_each(|x| println!("{}", x));

// find: 첫 번째 매칭 (FnMut)
let first_big = numbers.iter()
    .find(|&&x| x > 5);

// any / all: 조건 확인 (FnMut)
let has_ten = numbers.iter().any(|&x| x == 10);
let all_positive = numbers.iter().all(|&x| x > 0);

// partition: 조건으로 둘로 나누기 (FnMut)
let (evens, odds): (Vec<i32>, Vec<i32>) = numbers.iter()
    .partition(|&&x| x % 2 == 0);

// flat_map: map + flatten (FnMut)
let words = vec!["hello world", "foo bar"];
let chars: Vec<char> = words.iter()
    .flat_map(|s| s.chars())
    .collect();

// take_while / skip_while (FnMut)
let prefix: Vec<&i32> = numbers.iter()
    .take_while(|&&x| x < 5)
    .collect();
```

모든 이터레이터 어댑터가 클로저를 받는다. 이것이 러스트에서 FP 스타일 코딩이 자연스러운 이유다.

### Option / Result 메서드

```rust
// map: 값이 있으면 변환
let name: Option<String> = Some("ferris".into());
let upper = name.map(|s| s.to_uppercase());  // Some("FERRIS")

// and_then: 체이닝 (flatMap)
let port: Option<u16> = Some("8080")
    .and_then(|s| s.parse().ok());  // Some(8080)

// unwrap_or_else: 기본값을 클로저로 (지연 평가)
let config = load_config()
    .unwrap_or_else(|_| Config::default());

// map_err: 에러 변환
let result: Result<i32, String> = "42".parse::<i32>()
    .map_err(|e| format!("파싱 에러: {}", e));

// ok_or_else: Option → Result 변환
let name: Option<&str> = Some("ferris");
let result: Result<&str, String> = name
    .ok_or_else(|| "이름이 없음".to_string());
```

### 정렬과 비교

```rust
let mut students = vec![
    ("Alice", 95),
    ("Bob", 72),
    ("Charlie", 88),
];

// sort_by: 커스텀 비교 (FnMut)
students.sort_by(|a, b| b.1.cmp(&a.1));  // 점수 내림차순

// sort_by_key: 키 추출 (FnMut)
students.sort_by_key(|&(_, score)| std::cmp::Reverse(score));

// min_by / max_by (FnMut)
let best = students.iter()
    .max_by(|a, b| a.1.cmp(&b.1));

// min_by_key / max_by_key (FnMut)
let worst = students.iter()
    .min_by_key(|&&(_, score)| score);

// dedup_by: 연속 중복 제거 (FnMut)
let mut v = vec![1, 1, 2, 3, 3, 3, 4];
v.dedup_by(|a, b| a == b);  // [1, 2, 3, 4]
```

### 스레드와 비동기

```rust
use std::thread;

// thread::spawn (FnOnce + Send + 'static)
let handle = thread::spawn(|| {
    42
});
let result = handle.join().unwrap();

// 스코프 스레드 (FnOnce + Send)
thread::scope(|s| {
    let data = vec![1, 2, 3];
    s.spawn(|| println!("{:?}", data));
    s.spawn(|| println!("다른 작업"));
});
```

### HashMap 엔트리 API

```rust
use std::collections::HashMap;

let mut map = HashMap::new();

// or_insert_with: 없을 때만 클로저 실행 (FnOnce — 지연 초기화)
map.entry("key")
    .or_insert_with(|| expensive_default_value());

// and_modify: 있을 때 수정 (FnOnce)
map.entry("counter")
    .and_modify(|v| *v += 1)
    .or_insert(1);
```

### 초기화와 지연 평가

```rust
use std::sync::OnceLock;

// OnceLock: 전역 지연 초기화
static CONFIG: OnceLock<Config> = OnceLock::new();

fn get_config() -> &'static Config {
    CONFIG.get_or_init(|| {
        Config::load("config.toml").unwrap()
    })
}
```

## 클로저로 전략 패턴

OOP의 전략 패턴을 클로저로 깔끔하게 표현할 수 있다.

```rust
struct Processor<F: Fn(i32) -> i32> {
    transform: F,
}

impl<F: Fn(i32) -> i32> Processor<F> {
    fn process(&self, data: &[i32]) -> Vec<i32> {
        data.iter().map(|&x| (self.transform)(x)).collect()
    }
}

fn main() {
    let doubler = Processor { transform: |x| x * 2 };
    let squarer = Processor { transform: |x| x * x };

    let data = vec![1, 2, 3, 4, 5];
    println!("{:?}", doubler.process(&data));  // [2, 4, 6, 8, 10]
    println!("{:?}", squarer.process(&data));  // [1, 4, 9, 16, 25]
}
```

### 미들웨어 패턴

```rust
type Middleware = Box<dyn Fn(&str) -> String>;

fn logging(next: Middleware) -> Middleware {
    Box::new(move |input| {
        println!("[LOG] 입력: {}", input);
        let result = next(input);
        println!("[LOG] 출력: {}", result);
        result
    })
}

fn uppercase(_next: Middleware) -> Middleware {
    Box::new(|input| input.to_uppercase())
}

fn main() {
    let base: Middleware = Box::new(|s| s.to_string());
    let pipeline = logging(Box::new(move |input: &str| {
        input.to_uppercase()
    }));

    pipeline("hello");
    // [LOG] 입력: hello
    // [LOG] 출력: HELLO
}
```

## 클로저 vs 함수 포인터 — 언제 무엇을

```rust
// 함수 포인터: 캡처가 필요 없을 때
fn double(x: i32) -> i32 { x * 2 }

let v: Vec<i32> = (1..=5).map(double).collect();  // 함수 이름으로 전달

// 클로저: 캡처가 필요할 때
let factor = 3;
let v: Vec<i32> = (1..=5).map(|x| x * factor).collect();
```

캡처가 없는 클로저는 함수 포인터로 변환할 수 있다.

```rust
let add_one: fn(i32) -> i32 = |x| x + 1;  // OK — 캡처 없음

let factor = 2;
// let mul: fn(i32) -> i32 = |x| x * factor;  // 에러! 캡처 있음
```

| 상황 | 선택 |
|------|------|
| 환경 캡처 필요 없음 | 함수 포인터 (`fn`) 또는 클로저 |
| 환경 캡처 필요 | 클로저만 가능 |
| FFI (C 콜백) | 함수 포인터 (`fn`) |
| 제네릭 API | 클로저 (트레이트 바운드) |

## 실전: 이터레이터 체이닝으로 데이터 파이프라인

```rust
#[derive(Debug)]
struct LogEntry {
    level: String,
    message: String,
    timestamp: u64,
}

fn analyze_logs(logs: &[LogEntry]) -> Vec<String> {
    logs.iter()
        .filter(|log| log.level == "ERROR")           // 에러만
        .filter(|log| log.timestamp > 1000)            // 최근 것만
        .map(|log| format!("[{}] {}", log.timestamp, log.message))  // 포맷팅
        .take(10)                                      // 최대 10개
        .collect()
}
```

각 단계의 클로저가 하나의 책임만 가진다. 읽기 쉽고, 테스트하기 쉽고, 수정하기 쉽다.

## 정리

| FP 개념 | 러스트에서 | 클로저 필요 여부 |
|---------|----------|---------------|
| 일급 함수 | 함수 포인터 + 클로저 | 부분적 |
| 고차 함수 | `map`, `filter`, `fold` 등 | 필수 |
| 커링 | `move \|x\| move \|y\| ...` | 필수 |
| 합성 | `compose(f, g)` | 필수 |
| 지연 평가 | 이터레이터 어댑터 | 필수 |
| 전략 패턴 | `Fn` 트레이트 바운드 | 필수 |

- 클로저 없이 FP는 불완전하다. 환경 캡처가 FP의 핵심이기 때문이다
- 러스트 표준 라이브러리는 Iterator, Option, Result 전반에 걸쳐 클로저 기반 API를 제공한다
- 이터레이터 체이닝은 러스트에서 가장 자연스러운 FP 스타일이다

다음 글에서는 클로저의 **고급 패턴** — 반환 타입, 동적 디스패치, HRTB, 클로저와 라이프타임을 다룬다.
