---
title: "프로세스 기반 동시성: fork()를 이용한 서버"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "concurrency", "process", "fork", "csapp"]
---

## 프로세스 기반 동시성

`fork()`로 자식 프로세스를 생성하여 각 클라이언트를 독립적으로 처리합니다.

---

## 1. 구조

```
서버 프로세스 (부모)
    │── accept() ──→ 새 클라이언트 연결
    │── fork()
    │       │
    │       ├─ 자식 프로세스 1: 클라이언트 A 처리
    │       ├─ 자식 프로세스 2: 클라이언트 B 처리
    │       └─ 자식 프로세스 3: 클라이언트 C 처리
    │
    │── accept() ──→ 계속 대기

각 자식:
  독립된 메모리 공간
  connfd를 통해 클라이언트와 통신
  완료 시 exit()
```

---

## 2. 구현

```c
#include <sys/wait.h>

void sigchld_handler(int sig) {
    // 좀비 프로세스 방지: 종료된 자식 회수
    while (waitpid(-1, NULL, WNOHANG) > 0);
}

int main() {
    signal(SIGCHLD, sigchld_handler);
    
    int listenfd = setup_server(8080);
    
    while (1) {
        struct sockaddr_in client;
        socklen_t len = sizeof(client);
        int connfd = accept(listenfd, (struct sockaddr *)&client, &len);
        
        pid_t pid = fork();
        if (pid < 0) {
            perror("fork");
            close(connfd);
            continue;
        }
        
        if (pid == 0) {
            // 자식 프로세스
            close(listenfd);      // 자식은 리스닝 소켓 불필요
            handle_client(connfd);
            close(connfd);
            exit(0);              // 반드시 exit
        }
        
        // 부모 프로세스
        close(connfd);  // 부모는 connfd 불필요
        // 계속 accept()로 돌아감
    }
}
```

---

## 3. 주의사항: FD 관리

```
fork() 후 FD 상태:
  부모와 자식이 모든 FD를 공유 (참조 카운트 증가)
  
  부모의 connfd 닫기:
    close(connfd) in 부모
    → 참조 카운트 감소. 아직 자식이 갖고 있음 → 연결 유지
    
  자식의 listenfd 닫기:
    close(listenfd) in 자식
    → 자식이 불필요한 FD 보유 방지

안 닫으면 생기는 문제:
  부모가 connfd 안 닫음 → 자식이 close해도 연결 안 끊김
  (참조 카운트가 1 남아있음)
  
  자식이 listenfd 안 닫음 → FD 누수 (각 자식마다)
```

---

## 4. 프로세스 간 통신 (IPC)

```
자식 프로세스들은 독립된 메모리 공간:
  부모가 쓴 전역 변수 = 자식에게 반영 안 됨 (COW 후 분리)
  자식이 수정한 변수 = 다른 자식에게 영향 없음

프로세스 간 통신 필요 시:
  파이프 (pipe): 부모-자식 단방향
  공유 메모리 (shm_open, mmap MAP_SHARED)
  소켓 (Unix Domain Socket)
  세마포어 (sem_open)
  메시지 큐 (mq_open)
```

---

## 5. 장단점

```
장점:
  ✓ 격리성: 자식 크래시가 부모/다른 자식에 영향 없음
  ✓ 보안: 독립된 주소 공간
  ✓ 구현 단순: 공유 메모리 없으면 동기화 불필요
  ✓ 멀티코어 활용: OS가 여러 코어에 분산

단점:
  ✗ 높은 오버헤드: fork() = 주소 공간 복사 (COW라도 페이지 테이블 복사)
  ✗ 느린 IPC: 공유 메모리 없으면 통신 느림
  ✗ 메모리 소비: 프로세스당 독립 메모리
  ✗ 연결 수 제한: 수천 프로세스가 한계

적합한 사례:
  Apache httpd prefork 모드
  CGI 실행 (격리 중요)
  보안이 중요한 다중 사용자 서비스
```

---

## 6. Prefork 모델

```
매 요청마다 fork() 대신 미리 자식을 풀로 유지:

부모 프로세스:
  자식 N개를 미리 fork
  자식들이 각자 accept() 호출 (커널이 하나만 깨움)
  자식 수 모니터링 → 부족하면 추가 fork

Apache prefork:
  StartServers 5       # 초기 자식 수
  MinSpareServers 5    # 최소 대기 자식
  MaxSpareServers 10   # 최대 대기 자식
  MaxRequestWorkers 150 # 최대 동시 요청

장점: fork() 오버헤드 없음 (이미 생성됨)
단점: 메모리 사용량 고정 (N × 프로세스 크기)
```

---

## 핵심 요약

- **fork() 기반**: 클라이언트마다 자식 프로세스 생성.
- **FD 관리**: 부모는 connfd, 자식은 listenfd 즉시 닫기.
- **격리성**: 자식 크래시가 다른 자식에 영향 없음.
- **단점**: 높은 메모리 소비, 프로세스 생성 오버헤드.
- **Prefork**: 미리 자식 풀 생성으로 fork 오버헤드 제거.
