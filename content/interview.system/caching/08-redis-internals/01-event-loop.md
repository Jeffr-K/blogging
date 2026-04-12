---
title: "Redis 이벤트 루프: 싱글 스레드의 비밀"
date: 2026-04-12
tags: [redis, event-loop, single-thread, io-multiplexing]
---

## Redis 는 싱글 스레드

Redis의 명령어 처리는 하나의 스레드에서 순차적으로 실행됩니다.

```
멀티 스레드가 아닌데 어떻게 빠른가?
  → 모든 데이터가 메모리에 있음 (디스크 I/O 없음)
  → I/O 멀티플렉싱으로 동시에 여러 클라이언트 처리
  → 락/컨텍스트 스위칭 오버헤드 없음
```

---

## 이벤트 루프 동작

```
Redis 이벤트 루프 (ae.c):

1. epoll/kqueue로 모든 소켓 감시
2. 읽기 이벤트 발생 → 명령어 파싱
3. 명령어 실행 (메모리 접근, O(1)~O(log n))
4. 응답 버퍼에 쓰기
5. 쓰기 이벤트 발생 → 클라이언트에 응답

모든 단계가 하나의 루프에서 순서대로 처리
```

```c
/* Redis 이벤트 루프 핵심 (단순화) */
while (1) {
    // epoll로 이벤트 감지 (블로킹, timeout 있음)
    nevents = aeApiPoll(eventLoop, timeout);

    for (int i = 0; i < nevents; i++) {
        aeFileEvent *fe = &eventLoop->events[eventLoop->fired[i].fd];

        if (fe->mask & AE_READABLE)
            fe->rfileProc(eventLoop, fd, fe->clientData, mask);  // 명령어 처리

        if (fe->mask & AE_WRITABLE)
            fe->wfileProc(eventLoop, fd, fe->clientData, mask);  // 응답 전송
    }
}
```

---

## I/O 멀티플렉싱

```
클라이언트 1000개가 동시 연결되어 있을 때:

멀티 스레드 방식:
  → 스레드 1000개 → 컨텍스트 스위칭 오버헤드
  → 각 스레드의 스택 메모리

I/O 멀티플렉싱 방식:
  → 스레드 1개 + epoll
  → 이벤트가 있는 소켓만 처리
  → 컨텍스트 스위칭 없음

Linux: epoll
macOS: kqueue
BSD: select/poll
```

---

## 왜 싱글 스레드가 안전한가

원자성이 보장됩니다:

```
INCR counter  → 읽기-수정-쓰기가 중단 없이 실행
GET key       → 다른 명령어와 인터리빙 없음
```

```python
# Thread-safe without locks!
redis.incr("counter")  # 여러 클라이언트가 동시 호출해도 안전

# 만약 멀티 스레드였다면:
# Thread1: GET counter → 5
# Thread2: GET counter → 5
# Thread1: SET counter 6
# Thread2: SET counter 6  ← 하나 손실!
```

---

## 주의: O(n) 명령어는 느리다

싱글 스레드이므로 O(n) 명령어 하나가 다른 모든 요청을 블록합니다:

```bash
# 위험한 명령어 (운영에서 사용 금지)
KEYS *          # 모든 키 순회: O(n) → 수백만 키면 수초 블록
SMEMBERS        # 큰 Set의 모든 멤버: O(n)
HGETALL         # 큰 Hash의 모든 필드: O(n)
SORT            # 정렬: O(n log n)

# 안전한 대안
SCAN 0 MATCH * COUNT 100    # KEYS 대신
SSCAN key 0 COUNT 100       # SMEMBERS 대신
HSCAN key 0 COUNT 100       # HGETALL 대신
```

---

## Redis 6.0+: I/O 멀티스레딩

Redis 6.0부터 I/O 읽기/쓰기는 멀티스레드로 처리합니다. 하지만 **명령어 실행은 여전히 싱글 스레드**입니다.

```bash
# redis.conf
io-threads 4              # I/O 스레드 수
io-threads-do-reads yes   # 읽기도 멀티스레드
```

```
처리 단계:
  네트워크 읽기 → [멀티스레드]
  명령어 파싱   → [멀티스레드]
  명령어 실행   → [싱글스레드] ← 여전히 순차적
  응답 전송     → [멀티스레드]
```

---

## 타임아웃과 느린 명령어 감지

```bash
# redis.conf
slowlog-log-slower-than 10000  # 10ms 이상 걸린 명령어 로깅
slowlog-max-len 128

# 느린 명령어 확인
redis-cli SLOWLOG GET 10   # 최근 10개 느린 명령어
redis-cli SLOWLOG RESET
```

---

## 핵심 요약

- Redis: 명령어 실행은 싱글 스레드 + I/O 멀티플렉싱
- 메모리 기반 + 락 없음 → 초당 수십만 ops
- 싱글 스레드 → 원자성 자동 보장
- O(n) 명령어(KEYS, SMEMBERS)는 전체 블록 → SCAN으로 대체
- Redis 6.0+: I/O는 멀티스레드, 실행은 싱글스레드
