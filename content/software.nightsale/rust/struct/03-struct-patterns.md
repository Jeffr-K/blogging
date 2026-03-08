---
title: "[Rust 구조체 시리즈] 03. 구조체 실전 패턴과 고급 활용"
author: anonymous.rs
date: 2025-12-29
tags: ["rust", "struct", "제네릭", "뉴타입", "빌더", "패턴매칭", "실전"]
---

# 구조체 실전 패턴과 고급 활용

01에서 구조체의 기본 3종류(일반/튜플/유닛)를 다뤘다. 이번 글에서는 실전에서 자주 마주치는 구조체 패턴들을 정리한다.

## 1. 뉴타입 패턴 (Newtype Pattern)

튜플 구조체로 기존 타입을 감싸서 **새로운 의미를 부여**하는 패턴이다.

```rust
struct Meters(f64);
struct Seconds(f64);
struct MetersPerSecond(f64);

fn speed(distance: Meters, time: Seconds) -> MetersPerSecond {
    MetersPerSecond(distance.0 / time.0)
}

fn main() {
    let d = Meters(100.0);
    let t = Seconds(9.58);
    let v = speed(d, t);

    // speed(t, d);  // 컴파일 에러! 순서를 바꾸면 타입이 안 맞음
}
```

그냥 `f64` 두 개를 받으면 거리와 시간을 바꿔 넣어도 컴파일러가 모른다. 뉴타입으로 감싸면 **타입 시스템이 실수를 잡아준다**.

### 뉴타입으로 외부 타입에 트레이트 구현하기

러스트의 고아 규칙(Orphan Rule) 때문에 외부 타입에 외부 트레이트를 직접 구현할 수 없다. 뉴타입으로 우회한다.

```rust
// Vec<String>에 Display를 직접 구현할 수 없다 (둘 다 외부 타입)
// impl Display for Vec<String> { }  // 컴파일 에러!

// 뉴타입으로 감싸면 가능
struct Wrapper(Vec<String>);

impl std::fmt::Display for Wrapper {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "[{}]", self.0.join(", "))
    }
}

fn main() {
    let w = Wrapper(vec!["hello".into(), "world".into()]);
    println!("{}", w);  // [hello, world]
}
```

트레이트 시리즈에서 다뤘던 고아 규칙의 실전 해결책이 바로 이 패턴이다.

## 2. 제네릭 구조체

구조체에 제네릭 타입 파라미터를 붙이면 여러 타입에 대해 재사용할 수 있다.

```rust
struct Point<T> {
    x: T,
    y: T,
}

fn main() {
    let int_point = Point { x: 5, y: 10 };       // Point<i32>
    let float_point = Point { x: 1.0, y: 4.0 };  // Point<f64>
}
```

### 서로 다른 타입의 필드

```rust
struct Point<T, U> {
    x: T,
    y: U,
}

let mixed = Point { x: 5, y: 4.0 };  // Point<i32, f64>
```

### 제네릭 구조체에 트레이트 바운드 걸기

```rust
use std::fmt::Display;

struct Labeled<T: Display> {
    value: T,
    label: String,
}

impl<T: Display> Labeled<T> {
    fn print(&self) {
        println!("{}: {}", self.label, self.value);
    }
}
```

`T: Display`로 제약을 걸면 `Display`를 구현한 타입만 `Labeled`에 넣을 수 있다.

## 3. PhantomData - 타입만 있고 데이터는 없는 필드

제네릭 파라미터를 선언했지만 필드에서 실제로 사용하지 않을 때, 컴파일러가 경고한다. `PhantomData`로 "이 타입 파라미터를 쓰고 있다"고 알려준다.

```rust
use std::marker::PhantomData;

struct Authenticated;
struct Guest;

struct Session<State> {
    user_id: u64,
    _state: PhantomData<State>,
}

impl Session<Guest> {
    fn login(user_id: u64) -> Session<Authenticated> {
        Session {
            user_id,
            _state: PhantomData,
        }
    }
}

impl Session<Authenticated> {
    fn get_secret_data(&self) -> String {
        format!("유저 {}의 비밀 데이터", self.user_id)
    }
}

fn main() {
    let guest = Session::<Guest> { user_id: 0, _state: PhantomData };
    // guest.get_secret_data();  // 컴파일 에러! Guest 상태에는 없는 메서드

    let authed = Session::<Guest>::login(42);
    println!("{}", authed.get_secret_data());  // OK
}
```

이것이 **타입 상태 패턴(Typestate Pattern)**이다. 런타임 검사 없이 컴파일 타임에 상태 전이를 강제한다.

## 4. 구조체와 패턴 매칭

구조체는 `let`이나 `match`에서 분해(destructuring)할 수 있다.

### let으로 분해

```rust
struct Point {
    x: i32,
    y: i32,
}

let p = Point { x: 10, y: 20 };
let Point { x, y } = p;
println!("x: {}, y: {}", x, y);

// 일부 필드만 꺼내기
let Point { x, .. } = p;
println!("x만: {}", x);
```

### match로 분해

```rust
struct Command {
    action: String,
    target: String,
    force: bool,
}

fn execute(cmd: Command) {
    match cmd {
        Command { force: true, ref action, .. } => {
            println!("강제 실행: {}", action);
        }
        Command { ref action, ref target, .. } => {
            println!("{} -> {}", action, target);
        }
    }
}
```

### 함수 파라미터에서 분해

```rust
fn distance_from_origin(&Point { x, y }: &Point) -> f64 {
    ((x * x + y * y) as f64).sqrt()
}
```

## 5. 빌더 패턴 (Builder Pattern)

필드가 많은 구조체를 만들 때, 빌더 패턴으로 가독성을 높인다.

```rust
struct HttpRequest {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
    timeout_ms: u64,
}

struct HttpRequestBuilder {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
    timeout_ms: u64,
}

impl HttpRequestBuilder {
    fn new(url: &str) -> Self {
        HttpRequestBuilder {
            url: url.to_string(),
            method: "GET".to_string(),
            headers: Vec::new(),
            body: None,
            timeout_ms: 30_000,
        }
    }

    fn method(mut self, method: &str) -> Self {
        self.method = method.to_string();
        self
    }

    fn header(mut self, key: &str, value: &str) -> Self {
        self.headers.push((key.to_string(), value.to_string()));
        self
    }

    fn body(mut self, body: &str) -> Self {
        self.body = Some(body.to_string());
        self
    }

    fn timeout(mut self, ms: u64) -> Self {
        self.timeout_ms = ms;
        self
    }

    fn build(self) -> HttpRequest {
        HttpRequest {
            url: self.url,
            method: self.method,
            headers: self.headers,
            body: self.body,
            timeout_ms: self.timeout_ms,
        }
    }
}

fn main() {
    let request = HttpRequestBuilder::new("https://api.example.com/users")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(r#"{"name": "ferris"}"#)
        .timeout(5_000)
        .build();
}
```

메서드 체이닝으로 읽기 좋고, 기본값도 자연스럽게 처리된다.

## 6. 구조체와 열거형의 조합

러스트에서는 구조체와 열거형을 조합해서 복잡한 데이터 모델을 표현한다.

```rust
#[derive(Debug)]
struct Coordinate {
    lat: f64,
    lng: f64,
}

#[derive(Debug)]
enum Shape {
    Circle { center: Coordinate, radius: f64 },
    Rectangle { top_left: Coordinate, bottom_right: Coordinate },
    Polygon { points: Vec<Coordinate> },
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle { radius, .. } => {
            std::f64::consts::PI * radius * radius
        }
        Shape::Rectangle { top_left, bottom_right } => {
            let width = (bottom_right.lng - top_left.lng).abs();
            let height = (top_left.lat - bottom_right.lat).abs();
            width * height
        }
        Shape::Polygon { .. } => {
            todo!("다각형 면적 계산")
        }
    }
}
```

열거형의 각 variant 안에 구조체 형태의 데이터를 넣는 패턴은 러스트에서 매우 자주 쓰인다. `Result<T, E>`, `Option<T>` 같은 표준 라이브러리도 이 구조다.

## 7. 재귀적 구조체

구조체가 자기 자신을 필드로 가져야 할 때가 있다. 트리나 연결 리스트가 대표적이다. 이때 `Box`로 감싸야 한다.

```rust
#[derive(Debug)]
struct TreeNode {
    value: i32,
    left: Option<Box<TreeNode>>,
    right: Option<Box<TreeNode>>,
}

impl TreeNode {
    fn leaf(value: i32) -> Self {
        TreeNode { value, left: None, right: None }
    }

    fn with_children(value: i32, left: TreeNode, right: TreeNode) -> Self {
        TreeNode {
            value,
            left: Some(Box::new(left)),
            right: Some(Box::new(right)),
        }
    }
}

fn main() {
    let tree = TreeNode::with_children(
        1,
        TreeNode::leaf(2),
        TreeNode::with_children(3, TreeNode::leaf(4), TreeNode::leaf(5)),
    );

    println!("{:#?}", tree);
}
```

`Box`가 필요한 이유: 컴파일러는 구조체의 크기를 컴파일 타임에 알아야 한다. 자기 자신을 직접 포함하면 크기가 무한대가 된다. `Box`는 힙 포인터(고정 크기)이므로 이 문제를 해결한다.

## 8. `#[repr]` - 메모리 레이아웃 제어

기본적으로 러스트 컴파일러는 구조체 필드의 순서와 패딩을 자유롭게 최적화한다. FFI나 저수준 작업에서 레이아웃을 직접 제어해야 할 때 `#[repr]`을 쓴다.

```rust
// C 호환 레이아웃 - FFI에서 필수
#[repr(C)]
struct Header {
    version: u8,
    flags: u8,
    length: u32,
}

// 투명 레이아웃 - 뉴타입이 감싸는 타입과 동일한 레이아웃
#[repr(transparent)]
struct Wrapper(u32);

// 크기 지정 정렬
#[repr(align(64))]
struct CacheAligned {
    data: [u8; 64],
}
```

| 속성 | 용도 |
|------|------|
| `#[repr(C)]` | C 언어와 동일한 레이아웃. FFI 필수 |
| `#[repr(transparent)]` | 감싸는 타입과 동일한 ABI. 뉴타입에서 사용 |
| `#[repr(packed)]` | 패딩 제거. 메모리 절약하지만 정렬 위반 주의 |
| `#[repr(align(N))]` | N바이트 정렬 강제. 캐시 라인 최적화 등 |

일반적인 애플리케이션 코드에서는 쓸 일이 거의 없다. FFI, 네트워크 프로토콜, 임베디드 등 저수준 작업에서 필요하다.

## 정리

| 패턴 | 용도 |
|------|------|
| 뉴타입 | 타입 안전성 강화, 고아 규칙 우회 |
| 제네릭 구조체 | 여러 타입에 대해 재사용 |
| PhantomData | 타입 상태 패턴, 미사용 타입 파라미터 |
| 패턴 매칭 | 구조체 분해, 필드 추출 |
| 빌더 패턴 | 복잡한 생성 로직을 가독성 있게 |
| 열거형 조합 | 복잡한 데이터 모델 표현 |
| 재귀적 구조체 | 트리, 연결 리스트 등 자기 참조 구조 |
| `#[repr]` | 메모리 레이아웃 직접 제어 |

구조체 자체는 단순하지만, 이런 패턴들과 결합하면 러스트의 타입 시스템을 최대한 활용할 수 있다.
