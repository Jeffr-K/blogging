---
title: "[Rust 트레이트 시리즈] 02. 트레이트는 어디에 쓰는가"
author: anonymous.rs
date: 2025-12-29
tags: ["rust", "trait", "유스케이스", "실전"]
---

# 트레이트는 어디에 쓰는가

트레이트 문법은 알겠는데, 실제로 어디에 쓰는지 감이 안 올 수 있다. 실전에서 자주 마주치는 패턴들을 정리한다.

## 1. 함수 파라미터 제약

"이 함수는 아무거나 받는 게 아니라, 특정 능력이 있는 타입만 받는다"를 명시할 때 쓴다.

```rust
// Display 트레이트를 구현한 타입만 받음
fn print_it<T: std::fmt::Display>(item: T) {
    println!("{}", item);
}

// 여러 트레이트 동시 요구
fn process<T: Clone + Debug>(item: T) {
    let copied = item.clone();
    println!("{:?}", copied);
}
```

`where` 절로 더 깔끔하게 쓸 수도 있다.

```rust
fn process<T>(item: T) 
where 
    T: Clone + Debug + Send
{
    // ...
}
```

## 2. 반환 타입으로 사용

`impl Trait` 문법으로 "어떤 구체적인 타입인지는 몰라도, 이 트레이트를 구현한 뭔가를 반환한다"를 표현한다.

```rust
fn make_iterator() -> impl Iterator<Item = i32> {
    vec![1, 2, 3].into_iter()
}
```

반환 타입을 숨기고 싶거나, 복잡한 타입을 단순화할 때 유용하다.

## 3. 트레이트 객체 (동적 디스패치)

런타임에 어떤 타입인지 결정해야 할 때 `dyn Trait`를 사용한다.

```rust
trait Animal {
    fn speak(&self);
}

struct Dog;
struct Cat;

impl Animal for Dog {
    fn speak(&self) { println!("멍멍"); }
}

impl Animal for Cat {
    fn speak(&self) { println!("야옹"); }
}

fn main() {
    let animals: Vec<Box<dyn Animal>> = vec![
        Box::new(Dog),
        Box::new(Cat),
    ];
    
    for animal in animals {
        animal.speak();  // 런타임에 어떤 speak()인지 결정됨
    }
}
```

`Box<dyn Trait>`는 힙에 할당되고, vtable을 통해 메서드를 호출한다. 성능 오버헤드가 약간 있지만, 유연성이 필요할 때 쓴다.

## 4. 연산자 오버로딩

`+`, `-`, `==` 같은 연산자를 내 타입에서 쓰려면 해당 트레이트를 구현해야 한다.

```rust
use std::ops::Add;

struct Point {
    x: i32,
    y: i32,
}

impl Add for Point {
    type Output = Point;
    
    fn add(self, other: Point) -> Point {
        Point {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

let p1 = Point { x: 1, y: 2 };
let p2 = Point { x: 3, y: 4 };
let p3 = p1 + p2;  // Point { x: 4, y: 6 }
```

| 연산자 | 트레이트 |
|--------|---------|
| `+` | `Add` |
| `-` | `Sub` |
| `*` | `Mul` |
| `==` | `PartialEq` |
| `<`, `>` | `PartialOrd` |
| `[]` | `Index` |

## 5. 슈퍼트레이트 (Supertrait)

"이 트레이트를 구현하려면 먼저 저 트레이트부터 구현해야 한다"를 표현한다.

```rust
trait Printable: Display {
    fn print(&self) {
        println!("{}", self);  // Display가 있으니 {} 사용 가능
    }
}
```

`Printable`을 구현하려면 `Display`가 필수다. 자격 요건 같은 개념이다.

실전에서 자주 보는 패턴:

```rust
pub trait Service: Send + Sync + 'static {
    fn execute(&self);
}
```

"이 서비스는 멀티스레드 환경에서 안전하게 공유될 수 있어야 한다"라는 제약을 거는 것이다.

## 6. 확장 트레이트 패턴

외부 크레이트의 타입에 메서드를 추가하고 싶을 때 쓴다.

```rust
trait StringExt {
    fn is_blank(&self) -> bool;
}

impl StringExt for String {
    fn is_blank(&self) -> bool {
        self.trim().is_empty()
    }
}

impl StringExt for &str {
    fn is_blank(&self) -> bool {
        self.trim().is_empty()
    }
}

// 사용
let s = String::from("   ");
println!("{}", s.is_blank());  // true
```

표준 라이브러리의 `String`에 내가 원하는 메서드를 붙일 수 있다. 단, 해당 트레이트를 `use`해야 메서드가 보인다.

## 정리

| 용도 | 문법 |
|------|------|
| 함수 파라미터 제약 | `fn foo<T: Trait>(x: T)` |
| 반환 타입 추상화 | `fn foo() -> impl Trait` |
| 동적 디스패치 | `Box<dyn Trait>` |
| 연산자 오버로딩 | `impl Add for MyType` |
| 자격 요건 명시 | `trait A: B + C` |
| 외부 타입 확장 | 확장 트레이트 패턴 |

다음 글에서는 트레이트의 고급 활용법을 다룰 예정이다.
