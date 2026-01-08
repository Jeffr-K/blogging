---
title: "[Rust 트레이트 시리즈] 11. AsRef/AsMut: 비용 없는 참조 변환"
author: anonymous.rs
date: 2025-12-30
tags: ["rust", "trait", "conversion", "asref", "asmut", "제네릭", "슬라이스"]
---

# `AsRef`와 `AsMut`: 비용 없는 참조 변환

`From`/`Into`가 소유권을 이전하는 변환을 다루는 반면, `AsRef`와 `AsMut`은 소유권을 유지한 채 **비용 없이(cheaply) 내부 데이터에 대한 참조(reference)를 얻어오는** 변환을 다룹니다.

이 트레이트들은 특히 여러 다른 타입이지만 동일한 핵심 데이터에 대한 참조로 볼 수 있는 경우, 유연하고 효율적인 함수를 작성하는 데 매우 유용합니다. 대표적인 예가 `String`과 `&str`을 모두 받을 수 있는 함수를 작성하는 것입니다.

## `AsRef<T>`: 불변 참조 얻기

`AsRef<T>` 트레이트는 `as_ref()`라는 단 하나의 메서드를 가집니다.

```rust
pub trait AsRef<T: ?Sized> {
    fn as_ref(&self) -> &T;
}
```
`self`에 대한 불변 참조를 받아 `T` 타입에 대한 불변 참조를 반환합니다. 이 변환은 메모리 할당이나 복사 없이 단순한 포인터 변환 등으로 이루어지므로 매우 빠릅니다.

### `AsRef<str>`의 활용

가장 흔한 사용 사례는 `String`과 `&str`을 모두 처리하는 함수를 작성하는 것입니다. `String`은 내부적으로 `&str`을 소유하고 있으므로 `AsRef<str>`을 구현합니다.

```rust
// 이 함수는 `String`, `&String`, `&str` 등 `&str`로 참조될 수 있는 모든 타입을 인자로 받습니다.
fn print_message(message: impl AsRef<str>) {
    // .as_ref()를 호출하여 `&str` 참조를 얻습니다.
    let message_slice = message.as_ref();
    println!("메시지: {}", message_slice);
}

fn main() {
    let msg_string = String::from("안녕하세요, String입니다.");
    let msg_str_literal = "안녕하세요, &str 리터럴입니다.";

    print_message(&msg_string);      // &String 타입을 전달
    print_message(msg_string);       // String 타입을 전달 (소유권이 이동하지만, 함수 내에서 AsRef로 처리됨)
    print_message(msg_str_literal);  // &str 타입을 전달
}
```
`impl AsRef<str>` 제네릭 경계를 사용함으로써, 함수를 호출하는 쪽에서 굳이 `&my_string[..]`과 같은 변환을 할 필요 없이 다양한 문자열 타입을 유연하게 전달할 수 있습니다.

`AsRef<Path>`나 `AsRef<[T]>` 등 다른 슬라이스 타입에 대해서도 동일한 패턴이 유용하게 사용됩니다.

## `AsMut<T>`: 가변 참조 얻기

`AsMut<T>`는 `AsRef<T>`의 가변(mutable) 버전입니다. `as_mut()` 메서드를 통해 내부 데이터에 대한 가변 참조를 얻어옵니다.

```rust
pub trait AsMut<T: ?Sized> {
    fn as_mut(&mut self) -> &mut T;
}
```
`self`에 대한 가변 참조를 받아 `T` 타입에 대한 가변 참조를 반환합니다.

### 예시: 가변 슬라이스 처리

```rust
// 이 함수는 `&mut [u8]`로 가변 참조될 수 있는 모든 타입을 받아서 내용을 수정합니다.
fn invert_bytes(data: impl AsMut<[u8]>) {
    // .as_mut()를 호출하여 `&mut [u8]` 참조를 얻습니다.
    for byte in data.as_mut() {
        *byte = !*byte; // 비트 반전
    }
}

fn main() {
    let mut numbers_vec: Vec<u8> = vec![0, 1, 255];
    let mut numbers_array: [u8; 3] = [10, 20, 30];

    invert_bytes(&mut numbers_vec);
    invert_bytes(&mut numbers_array);

    println!("반전된 Vec: {:?}", numbers_vec);
    println!("반전된 Array: {:?}", numbers_array);
}
```

## `Borrow` vs `AsRef`

`AsRef`와 비슷한 역할을 하는 `Borrow` 트레이트가 있습니다. 두 트레이트의 차이는 미묘하지만 중요합니다.

-   **`AsRef<T>`**: 주 목적은 타입 `U`에서 `T`로의 저렴한 참조 변환입니다. `U`와 `T`의 해시(Hash), 동등성(Eq), 순서(Ord)가 반드시 같을 필요는 없습니다.
-   **`Borrow<T>`**: `AsRef`와 유사하지만, 한 가지 중요한 제약이 추가됩니다. 빌려온 타입 `T`의 해시, 동등성, 순서가 원래 타입 `U`와 동일해야 합니다. 이 특성 때문에 `HashMap`이나 `BTreeMap`의 `get` 메서드는 `AsRef`가 아닌 `Borrow`를 사용합니다. 예를 들어, `HashMap<String, i32>`에서 `&str` 키를 사용해 값을 찾을 수 있는 것은 `String`이 `Borrow<str>`을 구현하기 때문입니다.

**간단한 규칙**: 제네릭 함수에서 단순히 참조를 얻어오는 것이 목적이라면 `AsRef`를 사용하는 것이 좋습니다. 컬렉션의 키와 관련된 작업을 한다면 `Borrow`가 더 적합할 수 있습니다.

## 결론

`AsRef`와 `AsMut`은 소유권 이동 없이 효율적으로 다른 타입의 참조를 얻어올 수 있게 해주는 강력한 추상화 도구입니다. 특히 `String`/`&str`, `Vec<T>`/`&[T]`와 같이 소유권이 있는 타입과 슬라이스 타입을 모두 유연하게 처리해야 하는 함수를 작성할 때 코드의 재사용성과 편의성을 크게 향상시켜 줍니다.
