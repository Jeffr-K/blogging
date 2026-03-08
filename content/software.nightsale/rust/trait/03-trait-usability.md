---
title: "[Rust 트레이트 시리즈] 03. 트레이트 고급 활용"
author: anonymous.rs
date: 2025-12-29
tags: ["rust", "trait", "고급", "associated-type", "generic"]
---

# 트레이트 고급 활용

기본적인 트레이트 사용법을 넘어서, 실전에서 마주치는 고급 패턴들을 정리한다.

## 1. 연관 타입 (Associated Type)

제네릭과 비슷하지만, 트레이트 구현 시 타입이 **하나로 고정**된다.

```rust
trait Iterator {
    type Item;  // 연관 타입
    fn next(&mut self) -> Option<Self::Item>;
}

struct Counter {
    count: u32,
}

impl Iterator for Counter {
    type Item = u32;  // Counter의 Item은 u32로 고정
    
    fn next(&mut self) -> Option<Self::Item> {
        self.count += 1;
        Some(self.count)
    }
}
```

### 제네릭과의 차이

```rust
// 제네릭: 하나의 타입에 여러 구현 가능
trait From<T> {
    fn from(value: T) -> Self;
}

impl From<i32> for String { /* ... */ }
impl From<bool> for String { /* ... */ }  // 둘 다 가능

// 연관 타입: 하나의 타입에 하나의 구현만
trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
}
// Counter는 Item이 u32로 고정됨. i32로 또 구현 불가능.
```

연관 타입은 "이 타입의 Iterator는 뭘 뱉는지 **유일하게** 정해져 있다"를 표현할 때 쓴다.

## 2. 제네릭 트레이트 vs 연관 타입 선택 기준

| 상황 | 선택 |
|------|------|
| 한 타입에 여러 구현이 필요하다 | 제네릭 (`trait Foo<T>`) |
| 한 타입에 하나의 구현만 있어야 한다 | 연관 타입 (`type Item`) |
| 호출 시 타입 명시가 필요하다 | 제네릭 |
| 타입 추론이 자연스럽다 | 연관 타입 |

## 3. 기본 타입 파라미터

제네릭에 기본값을 줄 수 있다.

```rust
trait Add<Rhs = Self> {  // 기본값: 자기 자신
    type Output;
    fn add(self, rhs: Rhs) -> Self::Output;
}

struct Point { x: i32, y: i32 }

// Rhs를 생략하면 Self(Point)가 됨
impl Add for Point {
    type Output = Point;
    fn add(self, other: Point) -> Point {
        Point { x: self.x + other.x, y: self.y + other.y }
    }
}
```

대부분의 경우 같은 타입끼리 더하니까 기본값으로 `Self`를 줘서 편하게 쓸 수 있다.

## 4. 완전 정규화 문법 (Fully Qualified Syntax)

같은 이름의 메서드가 여러 트레이트에 있을 때, 어떤 걸 호출할지 명시한다.

```rust
trait Pilot {
    fn fly(&self);
}

trait Wizard {
    fn fly(&self);
}

struct Human;

impl Pilot for Human {
    fn fly(&self) { println!("기장입니다"); }
}

impl Wizard for Human {
    fn fly(&self) { println!("레비오사~"); }
}

impl Human {
    fn fly(&self) { println!("팔을 흔듦"); }
}

fn main() {
    let person = Human;
    
    person.fly();              // "팔을 흔듦" (고유 메서드)
    Pilot::fly(&person);       // "기장입니다"
    Wizard::fly(&person);      // "레비오사~"
    
    // 완전 정규화 문법
    <Human as Pilot>::fly(&person);
    <Human as Wizard>::fly(&person);
}
```

연관 함수(self 없는 함수)에서는 완전 정규화가 필수다.

```rust
trait Animal {
    fn name() -> String;
}

struct Dog;

impl Animal for Dog {
    fn name() -> String { String::from("멍멍이") }
}

// Dog::name()은 모호할 수 있음
// 명확하게:
let name = <Dog as Animal>::name();
```

## 5. Blanket Implementation

"특정 트레이트를 구현한 모든 타입에 대해 자동으로 다른 트레이트도 구현해준다"

```rust
// 표준 라이브러리의 실제 예시
impl<T: Display> ToString for T {
    fn to_string(&self) -> String {
        format!("{}", self)
    }
}
```

`Display`를 구현한 모든 타입은 자동으로 `ToString`도 갖게 된다. 그래서 `.to_string()` 메서드를 바로 쓸 수 있는 것이다.

직접 만들어보면:

```rust
trait Describable {
    fn describe(&self) -> String;
}

// Debug를 구현한 모든 타입에 Describable 자동 구현
impl<T: Debug> Describable for T {
    fn describe(&self) -> String {
        format!("디버그 출력: {:?}", self)
    }
}
```

## 6. 트레이트 바운드에서의 라이프타임

트레이트 바운드와 라이프타임을 함께 쓸 때:

```rust
// 참조를 포함하지 않는 타입만 받음
fn spawn_thread<T: Send + 'static>(data: T) {
    std::thread::spawn(move || {
        // data 사용
    });
}

// 특정 라이프타임 동안 유효한 참조를 가진 타입
fn process<'a, T: Debug + 'a>(item: &'a T) {
    println!("{:?}", item);
}
```

`'static`은 "이 타입은 임시 참조를 포함하지 않는다"를 의미한다. 스레드로 데이터를 보낼 때 필수다.

## 7. 객체 안전성 (Object Safety)

모든 트레이트가 `dyn Trait`로 쓸 수 있는 건 아니다.

### 객체 안전하지 않은 경우

```rust
trait NotObjectSafe {
    fn returns_self() -> Self;           // Self 반환 불가
    fn generic_method<T>(&self, x: T);   // 제네릭 메서드 불가
}
```

`dyn NotObjectSafe`는 컴파일 에러난다. 런타임에 구체적인 타입 크기를 알 수 없기 때문이다.

### 객체 안전한 트레이트

```rust
trait ObjectSafe {
    fn do_something(&self);
    fn do_another(&self, x: i32) -> String;
}

// 이건 됨
let obj: Box<dyn ObjectSafe> = Box::new(MyType);
```

규칙: `Self`를 반환하거나, 제네릭 메서드가 있으면 객체 안전하지 않다.

## 정리

| 개념 | 용도 |
|------|------|
| 연관 타입 | 타입당 하나의 구현만 허용 |
| 기본 타입 파라미터 | 제네릭 기본값 제공 |
| 완전 정규화 문법 | 메서드 충돌 해결 |
| Blanket Implementation | 조건부 자동 구현 |
| 객체 안전성 | `dyn Trait` 사용 가능 여부 |

이 정도 알면 러스트 트레이트의 대부분을 이해한 것이다. 다음 글부터는 `Send`, `Sync` 같은 마커 트레이트를 다룰 예정이다.
