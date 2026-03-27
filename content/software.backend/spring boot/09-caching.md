---
title: "Spring Boot: 캐싱 전략 — Caffeine과 Redis"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "caching", "caffeine", "redis"]
---

# 캐싱 전략

## Spring Cache 추상화

Spring Cache는 캐싱 구현체(Caffeine, Redis, EhCache 등)를 교체해도 비즈니스 코드를 바꾸지 않아도 되는 추상화 레이어다.

```java
@SpringBootApplication
@EnableCaching  // 캐싱 활성화
public class MyApplication { }
```

### @Cacheable

```java
@Service
public class ProductService {

    // 캐시 히트 시 메서드 실행 안 함
    @Cacheable(value = "products", key = "#id")
    public ProductResponse findById(Long id) {
        return productRepository.findById(id)
            .map(ProductResponse::from)
            .orElseThrow(() -> new ResourceNotFoundException("상품을 찾을 수 없습니다"));
    }

    // 복합 키
    @Cacheable(value = "products", key = "#category + '_' + #page")
    public List<ProductResponse> findByCategory(String category, int page) {
        return productRepository.findByCategory(category, PageRequest.of(page, 20))
            .stream().map(ProductResponse::from).toList();
    }

    // 조건부 캐싱
    @Cacheable(
        value = "products",
        key = "#id",
        condition = "#id > 0",          // 조건 만족 시에만 캐시
        unless = "#result == null"       // 결과가 null이면 캐시 안 함
    )
    public ProductResponse findByIdConditional(Long id) {
        return productRepository.findById(id).map(ProductResponse::from).orElse(null);
    }
}
```

### @CachePut

항상 메서드를 실행하고 결과를 캐시에 저장한다. 데이터 수정 후 캐시 갱신에 사용한다.

```java
@CachePut(value = "products", key = "#result.id")
public ProductResponse updateProduct(Long id, UpdateProductRequest request) {
    Product product = productRepository.findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("상품을 찾을 수 없습니다"));
    product.update(request);
    return ProductResponse.from(productRepository.save(product));
}
```

### @CacheEvict

캐시를 무효화한다.

```java
// 특정 키 삭제
@CacheEvict(value = "products", key = "#id")
public void deleteProduct(Long id) {
    productRepository.deleteById(id);
}

// 전체 캐시 삭제
@CacheEvict(value = "products", allEntries = true)
public void clearProductCache() { }

// 메서드 실행 후 삭제 (beforeInvocation = false 기본)
@CacheEvict(value = "products", key = "#id", beforeInvocation = false)
public void updateStock(Long id, int quantity) {
    productRepository.updateStock(id, quantity);
}
```

### @Caching — 여러 어노테이션 조합

```java
@Caching(
    put = { @CachePut(value = "products", key = "#result.id") },
    evict = { @CacheEvict(value = "productList", allEntries = true) }
)
public ProductResponse createProduct(CreateProductRequest request) {
    Product product = Product.of(request);
    return ProductResponse.from(productRepository.save(product));
}
```

### 커스텀 KeyGenerator

```java
@Component("customKeyGenerator")
public class CustomKeyGenerator implements KeyGenerator {

    @Override
    public Object generate(Object target, Method method, Object... params) {
        return target.getClass().getSimpleName() + "_"
            + method.getName() + "_"
            + Arrays.stream(params).map(Object::toString).collect(Collectors.joining("_"));
    }
}

// 사용
@Cacheable(value = "reports", keyGenerator = "customKeyGenerator")
public Report generateReport(Long userId, LocalDate from, LocalDate to) { ... }
```

---

## Caffeine 캐시 (로컬 인메모리)

단일 서버 환경에서 가장 빠른 캐시. JVM 메모리에 저장하므로 서버 재시작 시 초기화된다.

```kotlin
// build.gradle.kts
implementation("com.github.ben-manes.caffeine:caffeine")
```

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.setCaffeine(
            Caffeine.newBuilder()
                .maximumSize(1000)                   // 최대 항목 수
                .expireAfterWrite(10, TimeUnit.MINUTES) // 쓰기 후 10분
                .expireAfterAccess(5, TimeUnit.MINUTES) // 마지막 접근 후 5분
                .recordStats()                       // 통계 수집
        );
        return manager;
    }
}
```

### 캐시별 다른 설정

```java
@Bean
public CacheManager cacheManager() {
    SimpleCacheManager manager = new SimpleCacheManager();
    manager.setCaches(List.of(
        buildCache("products", 1000, Duration.ofMinutes(10)),
        buildCache("categories", 100, Duration.ofHours(1)),
        buildCache("userSessions", 10000, Duration.ofMinutes(30))
    ));
    return manager;
}

private CaffeineCache buildCache(String name, int size, Duration ttl) {
    return new CaffeineCache(name,
        Caffeine.newBuilder()
            .maximumSize(size)
            .expireAfterWrite(ttl)
            .recordStats()
            .build()
    );
}
```

### Caffeine 알고리즘

Caffeine은 **W-TinyLFU** 알고리즘을 사용한다. LRU(Least Recently Used)보다 히트율이 높다.

- LRU: 최근 접근 시간 기준으로 제거
- LFU: 접근 빈도 기준으로 제거
- W-TinyLFU: 빈도 + 최근성을 조합, 새로운 아이템에 우호적

---

## Redis 캐시 (분산 캐시)

여러 서버에서 캐시를 공유할 때 사용한다.

```java
@Configuration
@EnableCaching
public class RedisCacheConfig {

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        // 기본 설정
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(10))
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer())
            )
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()
                )
            )
            .disableCachingNullValues(); // null은 캐시하지 않음

        // 캐시별 다른 TTL
        Map<String, RedisCacheConfiguration> cacheConfigs = Map.of(
            "products", defaultConfig.entryTtl(Duration.ofMinutes(30)),
            "categories", defaultConfig.entryTtl(Duration.ofHours(6)),
            "userSessions", defaultConfig.entryTtl(Duration.ofMinutes(60))
        );

        return RedisCacheManager.builder(factory)
            .cacheDefaults(defaultConfig)
            .withInitialCacheConfigurations(cacheConfigs)
            .build();
    }
}
```

### 직렬화 주의사항

기본 Java 직렬화는 사용하지 말 것. 클래스 구조가 바뀌면 역직렬화 오류가 발생한다.

```java
// ❌ 기본 직렬화 (위험)
new JdkSerializationRedisSerializer()

// ✅ JSON 직렬화 (권장)
new GenericJackson2JsonRedisSerializer()

// ✅ 타입 정보 포함 JSON
new Jackson2JsonRedisSerializer<>(MyDto.class)
```

---

## 로컬 캐시 vs 분산 캐시 선택 기준

| 항목 | Caffeine (로컬) | Redis (분산) |
|---|---|---|
| 서버 수 | 단일 서버 | 다중 서버 |
| 속도 | 매우 빠름 (ns) | 빠름 (ms) |
| 서버 재시작 | 캐시 소멸 | 유지 |
| 일관성 | 서버별 독립 | 공유 (일관성 보장) |
| 용량 | JVM 힙 제한 | 별도 메모리 서버 |
| 운영 복잡도 | 낮음 | Redis 서버 필요 |

---

## 실무 팁

**캐시 스탬피드(Stampede)**: 캐시 만료 직후 다수 요청이 동시에 DB를 조회하는 현상. `@Cacheable`은 기본적으로 이를 보호하지 않는다. Caffeine의 `refreshAfterWrite` 설정으로 완화할 수 있다.

**엔티티 직접 캐싱 금지**: JPA 엔티티를 캐시하면 영속성 컨텍스트 밖에서 사용될 때 `LazyInitializationException`이 발생한다. 반드시 DTO로 변환 후 캐싱하자.

**캐시 키 충돌 방지**: Redis를 쓸 때 여러 애플리케이션이 같은 Redis를 공유한다면 `spring.cache.redis.key-prefix=myapp:` 설정으로 네임스페이스를 분리하자.
