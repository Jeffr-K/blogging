---
title: "Two-Level Cache: L1(로컬) + L2(Redis)"
date: 2026-04-12
tags: [cache, two-level, l1-l2, local-cache, redis]
---

## Two-Level Cache 구조

```
요청 → L1 (로컬 Caffeine) → L2 (Redis) → DB

L1 히트: ~μs (가장 빠름)
L2 히트: ~ms
DB 조회: ~10~100ms
```

L1에서 못 찾으면 L2, L2에서도 못 찾으면 DB로 fallback합니다.

---

## 기본 구현

```python
import json
from cachetools import TTLCache
import redis as redis_lib
import threading

class TwoLevelCache:
    def __init__(
        self,
        redis_client,
        l1_max_size: int = 1000,
        l1_ttl: int = 60,       # 로컬 1분 (짧게)
        l2_ttl: int = 3600,     # Redis 1시간
    ):
        self.redis = redis_client
        self.l1 = TTLCache(maxsize=l1_max_size, ttl=l1_ttl)
        self.l2_ttl = l2_ttl
        self._l1_lock = threading.Lock()

    def get(self, key: str):
        # L1 확인
        with self._l1_lock:
            if key in self.l1:
                return self.l1[key]

        # L2 확인
        val = self.redis.get(key)
        if val is not None:
            data = json.loads(val)
            with self._l1_lock:
                self.l1[key] = data  # L1에 저장
            return data

        return None

    def get_or_load(self, key: str, loader):
        """캐시 미스 시 loader 함수 호출"""
        val = self.get(key)
        if val is not None:
            return val

        val = loader()
        self.set(key, val)
        return val

    def set(self, key: str, value):
        with self._l1_lock:
            self.l1[key] = value
        self.redis.setex(key, self.l2_ttl, json.dumps(value))

    def delete(self, key: str):
        with self._l1_lock:
            self.l1.pop(key, None)
        self.redis.delete(key)


# 사용
cache = TwoLevelCache(
    redis_client=redis_lib.Redis(),
    l1_max_size=1000,
    l1_ttl=60,
    l2_ttl=3600
)

def get_user(user_id: int):
    return cache.get_or_load(
        f"user:{user_id}",
        lambda: db.find_user(user_id)
    )
```

---

## Java: Spring + Caffeine + Redis

```java
@Configuration
public class TwoLevelCacheConfig {

    @Bean
    public CacheManager cacheManager(
        RedisConnectionFactory redisFactory,
        CacheProperties cacheProperties
    ) {
        // L1: Caffeine
        CaffeineCacheManager l1Manager = new CaffeineCacheManager();
        l1Manager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(1, TimeUnit.MINUTES));

        // L2: Redis
        RedisCacheManager l2Manager = RedisCacheManager.builder(redisFactory)
            .cacheDefaults(RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(1)))
            .build();

        // 두 캐시 매니저를 체이닝
        return new ChainedCacheManager(l1Manager, l2Manager);
    }
}
```

**ChainedCacheManager:** get 시 L1 먼저, 미스 시 L2 시도. put 시 둘 다 저장.

---

## Layering Cache (Spring Cache 2.x)

Spring 5.1+ `CompositeCacheManager`:

```java
@Bean
public CacheManager cacheManager() {
    return new CompositeCacheManager(
        caffeineCacheManager(),  // L1
        redisCacheManager()      // L2
    );
}
```

---

## TTL 전략

```
L1 TTL: 짧게 (30초~5분)
  → 데이터 변경 시 빠른 갱신
  → 서버 간 불일치 시간 최소화

L2 TTL: 길게 (30분~24시간)
  → L1 미스 시 DB 부하 흡수
  → Redis 장애 대비 버퍼
```

```python
# 데이터 특성별 TTL 예시
cache = TwoLevelCache(l1_ttl=60, l2_ttl=3600)   # 사용자 프로필
cache = TwoLevelCache(l1_ttl=10, l2_ttl=300)    # 상품 재고 (자주 변경)
cache = TwoLevelCache(l1_ttl=600, l2_ttl=86400) # 국가 코드 (거의 변경 안 됨)
```

---

## 히트율 계산

```
Total 요청 100개:
  L1 히트: 70개 (70%)
  L2 히트: 25개 (25%)
  DB: 5개 (5%)

L1 없었다면: Redis에 95개 요청
Two-Level: Redis에 30개 요청 (68% 감소)
```

---

## 주의사항

```
1. 일관성
   L1이 최신 데이터를 반영하지 못할 수 있음
   → 짧은 L1 TTL로 허용 범위 설정

2. 메모리
   L1 크기는 서버 가용 메모리의 5~10%가 적정

3. 직렬화
   L2(Redis)에서 역직렬화 후 L1에 저장 시
   같은 객체 참조를 공유하지 않도록 주의
   (방어적 복사 또는 불변 객체 사용)
```

---

## 핵심 요약

- Two-Level: L1(로컬, μs) + L2(Redis, ms) 조합
- L1 TTL 짧게 → 불일치 시간 최소화
- Redis 요청 70~80% 감소 효과
- Hot Key 문제 자연스럽게 해소
- ChainedCacheManager로 Spring에서 투명하게 사용
