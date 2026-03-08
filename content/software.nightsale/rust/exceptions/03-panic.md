---
title: "[Rust 에러 핸들링 시리즈] 03. panic!과 복구 불가능한 에러"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "panic", "unwrap", "abort", "catch-unwind"]
---

# panic!과 복구 불가능한 에러

## 한 줄 요약

`panic!`은 **"더 이상 진행할 수 없다"**는 프로그램의 비상 탈출이다.

## 러스트의 에러 두 종류

| 종류 | 도구 | 용도 |
|------|------|------|
| 복구 가능 | `Result<T, E>` | 파일 없음, 네트워크 실패, 파싱 에러 |
| 복구 불가능 | `panic!` | 배열 범위 초과, 논리적 버그, 불변 조건 위반 |

`Result`는 "실패할 수 있으니 처리해라". `panic!`은 "버그다, 여기서 죽어라".

## `panic!` 기본

```rust
fn main() {
    panic!("치명적 에러 발생!");
}
```

```
thread 'main' panicked at '치명적 에러 발생!', src/main.rs:2:5
```

### 암묵적 panic

직접 `panic!`을 호출하지 않아도 패닉이 발생하는 경우:

```rust
// 1. 배열 범위 초과
let v = vec![1, 2, 3];
v[99];  // 패닉!

// 2. unwrap()에 None/Err
let x: Option<i32> = None;
x.unwrap();  // 패닉!

// 3. 정수 오버플로 (디버그 모드)
let x: u8 = 255;
let y = x + 1;  // 디버그 모드에서 패닉!
```

## `unwrap()` 계열 정리

| 메서드 | 동작 | 패닉 메시지 |
|--------|------|------------|
| `unwrap()` | None/Err이면 패닉 | 기본 메시지 |
| `expect("msg")` | None/Err이면 패닉 | 커스텀 메시지 |
| `unwrap_or(default)` | None/Err이면 기본값 | 패닉 없음 |
| `unwrap_or_else(f)` | None/Err이면 클로저 실행 | 패닉 없음 |
| `unwrap_or_default()` | None/Err이면 Default 값 | 패닉 없음 |

```rust
// 프로덕션 코드에서 unwrap()을 쓰면 안 되는 이유
let port: u16 = env::var("PORT")
    .unwrap()            // 환경변수 없으면 패닉 → 서버 다운
    .parse()
    .unwrap();           // 파싱 실패하면 패닉 → 서버 다운

// 이렇게 쓰자
let port: u16 = env::var("PORT")
    .unwrap_or_else(|_| "8080".to_string())
    .parse()
    .unwrap_or(8080);
```

### `expect()`는 언제 쓰는가

"논리적으로 절대 실패할 수 없는" 경우에 **이유를 명시**하며 쓴다.

```rust
// 하드코딩된 정규식 — 컴파일 타임에 검증된 것과 마찬가지
let re = Regex::new(r"^\d{4}-\d{2}-\d{2}$")
    .expect("정규식 리터럴이므로 항상 유효");

// 방금 push한 벡터의 마지막 원소
let mut v = vec![1, 2, 3];
v.push(4);
let last = v.last().expect("방금 push했으므로 비어있을 수 없음");
```

## 패닉 동작 방식

### Unwind (기본)

패닉이 발생하면 스택을 **되감으며(unwind)** 각 프레임의 `Drop`을 호출한다.

```rust
struct Resource(String);

impl Drop for Resource {
    fn drop(&mut self) {
        println!("정리: {}", self.0);
    }
}

fn main() {
    let _a = Resource("A".into());
    let _b = Resource("B".into());
    panic!("에러!");
}
// 출력:
// 정리: B
// 정리: A
// thread 'main' panicked at '에러!'
```

리소스가 안전하게 정리된다.

### Abort

`Cargo.toml`에서 패닉 시 즉시 종료하도록 설정할 수 있다.

```toml
[profile.release]
panic = "abort"
```

스택 되감기를 하지 않아 바이너리가 작아지고 종료가 빠르다. 임베디드나 바이너리 크기가 중요한 환경에서 쓴다.

## `catch_unwind` - 패닉 포착

일반적으로 패닉은 잡지 않지만, 특수한 상황에서 포착할 수 있다.

```rust
use std::panic;

let result = panic::catch_unwind(|| {
    println!("정상 실행");
    42
});
println!("{:?}", result);  // Ok(42)

let result = panic::catch_unwind(|| {
    panic!("에러!");
});
println!("패닉 잡음: {:?}", result);  // Err(Any)
```

### 사용하는 경우

```rust
// 서버: 하나의 요청 처리 중 패닉이 전체 서버를 죽이면 안 됨
fn handle_request(req: Request) -> Response {
    match panic::catch_unwind(|| process(req)) {
        Ok(response) => response,
        Err(_) => Response::internal_server_error(),
    }
}

// FFI: C 코드로 패닉이 전파되면 정의되지 않은 동작
extern "C" fn callback() {
    let _ = panic::catch_unwind(|| {
        risky_operation();
    });
}
```

`catch_unwind`는 일반적인 에러 핸들링 도구가 **아니다**. 그건 `Result`의 역할이다.

## `panic!` vs `Result` 선택 기준

### `panic!`을 쓸 때

```rust
// 1. 프로그래머의 실수 (버그)
fn divide(a: i32, b: i32) -> i32 {
    assert!(b != 0, "0으로 나눌 수 없음");  // 호출자의 버그
    a / b
}

// 2. 불변 조건(invariant) 위반
impl BoundedQueue {
    fn pop(&mut self) -> T {
        assert!(!self.is_empty(), "빈 큐에서 pop 시도");
        // ...
    }
}

// 3. 프로토타이핑 / 예제 코드
fn main() {
    let data = fetch_data().unwrap();  // TODO: 나중에 제대로 처리
}
```

### `Result`를 쓸 때

```rust
// 1. 외부 요인에 의한 실패
fn read_file(path: &str) -> Result<String, io::Error> {
    fs::read_to_string(path)  // 파일이 없을 수 있음
}

// 2. 사용자 입력
fn parse_age(input: &str) -> Result<u32, ParseIntError> {
    input.parse()  // 사용자가 뭘 입력할지 모름
}

// 3. 네트워크, DB 등 외부 시스템
fn fetch_user(id: u32) -> Result<User, ApiError> {
    // 네트워크가 끊길 수 있음
}
```

### 판단 기준

| 질문 | panic! | Result |
|------|--------|--------|
| 호출자가 이 실패를 처리할 수 있는가? | X | O |
| 이 실패가 프로그래머의 버그인가? | O | X |
| 외부 요인(I/O, 네트워크, 사용자)인가? | X | O |
| 프로토타입/테스트 코드인가? | O | - |

## `assert!` 매크로 계열

```rust
// 조건 확인
assert!(x > 0);
assert!(x > 0, "x는 양수여야 함, 실제값: {}", x);

// 같음 확인
assert_eq!(result, expected);
assert_eq!(result, expected, "결과가 다름");

// 다름 확인
assert_ne!(a, b);

// 디버그 모드에서만 실행
debug_assert!(expensive_check());
debug_assert_eq!(a, b);
```

`assert!`는 릴리즈 모드에서도 실행된다. `debug_assert!`는 디버그 모드에서만 실행된다.

## `todo!()`, `unimplemented!()`, `unreachable!()`

```rust
fn not_yet() -> i32 {
    todo!()  // 아직 구현 안 됨. 패닉 발생.
}

fn legacy_feature() {
    unimplemented!("이 기능은 지원하지 않음")
}

fn process(value: i32) {
    match value {
        1 => println!("하나"),
        2 => println!("둘"),
        _ => unreachable!("1 또는 2만 들어온다고 확신"),
    }
}
```

| 매크로 | 의미 |
|--------|------|
| `todo!()` | 아직 안 했음 (나중에 구현) |
| `unimplemented!()` | 의도적으로 구현하지 않음 |
| `unreachable!()` | 이 코드에 도달하면 버그 |

셋 다 패닉을 발생시키지만, **의도를 명확히 전달**하는 데 의미가 있다.

## 정리

- `panic!` = 복구 불가능한 에러. 버그, 불변 조건 위반
- `Result` = 복구 가능한 에러. 외부 요인, 사용자 입력
- `unwrap()`/`expect()`는 프로토타입에서만. 프로덕션에서는 `?` 또는 `unwrap_or`
- `catch_unwind`는 서버/FFI 같은 특수 상황에서만
- `assert!`는 불변 조건 검증, `todo!`/`unreachable!`은 의도 명시

다음 글에서는 `thiserror`, `anyhow` 크레이트를 사용한 **실전 에러 핸들링 패턴**을 다룬다.
