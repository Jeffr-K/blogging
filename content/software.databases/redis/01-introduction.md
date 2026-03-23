---
title: "[Redis] 1. Redis란 무엇인가"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "인메모리", "캐시", "데이터구조", "NoSQL"]
---

# Redis란 무엇인가

## 한 줄 정의

**Redis (Remote Dictionary Server)** = 인메모리 데이터 구조 저장소. 캐시, 메시지 브로커, 데이터베이스로 사용 가능.

---

## Redis가 빠른 이유

```
일반 DB (디스크 기반):
  요청 → 네트워크 → DB 프로세스 → 디스크 I/O → 응답
  지연: 수 밀리초 ~ 수십 밀리초

Redis (인메모리):
  요청 → 네트워크 → Redis 프로세스 → RAM 접근 → 응답
  지연: 수십 마이크로초 (0.1ms 이하)
```

**속도의 근거**:
- 모든 데이터가 RAM에 상주
- 단순한 자료구조 (해시테이블, 링크드리스트 등)
- 싱글 스레드 이벤트 루프 (I/O 멀티플렉싱) → 컨텍스트 스위칭 없음
- 네트워크 레이어 최소화 (RESP 프로토콜)

---

## Redis vs 일반 캐시

```
단순 캐시 (Memcached):
  key → value (문자열만)
  TTL, 만료
  끝

Redis:
  key → String, List, Set, Sorted Set, Hash, Bitmap,
        HyperLogLog, Geospatial, Stream
  TTL, 만료, 만료 이벤트
  트랜잭션, Lua 스크립트
  영속성 (RDB, AOF)
  Pub/Sub
  복제, Sentinel, Cluster
  → 캐시 + 데이터베이스 + 메시지 브로커
```

---

## 아키텍처

```
┌──────────────────────────────────────────┐
│                Redis Server               │
│                                           │
│  ┌────────────────────────────────────┐  │
│  │     Event Loop (싱글 스레드)        │  │
│  │                                    │  │
│  │  I/O Multiplexing (epoll/kqueue)   │  │
│  │    ↕ 수천 개 클라이언트 동시 처리   │  │
│  └────────────────────────────────────┘  │
│                                           │
│  ┌──────────────────┐  ┌──────────────┐  │
│  │   In-Memory DB   │  │  Persistence  │  │
│  │  (Hash Table)    │  │  (RDB / AOF) │  │
│  └──────────────────┘  └──────────────┘  │
└──────────────────────────────────────────┘
```

**싱글 스레드의 장점**:
- 경쟁 조건(Race Condition) 없음
- 원자적 명령어 보장
- 락(Lock) 없음 → 오버헤드 없음

**싱글 스레드의 제약**:
- 오래 걸리는 명령어(`KEYS *`, `FLUSHALL` 등)가 전체 서버 블로킹
- CPU 코어 하나만 사용 (Redis 6.0+부터 I/O 스레드 도입)

---

## 데이터 타입 한눈에

| 타입 | 설명 | 주요 명령어 |
|------|------|-------------|
| **String** | 문자열, 정수, 바이너리 | SET, GET, INCR, APPEND |
| **List** | 순서 있는 연결 리스트 | LPUSH, RPUSH, LRANGE, BLPOP |
| **Set** | 중복 없는 집합 | SADD, SMEMBERS, SUNION, SINTER |
| **Sorted Set** | 점수 기반 정렬 집합 | ZADD, ZRANGE, ZRANK, ZSCORE |
| **Hash** | 필드-값 맵 | HSET, HGET, HMGET, HINCRBY |
| **Bitmap** | 비트 배열 | SETBIT, GETBIT, BITCOUNT |
| **HyperLogLog** | 확률적 중복 제거 | PFADD, PFCOUNT |
| **Geospatial** | 위경도 인덱스 | GEOADD, GEODIST, GEORADIUS |
| **Stream** | 메시지 스트림 | XADD, XREAD, XGROUP |

---

## 영속성

Redis는 인메모리지만 영속성을 제공.

```
RDB (Redis Database Backup):
  특정 시점의 스냅샷을 .rdb 파일로 저장
  빠른 재시작, 적은 디스크 사용
  마지막 스냅샷 이후 데이터 유실 가능

AOF (Append Only File):
  모든 쓰기 명령을 .aof 파일에 추가
  데이터 유실 최소화
  파일 크기 증가

복합 사용:
  RDB + AOF 동시 사용 → 빠른 재시작 + 데이터 안전성
```

---

## 주요 사용 사례

### 캐싱

```
DB 부하 감소:
  클라이언트 → Redis (캐시 히트) → 응답 (빠름)
  클라이언트 → Redis (캐시 미스) → DB → Redis 저장 → 응답
```

### 세션 저장소

```
여러 서버 인스턴스가 공유하는 세션:
  서버 1 ─┐
  서버 2 ─┼─→ Redis (세션 저장) ← 모든 서버가 공유
  서버 3 ─┘
```

### 분산 락

```
동시 접근 제어:
  서비스 A: SET lock:order-123 "서비스A" NX EX 30  → 성공
  서비스 B: SET lock:order-123 "서비스B" NX EX 30  → 실패 (이미 존재)
```

### 리더보드 / 랭킹

```
Sorted Set으로 점수 기반 실시간 순위:
  ZADD leaderboard 9500 "alice"
  ZADD leaderboard 8800 "bob"
  ZRANK leaderboard "bob"  → 1 (0-based, alice가 0위)
```

### Rate Limiting

```
초당 API 호출 제한:
  INCR rate:user-123:2024010112
  EXPIRE rate:user-123:2024010112 60
```

### Pub/Sub

```
실시간 메시지:
  채팅 서버 A → PUBLISH channel:room-1 "안녕하세요"
  채팅 서버 B ← SUBSCRIBE channel:room-1  → 수신
```

### 작업 큐

```
백그라운드 작업:
  API 서버: LPUSH queue:email-send '{"to":"alice@..."}'
  Worker:   BRPOP queue:email-send  → 이메일 발송
```

---

## Redis 버전 역사

| 버전 | 주요 기능 |
|------|-----------|
| 1.0 (2009) | 기본 자료구조 |
| 2.6 (2012) | Lua 스크립팅 |
| 3.0 (2015) | Redis Cluster |
| 4.0 (2017) | 모듈 시스템, Lazy Freeing |
| 5.0 (2018) | Redis Streams |
| 6.0 (2020) | ACL, SSL, I/O 멀티스레딩 |
| 6.2 (2021) | COPY, GETDEL, LMPOP |
| 7.0 (2022) | Redis Functions, Multi-Part AOF |
| 7.2 (2023) | Sharded Pub/Sub, LMPOP 개선 |
| 8.0 (2025) | Redis Stack 통합, 성능 개선 |

---

## 정리

- Redis = 인메모리 데이터 구조 저장소, 단순 캐시 그 이상
- RAM 기반 → 마이크로초 응답 시간
- 풍부한 자료구조 → 다양한 문제를 Redis 하나로 해결
- 영속성 + 복제 + 클러스터 → 프로덕션 고가용성 지원
- 캐시, 세션, 분산락, 랭킹, 큐, Pub/Sub 등 광범위한 활용
