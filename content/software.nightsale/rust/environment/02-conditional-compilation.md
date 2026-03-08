---
title: "[Rust 환경 시리즈] 02. 조건부 컴파일"
author: anonymous.rs
date: 2026-02-18
tags: ["rust", "cfg", "feature", "conditional-compilation", "크로스플랫폼"]
---

# 조건부 컴파일

## 한 줄 요약

`#[cfg]`와 `cfg!`는 **OS, 아키텍처, feature flag에 따라 컴파일할 코드를 고르는** 장치다.

## 왜 필요한가

- Linux에서는 `epoll`, macOS에서는 `kqueue`를 써야 할 때
- 유료 기능과 무료 기능을 같은 코드베이스에서 관리할 때
- 테스트에서만 필요한 헬퍼 함수가 있을 때
- 디버그 빌드에서만 로그를 남기고 싶을 때

C의 `#ifdef`와 비슷하지만, 러스트의 `cfg`는 **타입 시스템과 통합**되어 훨씬 안전하다.

## `#[cfg]` 속성 - 코드 포함/제외

조건이 참이면 코드가 **컴파일에 포함**되고, 거짓이면 **아예 존재하지 않는 것**처럼 된다.

### OS 분기

```rust
#[cfg(target_os = "linux")]
fn get_config_path() -> &'static str {
    "/etc/myapp/config.toml"
}

#[cfg(target_os = "macos")]
fn get_config_path() -> &'static str {
    "/Library/Application Support/myapp/config.toml"
}

#[cfg(target_os = "windows")]
fn get_config_path() -> &'static str {
    r"C:\ProgramData\myapp\config.toml"
}
```

Linux에서 빌드하면 `macos`와 `windows` 버전은 컴파일러가 아예 무시한다.

### OS 패밀리

```rust
#[cfg(unix)]
fn set_permissions(path: &str) {
    // chmod 등 Unix 전용 코드
}

#[cfg(windows)]
fn set_permissions(path: &str) {
    // Windows ACL 코드
}
```

| cfg 값 | 포함되는 OS |
|--------|-----------|
| `unix` | Linux, macOS, FreeBSD 등 |
| `windows` | Windows |
| `target_os = "linux"` | Linux만 |
| `target_os = "macos"` | macOS만 |

### 아키텍처 분기

```rust
#[cfg(target_arch = "x86_64")]
fn fast_compute() {
    // SIMD 최적화 코드
}

#[cfg(target_arch = "aarch64")]
fn fast_compute() {
    // ARM NEON 최적화 코드
}
```

## `cfg!` 매크로 - 런타임 분기

`#[cfg]`는 코드를 제거하지만, `cfg!`는 `bool` 값을 반환한다. 코드는 컴파일에 포함되지만 **조건에 따라 실행 여부가 결정**된다.

```rust
fn main() {
    if cfg!(target_os = "linux") {
        println!("Linux에서 실행 중");
    } else if cfg!(target_os = "macos") {
        println!("macOS에서 실행 중");
    } else {
        println!("기타 OS");
    }
}
```

### `#[cfg]` vs `cfg!`

```rust
// #[cfg]: 조건이 거짓이면 함수 자체가 사라짐
#[cfg(feature = "premium")]
fn premium_feature() { /* ... */ }

// cfg!: 코드는 항상 컴파일됨, 조건에 따라 분기만
fn do_something() {
    if cfg!(feature = "premium") {
        println!("프리미엄 기능");
    } else {
        println!("무료 기능");
    }
}
```

| 특성 | `#[cfg]` | `cfg!` |
|------|---------|--------|
| 동작 | 코드 포함/제외 | `bool` 반환 |
| 거짓일 때 | 코드가 사라짐 | 코드는 있지만 실행 안 됨 |
| 타입 검사 | 거짓 분기는 검사 안 됨 | 모든 분기가 검사됨 |
| 용도 | 플랫폼별 함수, 모듈 | 간단한 조건 분기 |

## Feature Flag

Cargo의 feature 시스템으로 선택적 기능을 켜고 끌 수 있다.

### `Cargo.toml`에서 정의

```toml
[features]
default = ["json"]     # 기본으로 켜지는 feature
json = ["serde_json"]  # json feature → serde_json 의존성 활성화
premium = []           # 추가 의존성 없는 feature
logging = ["tracing"]  # logging feature → tracing 의존성 활성화

[dependencies]
serde_json = { version = "1", optional = true }
tracing = { version = "0.1", optional = true }
```

### 코드에서 사용

```rust
#[cfg(feature = "json")]
pub mod json_parser {
    pub fn parse(input: &str) -> serde_json::Value {
        serde_json::from_str(input).unwrap()
    }
}

#[cfg(feature = "premium")]
pub fn advanced_analytics(data: &[f64]) -> AnalyticsReport {
    // 프리미엄 전용 분석 기능
}

pub fn basic_analytics(data: &[f64]) -> f64 {
    data.iter().sum::<f64>() / data.len() as f64
}
```

### 빌드 시 feature 선택

```bash
# 기본 feature만
cargo build

# 특정 feature 활성화
cargo build --features "premium,logging"

# 기본 feature 끄고 특정 것만
cargo build --no-default-features --features "json"

# 모든 feature 활성화
cargo build --all-features
```

### Feature 분기 실전 패턴

```rust
pub struct Client {
    url: String,
    #[cfg(feature = "auth")]
    token: Option<String>,
}

impl Client {
    pub fn new(url: &str) -> Self {
        Client {
            url: url.to_string(),
            #[cfg(feature = "auth")]
            token: None,
        }
    }

    #[cfg(feature = "auth")]
    pub fn with_token(mut self, token: &str) -> Self {
        self.token = Some(token.to_string());
        self
    }

    pub fn get(&self, path: &str) -> Result<String, Error> {
        let mut req = build_request(&self.url, path);

        #[cfg(feature = "auth")]
        if let Some(ref token) = self.token {
            req.header("Authorization", format!("Bearer {}", token));
        }

        req.send()
    }
}
```

## 논리 조합

`#[cfg]`에 `all`, `any`, `not`을 쓸 수 있다.

```rust
// AND: 둘 다 만족
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn linux_amd64_only() { /* ... */ }

// OR: 하나라도 만족
#[cfg(any(target_os = "linux", target_os = "macos"))]
fn unix_like() { /* ... */ }

// NOT: 부정
#[cfg(not(target_os = "windows"))]
fn not_windows() { /* ... */ }

// 복합
#[cfg(all(
    unix,
    not(target_os = "macos"),
    feature = "advanced"
))]
fn linux_advanced_only() { /* ... */ }
```

## `cfg_attr` - 조건부 속성 적용

조건에 따라 **다른 속성**을 붙인다.

```rust
// release 빌드에서만 인라인
#[cfg_attr(not(debug_assertions), inline(always))]
fn hot_path() { /* ... */ }

// feature에 따라 derive 추가
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Config {
    pub name: String,
    pub port: u16,
}
```

`serde` feature가 켜져 있으면 `Serialize`/`Deserialize`도 derive된다. 꺼져 있으면 `Debug`/`Clone`만.

이 패턴은 크레이트 개발에서 매우 자주 쓰인다. serde 지원을 선택적으로 제공할 때 표준 패턴이다.

## 디버그 vs 릴리즈

```rust
// 디버그 빌드에서만
#[cfg(debug_assertions)]
fn debug_log(msg: &str) {
    eprintln!("[DEBUG] {}", msg);
}

// 릴리즈에서는 아무것도 안 함
#[cfg(not(debug_assertions))]
fn debug_log(_msg: &str) {}
```

```rust
// 또는 cfg!로 간단하게
fn process(data: &[u8]) {
    if cfg!(debug_assertions) {
        println!("데이터 크기: {} bytes", data.len());
    }
    // 실제 처리
}
```

| 조건 | `cargo build` | `cargo build --release` |
|------|--------------|------------------------|
| `debug_assertions` | true | false |
| `not(debug_assertions)` | false | true |

## 테스트 전용 코드

```rust
// 테스트에서만 컴파일되는 모듈
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }
}

// 테스트에서만 쓰이는 헬퍼
#[cfg(test)]
fn make_test_data() -> Vec<i32> {
    vec![1, 2, 3, 4, 5]
}
```

`#[cfg(test)]`는 `cargo test`에서만 컴파일된다. 프로덕션 바이너리에는 포함되지 않는다.

## 사용 가능한 cfg 조건 목록

| 조건 | 예시 | 설명 |
|------|------|------|
| `target_os` | `"linux"`, `"macos"`, `"windows"` | 운영체제 |
| `target_arch` | `"x86_64"`, `"aarch64"` | CPU 아키텍처 |
| `target_family` | `"unix"`, `"windows"` | OS 패밀리 |
| `unix` / `windows` | - | `target_family`의 축약 |
| `target_env` | `"gnu"`, `"musl"`, `"msvc"` | C 런타임 |
| `target_pointer_width` | `"32"`, `"64"` | 포인터 크기 |
| `target_endian` | `"little"`, `"big"` | 바이트 순서 |
| `feature` | `"json"`, `"premium"` | Cargo feature |
| `debug_assertions` | - | 디버그 빌드 여부 |
| `test` | - | 테스트 빌드 여부 |
| `doc` | - | 문서 빌드 여부 |

## 정리

| 도구 | 역할 |
|------|------|
| `#[cfg(...)]` | 조건부 코드 포함/제외 |
| `cfg!(...)` | 조건을 `bool`로 반환 |
| `#[cfg_attr(...)]` | 조건부 속성 적용 |
| `feature = "..."` | Cargo feature flag 분기 |
| `debug_assertions` | 디버그/릴리즈 분기 |
| `#[cfg(test)]` | 테스트 전용 코드 |

- `#[cfg]`는 C의 `#ifdef`보다 안전하다. 타입 시스템과 통합되어 있고, Cargo feature와 연동된다
- feature flag로 선택적 의존성과 기능 분기를 깔끔하게 관리할 수 있다
- `cfg_attr`은 크레이트 개발에서 serde 등 선택적 지원의 표준 패턴이다
