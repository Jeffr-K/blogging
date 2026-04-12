---
title: "좀비 프로세스와 고아 프로세스"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "process", "zombie", "orphan", "wait", "csapp"]
---

## 좀비 프로세스와 고아 프로세스

프로세스 생명주기 관리에서 발생하는 두 가지 중요한 상태입니다.

---

## 1. 프로세스 종료

```c
// 프로세스가 종료되는 방법:
1. main()이 return → exit() 호출
2. exit(status) 직접 호출
3. 치명적 시그널 수신 (SIGKILL, SIGSEGV 등)

// 종료 시 OS가 하는 일:
- 열린 파일 디스크립터 닫기
- 메모리 반환
- 자식 프로세스를 init(PID=1)에 입양
- 종료 상태를 커널에 보관 (부모가 읽을 때까지)
- → 이 상태에서 프로세스가 "좀비" 상태
```

---

## 2. 좀비 프로세스 (Zombie Process)

**자식이 종료되었지만 부모가 아직 종료 상태를 수거하지 않은 상태**입니다.

```c
// 좀비 프로세스 생성 예시
#include <unistd.h>
#include <stdio.h>

int main() {
    pid_t pid = fork();
    
    if (pid == 0) {
        // 자식: 즉시 종료
        printf("자식 종료 (PID=%d)\n", getpid());
        exit(0);
    } else {
        // 부모: 60초 대기 (자식의 종료 상태 수거 안 함)
        printf("부모 대기 중 (자식 PID=%d)\n", pid);
        sleep(60);
        // wait()를 호출하지 않음!
    }
    return 0;
}

// 실행 중 다른 터미널에서:
// ps aux | grep Z
// USER  PID %CPU %MEM  STAT  COMMAND
// user  1234  0.0  0.0  Z    [zombie] <defunct>
//                        ↑ Z = Zombie!
```

### 2.1 좀비의 문제점

```
좀비 프로세스 리소스:
- 메모리: 없음 (이미 해제됨)
- CPU: 없음 (실행 안 됨)
- PID: 1개 차지! ← 이것이 문제

PID 범위: 보통 최대 32768 (설정 가능)
수천 개의 좀비가 쌓이면 새 프로세스 생성 불가!

확인:
$ cat /proc/sys/kernel/pid_max
32768
```

### 2.2 좀비 방지: wait/waitpid

```c
#include <sys/wait.h>

// 방법 1: wait() - 임의의 자식 대기
pid_t wait(int *status);

// 방법 2: waitpid() - 특정 자식 대기
pid_t waitpid(pid_t pid, int *status, int options);
// options: WNOHANG = 블로킹 없이 즉시 반환

// 올바른 패턴
pid_t pid = fork();
if (pid == 0) {
    exit(42);  // 자식 종료
} else {
    int status;
    pid_t child = waitpid(pid, &status, 0);
    if (WIFEXITED(status)) {
        printf("자식 종료 코드: %d\n", WEXITSTATUS(status));
        // 출력: 자식 종료 코드: 42
    }
}

// 종료 상태 매크로:
// WIFEXITED(status)    → 정상 종료 여부
// WEXITSTATUS(status)  → 종료 코드 (0~255)
// WIFSIGNALED(status)  → 시그널로 종료됐는지
// WTERMSIG(status)     → 어떤 시그널인지
```

### 2.3 SIGCHLD 시그널로 비동기 처리

```c
#include <signal.h>

// 자식이 종료될 때마다 SIGCHLD 시그널이 부모에게 전달됨
// 핸들러에서 비동기적으로 수거

void sigchld_handler(int sig) {
    int status;
    pid_t pid;
    // WNOHANG: 수거할 자식이 없으면 즉시 반환
    // 루프: 여러 자식이 동시에 종료된 경우 모두 수거
    while ((pid = waitpid(-1, &status, WNOHANG)) > 0) {
        printf("자식 %d 수거됨\n", pid);
    }
}

int main() {
    signal(SIGCHLD, sigchld_handler);
    // 이제 자식이 종료될 때 자동으로 수거됨
    ...
}
```

---

## 3. 고아 프로세스 (Orphan Process)

**부모가 먼저 종료되어 부모를 잃은 자식 프로세스**입니다.

```c
// 고아 프로세스 생성 예시
int main() {
    pid_t pid = fork();
    
    if (pid == 0) {
        // 자식: 10초 대기 (부모가 먼저 종료)
        sleep(10);
        printf("부모 PID: %d\n", getppid());
        // 부모가 죽었으므로 getppid() = 1 (init/systemd)
    } else {
        // 부모: 즉시 종료
        printf("부모 종료\n");
        exit(0);
    }
    return 0;
}
```

### 3.1 고아 프로세스의 입양

```
부모 프로세스 종료 시:
  자식들이 고아가 됨
  → OS가 자동으로 init(PID=1) 또는 subreaper에게 입양

init 프로세스의 역할:
  - 모든 고아의 새 부모
  - 주기적으로 wait() 호출 → 좀비 방지

subreaper (Linux 3.4+):
  prctl(PR_SET_CHILD_SUBREAPER, 1)으로 설정
  → 자신이 생성한 프로세스 트리의 고아를 직접 입양
  → 컨테이너 런타임(Docker)에서 활용
```

---

## 4. 좀비 vs 고아 비교

```
좀비:
  상태: Z (Zombie)
  원인: 자식이 먼저 죽고 부모가 wait() 안 함
  문제: PID 고갈
  해결: 부모가 wait()/waitpid() 호출 또는 SIGCHLD 핸들러

고아:
  상태: S 또는 R (정상 실행 중)
  원인: 부모가 먼저 죽음
  문제: 기본적으로 문제 없음 (init이 입양)
  특징: getppid()가 1(init) 반환
```

---

## 5. 데몬 프로세스 만들기

```c
// 데몬 = 터미널과 분리된 백그라운드 서비스
// 일반적으로 두 번 fork 사용 (고아 + 세션 리더 방지)

void daemonize() {
    pid_t pid = fork();
    if (pid != 0) exit(0);   // 부모 종료 → 자식은 고아
    
    setsid();  // 새 세션 생성 (터미널 분리)
    
    pid = fork();
    if (pid != 0) exit(0);   // 세션 리더 종료 (터미널 재획득 방지)
    
    // 이 프로세스가 실제 데몬
    chdir("/");              // 루트로 이동 (umount 방지)
    umask(0);               // 파일 권한 초기화
    
    // stdin/stdout/stderr → /dev/null
    close(STDIN_FILENO);
    open("/dev/null", O_RDONLY);
    close(STDOUT_FILENO);
    open("/dev/null", O_WRONLY);
    close(STDERR_FILENO);
    open("/dev/null", O_RDWR);
    
    // 실제 데몬 작업
    while (1) {
        do_work();
        sleep(60);
    }
}
```

---

## 핵심 요약

- **좀비**: 자식이 종료되었지만 부모가 `wait()`를 호출하지 않음. PID를 점유.
- **wait/waitpid**: 자식의 종료 상태 수거. 좀비를 완전히 제거함.
- **SIGCHLD + WNOHANG**: 비동기적으로 자식 종료를 처리. 여러 자식을 한 번에 수거.
- **고아**: 부모가 먼저 종료. init(PID=1)에 입양됨. 기본적으로 무해.
- **데몬**: 두 번 fork로 터미널과 완전히 분리된 백그라운드 프로세스.
