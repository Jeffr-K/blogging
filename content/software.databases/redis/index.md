---
title: "Redis 완전 학습 가이드"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "캐시", "인메모리", "데이터구조", "pub-sub", "분산락"]
---

# Redis 완전 학습 가이드

Redis를 처음 배우는 단계부터 프로덕션 운영까지, 데이터 구조부터 Spring 통합, 분산락, 이벤트 스트리밍까지 모든 것을 다룹니다.

---

## 목차

### 1부. Redis 기초

| # | 제목 | 핵심 내용 |
|---|------|-----------|
| [01](./01-introduction.md) | Redis란 무엇인가 | 인메모리 DB, 영속성, 아키텍처, 사용 사례 |
| [02](./02-installation-cli.md) | 설치와 CLI | redis-server, redis-cli, 기본 명령어, RESP 프로토콜 |
| [03](./03-data-types-overview.md) | 데이터 타입 개요 | String, List, Set, ZSet, Hash, Bitmap, HyperLogLog, Stream |

---

### 2부. 데이터 타입 상세

| # | 제목 | 핵심 내용 |
|---|------|-----------|
| [04](./04-string.md) | String | SET/GET, INCR, SETEX, SETNX, 비트 연산, 사용 패턴 |
| [05](./05-list.md) | List | LPUSH/RPUSH, LRANGE, BLPOP, 작업 큐, 스택 |
| [06](./06-set.md) | Set | SADD/SMEMBERS, 교집합/합집합/차집합, 태그 시스템 |
| [07](./07-sorted-set.md) | Sorted Set | ZADD/ZRANGE, 점수 기반 정렬, 리더보드, 범위 쿼리 |
| [08](./08-hash.md) | Hash | HSET/HGET, 객체 저장, 부분 업데이트, 메모리 최적화 |
| [09](./09-bitmap-hyperloglog.md) | Bitmap & HyperLogLog | 비트 플래그, 대규모 중복 제거, DAU 측정 |
| [10](./10-geospatial.md) | Geospatial | GEOADD, GEORADIUS, 위치 기반 서비스 |
| [11](./11-streams.md) | Streams | XADD/XREAD, Consumer Group, Kafka 유사 패턴 |

---

### 3부. 핵심 기능

| # | 제목 | 핵심 내용 |
|---|------|-----------|
| [12](./12-expiry-eviction.md) | TTL & 만료 정책 | EXPIRE, TTL, 만료 이벤트, eviction 정책 |
| [13](./13-transactions-lua.md) | 트랜잭션 & Lua | MULTI/EXEC, WATCH, Lua 스크립트, 원자성 |
| [14](./14-pub-sub.md) | Pub/Sub | PUBLISH/SUBSCRIBE, 패턴 구독, Keyspace 알림 |
| [15](./15-pipeline-batch.md) | Pipeline & 배치 | Pipelining, MSET/MGET, 성능 최적화 |

---

### 4부. 영속성과 고가용성

| # | 제목 | 핵심 내용 |
|---|------|-----------|
| [16](./16-persistence.md) | 영속성 — RDB & AOF | RDB 스냅샷, AOF 로그, 복합 사용 전략 |
| [17](./17-replication.md) | 복제 — Master/Replica | 복제 원리, 비동기 복제, WAIT 명령어 |
| [18](./18-sentinel.md) | Redis Sentinel | 자동 장애조치, 모니터링, 클라이언트 연동 |
| [19](./19-cluster.md) | Redis Cluster | 샤딩, 해시 슬롯, 클러스터 토폴로지, 운영 |

---

### 5부. 실무 패턴

| # | 제목 | 핵심 내용 |
|---|------|-----------|
| [20](./20-caching-patterns.md) | 캐싱 패턴 | Cache-Aside, Write-Through, Cache Stampede 방지 |
| [21](./21-session-management.md) | 세션 관리 | 세션 저장소, Spring Session, 멀티 서버 세션 |
| [22](./22-rate-limiting.md) | Rate Limiting | 고정 윈도우, 슬라이딩 윈도우, 토큰 버킷 |
| [23](./23-distributed-lock.md) | 분산 락 | SETNX, Redlock 알고리즘, Redisson 분산 락 |
| [24](./24-leaderboard-ranking.md) | 리더보드 & 랭킹 | Sorted Set 기반 실시간 순위, 페이지네이션 |
| [25](./25-message-queue.md) | 메시지 큐 패턴 | List 기반 큐, Stream 기반 큐, Pub/Sub 비교 |

---

### 6부. Spring 통합

| # | 제목 | 핵심 내용 |
|---|------|-----------|
| [26](./26-spring-data-redis.md) | Spring Data Redis | RedisTemplate 설정, 직렬화, CRUD 패턴 |
| [27](./27-redistemplate-api.md) | RedisTemplate API 전체 | ValueOps, ListOps, SetOps, ZSetOps, HashOps |
| [28](./28-spring-cache.md) | Spring Cache 추상화 | @Cacheable, @CacheEvict, @CachePut, TTL 설정 |
| [29](./29-spring-session.md) | Spring Session | HttpSession → Redis, 세션 공유, 설정 |
| [30](./30-lettuce.md) | Lettuce 클라이언트 | 비동기/리액티브, 커넥션 풀, Cluster 연동 |
| [31](./31-redisson.md) | Redisson | 분산 자료구조, RLock, RMap, RQueue, 스케줄러 |

---

### 7부. 데이터 모델링

| # | 제목 | 핵심 내용 |
|---|------|-----------|
| [32](./32-data-modeling.md) | Redis 데이터 모델링 | 키 네이밍, 관계 표현, 역인덱스, 페이지네이션 |
| [33](./33-json-search.md) | RedisJSON & RediSearch | JSON 문서 저장, 전문 검색, 인덱싱 |

---

### 8부. 성능과 운영

| # | 제목 | 핵심 내용 |
|---|------|-----------|
| [34](./34-memory-optimization.md) | 메모리 최적화 | 인코딩 최적화, 압축, 메모리 분석 |
| [35](./35-performance-tuning.md) | 성능 튜닝 | SLOWLOG, latency, 커넥션 풀, 벤치마크 |
| [36](./36-monitoring.md) | 모니터링 | INFO 명령어, Redis Exporter, Grafana, 알림 |
| [37](./37-security.md) | 보안 | 인증, TLS, ACL, 네트워크 격리 |
| [38](./38-operations.md) | 운영 가이드 | 백업, 복구, 마이그레이션, SCAN, DEBUG |

---

## 학습 로드맵

```
입문 (1주)
  01 → 02 → 03 → 04~11 (데이터 타입 훑기)

중급 (2주)
  12~15 (TTL, 트랜잭션, Pub/Sub, Pipeline)
  16~19 (영속성, 복제, Sentinel, Cluster)

실무 (3주)
  20~25 (캐싱, 세션, Rate Limiting, 분산락, 랭킹, 큐)
  26~31 (Spring 통합 전체)

심화 (4주)
  32~33 (데이터 모델링, JSON/Search)
  34~38 (메모리, 성능, 모니터링, 보안, 운영)
```

---

## 빠른 참조

### 데이터 타입 선택 가이드

| 요구사항 | 타입 |
|----------|------|
| 단순 키-값, 카운터, 세션 | String |
| 순서 있는 목록, 작업 큐 | List |
| 중복 없는 집합, 태그 | Set |
| 점수 기반 정렬, 리더보드 | Sorted Set (ZSet) |
| 필드-값 객체, 사용자 프로필 | Hash |
| 방문자 중복 제거, DAU | HyperLogLog |
| 비트 플래그 (출석, 기능 플래그) | Bitmap |
| 위치 정보, 근처 매장 | Geospatial |
| 메시지 스트리밍, Consumer Group | Stream |

### Spring 통합 선택 가이드

| 상황 | 선택 |
|------|------|
| 단순 캐싱 | `@Cacheable` + Spring Cache |
| 세션 클러스터링 | Spring Session + Redis |
| 세밀한 Redis 제어 | RedisTemplate |
| 비동기/리액티브 | Lettuce + ReactiveRedisTemplate |
| 분산 락, 분산 자료구조 | Redisson |
| 고성능 배치 | Pipeline (Lettuce/RedisTemplate) |

---

## 관련 시리즈

- [Kafka 완전 학습 가이드](../kafka/index.md) — 이벤트 스트리밍
- [RabbitMQ 완전 학습 가이드](../rabbitmq/index.md) — 메시지 큐
