---
title: "[Rust 트레이트 시리즈] 27. Stream: 비동기 버전의 이터레이터"
author: anonymous.rs
date: 2026-01-03
tags: ["rust", "trait", "async", "stream", "futures-rs", "비동기"]
---

# `Stream`: 비동기 버전의 `Iterator`

동기(synchronous) 코드에 `Iterator`가 있다면, 비동기(asynchronous) 코드에는 `Stream`이 있습니다. `Stream` 트레이트는 시간이 지남에 따라 비동기적으로 생성되는 일련의 값들을 나타내는 추상화입니다. `Iterator`가 `for` 루프를 통해 한 번에 하나씩 값을 즉시 '끌어오는(pull)' 방식이라면, `Stream`은 각 값이 준비될 때까지 `await`하며 비차단(non-blocking) 방식으로 값을 기다립니다.

`Stream` 트레이트는 아직 러스트 표준 라이브러리에 포함되어 있지 않으며, 비동기 생태계의 핵심 크레이트인 `futures`에서 제공됩니다.

## `Stream` 트레이트 정의

`Stream` 트레이트의 정의는 `Future`와 매우 유사합니다.

```rust
use std::pin::Pin;
use std::task::{Context, Poll};

pub trait Stream {
    // 스트림이 생성하는 각 아이템의 타입입니다.
    type Item;

    // 스트림에서 다음 아이템을 가져오려고 시도합니다.
    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>>;
}
```

-   **`Item`**: 스트림이 산출하는 각 값의 타입입니다.
-   **`poll_next` 메서드**: `Iterator`의 `next`와 유사하지만, 비동기적으로 동작합니다. 비동기 런타임은 이 메서드를 호출하여 다음 아이템을 가져오려고 시도합니다.
    -   반환 타입인 `Poll<Option<Self::Item>>`은 세 가지 상태를 가집니다.
        1.  `Poll::Ready(Some(value))`: 스트림에서 새로운 값(`value`)을 성공적으로 가져왔음을 의미합니다.
        2.  `Poll::Ready(None)`: 스트림이 종료되었으며, 더 이상 생성할 값이 없음을 의미합니다.
        3.  `Poll::Pending`: 스트림이 아직 다음 값을 준비하지 못했음을 의미합니다. (예: 네트워크에서 다음 데이터 패킷을 기다리는 중)

## `Stream` 사용하기: `while let`과 `.next()`

`Stream`을 소비하는 가장 일반적인 방법은 `futures` 크레이트의 `StreamExt` 트레이트를 사용하는 것입니다. 이 트레이트는 `Stream`에 `.next()`와 같은 유용한 메서드들을 추가해 줍니다.

`.next()` 메서드는 `Future<Output = Option<Self::Item>>`을 반환하므로, `await`와 함께 사용하여 다음 아이템을 비동기적으로 기다릴 수 있습니다.

```rust
// `StreamExt` 트레이트를 스코프로 가져와야 .next() 메서드를 사용할 수 있습니다.
use futures::stream::{self, StreamExt};

#[tokio::main]
async fn main() {
    // 1부터 3까지 숫자를 생성하는 간단한 스트림을 만듭니다.
    let mut number_stream = stream::iter(vec![1, 2, 3]);

    // `while let` 루프를 사용하여 스트림을 비동기적으로 순회합니다.
    while let Some(number) = number_stream.next().await {
        println!("스트림에서 받은 숫자: {}", number);
        // 각 아이템 사이에 비동기 작업을 수행할 수 있습니다.
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    println!("스트림 종료!");
}
```

## `StreamExt`의 어댑터들

`Iterator`와 마찬가지로, `StreamExt`는 `map`, `filter`, `take` 등 다양한 어댑터 메서드를 제공하여 스트림을 변형하고 연결(chaining)할 수 있게 해줍니다.

```rust
use futures::stream::{self, StreamExt};

#[tokio::main]
async fn main() {
    let stream = stream::iter(1..=5);

    // 스트림의 각 아이템에 비동기 작업을 적용합니다.
    let processed_stream = stream.then(|n| async move {
        println!("{} 처리 중...", n);
        tokio::time::sleep(std::time::Duration::from_millis(100 * n as u64)).await;
        n * n // 제곱 값을 반환
    });

    // 최종 결과들을 모읍니다.
    let results: Vec<_> = processed_stream.collect().await;

    println!("처리 완료. 결과: {:?}", results);
}
```
위 예제의 `.then()`은 각 아이템에 대해 `Future`를 반환하는 클로저를 받아 순차적으로 실행하며, `.buffer_unordered()`와 같은 다른 어댑터를 사용하면 여러 `Future`를 동시에 실행하여 처리량을 높일 수도 있습니다.

## `Stream`의 실제 사용 사례

-   **네트워크 프로그래밍**: TCP 연결에서 들어오는 데이터 청크(chunk)들을 스트림으로 처리.
-   **웹소켓**: 서버로부터 오는 실시간 메시지들을 스트림으로 수신.
-   **데이터베이스**: 대용량 쿼리 결과를 한 번에 메모리에 올리는 대신, 한 행(row)씩 스트림으로 받아 처리.
-   **파일 I/O**: 큰 파일을 작은 청크로 나누어 비동기적으로 읽기.

## 결론

`Stream` 트레이트는 비동기 러스트에서 연속적인 데이터를 다루는 표준적인 방법론을 제공합니다. `Iterator`의 강력한 추상화와 함수형 스타일을 비동기 세계로 가져와, 네트워크 통신이나 실시간 데이터 처리와 같은 복잡한 비동기 로직을 선언적이고 안전하게 작성할 수 있도록 돕습니다. 비동기 프로그래밍을 깊이 있게 다루려면 `Stream`에 대한 이해는 필수적입니다.
