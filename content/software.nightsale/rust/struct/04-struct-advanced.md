---
title: "[Rust 구조체 시리즈] 04. 구조체 심화 - 라이프타임, 내부 가변성, 자기 참조"
author: anonymous.rs
date: 2025-12-30
tags: ["rust", "struct", "라이프타임", "내부가변성", "cell", "pin", "심화"]
---

# 구조체 심화 - 라이프타임, 내부 가변성, 자기 참조

03에서 구조체의 실전 패턴을 다뤘다. 이번 글에서는 구조체를 쓰다가 벽에 부딪히는 순간들과 그 해결법을 다룬다.

## 1. 라이프타임이 있는 구조체

구조체 필드에 참조를 넣으려면 **라이프타임**을 명시해야 한다.

```rust
// 컴파일 에러! 참조의 수명을 알 수 없음
// struct Excerpt {
//     text: &str,
// }

// 라이프타임 명시
struct Excerpt<'a> {
    text: &'a str,
}

fn main() {
    let novel = String::from("Call me Ishmael. Some years ago...");
    let first_sentence = novel.split('.').next().unwrap();

    let excerpt = Excerpt { text: first_sentence };
    println!("{}", excerpt.text);
}
```

`'a`의 의미: "이 구조체는 `text`가 가리키는 데이터보다 **오래 살 수 없다**"

### 라이프타임이 여러 개일 때

```rust
struct Pair<'a, 'b> {
    first: &'a str,
    second: &'b str,
}
```

각 참조가 서로 다른 수명을 가질 수 있다는 걸 컴파일러에게 알려주는 것이다.

### 언제 참조 필드를 쓰는가

| 상황 | 선택 |
|------|------|
| 구조체가 데이터를 소유해야 한다 | `String`, `Vec<T>` 등 소유 타입 |
| 잠깐 빌려서 읽기만 한다 | `&str`, `&[T]` 등 참조 + 라이프타임 |
| 확실하지 않다 | 소유 타입으로 시작하고 나중에 최적화 |

초보 때 라이프타임과 싸우느라 시간을 낭비하는 경우가 많다. 우선 `String`으로 쓰고, 성능이 문제가 될 때 참조로 바꿔도 늦지 않다.

## 2. 내부 가변성 (Interior Mutability)

러스트의 빌림 규칙은 "불변 참조가 있으면 가변 참조를 만들 수 없다"이다. 하지만 현실에서는 불변 인터페이스 뒤에서 내부 상태를 바꿔야 할 때가 있다. 이때 `Cell`과 `RefCell`을 쓴다.

### `Cell<T>` - Copy 타입의 내부 가변성

```rust
use std::cell::Cell;

struct Counter {
    count: Cell<u32>,
}

impl Counter {
    fn new() -> Self {
        Counter { count: Cell::new(0) }
    }

    // &self인데도 count를 바꿀 수 있다
    fn increment(&self) {
        self.count.set(self.count.get() + 1);
    }

    fn get(&self) -> u32 {
        self.count.get()
    }
}

fn main() {
    let counter = Counter::new();
    counter.increment();
    counter.increment();
    println!("{}", counter.get());  // 2
}
```

`&self`(불변 참조)인데 내부 값을 바꿨다. `Cell`은 값을 통째로 복사(get)하고 교체(set)하는 방식이라 `Copy` 타입에만 쓸 수 있다.

### `RefCell<T>` - 런타임 빌림 검사

`Copy`가 아닌 타입에 내부 가변성이 필요하면 `RefCell`을 쓴다.

```rust
use std::cell::RefCell;

struct Document {
    content: String,
    edit_history: RefCell<Vec<String>>,
}

impl Document {
    fn new(content: &str) -> Self {
        Document {
            content: content.to_string(),
            edit_history: RefCell::new(Vec::new()),
        }
    }

    // &self인데도 edit_history를 수정 가능
    fn record_view(&self) {
        self.edit_history
            .borrow_mut()
            .push(format!("viewed: {}", self.content));
    }

    fn history(&self) -> Vec<String> {
        self.edit_history.borrow().clone()
    }
}
```

주의: `RefCell`은 빌림 규칙을 **런타임**에 검사한다. 규칙을 어기면 컴파일 에러 대신 **패닉**이 발생한다.

```rust
let doc = Document::new("hello");
let borrow1 = doc.edit_history.borrow();
let borrow2 = doc.edit_history.borrow_mut();  // 패닉! 불변 빌림 중에 가변 빌림
```

### `Cell` vs `RefCell` 선택 기준

| 특징 | `Cell<T>` | `RefCell<T>` |
|------|-----------|-------------|
| 대상 타입 | `Copy` 타입만 | 모든 타입 |
| 동작 방식 | 값 복사/교체 | 런타임 빌림 검사 |
| 오버헤드 | 거의 없음 | 빌림 카운터 관리 비용 |
| 패닉 가능성 | 없음 | 빌림 규칙 위반 시 패닉 |
| 스레드 안전 | 아니오 (`!Sync`) | 아니오 (`!Sync`) |

멀티스레드에서는 `Mutex<T>`나 `RwLock<T>`를 쓴다. `Cell`/`RefCell`은 단일 스레드 전용이다.

## 3. 트레이트 객체를 필드로

구조체 필드에 `dyn Trait`을 넣으면 런타임 다형성을 구현할 수 있다.

```rust
trait Logger {
    fn log(&self, message: &str);
}

struct ConsoleLogger;
impl Logger for ConsoleLogger {
    fn log(&self, message: &str) {
        println!("[CONSOLE] {}", message);
    }
}

struct FileLogger {
    path: String,
}
impl Logger for FileLogger {
    fn log(&self, message: &str) {
        println!("[FILE:{}] {}", self.path, message);
    }
}

// Box<dyn Trait>으로 다형성 필드
struct App {
    logger: Box<dyn Logger>,
}

impl App {
    fn run(&self) {
        self.logger.log("앱 시작됨");
    }
}

fn main() {
    let app = App {
        logger: Box::new(ConsoleLogger),
    };
    app.run();

    // 로거만 바꾸면 됨
    let app = App {
        logger: Box::new(FileLogger { path: "/var/log/app.log".into() }),
    };
    app.run();
}
```

의존성 주입 패턴이다. 트레이트 시리즈에서 다뤘던 `Box<dyn Trait>`의 실전 활용이다.

## 4. 자기 참조 구조체 (Self-Referential Struct)

구조체의 한 필드가 같은 구조체의 다른 필드를 참조하는 경우다. 러스트에서 가장 까다로운 주제 중 하나다.

```rust
// 이건 안 된다
// struct SelfRef {
//     data: String,
//     slice: &str,  // data의 일부를 가리키고 싶지만...
// }
```

구조체가 이동(move)하면 `data`의 주소가 바뀌는데, `slice`는 옛날 주소를 가리키게 된다. **댕글링 포인터**다.

### 해결책 1: 인덱스로 저장

참조 대신 위치 정보를 저장한다.

```rust
struct Parsed {
    raw: String,
    name_start: usize,
    name_len: usize,
}

impl Parsed {
    fn name(&self) -> &str {
        &self.raw[self.name_start..self.name_start + self.name_len]
    }
}
```

가장 단순하고 안전한 방법이다.

### 해결책 2: `Pin`으로 이동 방지

`Pin`은 값이 메모리에서 이동하지 않도록 보장한다. 주로 `Future` (async/await)에서 쓰이지만, 자기 참조 구조체에서도 활용된다.

```rust
use std::pin::Pin;
use std::marker::PhantomPinned;

struct SelfRef {
    data: String,
    ptr: *const String,  // data를 가리키는 raw pointer
    _pin: PhantomPinned,  // 이 구조체는 이동 불가능 표시
}

impl SelfRef {
    fn new(data: String) -> Pin<Box<Self>> {
        let s = SelfRef {
            data,
            ptr: std::ptr::null(),
            _pin: PhantomPinned,
        };
        let mut boxed = Box::pin(s);

        // 자기 자신의 data 필드를 가리키도록 설정
        let ptr = &boxed.data as *const String;
        unsafe {
            let mut_ref = Pin::as_mut(&mut boxed);
            Pin::get_unchecked_mut(mut_ref).ptr = ptr;
        }

        boxed
    }
}
```

솔직히 복잡하다. 실전에서는 `pin-project` 같은 크레이트를 쓰거나, 해결책 1처럼 인덱스를 저장하는 게 낫다.

## 5. Zero-Sized Type (ZST) 활용

크기가 0인 타입이다. 메모리를 차지하지 않지만 타입 시스템에서 역할을 한다.

```rust
use std::marker::PhantomData;

// 권한 수준을 타입으로 표현
struct Admin;
struct User;

struct Permission<Role> {
    _role: PhantomData<Role>,
}

impl Permission<Admin> {
    fn delete_everything(&self) {
        println!("전부 삭제됨");
    }
}

impl Permission<User> {
    fn read_only(&self) {
        println!("읽기만 가능");
    }
}

fn main() {
    let admin_perm: Permission<Admin> = Permission { _role: PhantomData };
    admin_perm.delete_everything();
    // admin_perm.read_only();  // 컴파일 에러! Admin에는 없는 메서드

    println!("Permission 크기: {} bytes", std::mem::size_of::<Permission<Admin>>());
    // 출력: Permission 크기: 0 bytes
}
```

런타임 비용 제로로 컴파일 타임 안전성을 얻는다. 03에서 다뤘던 타입 상태 패턴과 같은 원리다.

## 6. 구조체에 클로저 저장하기

클로저를 필드로 가지려면 제네릭이나 트레이트 객체를 써야 한다.

### 제네릭 방식 (정적 디스패치)

```rust
struct Callback<F: Fn(i32) -> i32> {
    func: F,
}

impl<F: Fn(i32) -> i32> Callback<F> {
    fn call(&self, x: i32) -> i32 {
        (self.func)(x)
    }
}

fn main() {
    let cb = Callback { func: |x| x * 2 };
    println!("{}", cb.call(5));  // 10
}
```

### 트레이트 객체 방식 (동적 디스패치)

```rust
struct EventHandler {
    on_click: Box<dyn Fn(i32, i32)>,
    on_hover: Box<dyn Fn(i32, i32)>,
}

impl EventHandler {
    fn click(&self, x: i32, y: i32) {
        (self.on_click)(x, y);
    }
}

fn main() {
    let handler = EventHandler {
        on_click: Box::new(|x, y| println!("클릭: ({}, {})", x, y)),
        on_hover: Box::new(|x, y| println!("호버: ({}, {})", x, y)),
    };
    handler.click(100, 200);
}
```

제네릭 방식은 빠르지만 클로저마다 다른 타입이 되어 유연성이 떨어진다. `Box<dyn Fn(...)>`은 느리지만 같은 필드에 다른 클로저를 넣을 수 있다.

## 정리

| 주제 | 핵심 |
|------|------|
| 라이프타임 구조체 | 참조 필드는 라이프타임 필수. 확실하지 않으면 소유 타입부터 |
| 내부 가변성 | `Cell` (Copy), `RefCell` (일반), `Mutex` (멀티스레드) |
| 트레이트 객체 필드 | `Box<dyn Trait>`으로 의존성 주입 |
| 자기 참조 | 인덱스 저장이 가장 실용적. `Pin`은 복잡함 |
| ZST | 런타임 비용 없이 타입 안전성 확보 |
| 클로저 필드 | 제네릭(빠름) vs `Box<dyn Fn>`(유연) |

이 정도면 러스트 구조체에 대해 대부분을 다룬 것이다. 구조체는 단순한 데이터 묶음이지만, 러스트의 소유권, 트레이트, 제네릭과 결합하면 매우 강력한 추상화 도구가 된다.
