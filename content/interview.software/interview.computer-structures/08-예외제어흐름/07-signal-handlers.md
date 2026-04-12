---
title: "시그널 핸들러 작성의 올바른 방법"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "signal", "signal-handler", "async-signal-safe", "csapp"]
---

## 시그널 핸들러 (Signal Handler)

시그널 핸들러는 **임의의 시점에 호출되는 비동기 코드**입니다. 잘못 작성하면 미묘한 버그와 데이터 손상이 발생합니다.

---

## 1. 핸들러가 호출되는 시점

```
메인 코드 실행 중 시그널 수신:
  
  main()                     sigint_handler()
    │                               │
    │  do_work() 실행 중           │
    │         ↓                    │
    │  SIGINT 수신 ────────────→ 핸들러 실행
    │                               │
    │  ←───────────────── 핸들러 반환
    │  do_work() 재개
```

핵심 문제: 핸들러는 **어떤 코드가 실행 중이든 상관없이** 호출됨
- malloc 실행 중에 핸들러에서 malloc 호출 → 내부 상태 손상!
- printf 실행 중에 핸들러에서 printf 호출 → 출력 손상!

---

## 2. Async-Signal-Safe 함수

POSIX가 시그널 핸들러에서 **안전하게 호출 가능**하다고 보장하는 함수 목록입니다.

```
안전한 함수 (async-signal-safe):
  write()      ← printf 대신 사용
  read()
  open()
  close()
  kill()
  getpid()
  _exit()      ← exit() 대신 사용
  signal()
  sigprocmask()
  fork()
  execve()
  waitpid()
  ...

안전하지 않은 함수 (주로 내부 락/전역 상태 사용):
  printf()     ← 내부 버퍼 조작 (비재진입)
  malloc()     ← 힙 상태 조작
  free()       ← 힙 상태 조작
  exit()       ← stdio 버퍼 플러시
  syslog()
  strtok()
  ...
```

---

## 3. 핸들러 작성 규칙

### 규칙 1: 최소한의 작업만 수행

```c
// 나쁜 핸들러: 위험한 작업 수행
void bad_handler(int sig) {
    printf("Signal %d received\n", sig);  // 위험!
    cleanup_resources();                   // malloc/free 포함 가능 → 위험!
    exit(0);                               // 위험! (대신 _exit 사용)
}

// 좋은 핸들러: 플래그만 설정
volatile sig_atomic_t got_signal = 0;

void good_handler(int sig) {
    got_signal = sig;  // 원자적 할당만 수행
}

// 메인 루프에서 처리
while (!got_signal) {
    do_work();
}
// got_signal != 0이면 적절히 처리
cleanup_resources();
exit(0);
```

### 규칙 2: volatile sig_atomic_t 사용

```c
// 왜 volatile?
// 컴파일러 최적화가 변수를 레지스터에 캐시하면
// 핸들러의 변경이 메인 코드에 보이지 않을 수 있음

// 왜 sig_atomic_t?
// 모든 플랫폼에서 원자적으로 읽고 쓸 수 있는 정수형
// (int가 아닌 플랫폼에서 안전)

volatile sig_atomic_t terminate_flag = 0;

void sigterm_handler(int sig) {
    terminate_flag = 1;
}
```

### 규칙 3: write()로 출력 (printf 금지)

```c
// 핸들러에서 출력이 꼭 필요하면 write() 사용
void handler(int sig) {
    const char msg[] = "Got SIGINT\n";
    write(STDOUT_FILENO, msg, sizeof(msg) - 1);  // 안전
}
```

### 규칙 4: errno 보존

```c
// 핸들러가 errno를 변경하면 메인 코드의 에러 처리 오동작
void safe_handler(int sig) {
    int saved_errno = errno;  // 저장
    
    // 안전한 작업 수행
    write(STDOUT_FILENO, "signal\n", 7);
    
    errno = saved_errno;      // 복원
}
```

---

## 4. 재진입성 (Reentrancy)

```c
// 비재진입 함수의 위험성
char *global_buf = NULL;

void dangerous_func() {
    global_buf = malloc(100);  // ← 이 순간 시그널 수신!
    // ...
    free(global_buf);
}

void handler(int sig) {
    dangerous_func();  // global_buf 재사용 → 첫 번째 호출과 충돌!
}

// 재진입 가능한 설계:
// - 전역 상태 사용 최소화
// - 지역 변수만 사용
// - 비동기 안전 함수만 호출
```

---

## 5. sigprocmask: 시그널 블로킹

핸들러 실행 중 같은 시그널이 재진입하는 것을 막거나, 임계 섹션을 보호합니다:

```c
sigset_t mask, prev;

// 블로킹할 시그널 설정
sigemptyset(&mask);
sigaddset(&mask, SIGINT);
sigaddset(&mask, SIGTERM);

// 임계 섹션 보호
sigprocmask(SIG_BLOCK, &mask, &prev);  // 블로킹 시작

// 여기서 SIGINT/SIGTERM이 와도 핸들러 호출 안 됨 (보류)
critical_section();

sigprocmask(SIG_SETMASK, &prev, NULL); // 블로킹 해제 (보류 시그널 처리)
```

---

## 6. 시그널과 시스템 콜 인터럽트

```c
// 시그널이 느린 시스템 콜을 인터럽트할 수 있음
ssize_t n = read(fd, buf, sizeof(buf));
if (n < 0 && errno == EINTR) {
    // 시그널로 인해 read가 인터럽트됨
    // 재시도 필요!
    n = read(fd, buf, sizeof(buf));
}

// 자동 재시도를 위해 SA_RESTART 사용
struct sigaction sa;
sa.sa_flags = SA_RESTART;  // 인터럽트된 시스템 콜 자동 재시작
sigaction(SIGINT, &sa, NULL);
```

---

## 7. 완전한 예시: 우아한 종료

```c
#include <signal.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>

volatile sig_atomic_t shutdown_requested = 0;

void shutdown_handler(int sig) {
    shutdown_requested = 1;
}

int main() {
    // sigaction으로 핸들러 등록
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = shutdown_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = SA_RESTART;
    
    sigaction(SIGTERM, &sa, NULL);
    sigaction(SIGINT, &sa, NULL);
    
    // 서버 메인 루프
    while (!shutdown_requested) {
        do_server_work();
    }
    
    // 우아한 종료
    cleanup_resources();
    close_connections();
    write(STDOUT_FILENO, "Server shutdown gracefully\n", 27);
    return 0;
}
```

---

## 핵심 요약

- **비동기 호출**: 핸들러는 언제든 호출됨 → 메인 코드와 충돌 가능.
- **async-signal-safe**: `write()`, `_exit()`, `kill()` 등만 핸들러에서 안전. `printf`, `malloc` 위험.
- **플래그 패턴**: 핸들러는 `volatile sig_atomic_t` 플래그만 설정, 실제 처리는 메인 루프에서.
- **errno 보존**: 핸들러가 errno를 변경하지 않도록 저장/복원 필수.
- **sigprocmask**: 임계 섹션 보호 또는 핸들러 재진입 방지.
- **SA_RESTART**: 시그널로 인터럽트된 시스템 콜을 자동으로 재시작.
