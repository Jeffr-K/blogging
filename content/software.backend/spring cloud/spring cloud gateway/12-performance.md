---
title: "Spring Cloud Gateway: 성능 튜닝 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "performance", "netty", "tuning"]
---

## 성능 튜닝 전 기본 이해

Spring Cloud Gateway는 **Reactor Netty** 위에서 동작하는 완전 비동기 논블로킹 서버다. 전통적인 Spring MVC(Tomcat)와 스레드 모델이 근본적으로 다르기 때문에 튜닝 포인트도 다르다.

```
Tomcat (MVC):
요청 1 → Thread-1 → [블로킹 I/O] → 응답
요청 2 → Thread-2 → [블로킹 I/O] → 응답
... (동시 요청 수 = 스레드 수)

Reactor Netty (Gateway):
요청 1 ─┐
요청 2 ─┤→ EventLoop Thread-1 → [논블로킹 I/O] → 응답 1
요청 3 ─┤                                         → 응답 2
요청 N ─┘                                         → 응답 N
(소수의 스레드로 수만 건 동시 처리)
```

---

## Reactor Netty 커넥션 풀 설정

게이트웨이가 하위 서비스에 요청을 보낼 때 사용하는 HTTP 클라이언트의 커넥션 풀이다. 이 설정이 잘못되면 커넥션 고갈(exhaustion)로 인한 타임아웃이 대량으로 발생한다.

```yaml
spring:
  cloud:
    gateway:
      httpclient:
        pool:
          # 풀 타입: ELASTIC(무제한), FIXED(고정), DISABLED(풀 미사용)
          type: FIXED
          # 최대 커넥션 수 (기본값: CPU 코어 수 * 2)
          max-connections: 500
          # 커넥션 획득 대기 최대 시간 (초과 시 AcquireTimeoutException)
          acquire-timeout: 45000  # ms
          # 유휴 커넥션 최대 유지 시간 (이후 닫힘)
          max-idle-time: 20s
          # 커넥션 최대 수명 (이후 닫힘, 메모리 누수 방지)
          max-life-time: 60s
          # 주기적으로 유휴 커넥션을 evict (기본값 비활성화)
          eviction-interval: 30s
```

### 서비스별 커넥션 풀 분리

하나의 느린 서비스가 전체 커넥션 풀을 점유하지 못하도록 서비스별로 커넥션을 격리할 수 있다.

```kotlin
// HttpClientConfig.kt
import io.netty.channel.ChannelOption
import io.netty.handler.timeout.ReadTimeoutHandler
import io.netty.handler.timeout.WriteTimeoutHandler
import org.springframework.cloud.gateway.config.HttpClientCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import reactor.netty.http.client.HttpClient
import reactor.netty.resources.ConnectionProvider
import java.time.Duration
import java.util.concurrent.TimeUnit

@Configuration
class HttpClientConfig {

    @Bean
    fun httpClientCustomizer(): HttpClientCustomizer {
        val connectionProvider = ConnectionProvider.builder("gateway-pool")
            .maxConnections(500)
            .pendingAcquireMaxCount(1000)          // 대기 큐 최대 크기
            .pendingAcquireTimeout(Duration.ofMillis(45000))
            .maxIdleTime(Duration.ofSeconds(20))
            .maxLifeTime(Duration.ofSeconds(60))
            .evictInBackground(Duration.ofSeconds(30))
            // 메트릭 수집 활성화
            .metrics(true) { remoteAddress, _ -> remoteAddress.hostString }
            .build()

        return HttpClientCustomizer { client ->
            client
                .connectionProvider(connectionProvider)
                // TCP 레벨 옵션
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
                .option(ChannelOption.SO_KEEPALIVE, true)
                .option(ChannelOption.TCP_NODELAY, true)
                // Netty 파이프라인에 타임아웃 핸들러 추가
                .doOnConnected { conn ->
                    conn.addHandlerLast(ReadTimeoutHandler(30, TimeUnit.SECONDS))
                    conn.addHandlerLast(WriteTimeoutHandler(30, TimeUnit.SECONDS))
                }
                // 압축 응답 자동 해제
                .compress(true)
                // Keep-Alive 설정
                .keepAlive(true)
        }
    }
}
```

---

## 타임아웃 설정

### 글로벌 타임아웃

```yaml
spring:
  cloud:
    gateway:
      httpclient:
        # TCP 연결 타임아웃 (ms)
        connect-timeout: 5000
        # 응답 타임아웃 (java.time.Duration 형식)
        response-timeout: 30s
```

### 라우트별 타임아웃

라우트마다 다른 SLA를 적용해야 할 때 `metadata`를 사용한다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        # 빠른 응답이 필요한 API
        - id: user-profile
          uri: lb://user-service
          predicates:
            - Path=/api/users/profile
          metadata:
            connect-timeout: 1000     # ms
            response-timeout: 3000    # ms

        # 처리 시간이 긴 배치 API
        - id: report-generate
          uri: lb://report-service
          predicates:
            - Path=/api/reports/generate
          metadata:
            connect-timeout: 5000
            response-timeout: 120000  # 2분

        # WebSocket / SSE — 타임아웃 비활성화
        - id: realtime-ws
          uri: ws://realtime-service:8080
          predicates:
            - Path=/ws/**
          metadata:
            response-timeout: -1      # -1 = 비활성화

        # 외부 서드파티 API — 넉넉한 타임아웃
        - id: external-payment
          uri: https://payment.external.com
          predicates:
            - Path=/api/external/pay
          metadata:
            connect-timeout: 10000
            response-timeout: 60000
```

### 타임아웃 설정 없을 때의 위험성

`response-timeout`을 설정하지 않으면 하위 서비스가 응답을 주지 않을 경우 요청이 **무한정 대기**한다. 이로 인해:

1. 커넥션 풀이 점점 고갈됨
2. 새 요청이 `acquire-timeout`으로 실패하기 시작함
3. 게이트웨이 전체가 응답 불능 상태에 빠짐

반드시 모든 라우트에 `response-timeout`을 설정하고, Circuit Breaker의 `timeLimiter`와 함께 사용한다.

---

## 버퍼 & 메모리

### 코덱 버퍼 크기

```yaml
spring:
  codec:
    # 기본값: 256KB
    # ModifyRequestBody/ModifyResponseBody 사용 시 바디 크기만큼 필요
    max-in-memory-size: 1MB
```

언제 늘려야 하는가:

| 상황 | 설명 |
|------|------|
| `ModifyRequestBody` 사용 | 요청 바디 전체를 메모리에 버퍼링 |
| `ModifyResponseBody` 사용 | 응답 바디 전체를 메모리에 버퍼링 |
| `CacheRequestBody` 사용 | 요청 바디를 캐싱 (로깅, 검증용) |
| 대용량 JSON API | 기본 256KB 초과 시 `DataBufferLimitException` |

### DataBuffer 누수 방지

```kotlin
// DataBuffer를 직접 다루는 경우 반드시 release 처리
@Component
class BodyCachingFilter : GlobalFilter, Ordered {
    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        return DataBufferUtils.join(exchange.request.body)
            .flatMap { dataBuffer ->
                try {
                    val bytes = ByteArray(dataBuffer.readableByteCount())
                    dataBuffer.read(bytes)
                    // 반드시 release! 안 하면 메모리 누수
                    DataBufferUtils.release(dataBuffer)

                    val cachedBody = exchange.response.bufferFactory().wrap(bytes)
                    // ... 처리 로직

                    chain.filter(exchange)
                } catch (e: Exception) {
                    // 예외 발생 시에도 release
                    DataBufferUtils.release(dataBuffer)
                    Mono.error(e)
                }
            }
    }
}
```

### 대용량 파일 업로드 스트리밍 처리

파일 업로드는 바디를 버퍼링하지 않고 스트리밍으로 하위 서비스에 전달해야 한다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: file-upload
          uri: lb://storage-service
          predicates:
            - Path=/api/files/**
          # ModifyRequestBody, CacheRequestBody 필터 사용 금지
          # 필터 없이 스트리밍 그대로 전달
```

```kotlin
// 대용량 업로드 라우트 설정
@Bean
fun fileUploadRoute(builder: RouteLocatorBuilder): RouteLocator {
    return builder.routes()
        .route("file-upload") { r ->
            r.path("/api/files/**")
                // 파일 업로드에는 바디 수정 필터 없이 직접 전달
                .filters { f ->
                    f.addRequestHeader("X-Gateway-Forwarded", "true")
                    // response-timeout 늘리기
                }
                .metadata("response-timeout", 300000L)  // 5분
                .uri("lb://storage-service")
        }
        .build()
}
```

---

## 스레드 모델 이해

### 이벤트 루프 스레드

```
CPU 코어 수 = 이벤트 루프 스레드 수 (기본값)
예: 8코어 → reactor-http-nio-1 ~ reactor-http-nio-8

이벤트 루프 스레드는 다음을 담당:
- 요청 수신 (accept)
- 필터 체인 실행
- 하위 서비스로의 비동기 요청
- 응답 전송
```

### 블로킹 코드를 이벤트 루프에서 호출하면 안 되는 이유

```kotlin
// BAD: 이벤트 루프 스레드에서 블로킹 I/O 호출
@Component
class BadGlobalFilter : GlobalFilter, Ordered {
    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        // 이벤트 루프 스레드가 블로킹됨!
        // 이 스레드가 다른 요청을 처리 못함 → 레이턴시 폭발
        val result = someBlockingDatabaseCall()  // JDBC, 동기 HTTP 등
        exchange.request.mutate().header("X-Data", result)
        return chain.filter(exchange)
    }
}

// GOOD: 블로킹 작업을 boundedElastic 스케줄러로 위임
@Component
class GoodGlobalFilter : GlobalFilter, Ordered {
    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        return Mono.fromCallable {
            // 이 블록은 boundedElastic 스레드 풀에서 실행
            someBlockingDatabaseCall()
        }
        .subscribeOn(Schedulers.boundedElastic())
        .flatMap { result ->
            val mutatedRequest = exchange.request.mutate()
                .header("X-Data", result)
                .build()
            chain.filter(exchange.mutate().request(mutatedRequest).build())
        }
    }
}
```

### WebClient 내부에서 block() 호출 금지

```kotlin
// BAD: Reactor 컨텍스트 내에서 block() 호출 → 데드락 또는 예외
val response = webClient.get()
    .uri("http://service/api")
    .retrieve()
    .bodyToMono(String::class.java)
    .block()  // IllegalStateException 또는 데드락!

// GOOD: flatMap으로 체이닝
webClient.get()
    .uri("http://service/api")
    .retrieve()
    .bodyToMono(String::class.java)
    .flatMap { response ->
        // 응답 처리
        chain.filter(exchange)
    }
```

### Schedulers.boundedElastic() 사용 예시

```kotlin
@Component
class TokenValidationFilter(
    private val tokenValidationService: TokenValidationService  // 동기 방식 레거시 서비스
) : GlobalFilter, Ordered {

    override fun getOrder(): Int = -100

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val token = exchange.request.headers.getFirst("Authorization")
            ?.removePrefix("Bearer ")
            ?: return unauthorized(exchange)

        return Mono.fromCallable {
            // 레거시 동기 검증 로직 (JDBC 조회 등)
            tokenValidationService.validate(token)  // 블로킹!
        }
        .subscribeOn(Schedulers.boundedElastic())
        .flatMap { validationResult ->
            if (!validationResult.isValid) {
                unauthorized(exchange)
            } else {
                val mutatedRequest = exchange.request.mutate()
                    .header("X-User-Id", validationResult.userId)
                    .build()
                chain.filter(exchange.mutate().request(mutatedRequest).build())
            }
        }
        .onErrorResume { unauthorized(exchange) }
    }

    private fun unauthorized(exchange: ServerWebExchange): Mono<Void> {
        exchange.response.statusCode = org.springframework.http.HttpStatus.UNAUTHORIZED
        return exchange.response.setComplete()
    }
}
```

---

## 성능 측정 & 튜닝 체크리스트

### 1. 레이턴시 확인

```bash
# Actuator로 P50/P95/P99 레이턴시 확인
curl "http://localhost:8080/actuator/metrics/spring.cloud.gateway.requests?tag=routeId:order-service"

# Prometheus 쿼리
histogram_quantile(0.99,
  sum(rate(spring_cloud_gateway_requests_seconds_bucket{routeId="order-service"}[5m])) by (le)
)
```

### 2. 커넥션 풀 고갈 탐지

```bash
# 커넥션 풀 메트릭 (ConnectionProvider metrics 활성화 필요)
curl "http://localhost:8080/actuator/metrics/reactor.netty.connection.provider.total.connections"
curl "http://localhost:8080/actuator/metrics/reactor.netty.connection.provider.pending.connections.count"

# 고갈 징후:
# - pending.connections.count가 지속적으로 높음
# - AcquireTimeoutException 로그 증가
# - 응답 시간이 acquire-timeout 값과 일치
```

### 3. 이벤트 루프 블로킹 탐지 (BlockHound)

```kotlin
// build.gradle.kts
testImplementation("io.projectreactor.tools:blockhound:1.0.8.RELEASE")
```

```kotlin
// GatewayApplicationTests.kt
import reactor.blockhound.BlockHound

class GatewayApplicationTests {
    @BeforeAll
    fun setUp() {
        // 블로킹 호출 탐지 활성화 (테스트 환경)
        BlockHound.install()
    }

    @Test
    fun `이벤트 루프에서 블로킹 호출이 없어야 한다`() {
        // 통합 테스트 실행 시 블로킹 호출 감지 → BlockingOperationError 발생
    }
}
```

### 4. GC 튜닝

게이트웨이는 단명(short-lived) 객체를 대량으로 생성한다. GC 튜닝이 중요하다.

```bash
# G1GC (Java 11+, 기본값)
java -Xms512m -Xmx2g \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:G1HeapRegionSize=4m \
  -XX:+UseStringDeduplication \
  -jar gateway.jar

# ZGC (Java 17+, 초저지연 권장)
java -Xms512m -Xmx4g \
  -XX:+UseZGC \
  -XX:SoftMaxHeapSize=3g \
  -jar gateway.jar

# GC 로그 활성화 (성능 분석용)
java -Xlog:gc*:file=/var/log/gateway-gc.log:time,uptime:filecount=10,filesize=50m \
  -jar gateway.jar
```

---

## 실무 권장 설정 (application.yml 전체)

```yaml
server:
  port: 8080
  http2:
    enabled: true

spring:
  codec:
    max-in-memory-size: 1MB

  cloud:
    gateway:
      # 메트릭 활성화
      metrics:
        enabled: true

      # HTTP 클라이언트 설정
      httpclient:
        # 커넥션 풀
        pool:
          type: FIXED
          max-connections: 500
          acquire-timeout: 45000
          max-idle-time: 20s
          max-life-time: 60s
          eviction-interval: 30s
        # 글로벌 타임아웃
        connect-timeout: 5000
        response-timeout: 30s
        # HTTP/2 활성화
        http2:
          enabled: true
        # 압축
        compression:
          enabled: true
        # Wiretap 비활성화 (운영 환경)
        wiretap: false

      # Rate Limiter 설정
      filter:
        request-rate-limiter:
          deny-empty-key: false

      # 기본 필터
      default-filters:
        - DedupeResponseHeader=Access-Control-Allow-Origin Access-Control-Allow-Credentials, RETAIN_FIRST

      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/users/**
          metadata:
            connect-timeout: 3000
            response-timeout: 10000
          filters:
            - name: CircuitBreaker
              args:
                name: userServiceCB
                fallbackUri: forward:/fallback/user
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 20
                redis-rate-limiter.burstCapacity: 40
                key-resolver: "#{@ipKeyResolver}"

        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          metadata:
            connect-timeout: 5000
            response-timeout: 15000
          filters:
            - name: CircuitBreaker
              args:
                name: orderServiceCB
                fallbackUri: forward:/fallback/order

management:
  endpoints:
    web:
      exposure:
        include: health, metrics, prometheus, gateway, circuitbreakers
  metrics:
    export:
      prometheus:
        enabled: true
    tags:
      application: spring-cloud-gateway
  tracing:
    sampling:
      probability: 0.1   # 운영 환경: 10% 샘플링

logging:
  level:
    org.springframework.cloud.gateway: INFO
    reactor.netty: WARN
    # 커넥션 풀 디버깅 시
    # reactor.netty.resources: DEBUG
```

---

## 성능 벤치마크 기준값

일반적인 환경(4코어, 8GB RAM)에서의 기준값이다. 실제 환경에 따라 크게 달라질 수 있다.

| 지표 | 기준값 | 문제 징후 |
|------|--------|-----------|
| P99 레이턴시 (패스스루) | < 5ms | > 50ms |
| TPS (간단한 라우팅) | > 10,000 | < 1,000 |
| CPU 사용률 | < 70% | > 90% 지속 |
| Heap 사용률 | < 70% | GC 빈도 증가 |
| 커넥션 풀 pending | 0에 가까움 | 지속적으로 > 0 |
| 에러율 | < 0.1% | > 1% |

성능 이슈가 발생하면 다음 순서로 확인한다:

1. **커넥션 풀 고갈** → `max-connections`, `acquire-timeout` 조정
2. **이벤트 루프 블로킹** → BlockHound로 탐지, `boundedElastic`으로 위임
3. **메모리 부족** → `max-in-memory-size`, heap 크기 조정
4. **GC 과부하** → ZGC로 전환, heap 크기 조정
5. **하위 서비스 병목** → Circuit Breaker + TimeLimiter로 격리
