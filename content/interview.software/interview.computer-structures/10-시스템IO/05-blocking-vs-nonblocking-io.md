---
title: "블로킹(Blocking) vs 논블로킹(Non-blocking) I/O"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "system-io", "blocking", "nonblocking", "async", "csapp"]
---

## 블로킹 vs 논블로킹 I/O

I/O 작업이 완료될 때까지 **기다리느냐 마느냐**의 차이입니다.

---

## 1. 블로킹 I/O (Blocking I/O)

```
기본 동작:

  애플리케이션          커널
       │
       │── read() ──→│
       │              │ 데이터 도착 대기
       │   (블로킹)    │ ···
       │              │ 데이터 복사
       │←── 반환 ────│
       │ 데이터 처리
       │

특징:
  ✓ 단순한 프로그래밍 모델
  ✗ 스레드가 I/O 동안 아무것도 못 함 (CPU 낭비)
  ✗ 다수 연결 처리 시 스레드 폭발

예:
  server: for each connection, spawn a thread
  → 10000 연결 = 10000 스레드 → C10K 문제
```

---

## 2. 논블로킹 I/O (Non-blocking I/O)

```
O_NONBLOCK 플래그:
  데이터 없으면 즉시 -1 반환 + errno = EAGAIN

int fd = open("socket", O_RDONLY | O_NONBLOCK);
// 또는 기존 FD에 설정:
int flags = fcntl(fd, F_GETFL, 0);
fcntl(fd, F_SETFL, flags | O_NONBLOCK);
```

```
동작:
  애플리케이션          커널
       │── read() ──→│
       │←── EAGAIN ─│ (데이터 없음, 즉시 반환)
       │ 다른 작업    │
       │── read() ──→│
       │←── EAGAIN ─│
       │ 다른 작업    │
       │── read() ──→│
       │              │ 데이터 도착
       │←── 데이터 ─│

문제: 폴링(Polling) → CPU 낭비, 지연 발생
해결: I/O 다중화(epoll 등)와 함께 사용
```

---

## 3. 동기 vs 비동기 I/O

```
동기 I/O (Synchronous I/O):
  블로킹이든 논블로킹이든, 
  read()를 호출한 시점에 I/O 완료를 직접 기다림
  → 블로킹: 완료될 때까지 대기
  → 논블로킹: 즉시 반환, EAGAIN 받으면 나중에 재시도

비동기 I/O (Asynchronous I/O, AIO):
  I/O 요청 후 즉시 반환
  완료 시 콜백/시그널/이벤트로 통보

  애플리케이션          커널
       │── aio_read() →│ (즉시 반환)
       │ 다른 작업      │ 백그라운드 I/O
       │                │ 완료!
       │←── 시그널/콜백─│
       │ 결과 처리

Linux aio: POSIX AIO (제한적), io_uring (현대적, 고성능)
```

---

## 4. I/O 모델 비교

```
모델              │ read() 블로킹 │ 데이터 복사 블로킹 │ 사용 패턴
──────────────────┼───────────────┼────────────────────┼────────────
블로킹 I/O        │ 예            │ 예                 │ 스레드 per 연결
논블로킹 I/O      │ 아니오        │ 예                 │ 폴링 루프
I/O 다중화(select) │ 예 (select)  │ 예                 │ 이벤트 루프
시그널 기반 I/O   │ 아니오        │ 예                 │ 복잡, 거의 안 씀
비동기 I/O(AIO)   │ 아니오        │ 아니오             │ 고성능 서버

실질적 고성능:
  논블로킹 + epoll = 현대 고성능 서버의 표준
  (Node.js, Nginx, Redis 등이 사용)
```

---

## 5. 실제 사용 패턴

```c
// 논블로킹 소켓 패턴
fcntl(sockfd, F_SETFL, O_NONBLOCK);

while (1) {
    ssize_t n = read(sockfd, buf, sizeof(buf));
    if (n > 0) {
        // 데이터 처리
        process(buf, n);
    } else if (n == 0) {
        // 연결 종료
        close(sockfd);
        break;
    } else { // n < 0
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            // 데이터 없음, 나중에 재시도
            // (실제로는 epoll로 알림 받음)
            break;
        }
        // 실제 오류
        perror("read");
        break;
    }
}
```

---

## 6. io_uring (Linux 5.1+)

```
현대적 비동기 I/O 인터페이스:

  핵심: 공유 링 버퍼 (SQ: 제출 큐, CQ: 완료 큐)
  
  1. SQ에 I/O 요청 등록 (메모리 공간 공유 → 시스템 콜 불필요)
  2. io_uring_enter() 한 번으로 일괄 제출
  3. 커널이 백그라운드에서 처리
  4. CQ에서 완료 이벤트 수집

  장점:
    ✓ 시스템 콜 횟수 최소화
    ✓ 진정한 비동기 (파일 I/O도!)
    ✓ 버퍼 복사 제로 가능
    ✓ Rust의 tokio, Glommio 등이 사용
```

---

## 핵심 요약

- **블로킹**: read()가 데이터 올 때까지 대기. 단순하지만 스케일링 어려움.
- **논블로킹**: 데이터 없으면 EAGAIN 즉시 반환. 폴링 필요.
- **비동기**: I/O 요청 후 즉시 반환, 완료 시 콜백. 가장 효율적.
- **실전**: 논블로킹 소켓 + epoll = 고성능 서버의 표준 패턴.
- **io_uring**: 리눅스 최신 비동기 I/O. 시스템 콜 오버헤드 최소화.
