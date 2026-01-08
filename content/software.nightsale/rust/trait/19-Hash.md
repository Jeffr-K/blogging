---
title: "[Rust 트레이트 시리즈] 19. Hash: 해시 가능한 타입 만들기"
author: anonymous.rs
date: 2026-01-01
tags: ["rust", "trait", "hash", "hasher", "hashmap", "hashset"]
---

# `Hash`: 해시 가능한 타입 만들기

`Hash` 트레이트는 어떤 타입의 인스턴스를 **해시(hash) 가능**하게 만들어, `HashMap`의 키(key)나 `HashSet`의 원소(element)로 사용할 수 있도록 해주는 핵심적인 트레이트입니다.

## `HashMap`과 `Hash`는 왜 필요한가?

`HashMap<K, V>`은 키(`K`)를 값(`V`)에 매핑하는 컬렉션입니다. `HashMap`이 빠른 속도로 값을 찾을 수 있는 비결은, 키를 '해싱(hashing)'하여 얻은 해시 값을 배열의 인덱스로 사용하기 때문입니다.

1.  값을 저장할 때: 키(`K`)의 해시 값을 계산하여, 해당 해시 값에 해당하는 배열 공간에 값(`V`)을 저장합니다.
2.  값을 검색할 때: 검색하려는 키의 해시 값을 다시 계산하여, 해당 배열 공간에 어떤 값이 있는지 즉시 찾아냅니다.

이러한 원리 때문에 `HashMap`의 키로 사용될 타입 `K`는 반드시 자신의 해시 값을 계산하는 방법을 제공해야 합니다. `Hash` 트레이트가 바로 그 방법을 정의합니다.

또한, 서로 다른 키가 우연히 동일한 해시 값을 갖는 '해시 충돌(hash collision)'이 발생할 수 있습니다. 이 경우 `HashMap`은 해당 키들이 실제로 동일한지 확인해야 하므로, 키 타입은 `Eq` 트레이트도 반드시 구현해야 합니다.

**결론: `HashMap`의 키나 `HashSet`의 원소가 되려면, 해당 타입은 반드시 `Hash`와 `Eq` 트레이트를 구현해야 합니다.**

## `Hash` 트레이트 정의

`Hash` 트레이트의 정의는 다음과 같습니다.

```rust
pub trait Hash {
    fn hash<H: Hasher>(&self, state: &mut H);
}
```

-   `hash` 메서드는 `Hasher`라는 트레이트를 구현하는 `state`를 가변 인자로 받습니다. `Hasher`는 해시 알고리즘의 현재 상태를 들고 있는 타입입니다.
-   `hash` 메서드의 구현은 `self`의 의미 있는 필드들을 `state.write(...)`나 `field.hash(state)`와 같은 메서드를 통해 `Hasher`에 전달하는 역할을 합니다.
-   `Hasher`는 전달받은 바이트들을 내부 알고리즘에 따라 처리하여 최종 해시 값을 계산할 수 있도록 상태를 업데이트합니다.

## `#[derive(Hash)]`: 간편한 `Hash` 구현

대부분의 경우, 구조체의 모든 필드가 `Hash`를 구현한다면 `#[derive(Hash)]` 속성을 사용하여 간단하게 `Hash` 트레이트를 구현할 수 있습니다. `Eq`와 `PartialEq`도 함께 파생하는 것이 일반적입니다.

```rust
use std::collections::HashMap;

#[derive(Debug, Hash, Eq, PartialEq)] // Hash를 파생하려면 Eq와 PartialEq도 필요합니다.
struct User {
    id: u32,
    username: String,
}

fn main() {
    let mut user_permissions = HashMap::new();

    let user1 = User {
        id: 101,
        username: "alice".to_string(),
    };
    let user2 = User {
        id: 205,
        username: "bob".to_string(),
    };

    // `User`가 `Hash`와 `Eq`를 구현했으므로, `HashMap`의 키로 사용할 수 있습니다.
    user_permissions.insert(user1, "Admin");
    user_permissions.insert(user2, "Guest");

    let target_user = User {
        id: 101,
        username: "alice".to_string(),
    };

    // `target_user`의 해시 값을 계산하여 값을 찾습니다.
    if let Some(permission) = user_permissions.get(&target_user) {
        println!("User 101의 권한: {}", permission);
    }
}
```

## `Hash` 수동 구현

기본 파생 구현은 구조체의 모든 필드를 순서대로 해시에 반영합니다. 하지만 때로는 해싱 동작을 직접 제어하고 싶을 수 있습니다.

-   **특정 필드만 해싱**: `id` 필드만으로 객체를 고유하게 식별할 수 있다면, 다른 필드는 해싱 과정에서 제외하여 성능을 높일 수 있습니다.
-   **필드 순서에 무관한 해싱**: `(a, b)`와 `(b, a)`가 동일한 해시 값을 갖도록 만들고 싶을 때.

```rust
use std::hash::{Hash, Hasher};

struct Person {
    id: u32,
    name: String,
    // 이 필드는 해싱에 포함시키고 싶지 않음
    #[allow(dead_code)]
    age: u8,
}

impl Hash for Person {
    fn hash<H: Hasher>(&self, state: &mut H) {
        // id와 name 필드만 해싱에 포함시킵니다.
        self.id.hash(state);
        self.name.hash(state);
    }
}

// 수동 구현 시에는 PartialEq와 Eq도 직접 구현해야 일관성이 보장됩니다.
impl PartialEq for Person {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id && self.name == other.name
    }
}
impl Eq for Person {}
```

## 결론

`Hash` 트레이트는 사용자 정의 타입을 러스트의 강력하고 효율적인 해시 기반 컬렉션(`HashMap`, `HashSet`)에 통합하기 위한 필수적인 관문입니다. `#[derive(Hash, Eq, PartialEq)]`를 통해 대부분의 경우 간편하게 구현할 수 있으며, 이를 통해 데이터를 빠르고 편리하게 저장하고 검색하는 기능을 활용할 수 있게 됩니다.
