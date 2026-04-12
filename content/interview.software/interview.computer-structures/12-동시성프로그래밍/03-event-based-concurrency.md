---
title: "이벤트 기반 동시성: I/O 다중화와 이벤트 루프"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "concurrency", "event-loop", "epoll", "csapp"]
---

## 이벤트 기반 동시성

단일 스레드가 **이벤트 루프(Event Loop)**로 수천 개의 연결을 처리합니다. Node.js, Nginx의 근간입니다.

---

## 1. 핵심 아이디어

```
문제: 클라이언트마다 프로세스/스레드를 만들면?
  1만 연결 = 1만 스레드 = 메모리 10GB+ (스레드당 1MB)

해결: 이벤트 루프
  단일 스레드가 어떤 FD가 준비됐는지 감시
  준비된 FD만 처리 → 블로킹 없음
  
  핵심 전제: I/O는 논블로킹, 연산은 빠르게

이벤트 루프:
  while (1) {
      이벤트 = 기다림 (epoll_wait)
      for each 준비된 FD:
          이벤트 핸들러 호출
  }
```

---

## 2. 이벤트 루프 구현

```c
#define MAX_EVENTS 1024
#define MAX_CONNS  10000

int epfd;
int connfds[MAX_CONNS];

// 이벤트 루프 시작
void event_loop(int listenfd) {
    epfd = epoll_create1(0);
    
    // 리스닝 소켓 등록
    struct epoll_event ev;
    ev.events = EPOLLIN;
    ev.data.fd = listenfd;
    epoll_ctl(epfd, EPOLL_CTL_ADD, listenfd, &ev);
    
    struct epoll_event events[MAX_EVENTS];
    
    while (1) {
        int n = epoll_wait(epfd, events, MAX_EVENTS, -1);
        
        for (int i = 0; i < n; i++) {
            if (events[i].data.fd == listenfd) {
                // 새 연결
                accept_connection(listenfd);
            } else {
                // 기존 연결 데이터
                handle_data(events[i].data.fd);
            }
        }
    }
}

void accept_connection(int listenfd) {
    int connfd = accept(listenfd, NULL, NULL);
    // 논블로킹으로 설정
    int flags = fcntl(connfd, F_GETFL, 0);
    fcntl(connfd, F_SETFL, flags | O_NONBLOCK);
    
    // epoll에 등록
    struct epoll_event ev;
    ev.events = EPOLLIN | EPOLLET; // 엣지 트리거
    ev.data.fd = connfd;
    epoll_ctl(epfd, EPOLL_CTL_ADD, connfd, &ev);
}

void handle_data(int connfd) {
    char buf[4096];
    ssize_t n;
    
    // ET 모드: EAGAIN까지 모두 읽기
    while ((n = read(connfd, buf, sizeof(buf))) > 0) {
        process_request(connfd, buf, n);
    }
    
    if (n == 0) {
        // 연결 종료
        epoll_ctl(epfd, EPOLL_CTL_DEL, connfd, NULL);
        close(connfd);
    }
    // n < 0 && errno == EAGAIN: 다 읽음, 다음 이벤트 대기
}
```

---

## 3. 상태 머신 (State Machine)

```
이벤트 기반의 핵심: 각 연결이 상태를 가짐

블로킹 코드 (직관적):
  connfd = accept();
  request = read_request(connfd);  // 블로킹
  response = process(request);
  write_response(connfd, response); // 블로킹
  close(connfd);

이벤트 기반 코드 (상태 머신):
  enum State { READING, PROCESSING, WRITING, DONE };
  
  struct Connection {
      int fd;
      enum State state;
      char req_buf[4096];
      int  req_len;
      char res_buf[4096];
      int  res_len, res_sent;
  };
  
  // EPOLLIN 이벤트:
  case READING:
      n = read(conn->fd, ...);
      if (request_complete(conn))
          conn->state = PROCESSING;
  
  // 처리 완료:
  case PROCESSING:
      conn->response = generate_response(conn->request);
      conn->state = WRITING;
      epoll_ctl(epfd, MOD, conn->fd, EPOLLOUT); // 쓰기 이벤트로 전환
  
  // EPOLLOUT 이벤트:
  case WRITING:
      n = write(conn->fd, ...);
      if (all_sent)
          conn->state = DONE;
```

---

## 4. 장단점

```
장점:
  ✓ 낮은 메모리: 스레드/프로세스 생성 없음
  ✓ 컨텍스트 스위칭 없음 (단일 스레드)
  ✓ 캐시 친화적: 스레드 전환 없어 캐시 오염 적음
  ✓ C10K 문제 해결 (수만 동시 연결)

단점:
  ✗ CPU 바운드 작업 불가: 긴 연산이 전체 차단
  ✗ 코드 복잡도: Callback hell, 상태 머신
  ✗ 멀티코어 활용 제한: 단일 스레드
  ✗ 오류 격리 없음: 버그 하나가 전체 서버 다운

해결:
  CPU 작업 → 별도 워커 스레드에 위임
  멀티코어 → 코어당 이벤트 루프 1개 (Nginx worker_processes)
```

---

## 5. 실제 사례

```
Node.js:
  JavaScript 단일 스레드 이벤트 루프
  I/O는 libuv (epoll/kqueue/IOCP)
  CPU 작업 → worker_threads 또는 child_process

Nginx:
  worker_processes auto; (코어 수만큼)
  각 워커가 독립적 이벤트 루프
  accept_mutex: 워커 간 연결 분배

Redis:
  단일 스레드 이벤트 루프 (ae.c)
  모든 명령이 원자적 → 락 불필요
  CPU 바운드(RDB 저장 등) → fork로 분리

Nginx vs Apache:
  Nginx: 이벤트 기반 → 수만 동시 연결, 낮은 메모리
  Apache prefork: 프로세스 기반 → 격리성, 높은 메모리
```

---

## 핵심 요약

- **이벤트 루프**: epoll_wait → 이벤트 처리 반복. 단일 스레드로 수만 연결.
- **논블로킹 I/O 필수**: 이벤트 루프가 블로킹되면 전체 마비.
- **상태 머신**: 각 연결의 상태를 명시적으로 관리.
- **장점**: 낮은 메모리, 컨텍스트 스위칭 없음.
- **단점**: CPU 바운드 작업이 루프를 막음. 코드 복잡.
