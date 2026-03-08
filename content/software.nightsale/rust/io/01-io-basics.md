---
title: "[Rust I/O 시리즈] 01. I/O 기초 - Read, Write, 표준 입출력"
author: anonymous.rs
date: 2025-12-22
tags: ["rust", "io", "read", "write", "stdin", "stdout", "기초"]
---

# I/O 기초 - Read, Write, 표준 입출력

## 한 줄 요약

러스트의 I/O는 **`Read`와 `Write` 트레이트**를 중심으로 설계되어, 파일이든 네트워크든 같은 인터페이스로 다룬다.

## 다른 언어와 비교

| 언어 | I/O 모델 | 특징 |
|------|---------|------|
| C | `FILE*`, `read()`/`write()` | 저수준, 버퍼링 수동 관리 |
| Java | `InputStream`/`OutputStream` 계층 | 데코레이터 패턴, 장황 |
| Go | `io.Reader`/`io.Writer` 인터페이스 | 러스트와 유사 |
| Python | 파일 객체, `with open()` | GC + 컨텍스트 매니저 |
| Rust | `Read`/`Write` 트레이트 | Go와 유사하지만 소유권 시스템 통합 |

## `Read` 트레이트

바이트를 읽어오는 모든 것의 공통 인터페이스다.

```rust
pub trait Read {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize>;

    // 기본 구현이 있는 메서드들
    fn read_to_end(&mut self, buf: &mut Vec<u8>) -> io::Result<usize>;
    fn read_to_string(&mut self, buf: &mut String) -> io::Result<usize>;
    fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()>;
    // ...
}
```

`Read`를 구현하는 타입들:

| 타입 | 설명 |
|------|------|
| `File` | 파일 |
| `TcpStream` | TCP 소켓 |
| `&[u8]` | 바이트 슬라이스 |
| `Stdin` | 표준 입력 |
| `Cursor<Vec<u8>>` | 메모리 버퍼 |

### 기본 읽기

```rust
use std::io::Read;
use std::fs::File;

fn main() -> std::io::Result<()> {
    let mut file = File::open("data.txt")?;

    // 방법 1: 고정 크기 버퍼로 읽기
    let mut buf = [0u8; 1024];
    let bytes_read = file.read(&mut buf)?;
    println!("{}바이트 읽음", bytes_read);

    // 방법 2: 전부 읽기 (Vec<u8>)
    let mut file = File::open("data.txt")?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents)?;

    // 방법 3: 문자열로 읽기
    let mut file = File::open("data.txt")?;
    let mut text = String::new();
    file.read_to_string(&mut text)?;

    // 방법 4: 편의 함수 (파일 전체를 한 번에)
    let text = std::fs::read_to_string("data.txt")?;
    let bytes = std::fs::read("data.bin")?;

    Ok(())
}
```

### `read()`의 반환값

```rust
let n = reader.read(&mut buf)?;
```

- `n > 0` — n바이트를 읽었다
- `n == 0` — EOF (더 이상 데이터 없음)
- `Err(e)` — 에러 발생

`read()`는 **요청한 크기보다 적게 읽을 수 있다.** 정확히 N바이트를 읽으려면 `read_exact()`를 쓴다.

```rust
// read: 1024바이트 요청했지만 100바이트만 읽힐 수 있음
let n = file.read(&mut buf[..1024])?;  // n <= 1024

// read_exact: 정확히 1024바이트를 읽거나 에러
file.read_exact(&mut buf[..1024])?;
```

## `Write` 트레이트

바이트를 쓰는 모든 것의 공통 인터페이스다.

```rust
pub trait Write {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize>;
    fn flush(&mut self) -> io::Result<()>;

    // 기본 구현
    fn write_all(&mut self, buf: &[u8]) -> io::Result<()>;
    fn write_fmt(&mut self, fmt: fmt::Arguments<'_>) -> io::Result<()>;
    // ...
}
```

### 기본 쓰기

```rust
use std::io::Write;
use std::fs::File;

fn main() -> std::io::Result<()> {
    let mut file = File::create("output.txt")?;

    // 방법 1: 바이트 쓰기
    file.write(b"hello")?;

    // 방법 2: 전부 쓰기 (write는 부분 쓰기 가능, write_all은 전부)
    file.write_all(b"hello world\n")?;

    // 방법 3: 포맷팅
    write!(file, "name: {}, age: {}\n", "ferris", 10)?;
    writeln!(file, "다음 줄")?;

    // flush: 버퍼를 실제로 디스크에 반영
    file.flush()?;

    // 편의 함수
    std::fs::write("output.txt", "간단하게 쓰기")?;

    Ok(())
}
```

### `write()` vs `write_all()`

```rust
// write: 일부만 쓰일 수 있음 (네트워크 소켓에서 흔함)
let n = writer.write(data)?;  // n <= data.len()

// write_all: 전부 쓰거나 에러
writer.write_all(data)?;
```

네트워크 프로그래밍에서는 반드시 `write_all()`을 쓰거나, `write()` 반환값을 확인하고 나머지를 다시 보내야 한다.

## 표준 입출력 — stdin, stdout, stderr

```rust
use std::io::{self, Read, Write, BufRead};

fn main() -> io::Result<()> {
    // stdout
    let stdout = io::stdout();
    let mut out = stdout.lock();  // 잠금으로 성능 향상
    writeln!(out, "출력")?;

    // stderr
    let stderr = io::stderr();
    let mut err = stderr.lock();
    writeln!(err, "에러 메시지")?;

    // stdin
    let stdin = io::stdin();
    let mut input = String::new();
    stdin.read_line(&mut input)?;
    println!("입력: {}", input.trim());

    Ok(())
}
```

### `lock()`의 의미

`stdin()`, `stdout()`, `stderr()`는 호출할 때마다 내부 Mutex를 잠근다. 반복 호출 시 `lock()`으로 한 번만 잠그면 성능이 좋아진다.

```rust
// 느린 예: 매 줄마다 잠금
for line in lines {
    println!("{}", line);  // 매번 stdout 잠금/해제
}

// 빠른 예: 한 번만 잠금
let stdout = io::stdout();
let mut out = stdout.lock();
for line in lines {
    writeln!(out, "{}", line)?;
}
```

### 라인 단위 입력

```rust
use std::io::{self, BufRead};

let stdin = io::stdin();
for line in stdin.lock().lines() {
    let line = line?;
    if line.is_empty() { break; }
    println!("입력: {}", line);
}
```

## `io::Result<T>` — I/O 전용 Result

```rust
// std::io::Result<T>는 이것의 별칭
type Result<T> = std::result::Result<T, std::io::Error>;
```

### `io::Error`

```rust
use std::io::{self, ErrorKind};

fn check_file(path: &str) -> io::Result<String> {
    std::fs::read_to_string(path).map_err(|e| {
        match e.kind() {
            ErrorKind::NotFound => println!("파일 없음: {}", path),
            ErrorKind::PermissionDenied => println!("권한 없음: {}", path),
            _ => println!("기타 에러: {}", e),
        }
        e
    })
}

// 커스텀 io::Error 생성
fn validate(data: &[u8]) -> io::Result<()> {
    if data.is_empty() {
        return Err(io::Error::new(ErrorKind::InvalidData, "데이터가 비어있음"));
    }
    Ok(())
}
```

주요 `ErrorKind`:

| ErrorKind | 의미 |
|-----------|------|
| `NotFound` | 파일/경로 없음 |
| `PermissionDenied` | 권한 없음 |
| `ConnectionRefused` | 연결 거부 |
| `ConnectionReset` | 연결 초기화 |
| `TimedOut` | 시간 초과 |
| `InvalidData` | 잘못된 데이터 |
| `UnexpectedEof` | 예기치 않은 EOF |
| `WouldBlock` | 논블로킹에서 대기 필요 |

## `Cursor` — 메모리 버퍼를 I/O처럼

```rust
use std::io::{Cursor, Read, Write, Seek, SeekFrom};

let mut cursor = Cursor::new(Vec::new());

// 쓰기
cursor.write_all(b"hello world")?;

// 처음으로 되돌리기
cursor.set_position(0);

// 읽기
let mut output = String::new();
cursor.read_to_string(&mut output)?;
println!("{}", output);  // "hello world"
```

테스트에서 실제 파일 대신 `Cursor`를 쓰면 I/O 없이 테스트할 수 있다.

```rust
fn process<R: Read>(reader: &mut R) -> io::Result<usize> {
    let mut buf = String::new();
    reader.read_to_string(&mut buf)?;
    Ok(buf.len())
}

#[test]
fn test_process() {
    let mut cursor = Cursor::new(b"test data");
    assert_eq!(process(&mut cursor).unwrap(), 9);
}
```

## 제네릭 I/O 함수

`Read`/`Write` 트레이트 바운드로 어떤 I/O 소스든 받을 수 있다.

```rust
use std::io::{Read, Write};

fn copy_data<R: Read, W: Write>(reader: &mut R, writer: &mut W) -> io::Result<u64> {
    io::copy(reader, writer)
}

// 파일 → 파일
let mut src = File::open("input.txt")?;
let mut dst = File::create("output.txt")?;
copy_data(&mut src, &mut dst)?;

// 파일 → stdout
let mut src = File::open("input.txt")?;
let mut stdout = io::stdout();
copy_data(&mut src, &mut stdout)?;

// 메모리 → 파일
let mut data = Cursor::new(b"memory data");
let mut dst = File::create("output.txt")?;
copy_data(&mut data, &mut dst)?;
```

이것이 트레이트 기반 I/O의 힘이다. 소스와 대상이 무엇이든 같은 함수로 처리할 수 있다.

## 정리

| 트레이트 | 역할 | 핵심 메서드 |
|---------|------|-----------|
| `Read` | 바이트 읽기 | `read`, `read_to_end`, `read_to_string`, `read_exact` |
| `Write` | 바이트 쓰기 | `write`, `write_all`, `flush` |
| `BufRead` | 라인 단위 읽기 | `read_line`, `lines` |
| `Seek` | 위치 이동 | `seek`, `rewind` |

- `Read`/`Write` = 러스트 I/O의 핵심 추상화
- `io::Result<T>` = I/O 에러를 `ErrorKind`로 분류
- `Cursor` = 메모리 버퍼를 I/O처럼 사용 (테스트에 유용)
- 제네릭 함수로 소스에 무관한 I/O 로직 작성 가능

다음 글에서는 **파일 시스템 — Path, 디렉토리, 파일 조작**을 다룬다.
