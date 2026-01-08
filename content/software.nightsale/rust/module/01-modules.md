---
title: "Episode 11. The Module System"
author: anonymous.rs
date: 2026-01-07
tags: ["rust", "modules", "organization"]
---

# Deep Dive: 모듈 시스템으로 코드 구성하기

프로젝트가 커지면 코드를 여러 파일과 디렉토리로 나누어 관리하는 것이 필수적입니다. 러스트는 **모듈 시스템(Module System)**을 통해 코드를 체계적으로 구성하고, 캡슐화를 통해 내부 구현을 숨길 수 있는 강력한 기능을 제공합니다.

---

## 1. 모듈이란? (`mod` 키워드)

모듈은 함수, 구조체, 트레이트, 심지어 다른 모듈까지 그룹화할 수 있는 코드 컨테이너입니다. `mod` 키워드를 사용해 정의합니다.

**한 파일 내에서 모듈 정의하기:**

```rust
mod front_of_house {
    mod hosting {
        fn add_to_waitlist() {}
    }

    mod serving {
        fn take_order() {}
    }
}
```
- **계층 구조:** 모듈은 나무(tree)와 같은 계층 구조를 이룹니다. 최상위 모듈은 `crate`라는 이름의 암시적 모듈입니다.
- **비공개(private)가 기본:** 모듈 내의 모든 아이템(함수, 구조체 등)은 기본적으로 비공개입니다. 즉, 부모 모듈이나 다른 외부 모듈에서 접근할 수 없습니다.

---

## 2. 경로(Path)와 스코프(Scope)

모듈 내의 아이템에 접근하려면 **경로(path)**를 사용해야 합니다.

```rust
pub mod front_of_house {
    pub mod hosting {
        pub fn add_to_waitlist() {}
    }
}

pub fn eat_at_restaurant() {
    // 절대 경로 (Absolute Path)
    crate::front_of_house::hosting::add_to_waitlist();

    // 상대 경로 (Relative Path)
    front_of_house::hosting::add_to_waitlist();
}
```

- **`pub` 키워드:** 아이템을 외부에서 접근 가능하게 하려면 `pub` 키워드를 붙여 **공개(public)**로 만들어야 합니다. 모듈 자체도 `pub`이어야 그 안의 공개 아이템에 접근할 수 있습니다.
- **절대 경로 vs 상대 경로:**
    - **절대 경로:** `crate` 키워드로 시작하며, 크레이트 루트부터 전체 경로를 명시합니다.
    - **상대 경로:** 현재 위치를 기준으로 경로를 명시합니다.

---

## 3. `use` 키워드로 경로 가져오기

매번 전체 경로를 쓰는 것은 번거롭습니다. `use` 키워드를 사용하면 경로를 현재 스코프로 가져와 짧은 이름으로 사용할 수 있습니다.

```rust
use crate::front_of_house::hosting;
// use crate::front_of_house::hosting::add_to_waitlist; // 함수까지 바로 가져올 수도 있음

pub fn eat_at_restaurant() {
    hosting::add_to_waitlist();
}
```
- **관례 (Idiomatic Way):**
    - 함수를 가져올 때는 함수의 부모 모듈까지 `use` 하는 것이 일반적입니다. (예: `hosting`까지)
    - 구조체, 열거형 등은 전체 경로를 `use` 하는 것이 일반적입니다. (예: `use std::collections::HashMap;`)

---

## 4. 모듈을 여러 파일로 분리하기

코드가 길어지면 모듈을 별도의 파일로 분리할 수 있습니다. 러스트 컴파일러는 특정 규칙에 따라 파일을 찾아 모듈로 인식합니다.

**시나리오: `front_of_house` 모듈을 `front_of_house.rs` 파일로 분리**

1.  **`src/lib.rs` (또는 `src/main.rs`)**
    ```rust
    mod front_of_house; // ;으로 끝나는 모듈 선언

    pub use crate::front_of_house::hosting;

    pub fn eat_at_restaurant() {
        hosting::add_to_waitlist();
    }
    ```

2.  **`src/front_of_house.rs`** (새 파일)
    ```rust
    pub mod hosting { // `front_of_house` 모듈의 내용
        pub fn add_to_waitlist() {}
    }
    ```

- **규칙:** 컴파일러는 `mod front_of_house;` 선언을 보면, 다음 두 파일 중 하나를 찾습니다.
    1.  `front_of_house.rs`
    2.  `front_of_house/mod.rs` (하위 모듈을 가질 때 사용하는 구식 스타일)

이러한 모듈 시스템은 코드의 각 부분이 명확한 책임을 갖도록 돕고, `pub`을 통해 외부에 공개할 API를 명시적으로 제어하게 함으로써 견고하고 유지보수하기 쉬운 소프트웨어를 만들도록 지원합니다.
