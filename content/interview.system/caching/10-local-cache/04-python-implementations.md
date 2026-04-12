---
title: "언어별 로컬 캐시 구현"
date: 2026-04-12
tags: [cache, local-cache, python, java, golang]
---

## Python

### cachetools

```bash
pip install cachetools
```

```python
from cachetools import TTLCache, LRUCache, LFUCache
from cachetools.decorators import cached
import threading

# TTL 기반
ttl_cache = TTLCache(maxsize=1000, ttl=300)  # 5분

# LRU 기반
lru_cache = LRUCache(maxsize=1000)

# 스레드 안전하게 사용
lock = threading.Lock()

with lock:
    val = ttl_cache.get("key")
    if val is None:
        val = expensive_computation()
        ttl_cache["key"] = val
```

### functools.lru_cache (표준 라이브러리)

```python
from functools import lru_cache
import time

@lru_cache(maxsize=1000)
def get_config(key: str) -> str:
    return db.get_config(key)

# TTL 없음 → 수동 무효화 필요
def invalidate_config(key: str):
    get_config.cache_clear()  # 전체 삭제 (특정 키 불가)

# TTL이 필요하면 커스텀 데코레이터
def ttl_lru_cache(ttl: int = 300, maxsize: int = 1000):
    def decorator(func):
        cache = TTLCache(maxsize=maxsize, ttl=ttl)

        @wraps(func)
        def wrapper(*args):
            key = args
            with lock:
                if key not in cache:
                    cache[key] = func(*args)
                return cache[key]
        return wrapper
    return decorator

@ttl_lru_cache(ttl=300, maxsize=1000)
def get_user(user_id: int) -> dict:
    return db.find_user(user_id)
```

### diskcache (디스크 기반 로컬 캐시)

```bash
pip install diskcache
```

```python
import diskcache

# 디스크에 저장 → 재시작 후에도 유지
cache = diskcache.Cache("/tmp/my-cache")
cache.set("key", large_data, expire=3600)
val = cache.get("key")
```

---

## Java: Guava Cache (Caffeine의 전신)

```java
import com.google.common.cache.*;

LoadingCache<String, User> cache = CacheBuilder.newBuilder()
    .maximumSize(1000)
    .expireAfterWrite(5, TimeUnit.MINUTES)
    .build(new CacheLoader<>() {
        @Override
        public User load(String key) throws Exception {
            return userRepository.findById(Long.parseLong(key)).orElseThrow();
        }
    });

User user = cache.get("42");  // 자동 로딩
cache.invalidate("42");
```

**Caffeine이 Guava Cache보다 성능 2~5배 높음 → 신규 개발은 Caffeine 사용**

---

## Go: ristretto (Caffeine의 Go 버전)

```go
import "github.com/dgraph-io/ristretto"

cache, err := ristretto.NewCache(&ristretto.Config{
    NumCounters: 1e7,   // 약 1000만개 항목 추적용 카운터
    MaxCost:     1 << 30, // 최대 1GB
    BufferItems: 64,
})

// 저장
cache.Set("user:42", user, 1)  // cost=1

// 조회
val, found := cache.Get("user:42")

// TTL
cache.SetWithTTL("session:abc", session, 1, 5*time.Minute)
```

ristretto도 W-TinyLFU 기반으로 Caffeine과 유사한 알고리즘을 사용합니다.

---

## Node.js: node-cache

```javascript
const NodeCache = require("node-cache");

const cache = new NodeCache({
  stdTTL: 300,     // 기본 TTL 5분
  maxKeys: 1000,
  checkperiod: 60  // 60초마다 만료 키 정리
});

cache.set("user:42", userData);
const user = cache.get("user:42");
cache.del("user:42");

// TTL 포함 조회
const { value, ttl } = cache.getTtl("user:42");
```

---

## 언어별 권장 라이브러리 요약

| 언어 | 라이브러리 | 특징 |
|------|-----------|------|
| Java | Caffeine | 최고 성능, W-TinyLFU, Spring 통합 |
| Python | cachetools | 단순, TTLCache/LRUCache/LFUCache |
| Go | ristretto | W-TinyLFU, 고성능 |
| Node.js | node-cache | 단순, TTL 지원 |
| Python | diskcache | 디스크 영속화 |

---

## 핵심 요약

- Python: `cachetools.TTLCache` (표준적), `functools.lru_cache` (TTL 없음)
- Java: Caffeine (신규), Guava Cache (레거시)
- Go: ristretto (W-TinyLFU)
- 공통: TTL + 최대 크기 설정 필수
