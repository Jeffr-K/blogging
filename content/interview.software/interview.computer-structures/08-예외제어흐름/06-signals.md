---
title: "시그널(Signal): 프로세스 간 비동기 통신"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "signal", "process", "ipc", "csapp"]
---

## 시그널 (Signal)

시그널은 **프로세스에게 이벤트를 알리는 소프트웨어 인터럽트**입니다. 특정 이벤트 발생 시 OS가 프로세스에게 시그널을 보내고, 프로세스는 이를 처리합니다.

---

## 1. 시그널의 개념

```
시그널 전달 과정:
1. 이벤트 발생 (Ctrl+C, 메모리 폴트, kill 명령어)
2. OS가 목적 프로세스에게 시그널 전달
3. 프로세스가 시그널 수신 시:
   a. 기본 동작 (Default Action) 실행 - 종료, 정지, 무시 등
   b. 사용자 정의 핸들러 함수 호출
   c. 시그널 무시 (일부 시그널만)

시그널은 언제든 도착할 수 있음 → 비동기적
```

---

## 2. 주요 시그널 목록

```
번호 | 이름    | 기본 동작  | 발생 원인
─────────────────────────────────────────────────────
1    | SIGHUP  | 종료       | 터미널 연결 끊김
2    | SIGINT  | 종료       | Ctrl+C
3    | SIGQUIT | 코어덤프   | Ctrl+\
4    | SIGILL  | 코어덤프   | 잘못된 명령어
6    | SIGABRT | 코어덤프   | abort() 호출
8    | SIGFPE  | 코어덤프   | 부동소수점 예외
9    | SIGKILL | 종료       | 강제 종료 (무시/블로킹 불가!)
11   | SIGSEGV | 코어덤프   | 잘못된 메모리 접근
13   | SIGPIPE | 종료       | 닫힌 파이프에 쓰기
14   | SIGALRM | 종료       | 타이머 만료 (alarm())
15   | SIGTERM | 종료       | 정상 종료 요청 (kill 기본)
17   | SIGCHLD | 무시       | 자식 종료/정지
18   | SIGCONT | 계속       | SIGSTOP 후 계속
19   | SIGSTOP | 정지       | 강제 정지 (무시/블로킹 불가!)
20   | SIGTSTP | 정지       | Ctrl+Z
```

---

## 3. 시그널 보내기

```bash
# kill 명령어 (이름과 달리 임의 시그널 전송)
kill -15 1234       # SIGTERM (정상 종료 요청)
kill -9 1234        # SIGKILL (강제 종료)
kill -SIGKILL 1234  # 동일
kill -0 1234        # 프로세스 존재 확인 (시그널 없음)

# Ctrl+C → SIGINT
# Ctrl+Z → SIGTSTP (일시 정지)
# Ctrl+\ → SIGQUIT
```

```c
// 프로그램에서 시그널 보내기
#include <signal.h>

kill(pid, SIGTERM);       // 특정 프로세스에 SIGTERM
kill(0, SIGTERM);         // 같은 프로세스 그룹에 전체
raise(SIGINT);            // 자기 자신에게 SIGINT
killpg(pgid, SIGTERM);    // 프로세스 그룹 전체
```

---

## 4. 시그널 수신과 처리

```
시그널이 전달되는 시점:
  - 시스템 콜이 완료된 후
  - 다음 명령어 실행 전
  즉, 임의 시점이 아닌 "안전한" 시점에서 처리

보류 시그널 (Pending Signal):
  - 프로세스가 블로킹 중일 때 수신 → 보류 상태로 표시
  - 블로킹 해제 시 처리

블로킹 시그널 (Blocked Signal):
  - 일시적으로 시그널 무시 (보류는 되지만 핸들러 호출 안 됨)
  - sigprocmask()로 설정
```

---

## 5. 시그널 핸들러

```c
#include <signal.h>
#include <stdio.h>
#include <unistd.h>

// 핸들러 함수 (SIGINT 처리)
void sigint_handler(int sig) {
    // 주의: 시그널 핸들러에서 안전한 함수만 호출 가능!
    // async-signal-safe 함수: write, _exit, signal, kill, ...
    // 안전하지 않음: printf, malloc, free, ...
    write(STDOUT_FILENO, "\nSIGINT received!\n", 18);
    // _exit(0);  // 핸들러에서 종료 시
}

int main() {
    // signal()로 핸들러 등록 (단순 버전)
    signal(SIGINT, sigint_handler);
    
    printf("Ctrl+C를 눌러보세요...\n");
    while (1) {
        sleep(1);
        printf("실행 중...\n");
    }
    return 0;
}
```

---

## 6. sigaction: 고급 시그널 처리

```c
#include <signal.h>

struct sigaction sa;
sa.sa_handler = sigint_handler;   // 핸들러 함수
sigemptyset(&sa.sa_mask);          // 핸들러 실행 중 추가 블로킹할 시그널
sa.sa_flags = SA_RESTART;          // 인터럽트된 시스템 콜 자동 재시작

sigaction(SIGINT, &sa, NULL);

// signal()보다 sigaction()이 권장되는 이유:
// - 플랫폼 독립적
// - 핸들러 실행 중 시그널 마스킹 제어
// - SA_RESTART: 인터럽트된 시스템 콜 처리
// - SA_SIGINFO: 상세 시그널 정보 제공
```

---

## 7. 시그널로 할 수 없는 것

```
SIGKILL (9):
  - 프로세스가 무시하거나 블로킹 불가
  - OS가 강제로 종료
  - 사용 주의: 정리 작업 없이 종료됨
    (파일 버퍼 플러시 안 됨, 임시 파일 미삭제 등)

SIGSTOP (19):
  - 무시/블로킹 불가
  - OS가 강제로 프로세스 정지

권고:
  1. 먼저 SIGTERM 보내고 대기
  2. 응답 없으면 SIGKILL
  → graceful shutdown 기회 제공
```

---

## 8. 실용 예시: 서버 재로드

```c
// 서버 프로세스: SIGHUP으로 설정 파일 재로드
volatile sig_atomic_t reload_flag = 0;

void sighup_handler(int sig) {
    reload_flag = 1;  // 플래그만 설정 (핸들러에서 최소한만)
}

int main() {
    signal(SIGHUP, sighup_handler);
    
    while (1) {
        if (reload_flag) {
            reload_flag = 0;
            reload_config();  // 메인 루프에서 안전하게 처리
        }
        process_request();
    }
}
```

```bash
# 서버에 SIGHUP 보내기 (설정 재로드)
kill -HUP $(cat /var/run/server.pid)
# nginx: kill -HUP $(cat /run/nginx.pid)
```

---

## 핵심 요약

- **시그널**: 프로세스에게 비동기 이벤트를 알리는 메커니즘. 하드웨어 인터럽트의 소프트웨어 버전.
- **SIGKILL/SIGSTOP**: 무시/블로킹 불가. OS가 강제 처리.
- **SIGTERM vs SIGKILL**: SIGTERM은 정상 종료 요청(핸들러 처리 가능), SIGKILL은 강제 종료.
- **핸들러 안전성**: 시그널 핸들러에서는 async-signal-safe 함수만 호출 (write는 OK, printf는 위험).
- **sigaction()**: signal()보다 강력하고 플랫폼 독립적. 실무에서 권장.
- **SIGHUP 패턴**: 서버 프로세스의 설정 재로드에 관습적으로 사용.
