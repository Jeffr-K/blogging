---
title: "L1 캐시 무효화: 분산 서버 동기화"
date: 2026-04-12
tags: [cache, l1-invalidation, pubsub, redis, consistency]
---

## 문제: 서버 3대의 로컬 캐시 동기화

```
Server-1, 2, 3 모두 "user:42" 를 로컬 캐시에 보유

Server-1에서 user:42 업데이트:
  → Server-1의 로컬 캐시: 갱신됨
  → Server-2의 로컬 캐시: 여전히 구버전 ← 문제!
  → Server-3의 로컬 캐시: 여전히 구버전 ← 문제!
```

---

## 해결 1: Redis Pub/Sub 무효화 메시지

데이터 변경 시 모든 서버에 무효화 메시지를 브로드캐스트합니다:

```python
import redis
import threading
import json
from cachetools import TTLCache

INVALIDATION_CHANNEL = "cache:invalidation"

class SyncedLocalCache:
    def __init__(self, redis_client, max_size: int = 1000, ttl: int = 300):
        self.redis = redis_client
        self.local = TTLCache(maxsize=max_size, ttl=ttl)
        self._lock = threading.Lock()
        self._start_listener()

    def _start_listener(self):
        """백그라운드에서 무효화 메시지 구독"""
        pubsub = self.redis.pubsub()
        pubsub.subscribe(INVALIDATION_CHANNEL)

        def listen():
            for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        key = data.get("key")
                        if key:
                            with self._lock:
                                self.local.pop(key, None)
                    except Exception:
                        pass

        thread = threading.Thread(target=listen, daemon=True)
        thread.start()

    def get(self, key: str):
        with self._lock:
            return self.local.get(key)

    def set(self, key: str, value, broadcast: bool = True):
        with self._lock:
            self.local[key] = value
        if broadcast:
            # 다른 서버에 무효화 메시지 발송
            self.redis.publish(
                INVALIDATION_CHANNEL,
                json.dumps({"key": key})
            )

    def delete(self, key: str):
        with self._lock:
            self.local.pop(key, None)
        self.redis.publish(
            INVALIDATION_CHANNEL,
            json.dumps({"key": key})
        )


# 사용
cache = SyncedLocalCache(redis_client)

def update_user(user_id: int, data: dict):
    db.update_user(user_id, data)

    # Redis L2도 업데이트
    redis_client.setex(f"user:{user_id}", 3600, serialize(data))

    # L1 캐시 삭제 브로드캐스트 (모든 서버에 전파)
    cache.delete(f"user:{user_id}")
```

---

## 해결 2: Redis 6.2+ Client-side Caching

Redis 6.2부터 공식 지원하는 클라이언트 사이드 캐싱입니다. Redis가 직접 무효화 메시지를 보냅니다.

```bash
# CLIENT TRACKING 활성화
CLIENT TRACKING on REDIRECT 12345 BCAST PREFIX user:
```

```python
# Lettuce (Java)에서 자동 지원
# Python에서는 직접 구현 필요 (현재 라이브러리 지원 제한적)
```

---

## 해결 3: 짧은 TTL (가장 단순)

무효화 없이 짧은 TTL로 자동 만료:

```python
# L1 TTL = 10~60초
# 최대 10~60초간 구버전 데이터 허용
local_cache = TTLCache(maxsize=1000, ttl=30)  # 30초

def get_user(user_id: int):
    key = f"user:{user_id}"
    if key in local_cache:
        return local_cache[key]
    # L2 또는 DB 조회
    ...
```

**장점:** 구현 없음  
**단점:** 갱신 후 최대 TTL만큼 구버전 반환

---

## 해결 4: 버전 기반 무효화

키에 버전 번호를 포함합니다:

```python
def get_current_version(entity: str, entity_id: int) -> int:
    """Redis에서 현재 버전 조회"""
    ver = redis_client.get(f"ver:{entity}:{entity_id}")
    return int(ver) if ver else 1

def get_user(user_id: int):
    version = get_current_version("user", user_id)
    key = f"user:{user_id}:v{version}"

    with l1_lock:
        if key in local_cache:
            return local_cache[key]

    val = redis_client.get(key)
    if val:
        with l1_lock:
            local_cache[key] = deserialize(val)
        return local_cache[key]

    # DB 조회
    ...

def update_user(user_id: int, data: dict):
    db.update_user(user_id, data)
    # 버전 증가 → 모든 서버에서 자동으로 구버전 키가 미스
    redis_client.incr(f"ver:user:{user_id}")
```

---

## 방법 비교

| | Pub/Sub 무효화 | 짧은 TTL | 버전 기반 |
|--|--------------|---------|----------|
| 일관성 | 거의 즉시 | TTL까지 지연 | 거의 즉시 |
| 구현 복잡도 | 중간 | 낮음 | 높음 |
| 신뢰성 | at-most-once | 확실 | 확실 |
| 메모리 | 보통 | 보통 | 구버전 키 누적 |

**실무 권장:** 변경이 드문 데이터 → 짧은 TTL, 변경이 잦은 데이터 → Pub/Sub

---

## 핵심 요약

- L1 무효화: 분산 서버에서 로컬 캐시 동기화 문제
- **Pub/Sub**: Redis로 무효화 메시지 브로드캐스트 (가장 일반적)
- **짧은 TTL**: 구현 없음, 최대 TTL 지연 허용 시
- **버전 기반**: 키 버전화, 구버전 자동 미스
- Pub/Sub는 at-most-once → 중요 데이터는 DB에서 재확인
