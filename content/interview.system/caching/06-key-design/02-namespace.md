---
title: "네임스페이스와 키 충돌 방지"
date: 2026-04-12
tags: [cache, namespace, redis, key-design]
---

## 키 충돌이란

여러 서비스가 같은 Redis 인스턴스를 공유할 때 발생합니다:

```
User 서비스: SET "profile:42" {...}
Product 서비스: SET "profile:42" {...}  ← 덮어씀!
```

---

## 해결 1: 서비스 접두사

```python
# 서비스 이름을 접두사로
"user-service:profile:42"
"product-service:profile:42"
```

또는 약어:

```python
"us:profile:42"   # user-service
"ps:profile:42"   # product-service
```

---

## 해결 2: Redis DB 분리

Redis는 DB 0~15까지 제공합니다 (SELECT 명령으로 전환):

```python
# User 서비스 → DB 0
user_redis = redis.Redis(db=0)

# Product 서비스 → DB 1
product_redis = redis.Redis(db=1)
```

**단점:**
- 동일 Redis 프로세스 → CPU/메모리 공유 (격리 효과 제한적)
- Redis Cluster는 DB 분리 미지원 (DB 0만 사용 가능)
- 실무에서 권장하지 않음 (Redis 공식 문서도 권장 안 함)

---

## 해결 3: 별도 Redis 인스턴스

마이크로서비스 환경에서 가장 권장:

```yaml
# docker-compose.yml
services:
  redis-user:
    image: redis:7
    ports: ["6380:6379"]

  redis-product:
    image: redis:7
    ports: ["6381:6379"]

  redis-session:
    image: redis:7
    ports: ["6382:6379"]
```

```python
user_redis = redis.Redis(port=6380)
product_redis = redis.Redis(port=6381)
session_redis = redis.Redis(port=6382)
```

**장점:** 완전한 격리, 개별 maxmemory 설정, 장애 격리

---

## 네임스페이스 클래스 패턴

```python
class CacheNamespace:
    def __init__(self, redis_client, prefix: str):
        self.redis = redis_client
        self.prefix = prefix

    def _key(self, key: str) -> str:
        return f"{self.prefix}:{key}"

    def get(self, key: str):
        return self.redis.get(self._key(key))

    def set(self, key: str, value, ttl: int = None):
        if ttl:
            self.redis.setex(self._key(key), ttl, value)
        else:
            self.redis.set(self._key(key), value)

    def delete(self, key: str):
        self.redis.delete(self._key(key))

    def scan_keys(self, pattern: str = "*"):
        full_pattern = f"{self.prefix}:{pattern}"
        cursor = 0
        while True:
            cursor, keys = self.redis.scan(cursor, match=full_pattern, count=100)
            yield from keys
            if cursor == 0:
                break


# 사용
user_cache = CacheNamespace(redis_client, prefix="user")
product_cache = CacheNamespace(redis_client, prefix="product")

user_cache.set("42:profile", user_data, ttl=3600)
product_cache.set("1001:info", product_data, ttl=1800)

# 키: "user:42:profile", "product:1001:info"
```

---

## Spring Cache 네임스페이스

```java
@Configuration
public class CacheConfig {

    @Bean
    public RedisCacheConfiguration userCacheConfig() {
        return RedisCacheConfiguration.defaultCacheConfig()
            .prefixCacheNameWith("user-service::")  // 접두사 설정
            .entryTtl(Duration.ofHours(1));
    }

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        Map<String, RedisCacheConfiguration> configs = new HashMap<>();
        configs.put("userProfiles", userCacheConfig());
        configs.put("productPrices", RedisCacheConfiguration.defaultCacheConfig()
            .prefixCacheNameWith("product-service::")
            .entryTtl(Duration.ofMinutes(30)));

        return RedisCacheManager.builder(factory)
            .withInitialCacheConfigurations(configs)
            .build();
    }
}

// 결과 키: "user-service::userProfiles::42"
```

---

## 환경별 분리

개발/스테이징/프로덕션이 같은 Redis를 쓸 때:

```python
import os

ENV = os.getenv("APP_ENV", "dev")  # dev, staging, prod

class EnvAwareCacheKey:
    def __init__(self, env: str = ENV):
        self.env = env

    def make(self, *parts) -> str:
        return f"{self.env}:{':'.join(str(p) for p in parts)}"

key_builder = EnvAwareCacheKey()
key = key_builder.make("user", 42, "profile")
# prod:user:42:profile
# dev:user:42:profile
```

**실무 권고:** 프로덕션은 별도 Redis 인스턴스. 개발/스테이징만 공유.

---

## 핵심 요약

- 키 충돌: 여러 서비스가 같은 Redis 공유 시 발생
- **서비스 접두사**: 단순하고 효과적 (`user-svc:key`)
- **Redis DB 분리**: 권장하지 않음 (Cluster 미지원, 격리 한계)
- **별도 Redis 인스턴스**: 마이크로서비스에서 가장 권장
- 네임스페이스 클래스로 접두사 자동 처리
- 환경(dev/staging/prod)도 접두사로 분리
