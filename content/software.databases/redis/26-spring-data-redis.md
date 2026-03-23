---
title: "[Redis] 26. Spring Data Redis — 설정과 직렬화"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "spring-data-redis", "RedisTemplate", "직렬화", "설정"]
---

# Spring Data Redis — 설정과 직렬화

## 의존성

```kotlin
// build.gradle.kts
implementation("org.springframework.boot:spring-boot-starter-data-redis")
// 내부적으로 Lettuce 클라이언트 포함
```

---

## 기본 설정 (application.yml)

```yaml
spring:
  data:
    redis:
      # 단일 서버
      host: localhost
      port: 6379
      password: your-password
      database: 0
      timeout: 2000ms  # 연결 타임아웃

      # Lettuce 커넥션 풀
      lettuce:
        pool:
          max-active: 8      # 최대 활성 연결
          max-idle: 8        # 최대 유휴 연결
          min-idle: 0        # 최소 유휴 연결
          max-wait: -1ms     # 연결 대기 최대 시간 (-1=무한)
```

---

## RedisTemplate 설정

### 기본 설정 (String 직렬화)

```kotlin
@Configuration
class RedisConfig(
    private val connectionFactory: RedisConnectionFactory,
) {

    @Bean
    fun redisTemplate(): RedisTemplate<String, String> {
        return RedisTemplate<String, String>().apply {
            setConnectionFactory(connectionFactory)

            // 키: String 직렬화
            keySerializer = StringRedisSerializer()
            hashKeySerializer = StringRedisSerializer()

            // 값: String 직렬화
            valueSerializer = StringRedisSerializer()
            hashValueSerializer = StringRedisSerializer()
        }
    }
}
```

### JSON 직렬화 (Jackson)

```kotlin
@Configuration
class RedisConfig(
    private val connectionFactory: RedisConnectionFactory,
    private val objectMapper: ObjectMapper,
) {

    @Bean
    fun redisTemplate(): RedisTemplate<String, Any> {
        val jsonSerializer = GenericJackson2JsonRedisSerializer(objectMapper)

        return RedisTemplate<String, Any>().apply {
            setConnectionFactory(connectionFactory)
            keySerializer = StringRedisSerializer()
            hashKeySerializer = StringRedisSerializer()
            valueSerializer = jsonSerializer
            hashValueSerializer = jsonSerializer
            afterPropertiesSet()
        }
    }

    // 타입 안전한 직렬화 (클래스 정보 포함)
    @Bean
    fun typedRedisTemplate(): RedisTemplate<String, Any> {
        val objectMapper = ObjectMapper().apply {
            activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
            )
            disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            registerModule(JavaTimeModule())
            disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        }
        val jsonSerializer = GenericJackson2JsonRedisSerializer(objectMapper)

        return RedisTemplate<String, Any>().apply {
            setConnectionFactory(connectionFactory)
            keySerializer = StringRedisSerializer()
            valueSerializer = jsonSerializer
            afterPropertiesSet()
        }
    }
}
```

### Kotlin 객체 전용 직렬화

```kotlin
// 특정 타입 직렬화
@Bean
fun userRedisTemplate(): RedisTemplate<String, User> {
    val serializer = Jackson2JsonRedisSerializer(User::class.java)

    return RedisTemplate<String, User>().apply {
        setConnectionFactory(connectionFactory)
        keySerializer = StringRedisSerializer()
        valueSerializer = serializer
        afterPropertiesSet()
    }
}
```

---

## StringRedisTemplate

String 타입 전용 템플릿. 가장 자주 사용.

```kotlin
@Service
class CacheService(private val redis: StringRedisTemplate) {

    fun set(key: String, value: String, ttl: Duration) {
        redis.opsForValue().set(key, value, ttl)
    }

    fun get(key: String): String? {
        return redis.opsForValue().get(key)
    }

    fun delete(key: String): Boolean {
        return redis.delete(key)
    }

    fun exists(key: String): Boolean {
        return redis.hasKey(key)
    }

    fun increment(key: String): Long {
        return redis.opsForValue().increment(key) ?: 0L
    }

    fun expire(key: String, ttl: Duration) {
        redis.expire(key, ttl)
    }

    fun ttl(key: String): Long {
        return redis.getExpire(key, TimeUnit.SECONDS)
    }
}
```

---

## 키 관리 (KeyOperations)

```kotlin
// 존재 여부
redisTemplate.hasKey("mykey")

// TTL 설정/조회
redisTemplate.expire("mykey", Duration.ofHours(1))
redisTemplate.expireAt("mykey", Date.from(Instant.now().plusSeconds(3600)))
redisTemplate.getExpire("mykey", TimeUnit.SECONDS)

// 타입 조회
redisTemplate.type("mykey")  // DataType.STRING, LIST, SET, ZSET, HASH

// 키 삭제
redisTemplate.delete("mykey")
redisTemplate.delete(listOf("key1", "key2", "key3"))

// 키 이름 변경
redisTemplate.rename("oldkey", "newkey")
redisTemplate.renameIfAbsent("oldkey", "newkey")

// 키 패턴 검색 (프로덕션에서 SCAN 사용 권장)
redisTemplate.keys("user:*")

// 안전한 키 순회
redisTemplate.scan(ScanOptions.scanOptions()
    .match("user:*")
    .count(100)
    .build()
).use { cursor ->
    cursor.forEach { key ->
        println(key)
    }
}

// DB 이동
redisTemplate.move("mykey", 1)  // DB 1로 이동

// 임의 키
redisTemplate.randomKey()
```

---

## 직렬화 전략 비교

| 직렬화 | 클래스 | 장점 | 단점 |
|--------|--------|------|------|
| StringRedisSerializer | StringRedisSerializer | 사람이 읽을 수 있음, 가장 빠름 | String만 |
| JdkSerializationRedisSerializer | JdkSerializationRedisSerializer | Java 기본 | 크기 큼, 가독성 없음, 버전 의존성 |
| Jackson2JsonRedisSerializer | Jackson2JsonRedisSerializer | JSON 가독성 | 클래스 타입 별도 지정 필요 |
| GenericJackson2JsonRedisSerializer | GenericJackson2JsonRedisSerializer | 타입 자동 포함 | @class 필드로 크기 약간 증가 |
| OxmSerializer | OxmSerializer | XML | 무거움 |

### 권장 설정

```kotlin
// 키: StringRedisSerializer (사람이 읽을 수 있는 키)
// 값: GenericJackson2JsonRedisSerializer (타입 정보 포함 JSON)
//     → Redis CLI에서도 확인 가능

// 또는 값을 항상 String JSON으로 직접 변환해서 저장
// → 타입 정보 없이 순수 JSON
```

---

## RedisCallback / SessionCallback

```kotlin
// RedisCallback — 저수준 연결 직접 사용
redisTemplate.execute { connection ->
    connection.stringCommands().set(
        "key".toByteArray(),
        "value".toByteArray()
    )
}

// SessionCallback — 트랜잭션/파이프라인에 필요
redisTemplate.execute(object : SessionCallback<Any> {
    override fun <K, V> execute(ops: RedisOperations<K, V>): Any? {
        ops.multi()
        ops.opsForValue()  // 여기서 캐스팅 필요
        ops.exec()
        return null
    }
})
```

---

## 정리

- **StringRedisTemplate**: String 타입 전용, 가장 일반적
- **RedisTemplate<K, V>**: 타입 지정, 직렬화 설정 필요
- **직렬화**: 키=String, 값=JSON(Jackson) 권장
- **GenericJackson2JsonRedisSerializer**: 타입 정보 포함 → 역직렬화 자동
- **Scan**: `redisTemplate.scan(ScanOptions)` → KEYS * 대신 사용
