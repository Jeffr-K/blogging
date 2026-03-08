---
title: "[Rust I/O 시리즈] 04. I/O 고급 - 커스텀 Reader/Writer, 네트워크, 직렬화"
author: anonymous.rs
date: 2025-12-25
tags: ["rust", "io", "network", "tcp", "serde", "custom", "advanced"]
---

# I/O 고급 — 커스텀 Read/Write, 네트워크 I/O, 직렬화

## 한 줄 요약

`Read`/`Write` 트레이트를 직접 구현하면 어떤 소스든 러스트의 I/O 생태계에 통합할 수 있다.

## 커스텀 `Read` 구현

`Read` 트레이트에서 구현해야 할 메서드는 단 하나: `read()`.

```rust
use std::io::{self, Read};

/// 무한히 같은 바이트를 반복하는 Reader
struct RepeatByte {
    byte: u8,
}

impl Read for RepeatByte {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        for b in buf.iter_mut() {
            *b = self.byte;
        }
        Ok(buf.len())
    }
}

// 사용
let mut reader = RepeatByte { byte: b'A' };
let mut buf = [0u8; 5];
reader.read_exact(&mut buf)?;
assert_eq!(&buf, b"AAAAA");
```

### 실전: 진행률 표시 Reader

```rust
use std::io::{self, Read};

struct ProgressReader<R: Read> {
    inner: R,
    bytes_read: u64,
    total: u64,
}

impl<R: Read> ProgressReader<R> {
    fn new(inner: R, total: u64) -> Self {
        Self { inner, bytes_read: 0, total }
    }
}

impl<R: Read> Read for ProgressReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let n = self.inner.read(buf)?;
        self.bytes_read += n as u64;
        if self.total > 0 {
            let pct = (self.bytes_read as f64 / self.total as f64) * 100.0;
            eprint!("\r진행: {:.1}%", pct);
        }
        Ok(n)
    }
}

// 사용
let file = std::fs::File::open("large_file.bin")?;
let total = file.metadata()?.len();
let mut reader = ProgressReader::new(file, total);
let mut buf = Vec::new();
reader.read_to_end(&mut buf)?;
eprintln!();  // 줄바꿈
```

이 패턴이 **데코레이터 패턴**이다. 기존 Reader를 감싸서 기능을 추가한다.

## 커스텀 `Write` 구현

`Write`에서 구현해야 할 메서드는 `write()`와 `flush()`.

```rust
use std::io::{self, Write};

/// 쓰인 바이트 수를 세는 Writer
struct CountingWriter<W: Write> {
    inner: W,
    count: u64,
}

impl<W: Write> CountingWriter<W> {
    fn new(inner: W) -> Self {
        Self { inner, count: 0 }
    }

    fn bytes_written(&self) -> u64 {
        self.count
    }
}

impl<W: Write> Write for CountingWriter<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let n = self.inner.write(buf)?;
        self.count += n as u64;
        Ok(n)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

// 사용
let file = std::fs::File::create("output.txt")?;
let mut writer = CountingWriter::new(file);
writeln!(writer, "hello")?;
writeln!(writer, "world")?;
writer.flush()?;
println!("총 {}바이트 기록", writer.bytes_written());
```

### 실전: 해시를 계산하면서 쓰기

```rust
use std::io::{self, Write};
use std::collections::hash_map::DefaultHasher;
use std::hash::Hasher;

struct HashingWriter<W: Write> {
    inner: W,
    hasher: DefaultHasher,
}

impl<W: Write> HashingWriter<W> {
    fn new(inner: W) -> Self {
        Self { inner, hasher: DefaultHasher::new() }
    }

    fn finish_hash(&self) -> u64 {
        self.hasher.finish()
    }
}

impl<W: Write> Write for HashingWriter<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let n = self.inner.write(buf)?;
        self.hasher.write(&buf[..n]);
        Ok(n)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}
```

## 네트워크 I/O — `TcpStream`

`TcpStream`은 `Read`와 `Write`를 모두 구현한다. 파일과 같은 인터페이스로 네트워크 데이터를 주고받을 수 있다.

### TCP 클라이언트

```rust
use std::io::{BufReader, BufRead, Write};
use std::net::TcpStream;

fn http_get(host: &str, path: &str) -> std::io::Result<String> {
    let mut stream = TcpStream::connect(format!("{}:80", host))?;

    // HTTP 요청 보내기
    write!(stream, "GET {} HTTP/1.1\r\n", path)?;
    write!(stream, "Host: {}\r\n", host)?;
    write!(stream, "Connection: close\r\n")?;
    write!(stream, "\r\n")?;
    stream.flush()?;

    // 응답 읽기
    let reader = BufReader::new(&stream);
    let mut response = String::new();
    for line in reader.lines() {
        response.push_str(&line?);
        response.push('\n');
    }

    Ok(response)
}
```

### TCP 서버

```rust
use std::io::{BufReader, BufRead, Write};
use std::net::TcpListener;

fn echo_server() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080")?;
    println!("서버 시작: 127.0.0.1:8080");

    for stream in listener.incoming() {
        let mut stream = stream?;
        let peer = stream.peer_addr()?;
        println!("연결: {}", peer);

        // 클라이언트가 보낸 것을 그대로 돌려보냄
        let reader = BufReader::new(stream.try_clone()?);
        for line in reader.lines() {
            let line = line?;
            if line.is_empty() { break; }
            writeln!(stream, "에코: {}", line)?;
        }
    }

    Ok(())
}
```

### 타임아웃 설정

```rust
use std::net::TcpStream;
use std::time::Duration;

let stream = TcpStream::connect("example.com:80")?;

// 읽기/쓰기 타임아웃
stream.set_read_timeout(Some(Duration::from_secs(5)))?;
stream.set_write_timeout(Some(Duration::from_secs(5)))?;

// 논블로킹 모드
stream.set_nonblocking(true)?;
```

논블로킹 모드에서 `read()`가 데이터가 없으면 `WouldBlock` 에러를 반환한다. 이 패턴은 비동기 I/O의 기초다.

### UDP

```rust
use std::net::UdpSocket;

// 송신
let socket = UdpSocket::bind("0.0.0.0:0")?;
socket.send_to(b"hello", "127.0.0.1:9000")?;

// 수신
let socket = UdpSocket::bind("127.0.0.1:9000")?;
let mut buf = [0u8; 1024];
let (bytes, src) = socket.recv_from(&mut buf)?;
println!("{}에서 {}바이트 수신", src, bytes);
```

## `Sink` — `/dev/null`

쓰기를 버리는 Writer. 테스트나 벤치마크에서 유용하다.

```rust
use std::io::{self, Write};

let mut sink = io::sink();
writeln!(sink, "이 데이터는 버려짐")?;

// 벤치마크: I/O 없이 직렬화 성능만 측정
fn bench_serialize<W: Write>(writer: &mut W) -> io::Result<()> {
    for i in 0..1_000_000 {
        writeln!(writer, "{}", i)?;
    }
    Ok(())
}

bench_serialize(&mut io::sink())?;
```

비슷하게 `io::empty()`는 항상 EOF를 반환하는 Reader다.

```rust
use std::io::{self, Read};

let mut empty = io::empty();
let mut buf = [0u8; 10];
let n = empty.read(&mut buf)?;
assert_eq!(n, 0);  // 항상 EOF
```

`io::repeat(byte)`는 지정한 바이트를 무한 반복하는 Reader다.

```rust
let mut zeros = io::repeat(0);
let mut buf = [0xFF; 4];
zeros.read_exact(&mut buf)?;
assert_eq!(buf, [0, 0, 0, 0]);
```

## 직렬화와 I/O — `serde`

### JSON

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

```rust
use serde::{Serialize, Deserialize};
use std::io::{BufReader, BufWriter};
use std::fs::File;

#[derive(Serialize, Deserialize, Debug)]
struct Config {
    name: String,
    port: u16,
    debug: bool,
}

// 파일에 JSON 쓰기 (스트리밍)
let config = Config { name: "app".into(), port: 8080, debug: true };
let file = File::create("config.json")?;
let writer = BufWriter::new(file);
serde_json::to_writer_pretty(writer, &config)?;

// 파일에서 JSON 읽기 (스트리밍)
let file = File::open("config.json")?;
let reader = BufReader::new(file);
let config: Config = serde_json::from_reader(reader)?;
println!("{:?}", config);
```

`to_writer`/`from_reader`는 `Write`/`Read`를 직접 받는다. 파일 전체를 문자열로 읽지 않고 스트리밍으로 처리한다.

### 바이너리 — `bincode`

```toml
[dependencies]
bincode = "1"
serde = { version = "1", features = ["derive"] }
```

```rust
use serde::{Serialize, Deserialize};
use std::io::{BufWriter, BufReader};
use std::fs::File;

#[derive(Serialize, Deserialize, Debug, PartialEq)]
struct Point {
    x: f64,
    y: f64,
}

// 바이너리로 쓰기
let points = vec![Point { x: 1.0, y: 2.0 }, Point { x: 3.0, y: 4.0 }];
let file = File::create("points.bin")?;
let writer = BufWriter::new(file);
bincode::serialize_into(writer, &points)?;

// 바이너리에서 읽기
let file = File::open("points.bin")?;
let reader = BufReader::new(file);
let loaded: Vec<Point> = bincode::deserialize_from(reader)?;
assert_eq!(points, loaded);
```

JSON보다 훨씬 작고 빠르다. 사람이 읽을 필요 없는 데이터에 적합하다.

## 실전: 제네릭 I/O 유틸리티

### stdin 또는 파일에서 읽기

CLI 도구에서 흔한 패턴: 인자가 있으면 파일, 없으면 stdin에서 읽기.

```rust
use std::io::{self, BufRead, BufReader, Read};
use std::fs::File;

fn get_input(path: Option<&str>) -> io::Result<Box<dyn BufRead>> {
    match path {
        Some(p) => {
            let file = File::open(p)?;
            Ok(Box::new(BufReader::new(file)))
        }
        None => {
            Ok(Box::new(BufReader::new(io::stdin().lock())))
        }
    }
}

fn main() -> io::Result<()> {
    let path = std::env::args().nth(1);
    let reader = get_input(path.as_deref())?;

    for line in reader.lines() {
        let line = line?;
        println!("{}", line.to_uppercase());
    }

    Ok(())
}
```

`Box<dyn BufRead>`로 타입을 지워서 두 소스를 같은 코드로 처리한다.

### stdout 또는 파일에 쓰기

```rust
use std::io::{self, BufWriter, Write};
use std::fs::File;

fn get_output(path: Option<&str>) -> io::Result<Box<dyn Write>> {
    match path {
        Some(p) => Ok(Box::new(BufWriter::new(File::create(p)?))),
        None => Ok(Box::new(BufWriter::new(io::stdout().lock()))),
    }
}
```

## 에러 처리 패턴

### 에러에 컨텍스트 추가

```rust
use std::io;
use std::fs;

fn read_config(path: &str) -> io::Result<String> {
    fs::read_to_string(path).map_err(|e| {
        io::Error::new(e.kind(), format!("설정 파일 '{}' 읽기 실패: {}", path, e))
    })
}
```

실전에서는 `anyhow` 크레이트가 더 편하다.

```rust
use anyhow::{Context, Result};

fn read_config(path: &str) -> Result<String> {
    std::fs::read_to_string(path)
        .with_context(|| format!("설정 파일 '{}' 읽기 실패", path))
}
```

### 재시도 패턴

```rust
use std::io::{self, ErrorKind, Read};
use std::thread;
use std::time::Duration;

fn read_with_retry<R: Read>(reader: &mut R, buf: &mut [u8], max_retries: u32) -> io::Result<usize> {
    let mut attempts = 0;
    loop {
        match reader.read(buf) {
            Ok(n) => return Ok(n),
            Err(e) if e.kind() == ErrorKind::Interrupted => continue,  // 시그널 중단: 즉시 재시도
            Err(e) if e.kind() == ErrorKind::WouldBlock && attempts < max_retries => {
                attempts += 1;
                thread::sleep(Duration::from_millis(10 * attempts as u64));
            }
            Err(e) => return Err(e),
        }
    }
}
```

`Interrupted`는 즉시 재시도하고, `WouldBlock`은 백오프하며 재시도한다.

## 정리

| 패턴 | 용도 |
|------|------|
| 커스텀 `Read`/`Write` | 데코레이터 (진행률, 카운팅, 해싱 등) |
| `TcpStream` | 네트워크 I/O (Read + Write 동시 구현) |
| `io::sink()` / `io::empty()` | 테스트, 벤치마크 |
| `serde` + `to_writer`/`from_reader` | 스트리밍 직렬화/역직렬화 |
| `Box<dyn Read>` / `Box<dyn Write>` | 다양한 소스를 하나의 타입으로 |
| `anyhow::Context` | I/O 에러에 맥락 추가 |

## 시리즈 마무리

| 편 | 주제 | 핵심 |
|----|------|------|
| 01 | I/O 기초 | `Read`/`Write` 트레이트, 표준 입출력, `Cursor` |
| 02 | 파일 시스템 | `Path`/`PathBuf`, `File`, 디렉토리, 메타데이터 |
| 03 | 버퍼링 I/O | `BufReader`/`BufWriter`, 성능 최적화, 스트리밍 |
| 04 | I/O 고급 | 커스텀 Reader/Writer, 네트워크, 직렬화 |

러스트 I/O의 핵심은 **트레이트 추상화**다. `Read`/`Write`를 구현하기만 하면 파일, 네트워크, 메모리, 무엇이든 동일한 인터페이스로 다룰 수 있다.
