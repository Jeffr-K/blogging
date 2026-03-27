---
title: "Spring Cloud Gateway: 모니터링과 관찰성"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "actuator", "micrometer", "tracing"]
---

## Actuator 엔드포인트 활성화

Spring Cloud Gateway는 Actuator와 통합되어 라우트 관리와 메트릭 수집을 위한 전용 엔드포인트를 제공한다.

```yaml
management:
  endpoints:
    web:
      exposure:
        include:
          - gateway          # Gateway 전용 엔드포인트
          - health
          - info
          - metrics
          - prometheus       # Prometheus 스크레이핑
          - circuitbreakers  # Circuit Breaker 상태
  endpoint:
    health:
      show-details: always
    gateway:
      enabled: true
  # 메트릭 집계 활성화
  metrics:
    export:
      prometheus:
        enabled: true
    tags:
      application: spring-cloud-gateway
      environment: ${SPRING_PROFILES_ACTIVE:local}
```

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("io.micrometer:micrometer-registry-prometheus")
    // 분산 추적
    implementation("io.micrometer:micrometer-tracing-bridge-otel")
    implementation("io.opentelemetry:opentelemetry-exporter-zipkin")
}
```

---

## Gateway 전용 Actuator 엔드포인트

### GET /actuator/gateway/routes — 전체 라우트 조회

```bash
GET http://localhost:8080/actuator/gateway/routes
```

```json
[
  {
    "predicate": "Paths: [/api/users/**], match trailing slash: true",
    "metadata": {
      "management.port": "8081"
    },
    "route_id": "user-service",
    "filters": [
      "[[CircuitBreaker name = 'userServiceCB', fallback = '/fallback/user'], order = 1]",
      "[[RequestRateLimiter replenishRate = 10, burstCapacity = 20], order = 2]"
    ],
    "uri": "lb://user-service",
    "order": 0
  },
  {
    "predicate": "Paths: [/api/orders/**], match trailing slash: true",
    "metadata": {},
    "route_id": "order-service",
    "filters": [
      "[[CircuitBreaker name = 'orderServiceCB', fallback = '/fallback/order'], order = 1]"
    ],
    "uri": "lb://order-service",
    "order": 0
  }
]
```

### GET /actuator/gateway/globalfilters — 글로벌 필터 목록

```bash
GET http://localhost:8080/actuator/gateway/globalfilters
```

```json
{
  "org.springframework.cloud.gateway.filter.LoadBalancerClientFilter@5f4da5c3": 10100,
  "org.springframework.cloud.gateway.filter.NettyRoutingFilter@4e3e4a5": 2147483647,
  "org.springframework.cloud.gateway.filter.ForwardRoutingFilter@1234": 2147483647,
  "com.example.gateway.filter.JwtAuthenticationFilter@7a9e3b1": -100,
  "com.example.gateway.filter.LoggingGlobalFilter@2c8d9f4": -200
}
```

### GET /actuator/gateway/routefilters — 라우트 필터 팩토리

```bash
GET http://localhost:8080/actuator/gateway/routefilters
```

```json
{
  "[AddRequestHeaderGatewayFilterFactory@...]": null,
  "[CircuitBreakerGatewayFilterFactory@...]": null,
  "[RequestRateLimiterGatewayFilterFactory@...]": null,
  "[RewritePathGatewayFilterFactory@...]": null
}
```

### POST /actuator/gateway/refresh — 라우트 캐시 갱신

동적으로 라우트를 변경한 후 반영할 때 사용한다.

```bash
POST http://localhost:8080/actuator/gateway/refresh
# 응답: 200 OK (바디 없음)
```

### 런타임 라우트 추가/삭제

```bash
# 런타임에 라우트 추가
POST http://localhost:8080/actuator/gateway/routes/new-service
Content-Type: application/json

{
  "id": "new-service",
  "predicates": [
    {
      "name": "Path",
      "args": {"_genkey_0": "/api/new/**"}
    }
  ],
  "filters": [],
  "uri": "lb://new-service",
  "order": 0
}

# 런타임에 라우트 삭제
DELETE http://localhost:8080/actuator/gateway/routes/new-service
```

> **주의**: 런타임 라우트 추가/삭제는 재시작 시 초기화된다. 영구 반영이 필요하면 Config Server와 연동해야 한다.

---

## Micrometer 메트릭

### 메트릭 활성화 설정

```yaml
spring:
  cloud:
    gateway:
      metrics:
        enabled: true
        # 태그에 경로 포함 여부 (경로가 많으면 카디널리티 폭발 주의)
        tags-map:
          routeId: true
          routeUri: true
```

### 핵심 메트릭: spring.cloud.gateway.requests

게이트웨이의 가장 중요한 메트릭으로, 모든 요청에 대한 타이머다.

```bash
GET http://localhost:8080/actuator/metrics/spring.cloud.gateway.requests

{
  "name": "spring.cloud.gateway.requests",
  "description": "The number of requests",
  "measurements": [
    {"statistic": "COUNT", "value": 15243},
    {"statistic": "TOTAL_TIME", "value": 892.341},
    {"statistic": "MAX", "value": 3.251}
  ],
  "availableTags": [
    {"tag": "routeId", "values": ["user-service", "order-service", "payment-service"]},
    {"tag": "routeUri", "values": ["lb://user-service", "lb://order-service"]},
    {"tag": "outcome", "values": ["SUCCESSFUL", "CLIENT_ERROR", "SERVER_ERROR"]},
    {"tag": "status", "values": ["200", "404", "500", "503"]},
    {"tag": "httpMethod", "values": ["GET", "POST", "PUT", "DELETE"]}
  ]
}
```

### 태그별 메트릭 조회

```bash
# 특정 라우트의 메트릭
GET /actuator/metrics/spring.cloud.gateway.requests?tag=routeId:user-service

# 5xx 에러만 조회
GET /actuator/metrics/spring.cloud.gateway.requests?tag=outcome:SERVER_ERROR
```

### Prometheus 스크레이핑 설정

```yaml
# prometheus.yml (Prometheus 서버 설정)
scrape_configs:
  - job_name: 'spring-cloud-gateway'
    metrics_path: '/actuator/prometheus'
    scrape_interval: 15s
    static_configs:
      - targets: ['gateway-host:8080']
    # 인증이 필요한 경우
    basic_auth:
      username: prometheus
      password: secret
```

### Grafana 대시보드 PromQL 예제

```promql
# 초당 요청 수 (라우트별)
sum(rate(spring_cloud_gateway_requests_seconds_count[1m])) by (routeId)

# P99 레이턴시 (라우트별)
histogram_quantile(0.99,
  sum(rate(spring_cloud_gateway_requests_seconds_bucket[5m])) by (routeId, le)
)

# 에러율 (5xx / 전체)
sum(rate(spring_cloud_gateway_requests_seconds_count{outcome="SERVER_ERROR"}[1m]))
/
sum(rate(spring_cloud_gateway_requests_seconds_count[1m]))

# 특정 라우트의 평균 응답시간 (ms)
sum(rate(spring_cloud_gateway_requests_seconds_sum{routeId="order-service"}[5m]))
/
sum(rate(spring_cloud_gateway_requests_seconds_count{routeId="order-service"}[5m]))
* 1000

# Rate Limit 초과 횟수 (초당)
sum(rate(spring_cloud_gateway_requests_seconds_count{status="429"}[1m])) by (routeId)
```

---

## 분산 추적 (Distributed Tracing)

### 의존성 및 설정

```kotlin
// build.gradle.kts
dependencies {
    // Micrometer Tracing (OTEL 브릿지)
    implementation("io.micrometer:micrometer-tracing-bridge-otel")
    // Zipkin 익스포터
    implementation("io.opentelemetry:opentelemetry-exporter-zipkin")
    // 또는 OTLP (Jaeger, Tempo 등)
    // implementation("io.opentelemetry:opentelemetry-exporter-otlp")
}
```

```yaml
management:
  tracing:
    sampling:
      probability: 1.0  # 운영에서는 0.1 (10%) 권장
    propagation:
      type: b3_multi    # B3 형식 (Zipkin 호환)
      # type: w3c       # W3C TraceContext (표준)

  zipkin:
    tracing:
      endpoint: http://zipkin:9411/api/v2/spans

  otlp:
    tracing:
      endpoint: http://otel-collector:4318/v1/traces
```

### TraceId/SpanId 응답 헤더 포함

```kotlin
// TraceResponseHeaderFilter.kt
import io.micrometer.tracing.Tracer
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

@Component
class TraceResponseHeaderFilter(
    private val tracer: Tracer
) : GlobalFilter, Ordered {

    override fun getOrder(): Int = Ordered.LOWEST_PRECEDENCE - 1

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        return chain.filter(exchange).then(
            Mono.fromRunnable {
                val span = tracer.currentSpan()
                if (span != null) {
                    val traceId = span.context().traceId()
                    val spanId = span.context().spanId()
                    exchange.response.headers.apply {
                        add("X-Trace-Id", traceId)
                        add("X-Span-Id", spanId)
                    }
                }
            }
        )
    }
}
```

응답 헤더 예시:

```http
HTTP/1.1 200 OK
X-Trace-Id: 5e0c24f3e00d8561a0c57bb7f1c14d8e
X-Span-Id: a0c57bb7f1c14d8e
Content-Type: application/json
```

### Zipkin UI에서 확인

Zipkin(`http://zipkin:9411`)에서 TraceId로 검색하면 게이트웨이 → 하위 서비스 간의 전체 호출 흐름과 각 단계의 소요 시간을 시각적으로 확인할 수 있다.

```
Gateway (3.2ms total)
  └── user-service (1.1ms)
  └── order-service (2.0ms)
       └── payment-service (0.8ms)
```

---

## 로깅 설정

### Reactor Netty 액세스 로그

```yaml
# application.yml
logging:
  level:
    reactor.netty.http.server: INFO

# JVM 시스템 프로퍼티로 활성화
# -Dreactor.netty.http.server.accessLogEnabled=true
```

또는 코드로 활성화:

```kotlin
// GatewayApplication.kt
@SpringBootApplication
class GatewayApplication

fun main(args: Array<String>) {
    // Reactor Netty 액세스 로그 활성화
    System.setProperty("reactor.netty.http.server.accessLogEnabled", "true")
    runApplication<GatewayApplication>(*args)
}
```

액세스 로그 출력 예시:

```
reactor.netty.http.server.AccessLog - 192.168.1.10 - - [27/Mar/2026:10:15:23 +0000] "GET /api/users/123 HTTP/1.1" 200 1024 "https://app.example.com" "Mozilla/5.0" 45ms
```

### MDC에 TraceId 자동 포함

```yaml
logging:
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} traceId=%X{traceId} spanId=%X{spanId} - %msg%n"
```

Micrometer Tracing은 자동으로 MDC에 `traceId`, `spanId`를 추가하므로 별도 설정 없이 로그에 포함된다.

### 커스텀 로깅 GlobalFilter

```kotlin
// LoggingGlobalFilter.kt
import org.slf4j.LoggerFactory
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import java.time.Instant

@Component
class LoggingGlobalFilter : GlobalFilter, Ordered {

    private val logger = LoggerFactory.getLogger(LoggingGlobalFilter::class.java)

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE + 1

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val request = exchange.request
        val startTime = Instant.now().toEpochMilli()

        // --- PRE 처리 ---
        val clientIp = request.headers.getFirst("X-Forwarded-For")
            ?: request.remoteAddress?.address?.hostAddress
            ?: "unknown"

        logger.info(
            "[REQUEST] method={} path={} ip={} userAgent={}",
            request.method,
            request.path.value(),
            clientIp,
            request.headers.getFirst("User-Agent")
        )

        // --- 필터 체인 실행 ---
        return chain.filter(exchange).then(
            Mono.fromRunnable {
                // --- POST 처리 ---
                val elapsedMs = Instant.now().toEpochMilli() - startTime
                val statusCode = exchange.response.statusCode?.value() ?: 0
                val routeId = exchange.attributes["org.springframework.cloud.gateway.support.ServerWebExchangeUtils.gatewayRoute"]
                    ?.let { it::class.simpleName }

                val logLevel = when {
                    statusCode >= 500 -> "ERROR"
                    statusCode >= 400 -> "WARN"
                    else -> "INFO"
                }

                when (logLevel) {
                    "ERROR" -> logger.error(
                        "[RESPONSE] method={} path={} status={} duration={}ms routeId={}",
                        request.method, request.path.value(), statusCode, elapsedMs, routeId
                    )
                    "WARN" -> logger.warn(
                        "[RESPONSE] method={} path={} status={} duration={}ms routeId={}",
                        request.method, request.path.value(), statusCode, elapsedMs, routeId
                    )
                    else -> logger.info(
                        "[RESPONSE] method={} path={} status={} duration={}ms routeId={}",
                        request.method, request.path.value(), statusCode, elapsedMs, routeId
                    )
                }
            }
        )
    }
}
```

출력 예시:

```
10:15:23.100 [reactor-http-nio-2] INFO  LoggingGlobalFilter traceId=5e0c24f3e00d8561 spanId=a0c57bb7f1c1 - [REQUEST] method=GET path=/api/users/123 ip=192.168.1.10 userAgent=Mozilla/5.0
10:15:23.145 [reactor-http-nio-2] INFO  LoggingGlobalFilter traceId=5e0c24f3e00d8561 spanId=a0c57bb7f1c1 - [RESPONSE] method=GET path=/api/users/123 status=200 duration=45ms routeId=user-service
```

---

## 요청/응답 바디 로깅 주의사항

### DataBuffer 소비 문제

Reactor Netty는 요청/응답 바디를 스트리밍으로 처리한다. 한 번 읽으면 소비되어 다시 읽을 수 없다. 바디를 로깅하려면 반드시 캐싱 후 재구성해야 한다.

```kotlin
// RequestBodyLoggingFilter.kt — 바디 캐싱 방식
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils
import org.springframework.core.Ordered
import org.springframework.core.io.buffer.DataBufferUtils
import org.springframework.http.server.reactive.ServerHttpRequestDecorator
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono

@Component
class RequestBodyLoggingFilter : GlobalFilter, Ordered {

    private val logger = org.slf4j.LoggerFactory.getLogger(RequestBodyLoggingFilter::class.java)

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        // POST, PUT, PATCH만 바디 로깅 (GET은 바디 없음)
        if (exchange.request.method.name() !in listOf("POST", "PUT", "PATCH")) {
            return chain.filter(exchange)
        }

        // ServerWebExchangeUtils.cacheRequestBodyAndRequest 활용
        return ServerWebExchangeUtils.cacheRequestBodyAndRequest(exchange) { cachedExchange ->
            // 캐시된 바디 읽기 (로깅용)
            val cachedBody = cachedExchange.getAttribute<org.springframework.core.io.buffer.DataBuffer>(
                ServerWebExchangeUtils.CACHED_REQUEST_BODY_ATTR
            )

            if (cachedBody != null) {
                val bytes = ByteArray(cachedBody.readableByteCount())
                cachedBody.read(bytes)
                DataBufferUtils.release(cachedBody)

                val bodyString = String(bytes, Charsets.UTF_8)
                // 민감 정보 마스킹
                val maskedBody = maskSensitiveFields(bodyString)
                logger.debug("[REQUEST BODY] path={} body={}", exchange.request.path.value(), maskedBody)

                // 바디를 다시 복원 (다운스트림에서 읽을 수 있도록)
                val restored = exchange.response.bufferFactory().wrap(bytes)
                val mutatedExchange = cachedExchange.mutate()
                    .request(object : ServerHttpRequestDecorator(cachedExchange.request) {
                        override fun getBody(): Flux<org.springframework.core.io.buffer.DataBuffer> =
                            Flux.just(restored)
                    })
                    .build()

                chain.filter(mutatedExchange)
            } else {
                chain.filter(cachedExchange)
            }
        }
    }

    private fun maskSensitiveFields(body: String): String {
        return body
            .replace(Regex(""""password"\s*:\s*"[^"]*""""), """"password": "***"""")
            .replace(Regex(""""cardNumber"\s*:\s*"[^"]*""""), """"cardNumber": "***"""")
            .replace(Regex(""""cvv"\s*:\s*"[^"]*""""), """"cvv": "***"""")
    }
}
```

### 성능 영향

바디 로깅은 다음과 같은 성능 비용이 발생한다:

| 항목 | 영향 |
|------|------|
| 메모리 사용 | 요청 바디 전체를 메모리에 버퍼링 |
| 레이턴시 | 스트리밍 처리가 블로킹 방식으로 전환 |
| GC 부하 | 대용량 바디 처리 시 heap 사용량 증가 |

**운영 환경 권장사항**:
- 바디 로깅은 DEBUG 레벨로 설정하고 기본적으로 비활성화
- 특정 경로 또는 에러 발생 시에만 활성화
- 바디 크기 제한 설정 (`spring.codec.max-in-memory-size`)
- 민감 정보는 반드시 마스킹

```yaml
# 바디 로깅을 위한 코덱 크기 설정
spring:
  codec:
    max-in-memory-size: 1MB  # 기본값 256KB

logging:
  level:
    com.example.gateway.filter.RequestBodyLoggingFilter: DEBUG
```

---

## 실무 체크리스트

```bash
# 1. 게이트웨이 헬스 확인
curl http://localhost:8080/actuator/health

# 2. 라우트 설정 확인
curl http://localhost:8080/actuator/gateway/routes | jq .

# 3. 메트릭 수집 확인
curl http://localhost:8080/actuator/prometheus | grep gateway

# 4. 서킷 브레이커 상태 확인
curl http://localhost:8080/actuator/circuitbreakers | jq .

# 5. 특정 라우트 P99 레이턴시 확인 (Prometheus)
# histogram_quantile(0.99, sum(rate(spring_cloud_gateway_requests_seconds_bucket{routeId="order-service"}[5m])) by (le))
```
