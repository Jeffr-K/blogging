---
title: "[Rust 트레이트 시리즈] 29. io::Write: 바이트 스트림 쓰기"
author: anonymous.rs
date: 2026-01-03
tags: ["rust", "trait", "io", "write", "file", "network"]
---

# `io::Write`: 바이트 스트림에 쓰는 표준 방법

`std::io::Write` 트레이트는 `Read`의 반대 역할을 하는, 바이트(byte)를 쓸 수 있는 모든 종류의 출력 대상(destination, sink)에 대한 표준적인 추상화입니다. 파일, 네트워크 소켓, 인메모리 버퍼, 표준 출력(stdout) 등 `Write`를 구현하는 모든 타입에 동일한 방식으로 데이터를 쓸 수 있습니다.

## `Write` 트레이트의 핵심: `write`와 `flush`

`Write` 트레이트의 핵심 메서드는 `write`와 `flush`입니다.

```rust
use std::io;

pub trait Write {
    // 주어진 버퍼 `buf`의 내용을 출력 대상에 쓰려고 시도합니다.
    fn write(&mut self, buf: &[u8]) -> io::Result<usize>;

    // 버퍼링된 모든 출력을 강제로 출력 대상에 보냅니다.
    fn flush(&mut self) -> io::Result<()>;
    
    // ... 다른 여러 헬퍼 메서드들 ...
}
```
-   **`write(&mut self, buf: &[u8]) -> io::Result<usize>`**:
    -   `buf`에 있는 바이트들을 출력 스트림에 씁니다.
    -   성공 시, 실제로 쓰인 바이트의 수 `n`을 `Ok(n)`으로 반환합니다. `n`은 `buf`의 길이보다 작을 수 있습니다(부분 쓰기, partial write). 운영체제나 네트워크 버퍼의 상태에 따라 한 번에 모든 데이터를 쓰지 못할 수 있기 때문입니다.
    -   실패 시 `Err`를 반환합니다.

-   **`flush(&mut self) -> io::Result<()>`**:
    -   많은 `Write` 구현체는 성능을 위해 내부적으로 버퍼링을 사용합니다. 예를 들어, 바이트를 하나씩 쓸 때마다 매번 디스크에 접근하는 대신, 메모리 버퍼에 모아두었다가 버퍼가 차면 한 번에 디스크에 씁니다.
    -   `flush`는 이 내부 버퍼에 남아있는 모든 데이터를 강제로 최종 목적지(디스크, 네트워크 등)로 보내도록 요청합니다.
    -   쓰기 작업이 끝났을 때 `flush`를 호출하여 모든 데이터가 확실히 기록되도록 보장하는 것이 좋습니다.

## `Write` 구현체 사용하기

`std::fs::File`을 생성 모드로 열면 `Write`를 구현한 핸들을 얻을 수 있습니다.

### `write_all`의 편리함

`write` 메서드는 부분 쓰기를 할 수 있어 반복문으로 처리해야 하는 불편함이 있습니다. 대부분의 경우 `Write` 트레이트가 기본으로 제공하는 `write_all` 헬퍼 메서드를 사용하는 것이 훨씬 편리합니다. `write_all`은 주어진 버퍼의 모든 내용이 다 쓰일 때까지 내부적으로 `write`를 반복 호출해 줍니다.

```rust
use std::fs::File;
use std::io::{self, Write};

fn main() -> io::Result<()> {
    // `output.txt` 파일을 생성하거나, 존재하면 내용을 덮어씁니다.
    let mut file = File::create("output.txt")?;

    let data1 = b"Hello, Rust!\n"; // 바이트 슬라이스 리터럴
    let data2 = "This is the second line.".as_bytes();

    // write_all을 사용하여 데이터 전체를 씁니다.
    file.write_all(data1)?;
    file.write_all(data2)?;

    // 모든 버퍼링된 데이터가 디스크에 완전히 쓰이도록 보장합니다.
    file.flush()?;

    println!("파일 쓰기 완료.");
    Ok(())
}
```

## `Write`를 받는 제네릭 함수

`Read`와 마찬가지로, `Write` 트레이트 경계를 사용하여 다양한 출력 대상에 데이터를 쓸 수 있는 제네릭 함수를 만들 수 있습니다.

```rust
use std::io::{self, Write};

// `Write`를 구현하는 모든 타입을 `writer`로 받을 수 있습니다.
fn log_data<W: Write>(mut writer: W, data: &[u8]) -> io::Result<()> {
    let timestamp = format!("[{}] ", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"));
    
    writer.write_all(timestamp.as_bytes())?;
    writer.write_all(data)?;
    writer.write_all(b"\n")?;
    writer.flush()?;
    
    Ok(())
}

fn main() -> io::Result<()> {
    // 1. 파일에 로그 쓰기
    let mut log_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open("app.log")?;
    log_data(&mut log_file, b"Application started.")?;

    // 2. 표준 출력(stdout)에 로그 쓰기
    let mut stdout_handle = io::stdout();
    log_data(&mut stdout_handle, b"Processing user request.")?;

    // 3. 인메모리 버퍼(Vec<u8>)에 로그 쓰기 (테스트에 유용)
    let mut in_memory_log = Vec::new();
    log_data(&mut in_memory_log, b"This is an in-memory log entry.")?;
    println!("메모리 로그: {}", String::from_utf8_lossy(&in_memory_log));

    Ok(())
}
```
위 `log_data` 함수는 출력 대상이 파일인지, 콘솔인지, 메모리 버퍼인지 전혀 신경 쓰지 않고 동일한 로직을 수행합니다. 이것이 바로 `io` 트레이트가 제공하는 추상화의 힘입니다.

## 결론

`io::Write`는 러스트에서 데이터를 쓰는 작업을 일반화하는 강력하고 유연한 트레이트입니다. `File`, `TcpStream`, `Vec<u8>`, `io::stdout` 등 다양한 출력 대상을 일관된 인터페이스로 다룰 수 있게 함으로써, 코드의 재사용성을 높이고 I/O 로직을 더 명확하고 테스트하기 쉽게 만들어 줍니다.
