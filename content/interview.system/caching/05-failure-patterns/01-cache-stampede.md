---
title: "Cache Stampede (Thundering Herd)"
date: 2026-04-12
tags: [cache, stampede, thundering-herd, mutex, probabilistic]
---

## 문제: 동시에 만료되면?

TTL이 만료된 순간 수백 개의 요청이 동시에 캐시 미스를 경험합니다.

```
T=0: 캐시에 "popular_data" 키 만료
T=0: 요청 500개가 동시에 캐시 미스
T=0: 요청 500개 모두 DB로 쿼리
T=1: DB 과부하 → 응답 지연 or 다운
```

이를 **Cache Stampede** 또는 **Thundering Herd**라고 합니다.

---

## 해결 1: Mutex Lock (가장 단순)

한 요청만 DB에서 데이터를 가져오고, 나머지는 기다립니다.

```python
import threading
import time

_locks: dict = {}
_lock_meta = threading.Lock()

def get_with_mutex(cache, key, fetch_fn, ttl=60):
    val = cache.get(key)
    if val is not None:
        return val

    # 이 키에 대한 락 획득
    with _lock_meta:
        if key not in _locks:
            _locks[key] = threading.Lock()
    lock = _locks[key]

    with lock:
        # 락 획득 후 다시 확인 (다른 스레드가 이미 채웠을 수 있음)
        val = cache.get(key)
        if val is not None:
            return val

        val = fetch_fn()
        cache.set(key, val, ttl)
        return val
```

**Redis SETNX로 분산 환경에서도 동일 패턴:**

```python
def get_with_distributed_lock(redis_client, key, fetch_fn, ttl=60):
    val = redis_client.get(key)
    if val:
        return val

    lock_key = f"lock:{key}"
    acquired = redis_client.set(lock_key, "1", nx=True, ex=5)  # 5초 락

    if acquired:
        try:
            val = fetch_fn()
            redis_client.setex(key, ttl, val)
            return val
        finally:
            redis_client.delete(lock_key)
    else:
        # 락을 못 얻은 요청: 잠시 기다린 후 캐시 재시도
        time.sleep(0.1)
        return redis_client.get(key)
```

**단점:** 락 대기 중 응답이 느려집니다.

---

## 해결 2: Probabilistic Early Recomputation

만료 직전에 확률적으로 미리 갱신. XFetch 알고리즘:

```python
import random
import math
import time

def fetch_with_xfetch(cache, key, fetch_fn, ttl=60, beta=1.0):
    """
    beta: 공격성 파라미터 (클수록 더 일찍 갱신)
    현재 시간이 만료에 가까울수록 갱신 확률 증가
    """
    value, expiry = cache.get_with_expiry(key)

    if value is None:
        # 완전히 만료됨 → 그냥 갱신
        value = fetch_fn()
        cache.set(key, value, ttl, track_expiry=True)
        return value

    now = time.time()
    # expiry: 만료 시각 (unix timestamp)
    # beta * log(random()) < -(expiry - now) 이면 갱신
    if -beta * math.log(random.random()) > expiry - now:
        # 확률적으로 만료 전에 미리 갱신
        value = fetch_fn()
        cache.set(key, value, ttl, track_expiry=True)

    return value
```

수식 의미: `expiry - now`가 작을수록(만료에 가까울수록) 갱신 확률이 높아짐.

---

## 해결 3: Background Refresh

캐시 히트 시 만료가 임박했으면 백그라운드에서 갱신:

```python
import concurrent.futures

executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

def get_with_background_refresh(cache, key, fetch_fn, ttl=60, refresh_threshold=0.8):
    """
    TTL의 80% 지나면 백그라운드 갱신 트리거
    """
    value, remaining_ttl = cache.get_with_remaining_ttl(key)

    if value is None:
        value = fetch_fn()
        cache.set(key, value, ttl)
        return value

    if remaining_ttl < ttl * (1 - refresh_threshold):
        # 만료 20% 남음 → 백그라운드에서 갱신
        executor.submit(_refresh, cache, key, fetch_fn, ttl)

    return value

def _refresh(cache, key, fetch_fn, ttl):
    val = fetch_fn()
    cache.set(key, val, ttl)
```

Caffeine의 `refreshAfterWrite`가 이 방식을 사용합니다.

---

## 해결 4: TTL Jitter

모든 키가 동시에 만료되지 않도록 TTL에 랜덤성 추가:

```python
import random

def set_with_jitter(cache, key, value, base_ttl=3600, jitter=0.1):
    """
    jitter=0.1 → TTL이 3240~3960초 사이 랜덤
    """
    jitter_seconds = int(base_ttl * jitter)
    ttl = base_ttl + random.randint(-jitter_seconds, jitter_seconds)
    cache.set(key, value, ttl)
```

---

## 상황별 선택

| 상황 | 권장 해결책 |
|------|------------|
| 단일 서버 | Mutex Lock |
| 분산 서버 | Redis SETNX Lock |
| DB 부하보다 응답 속도가 중요 | Probabilistic Early Recomputation |
| Caffeine 사용 중 | `refreshAfterWrite` |
| 다수 키 동시 만료 방지 | TTL Jitter |

---

## 핵심 요약

- Cache Stampede: TTL 만료 순간 다수 요청이 동시에 DB 공격
- **Mutex**: 한 요청만 DB 쿼리, 나머지 대기
- **XFetch**: 만료 전 확률적 사전 갱신
- **Background Refresh**: 히트 시 만료 임박하면 비동기 갱신
- **TTL Jitter**: 동시 만료 자체를 방지
