---
title: "Hot Key: 특정 키에 트래픽 집중"
date: 2026-04-12
tags: [cache, hot-key, redis, local-cache, replication]
---

## 문제: 한 키에 트래픽이 몰리면?

Redis는 싱글 스레드 기반입니다. 특정 키에 초당 수만 건의 요청이 몰리면:

```
시나리오: 실시간 랭킹 조회
  /ranking → Redis GET "top_100"
  → 트래픽 폭증 시 초당 50,000 요청이 "top_100" 하나에 집중
  → Redis 단일 노드 CPU 포화
  → 전체 서비스 응답 지연
```

Hot Key 문제는 분산 캐시를 써도 단일 노드에 부하가 집중되어 발생합니다.

---

## 해결 1: 로컬 캐시로 Redis 부하 분산

각 애플리케이션 서버가 로컬 캐시를 갖습니다:

```python
from cachetools import TTLCache
import threading

# JVM의 Caffeine 역할 (Python에서는 cachetools)
local_cache = TTLCache(maxsize=100, ttl=10)  # 10초 로컬 캐시
local_lock = threading.Lock()

def get_ranking():
    key = "top_100"

    # 1. 로컬 캐시 (Redis 요청 없음)
    with local_lock:
        if key in local_cache:
            return local_cache[key]

    # 2. Redis (초당 1번만 여기 도달)
    val = redis.get(key)
    if not val:
        val = db.query("SELECT ... ORDER BY score DESC LIMIT 100")
        redis.setex(key, 60, serialize(val))
    else:
        val = deserialize(val)

    with local_lock:
        local_cache[key] = val

    return val
```

서버 10대라면 Redis 요청이 10분의 1로 줄어듭니다.

---

## 해결 2: Key Sharding (복제)

Hot Key를 여러 복제본으로 분산합니다:

```python
import random

REPLICAS = 10  # 복제본 수

def set_hot_key(key: str, value, ttl: int):
    """Hot Key를 10개 복제본으로 분산 저장"""
    for i in range(REPLICAS):
        redis.setex(f"{key}:replica:{i}", ttl, serialize(value))

def get_hot_key(key: str):
    """랜덤으로 복제본 하나 선택"""
    shard = random.randint(0, REPLICAS - 1)
    val = redis.get(f"{key}:replica:{shard}")
    if val:
        return deserialize(val)

    # 모든 복제본 실패 시 원본 조회
    return redis.get(key)

def invalidate_hot_key(key: str):
    """캐시 무효화 시 모든 복제본 삭제"""
    pipeline = redis.pipeline()
    for i in range(REPLICAS):
        pipeline.delete(f"{key}:replica:{i}")
    pipeline.delete(key)
    pipeline.execute()
```

---

## 해결 3: Read-Through + 로컬 캐시 조합

Spring/Caffeine 환경:

```java
@Configuration
public class CacheConfig {
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(10, TimeUnit.SECONDS)  // 10초 로컬 캐시
            .recordStats());
        return manager;
    }
}

@Service
public class RankingService {

    @Cacheable(value = "ranking", key = "'top100'")
    public List<RankingItem> getTop100() {
        // Caffeine이 로컬에서 캐시
        // Redis에서 miss 나면 이 메서드 실행
        return redisTemplate.opsForValue().get("ranking:top100");
    }
}
```

---

## 해결 4: Hot Key 탐지

문제가 생기기 전에 Hot Key를 찾아야 합니다:

```bash
# Redis redis-cli --hotkeys (Redis 4.0+)
redis-cli --hotkeys

# 또는 MONITOR로 실시간 확인 (운영에서는 부하 주의)
redis-cli MONITOR | grep "GET\|SET" | awk '{print $4}' | sort | uniq -c | sort -rn | head -20
```

```python
# 애플리케이션 레벨 카운터
from collections import Counter
import time

request_counter = Counter()
WINDOW = 60  # 1분 윈도우

def track_and_get(key: str):
    request_counter[key] += 1

    # 주기적으로 Hot Key 리포트
    if sum(request_counter.values()) % 10000 == 0:
        top_keys = request_counter.most_common(10)
        logger.info(f"Hot Keys: {top_keys}")

    return redis.get(key)
```

---

## 해결 5: Redis Cluster로 부하 분산

Redis Cluster는 키를 해시 슬롯으로 자동 분산합니다. 하지만 동일 키는 항상 동일 노드로 가므로 **Hot Key 자체는 해결 안 됩니다.** Key Sharding과 조합해야 합니다:

```python
# Cluster에서 Key Sharding 적용
def get_clustered_hot_key(key: str):
    shard = random.randint(0, 9)
    # {ranking} 태그로 같은 슬롯 보장하면서 샤딩 (필요 시)
    # 또는 그냥 다른 키로 분산
    return cluster_redis.get(f"{key}:s{shard}")
```

---

## 상황별 선택

| 상황 | 해결책 |
|------|--------|
| 읽기 집중 (랭킹, 설정) | 로컬 캐시 + 짧은 TTL |
| 쓰기도 많음 | Key Sharding + 무효화 주의 |
| 예측 불가능한 급등 | Hot Key 탐지 + 자동 샤딩 |
| 일시적 이벤트 (라이브, 세일) | 사전 로컬 캐시 배포 |

---

## 핵심 요약

- Hot Key: 단일 Redis 키에 트래픽 집중 → 노드 CPU 포화
- **로컬 캐시**: 각 서버에서 짧은 TTL로 Redis 부하 감소
- **Key Sharding**: 복제본 N개에 랜덤 분산
- **탐지**: `redis-cli --hotkeys` 또는 애플리케이션 카운터
- 무효화 시 모든 복제본 삭제 주의
