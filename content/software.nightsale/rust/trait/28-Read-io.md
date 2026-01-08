---
title: "[Rust 트레이트 시리즈] 28. io::Read: 바이트 스트림 읽기"
author: anonymous.rs
date: 2026-01-03
tags: ["rust", "trait", "io", "read", "file", "network"]
---

# `io::Read`: 바이트 스트림을 읽는 표준 방법

`std::io::Read` 트레이트는 파일, 네트워크 소켓, 인메모리 버퍼 등 바이트(byte)를 읽을 수 있는 모든 종류의 입력 소스에 대한 표준적인 추상화를 제공합니다. `Read`를 구현하는 모든 타입은 동일한 방식으로 데이터를 읽을 수 있으므로, 입력 소스의 종류에 상관없이 동작하는 재사용 가능한 코드를 작성할 수 있습니다.

## `Read` 트레이트의 핵심: `read` 메서드

`Read` 트레이트는 여러 메서드를 가지고 있지만, 가장 근본적인 것은 `read` 메서드입니다.

```rust
use std::io;

pub trait Read {
    // 주어진 버퍼 `buf`를 입력 소스에서 읽어온 바이트로 채우려고 시도합니다.
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize>;

    // ... 다른 여러 헬퍼 메서드들 ...
}
```
-   `buf: &mut [u8]`: 읽어온 데이터를 저장할 바이트 슬라이스 버퍼입니다.
-   **반환 값**: `io::Result<usize>` 타입을 반환합니다.
    -   `Ok(n)`: `n` 바이트를 성공적으로 읽었음을 의미합니다. `n`은 버퍼의 크기보다 작거나 같을 수 있습니다.
    -   `Ok(0)`: **스트림의 끝(End of Stream, EOF)**에 도달했음을 의미합니다. 더 이상 읽을 데이터가 없습니다.
    -   `Err(e)`: 읽기 도중 I/O 에러가 발생했음을 의미합니다.

`read` 메서드는 버퍼를 완전히 채운다는 보장이 없습니다. 운영체제나 네트워크 상황에 따라 가능한 만큼만 데이터를 읽고 즉시 반환될 수 있습니다.

## `Read` 구현체 사용하기

가장 흔한 `Read` 구현체인 `std::fs::File`을 사용하여 파일의 내용을 읽어오는 예제를 살펴보겠습니다.

```rust
use std::fs::File;
use std::io::{self, Read};

fn main() -> io::Result<()> {
    // "my_file.txt" 파일을 읽기 모드로 엽니다. File은 Read를 구현합니다.
    let mut file = File::open("my_file.txt")?;

    // 데이터를 담을 버퍼를 생성합니다.
    let mut buffer = [0u8; 32]; // 32바이트 크기의 버퍼

    loop {
        // 버퍼 크기만큼 데이터를 읽으려고 시도합니다.
        let bytes_read = file.read(&mut buffer)?;
        
        // `read`가 0을 반환하면 파일의 끝에 도달한 것입니다.
        if bytes_read == 0 {
            break;
        }

        // 읽어온 데이터(UTF-8로 가정)를 출력합니다.
        let chunk = &buffer[..bytes_read];
        println!("읽은 데이터 ({} 바이트): {}", bytes_read, String::from_utf8_lossy(chunk));
    }

    Ok(())
}
// my_file.txt 내용이 "Hello, Rust I/O!\nThis is the second line." 라면,
// 출력은 버퍼 크기에 따라 여러 줄로 나뉘어 나올 수 있습니다.
```

## 유용한 헬퍼 메서드들

`Read` 트레이트는 `read`를 기반으로 더 편리한 여러 헬퍼 메서드를 기본으로 제공합니다.

-   **`read_to_end(&mut self, buf: &mut Vec<u8>)`**: 스트림의 끝까지 모든 바이트를 읽어 `Vec<u8>` 버퍼의 끝에 추가합니다.
-   **`read_to_string(&mut self, buf: &mut String)`**: 스트림의 끝까지 모든 바이트를 읽어 UTF-8 문자열로 디코딩한 후, `String` 버퍼의 끝에 추가합니다.
-   **`read_exact(&mut self, buf: &mut [u8])`**: 주어진 버퍼 `buf`를 **정확하게** 꽉 채웁니다. 만약 스트림이 버퍼를 채우기 전에 끝나면 에러를 반환합니다. 정확한 크기의 데이터를 읽어야 할 때 유용합니다.

### `read_to_string` 예제

```rust
use std::fs::File;
use std::io::{self, Read};

fn main() -> io::Result<()> {
    let mut file = File::open("my_file.txt")?;
    let mut content = String::new();

    // 파일의 모든 내용을 읽어 `content` 문자열에 저장합니다.
    file.read_to_string(&mut content)?;

    println!("파일 전체 내용:\n{}", content);
    Ok(())
}
```

## `Read`를 받는 제네릭 함수

`Read` 트레이트의 진정한 힘은 제네릭 함수에서 드러납니다. `Read`를 구현하는 어떤 타입이든 받을 수 있는 함수를 작성할 수 있습니다.

```rust
use std::io::{self, Read};

// `Read`를 구현하는 모든 타입을 인자로 받을 수 있습니다.
fn count_bytes<R: Read>(mut reader: R) -> io::Result<usize> {
    let mut buffer = [0; 1024];
    let mut total_bytes = 0;

    loop {
        let bytes_read = reader.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        total_bytes += bytes_read;
    }
    Ok(total_bytes)
}

fn main() -> io::Result<()> {
    // 1. 파일로부터 바이트 수 세기
    let file = std::fs::File::open("my_file.txt")?;
    println!("파일 크기: {} 바이트", count_bytes(file)?);

    // 2. 인메모리 바이트 슬라이스로부터 바이트 수 세기
    let in_memory_data: &[u8] = b"This is some data in memory";
    println!("메모리 데이터 크기: {} 바이트", count_bytes(in_memory_data)?);

    Ok(())
}
```
`count_bytes` 함수는 `File`이든, 네트워크 스트림(`TcpStream`)이든, 인메모리 바이트 슬라이스든, `Read`를 구현하기만 하면 어떤 입력 소스에 대해서도 동일하게 동작합니다.

## 결론

`io::Read`는 러스트에서 데이터를 읽는 작업을 추상화하는 기본적이고 강력한 트레이트입니다. 이를 통해 다양한 종류의 입력 소스를 일관된 방식으로 다룰 수 있어, 모듈화되고 테스트하기 쉬우며 재사용성 높은 I/O 코드를 작성할 수 있습니다.
