---
title: "캐싱 완전 정복 (Caching Deep Dive)"
date: 2026-04-12
tags:
  - cache
  - redis
  - system-design
  - backend
---

# 캐싱 완전 정복

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

캐시는 `caching: true` 한 줄로 쓰지만, 그 한 줄이 뱉어내는 로직의 밑바닥엔 데이터 일관성, 장애 패턴, 메모리 관리, 분산 시스템의 복잡한 문제들이 얽혀 있습니다. 이 시리즈는 3년차 백엔드 개발자가 캐시를 **제대로 이해하고 직접 설계할 수 있는 수준**으로 끌어올리는 것을 목표로 합니다.

---

## 1. 캐시 기초 이론 (Fundamentals)

캐시가 왜 필요한지, 어떤 원리로 동작하는지 — 모든 것의 출발점입니다.

- [캐시란 무엇인가: Speed Gap과 지역성의 원리](./01-fundamentals/01-what-is-cache)
- [캐시 히트율 (Hit Rate)과 미스 종류 (Cold / Conflict / Capacity Miss)](./01-fundamentals/02-hit-rate-and-miss)
- [캐시 계층 구조: CPU L1/L2/L3 → DRAM → SSD → 분산 캐시 → CDN](./01-fundamentals/03-cache-hierarchy)
- [레이턴시 수치 감각: ns / μs / ms로 느끼는 캐시의 가치](./01-fundamentals/04-latency-numbers)

---

## 2. 읽기 / 쓰기 전략 (Read & Write Strategies)

캐시를 어떻게 채우고 어떻게 쓸지 — 가장 많이 면접에서 나오는 영역입니다.

### 읽기 전략
- [Cache-Aside (Lazy Loading): 애플리케이션이 직접 캐시를 관리한다](./02-strategies/01-cache-aside)
- [Read-Through: 캐시가 DB 읽기를 대신한다](./02-strategies/02-read-through)
- [Refresh-Ahead: 만료 전에 미리 갱신한다](./02-strategies/03-refresh-ahead)

### 쓰기 전략
- [Write-Through: 캐시와 DB를 동시에 쓴다](./02-strategies/04-write-through)
- [Write-Back (Write-Behind): 캐시에 먼저 쓰고 DB는 나중에](./02-strategies/05-write-back)
- [Write-Around: 캐시를 건너뛰고 DB에 직접 쓴다](./02-strategies/06-write-around)
- [전략 선택 가이드: Read-Heavy vs Write-Heavy, 유실 허용 여부](./02-strategies/07-strategy-selection-guide)

---

## 3. 캐시 만료와 무효화 (Expiration & Invalidation)

캐싱에서 가장 어렵고 중요한 부분입니다. 잘못 설계하면 오래된 데이터가 서비스에 노출됩니다.

- [TTL 설계: 신선도 vs 히트율 트레이드오프](./03-invalidation/01-ttl-design)
- [이벤트 기반 무효화: DB 변경 시 명시적으로 캐시를 날린다](./03-invalidation/02-event-driven-invalidation)
- [버전 기반 무효화: 키에 버전을 박는다 (`user:42:v3`)](./03-invalidation/03-version-based-invalidation)
- [태그 기반 무효화: 관련 키를 그룹으로 묶어 일괄 삭제한다](./03-invalidation/04-tag-based-invalidation)
- [분산 환경에서 무효화 전파 문제: Race Condition과 순서 보장](./03-invalidation/05-distributed-invalidation-problem)
- [Delete on Write vs Update on Write: 왜 삭제가 더 안전한가](./03-invalidation/06-delete-vs-update-on-write)

---

## 4. 제거 정책 (Eviction Policies)

메모리가 꽉 찼을 때 무엇을 버릴 것인가. 알고리즘 이해와 O(1) 구현까지 합니다.

- [LRU (Least Recently Used): 가장 오래 안 쓴 것을 버린다](./04-eviction/01-lru)
- [LFU (Least Frequently Used): 가장 적게 쓴 것을 버린다](./04-eviction/02-lfu)
- [FIFO / Random: 단순하지만 쓰이는 곳이 있다](./04-eviction/03-fifo-random)
- [CLOCK (Second Chance): LRU의 하드웨어 친화적 근사](./04-eviction/04-clock)
- [W-TinyLFU: Caffeine과 Redis가 쓰는 최신 알고리즘](./04-eviction/05-w-tinylfu)
- [LRU를 O(1)로 구현하기: HashMap + Doubly Linked List](./04-eviction/06-lru-implementation)
- [LFU를 O(1)로 구현하기: HashMap + HashMap + DLL](./04-eviction/07-lfu-implementation)

---

## 5. 캐시 장애 패턴 (Failure Patterns)

실무에서 반드시 만나는 4가지 장애 — 원인과 해결책을 코드 수준까지 파고듭니다.

- [Cache Stampede (Thundering Herd): 동시 미스가 DB를 폭발시킨다](./05-failure-patterns/01-cache-stampede)
- [Cache Avalanche: 캐시가 한꺼번에 만료되면 어떻게 되는가](./05-failure-patterns/02-cache-avalanche)
- [Cache Penetration: 존재하지 않는 키가 DB를 계속 찌른다](./05-failure-patterns/03-cache-penetration)
- [Hot Key (Hot Spot): 특정 키에 트래픽이 몰릴 때](./05-failure-patterns/04-hot-key)
- [Bloom Filter: Cache Penetration을 사전에 막는 확률적 자료구조](./05-failure-patterns/05-bloom-filter)

---

## 6. 캐시 키 설계 (Cache Key Design)

키를 어떻게 설계하느냐가 히트율과 무효화 전략을 결정합니다.

- [키 설계 원칙: 유일성, 예측 가능성, 충돌 방지](./06-key-design/01-key-design-principles)
- [네임스페이스와 계층 구조: `{service}:{entity}:{id}`](./06-key-design/02-namespace-and-hierarchy)
- [복합 키와 쿼리 캐싱: 다차원 조건을 키로 만드는 법](./06-key-design/03-composite-key)
- [키 크기 최적화와 메모리 오버헤드 계산](./06-key-design/04-key-size-optimization)

---

## 7. 분산 캐시 아키텍처 (Distributed Cache)

단일 서버를 넘어 여러 노드에 캐시를 분산하는 방법입니다.

- [분산 캐시 아키텍처: Standalone vs Cluster vs Sidecar](./07-distributed/01-distributed-cache-architecture)
- [일관성 해싱 (Consistent Hashing): 노드 추가/삭제 시 리밸런싱 최소화](./07-distributed/02-consistent-hashing)
- [가상 노드 (Virtual Nodes): 균등 분산 문제 해결](./07-distributed/03-virtual-nodes)
- [복제와 고가용성: Master-Replica, Sentinel, Cluster 비교](./07-distributed/04-replication-and-ha)
- [직렬화 포맷 선택: JSON vs MessagePack vs Protobuf vs CBOR](./07-distributed/05-serialization)
- [압축 전략: gzip / snappy / lz4 언제 적용할 것인가](./07-distributed/06-compression)

---

## 8. Redis 심화 (Redis Deep Dive)

가장 널리 쓰이는 캐시 서버. 내부 구조부터 운영까지 완전히 이해합니다.

### Redis 내부 구조
- [Redis 단일 스레드 이벤트 루프: 왜 빠른가](./08-redis/01-event-loop)
- [자료구조별 내부 인코딩: ziplist, listpack, skiplist, hashtable](./08-redis/02-internal-encoding)
- [Redis 메모리 할당: jemalloc과 단편화](./08-redis/03-memory-allocation)

### Redis 자료구조 실전 활용
- [String: 단순 캐시, 카운터, 분산 락의 기초](./08-redis/04-string)
- [Hash: 객체 필드별 캐시와 부분 갱신](./08-redis/05-hash)
- [List: 큐 구현과 최근 조회 목록](./08-redis/06-list)
- [Set / Sorted Set: 태그 관리, 랭킹, 커스텀 TTL](./08-redis/07-set-and-zset)
- [Bitmap / HyperLogLog: 대규모 불리언과 근사 카운팅](./08-redis/08-bitmap-hyperloglog)
- [Stream: 이벤트 로그와 소비자 그룹](./08-redis/09-stream)

### Redis 고급 기능
- [Lua 스크립트: 원자적 복합 연산](./08-redis/10-lua-script)
- [MULTI/EXEC Transaction과 WATCH (낙관적 잠금)](./08-redis/11-transaction)
- [Keyspace Notification: 만료 이벤트를 구독한다](./08-redis/12-keyspace-notification)
- [SCAN vs KEYS: 운영 환경에서 키를 탐색하는 안전한 방법](./08-redis/13-scan-vs-keys)

### Redis 영속성과 운영
- [RDB vs AOF vs 혼합 모드: 영속성 전략 선택](./08-redis/14-persistence)
- [maxmemory-policy 설정과 eviction 동작](./08-redis/15-maxmemory-policy)
- [메모리 단편화 모니터링과 lazyfree 설정](./08-redis/16-memory-optimization)
- [Redis Cluster: 16384 해시 슬롯과 데이터 분산](./08-redis/17-redis-cluster)

---

## 9. 분산 락 (Distributed Lock)

캐시 위에서 동시성을 제어하는 핵심 패턴입니다.

- [분산 락이 필요한 이유: 재고 감소, 중복 결제 시나리오](./09-distributed-lock/01-why-distributed-lock)
- [SETNX 기반 단순 락과 한계](./09-distributed-lock/02-setnx-lock)
- [`SET key value NX PX` 원자적 획득과 Lua 해제](./09-distributed-lock/03-atomic-lock)
- [Redlock 알고리즘: N개 인스턴스 과반수 획득](./09-distributed-lock/04-redlock)
- [Redlock 논쟁: Martin Kleppmann vs Antirez](./09-distributed-lock/05-redlock-controversy)
- [Watchdog (락 갱신): 작업이 TTL보다 오래 걸릴 때](./09-distributed-lock/06-lock-renewal)

---

## 10. 로컬 캐시 (In-Process Cache)

네트워크 왕복 없이 ns 단위로 응답하는 캐시. 단점도 명확합니다.

- [로컬 캐시의 장단점: 빠르지만 노드 간 불일치 발생](./10-local-cache/01-local-cache-tradeoffs)
- [Caffeine (Java): W-TinyLFU 기반 최고 성능 로컬 캐시](./10-local-cache/02-caffeine)
- [언어별 주요 구현체: node-cache, ristretto (Go), moka (Rust)](./10-local-cache/03-implementations-by-language)
- [2계층 캐시 (Two-Level Cache): L1 로컬 + L2 Redis](./10-local-cache/04-two-level-cache)
- [Pub/Sub으로 L1 캐시 무효화 전파하기](./10-local-cache/05-l1-invalidation-with-pubsub)

---

## 11. HTTP 캐시 (Web Cache)

API 서버부터 CDN, 브라우저까지 — HTTP 계층의 캐시를 완전히 이해합니다.

- [Cache-Control 헤더 완전 분석: max-age, no-cache, no-store, private, public](./11-http-cache/01-cache-control)
- [ETag와 조건부 요청: 304 Not Modified의 원리](./11-http-cache/02-etag-and-conditional-request)
- [Vary 헤더: 요청 헤더에 따른 캐시 변형](./11-http-cache/03-vary-header)
- [CDN 캐시: Origin Pull, Purge 전략, Surrogate-Control](./11-http-cache/04-cdn-cache)
- [브라우저 캐시: 메모리 캐시 vs 디스크 캐시 vs Service Worker](./11-http-cache/05-browser-cache)
- [Cache Busting: 콘텐츠 해시로 캐시를 무력화한다](./11-http-cache/06-cache-busting)

---

## 12. 데이터베이스와 캐시 동기화

DB와 캐시 사이의 동기화 — 가장 실수가 잦은 영역입니다.

- [MySQL Buffer Pool과 PostgreSQL Shared Buffers: DB 내부 캐시](./12-db-cache/01-db-internal-cache)
- [쿼리 결과 캐싱 전략: 페이지네이션, 집계, 복잡한 조인](./12-db-cache/02-query-result-caching)
- [CDC (Change Data Capture): Debezium으로 변경사항을 캐시에 반영한다](./12-db-cache/03-cdc-with-debezium)
- [Dual Write 패턴과 실패 시나리오](./12-db-cache/04-dual-write)
- [Outbox 패턴: DB 트랜잭션과 캐시 무효화를 원자적으로](./12-db-cache/05-outbox-pattern)

---

## 13. 캐시 일관성 (Cache Consistency)

분산 환경에서 캐시와 원본 데이터의 일관성을 어떻게 보장할 것인가.

- [강한 일관성 vs 최종 일관성: 캐시는 어느 쪽인가](./13-consistency/01-strong-vs-eventual-consistency)
- [Read-Your-Writes: 내가 쓴 건 내가 읽어야 한다](./13-consistency/02-read-your-writes)
- [Cache와 DB 사이의 Race Condition 시나리오 분석](./13-consistency/03-race-condition-scenarios)
- [CAP 이론으로 보는 캐시: 기본적으로 AP 시스템](./13-consistency/04-cap-and-cache)

---

## 14. 캐시 모니터링과 운영 (Observability)

운영하지 못하는 캐시는 시한폭탄입니다. 무엇을 보고 어떻게 판단하는지.

- [핵심 메트릭: Hit Rate, Eviction Rate, Latency, Memory Fragmentation](./14-observability/01-key-metrics)
- [이상 탐지: Hit Rate 급감 / 메모리 급증 / 레이턴시 급증의 원인](./14-observability/02-anomaly-detection)
- [캐시 워밍업 전략: Cold Start 문제와 Pre-warming](./14-observability/03-cache-warming)
- [Redis 운영 커맨드: INFO, MONITOR, SLOWLOG, DEBUG OBJECT](./14-observability/04-redis-operational-commands)

---

## 15. 실전 설계 패턴 (Real-World Patterns)

이론을 합쳐서 실제 서비스에 적용합니다.

- [사용자 세션 캐시 설계](./15-patterns/01-session-cache)
- [상품 목록 / 상세 캐시 설계](./15-patterns/02-product-cache)
- [랭킹 / 집계 캐시 설계: Sorted Set 활용](./15-patterns/03-ranking-cache)
- [API 응답 캐시: Idempotent 요청에만 캐시한다](./15-patterns/04-api-response-cache)
- [캐시 계층 설계 프레임워크: 변경 빈도 × 조회 빈도 매트릭스](./15-patterns/05-cache-layer-design-framework)
- [캐시하지 말아야 할 것: When NOT to Cache](./15-patterns/06-when-not-to-cache)

## 16. 캐싱 도입을 위한 프로젝트 설계


---

## 학습 순서 추천

처음 공부하는 거라면 이 순서로:

```
1 (기초) → 2 (전략) → 3 (무효화) → 4 (제거 정책) → 5 (장애 패턴)
→ 8 (Redis 심화) → 6 (키 설계) → 9 (분산 락) → 10 (로컬 캐시)
→ 11 (HTTP 캐시) → 12 (DB 동기화) → 13 (일관성) → 14 (모니터링) → 15 (실전)
```

면접 준비라면 **2, 3, 5, 8, 9** 먼저 잡으세요. 이 5개가 실무 면접의 80%입니다.

---

## 참고 자료

- [Redis 공식 문서](https://redis.io/docs/)
- [Designing Data-Intensive Applications — Martin Kleppmann](https://dataintensive.net/)
- [AWS ElastiCache 모범 사례](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/best-practices.html)
- [Caffeine Cache GitHub](https://github.com/ben-manes/caffeine)
