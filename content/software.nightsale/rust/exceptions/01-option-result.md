---
title: "[Rust 에러 핸들링 시리즈] 01. Option과 Result"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "option", "result", "에러", "기초"]
---

# Option과 Result

## 한 줄 요약

러스트에는 `null`도 `exception`도 없다. 대신 **`Option`과 `Result` 타입으로 실패를 표현**한다.

## 다른 언어와 비교

| 언어 | 값 없음 | 에러 처리 |
|------|--------|----------|
| Java/C# | `null` | `try-catch` 예외 |
| Python | `None` | `try-except` 예외 |
| Go | 제로값 + `error` 반환 | `if err != nil` |
| Rust | `Option<T>` | `Result<T, E>` |

러스트는 "실패할 수 있는 연산"을 **타입**으로 표현한다. 에러를 무시하면 컴파일이 안 된다.

## `Option<T>` - 값이 있거나 없거나

```rust
enum Option<T> {
    Some(T),  // 값이 있음
    None,     // 값이 없음
}
```

### 기본 사용

```rust
fn find_user(id: u32) -> Option<String> {
    if id == 1 {
        Some("ferris".to_string())
    } else {
        None
    }
}

fn main() {
    let user = find_user(1);

    // match로 처리
    match user {
        Some(name) => println!("찾음: {}", name),
        None => println!("없음"),
    }
}
```

### 왜 `null` 대신 `Option`인가

```java
// Java: null 체크를 까먹으면 런타임에 NullPointerException
String name = findUser(42);
System.out.println(name.length());  // 💥 NPE 가능
```

```rust
// Rust: Option을 처리하지 않으면 컴파일 에러
let name = find_user(42);
// println!("{}", name.len());  // 컴파일 에러! Option<String>에는 len()이 없음

// 반드시 Some/None을 처리해야 함
if let Some(name) = find_user(42) {
    println!("{}", name.len());  // 안전
}
```

## `Option`의 유용한 메서드들

### `unwrap()` / `expect()` - 값 꺼내기 (위험)

```rust
let x: Option<i32> = Some(42);
let val = x.unwrap();       // 42
let val = x.expect("비어있으면 안 됨");  // 42

let y: Option<i32> = None;
// y.unwrap();       // 패닉!
// y.expect("메시지");  // 패닉! "메시지" 출력
```

`unwrap()`은 프로토타이핑이나 "절대 None일 수 없는" 상황에서만 쓴다.

### `unwrap_or()` / `unwrap_or_else()` - 기본값

```rust
let port = env_var("PORT").unwrap_or(8080);

let config = load_config().unwrap_or_else(|| {
    println!("기본 설정 사용");
    Config::default()
});
```

### `map()` - 값이 있으면 변환

```rust
let maybe_len: Option<usize> = Some("hello").map(|s| s.len());
// Some(5)

let nothing: Option<usize> = None::<&str>.map(|s| s.len());
// None
```

`map`은 `Some`이면 변환하고, `None`이면 그냥 `None`을 반환한다.

### `and_then()` - 체이닝 (flatMap)

```rust
fn parse_port(s: &str) -> Option<u16> {
    s.parse().ok()
}

let port = Some("8080")
    .and_then(parse_port);
// Some(8080)

let port = Some("abc")
    .and_then(parse_port);
// None
```

`map`은 `Option<Option<T>>`가 될 수 있지만, `and_then`은 평탄하게 유지한다.

### `filter()` - 조건 확인

```rust
let even = Some(4).filter(|&x| x % 2 == 0);  // Some(4)
let odd = Some(3).filter(|&x| x % 2 == 0);   // None
```

### `is_some()` / `is_none()`

```rust
let x: Option<i32> = Some(42);
println!("{}", x.is_some());  // true
println!("{}", x.is_none());  // false
```

### 메서드 체이닝

```rust
fn get_username(id: u32) -> Option<String> {
    find_user(id)
        .filter(|name| !name.is_empty())
        .map(|name| name.to_uppercase())
}
```

## `Result<T, E>` - 성공이거나 실패거나

```rust
enum Result<T, E> {
    Ok(T),   // 성공, 값은 T
    Err(E),  // 실패, 에러는 E
}
```

### 기본 사용

```rust
use std::fs;

fn read_config() -> Result<String, std::io::Error> {
    fs::read_to_string("config.toml")
}

fn main() {
    match read_config() {
        Ok(content) => println!("설정: {}", content),
        Err(e) => println!("에러: {}", e),
    }
}
```

### `Result`의 유용한 메서드들

`Option`과 거의 같은 메서드를 제공한다.

```rust
// unwrap / expect
let content = fs::read_to_string("file.txt").unwrap();
let content = fs::read_to_string("file.txt").expect("파일 읽기 실패");

// unwrap_or / unwrap_or_else
let content = fs::read_to_string("file.txt")
    .unwrap_or_else(|_| "기본값".to_string());

// map — Ok 값 변환
let length: Result<usize, _> = fs::read_to_string("file.txt")
    .map(|s| s.len());

// map_err — Err 값 변환
let result = fs::read_to_string("file.txt")
    .map_err(|e| format!("파일 에러: {}", e));

// and_then — 체이닝
let parsed: Result<i32, String> = "42".parse::<i32>()
    .map_err(|e| e.to_string())
    .and_then(|n| {
        if n > 0 { Ok(n) } else { Err("양수만 가능".into()) }
    });
```

### `ok()` / `err()` - Option으로 변환

```rust
let x: Result<i32, &str> = Ok(42);
let y: Option<i32> = x.ok();   // Some(42)

let x: Result<i32, &str> = Err("에러");
let y: Option<&str> = x.err(); // Some("에러")
```

## `Option` vs `Result`

| 상황 | 사용 |
|------|------|
| 값이 없을 수 있음 (에러가 아님) | `Option<T>` |
| 실패할 수 있고 원인을 알아야 함 | `Result<T, E>` |

```rust
// Option: 검색 결과가 없을 수 있음 (에러는 아님)
fn find(haystack: &str, needle: char) -> Option<usize> {
    haystack.find(needle)
}

// Result: 파일 읽기가 실패할 수 있음 (원인이 중요)
fn read_file(path: &str) -> Result<String, std::io::Error> {
    std::fs::read_to_string(path)
}
```

## 실전 패턴: `Option`과 `Result` 변환

```rust
// Option → Result
let opt: Option<i32> = Some(42);
let res: Result<i32, &str> = opt.ok_or("값이 없음");

// lazy 버전
let res: Result<i32, String> = opt.ok_or_else(|| format!("값이 없음"));

// Result → Option
let res: Result<i32, &str> = Ok(42);
let opt: Option<i32> = res.ok();
```

### 벡터에서 Result 수집

```rust
let strings = vec!["1", "2", "three", "4"];

// 하나라도 실패하면 전체 Err
let numbers: Result<Vec<i32>, _> = strings.iter()
    .map(|s| s.parse::<i32>())
    .collect();

println!("{:?}", numbers);  // Err(ParseIntError)

// 성공한 것만 모으기
let numbers: Vec<i32> = strings.iter()
    .filter_map(|s| s.parse::<i32>().ok())
    .collect();

println!("{:?}", numbers);  // [1, 2, 4]
```

## 정리

- `Option<T>` = `Some(T)` 또는 `None`. null 대체
- `Result<T, E>` = `Ok(T)` 또는 `Err(E)`. 예외 대체
- 둘 다 `map`, `and_then`, `unwrap_or` 등 풍부한 메서드 제공
- 에러를 무시하면 컴파일 에러 → 안전

다음 글에서는 `?` 연산자로 에러를 우아하게 전파하는 방법을 다룬다.
