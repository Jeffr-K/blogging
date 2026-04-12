---
title: "I/O 다중화 (I/O Multiplexing): select, poll, epoll"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "system-io", "epoll", "select", "poll", "csapp"]
---

## I/O 다중화

하나의 스레드로 **여러 I/O를 동시에 모니터링**하는 메커니즘입니다. 이벤트 루프의 핵심입니다.

---

## 1. 문제: 여러 FD 동시 모니터링

```
문제 상황:
  서버가 100개의 클라이언트 소켓을 관리
  
  방법 1: 각 소켓에 스레드 1개
    → 100 스레드: 메모리(각 8MB 스택), 컨텍스트 스위칭 오버헤드
    
  방법 2: 하나의 스레드가 모든 소켓 관리
    → I/O 다중화 (I/O Multiplexing)
    하나의 스레드가 여러 FD 중 어느 것이 준비됐는지 감시

I/O 다중화의 역할:
  "이 FD들 중 하나라도 읽을 준비가 되면 알려줘"
  → 준비된 FD에만 read() 호출 → 블로킹 없음
```

---

## 2. select()

```c
#include <sys/select.h>

int select(int nfds,              // 감시할 최대 FD + 1
           fd_set *readfds,        // 읽기 감시 FD 집합
           fd_set *writefds,       // 쓰기 감시 FD 집합
           fd_set *exceptfds,      // 예외 감시 FD 집합
           struct timeval *timeout); // 타임아웃 (NULL = 무한 대기)

// FD 집합 조작:
FD_ZERO(&readfds);       // 초기화
FD_SET(fd, &readfds);    // fd 추가
FD_CLR(fd, &readfds);    // fd 제거
FD_ISSET(fd, &readfds);  // fd가 준비됐는지 확인
```

```
사용 예:
  fd_set readfds;
  FD_ZERO(&readfds);
  FD_SET(sock1, &readfds);
  FD_SET(sock2, &readfds);
  FD_SET(sock3, &readfds);
  
  select(maxfd+1, &readfds, NULL, NULL, NULL);
  // 블로킹: 하나 이상 준비될 때까지 대기
  
  if (FD_ISSET(sock1, &readfds)) read(sock1, ...);
  if (FD_ISSET(sock2, &readfds)) read(sock2, ...);

단점:
  ✗ FD 최대 1024개 제한 (FD_SETSIZE)
  ✗ 매번 전체 FD 집합을 커널에 복사
  ✗ O(n) 스캔: 준비된 FD 찾기 위해 전체 순회
  ✗ select() 호출 후 FD 집합 다시 설정해야 함
```

---

## 3. poll()

```c
#include <poll.h>

int poll(struct pollfd *fds, nfds_t nfds, int timeout);

struct pollfd {
    int   fd;       // 감시할 FD
    short events;   // 감시할 이벤트 (POLLIN, POLLOUT 등)
    short revents;  // 실제 발생 이벤트 (커널이 채움)
};

// 사용 예:
struct pollfd fds[3];
fds[0] = {.fd=sock1, .events=POLLIN};
fds[1] = {.fd=sock2, .events=POLLIN};
fds[2] = {.fd=sock3, .events=POLLIN|POLLOUT};

poll(fds, 3, -1); // -1 = 무한 대기

for (int i = 0; i < 3; i++) {
    if (fds[i].revents & POLLIN) read(fds[i].fd, ...);
}

개선점 (vs select):
  ✓ FD 수 제한 없음 (1024 초과 가능)
  ✓ 이벤트/결과 분리 (revents 덮어쓰기 불필요)

여전히:
  ✗ 매 호출마다 전체 배열 커널에 복사
  ✗ O(n) 스캔
```

---

## 4. epoll() - 리눅스 현대 I/O 다중화

```c
#include <sys/epoll.h>

// 1. epoll 인스턴스 생성
int epfd = epoll_create1(0);

// 2. FD 등록 (한 번만!)
struct epoll_event ev;
ev.events = EPOLLIN | EPOLLET; // 관심 이벤트
ev.data.fd = sockfd;
epoll_ctl(epfd, EPOLL_CTL_ADD, sockfd, &ev);
// EPOLL_CTL_ADD: 추가
// EPOLL_CTL_MOD: 수정
// EPOLL_CTL_DEL: 삭제

// 3. 이벤트 대기
struct epoll_event events[MAX_EVENTS];
int n = epoll_wait(epfd, events, MAX_EVENTS, -1);
// n = 준비된 FD 수

for (int i = 0; i < n; i++) {
    if (events[i].events & EPOLLIN) {
        read(events[i].data.fd, ...);
    }
}
```

---

## 5. epoll의 혁신: O(1) 이벤트 알림

```
select/poll: 매번 전체 FD 목록 커널에 전달 + O(n) 스캔

epoll 내부 구조:
  커널이 관심 FD 목록을 레드블랙 트리로 유지
  FD에 이벤트 발생 → 준비 목록(ready list)에 추가

epoll_wait():
  ready list에서 이벤트만 반환
  → O(1) (등록된 FD 수에 무관, 이벤트 수에만 비례)

성능 비교 (10000 FD 중 1개 이벤트):
  select/poll: 10000개 검사
  epoll: 1개 반환 (즉시!)
```

---

## 6. 엣지 트리거 vs 레벨 트리거

```
레벨 트리거 (Level-Triggered, LT) - 기본:
  버퍼에 데이터가 있는 한 계속 이벤트 발생
  read()를 일부만 해도 다음 epoll_wait에서 다시 알림
  select, poll 방식과 동일

엣지 트리거 (Edge-Triggered, ET):
  상태 변화 시 한 번만 이벤트 발생
  새 데이터 도착 시 1번, 그 후 알림 없음
  → read()에서 EAGAIN까지 모두 읽어야 함
  → 논블로킹 I/O와 반드시 함께 사용

ET 사용 이유:
  ✓ 이벤트 알림 횟수 최소화
  ✓ 고성능 서버(Nginx)에서 선호

// ET 설정:
ev.events = EPOLLIN | EPOLLET; // ET 모드
```

---

## 7. select vs poll vs epoll 비교

```
                  select    poll      epoll
FD 제한           1024      없음      없음
FD 정보 복사      매번      매번      등록 1회
준비 FD 탐색      O(n)      O(n)      O(1)
이벤트 통보       없음      없음      있음 (ET)
사용 난이도       쉬움      중간      복잡
포터빌리티        높음      높음      리눅스 전용

현대 서버: epoll (Linux), kqueue (BSD/macOS), IOCP (Windows)
```

---

## 핵심 요약

- **I/O 다중화**: 하나의 스레드로 다수 FD를 감시 → 고성능 서버 기반.
- **select**: 이해하기 쉽지만 FD 1024 제한, O(n) 성능.
- **poll**: FD 제한 없음, 여전히 O(n).
- **epoll**: 커널에 FD 등록 1회, O(1) 이벤트 반환. 현대 표준.
- **ET 모드**: 변화 시 1회만 알림 → 모두 읽어야 함 (EAGAIN까지).
- **활용**: Nginx, Node.js, Redis, Netty 모두 epoll 기반.
