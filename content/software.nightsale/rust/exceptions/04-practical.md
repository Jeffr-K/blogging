---
title: "[Rust 에러 핸들링 시리즈] 04. 실전 에러 패턴 - thiserror, anyhow"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "thiserror", "anyhow", "에러", "실전", "크레이트"]
---

# 실전 에러 패턴 - thiserror, anyhow

## 한 줄 요약

**라이브러리는 `thiserror`로 정확한 에러를, 바이너리는 `anyhow`로 편하게** 처리한다.

## 수동 에러 타입의 고통

02에서 커스텀 에러 타입을 만들었다. 실전에서는 이게 반복 노동이 된다.

```rust
// 매번 이걸 다 써야 한다
#[derive(Debug)]
enum MyError {
    Io(io::Error),
    Parse(ParseIntError),
    Custom(String),
}

impl fmt::Display for MyError { /* ... */ }
impl std::error::Error for MyError { /* ... */ }
impl From<io::Error> for MyError { /* ... */ }
impl From<ParseIntError> for MyError { /* ... */ }
```

에러 variant가 10개면? `Display`, `Error`, `From`을 10개씩 구현해야 한다.

## `thiserror` - 에러 타입 자동 생성

`thiserror`는 derive 매크로로 **보일러플레이트를 자동 생성**한다.

```toml
[dependencies]
thiserror = "2"
```

```rust
use thiserror::Error;

#[derive(Debug, Error)]
enum ConfigError {
    #[error("설정 파일을 읽을 수 없음: {0}")]
    FileNotFound(#[from] std::io::Error),

    #[error("포트 파싱 실패: {0}")]
    InvalidPort(#[from] std::num::ParseIntError),

    #[error("설정 형식 오류: {0}")]
    InvalidFormat(String),

    #[error("{field} 필드가 비어있음")]
    MissingField { field: String },
}
```

이게 자동으로 생성하는 것:
- `Display` 구현 (`#[error("...")]`의 메시지)
- `Error` 트레이트 구현
- `From` 구현 (`#[from]`이 붙은 것)
- `source()` 연결 (`#[from]` 또는 `#[source]`)

### 사용

```rust
fn load_config(path: &str) -> Result<Config, ConfigError> {
    let content = std::fs::read_to_string(path)?;  // io::Error → ConfigError (자동)

    let port_str = content.lines()
        .find(|l| l.starts_with("port="))
        .ok_or(ConfigError::MissingField { field: "port".into() })?;

    let port: u16 = port_str[5..].trim().parse()?;  // ParseIntError → ConfigError (자동)

    Ok(Config { port })
}
```

### `#[error]` 포맷 문법

```rust
#[derive(Debug, Error)]
enum AppError {
    // 위치 인자
    #[error("파일 에러: {0}")]
    Io(#[from] io::Error),

    // 필드 이름
    #[error("유저 {user_id}를 찾을 수 없음")]
    UserNotFound { user_id: u32 },

    // 메서드 호출
    #[error("잘못된 헤더 (길이: {}, 예상: {})", .actual, .expected)]
    InvalidHeader { actual: usize, expected: usize },

    // Display 대신 Debug 사용
    #[error("내부 에러: {0:?}")]
    Internal(Box<dyn std::error::Error>),
}
```

### `#[source]` vs `#[from]`

```rust
#[derive(Debug, Error)]
enum DbError {
    // #[from]: From 구현 + source() 연결
    #[error("연결 실패")]
    Connection(#[from] io::Error),

    // #[source]: source()만 연결 (From은 생성 안 함)
    #[error("쿼리 실패: {query}")]
    Query {
        query: String,
        #[source]
        cause: io::Error,
    },
}
```

`#[from]`은 `From` + `source()`, `#[source]`는 `source()`만.

## `anyhow` - 바이너리 코드의 에러 처리

`anyhow`는 **모든 에러를 담을 수 있는 범용 에러 타입**이다.

```toml
[dependencies]
anyhow = "1"
```

```rust
use anyhow::{Result, Context};

fn main() -> Result<()> {
    let config = load_config("config.toml")
        .context("설정 로드 실패")?;

    let data = fetch_data(&config.url)
        .context("데이터 가져오기 실패")?;

    process(data)
        .context("데이터 처리 실패")?;

    Ok(())
}
```

### `anyhow::Result<T>`

`Result<T, anyhow::Error>`의 별칭이다. 반환 타입에서 에러 타입을 생략할 수 있다.

```rust
use anyhow::Result;

// 이것은
fn foo() -> Result<String> { ... }

// 이것과 같다
fn foo() -> Result<String, anyhow::Error> { ... }
```

### `context()` - 에러에 맥락 추가

```rust
use anyhow::Context;

fn read_config(path: &str) -> Result<Config> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("'{}' 파일을 읽을 수 없음", path))?;

    let config: Config = toml::from_str(&content)
        .context("TOML 파싱 실패")?;

    Ok(config)
}
```

에러 체인이 만들어진다:

```
Error: 설정 로드 실패

Caused by:
    0: 'config.toml' 파일을 읽을 수 없음
    1: No such file or directory (os error 2)
```

### `anyhow!` / `bail!` 매크로

```rust
use anyhow::{anyhow, bail};

// 에러 생성
fn validate(age: i32) -> Result<()> {
    if age < 0 {
        return Err(anyhow!("나이는 음수일 수 없음: {}", age));
    }
    Ok(())
}

// bail! = return Err(anyhow!(...))
fn validate(age: i32) -> Result<()> {
    if age < 0 {
        bail!("나이는 음수일 수 없음: {}", age);
    }
    Ok(())
}
```

### `ensure!` 매크로

```rust
use anyhow::ensure;

fn process(data: &[u8]) -> Result<()> {
    ensure!(!data.is_empty(), "데이터가 비어있음");
    ensure!(data.len() <= 1024, "데이터가 너무 큼: {} bytes", data.len());
    // ...
    Ok(())
}
```

`ensure!`는 `assert!`의 `Result` 버전이다. 조건이 거짓이면 `Err`를 반환한다 (패닉이 아님).

## `thiserror` vs `anyhow` 선택 기준

| 기준 | `thiserror` | `anyhow` |
|------|------------|---------|
| 대상 | 라이브러리 | 바이너리(앱) |
| 에러 타입 | 구체적 열거형 | `anyhow::Error` (범용) |
| 호출자가 에러 종류 구분 | 가능 | 어려움 |
| 보일러플레이트 | 적음 (derive) | 없음 |
| 맥락 추가 | 수동 | `.context()` |

```
┌─────────────┐     ┌─────────────────┐
│ 라이브러리   │     │ 바이너리(main)   │
│             │     │                 │
│ thiserror   │ ──→ │ anyhow          │
│ (정확한 에러)│     │ (편한 에러 처리)  │
└─────────────┘     └─────────────────┘
```

라이브러리는 사용자가 에러를 `match`로 구분할 수 있어야 하니 `thiserror`. 바이너리는 에러를 로그 찍고 보여주면 되니 `anyhow`.

## 실전 프로젝트 구조

```rust
// errors.rs (thiserror)
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("DB 에러")]
    Database(#[from] sqlx::Error),

    #[error("인증 실패: {0}")]
    Auth(String),

    #[error("유효하지 않은 입력: {0}")]
    Validation(String),

    #[error("외부 API 에러")]
    External(#[from] reqwest::Error),
}

// handler.rs
async fn create_user(req: Request) -> Result<Response, AppError> {
    let input = validate_input(&req)?;     // Validation 에러
    let user = db.insert_user(input).await?;  // Database 에러
    notify_service(&user).await?;           // External 에러
    Ok(Response::created(user))
}

// main.rs (anyhow로 최종 처리)
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = load_config().context("설정 로드 실패")?;
    let db = connect_db(&config).await.context("DB 연결 실패")?;
    start_server(db).await.context("서버 시작 실패")?;
    Ok(())
}
```

## 에러 처리 가이드라인 정리

| 상황 | 방법 |
|------|------|
| 값이 없을 수 있음 | `Option<T>` |
| 실패할 수 있고 원인이 중요 | `Result<T, E>` |
| 에러 전파 | `?` 연산자 |
| 라이브러리 에러 타입 | `thiserror` |
| 바이너리 에러 처리 | `anyhow` |
| 에러에 맥락 추가 | `.context()` / `.with_context()` |
| 프로그래머 버그 | `panic!` / `assert!` |
| 프로토타이핑 | `unwrap()` / `todo!()` |

## 시리즈 정리

1. **Option/Result** — null과 예외 대신 타입으로 실패 표현
2. **? 연산자** — 에러 전파를 한 글자로
3. **panic!** — 복구 불가능한 에러, 버그 신호
4. **실전 패턴** — `thiserror`(라이브러리) + `anyhow`(바이너리)

러스트의 에러 핸들링은 처음엔 번거롭지만, 익숙해지면 "컴파일되면 에러 처리가 빠짐없이 되어있다"는 확신을 준다. 그게 러스트가 안전한 이유다.
