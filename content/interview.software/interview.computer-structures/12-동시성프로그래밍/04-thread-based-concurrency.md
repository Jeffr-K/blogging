---
title: "스레드 기반 동시성: Pthreads API"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "concurrency", "thread", "pthreads", "csapp"]
---

## 스레드 기반 동시성

프로세스보다 가볍고, 메모리를 공유하는 **스레드(Thread)**를 이용한 동시성입니다.

---

## 1. 스레드 vs 프로세스

```
프로세스:
  독립된 가상 주소 공간
  독립된 FD 테이블 (fork 후 복사)
  생성 비용 큼 (주소 공간 복사)
  IPC 필요 (파이프, 공유 메모리 등)

스레드:
  같은 가상 주소 공간 공유
  같은 FD 테이블 공유
  생성 비용 작음 (스택만 새로 할당)
  전역 변수로 즉시 통신

스레드가 공유하는 것:
  ✓ 코드 (텍스트 세그먼트)
  ✓ 전역 변수, static 변수
  ✓ 힙 (malloc으로 할당한 메모리)
  ✓ 파일 디스크립터
  ✓ 시그널 핸들러

스레드만의 것:
  ✓ 스택 (지역 변수, 함수 호출 프레임)
  ✓ 레지스터 (PC, SP 포함)
  ✓ 스레드 ID (TID)
  ✓ errno
```

---

## 2. Pthreads API

```c
#include <pthread.h>

// 스레드 생성
int pthread_create(pthread_t *tid,          // 스레드 ID (출력)
                   pthread_attr_t *attr,    // 속성 (NULL = 기본)
                   void *(*func)(void *),   // 실행 함수
                   void *arg);              // 함수 인자
// 반환: 0 (성공), 오류 번호 (실패)

// 스레드 종료 대기
int pthread_join(pthread_t tid,   // 기다릴 스레드
                 void **retval);  // 반환값 (NULL = 무시)

// 스레드 분리 (join 없이 자동 정리)
int pthread_detach(pthread_t tid);

// 현재 스레드 ID
pthread_t pthread_self(void);

// 스레드 자발적 종료
void pthread_exit(void *retval);
```

---

## 3. 기본 사용 예제

```c
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int id;
    char *message;
} thread_args_t;

void *worker(void *arg) {
    thread_args_t *args = (thread_args_t *)arg;
    printf("스레드 %d: %s\n", args->id, args->message);
    
    // 반환값 (pthread_join으로 수집 가능)
    int *result = malloc(sizeof(int));
    *result = args->id * 2;
    return result;
}

int main() {
    pthread_t tids[4];
    thread_args_t args[4];
    
    // 스레드 4개 생성
    for (int i = 0; i < 4; i++) {
        args[i] = (thread_args_t){.id = i, .message = "안녕"};
        pthread_create(&tids[i], NULL, worker, &args[i]);
    }
    
    // 모든 스레드 완료 대기
    for (int i = 0; i < 4; i++) {
        void *retval;
        pthread_join(tids[i], &retval);
        int *result = (int *)retval;
        printf("스레드 %d 결과: %d\n", i, *result);
        free(result);
    }
    
    return 0;
}
```

---

## 4. 스레드 기반 서버

```c
void *handle_client(void *arg) {
    int connfd = *(int *)arg;
    free(arg); // 힙에서 할당된 connfd
    
    char buf[4096];
    ssize_t n;
    while ((n = read(connfd, buf, sizeof(buf))) > 0) {
        write(connfd, buf, n);
    }
    close(connfd);
    return NULL;
}

int main() {
    int listenfd = setup_server(8080);
    
    while (1) {
        int *connfd = malloc(sizeof(int)); // 힙에 할당! (로컬 변수 사용 금지)
        struct sockaddr_in client;
        socklen_t len = sizeof(client);
        *connfd = accept(listenfd, (struct sockaddr *)&client, &len);
        
        pthread_t tid;
        pthread_create(&tid, NULL, handle_client, connfd);
        pthread_detach(tid); // join 없이 자동 정리
    }
}
```

```
주의: connfd를 스택 변수로 전달하면 위험!
  int connfd = accept(...);
  pthread_create(..., &connfd); // 위험!
  → 다음 루프에서 connfd 덮어씀 → 스레드가 잘못된 FD 사용
  
  해결: 힙에 할당 후 스레드가 free()
```

---

## 5. 스레드 속성

```c
// 스택 크기 설정
pthread_attr_t attr;
pthread_attr_init(&attr);
pthread_attr_setstacksize(&attr, 1024 * 1024); // 1MB

pthread_create(&tid, &attr, func, arg);
pthread_attr_destroy(&attr);

// 기본 스레드 스택 크기:
// Linux: 8MB (ulimit -s로 확인)
// 임베디드: 수 KB

// 분리 속성으로 생성 (처음부터 detached):
pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
```

---

## 6. 장단점

```
장점:
  ✓ 낮은 생성 비용 (프로세스 대비)
  ✓ 메모리 공유 → 빠른 통신
  ✓ 멀티코어 활용 (CPU 바운드 작업)
  ✓ 컨텍스트 스위칭 빠름

단점:
  ✗ 공유 메모리 → 동기화 필요 (Mutex, Semaphore)
  ✗ 경쟁 상태 버그: 찾기 어려움
  ✗ 스레드 하나의 버그 → 전체 프로세스 다운
  ✗ 스택 오버플로우 위험

스레드 per 연결 한계:
  스레드 1만 개 = 스택 10GB + 컨텍스트 스위칭 오버헤드
  → 스레드 풀(Thread Pool)로 해결
```

---

## 핵심 요약

- **스레드**: 같은 프로세스 내 독립 실행 흐름. 메모리 공유.
- **Pthreads**: `pthread_create`, `pthread_join`, `pthread_detach`.
- **공유**: 전역 변수, 힙, FD. **독립**: 스택, 레지스터.
- **connfd 전달**: 반드시 힙에 할당해서 포인터로 전달.
- **detach**: join하지 않을 스레드는 반드시 detach (자원 누수 방지).
