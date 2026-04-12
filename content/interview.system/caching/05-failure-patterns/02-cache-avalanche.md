---
title: "Cache Avalanche: 대규모 캐시 만료"
date: 2026-04-12
tags: [cache, avalanche, failure, redis]
---

## 문제: 캐시가 한꺼번에 사라지면?

**Cache Avalanche**는 다수의 캐시 키가 동시에 만료되거나, 캐시 서버 자체가 다운될 때 발생합니다.

```
시나리오 1: 동시 만료
  새벽 2시 서비스 배포 → 전체 캐시 워밍
  → 모든 키에 TTL=1시간 설정
  → 다음날 새벽 3시, 모든 키 동시 만료
  → 수천 건의 DB 쿼리 동시 발생

시나리오 2: Redis 다운
  Redis 재시작 → 모든 캐시 소멸
  → 모든 요청이 DB로 직행
  → DB 과부하 → DB도 다운
```

Stampede가 단일 키 문제라면, Avalanche는 **전체 캐시 계층의 붕괴**입니다.

---

## 해결 1: TTL Jitter (동시 만료 방지)

```python
import random

def cache_set_with_jitter(cache, key, value, base_ttl: int):
    # ±10% 범위로 TTL 분산
    jitter = random.randint(-base_ttl // 10, base_ttl // 10)
    ttl = base_ttl + jitter
    cache.set(key, value, ttl)

# 사용
cache_set_with_jitter(cache, "user:1", user_data, base_ttl=3600)
# TTL이 3240~3960초 사이 랜덤 → 동시 만료 없음
```

---

## 해결 2: Circuit Breaker (DB 보호)

캐시가 없어도 DB가 일정 이상 부하를 받으면 요청을 차단합니다.

```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=30):
        self.failure_count = 0
        self.threshold = failure_threshold
        self.timeout = timeout
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def call(self, fn):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.timeout:
                self.state = "HALF_OPEN"
            else:
                raise Exception("Circuit OPEN: DB 보호 중")

        try:
            result = fn()
            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failure_count = 0
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.threshold:
                self.state = "OPEN"
            raise

# 사용
breaker = CircuitBreaker(failure_threshold=5)

def get_user(user_id):
    cached = cache.get(f"user:{user_id}")
    if cached:
        return cached
    # DB 조회를 Circuit Breaker로 감쌈
    return breaker.call(lambda: db.query(f"SELECT * FROM users WHERE id={user_id}"))
```

---

## 해결 3: Cache 서버 이중화 (Replication)

단일 장애점 제거:

```
Redis Sentinel 구성:
  Master → Slave1, Slave2
  Sentinel 3개가 Master 모니터링
  Master 다운 시 자동 Failover
```

```bash
# Redis Sentinel 설정
sentinel monitor mymaster 127.0.0.1 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
```

```
Redis Cluster 구성:
  16384 슬롯을 여러 노드에 분산
  각 노드는 Primary + Replica 쌍
  노드 하나 다운 시 Replica가 승격
```

---

## 해결 4: 다단계 캐시 (Local + Distributed)

Redis가 다운되어도 로컬 캐시가 버팁니다:

```python
from caffeine import Cache  # 로컬 캐시

local_cache = Cache(max_size=1000, ttl=60)   # 1분 로컬 캐시
redis_client = Redis()                         # 분산 캐시

def get_with_fallback(key, fetch_fn, ttl=3600):
    # 1. 로컬 캐시 확인
    val = local_cache.get(key)
    if val:
        return val

    # 2. Redis 확인
    try:
        val = redis_client.get(key)
        if val:
            local_cache.set(key, val)
            return val
    except RedisConnectionError:
        pass  # Redis 다운 → DB로 직행

    # 3. DB 조회
    val = fetch_fn()
    try:
        redis_client.setex(key, ttl, val)
    except RedisConnectionError:
        pass
    local_cache.set(key, val)
    return val
```

---

## 해결 5: Cache Warming (재시작 대비)

캐시 서버 재시작 전에 미리 데이터를 채웁니다:

```python
def warm_cache():
    """서비스 시작 시 또는 배포 시 호출"""
    popular_users = db.query("SELECT id FROM users ORDER BY access_count DESC LIMIT 10000")
    popular_products = db.query("SELECT id FROM products ORDER BY views DESC LIMIT 5000")

    for user in popular_users:
        val = db.query(f"SELECT * FROM users WHERE id={user.id}")
        ttl = 3600 + random.randint(-360, 360)  # Jitter 포함
        redis_client.setex(f"user:{user.id}", ttl, serialize(val))

    for product in popular_products:
        val = db.query(f"SELECT * FROM products WHERE id={product.id}")
        ttl = 1800 + random.randint(-180, 180)
        redis_client.setex(f"product:{product.id}", ttl, serialize(val))
```

---

## Stampede vs Avalanche 비교

| | Cache Stampede | Cache Avalanche |
|--|---------------|----------------|
| 원인 | 단일 키 만료 | 대규모 키 만료 / 서버 다운 |
| 규모 | 키 하나에 대한 폭주 | 전체 캐시 계층 붕괴 |
| 주요 해결 | Mutex, XFetch | Jitter, Circuit Breaker, 이중화 |

---

## 핵심 요약

- Avalanche: 다수 키 동시 만료 or 캐시 서버 전체 다운
- **TTL Jitter**: 동시 만료 방지
- **Circuit Breaker**: DB 과부하 차단
- **Redis Sentinel/Cluster**: 단일 장애점 제거
- **Local + Distributed 이중 캐시**: Redis 다운 대비
- **Cache Warming**: 배포/재시작 시 미리 채우기
