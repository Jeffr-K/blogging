---
title: "프로세스 생성과 실행: fork, execve"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "process", "fork", "execve", "csapp"]
---

## 프로세스 (Process)

프로세스는 **실행 중인 프로그램의 인스턴스**입니다. 각 프로세스는 독립된 가상 주소 공간, 파일 디스크립터, 프로세스 ID(PID)를 가집니다.

---

## 1. 프로세스 상태

```
프로세스 상태 전이:
  
  새로 생성 ─→ 실행 가능(Ready) ─→ 실행 중(Running)
                     ↑                      │
                     │              I/O 대기 또는 슬립
                     │                      ↓
               I/O 완료 ←──── 대기 중(Waiting/Blocked)
                     
  실행 중 ──→ 좀비(Zombie) ──→ 종료(Terminated)

주요 상태:
  R (Running): CPU에서 실행 중 또는 실행 가능
  S (Sleeping): 인터럽트 가능한 대기 (I/O, 슬립)
  D (Disk sleep): 인터럽트 불가 대기 (디스크 I/O)
  Z (Zombie): 종료되었지만 부모가 wait 안 함
  T (Stopped): SIGSTOP으로 정지
```

---

## 2. fork(): 프로세스 복제

```c
#include <unistd.h>

pid_t fork(void);
// 반환값:
//   부모 프로세스: 자식의 PID (양수)
//   자식 프로세스: 0
//   에러: -1
```

### 2.1 fork 동작

```c
#include <stdio.h>
#include <unistd.h>

int main() {
    int x = 1;
    pid_t pid = fork();  // 여기서 두 프로세스로 분기!
    
    if (pid == 0) {
        // 자식 프로세스
        x++;
        printf("자식: x = %d, PID = %d\n", x, getpid());
    } else {
        // 부모 프로세스
        printf("부모: x = %d, PID = %d, 자식 PID = %d\n",
               x, getpid(), pid);
    }
    printf("종료: x = %d\n", x);
    return 0;
}

// 가능한 출력 (순서 비결정):
// 부모: x = 1, PID = 1234, 자식 PID = 1235
// 종료: x = 1         (부모는 x=1)
// 자식: x = 2, PID = 1235
// 종료: x = 2         (자식의 x++는 부모에 영향 없음!)
```

### 2.2 fork의 특성

```
1. 자식은 부모의 복사본:
   - 가상 주소 공간 (스택, 힙, 데이터, 코드) 복사
   - 파일 디스크립터 복사 (같은 파일을 공유)
   - 레지스터 상태 복사

2. Copy-on-Write (CoW):
   - 처음엔 페이지를 공유 (실제 복사 안 함)
   - 어느 한 쪽이 페이지를 수정할 때 실제 복사
   - → 불필요한 복사 최소화

3. 독립된 주소 공간:
   - 자식이 변수를 수정해도 부모에 영향 없음 (위 예시)
   - 부모가 변수를 수정해도 자식에 영향 없음
```

---

## 3. execve(): 프로그램 실행

```c
#include <unistd.h>

int execve(const char *filename,  // 실행할 프로그램 경로
           char *const argv[],    // 인자 배열
           char *const envp[]);   // 환경 변수 배열
// 성공 시 반환하지 않음!
// 실패 시 -1 반환
```

```c
// 예시: ls -la /home 실행
char *argv[] = {"ls", "-la", "/home", NULL};
char *envp[] = {NULL};
execve("/bin/ls", argv, envp);
// 이 줄은 execve 성공 시 절대 실행되지 않음!
perror("execve");  // 실패 시에만 도달
```

### 3.1 execve의 동작

```
execve 호출 시:
1. filename의 실행 파일 로드
2. 현재 프로세스의 주소 공간 완전히 교체
   - 기존 코드, 데이터, 스택 → 삭제
   - 새 실행 파일의 코드, 데이터 로드
   - 새 스택 생성 (argc, argv, envp 배치)
3. 새 프로그램의 main()부터 실행 시작

남는 것 (유지되는 것):
  - PID (프로세스 ID)
  - 부모 PID
  - 열린 파일 디스크립터 (FD_CLOEXEC 설정 시 닫힘)
  - 시그널 핸들러 → 기본값으로 리셋
```

---

## 4. fork + execve 패턴 (쉘 구현)

대부분의 쉘(bash, zsh)은 명령어 실행에 이 패턴을 사용합니다:

```c
// 쉘의 명령어 실행 과정
while (1) {
    char *cmd = read_command();  // 사용자 입력 읽기
    
    pid_t pid = fork();          // 자식 프로세스 생성
    
    if (pid == 0) {
        // 자식: 실제 명령어 실행
        execve(cmd, args, envp);
        perror("execve failed"); // 실패 시
        exit(1);
    } else {
        // 부모(쉘): 자식 완료 대기
        int status;
        waitpid(pid, &status, 0);
        printf("종료 코드: %d\n", WEXITSTATUS(status));
    }
}
```

---

## 5. 프로세스 계보

```
init/systemd (PID=1)
    └── bash (PID=100)
         └── fork() → bash_child (PID=101)
              └── execve("ls") → ls (PID=101)
                   → ls 실행 완료, 종료
         └── waitpid(101) 완료
              → 다음 명령어 대기
```

---

## 6. exec 계열 함수

```c
// 편의 함수들 (모두 내부에서 execve 호출)
execl(path, arg0, arg1, ..., NULL);
execlp(file, arg0, arg1, ..., NULL);  // PATH 검색
execle(path, arg0, arg1, ..., NULL, envp);
execv(path, argv);
execvp(file, argv);                   // PATH 검색

// 예시
execlp("ls", "ls", "-la", NULL);  // PATH에서 ls 검색
```

---

## 핵심 요약

- **프로세스**: 실행 중인 프로그램. 독립된 주소 공간, PID, 파일 디스크립터.
- **fork()**: 부모를 복제하여 자식 프로세스 생성. 부모엔 자식 PID 반환, 자식엔 0 반환.
- **Copy-on-Write**: fork 시 실제 메모리 복사 지연. 수정 시에만 복사 → 효율적.
- **execve()**: 현재 프로세스를 새 프로그램으로 교체. 성공 시 반환하지 않음.
- **fork + execve 패턴**: 쉘의 명령어 실행 방식. 자식에서 exec, 부모는 waitpid로 대기.
