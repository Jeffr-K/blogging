---
title: "[Rust 트레이트 시리즈] 15. Clone: 명시적인 데이터 복제"
author: anonymous.rs
date: 2025-12-31
tags: ["rust", "trait", "clone", "copy", "ownership", "복제"]
---

# `Clone`: 명시적인 데이터 복제

러스트의 소유권 시스템에서 값의 할당은 기본적으로 '이동(Move)'을 의미합니다. 하지만 때로는 값의 소유권을 이전하는 대신, 데이터의 완전한 복사본을 만들어 독립적인 소유권을 가진 새로운 값을 생성하고 싶을 때가 있습니다. `Clone` 트레이트는 바로 이러한 **명시적인 복제**를 위한 표준적인 방법을 제공합니다.

`Clone` 트레이트를 구현하는 타입은 `.clone()` 메서드를 갖게 되며, 이 메서드를 호출하여 해당 값의 복사본을 만들 수 있습니다.

## `Clone` vs `Copy`

`Clone`과 `Copy`는 모두 값을 복사하는 것과 관련이 있지만, 중요한 차이점이 있습니다.

| 특징         | `Copy`                                                       | `Clone`                                                              |
|--------------|--------------------------------------------------------------|----------------------------------------------------------------------|
| **동작 방식**  | 암묵적 (값 할당 시 자동으로 발생)                            | 명시적 (`.clone()` 메서드를 직접 호출)                               |
| **의미**       | 비트 단위의 단순 복사(bitwise copy). 매우 저렴한 연산.       | '깊은 복사(deep copy)'를 포함할 수 있는, 잠재적으로 비용이 큰 연산. |
| **구현 대상**  | 스택에만 데이터가 저장되는 단순한 타입.                      | 스택, 힙 등 복잡한 자원을 소유하는 타입.                              |
| **트레이트 관계**| `Copy`를 구현하려면 반드시 `Clone`을 구현해야 함. (`Copy: Clone`) | `Clone`을 구현한다고 해서 `Copy`일 필요는 없음.                    |

`String`이나 `Vec<T>`처럼 힙에 데이터를 할당하는 타입들은 `Clone`은 구현하지만 `Copy`는 구현하지 않습니다. 이들의 `.clone()` 메서드는 힙에 새로운 메모리를 할당하고 데이터를 복사하는, 상대적으로 비싼 작업을 수행합니다.

## `#[derive(Clone)]`: 간편한 `Clone` 구현

구조체나 열거형의 모든 필드가 `Clone` 트레이트를 구현한다면, `#[derive(Clone)]` 속성을 사용하여 컴파일러가 `Clone` 구현을 자동으로 생성하도록 할 수 있습니다.

```rust
// `String`과 `u32`는 모두 `Clone`을 구현하므로, `User`도 `Clone`을 파생할 수 있습니다.
#[derive(Debug, Clone)]
struct User {
    username: String,
    age: u32,
}

fn main() {
    let user1 = User {
        username: "alice".to_string(),
        age: 30,
    };

    // .clone()을 호출하여 user1의 복사본을 만듭니다.
    let user2 = user1.clone();

    // user1은 소유권을 잃지 않고 여전히 유효합니다.
    println!("user1: {:?}, user2: {:?}", user1, user2);
    
    // user1과 user2는 완전히 독립된 데이터입니다.
    // assert_ne!(&user1.username as *const _, &user2.username as *const _);
}
```

## `Clone` 수동 구현

때로는 단순한 필드별 복사가 아닌, 특별한 복제 로직이 필요할 수 있습니다. 예를 들어, `Arc<T>`(Atomic Reference Counted)의 `clone`은 데이터를 복제하는 대신 내부의 참조 카운트만 증가시킵니다. 이처럼 커스텀 동작이 필요할 때 `Clone`을 직접 구현할 수 있습니다.

```rust
use std::sync::Arc;

// 개념적인 예시 (실제로는 더 복잡함)
struct MyWrapper {
    // Arc를 사용하여 데이터 공유
    data: Arc<Vec<i32>>,
}

// MyWrapper에 대한 Clone은 내부 데이터의 깊은 복사가 아닌,
// Arc의 참조 카운트를 증가시키는 방식으로 구현됩니다.
impl Clone for MyWrapper {
    fn clone(&self) -> Self {
        MyWrapper {
            data: Arc::clone(&self.data),
        }
    }
}

fn main() {
    let wrapper1 = MyWrapper { data: Arc::new(vec![1, 2, 3]) };
    println!("초기 참조 카운트: {}", Arc::strong_count(&wrapper1.data));

    let wrapper2 = wrapper1.clone();
    println!("clone 후 참조 카운트: {}", Arc::strong_count(&wrapper1.data));
    
    // wrapper1과 wrapper2는 동일한 Vec 데이터를 가리킵니다.
}
```

## `.clone()`의 비용에 대한 주의

`.clone()`은 매우 편리하지만, 잠재적으로 비용이 큰 작업일 수 있다는 점을 항상 인지해야 합니다. 특히 큰 `Vec`이나 `String`을 복제하는 것은 상당한 메모리 할당과 데이터 복사를 유발합니다. 성능에 민감한 루프 안에서 불필요하게 `.clone()`을 호출하는 것은 피해야 하며, 대신 참조(`&`)를 사용하거나 소유권을 이전하는 방식을 우선적으로 고려하는 것이 좋습니다.

## 결론

`Clone` 트레이트는 러스트의 소유권 시스템과 상호 보완하며, 필요할 때 데이터의 독립적인 복사본을 만들 수 있는 명확하고 표준적인 방법을 제공합니다. `Copy`와의 차이점을 이해하고 `.clone()`의 잠재적 비용을 인지한다면, 소유권과 관련된 많은 문제들을 효과적으로 해결할 수 있습니다.
