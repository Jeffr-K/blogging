---
title: "I/O 리다이렉션과 파이프 (Pipe)의 원리"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "system-io", "pipe", "redirection", "csapp"]
---

## I/O 리다이렉션과 파이프

셸의 `>`, `<`, `|` 연산자는 어떻게 구현될까요? **FD 조작**이 핵심입니다.

---

## 1. 리다이렉션의 원리: dup2()

```c
#include <unistd.h>

int dup(int oldfd);
// oldfd를 복사해 새 FD 반환 (가장 작은 미사용 번호)

int dup2(int oldfd, int newfd);
// oldfd를 newfd에 복사 (newfd가 열려있으면 먼저 닫음)
// oldfd와 newfd가 같은 열린 파일 테이블을 가리킴
```

```
리다이렉션 구현: ./program > output.txt

1. fork() → 자식 프로세스 생성
2. 자식에서:
   int fd = open("output.txt", O_WRONLY|O_CREAT|O_TRUNC, 0644);
   dup2(fd, 1);  // stdout(fd=1)을 output.txt로 교체
   close(fd);    // 원본 fd 불필요
   execve("./program", ...);
   // ./program이 printf/write(1, ...) 호출 시
   // 자동으로 output.txt에 씀!

3. 부모는 영향 받지 않음 (fork 후 독립)
```

---

## 2. 리다이렉션 종류

```bash
# 표준 출력 리다이렉션
./prog > out.txt      # stdout → out.txt (덮어쓰기)
./prog >> out.txt     # stdout → out.txt (추가)

# 표준 입력 리다이렉션
./prog < in.txt       # stdin ← in.txt

# 표준 오류 리다이렉션
./prog 2> err.txt     # stderr → err.txt
./prog 2>&1           # stderr → stdout과 동일한 곳
./prog > out.txt 2>&1 # stdout, stderr 모두 out.txt

# 모두 버리기
./prog > /dev/null 2>&1
```

---

## 3. 파이프 (Pipe)

```c
#include <unistd.h>

int pipe(int pipefd[2]);
// pipefd[0]: 읽기 끝 (read end)
// pipefd[1]: 쓰기 끝 (write end)
// 반환: 0 (성공), -1 (실패)

// 파이프 특성:
// - 단방향: 한쪽은 쓰기, 반대쪽은 읽기
// - 커널 버퍼 (보통 64KB)
// - 쓰기 끝이 모두 닫히면 읽기에서 EOF
// - 버퍼 가득 참 + 읽는 쪽 없음 → write() 블로킹
```

---

## 4. 파이프 구현: ls | grep .md

```
ls | grep .md 구현:

1. pipe(pfd) → pfd[0]=읽기, pfd[1]=쓰기 생성

2. fork() → 자식1 (ls 실행할 프로세스)
   자식1:
     close(pfd[0])          // 읽기 끝 불필요
     dup2(pfd[1], 1)        // stdout → 파이프 쓰기 끝
     close(pfd[1])
     execve("ls", ...)      // ls 출력 → 파이프로

3. fork() → 자식2 (grep 실행할 프로세스)
   자식2:
     close(pfd[1])          // 쓰기 끝 불필요
     dup2(pfd[0], 0)        // stdin ← 파이프 읽기 끝
     close(pfd[0])
     execve("grep", ...)    // stdin(파이프)에서 읽어 필터링

4. 부모:
     close(pfd[0])          // 부모도 불필요한 끝 닫기
     close(pfd[1])
     waitpid(자식1)
     waitpid(자식2)

핵심: ls와 grep이 동시에 실행 (producer-consumer 패턴)
      파이프 버퍼를 통해 동기화
```

---

## 5. 명명된 파이프 (Named Pipe, FIFO)

```bash
# 이름 있는 파이프 생성 (파일시스템에 존재)
mkfifo /tmp/mypipe

# 터미널 1:
cat /tmp/mypipe  # 읽기 대기

# 터미널 2:
echo "hello" > /tmp/mypipe  # 쓰기 → 터미널 1에 출력
```

```c
#include <sys/stat.h>
mkfifo("/tmp/mypipe", 0644);
// 이후 open()으로 일반 파일처럼 접근
// 단방향, 단 서로 다른 프로세스 (관련 없어도 됨)
```

---

## 6. 파이프 vs 일반 파이프 vs 소켓

```
익명 파이프(pipe()):
  부모-자식 관계 프로세스 간
  단방향, 이름 없음

명명된 파이프(FIFO):
  관련 없는 프로세스 간
  단방향, 파일시스템에 존재

소켓(socket):
  같은 머신 또는 네트워크
  양방향, 다양한 프로토콜

  파이프   → 소켓의 단순화 버전
  소켓     → 네트워크 포함, 양방향 가능
```

---

## 핵심 요약

- **dup2(old, new)**: new를 닫고 old를 new에 복사 → FD 교체.
- **리다이렉션**: fork() 후 자식에서 dup2로 FD 교체 후 exec.
- **파이프**: 단방향 커널 버퍼. `pipe(pfd[2])`로 생성.
- **ls \| grep**: fork 두 번 + pipe + dup2로 구현.
- **쓰기 끝 닫기**: 파이프 읽는 쪽이 EOF를 받으려면 쓰기 끝이 모두 닫혀야 함.
