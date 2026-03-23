---
title: "[Redis] 28. Spring Cache 추상화 — @Cacheable, @CacheEvict, @CachePut"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "spring-cache", "Cacheable", "CacheEvict", "CachePut", "캐싱"]
---

# Spring Cache 추상화 — @Cacheable, @CacheEvict, @CachePut

## 설정

```kotlin
// build.gradle.kts
implementation("org.springframework.boot:spring-boot-starter-data-redis")
implementation("org.springframework.boot:spring-boot-starter-cache")
```

```kotlin
@SpringBootApplication
@EnableCaching
class Application
```

```kotlin
@Configuration
@EnableCaching
class CacheConfig(
    private val connectionFactory: RedisConnectionFactory,
) {
    @Bean
    fun cacheManager(): CacheManager {
        val config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofHours(1))           // 기본 TTL 1시간
            .disableCachingNullValues()               // null 캐시 안 함
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    StringRedisSerializer()
                )
            )
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    GenericJackson2JsonRedisSerializer()
                )
            )

        // 캐시별 개별 TTL 설정
        val cacheConfigs = mapOf(
            "users"    to config.entryTtl(Duration.ofMinutes(30)),
            "products" to config.entryTtl(Duration.ofHours(2)),
            "orders"   to config.entryTtl(Duration.ofMinutes(10)),
            "sessions" to config.entryTtl(Duration.ofHours(24)),
        )

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(config)
            .withInitialCacheConfigurations(cacheConfigs)
            .build()
    }
}
```

---

## @Cacheable — 캐시 조회/저장

```kotlin
@Service
class UserService {

    // 기본 사용
    @Cacheable("users")
    fun getUser(userId: Long): User {
        return userRepository.findById(userId)
            ?: throw NotFoundException("User $userId")
    }

    // 캐시 키 커스텀 (SpEL)
    @Cacheable(value = "users", key = "#userId")
    fun getUserById(userId: Long): User { ... }

    // 복합 키
    @Cacheable(value = "products", key = "#category + ':' + #page")
    fun getProducts(category: String, page: Int): List<Product> { ... }

    // 조건부 캐싱 (condition: 호출 전 평가)
    @Cacheable(value = "users", condition = "#userId > 0")
    fun getUserById(userId: Long): User { ... }

    // 결과 조건부 캐싱 (unless: 호출 후 평가)
    @Cacheable(value = "users", unless = "#result == null")
    fun findUser(userId: Long): User? { ... }

    // 여러 캐시에 동시 저장
    @Cacheable(value = ["users", "user-profiles"])
    fun getUser(userId: Long): User { ... }

    // 동기 캐싱 (Cache Stampede 방지)
    @Cacheable(value = "users", sync = true)
    fun getUser(userId: Long): User { ... }
}
```

---

## @CachePut — 캐시 업데이트

메서드를 항상 실행하고 결과를 캐시에 저장 (캐시 미스 없이 최신 유지).

```kotlin
@Service
class UserService {

    @CachePut(value = "users", key = "#result.id")
    fun createUser(request: CreateUserRequest): User {
        return userRepository.save(User.from(request))
    }

    @CachePut(value = "users", key = "#userId")
    fun updateUser(userId: Long, request: UpdateUserRequest): User {
        return userRepository.update(userId, request)
    }
}
```

---

## @CacheEvict — 캐시 삭제

```kotlin
@Service
class UserService {

    // 단일 키 삭제
    @CacheEvict(value = "users", key = "#userId")
    fun deleteUser(userId: Long) {
        userRepository.delete(userId)
    }

    // 여러 캐시에서 삭제
    @CacheEvict(value = ["users", "user-profiles"], key = "#userId")
    fun deleteUser(userId: Long) { ... }

    // 캐시 전체 삭제 (allEntries)
    @CacheEvict(value = "products", allEntries = true)
    fun clearProductCache() { }

    // 메서드 실행 전 삭제 (beforeInvocation)
    @CacheEvict(value = "users", key = "#userId", beforeInvocation = true)
    fun deleteUser(userId: Long) { ... }
    // 기본은 메서드 성공 후 삭제 (예외 발생 시 삭제 안 함)
}
```

---

## @Caching — 복합 어노테이션

```kotlin
@Caching(
    put = [CachePut(value = "users", key = "#result.id")],
    evict = [
        CacheEvict(value = "user-list", allEntries = true),
        CacheEvict(value = "user-search", allEntries = true),
    ]
)
fun createUser(request: CreateUserRequest): User {
    return userRepository.save(User.from(request))
}
```

---

## @CacheConfig — 클래스 레벨 기본값

```kotlin
@Service
@CacheConfig(cacheNames = ["users"])
class UserService {

    @Cacheable  // cacheNames = "users" 자동 적용
    fun getUser(userId: Long): User { ... }

    @CacheEvict
    fun deleteUser(userId: Long) { ... }
}
```

---

## SpEL (Spring Expression Language) 키 표현식

```kotlin
// 파라미터
key = "#userId"                        // 파라미터 이름
key = "#p0"                            // 파라미터 인덱스
key = "#a0"                            // 동일

// 객체 필드
key = "#user.id"
key = "#request.email"

// 메서드 반환값
key = "#result.id"                     // @CachePut에서 사용

// 인증 정보
key = "#root.target.currentUser.id"

// SpEL 표현식
key = "T(java.util.Objects).hash(#userId, #type)"
key = "'user:' + #userId + ':profile'"

// 조건
condition = "#userId != null && #userId > 0"
unless = "#result?.isDeleted == true"
```

---

## 커스텀 키 생성기

```kotlin
@Bean
fun cacheKeyGenerator(): KeyGenerator {
    return KeyGenerator { target, method, params ->
        val sb = StringBuilder()
        sb.append(target.javaClass.simpleName)
        sb.append(".")
        sb.append(method.name)
        sb.append(":")
        params.forEach { param ->
            sb.append(param?.toString() ?: "null")
            sb.append(",")
        }
        sb.toString()
    }
}

// 사용
@Cacheable(value = "users", keyGenerator = "cacheKeyGenerator")
fun getUser(userId: Long): User { ... }
```

---

## 캐시 이벤트 모니터링

```kotlin
@Component
class CacheEventLogger : ApplicationListener<CacheEvent<*>> {
    override fun onApplicationEvent(event: CacheEvent<*>) {
        when (event.type) {
            EventType.CREATED -> logger.debug("캐시 생성: ${event.key}")
            EventType.UPDATED -> logger.debug("캐시 업데이트: ${event.key}")
            EventType.REMOVED -> logger.debug("캐시 삭제: ${event.key}")
            EventType.EXPIRED -> logger.debug("캐시 만료: ${event.key}")
            EventType.MISSED  -> logger.debug("캐시 미스: ${event.key}")
            else -> {}
        }
    }
}
```

---

## 주의사항

```kotlin
// @Cacheable은 Spring AOP 기반 → 같은 클래스 내 호출은 동작 안 함!

@Service
class UserService {

    fun getUsers(ids: List<Long>): List<User> {
        return ids.map { id ->
            getUser(id)  // 같은 클래스 내부 호출 → 캐시 적용 안 됨!
        }
    }

    @Cacheable("users")
    fun getUser(userId: Long): User { ... }
}

// 해결책 1: 다른 Bean을 주입해서 호출
// 해결책 2: self-injection
@Service
class UserService {
    @Autowired
    private lateinit var self: UserService  // 자기 자신 주입

    fun getUsers(ids: List<Long>) = ids.map { self.getUser(it) }

    @Cacheable("users")
    fun getUser(userId: Long): User { ... }
}
```

---

## 정리

| 어노테이션 | 동작 | 사용처 |
|-----------|------|--------|
| `@Cacheable` | 캐시 히트면 반환, 미스면 실행 후 저장 | 조회 메서드 |
| `@CachePut` | 항상 실행 + 결과 캐시 저장 | 생성/수정 메서드 |
| `@CacheEvict` | 캐시 삭제 | 수정/삭제 메서드 |
| `@Caching` | 여러 캐시 어노테이션 조합 | 복잡한 캐시 전략 |
| `@CacheConfig` | 클래스 레벨 기본 캐시명 | 반복 제거 |

- **sync=true**: 동시 캐시 미스 방지 (Cache Stampede)
- **unless**: 결과 기반 조건부 캐싱 (null 제외 등)
- **allEntries=true**: 캐시 전체 삭제 (주의해서 사용)
