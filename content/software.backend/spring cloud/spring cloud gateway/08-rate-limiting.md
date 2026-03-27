---
title: "Spring Cloud Gateway: Rate Limiting으로 API 보호하기"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "rate-limiting", "redis"]
---

## Rate Limiting이 필요한 이유

API를 공개하는 순간 두 가지 위협이 따라온다.

1. **DDoS/브루트포스 공격**: 악의적인 클라이언트가 대량의 요청으로 서버를 마비시키려 한다.
2. **불공정한 리소스 사용**: 소수의 클라이언트가 과도한 요청으로 다른 사용자의 서비스 품질을 저하시킨다.

Rate Limiting은 단위 시간당 요청 수를 제한해 이 두 가지를 모두 해결한다. Spring Cloud Gateway는 Redis 기반의 `RedisRateLimiter`를 내장해 분산 환경에서도 정확한 Rate Limiting을 제공한다.

---

## 토큰 버킷(Token Bucket) 알고리즘

Spring Cloud Gateway의 Rate Limiting은 **토큰 버킷** 알고리즘을 사용한다.

```
시간 흐름 →
│     replenishRate = 10 token/sec
│     burstCapacity = 20 token (버킷 최대 용량)
│
│  [20] [20] [18] [16] [20] [10] ...
│   ↓                   ↑
│  요청 없음             순간적인 버스트 (20개 한꺼번에 소비)
│  (10개씩 보충)
```

| 개념 | 설명 |
|------|------|
| `replenishRate` | 초당 버킷에 추가되는 토큰 수 (지속 가능한 요청 속도) |
| `burstCapacity` | 버킷의 최대 토큰 수 (순간 최대 요청 가능량) |
| `requestedTokens` | 요청 1건당 소비되는 토큰 수 (기본값 1) |

요청이 들어오면 버킷에서 `requestedTokens`만큼 차감한다. 토큰이 부족하면 `429 Too Many Requests`를 즉시 반환한다.

---

## 의존성 설정

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.springframework.cloud:spring-cloud-starter-gateway")
    // Redis 기반 Rate Limiter
    implementation("org.springframework.boot:spring-boot-starter-data-redis-reactive")
}
```

---

## RedisRateLimiter 기본 설정

### YAML 전체 예제

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      timeout: 2s

  cloud:
    gateway:
      # Rate Limiter 글로벌 설정
      filter:
        request-rate-limiter:
          # 키 없는 요청 거부 여부 (false = 키 없으면 허용)
          deny-empty-key: false
          # deny-empty-key=true일 때 반환 상태코드
          empty-key-status-code: 403

      routes:
        # 기본 Rate Limiting
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/users/**
          filters:
            - name: RequestRateLimiter
              args:
                # 초당 10개 토큰 보충
                redis-rate-limiter.replenishRate: 10
                # 최대 20개 버스트 허용
                redis-rate-limiter.burstCapacity: 20
                # 요청 1건당 1토큰 소비 (기본값)
                redis-rate-limiter.requestedTokens: 1
                # KeyResolver 빈 이름
                key-resolver: "#{@ipKeyResolver}"

        # 무거운 작업에는 토큰을 더 많이 소비
        - id: report-service
          uri: lb://report-service
          predicates:
            - Path=/api/reports/generate
          filters:
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 2
                redis-rate-limiter.burstCapacity: 5
                # 리포트 생성은 토큰 5개 소비
                redis-rate-limiter.requestedTokens: 5
                key-resolver: "#{@userKeyResolver}"

        # 인증 API — 브루트포스 방지
        - id: auth-service
          uri: lb://auth-service
          predicates:
            - Path=/api/auth/login
          filters:
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 3
                redis-rate-limiter.burstCapacity: 5
                redis-rate-limiter.requestedTokens: 1
                key-resolver: "#{@ipKeyResolver}"
```

---

## KeyResolver 구현

`KeyResolver`는 Rate Limiting의 기준이 되는 키를 결정한다. 클라이언트를 어떻게 식별할지에 따라 구현이 달라진다.

```kotlin
// KeyResolverConfig.kt
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import reactor.core.publisher.Mono

@Configuration
class KeyResolverConfig {

    /**
     * IP 기반 KeyResolver
     * - X-Forwarded-For 헤더가 있으면 첫 번째 IP 사용 (리버스 프록시 환경)
     * - 없으면 원격 주소 사용
     */
    @Bean
    fun ipKeyResolver(): KeyResolver = KeyResolver { exchange ->
        val forwardedFor = exchange.request.headers.getFirst("X-Forwarded-For")
        val ip = forwardedFor?.split(",")?.firstOrNull()?.trim()
            ?: exchange.request.remoteAddress?.address?.hostAddress
            ?: "unknown"
        Mono.just(ip)
    }

    /**
     * API Key 기반 KeyResolver (헤더)
     * - X-API-Key 헤더 값으로 식별
     * - 없으면 Mono.empty() 반환 → deny-empty-key 설정에 따라 처리
     */
    @Bean
    fun apiKeyResolver(): KeyResolver = KeyResolver { exchange ->
        val apiKey = exchange.request.headers.getFirst("X-API-Key")
        if (apiKey.isNullOrBlank()) {
            Mono.empty()
        } else {
            Mono.just(apiKey)
        }
    }

    /**
     * 인증된 사용자 ID 기반 KeyResolver
     * - Spring Security Principal에서 사용자 ID 추출
     * - 비인증 요청은 Mono.empty() 반환
     */
    @Bean
    fun userKeyResolver(): KeyResolver = KeyResolver { exchange ->
        exchange.getPrincipal<org.springframework.security.core.Authentication>()
            .map { auth -> auth.name }
            .defaultIfEmpty("anonymous")
    }

    /**
     * 복합 키 KeyResolver: 사용자 ID + 엔드포인트
     * - 엔드포인트별로 독립적인 Rate Limit 적용
     */
    @Bean
    fun userEndpointKeyResolver(): KeyResolver = KeyResolver { exchange ->
        exchange.getPrincipal<org.springframework.security.core.Authentication>()
            .map { auth ->
                val userId = auth.name
                val path = exchange.request.path.value()
                "$userId:$path"
            }
            .defaultIfEmpty("anonymous:${exchange.request.path.value()}")
    }

    /**
     * 플랜 등급 기반 KeyResolver
     * - X-Plan 헤더 값으로 다른 Rate Limit 적용
     * - 게이트웨이 앞단 인증 서버에서 주입한 헤더 활용
     */
    @Bean
    fun planBasedKeyResolver(): KeyResolver = KeyResolver { exchange ->
        val plan = exchange.request.headers.getFirst("X-User-Plan") ?: "free"
        val userId = exchange.request.headers.getFirst("X-User-Id") ?: "unknown"
        // "free:user123", "premium:user456" 형태의 키
        Mono.just("$plan:$userId")
    }
}
```

---

## 사용자 플랜별 동적 Rate Limit

구독 플랜마다 다른 Rate Limit을 적용하는 패턴이다.

```kotlin
// DynamicRateLimiter.kt
import org.springframework.cloud.gateway.filter.ratelimit.RateLimiter
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class DynamicRateLimiterConfig {

    /**
     * 플랜별 RedisRateLimiter 빈 등록
     */
    @Bean
    fun freeRateLimiter(): RedisRateLimiter = RedisRateLimiter(10, 20, 1)   // 10 req/s, burst 20

    @Bean
    fun basicRateLimiter(): RedisRateLimiter = RedisRateLimiter(50, 100, 1)  // 50 req/s, burst 100

    @Bean
    fun premiumRateLimiter(): RedisRateLimiter = RedisRateLimiter(200, 400, 1) // 200 req/s, burst 400
}
```

```yaml
spring:
  cloud:
    gateway:
      routes:
        # 플랜별 라우트 분기 (Predicate로 헤더 구분)
        - id: api-premium
          uri: lb://api-service
          predicates:
            - Path=/api/**
            - Header=X-User-Plan, premium
          filters:
            - name: RequestRateLimiter
              args:
                rate-limiter: "#{@premiumRateLimiter}"
                key-resolver: "#{@planBasedKeyResolver}"

        - id: api-basic
          uri: lb://api-service
          predicates:
            - Path=/api/**
            - Header=X-User-Plan, basic
          filters:
            - name: RequestRateLimiter
              args:
                rate-limiter: "#{@basicRateLimiter}"
                key-resolver: "#{@planBasedKeyResolver}"

        - id: api-free
          uri: lb://api-service
          predicates:
            - Path=/api/**
          filters:
            - name: RequestRateLimiter
              args:
                rate-limiter: "#{@freeRateLimiter}"
                key-resolver: "#{@planBasedKeyResolver}"
```

---

## Rate Limit 초과 응답 처리

### 기본 응답

Rate Limit을 초과하면 게이트웨이는 자동으로 다음 헤더와 함께 `429`를 반환한다.

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Remaining: 0
X-RateLimit-Burst-Capacity: 20
X-RateLimit-Replenish-Rate: 10
X-RateLimit-Requested-Tokens: 1
Content-Length: 0
```

### 커스텀 429 응답 메시지

기본 응답은 바디가 비어 있다. 커스텀 메시지를 반환하려면 `GlobalFilter`로 처리한다.

```kotlin
// RateLimitResponseFilter.kt
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.core.io.buffer.DataBufferUtils
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import com.fasterxml.jackson.databind.ObjectMapper

@Component
class RateLimitResponseFilter(
    private val objectMapper: ObjectMapper
) : GlobalFilter, Ordered {

    override fun getOrder(): Int = -2  // NettyWriteResponseFilter(-1) 보다 먼저

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        return chain.filter(exchange).then(
            Mono.defer {
                if (exchange.response.statusCode == HttpStatus.TOO_MANY_REQUESTS) {
                    val response = exchange.response
                    response.headers.contentType = MediaType.APPLICATION_JSON

                    val body = mapOf(
                        "error" to "Too Many Requests",
                        "message" to "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
                        "retryAfter" to (response.headers.getFirst("X-RateLimit-Burst-Capacity") ?: "알 수 없음"),
                        "remaining" to (response.headers.getFirst("X-RateLimit-Remaining") ?: "0")
                    )

                    val bytes = objectMapper.writeValueAsBytes(body)
                    val buffer = response.bufferFactory().wrap(bytes)
                    response.writeWith(Mono.just(buffer))
                } else {
                    Mono.empty()
                }
            }
        )
    }
}
```

---

## Redis 설정

### Lettuce 클라이언트 설정

```yaml
spring:
  data:
    redis:
      host: redis-host
      port: 6379
      password: ${REDIS_PASSWORD}
      ssl:
        enabled: true
      lettuce:
        pool:
          max-active: 16        # 최대 커넥션 수
          max-idle: 8           # 최대 유휴 커넥션
          min-idle: 2           # 최소 유휴 커넥션
          max-wait: 2s          # 커넥션 획득 대기 시간
        shutdown-timeout: 100ms
      timeout: 2s              # 명령 실행 타임아웃
      connect-timeout: 500ms
```

```kotlin
// RedisConfig.kt (커넥션 풀 고급 설정)
import io.lettuce.core.ClientOptions
import io.lettuce.core.SocketOptions
import io.lettuce.core.cluster.ClusterClientOptions
import org.apache.commons.pool2.impl.GenericObjectPoolConfig
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory
import org.springframework.data.redis.connection.RedisStandaloneConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory
import org.springframework.data.redis.connection.lettuce.LettucePoolingClientConfiguration
import java.time.Duration

@Configuration
class RedisConfig {

    @Bean
    fun reactiveRedisConnectionFactory(): ReactiveRedisConnectionFactory {
        val redisConfig = RedisStandaloneConfiguration("localhost", 6379)

        val poolConfig = GenericObjectPoolConfig<Any>().apply {
            maxTotal = 16
            maxIdle = 8
            minIdle = 2
            setMaxWait(Duration.ofSeconds(2))
            testOnBorrow = true
            testWhileIdle = true
        }

        val clientConfig = LettucePoolingClientConfiguration.builder()
            .poolConfig(poolConfig)
            .commandTimeout(Duration.ofSeconds(2))
            .clientOptions(
                ClientOptions.builder()
                    .socketOptions(
                        SocketOptions.builder()
                            .connectTimeout(Duration.ofMillis(500))
                            .build()
                    )
                    .autoReconnect(true)
                    .build()
            )
            .build()

        return LettuceConnectionFactory(redisConfig, clientConfig)
    }
}
```

### Lua 스크립트 원자성

`RedisRateLimiter`는 내부적으로 Lua 스크립트를 사용해 토큰 차감과 확인을 **원자적**으로 실행한다. Redis의 싱글 스레드 모델 + Lua 스크립트의 조합으로 분산 환경에서도 Race Condition 없이 정확한 Rate Limiting이 보장된다.

```lua
-- 내부적으로 실행되는 Lua 스크립트 (참고용)
local tokens_key = KEYS[1]  -- {prefix}.{key}.tokens
local timestamp_key = KEYS[2]  -- {prefix}.{key}.timestamp

local rate = tonumber(ARGV[1])        -- replenishRate
local capacity = tonumber(ARGV[2])    -- burstCapacity
local now = tonumber(ARGV[3])         -- 현재 시간 (마이크로초)
local requested = tonumber(ARGV[4])   -- requestedTokens

-- 마지막 요청 이후 보충된 토큰 계산
local fill_time = capacity / rate
local ttl = math.floor(fill_time * 2)

local last_tokens = tonumber(redis.call("get", tokens_key))
if last_tokens == nil then
  last_tokens = capacity
end

local last_refreshed = tonumber(redis.call("get", timestamp_key))
if last_refreshed == nil then
  last_refreshed = 0
end

local delta = math.max(0, now - last_refreshed)
local filled_tokens = math.min(capacity, last_tokens + (delta * rate))
local allowed = filled_tokens >= requested

local new_tokens = filled_tokens
if allowed then
  new_tokens = filled_tokens - requested
end

redis.call("setex", tokens_key, ttl, new_tokens)
redis.call("setex", timestamp_key, ttl, now)

return { allowed and 1 or 0, new_tokens }
```

---

## 실무 팁

### Redis 장애 시 동작 (Fail Open)

Redis 연결이 끊어지면 `RedisRateLimiter`는 기본적으로 **Fail Open** 동작을 한다. 즉, Rate Limit 없이 모든 요청을 통과시킨다. 이는 Redis 장애가 서비스 중단으로 이어지지 않도록 설계된 것이다.

Fail Open이 위험한 경우(보안 민감 API)에는 직접 예외 처리가 필요하다.

```kotlin
// Fail Closed가 필요한 경우 커스텀 RateLimiter 구현
@Component
class StrictRedisRateLimiter(
    private val delegate: RedisRateLimiter
) : AbstractRateLimiter<RedisRateLimiter.Config>(RedisRateLimiter.Config::class.java, "strict-rate-limiter", null) {

    override fun isAllowed(routeId: String, id: String): Mono<RateLimiter.Response> {
        return delegate.isAllowed(routeId, id)
            .onErrorReturn(
                // Redis 장애 시 Fail Closed: 요청 거부
                RateLimiter.Response(false, mapOf("X-RateLimit-Error" to "Rate limiter unavailable"))
            )
    }
}
```

### Rate Limit 헤더 활용

클라이언트가 남은 요청 횟수를 알 수 있도록 응답 헤더를 활용하자.

```
X-RateLimit-Remaining: 7      ← 현재 버킷의 남은 토큰
X-RateLimit-Burst-Capacity: 20 ← 최대 버스트
X-RateLimit-Replenish-Rate: 10 ← 초당 보충량
```

클라이언트는 `X-RateLimit-Remaining`이 0에 가까워지면 요청 속도를 줄이는 로직을 구현할 수 있다.

### Redis Cluster 환경에서 키 슬롯 문제

Redis Cluster에서 `{prefix}.{key}.tokens`와 `{prefix}.{key}.timestamp` 두 키는 같은 슬롯에 있어야 Lua 스크립트가 원자적으로 실행된다. `RedisRateLimiter`의 기본 키 접두사는 `request_rate_limiter.{key}`이며, `{key}` 부분이 해시 태그로 사용된다.

```yaml
spring:
  cloud:
    gateway:
      redis-rate-limiter:
        # 커스텀 키 접두사 설정 (Redis Cluster 환경)
        include-headers: true
```
