---
title: "[Rust 트레이트 시리즈] 26. Future: 비동기 작업의 기본 단위"
author: anonymous.rs
date: 2026-01-03
tags: ["rust", "trait", "async", "future", "concurrency", "비동기"]
---

# `Future`: 비동기 작업의 기본 단위

러스트의 현대적인 비동기 프로그래밍은 `async`/`await`라는 간결한 문법을 중심으로 이루어집니다. 하지만 이 편리한 문법의 이면에는 `std::future::Future`라는 핵심 트레이트가 자리 잡고 있습니다. `Future`는 **"미래의 어느 시점에 완료될 값"**을 나타내는 개념적인 객체이며, 모든 비동기 작업의 가장 기본적인 구성 단위입니다.

`async fn`으로 선언된 함수는 컴파일 시점에 이 `Future` 트레이트를 구현하는 거대한 상태 기계(state machine)로 변환됩니다.

## `Future` 트레이트 들여다보기

`Future` 트레이트의 실제 정의는 다음과 같습니다.

```rust
use std::pin::Pin;
use std::task::{Context, Poll};

pub trait Future {
    // Future가 최종적으로 산출할 값의 타입입니다.
    type Output;

    // Future를 실행하여 진행시키는 메서드입니다.
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}
```

이 정의는 다소 복잡해 보이지만, 각 구성 요소를 이해하면 비동기 시스템의 동작 원리를 파악할 수 있습니다.

1.  **`Output`**: 비동기 작업이 완료되었을 때 반환될 값의 타입입니다. 예를 들어, 비동기 데이터베이스 쿼리는 `Result<Vec<User>, DbError>`와 같은 `Output`을 가질 수 있습니다.

2.  **`poll` 메서드**: `Future`의 심장입니다. 비동기 런타임(예: Tokio, async-std)은 이 `poll` 메서드를 반복적으로 호출하여 `Future`가 완료될 때까지 진행시킵니다.
    -   `self: Pin<&mut Self>`: `Pin`은 `Future`가 `poll` 되는 동안 메모리에서 이동되지 않도록 '고정'하는 역할을 합니다. 이는 `Future`가 자기 자신 내부의 데이터를 참조하는 '자기 참조 구조체'일 경우, 이동으로 인해 포인터가 무효화되는 것을 막기 위해 필수적입니다.
    -   `cx: &mut Context<'_>`: `Context`는 `Waker`를 포함하고 있습니다. `Future`가 당장 작업을 완료할 수 없을 때(예: 네트워크 응답 대기), 이 `Waker`를 저장해 두었다가, 나중에 작업이 준비되면 `waker.wake()`를 호출해야 합니다. `wake()`가 호출되면 런타임은 "아, 이 `Future`가 이제 진행할 준비가 되었구나"라고 인지하고, 다시 `poll`을 호출하러 옵니다.

3.  **`Poll<T>` 열거형**: `poll` 메서드의 반환 타입으로, `Future`의 현재 상태를 나타냅니다.
    -   `Poll::Ready(value)`: `Future`가 성공적으로 완료되었음을 의미하며, `value`는 `Output` 타입의 최종 결과물입니다.
    -   `Poll::Pending`: `Future`가 아직 완료되지 않았음을 의미합니다. 이 경우, `Future`는 `Waker`를 통해 나중에 런타임에게 자신을 다시 깨워달라고 요청했어야 합니다.

## `async`/`await`는 어떻게 동작하는가?

개발자가 `async fn`과 `await`를 사용하면, 컴파일러가 이 모든 복잡한 `poll` 로직을 자동으로 생성해 줍니다.

```rust
async fn read_from_db() -> String {
    // ...
    let result = some_db_query.await; // .await 지점
    // ...
    result
}
```

-   `async fn read_from_db()`: 이 함수는 `Future<Output = String>`을 구현하는 상태 기계를 반환합니다.
-   `.await`: 이 키워드가 있는 지점이 바로 `poll` 메서드 내부에서 `Poll::Pending`을 반환할 수 있는 상태에 해당합니다. `some_db_query`가 `Pending`이면, `read_from_db` 전체가 `Pending` 상태가 되어 실행을 런타임에 양보합니다. 나중에 `some_db_query`가 완료되어 `Waker`를 호출하면, 런타임은 `read_from_db`의 `.await` 지점부터 실행을 재개합니다.

## 결론

`Future` 트레이트는 러스트의 고성능 `async`/`await` 시스템을 떠받치는 가장 근본적인 추상화입니다. 일반적인 애플리케이션 개발에서 `Future`를 직접 구현할 일은 드물지만, 그 내부 동작 원리, 특히 `poll`과 `Waker`의 상호작용을 이해하는 것은 복잡한 비동기 코드의 동작을 예측하고 디버깅하는 데 큰 도움이 됩니다. `Future`는 러스트가 어떻게 제로 비용 추상화를 통해 고수준의 편의성과 저수준의 제어력을 동시에 달성하는지를 보여주는 훌륭한 예시입니다.
