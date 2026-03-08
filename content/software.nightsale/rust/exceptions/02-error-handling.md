---
title: "[Rust 에러 핸들링 시리즈] 02. ? 연산자와 에러 전파"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "error", "question-mark", "from", "에러전파"]
---

# `?` 연산자와 에러 전파

## 한 줄 요약

`?` 연산자는 **"에러면 바로 반환, 성공이면 값을 꺼내라"**의 축약이다.

## 문제: `match` 지옥

에러를 처리할 때마다 `match`를 쓰면 코드가 빠르게 더러워진다.

```rust
use std::fs;
use std::io;

fn read_username() -> Result<String, io::Error> {
    let content = match fs::read_to_string("username.txt") {
        Ok(c) => c,
        Err(e) => return Err(e),
    };

    let trimmed = match content.trim().parse::<String>() {
        Ok(t) => t,
        Err(_) => return Err(io::Error::new(io::ErrorKind::InvalidData, "파싱 실패")),
    };

    Ok(trimmed)
}
```

반복되는 패턴: `Ok`면 꺼내고, `Err`면 반환. 이걸 자동화한 게 `?`다.

## `?` 연산자

```rust
fn read_username() -> Result<String, io::Error> {
    let content = fs::read_to_string("username.txt")?;
    Ok(content.trim().to_string())
}
```

`?`가 하는 일:
1. `Ok(val)` → `val`을 꺼냄
2. `Err(e)` → 즉시 `return Err(e.into())`

### 더 줄이면

```rust
fn read_username() -> Result<String, io::Error> {
    Ok(fs::read_to_string("username.txt")?.trim().to_string())
}
```

### 체이닝

```rust
use std::fs::File;
use std::io::{self, Read};

fn read_username() -> Result<String, io::Error> {
    let mut content = String::new();
    File::open("username.txt")?.read_to_string(&mut content)?;
    Ok(content.trim().to_string())
}
```

`?`를 연속으로 쓸 수 있다. 어디서든 에러가 나면 거기서 바로 반환.

## `?`는 `From` 트레이트로 에러를 변환한다

`?`는 단순한 반환이 아니다. `.into()`를 호출해서 에러 타입을 **자동 변환**한다.

```rust
use std::num::ParseIntError;
use std::io;

#[derive(Debug)]
enum AppError {
    Io(io::Error),
    Parse(ParseIntError),
}

impl From<io::Error> for AppError {
    fn from(e: io::Error) -> Self {
        AppError::Io(e)
    }
}

impl From<ParseIntError> for AppError {
    fn from(e: ParseIntError) -> Self {
        AppError::Parse(e)
    }
}

fn load_port() -> Result<u16, AppError> {
    let content = std::fs::read_to_string("port.txt")?;  // io::Error → AppError
    let port = content.trim().parse::<u16>()?;             // ParseIntError → AppError
    Ok(port)
}
```

`?`가 `From::from()`을 호출하니까, `From` 구현만 있으면 서로 다른 에러 타입을 하나의 에러 타입으로 통합할 수 있다.

## `Option`에도 `?` 사용 가능

```rust
fn last_char_of_first_line(text: &str) -> Option<char> {
    text.lines().next()?.chars().last()
}
```

`None`이면 바로 `return None`. `Some`이면 값을 꺼냄.

단, `Option`의 `?`와 `Result`의 `?`를 같은 함수에서 섞을 수 없다.

```rust
// 컴파일 에러! Option과 Result의 ?를 섞을 수 없음
fn mixed() -> Result<char, String> {
    let first = "hello".lines().next()?;  // Option의 ? → 반환 타입 불일치
    Ok(first.chars().last().unwrap())
}

// 해결: .ok_or()로 변환
fn mixed() -> Result<char, String> {
    let first = "hello".lines().next().ok_or("빈 텍스트")?;
    first.chars().last().ok_or("빈 줄".into())
}
```

## 커스텀 에러 타입

### 열거형으로 정의

```rust
use std::fmt;
use std::io;
use std::num::ParseIntError;

#[derive(Debug)]
enum ConfigError {
    FileNotFound(io::Error),
    InvalidFormat(String),
    InvalidPort(ParseIntError),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ConfigError::FileNotFound(e) => write!(f, "설정 파일 없음: {}", e),
            ConfigError::InvalidFormat(msg) => write!(f, "형식 오류: {}", msg),
            ConfigError::InvalidPort(e) => write!(f, "포트 파싱 실패: {}", e),
        }
    }
}

impl std::error::Error for ConfigError {}

impl From<io::Error> for ConfigError {
    fn from(e: io::Error) -> Self {
        ConfigError::FileNotFound(e)
    }
}

impl From<ParseIntError> for ConfigError {
    fn from(e: ParseIntError) -> Self {
        ConfigError::InvalidPort(e)
    }
}
```

### 사용

```rust
fn load_config() -> Result<Config, ConfigError> {
    let content = std::fs::read_to_string("config.toml")?;  // io::Error → ConfigError
    let port_str = content.lines()
        .find(|l| l.starts_with("port="))
        .ok_or(ConfigError::InvalidFormat("port 필드 없음".into()))?;

    let port: u16 = port_str[5..].trim().parse()?;  // ParseIntError → ConfigError
    Ok(Config { port })
}
```

## `std::error::Error` 트레이트

러스트의 에러 타입이 구현해야 하는 표준 트레이트다.

```rust
pub trait Error: Display + Debug {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        None
    }
}
```

`Display` + `Debug`가 필수이고, `source()`로 원인 에러를 체인할 수 있다.

```rust
impl std::error::Error for ConfigError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ConfigError::FileNotFound(e) => Some(e),
            ConfigError::InvalidPort(e) => Some(e),
            ConfigError::InvalidFormat(_) => None,
        }
    }
}
```

## `Box<dyn Error>` - 간편한 에러 타입

커스텀 에러 타입을 만들기 귀찮을 때, 모든 에러를 담을 수 있는 박스를 쓴다.

```rust
use std::error::Error;

fn do_something() -> Result<(), Box<dyn Error>> {
    let content = std::fs::read_to_string("file.txt")?;
    let number: i32 = content.trim().parse()?;
    println!("{}", number);
    Ok(())
}
```

`Box<dyn Error>`는 `From`을 자동으로 구현하기 때문에 어떤 에러든 `?`로 전파할 수 있다.

단점: 에러 타입이 지워지므로 호출자가 **구체적인 에러 종류를 구분할 수 없다**.

### `main()`에서 `Result` 반환

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = load_config()?;
    let data = fetch_data(&config)?;
    process(data)?;
    Ok(())
}
```

`main()`이 `Result`를 반환하면, `Err` 시 에러 메시지를 출력하고 종료 코드 1로 끝난다.

## 정리

| 개념 | 역할 |
|------|------|
| `?` 연산자 | 에러면 반환, 성공이면 꺼냄 |
| `From` 변환 | `?`가 자동으로 에러 타입 변환 |
| 커스텀 에러 | 열거형 + `Display` + `Error` + `From` |
| `Box<dyn Error>` | 간편하지만 타입 정보 손실 |
| `Error::source()` | 에러 원인 체인 |

- `?`는 에러 전파의 핵심이다
- 라이브러리는 구체적인 커스텀 에러 타입을, 바이너리는 `Box<dyn Error>`를 쓰는 게 관례
- 다음 글에서는 `panic!`과 복구 불가능한 에러를 다룬다
