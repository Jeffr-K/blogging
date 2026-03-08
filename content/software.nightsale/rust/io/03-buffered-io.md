---
title: "[Rust I/O 시리즈] 03. 버퍼링 I/O와 성능"
author: anonymous.rs
date: 2025-12-24
tags: ["rust", "io", "BufReader", "BufWriter", "buffered", "performance", "streaming"]
---

# 버퍼링 I/O — BufReader, BufWriter, 성능 최적화

## 한 줄 요약

`BufReader`/`BufWriter`로 시스템 콜 횟수를 줄여 I/O 성능을 극적으로 개선한다.

## 왜 버퍼링인가?

I/O에서 가장 비싼 것은 **시스템 콜**이다. `read()`/`write()`를 1바이트씩 호출하면 매번 커널 모드 전환이 일어난다.

```
[느린 코드] 1바이트 × 1,000,000번 = 1,000,000번 시스템 콜
[빠른 코드] 8KB × 125번          = 125번 시스템 콜
```

**버퍼링**은 메모리에 데이터를 모아뒀다가 한 번에 읽거나 쓰는 전략이다.

### 다른 언어와 비교

| 언어 | 기본 버퍼링 |
|------|-----------|
| C | `FILE*`은 기본 버퍼링 (`fread`/`fwrite`), `read`/`write`는 버퍼링 없음 |
| Java | `BufferedReader`/`BufferedWriter`로 감싸야 함 |
| Go | `bufio.Reader`/`bufio.Writer` |
| Python | `open()`이 기본으로 버퍼링 |
| **Rust** | **기본 버퍼링 없음** — `BufReader`/`BufWriter`로 명시적으로 감싸야 함 |

러스트는 **명시적**이다. 버퍼링이 필요하면 직접 선택한다.

## `BufReader`

`Read`를 구현하는 타입을 감싸서 내부 버퍼를 추가한다.

```rust
use std::io::{BufReader, BufRead, Read};
use std::fs::File;

let file = File::open("large_file.txt")?;
let reader = BufReader::new(file);  // 기본 8KB 버퍼
```

### 라인 단위 읽기 — `BufRead` 트레이트

`BufReader`는 `BufRead` 트레이트를 구현한다. 이 트레이트가 라인 단위 읽기를 가능하게 한다.

```rust
pub trait BufRead: Read {
    fn read_line(&mut self, buf: &mut String) -> io::Result<usize>;
    fn lines(self) -> Lines<Self>;
    fn fill_buf(&mut self) -> io::Result<&[u8]>;
    fn consume(&mut self, amt: usize);
    // ...
}
```

```rust
use std::io::{BufReader, BufRead};
use std::fs::File;

let file = File::open("log.txt")?;
let reader = BufReader::new(file);

// 방법 1: lines() 이터레이터
for line in reader.lines() {
    let line = line?;  // io::Result<String>
    println!("{}", line);
}

// 방법 2: read_line() — 버퍼 재사용으로 할당 줄임
let file = File::open("log.txt")?;
let mut reader = BufReader::new(file);
let mut line = String::new();

loop {
    line.clear();
    let bytes = reader.read_line(&mut line)?;
    if bytes == 0 { break; }  // EOF
    print!("{}", line);  // 개행 포함
}
```

### `lines()` vs `read_line()` 차이

```rust
// lines(): 매 줄마다 새 String 할당 — 편리하지만 할당 비용
for line in reader.lines() {
    let line = line?;  // 새 String
}

// read_line(): String 재사용 — 성능 중요할 때
let mut buf = String::new();
loop {
    buf.clear();
    if reader.read_line(&mut buf)? == 0 { break; }
    // buf 사용
}
```

대부분의 경우 `lines()`로 충분하다. 수백만 줄을 처리할 때만 `read_line()`을 고려하라.

### 버퍼 크기 조정

```rust
// 기본: 8KB
let reader = BufReader::new(file);

// 커스텀: 64KB
let reader = BufReader::with_capacity(64 * 1024, file);
```

버퍼가 너무 작으면 시스템 콜이 잦고, 너무 크면 메모리를 낭비한다. 대부분 **8KB 기본값**이면 충분하다.

### `fill_buf()` + `consume()` — 저수준 제어

`BufRead`의 핵심 메서드다. 버퍼를 직접 들여다보고 원하는 만큼만 소비할 수 있다.

```rust
use std::io::{BufReader, BufRead};

let data = b"hello\nworld\n";
let mut reader = BufReader::new(&data[..]);

// 버퍼 들여다보기 (데이터 소비 안 함)
let buf = reader.fill_buf()?;
println!("버퍼: {:?}", std::str::from_utf8(buf));

// 5바이트 소비 ("hello")
reader.consume(5);

// 다음 fill_buf()는 나머지를 보여줌
let buf = reader.fill_buf()?;
println!("나머지: {:?}", std::str::from_utf8(buf));
```

이 패턴은 **파서** 구현에 유용하다. 데이터를 미리 보고(peek), 파싱 결과에 따라 소비량을 결정한다.

## `BufWriter`

`Write`를 구현하는 타입을 감싸서 쓰기를 버퍼링한다.

```rust
use std::io::{BufWriter, Write};
use std::fs::File;

let file = File::create("output.txt")?;
let mut writer = BufWriter::new(file);

// 이 write들은 메모리 버퍼에 쌓임
for i in 0..10000 {
    writeln!(writer, "line {}", i)?;
}

// flush: 버퍼를 디스크에 반영
writer.flush()?;
// drop 시에도 자동 flush (단, 에러 무시됨)
```

### 자동 flush의 함정

```rust
{
    let file = File::create("data.txt")?;
    let mut writer = BufWriter::new(file);
    writer.write_all(b"important data")?;
    // 여기서 writer가 drop됨 → 자동 flush
    // 하지만 flush 에러가 발생해도 무시됨!
}
```

중요한 데이터는 반드시 **명시적으로 `flush()`를 호출**하고 에러를 확인하라.

```rust
let file = File::create("data.txt")?;
let mut writer = BufWriter::new(file);
writer.write_all(b"important data")?;
writer.flush()?;  // 에러가 있으면 여기서 잡힘
```

### `into_inner()` — 내부 Writer 꺼내기

```rust
let file = File::create("output.txt")?;
let mut writer = BufWriter::new(file);
writeln!(writer, "some data")?;

// flush하고 내부 File을 돌려받음
let file = writer.into_inner()?;
// file로 추가 작업 가능
```

## `LineWriter` — 줄 단위 flush

`\n`을 만나면 자동으로 flush한다. 로그 파일 등 줄 단위 실시간 출력이 필요할 때 유용하다.

```rust
use std::io::{LineWriter, Write};
use std::fs::File;

let file = File::create("log.txt")?;
let mut writer = LineWriter::new(file);

writer.write_all(b"first line\n")?;   // 여기서 flush
writer.write_all(b"second ")?;        // 아직 버퍼에
writer.write_all(b"line\n")?;         // 여기서 flush
```

참고로 `stdout`은 터미널에 연결되었을 때 **라인 버퍼링**이고, 파이프에 연결되면 **풀 버퍼링**이다.

## 성능 비교

파일에 100만 줄 쓰기:

```rust
use std::io::{BufWriter, Write};
use std::fs::File;
use std::time::Instant;

fn bench_unbuffered() -> std::io::Result<()> {
    let mut file = File::create("/tmp/unbuffered.txt")?;
    let start = Instant::now();
    for i in 0..1_000_000 {
        writeln!(file, "line {}", i)?;
    }
    println!("버퍼링 없음: {:?}", start.elapsed());
    Ok(())
}

fn bench_buffered() -> std::io::Result<()> {
    let file = File::create("/tmp/buffered.txt")?;
    let mut writer = BufWriter::new(file);
    let start = Instant::now();
    for i in 0..1_000_000 {
        writeln!(writer, "line {}", i)?;
    }
    writer.flush()?;
    println!("버퍼링 있음: {:?}", start.elapsed());
    Ok(())
}
```

일반적인 결과:

```
버퍼링 없음: ~500ms
버퍼링 있음: ~80ms   ← 6배 이상 빠름
```

읽기도 마찬가지다. 작은 단위로 반복 읽을수록 `BufReader`의 효과가 크다.

## 실전 패턴

### CSV 파일 처리

```rust
use std::io::{BufReader, BufRead, BufWriter, Write};
use std::fs::File;

fn process_csv(input: &str, output: &str) -> std::io::Result<()> {
    let reader = BufReader::new(File::open(input)?);
    let mut writer = BufWriter::new(File::create(output)?);

    for line in reader.lines() {
        let line = line?;
        let fields: Vec<&str> = line.split(',').collect();
        if fields.len() >= 2 {
            writeln!(writer, "{}\t{}", fields[0], fields[1])?;
        }
    }

    writer.flush()?;
    Ok(())
}
```

### 대용량 파일 줄 수 세기

```rust
use std::io::{BufReader, Read};
use std::fs::File;

fn count_lines(path: &str) -> std::io::Result<usize> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut count = 0;
    let mut buf = [0u8; 8192];

    loop {
        let bytes = reader.read(&mut buf)?;
        if bytes == 0 { break; }
        count += buf[..bytes].iter().filter(|&&b| b == b'\n').count();
    }

    Ok(count)
}
```

`lines()`로 세는 것보다 빠르다. String 할당과 UTF-8 검증을 건너뛰기 때문이다.

### 스트리밍 변환 (메모리에 전부 안 올림)

```rust
use std::io::{BufReader, BufWriter, BufRead, Write};
use std::fs::File;

fn to_uppercase_file(input: &str, output: &str) -> std::io::Result<()> {
    let reader = BufReader::new(File::open(input)?);
    let mut writer = BufWriter::new(File::create(output)?);

    for line in reader.lines() {
        let line = line?;
        writeln!(writer, "{}", line.to_uppercase())?;
    }

    writer.flush()
}
```

1GB 파일이라도 한 줄씩 처리하므로 메모리를 거의 쓰지 않는다.

### `io::copy` — 가장 빠른 복사

```rust
use std::io;
use std::fs::File;

fn copy_file(from: &str, to: &str) -> io::Result<u64> {
    let mut src = File::open(from)?;
    let mut dst = File::create(to)?;
    io::copy(&mut src, &mut dst)
}
```

`io::copy`는 내부적으로 버퍼링을 사용하므로 `BufReader`/`BufWriter`로 감쌀 필요 없다.

## 체이닝과 어댑터

`Read`는 여러 유용한 어댑터 메서드를 제공한다.

```rust
use std::io::Read;

let data = b"hello world, this is rust";
let mut reader = &data[..];

// take: 처음 N바이트만 읽기
let mut limited = reader.take(5);
let mut buf = String::new();
limited.read_to_string(&mut buf)?;
println!("{}", buf);  // "hello"

// chain: 두 Reader를 이어 붙이기
let a = &b"first "[..];
let b = &b"second"[..];
let mut chained = a.chain(b);
let mut result = String::new();
chained.read_to_string(&mut result)?;
println!("{}", result);  // "first second"

// bytes: 바이트 단위 이터레이터
let data = &b"hi"[..];
for byte in data.bytes() {
    println!("{}", byte?);  // 104, 105
}
```

### 체이닝 실전: 헤더 + 본문

```rust
use std::io::{Cursor, Read};

let header = b"MAGIC\x00\x01";
let body = b"actual content here";

let mut reader = Cursor::new(header).chain(Cursor::new(body));
let mut all = Vec::new();
reader.read_to_end(&mut all)?;
// all = [MAGIC, 0x00, 0x01, actual content here]
```

## 정리

| 타입 | 역할 | 기본 버퍼 |
|------|------|----------|
| `BufReader<R>` | 읽기 버퍼링 | 8KB |
| `BufWriter<W>` | 쓰기 버퍼링 | 8KB |
| `LineWriter<W>` | 줄 단위 자동 flush | 8KB |

| 규칙 | 설명 |
|------|------|
| 반복 I/O → 버퍼링 | 작은 단위로 여러 번 읽고/쓸 때 `BufReader`/`BufWriter` 사용 |
| `flush()` 명시적 호출 | drop 시 자동 flush는 에러를 무시함 |
| `lines()` vs `read_line()` | 대부분 `lines()`로 충분, 초고성능 필요시 `read_line()` |
| `io::copy` | 단순 복사는 이미 내부 버퍼링 있음 |

다음 글에서는 **I/O 고급 — 커스텀 Read/Write, 네트워크 I/O, 직렬화**를 다룬다.
