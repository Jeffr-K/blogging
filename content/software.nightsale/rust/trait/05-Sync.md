---
title: "[Rust 트레이트 시리즈] 05. Sync: 스레드 간의 안전한 데이터 공유"
author: anonymous.rs
date: 2025-12-30
tags: ["rust", "trait", "marker-trait", "sync", "동시성", "스레드"]
---

# `Sync`: 스레드 간의 안전한 데이터 공유

`Sync` 트레이트는 `Send`와 함께 러스트의 동시성 안전성을 보장하는 핵심 마커 트레이트(Marker Trait)입니다. `Send`가 스레드 간의 '소유권 이전'의 안전성을 다룬다면, `Sync`는 **'여러 스레드에서 동시에 참조(&T)를 통해 안전하게 접근'**할 수 있는지를 나타냅니다.

즉, 어떤 타입 `T`가 `Sync`를 구현했다면, `&T` 타입의 값은 여러 스레드에서 충돌 없이 공유될 수 있습니다.

## `Sync`는 왜 필요한가?

여러 스레드가 동일한 메모리 위치에 동시에 접근(특히 쓰기 접근)하려고 할 때 데이터 경쟁(Data Race)이 발생합니다. `Sync` 트레이트는 타입 자체가 여러 스레드에서 동시에 참조되어도 내부적으로 안전한지를 컴파일러에게 알려주는 역할을 합니다.

만약 어떤 타입이 내부적으로 원자적 연산 없이 값을 변경하는 등의 비-스레드-안전(non-thread-safe) 동작을 포함하고 있다면, 해당 타입은 `Sync`로 표시될 수 없으며, 컴파일러는 이 타입의 참조(`&T`)가 여러 스레드에 공유되는 것을 막습니다.

## `Send`와 `Sync`의 관계

- `T`가 `Sync`이면, `&T`는 `Send`이다.
  - 이 말은, 타입 `T`가 여러 스레드에서 안전하게 공유될 수 있다면(`Sync`), 그 타입에 대한 참조(`&T`)를 다른 스레드로 보내는 것(`Send`)도 안전하다는 의미입니다. 이는 매우 직관적입니다.

- 대부분의 기본 타입들은 `Send`와 `Sync`를 모두 구현합니다.
- 구조체나 열거형의 모든 필드가 `Sync`이면, 그 타입도 자동으로 `Sync`가 됩니다.

## `Sync`가 아닌 타입의 예: `RefCell<T>`

`Sync` 트레이트가 구현되지 않은 대표적인 예는 `std::cell::RefCell<T>`입니다. `RefCell<T>`는 '내부 가변성(Interior Mutability)'을 제공하는 타입으로, 불변 참조(`&self`)를 통해서도 내부 값을 변경할 수 있게 해줍니다.

이러한 변경은 런타임에 빌림 규칙(borrowing rules)을 검사하여 이루어지는데, 이 검사 자체가 원자적이지 않기 때문에 여러 스레드에서 동시에 `borrow_mut()`를 호출하면 데이터 경쟁이 발생할 수 있습니다. 따라서 `RefCell<T>`는 `Sync`가 아닙니다.

```rust,ignore
use std::cell::RefCell;
use std::sync::Arc;
use std::thread;

fn main() {
    // RefCell<T>는 Sync를 구현하지 않습니다.
    let non_sync_data = Arc::new(RefCell::new(0));

    let clone1 = non_sync_data.clone();
    let thread1 = thread::spawn(move || {
        // 이 참조가 여러 스레드에 공유되므로 `RefCell`은 `Sync`여야 하지만, 그렇지 않다.
        // 따라서 컴파일 에러가 발생한다.
        *clone1.borrow_mut() += 1;
    });

    let clone2 = non_sync_data.clone();
    let thread2 = thread::spawn(move || {
        *clone2.borrow_mut() += 1;
    });

    thread1.join().unwrap();
    thread2.join().unwrap();
}
```
위 코드를 컴파일하면 `RefCell<T>`가 `Sync`가 아니기 때문에 `Arc<RefCell<T>>`를 여러 스레드에서 안전하게 공유할 수 없다는 에러가 발생합니다. 스레드 간에 안전하게 내부 값을 변경하려면 `Mutex<T>`나 `RwLock<T>`을 사용해야 합니다. `Mutex`는 내부적으로 동기화 메커니즘을 갖추고 있어 `Send`와 `Sync`를 모두 구현합니다.

## 결론

`Sync` 트레이트는 여러 스레드가 데이터에 대한 참조를 공유할 때 발생할 수 있는 데이터 경쟁을 컴파일 타임에 차단하는 중요한 안전장치입니다. `Send`와 `Sync` 덕분에 러스트 개발자는 컴파일러의 보호 아래에서 복잡한 동시성 코드를 자신감 있게 작성할 수 있습니다.
