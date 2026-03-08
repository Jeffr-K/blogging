---
title: "[Rust 환경 시리즈] 01. 환경 변수"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "env", "environment", "dotenv", "빌드"]
---

# 환경 변수

## 한 줄 요약

러스트에서 환경 변수를 다루는 방법은 **런타임(`std::env`)과 컴파일 타임(`env!`)** 두 가지다.

## 런타임 환경 변수 - `std::env`

프로그램이 실행될 때 OS에서 읽어오는 환경 변수다.

### `env::var()` - 기본

```rust
use std::env;

fn main() {
    // Result<String, VarError> 반환
    match env::var("DATABASE_URL") {
        Ok(url) => println!("DB: {}", url),
        Err(_) => println!("DATABASE_URL이 설정되지 않음"),
    }
}
```

`env::var()`는 `Result`를 반환한다. 환경 변수가 없거나 유효한 UTF-8이 아니면 `Err`.

### 실전 패턴들

```rust
use std::env;

// 기본값 제공
let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());

// 파싱과 결합
let port: u16 = env::var("PORT")
    .unwrap_or_else(|_| "8080".to_string())
    .parse()
    .expect("PORT는 유효한 숫자여야 함");

// 존재 여부만 확인
let debug = env::var("DEBUG").is_ok();

// 여러 환경 변수를 구조체로
struct Config {
    db_url: String,
    port: u16,
    debug: bool,
}

impl Config {
    fn from_env() -> Result<Self, String> {
        Ok(Config {
            db_url: env::var("DATABASE_URL")
                .map_err(|_| "DATABASE_URL 필수".to_string())?,
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .map_err(|_| "PORT가 유효한 숫자가 아님".to_string())?,
            debug: env::var("DEBUG").is_ok(),
        })
    }
}
```

### `env::vars()` - 전체 환경 변수 순회

```rust
for (key, value) in env::vars() {
    println!("{} = {}", key, value);
}

// 필터링
let rust_vars: Vec<_> = env::vars()
    .filter(|(k, _)| k.starts_with("RUST"))
    .collect();
```

### `env::set_var()` / `env::remove_var()` - 환경 변수 수정

```rust
// 현재 프로세스의 환경 변수를 설정 (자식 프로세스에 상속됨)
unsafe {
    env::set_var("MY_VAR", "hello");
}
println!("{}", env::var("MY_VAR").unwrap());

unsafe {
    env::remove_var("MY_VAR");
}
```

Rust 1.66부터 `set_var`와 `remove_var`는 멀티스레드 환경에서 안전하지 않을 수 있어 `unsafe`가 권장된다.

### `env::args()` - 커맨드라인 인자

```rust
// cargo run -- hello world
fn main() {
    let args: Vec<String> = env::args().collect();
    println!("프로그램: {}", args[0]);

    for arg in &args[1..] {
        println!("인자: {}", arg);
    }
}
```

실전에서는 `clap` 크레이트를 쓰는 게 일반적이다.

### `env::current_dir()` / `env::current_exe()`

```rust
let cwd = env::current_dir().unwrap();
println!("현재 디렉토리: {}", cwd.display());

let exe = env::current_exe().unwrap();
println!("실행 파일 경로: {}", exe.display());
```

## 컴파일 타임 환경 변수 - `env!` / `option_env!`

**빌드할 때** 환경 변수를 읽어서 바이너리에 박아 넣는다. 런타임에는 환경 변수가 필요 없다.

### `env!` - 없으면 컴파일 에러

```rust
// 빌드 시 CARGO_PKG_VERSION 환경 변수를 읽어서 문자열로 박아 넣음
const VERSION: &str = env!("CARGO_PKG_VERSION");
const PKG_NAME: &str = env!("CARGO_PKG_NAME");

fn main() {
    println!("{} v{}", PKG_NAME, VERSION);
}
```

환경 변수가 없으면 **컴파일이 실패**한다.

```rust
// 커스텀 에러 메시지
const API_KEY: &str = env!("API_KEY", "API_KEY 환경 변수를 설정해주세요");
```

### `option_env!` - 없으면 None

```rust
const BUILD_SHA: Option<&str> = option_env!("GIT_SHA");

fn main() {
    match BUILD_SHA {
        Some(sha) => println!("빌드: {}", sha),
        None => println!("빌드: 개발 버전"),
    }
}
```

`option_env!`는 `Option<&'static str>`을 반환한다. 환경 변수가 없어도 컴파일은 된다.

### Cargo가 자동으로 설정하는 환경 변수

Cargo는 빌드 시 여러 환경 변수를 자동으로 설정한다.

| 환경 변수 | 값 | 예시 |
|----------|----|----|
| `CARGO_PKG_NAME` | 패키지 이름 | `"my-app"` |
| `CARGO_PKG_VERSION` | 버전 | `"0.1.0"` |
| `CARGO_PKG_AUTHORS` | 작성자 | `"ferris"` |
| `CARGO_PKG_DESCRIPTION` | 설명 | `"A cool app"` |
| `CARGO_MANIFEST_DIR` | Cargo.toml 경로 | `"/home/user/my-app"` |
| `CARGO_PKG_HOMEPAGE` | 홈페이지 | `"https://example.com"` |

```rust
fn print_about() {
    println!("{} v{}", env!("CARGO_PKG_NAME"), env!("CARGO_PKG_VERSION"));
    println!("{}", env!("CARGO_PKG_DESCRIPTION"));
}
```

### 빌드 스크립트에서 환경 변수 설정 (`build.rs`)

```rust
// build.rs
fn main() {
    // 빌드 시점의 git hash를 환경 변수로 설정
    let output = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .expect("git 명령 실패");

    let git_hash = String::from_utf8(output.stdout).unwrap();
    println!("cargo:rustc-env=GIT_HASH={}", git_hash.trim());
}
```

```rust
// main.rs
const GIT_HASH: &str = env!("GIT_HASH");

fn main() {
    println!("빌드 커밋: {}", GIT_HASH);
}
```

`build.rs`에서 `cargo:rustc-env=KEY=VALUE`를 출력하면 소스 코드에서 `env!("KEY")`로 읽을 수 있다.

## `.env` 파일 - `dotenvy` 크레이트

개발 환경에서 환경 변수를 `.env` 파일로 관리하는 패턴이다.

```toml
[dependencies]
dotenvy = "0.15"
```

```
# .env
DATABASE_URL=postgres://localhost/mydb
PORT=3000
DEBUG=1
```

```rust
fn main() {
    // .env 파일의 내용을 환경 변수로 로드
    dotenvy::dotenv().ok();

    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL 필수");
    println!("DB: {}", db_url);
}
```

`.env` 파일은 `.gitignore`에 추가하고, `.env.example`을 커밋하는 게 관례다.

```
# .gitignore
.env

# .env.example (커밋)
DATABASE_URL=postgres://localhost/mydb
PORT=3000
```

## 런타임 vs 컴파일 타임 정리

| 특성 | `std::env::var()` | `env!()` / `option_env!()` |
|------|-------------------|---------------------------|
| 시점 | 런타임 | 컴파일 타임 |
| 반환 타입 | `Result<String, VarError>` | `&'static str` / `Option<&'static str>` |
| 변수 없을 때 | `Err` 반환 | 컴파일 에러 / `None` |
| 값 변경 | 프로세스마다 다를 수 있음 | 바이너리에 고정 |
| 용도 | DB URL, 포트, 시크릿 | 버전, 빌드 정보, feature 설정 |

```rust
// 이건 실행할 때마다 다를 수 있다 (런타임)
let port = std::env::var("PORT");

// 이건 빌드할 때 박혀서 영원히 같다 (컴파일 타임)
const VERSION: &str = env!("CARGO_PKG_VERSION");
```

## 정리

- `std::env::var()` — 런타임에 환경 변수 읽기 (`Result` 반환)
- `env!()` — 컴파일 타임에 읽어서 바이너리에 박기 (없으면 컴파일 에러)
- `option_env!()` — 컴파일 타임에 읽되, 없으면 `None`
- `build.rs` — 빌드 스크립트에서 커스텀 환경 변수 설정
- `dotenvy` — `.env` 파일로 개발 환경 관리

다음 글에서는 `#[cfg]`와 `cfg!`로 **OS, feature flag에 따라 코드를 분기**하는 조건부 컴파일을 다룬다.
