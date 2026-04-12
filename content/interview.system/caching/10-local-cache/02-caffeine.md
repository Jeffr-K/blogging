---
title: "Caffeine: Java 최고의 로컬 캐시"
date: 2026-04-12
tags: [cache, caffeine, java, local-cache, w-tinylfu]
---

## Caffeine이란

Java의 로컬 캐시 라이브러리. Guava Cache의 후속작으로 **W-TinyLFU** 알고리즘을 사용합니다. Spring Boot의 기본 로컬 캐시 구현체입니다.

---

## 기본 사용

```java
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

Cache<String, User> cache = Caffeine.newBuilder()
    .maximumSize(10_000)                        // 최대 항목 수
    .expireAfterWrite(5, TimeUnit.MINUTES)      // 쓰기 후 5분
    .recordStats()                              // 통계 수집
    .build();

// 조회 (없으면 null)
User user = cache.getIfPresent("user:42");

// 조회 + 없으면 로딩
User user = cache.get("user:42", key -> db.findUser(key));

// 저장
cache.put("user:42", user);

// 삭제
cache.invalidate("user:42");
cache.invalidateAll();  // 전체 삭제
```

---

## LoadingCache: 자동 로딩

```java
import com.github.benmanes.caffeine.cache.LoadingCache;

LoadingCache<String, User> cache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(5, TimeUnit.MINUTES)
    .refreshAfterWrite(1, TimeUnit.MINUTES)  // 1분 후 백그라운드 갱신
    .build(key -> userRepository.findById(extractId(key)));

// get()은 항상 값을 반환 (자동 로딩)
User user = cache.get("user:42");
```

**`refreshAfterWrite`:** 만료 전에 백그라운드에서 미리 갱신 → Cache Stampede 방지

---

## 만료 정책

```java
// 쓰기 후 만료 (가장 일반적)
.expireAfterWrite(5, TimeUnit.MINUTES)

// 접근 후 만료 (접근할 때마다 갱신)
.expireAfterAccess(10, TimeUnit.MINUTES)

// 동적 만료 (항목별로 다른 TTL)
.expireAfter(new Expiry<String, User>() {
    @Override
    public long expireAfterCreate(String key, User user, long currentTime) {
        return user.isPremium()
            ? TimeUnit.HOURS.toNanos(1)   // 프리미엄: 1시간
            : TimeUnit.MINUTES.toNanos(5); // 일반: 5분
    }
    // expireAfterUpdate, expireAfterRead도 구현
})
```

---

## 크기 기반 제거

```java
// 항목 수 기반
.maximumSize(10_000)

// 가중치 기반 (메모리 크기로)
.maximumWeight(100 * 1024 * 1024)  // 100MB
.weigher((key, value) -> value.getSizeInBytes())
```

---

## Spring Boot 통합

```xml
<!-- pom.xml -->
<dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
</dependency>
```

```yaml
# application.yml
spring:
  cache:
    type: caffeine
    caffeine:
      spec: maximumSize=10000,expireAfterWrite=5m
```

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .recordStats());
        return manager;
    }

    // 캐시별 다른 설정
    @Bean
    public CacheManager cacheManager(Ticker ticker) {
        SimpleCacheManager manager = new SimpleCacheManager();
        manager.setCaches(Arrays.asList(
            buildCache("users", 10_000, Duration.ofMinutes(5)),
            buildCache("products", 5_000, Duration.ofMinutes(30)),
            buildCache("configs", 100, Duration.ofHours(1))
        ));
        return manager;
    }

    private CaffeineCache buildCache(String name, int size, Duration ttl) {
        return new CaffeineCache(name, Caffeine.newBuilder()
            .maximumSize(size)
            .expireAfterWrite(ttl)
            .recordStats()
            .build());
    }
}

// 사용
@Service
public class UserService {

    @Cacheable(value = "users", key = "#userId")
    public User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow();
    }

    @CacheEvict(value = "users", key = "#user.id")
    public User updateUser(User user) {
        return userRepository.save(user);
    }
}
```

---

## 통계 확인

```java
Cache<String, User> cache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(5, TimeUnit.MINUTES)
    .recordStats()  // 반드시 활성화
    .build();

CacheStats stats = cache.stats();
System.out.println("히트율: " + stats.hitRate());
System.out.println("미스율: " + stats.missRate());
System.out.println("로딩 횟수: " + stats.loadCount());
System.out.println("평균 로딩 시간: " + stats.averageLoadPenalty());
System.out.println("제거 횟수: " + stats.evictionCount());
```

---

## 핵심 요약

- Caffeine: Java 최고 성능 로컬 캐시, W-TinyLFU 사용
- `expireAfterWrite`: 쓰기 후 TTL
- `refreshAfterWrite`: 만료 전 백그라운드 갱신 (Stampede 방지)
- `maximumSize`: LFU 기반 자동 제거
- Spring Boot: `@Cacheable`, `@CacheEvict`와 통합
- `recordStats()`: 히트율, 제거 수 등 모니터링
