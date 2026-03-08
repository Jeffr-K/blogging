---
title: "[Rust I/O 시리즈] 02. 파일 시스템"
author: anonymous.rs
date: 2025-12-23
tags: ["rust", "io", "file", "path", "directory", "filesystem"]
---

# 파일 시스템 — Path, 파일, 디렉토리

## 한 줄 요약

`Path`/`PathBuf`로 경로를 다루고, `std::fs`로 파일과 디렉토리를 조작한다.

## `Path`와 `PathBuf`

`str`/`String`의 관계처럼, `Path`/`PathBuf`는 빌림/소유 쌍이다.

```rust
use std::path::{Path, PathBuf};

// Path: 빌림 (&str에 해당)
let path: &Path = Path::new("/home/ferris/config.toml");

// PathBuf: 소유 (String에 해당)
let mut path_buf: PathBuf = PathBuf::from("/home/ferris");
path_buf.push("config.toml");

println!("{}", path_buf.display());  // /home/ferris/config.toml
```

### 경로 조작

```rust
let path = Path::new("/home/ferris/documents/report.pdf");

// 구성 요소 추출
println!("파일명: {:?}", path.file_name());        // Some("report.pdf")
println!("확장자: {:?}", path.extension());          // Some("pdf")
println!("스템: {:?}", path.file_stem());            // Some("report")
println!("부모: {:?}", path.parent());               // Some("/home/ferris/documents")

// 존재 여부
println!("존재: {}", path.exists());
println!("파일: {}", path.is_file());
println!("디렉토리: {}", path.is_dir());

// 절대/상대 경로
println!("절대: {}", path.is_absolute());
println!("상대: {}", path.is_relative());
```

### `PathBuf` 조작

```rust
let mut path = PathBuf::from("/home/ferris");

// 경로 추가
path.push("documents");
path.push("report.pdf");
// /home/ferris/documents/report.pdf

// 파일명 변경
path.set_file_name("summary.pdf");
// /home/ferris/documents/summary.pdf

// 확장자 변경
path.set_extension("txt");
// /home/ferris/documents/summary.txt

// 경로 결합 (join은 새 PathBuf 반환)
let config = Path::new("/home/ferris").join("config").join("app.toml");
// /home/ferris/config/app.toml
```

### 크로스 플랫폼 경로

```rust
// / 구분자를 사용하면 모든 OS에서 동작
let path = Path::new("config/app.toml");

// OS별 경로 구분자
println!("구분자: {}", std::path::MAIN_SEPARATOR);  // Unix: '/', Windows: '\'

// 경로 구성 요소 순회
for component in Path::new("/home/ferris/docs").components() {
    println!("{:?}", component);
}
// RootDir, Normal("home"), Normal("ferris"), Normal("docs")
```

## 파일 읽기/쓰기

### 편의 함수 (간단한 경우)

```rust
use std::fs;

// 파일 전체를 문자열로
let content = fs::read_to_string("config.toml")?;

// 파일 전체를 바이트로
let bytes = fs::read("image.png")?;

// 파일에 쓰기 (기존 내용 덮어씀)
fs::write("output.txt", "hello world")?;

// 바이트 쓰기
fs::write("data.bin", &[0xFF, 0x00, 0xAB])?;
```

### `File`로 세밀한 제어

```rust
use std::fs::{File, OpenOptions};
use std::io::{Read, Write, Seek, SeekFrom};

// 읽기 전용
let mut file = File::open("data.txt")?;

// 쓰기 (새로 생성, 기존 파일 덮어씀)
let mut file = File::create("output.txt")?;

// OpenOptions: 세밀한 제어
let mut file = OpenOptions::new()
    .read(true)
    .write(true)
    .create(true)       // 없으면 생성
    .truncate(false)    // 기존 내용 유지
    .open("log.txt")?;

// 추가 모드 (append)
let mut file = OpenOptions::new()
    .append(true)
    .create(true)
    .open("log.txt")?;

writeln!(file, "새 로그 라인")?;
```

### 파일 위치 이동 (Seek)

```rust
use std::io::{Seek, SeekFrom};

let mut file = File::open("data.bin")?;

// 처음부터 10바이트 위치로
file.seek(SeekFrom::Start(10))?;

// 현재 위치에서 5바이트 뒤로
file.seek(SeekFrom::Current(-5))?;

// 끝에서 20바이트 앞으로
file.seek(SeekFrom::End(-20))?;

// 처음으로 되돌리기
file.rewind()?;

// 현재 위치 확인
let pos = file.stream_position()?;
```

## 디렉토리 조작

```rust
use std::fs;

// 디렉토리 생성
fs::create_dir("new_dir")?;

// 중첩 디렉토리 생성 (mkdir -p)
fs::create_dir_all("path/to/nested/dir")?;

// 디렉토리 삭제 (비어있어야 함)
fs::remove_dir("empty_dir")?;

// 디렉토리와 내용 전부 삭제 (rm -rf)
fs::remove_dir_all("dir_with_contents")?;

// 파일 삭제
fs::remove_file("unwanted.txt")?;

// 이름 변경 / 이동
fs::rename("old_name.txt", "new_name.txt")?;
fs::rename("file.txt", "other_dir/file.txt")?;

// 복사
fs::copy("source.txt", "destination.txt")?;
```

### 디렉토리 순회

```rust
// 한 단계만
for entry in fs::read_dir(".")? {
    let entry = entry?;
    let path = entry.path();
    let file_type = entry.file_type()?;

    if file_type.is_file() {
        println!("파일: {}", path.display());
    } else if file_type.is_dir() {
        println!("디렉: {}", path.display());
    }
}
```

### 재귀 순회

```rust
fn walk_dir(dir: &Path, depth: usize) -> io::Result<()> {
    let indent = "  ".repeat(depth);
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            println!("{}📁 {}", indent, path.file_name().unwrap().to_string_lossy());
            walk_dir(&path, depth + 1)?;
        } else {
            println!("{}📄 {}", indent, path.file_name().unwrap().to_string_lossy());
        }
    }
    Ok(())
}

walk_dir(Path::new("."), 0)?;
```

실전에서는 `walkdir` 크레이트가 더 편하다.

```toml
[dependencies]
walkdir = "2"
```

```rust
use walkdir::WalkDir;

for entry in WalkDir::new(".").max_depth(3) {
    let entry = entry?;
    println!("{}", entry.path().display());
}
```

## 파일 메타데이터

```rust
let metadata = fs::metadata("file.txt")?;

println!("크기: {} bytes", metadata.len());
println!("파일: {}", metadata.is_file());
println!("디렉: {}", metadata.is_dir());
println!("읽기전용: {}", metadata.permissions().readonly());
println!("수정 시간: {:?}", metadata.modified()?);
println!("생성 시간: {:?}", metadata.created()?);
```

### 권한 변경 (Unix)

```rust
#[cfg(unix)]
{
    use std::os::unix::fs::PermissionsExt;

    let mut perms = fs::metadata("script.sh")?.permissions();
    perms.set_mode(0o755);  // rwxr-xr-x
    fs::set_permissions("script.sh", perms)?;
}
```

## 임시 파일/디렉토리

```rust
use std::env;

// 시스템 임시 디렉토리
let tmp = env::temp_dir();
println!("임시 디렉토리: {}", tmp.display());

// 임시 파일 만들기 (수동)
let tmp_file = tmp.join("my_app_temp.txt");
fs::write(&tmp_file, "임시 데이터")?;
// ... 사용 후 삭제
fs::remove_file(&tmp_file)?;
```

실전에서는 `tempfile` 크레이트를 쓴다:

```toml
[dependencies]
tempfile = "3"
```

```rust
use tempfile::{NamedTempFile, tempdir};

// 스코프 벗어나면 자동 삭제
let mut tmp = NamedTempFile::new()?;
writeln!(tmp, "임시 데이터")?;
println!("경로: {}", tmp.path().display());

// 임시 디렉토리
let dir = tempdir()?;
let file_path = dir.path().join("data.txt");
fs::write(&file_path, "test")?;
// dir이 drop되면 디렉토리와 내용 전부 삭제
```

## 정리

| 도구 | 용도 |
|------|------|
| `Path` / `PathBuf` | 경로 표현 및 조작 |
| `fs::read_to_string` / `fs::write` | 간단한 파일 읽기/쓰기 |
| `File` + `OpenOptions` | 세밀한 파일 제어 |
| `fs::create_dir_all` | 디렉토리 생성 |
| `fs::read_dir` | 디렉토리 순회 |
| `fs::metadata` | 크기, 권한, 시간 정보 |
| `walkdir` 크레이트 | 재귀 디렉토리 순회 |
| `tempfile` 크레이트 | 임시 파일/디렉토리 |

다음 글에서는 **버퍼링 I/O와 성능 최적화**를 다룬다.
