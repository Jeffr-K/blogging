---
title: "[Rust 트레이트 시리즈] 22. Drop: 스코프를 벗어날 때의 마지막 인사"
author: anonymous.rs
date: 2026-01-02
tags: ["rust", "trait", "drop", "raii", "소멸자", "resource-management"]
---

# `Drop`: 스코프를 벗어날 때의 마지막 인사

`Drop` 트레이트는 다른 언어의 '소멸자(destructor)'와 유사한 개념으로, 어떤 값이 스코프(scope)를 벗어나 더 이상 사용되지 않을 때 실행될 코드를 정의할 수 있게 해줍니다. 이는 러스트의 핵심 디자인 패턴인 **RAII(Resource Acquisition Is Initialization)**를 구현하는 중심 메커니즘으로, 메모리뿐만 아니라 파일, 네트워크 연결, 뮤텍스 락 등 모든 종류의 자원을 안전하고 예측 가능하게 해제하는 데 사용됩니다.

## RAII: 자원 획득은 초기화, 해제는 자동화

RAII 패턴은 "자원의 획득(Acquisition)은 객체의 초기화(Initialization) 시점에 이루어지고, 자원의 해제(Release)는 객체의 소멸 시점에 이루어진다"는 원칙입니다.

러스트에서 이는 다음과 같이 동작합니다.
1.  **자원 획득**: `File::open("...")`이나 `Mutex::lock()`처럼, 자원을 사용하는 객체를 생성합니다.
2.  **사용**: 해당 객체를 사용하여 자원을 이용합니다.
3.  **자원 해제**: 객체가 스코프를 벗어나면, 컴파일러는 해당 객체의 `drop` 메서드를 **자동으로** 호출하여 자원을 정리합니다.

이 패턴 덕분에 개발자는 `file.close()`나 `lock.unlock()` 같은 정리 코드를 직접 호출하는 것을 잊어버릴 걱정을 할 필요가 없습니다. 심지어 함수 중간에서 에러가 발생하여 `panic`이 일어나더라도, 스택이 풀리면서(unwinding) 스코프를 벗어나는 모든 객체의 `drop`이 순서대로 호출되어 자원 누수(resource leak)를 방지합니다.

## `Drop` 트레이트 정의와 구현

`Drop` 트레이트는 `drop`이라는 단 하나의 메서드를 가집니다.

```rust
pub trait Drop {
    // `&mut self`를 인자로 받아, 값 자체를 정리하는 로직을 수행합니다.
    fn drop(&mut self);
}
```

**중요한 점**: `drop` 메서드는 개발자가 직접 호출할 수 없습니다. 이는 컴파일러만이 스코프 종료 시점에 호출할 수 있습니다. 만약 직접 호출이 허용된다면, 컴파일러의 자동 호출과 겹쳐 '이중 해제(double free)'와 같은 심각한 버그가 발생할 수 있기 때문입니다.

### `Drop` 구현 예제

객체가 언제 소멸되는지 눈으로 확인하기 위해, 생성과 소멸 시점에 메시지를 출력하는 간단한 구조체를 만들어 보겠습니다.

```rust
struct LoudDropper {
    name: String,
}

impl LoudDropper {
    fn new(name: &str) -> Self {
        println!("> `{}` 생성됨.", name);
        LoudDropper { name: name.to_string() }
    }
}

// LoudDropper에 대해 Drop 트레이트를 구현합니다.
impl Drop for LoudDropper {
    fn drop(&mut self) {
        println!("< `{}` 소멸됨.", self.name);
    }
}

fn main() {
    println!("--- main 스코프 진입 ---");
    let a = LoudDropper::new("a");
    {
        println!("--- 내부 스코프 진입 ---");
        let b = LoudDropper::new("b");
        println!("--- 내부 스코프 탈출 ---");
        // 이 지점에서 `b`가 스코프를 벗어나므로 `b.drop()`이 호출됩니다.
    }
    println!("--- main 스코프 탈출 ---");
    // 이 지점에서 `a`가 스코프를 벗어나므로 `a.drop()`이 호출됩니다.
}
```
**출력:**
```
--- main 스코프 진입 ---
> `a` 생성됨.
--- 내부 스코프 진입 ---
> `b` 생성됨.
--- 내부 스코프 탈출 ---
< `b` 소멸됨.
--- main 스코프 탈출 ---
< `a` 소멸됨.
```
출력 순서를 보면, 변수가 생성된 역순으로, 그리고 각자의 스코프가 끝나는 시점에 정확히 `drop`이 호출됨을 알 수 있습니다.

## `std::mem::drop`: 강제로 소유권 버리기

때로는 변수가 스코프를 벗어나기 전에 먼저 소유권을 버리고 싶을 때가 있습니다. `my_var.drop()`은 호출할 수 없으므로, 러스트는 `std::mem::drop`이라는 특별한 함수를 제공합니다.

`std::mem::drop(value)` 함수는 인자로 받은 `value`의 소유권을 가져간 뒤, 아무것도 하지 않고 즉시 함수를 종료합니다. 소유권을 가져간 `value`가 함수 끝에서 소멸되므로, 결과적으로 `value`의 `drop` 구현이 즉시 호출되게 됩니다.

```rust
fn main() {
    let c = LoudDropper::new("c");
    println!("c를 강제로 drop 시키기 전");
    // c의 소유권을 `std::mem::drop`으로 옮깁니다.
    std::mem::drop(c);
    println!("c를 강제로 drop 시킨 후");
    // `c`는 이미 소유권이 이전되었으므로, main 스코프가 끝나도 다시 drop되지 않습니다.
}
```
**출력:**
```
> `c` 생성됨.
c를 강제로 drop 시키기 전
< `c` 소멸됨.
c를 강제로 drop 시킨 후
```

## 결론

`Drop` 트레이트와 RAII 패턴은 러스트의 안정성과 예측 가능성을 보장하는 핵심 기둥입니다. 개발자가 명시적인 자원 해제 코드를 작성하는 부담을 덜어주는 동시에, `panic`을 포함한 모든 코드 경로에서 자원 누수가 발생하지 않도록 보장합니다. 이는 러스트를 시스템 프로그래밍과 같이 높은 안정성이 요구되는 분야에 매우 적합한 언어로 만들어 줍니다.
