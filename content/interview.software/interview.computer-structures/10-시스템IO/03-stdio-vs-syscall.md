---
title: "표준 I/O(stdio)와 시스템 콜의 차이: 버퍼링"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "system-io", "stdio", "buffering", "csapp"]
---

## 표준 I/O vs 시스템 콜

`printf()`와 `write()`는 어떻게 다를까요? **버퍼링**이 핵심입니다.

---

## 1. 계층 구조

```
사용자 코드
    │
    ↓
표준 I/O 라이브러리 (stdio) ← 사용자 공간 라이브러리
    │  (C 런타임 버퍼)
    ↓
시스템 콜 (write, read) ← 커널과의 경계
    │
    ↓
커널 페이지 캐시 ← 커널 공간 버퍼
    │
    ↓
디스크 I/O

stdio 함수: fopen, fread, fwrite, fgets, fprintf, printf, fclose
syscall 함수: open, read, write, close
```

---

## 2. 버퍼링의 이유

```
시스템 콜 비용:
  write(fd, "a", 1) 1000번 호출:
    모드 전환 1000번 (유저→커널→유저)
    약 1000 × 수백 ns = 수십 μs 낭비

  write(fd, buf, 1000) 1번 호출:
    모드 전환 1번
    훨씬 빠름!

stdio 버퍼링:
  printf("a") 1000번 → 내부 버퍼에 누적
  버퍼 가득 참(또는 fflush) → write() 1번 호출
  → 시스템 콜 횟수 최소화
```

---

## 3. 버퍼링 종류

```
완전 버퍼링 (Fully Buffered):
  버퍼가 가득 찰 때만 flush
  파일 I/O에 기본 적용
  버퍼 크기: 보통 4096 또는 8192바이트

라인 버퍼링 (Line Buffered):
  개행 문자('\n') 만나면 flush
  터미널에 연결된 stdout에 기본 적용
  printf("hello\n") → 즉시 출력

버퍼링 없음 (Unbuffered):
  쓰는 즉시 시스템 콜 호출
  stderr에 기본 적용 (오류를 즉시 보이기 위해)

                    파일      터미널    stderr
  기본 버퍼링:    완전 버퍼  라인 버퍼  없음
```

---

## 4. 버퍼링 제어

```c
#include <stdio.h>

// 버퍼 모드 설정
int setvbuf(FILE *stream, char *buf, int mode, size_t size);
// mode: _IOFBF (완전), _IOLBF (라인), _IONBF (없음)

// 버퍼 비우기 (flush)
int fflush(FILE *stream);
fflush(stdout); // stdout 버퍼 강제 비우기
fflush(NULL);   // 모든 출력 스트림 비우기

// 흔한 함정:
printf("waiting..."); // 출력 안 보일 수 있음! (완전 버퍼링)
sleep(5);
// 해결:
printf("waiting...\n"); // 라인 버퍼링이면 즉시 출력
// 또는:
fflush(stdout); // 명시적 flush
```

---

## 5. FILE 구조체

```c
// stdio의 핵심: FILE 구조체
typedef struct {
    int    fd;          // 내부 파일 디스크립터
    char  *buf;         // I/O 버퍼
    size_t buf_size;    // 버퍼 크기
    char  *buf_ptr;     // 현재 버퍼 위치
    size_t unread;      // 버퍼에 남은 읽기 가능 데이터
    int    mode;        // 버퍼링 모드
    int    error;       // 오류 플래그
    int    eof;         // EOF 플래그
} FILE;

// 표준 스트림:
FILE *stdin  = ...;  // fd = 0
FILE *stdout = ...;  // fd = 1
FILE *stderr = ...;  // fd = 2

// FD ↔ FILE 변환:
FILE *fp = fdopen(fd, "r");  // FD → FILE
int fd = fileno(fp);          // FILE → FD
```

---

## 6. stdio vs 시스템 콜 선택 기준

```
stdio 사용 권장:
  ✓ 텍스트 파일 처리 (fscanf, fprintf)
  ✓ 라인 단위 읽기 (fgets)
  ✓ 형식화 출력 (printf)
  ✓ 일반 파일 I/O (버퍼링으로 성능↑)

시스템 콜 직접 사용:
  ✓ 소켓 프로그래밍 (버퍼링이 방해될 때)
  ✓ 이진 프로토콜 (Short Count 직접 처리)
  ✓ 정밀한 타이밍 제어 필요
  ✓ mmap과 혼용 시 (오프셋 동기화 문제)

혼용 주의:
  read()와 fread()를 같은 FD에 혼용 → 위험!
  각자 오프셋 추적 방식이 달라 데이터 손실 가능
```

---

## 7. 성능 비교

```
1MB 파일 쓰기 (1바이트씩 반복):

방법 1: write() 1M번
  ~ 수천 ms (시스템 콜 오버헤드)

방법 2: fwrite() 1M번 (stdio 버퍼링)
  ~ 수 ms (시스템 콜 몇 번만 실제 발생)

방법 3: write() 1번 (큰 버퍼)
  ~ 수 ms (방법 2와 비슷)

결론: stdio의 버퍼링은 write() 큰 버퍼와 유사한 성능
     소량씩 자주 쓸 때 stdio가 자동으로 최적화해줌
```

---

## 핵심 요약

- **stdio**: 사용자 공간 버퍼 제공 → 시스템 콜 횟수 최소화.
- **완전 버퍼링**: 파일 I/O 기본. 버퍼 가득 찰 때만 flush.
- **라인 버퍼링**: 터미널 stdout 기본. `\n`에 flush.
- **버퍼링 없음**: stderr. 즉시 출력.
- **fflush()**: 버퍼를 강제로 비워 즉시 쓰기.
- **혼용 금지**: read()/fread()를 같은 FD에 섞어 사용하면 안 됨.
