---
title: "Read Repair와 Write-Behind"
date: 2026-04-12
tags: [cache, read-repair, write-behind, db-sync]
---

## Read Repair

캐시 미스 시 DB에서 읽어 캐시를 자동으로 채우는 패턴. Cache-Aside의 자연스러운 자가 치유 메커니즘입니다.

```python
def get_user(user_id: int):
    cached = redis.get(f"user:{user_id}")

    if cached:
        return deserialize(cached)

    # 캐시 미스 → DB에서 읽어 캐시 "수리"
    user = db.find_user(user_id)
    if user:
        redis.setex(f"user:{user_id}", 3600, serialize(user))

    return user
```

캐시가 만료되거나 무효화된 후 첫 조회 시 자동으로 복구됩니다.

---

## 적극적 Read Repair

불일치를 감지하면 즉시 수정합니다:

```python
def get_user_with_repair(user_id: int, verify: bool = False):
    cached = redis.get(f"user:{user_id}")

    if cached:
        user_from_cache = deserialize(cached)

        # 주기적으로 DB와 비교 (샘플링)
        if verify or should_verify():
            user_from_db = db.find_user(user_id)
            if user_from_db != user_from_cache:
                # 불일치 감지 → 캐시 수정
                redis.setex(f"user:{user_id}", 3600, serialize(user_from_db))
                return user_from_db

        return user_from_cache

    user = db.find_user(user_id)
    redis.setex(f"user:{user_id}", 3600, serialize(user))
    return user

def should_verify() -> bool:
    """1% 확률로 검증 (성능 영향 최소화)"""
    import random
    return random.random() < 0.01
```

---

## Write-Behind (Write-Back)

캐시에 먼저 쓰고 비동기로 DB에 반영합니다.

```python
import asyncio
from collections import defaultdict
import time

class WriteBehindCache:
    def __init__(self, redis_client, db_client, flush_interval: int = 5):
        self.redis = redis_client
        self.db = db_client
        self.dirty_keys: set = set()  # DB에 반영 안 된 키
        self.flush_interval = flush_interval
        self._start_flusher()

    def set(self, key: str, value, ttl: int = 3600):
        """캐시에 즉시 쓰고, DB 반영은 나중에"""
        self.redis.setex(key, ttl, serialize(value))
        self.dirty_keys.add(key)

    def _start_flusher(self):
        def flush():
            while True:
                time.sleep(self.flush_interval)
                self._flush_to_db()

        import threading
        t = threading.Thread(target=flush, daemon=True)
        t.start()

    def _flush_to_db(self):
        """dirty 키들을 DB에 반영"""
        keys_to_flush = self.dirty_keys.copy()
        self.dirty_keys.clear()

        for key in keys_to_flush:
            value = self.redis.get(key)
            if value:
                try:
                    self.db.upsert(key, deserialize(value))
                except Exception as e:
                    # 실패 시 다음 플러시에 재시도
                    self.dirty_keys.add(key)
                    logger.error(f"DB flush 실패: {key}, {e}")
```

---

## Write-Behind 사용 사례

```python
# 조회수 카운터 (데이터 손실 허용 가능)
class ViewCounter:
    def __init__(self, write_behind_cache):
        self.cache = write_behind_cache

    def increment(self, content_id: int):
        key = f"views:{content_id}"
        # 캐시에서 증가 (빠름)
        count = self.cache.redis.incr(key)
        self.cache.dirty_keys.add(key)
        return count

    # 매 5초마다 DB에 반영
    # Redis 장애 시 최대 5초분 조회수 손실 가능


# 좋아요 수 (실시간성 중요, 손실 불가)
# → Write-Behind 부적합, Write-Through 사용
```

---

## 데이터 손실 시나리오

```
Write-Behind 위험:
  1. 사용자가 캐시에 데이터 씀
  2. DB 플러시 전에 Redis 다운
  3. 플러시 안 된 데이터 손실!

완화 방법:
  - Redis AOF + everysec (최대 1초 손실)
  - flush_interval을 짧게 (1~5초)
  - 조회수/좋아요 등 손실 허용 데이터에만 사용
```

---

## 패턴 비교

| 패턴 | 쓰기 속도 | 데이터 안전성 | 사용 사례 |
|------|---------|------------|---------|
| Write-Through | 느림 (DB 동기) | 높음 | 결제, 주문 |
| Write-Behind | 빠름 (캐시만) | 낮음 | 조회수, 좋아요 |
| Read Repair | - | 자동 복구 | 모든 Cache-Aside |

---

## 핵심 요약

- **Read Repair**: 캐시 미스 시 DB에서 읽어 자동 복구 (Cache-Aside 기본)
- 적극적 Read Repair: 1% 샘플링으로 불일치 감지
- **Write-Behind**: 캐시에 먼저, DB는 나중에 → 빠르지만 손실 위험
- Write-Behind 적합: 조회수, 좋아요 등 손실 허용 데이터
- Write-Behind 부적합: 결제, 재고 등 정합성 필수 데이터
