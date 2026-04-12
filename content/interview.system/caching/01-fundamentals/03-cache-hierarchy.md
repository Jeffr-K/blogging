---
title: "캐시 계층 구조: CPU부터 CDN까지"
date: 2026-04-12
tags: [cache, fundamentals, hierarchy]
---

## 전체 캐시 계층

```
요청
  ↓
브라우저 캐시 (메모리/디스크)
  ↓ MISS
CDN Edge 서버
  ↓ MISS
L7 로드밸런서 / API Gateway 캐시
  ↓ MISS
애플리케이션 로컬 메모리 캐시 (Caffeine, node-cache)
  ↓ MISS
분산 캐시 (Redis, Memcached)
  ↓ MISS
DB (MySQL, PostgreSQL)
  ↓ (내부적으로)
DB Buffer Pool / Page Cache
  ↓ MISS
SSD / HDD
```

각 계층은 **빠르지만 작은 저장소**와 **느리지만 큰 저장소** 사이의 중간 역할을 합니다.

---

## 하드웨어 캐시 계층

백엔드 개발자가 직접 제어하진 않지만, 코드 성능에 영향을 줍니다.

| 계층 | 크기 | 레이턴시 | 관리 주체 |
|------|------|----------|----------|
| 레지스터 | < 1KB | ~0.3ns | CPU |
| L1 캐시 | ~64KB | ~1ns | CPU |
| L2 캐시 | ~256KB | ~4ns | CPU |
| L3 캐시 | ~8-32MB | ~10ns | CPU (코어 공유) |
| DRAM | GB 단위 | ~100ns | OS |

**실무 관련 포인트:**

```java
// 배열 순차 접근 → 공간 지역성 → L1 캐시 히트 → 빠름
for (int i = 0; i < arr.length; i++) sum += arr[i];

// 2D 배열 열 우선 접근 → 캐시 라인 낭비 → 느림
for (int j = 0; j < cols; j++)
    for (int i = 0; i < rows; i++) sum += matrix[i][j]; // 느림!

// 행 우선 접근 → 빠름
for (int i = 0; i < rows; i++)
    for (int j = 0; j < cols; j++) sum += matrix[i][j]; // 빠름!
```

---

## 소프트웨어 캐시 계층

### 1. 로컬 메모리 캐시 (In-Process)

애플리케이션 프로세스 안의 메모리 (JVM Heap, Node.js V8 Heap 등)

```
레이턴시:  ~1μs (네트워크 왕복 없음)
용량:      수십~수백 MB (JVM Heap 일부)
공유:      해당 프로세스만 사용
단점:      여러 서버 간 불일치, GC 압박
```

```java
// Caffeine (Java)
Cache<String, User> cache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(5, TimeUnit.MINUTES)
    .build();
```

### 2. 분산 캐시 (External Cache)

별도의 캐시 서버 (Redis, Memcached)

```
레이턴시:  ~1ms (네트워크 왕복 포함)
용량:      수 GB ~ 수백 GB
공유:      모든 애플리케이션 서버가 공유
단점:      네트워크 비용, 별도 인프라
```

### 3. CDN 캐시

엣지 서버에 정적 자산 / API 응답을 캐싱

```
레이턴시:  수십 ms (사용자와 지리적으로 가까움)
대상:      이미지, JS/CSS, GET API 응답
단점:      Purge(무효화) 전파에 시간 걸림
```

---

## 2계층 캐시 (Two-Level Cache) 패턴

고성능 서비스에서 자주 쓰는 패턴입니다.

```
요청
  ↓
L1: 로컬 메모리 캐시 (Caffeine)
    - 극히 자주 접근하는 상위 N개
    - 레이턴시: ~1μs
  ↓ MISS
L2: Redis 분산 캐시
    - 전체 캐시 데이터
    - 레이턴시: ~1ms
  ↓ MISS
DB
```

```python
def get_product(product_id):
    # L1: 로컬 캐시 확인
    val = local_cache.get(product_id)
    if val:
        return val

    # L2: Redis 확인
    val = redis.get(f"product:{product_id}")
    if val:
        local_cache.set(product_id, val, ttl=60)  # L1에도 채움
        return val

    # DB 조회
    val = db.find_product(product_id)
    redis.set(f"product:{product_id}", serialize(val), ex=300)
    local_cache.set(product_id, val, ttl=60)
    return val
```

**주의:** L1 캐시는 서버마다 독립적이라 데이터가 불일치할 수 있습니다. Redis Pub/Sub으로 무효화 신호를 전파해야 합니다. (Ch.10 참고)

---

## 각 계층별 선택 기준

| 요구사항 | 선택 |
|---------|------|
| 극한의 속도, 프로세스 내부 | 로컬 메모리 캐시 |
| 여러 서버 공유, 수 GB 이상 | Redis |
| 전 세계 사용자, 정적 자산 | CDN |
| HTTP 응답 캐싱 | HTTP Cache-Control |
| DB 쿼리 결과 | Redis or 로컬 캐시 |

---

## 핵심 요약

- 캐시 계층은 CPU L1 ~ CDN까지 여러 단계로 존재
- 로컬 캐시(~1μs) > Redis(~1ms) > DB(~10ms) 순으로 빠름
- 2계층 캐시로 극한의 성능을 뽑되, 무효화 전파를 반드시 처리해야 함
- 각 계층은 빠를수록 용량이 작고 공유가 어려움
