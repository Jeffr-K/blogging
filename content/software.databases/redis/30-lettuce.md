---
title: "[Redis] 30. Lettuce — 비동기/리액티브 클라이언트"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "lettuce", "reactive", "async", "connection-pool"]
---

# Lettuce — 비동기/리액티브 클라이언트

Spring Boot Data Redis의 기본 클라이언트. Netty 기반 비동기 I/O.

## Jedis vs Lettuce

| | Jedis | Lettuce |
|--|-------|---------|
| I/O 모델 | 동기 (블로킹) | 비동기 (논블로킹) |
| 스레드 안전 | No (풀 필요) | Yes (커넥션 공유) |
| 리액티브 지원 | No | Yes (Reactor) |
| Cluster 지원 | 제한적 | 완전 지원 |
| 기본 클라이언트 | Spring Boot 2.x 이전 | Spring Boot 2.x 이후 |

---

## 의존성

```kotlin
// build.gradle.kts
implementation("org.springframework.boot:spring-boot-starter-data-redis")
// Lettuce는 자동 포함됨

// Lettuce 단독 사용
implementation("io.lettuce:lettuce-core:6.3.0.RELEASE")
```

---

## 커넥션 풀 설정

Lettuce는 기본적으로 커넥션을 공유(공유 가능한 비동기 커넥션)하므로 풀이 불필요하지만, 블로킹 명령어 사용 시 풀 설정 권장.

```yaml
# application.yml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      lettuce:
        pool:
          enabled: true
          max-active: 16     # 최대 활성 커넥션
          max-idle: 8        # 최대 유휴 커넥션
          min-idle: 2        # 최소 유휴 커넥션
          max-wait: 2000ms   # 대기 타임아웃
        shutdown-timeout: 100ms
```

```kotlin
// 커넥션 풀 직접 설정
@Configuration
class LettuceConfig {

    @Bean
    fun redisConnectionFactory(): LettuceConnectionFactory {
        val poolConfig = GenericObjectPoolConfig<Any>().apply {
            maxTotal = 16
            maxIdle = 8
            minIdle = 2
            setMaxWait(Duration.ofMillis(2000))
            testOnBorrow = true
            testOnReturn = true
        }

        val lettucePoolConfig = LettucePoolingClientConfiguration.builder()
            .commandTimeout(Duration.ofSeconds(2))
            .poolConfig(poolConfig)
            .build()

        return LettuceConnectionFactory(
            RedisStandaloneConfiguration("localhost", 6379),
            lettucePoolConfig
        )
    }
}
```

---

## 비동기 API (RedisAsyncCommands)

```kotlin
@Service
class AsyncRedisService {

    // Lettuce 직접 사용
    private val client = RedisClient.create("redis://localhost:6379")
    private val connection = client.connect()
    private val async = connection.async()

    fun setAsync(key: String, value: String): CompletableFuture<String> {
        return async.set(key, value).toCompletableFuture()
    }

    fun getAsync(key: String): CompletableFuture<String?> {
        return async.get(key).toCompletableFuture()
    }

    // 비동기 체이닝
    fun getAndProcess(key: String): CompletableFuture<String> {
        return async.get(key)
            .toCompletableFuture()
            .thenApply { value -> value?.uppercase() ?: "DEFAULT" }
    }

    // 여러 키 병렬 조회
    fun multiGetAsync(keys: List<String>): CompletableFuture<List<String?>> {
        val futures = keys.map { async.get(it).toCompletableFuture() }
        return CompletableFuture.allOf(*futures.toTypedArray())
            .thenApply { futures.map { it.get() } }
    }
}
```

---

## 리액티브 API (RedisReactiveCommands)

```kotlin
@Service
class ReactiveRedisService(
    private val reactiveRedisTemplate: ReactiveRedisTemplate<String, String>,
) {

    // Mono (단일 값)
    fun get(key: String): Mono<String> {
        return reactiveRedisTemplate.opsForValue().get(key)
    }

    fun set(key: String, value: String, ttl: Duration): Mono<Boolean> {
        return reactiveRedisTemplate.opsForValue().set(key, value, ttl)
    }

    // Flux (스트림)
    fun getMultiple(keys: List<String>): Flux<String> {
        return Flux.fromIterable(keys)
            .flatMap { key -> reactiveRedisTemplate.opsForValue().get(key) }
    }

    // 리액티브 패턴: 캐시 없으면 DB 조회
    fun getWithFallback(key: String, fallback: () -> Mono<String>): Mono<String> {
        return reactiveRedisTemplate.opsForValue().get(key)
            .switchIfEmpty(
                fallback().flatMap { value ->
                    reactiveRedisTemplate.opsForValue()
                        .set(key, value, Duration.ofMinutes(10))
                        .thenReturn(value)
                }
            )
    }

    // 리액티브 ZSet 조회
    fun getLeaderboard(key: String, top: Int): Flux<ZSetOperations.TypedTuple<String>> {
        return reactiveRedisTemplate.opsForZSet()
            .reverseRangeWithScores(key, Range.closed(0L, top.toLong() - 1))
    }
}
```

---

## ReactiveRedisTemplate 설정

```kotlin
@Configuration
class ReactiveRedisConfig(
    private val connectionFactory: ReactiveRedisConnectionFactory,
) {

    @Bean
    fun reactiveRedisTemplate(): ReactiveRedisTemplate<String, String> {
        val serializer = RedisSerializationContext.string()
        return ReactiveRedisTemplate(connectionFactory, serializer)
    }

    @Bean
    fun reactiveJsonRedisTemplate(): ReactiveRedisTemplate<String, Any> {
        val keySerializer = StringRedisSerializer()
        val valueSerializer = GenericJackson2JsonRedisSerializer()

        val context = RedisSerializationContext
            .newSerializationContext<String, Any>(keySerializer)
            .value(valueSerializer)
            .hashKey(keySerializer)
            .hashValue(valueSerializer)
            .build()

        return ReactiveRedisTemplate(connectionFactory, context)
    }
}
```

---

## 파이프라인 (비동기 배치)

```kotlin
@Service
class LettuceAsyncBatch {

    private val client = RedisClient.create("redis://localhost:6379")
    private val connection = client.connect()

    // 비동기 파이프라인
    fun pipelineSet(data: Map<String, String>): CompletableFuture<Unit> {
        val async = connection.async()

        // 자동 플러시 비활성화
        async.setAutoFlushCommands(false)

        val futures = data.map { (key, value) ->
            async.set(key, value).toCompletableFuture()
        }

        // 한 번에 플러시
        async.flushCommands()

        return CompletableFuture.allOf(*futures.toTypedArray())
            .thenApply { }
    }

    // 리액티브 파이프라인
    fun reactivePipeline(
        template: ReactiveRedisTemplate<String, String>,
        data: Map<String, String>,
    ): Flux<Boolean> {
        return template.executePipelined { ops ->
            Flux.fromIterable(data.entries)
                .flatMap { (k, v) -> ops.opsForValue().set(k, v) }
        }
    }
}
```

---

## Cluster 연동

```yaml
# application.yml — 클러스터 설정
spring:
  data:
    redis:
      cluster:
        nodes:
          - 127.0.0.1:7001
          - 127.0.0.1:7002
          - 127.0.0.1:7003
        max-redirects: 3
      lettuce:
        cluster:
          refresh:
            adaptive: true          # 토폴로지 변경 감지
            period: 60s             # 주기적 갱신
```

```kotlin
@Configuration
class LettuceClusterConfig {

    @Bean
    fun redisConnectionFactory(): LettuceConnectionFactory {
        val clusterConfig = RedisClusterConfiguration().apply {
            clusterNode("127.0.0.1", 7001)
            clusterNode("127.0.0.1", 7002)
            clusterNode("127.0.0.1", 7003)
            maxRedirects = 3
        }

        val clientConfig = LettuceClientConfiguration.builder()
            .readFrom(ReadFrom.REPLICA_PREFERRED)  // 읽기는 레플리카 우선
            .commandTimeout(Duration.ofSeconds(2))
            .build()

        return LettuceConnectionFactory(clusterConfig, clientConfig)
    }
}
```

---

## Sentinel 연동

```kotlin
@Bean
fun redisConnectionFactory(): LettuceConnectionFactory {
    val sentinelConfig = RedisSentinelConfiguration().apply {
        master("mymaster")
        sentinel("sentinel1.host", 26379)
        sentinel("sentinel2.host", 26379)
        sentinel("sentinel3.host", 26379)
        setPassword(RedisPassword.of("sentinel-password"))
    }

    val clientConfig = LettuceClientConfiguration.builder()
        .readFrom(ReadFrom.REPLICA_PREFERRED)
        .build()

    return LettuceConnectionFactory(sentinelConfig, clientConfig)
}
```

---

## ReadFrom 전략

```kotlin
// 읽기 전략 설정
val clientConfig = LettuceClientConfiguration.builder()
    .readFrom(ReadFrom.MASTER)                // 항상 마스터
    .readFrom(ReadFrom.REPLICA)               // 항상 레플리카
    .readFrom(ReadFrom.REPLICA_PREFERRED)     // 레플리카 우선, 없으면 마스터
    .readFrom(ReadFrom.MASTER_PREFERRED)      // 마스터 우선, 없으면 레플리카
    .readFrom(ReadFrom.NEAREST)               // RTT 가장 낮은 노드
    .readFrom(ReadFrom.ANY)                   // 임의 노드
    .readFrom(ReadFrom.ANY_REPLICA)           // 임의 레플리카
    .build()
```

---

## TLS/SSL 설정

```kotlin
@Bean
fun redisConnectionFactory(): LettuceConnectionFactory {
    val config = RedisStandaloneConfiguration("redis.example.com", 6380)
    config.password = RedisPassword.of("password")

    val sslConfig = LettuceClientConfiguration.builder()
        .useSsl()
        .and()
        .commandTimeout(Duration.ofSeconds(2))
        .build()

    return LettuceConnectionFactory(config, sslConfig)
}
```

---

## 정리

- **기본 클라이언트**: Spring Boot 기본 (Netty 비동기)
- **커넥션 공유**: 단일 커넥션으로 멀티스레드 안전
- **비동기**: `RedisAsyncCommands` → `CompletableFuture`
- **리액티브**: `ReactiveRedisTemplate` → `Mono`/`Flux`
- **클러스터**: `adaptive refresh`로 토폴로지 자동 감지
- **ReadFrom**: 읽기 부하 분산 전략 설정 가능
