---
title: "[Rust 트레이트 시리즈] 30. io::BufRead: 효율적인 버퍼링 읽기"
author: anonymous.rs
date: 2026-01-03
tags: ["rust", "trait", "io", "bufread", "read", "file", "performance"]
---

# `io::BufRead`: 더 효율적이고 강력한 버퍼링 읽기

`io::Read` 트레이트는 바이트를 읽는 모든 소스에 대한 훌륭한 추상화를 제공하지만, 때로는 더 높은 수준의 기능이나 더 나은 성능이 필요할 수 있습니다. `io::BufRead` 트레이트는 `Read`에 **버퍼링(buffering)** 기능을 추가하여 이러한 요구를 충족시켜 줍니다.

`BufRead`는 `Read`를 상속하는 하위 트레이트(subtrait)로, `Read`의 모든 기능을 포함하면서 줄(line) 단위 읽기와 같은 더 편리한 메서드들을 제공합니다.

## 왜 버퍼링이 필요한가?

`read` 메서드를 호출할 때마다 디스크 파일이나 네트워크와 같은 I/O 장치에 접근하는 것은 비용이 큰 시스템 콜(system call)을 유발할 수 있습니다. 만약 한 번에 몇 바이트씩 아주 작은 양의 데이터를 자주 읽는다면, 이러한 오버헤드가 누적되어 성능이 저하될 수 있습니다.

버퍼링은 이 문제를 해결합니다. `BufReader`와 같은 `BufRead` 구현체는 내부적으로 버퍼(예: 8KB 크기의 메모리 공간)를 가집니다. `read`가 호출되면, `BufReader`는 먼저 내부 버퍼를 확인합니다.

1.  버퍼에 데이터가 있으면: 시스템 콜 없이 메모리에서 바로 데이터를 반환합니다. (매우 빠름)
2.  버퍼가 비어 있으면: 내부적으로 원본 `Read` 소스(예: `File`)로부터 한 번에 큰 덩어리(예: 8KB)의 데이터를 읽어와 자신의 버퍼를 채운 뒤, 요청된 양만큼 데이터를 반환합니다.

이러한 방식으로 시스템 콜의 횟수를 크게 줄여 I/O 성능을 향상시킬 수 있습니다.

## `BufRead` 사용하기: `BufReader`

`BufRead` 트레이트를 직접 구현하기보다는, 보통 기존의 `Read` 구현체를 `std::io::BufReader`로 감싸서 사용합니다. `BufReader::new(reader)`는 주어진 `reader`에 버퍼링 기능을 추가한 새로운 `BufRead` 구현체를 반환합니다.

```rust
use std::io::{self, BufReader, Read};
use std::fs::File;

fn main() -> io::Result<()> {
    let file = File::open("my_file.txt")?;
    // File(Read 구현체)를 BufReader로 감쌉니다.
    let mut reader = BufReader::new(file);

    let mut buffer = [0; 5];
    reader.read_exact(&mut buffer)?; // BufReader도 Read 트레이트를 구현하므로 모든 Read 메서드 사용 가능

    println!("첫 5 바이트: {:?}", &buffer);
    Ok(())
}
```

## `BufRead`의 강력한 메서드들

`BufRead`는 버퍼링을 활용하여 `Read`에는 없는 강력한 기능들을 제공합니다.

-   **`read_line(&mut self, buf: &mut String) -> io::Result<usize>`**: 스트림에서 개행 문자(`\n`)를 만날 때까지 바이트를 읽어 주어진 `String` 버퍼에 추가합니다. 텍스트 파일을 한 줄씩 처리할 때 매우 유용합니다.
-   **`lines(self) -> Lines<Self>`**: 스트림의 각 줄을 `String`으로 산출하는 이터레이터(`Iterator`)를 반환합니다. `for` 루프와 함께 사용하여 파일의 모든 줄을 간결하게 순회할 수 있습니다.

### `lines()` 예제: 파일의 모든 줄 출력하기

`lines()` 메서드는 텍스트 데이터를 처리하는 가장 관용적이고 편리한 방법 중 하나입니다.

```rust
use std::io::{self, BufRead, BufReader};
use std::fs::File;

fn main() -> io::Result<()> {
    let file = File::open("my_file.txt")?;
    let reader = BufReader::new(file);

    println!("--- 파일 내용 ---");
    // .lines()는 각 줄을 Result<String, io::Error>로 감싼 이터레이터를 반환합니다.
    // `?` 연산자로 I/O 에러를 처리할 수 있습니다.
    for (index, line) in reader.lines().enumerate() {
        println!("{:>3}: {}", index + 1, line?);
    }
    println!("-----------------");

    Ok(())
}
```

## `BufRead`를 받는 제네릭 함수

`Read`와 마찬가지로, `BufRead`를 트레이트 경계로 사용하여 버퍼링 읽기가 가능한 모든 소스를 처리하는 제네릭 함수를 작성할 수 있습니다.

```rust
use std::io::{self, BufRead};

// `BufRead`를 구현하는 모든 타입을 인자로 받습니다.
fn find_line<R: BufRead>(mut reader: R, keyword: &str) -> io::Result<Option<String>> {
    let mut line = String::new();
    loop {
        // `read_line`은 읽은 바이트 수를 반환합니다. 0이면 EOF입니다.
        let bytes_read = reader.read_line(&mut line)?;
        if bytes_read == 0 {
            return Ok(None); // 파일을 다 읽었는데 키워드를 못 찾음
        }
        if line.contains(keyword) {
            return Ok(Some(line)); // 키워드가 포함된 라인 반환
        }
        line.clear(); // 다음 라인을 읽기 위해 버퍼 비우기
    }
}

fn main() -> io::Result<()> {
    let data: &[u8] = b"first line\nsecond line with keyword\nthird line";
    let mut reader = std::io::BufReader::new(data); // 메모리 슬라이스도 BufRead 가능

    if let Some(found) = find_line(&mut reader, "keyword")? {
        println!("찾은 라인: {}", found.trim());
    }

    Ok(())
}
```

## 결론

`io::BufRead`는 단순한 `Read`를 넘어, I/O 성능을 향상시키고 줄 단위 처리와 같은 고수준의 기능을 제공하는 강력한 트레이트입니다. 텍스트 파일을 다루거나, 네트워크 스트림에서 데이터를 파싱하는 등, 라인 기반 처리가 필요한 거의 모든 경우에 `BufReader`와 `BufRead`의 메서드를 사용하는 것이 좋습니다. 이는 코드를 더 효율적이고 간결하며 강력하게 만들어 줍니다.
