---
title: "Spring Cloud Gateway: Circuit Breaker와 Resilience4j 통합"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "circuit-breaker", "resilience4j"]
---

## Circuit Breaker 패턴이란?

마이크로서비스 아키텍처에서 하나의 서비스 장애가 연쇄적으로 전파되는 **Cascading Failure**는 시스템 전체를 마비시킬 수 있다. Circuit Breaker 패턴은 이를 방지하기 위해 전기 회로 차단기처럼 장애가 감지되면 요청을 즉시 차단하고 빠르게 실패(Fail Fast)하도록 설계된 패턴이다.

### 상태 전환 모델

```
           실패율 임계값 초과
CLOSED ─────────────────────► OPEN
  ▲                              │
  │    일부 요청 성공             │ waitDuration 경과
  │                              ▼
  └──────────────────────── HALF_OPEN
         실패 시 다시 OPEN
```

| 상태 | 설명 |
|------|------|
| **CLOSED** | 정상 동작. 모든 요청을 통과시키며 실패율을 추적 |
| **OPEN** | 차단 상태. 모든 요청을 즉시 거부하고 폴백 실행 |
| **HALF_OPEN** | 시험 상태. 제한된 수의 요청을 허용해 복구 여부 확인 |

### 게이트웨이에서 Circuit Breaker가 필요한 이유

API Gateway는 모든 트래픽이 통과하는 단일 진입점이다. 게이트웨이 레이어에서 Circuit Breaker를 적용하면:

- **중앙 집중 관리**: 각 마이크로서비스에 개별 구현 없이 게이트웨이에서 일괄 처리
- **클라이언트 보호**: 장애 서비스로의 요청이 타임아웃까지 대기하지 않고 즉시 응답
- **리소스 보호**: 스레드/커넥션 풀 고갈 방지
- **폴백 제공**: 장애 시 캐시 응답, 기본값 반환 등 graceful degradation 구현

---

## 의존성 설정

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.springframework.cloud:spring-cloud-starter-gateway")
    implementation("org.springframework.cloud:spring-cloud-starter-circuitbreaker-reactor-resilience4j")

    // Actuator (서킷 상태 모니터링)
    implementation("org.springframework.boot:spring-boot-starter-actuator")
}

dependencyManagement {
    imports {
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:2023.0.3")
    }
}
```

---

## CircuitBreaker 필터 기본 설정

### YAML 전체 예제

```yaml
spring:
  cloud:
    gateway:
      routes:
        # 기본 Circuit Breaker 설정
        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - name: CircuitBreaker
              args:
                name: orderServiceCB          # CircuitBreaker 인스턴스 이름
                fallbackUri: forward:/fallback/order  # 폴백 경로

        # 상태 코드 기반 실패 판단
        - id: payment-service
          uri: lb://payment-service
          predicates:
            - Path=/api/payments/**
          filters:
            - name: CircuitBreaker
              args:
                name: paymentServiceCB
                fallbackUri: forward:/fallback/payment
                statusCodes:
                  - 500
                  - 502
                  - 503
                  - 504

        # 폴백 없이 빠른 실패만 적용
        - id: notification-service
          uri: lb://notification-service
          predicates:
            - Path=/api/notifications/**
          filters:
            - name: CircuitBreaker
              args:
                name: notificationServiceCB
                # fallbackUri 생략 시 503 Service Unavailable 반환
```

### 주요 파라미터 설명

| 파라미터 | 설명 |
|----------|------|
| `name` | Resilience4j CircuitBreaker 인스턴스 식별자. application.yml의 `resilience4j.circuitbreaker.instances` 키와 매핑 |
| `fallbackUri` | 서킷이 OPEN되거나 타임아웃 발생 시 forward할 경로 |
| `statusCodes` | 실패로 간주할 HTTP 상태 코드 목록. 미지정 시 예외(연결 실패, 타임아웃)만 실패로 처리 |

---

## application.yml Resilience4j 속성

```yaml
resilience4j:
  circuitbreaker:
    instances:
      orderServiceCB:
        # 슬라이딩 윈도우: 최근 N번의 요청을 기준으로 실패율 계산
        sliding-window-size: 10
        # 실패율이 50% 초과 시 OPEN 전환
        failure-rate-threshold: 50
        # OPEN 상태 유지 시간 (이후 HALF_OPEN으로 전환)
        wait-duration-in-open-state: 10s
        # HALF_OPEN에서 허용하는 테스트 요청 수
        permitted-number-of-calls-in-half-open-state: 3
        # 슬라이딩 윈도우가 채워지기 위한 최소 요청 수
        minimum-number-of-calls: 5
        # 느린 응답(임계값 초과)도 실패로 간주
        slow-call-rate-threshold: 80
        slow-call-duration-threshold: 2s
        # 예외 타입별 실패 여부 설정
        record-exceptions:
          - java.io.IOException
          - java.util.concurrent.TimeoutException
          - org.springframework.web.server.ResponseStatusException
        ignore-exceptions:
          - java.lang.IllegalArgumentException

      paymentServiceCB:
        sliding-window-size: 20
        failure-rate-threshold: 30   # 결제는 더 민감하게
        wait-duration-in-open-state: 30s
        permitted-number-of-calls-in-half-open-state: 5
        minimum-number-of-calls: 10

      notificationServiceCB:
        sliding-window-size: 10
        failure-rate-threshold: 70   # 알림은 덜 민감하게
        wait-duration-in-open-state: 5s
        permitted-number-of-calls-in-half-open-state: 3
        minimum-number-of-calls: 5

  timelimiter:
    instances:
      orderServiceCB:
        # 이 시간 안에 응답 없으면 TimeoutException → 실패로 기록
        timeout-duration: 3s
        cancel-running-future: true
      paymentServiceCB:
        timeout-duration: 5s
        cancel-running-future: true
      notificationServiceCB:
        timeout-duration: 1s
        cancel-running-future: true
```

---

## Resilience4JCircuitBreakerFactory 커스터마이징

YAML 설정으로 충분하지 않을 때 Java/Kotlin 코드로 세밀하게 제어할 수 있다.

```kotlin
// CircuitBreakerConfig.kt
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.timelimiter.TimeLimiterConfig
import org.springframework.cloud.circuitbreaker.resilience4j.ReactiveResilience4JCircuitBreakerFactory
import org.springframework.cloud.circuitbreaker.resilience4j.Resilience4JConfigBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import reactor.core.publisher.Mono
import java.time.Duration

@Configuration
class CircuitBreakerConfiguration {

    @Bean
    fun defaultCircuitBreakerCustomizer(): Customizer<ReactiveResilience4JCircuitBreakerFactory> {
        return Customizer { factory ->
            // 1. 전체 기본값 설정
            factory.configureDefault { id ->
                Resilience4JConfigBuilder(id)
                    .timeLimiterConfig(
                        TimeLimiterConfig.custom()
                            .timeoutDuration(Duration.ofSeconds(3))
                            .build()
                    )
                    .circuitBreakerConfig(
                        CircuitBreakerConfig.custom()
                            .slidingWindowSize(10)
                            .failureRateThreshold(50f)
                            .waitDurationInOpenState(Duration.ofSeconds(10))
                            .permittedNumberOfCallsInHalfOpenState(3)
                            .build()
                    )
                    .build()
            }

            // 2. 특정 인스턴스 개별 설정
            factory.configure({ builder ->
                builder
                    .timeLimiterConfig(
                        TimeLimiterConfig.custom()
                            .timeoutDuration(Duration.ofSeconds(5))
                            .build()
                    )
                    .circuitBreakerConfig(
                        CircuitBreakerConfig.custom()
                            .slidingWindowSize(20)
                            .failureRateThreshold(30f)
                            .waitDurationInOpenState(Duration.ofSeconds(30))
                            .permittedNumberOfCallsInHalfOpenState(5)
                            .slowCallRateThreshold(80f)
                            .slowCallDurationThreshold(Duration.ofSeconds(3))
                            .build()
                    )
            }, "paymentServiceCB")

            // 3. CircuitBreaker 이벤트 리스너 등록 (메트릭/로깅)
            factory.addCircuitBreakerCustomizer({ cb ->
                cb.eventPublisher
                    .onStateTransition { event ->
                        logger.info(
                            "CircuitBreaker [${event.circuitBreakerName}] " +
                            "상태 전환: ${event.stateTransition}"
                        )
                    }
                    .onCallNotPermitted { event ->
                        logger.warn("CircuitBreaker OPEN - 요청 차단: ${event.circuitBreakerName}")
                    }
            }, "orderServiceCB", "paymentServiceCB")
        }
    }

    companion object {
        private val logger = org.slf4j.LoggerFactory.getLogger(CircuitBreakerConfiguration::class.java)
    }
}
```

---

## 폴백 컨트롤러 구현 (WebFlux)

```kotlin
// FallbackController.kt
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import java.time.LocalDateTime

data class FallbackResponse(
    val timestamp: LocalDateTime = LocalDateTime.now(),
    val status: Int,
    val error: String,
    val message: String,
    val path: String,
    val circuitBreakerOpen: Boolean = false
)

@RestController
@RequestMapping("/fallback")
class FallbackController {

    /**
     * 주문 서비스 폴백
     * FallbackHeaders 필터가 주입한 헤더에서 에러 정보를 읽는다
     */
    @RequestMapping("/order")
    fun orderFallback(exchange: ServerWebExchange): Mono<ResponseEntity<FallbackResponse>> {
        val request = exchange.request
        val headers = request.headers

        // FallbackHeaders 필터가 주입한 헤더 읽기
        val exceptionType = headers.getFirst("Execution-Exception-Type")
        val exceptionMessage = headers.getFirst("Execution-Exception-Message")
        val rootCauseType = headers.getFirst("Root-Cause-Exception-Type")

        val isCircuitOpen = exceptionType?.contains("CallNotPermittedException") == true

        val response = FallbackResponse(
            status = if (isCircuitOpen) 503 else 504,
            error = if (isCircuitOpen) "Service Unavailable" else "Gateway Timeout",
            message = when {
                isCircuitOpen -> "주문 서비스가 일시적으로 사용 불가합니다. 잠시 후 다시 시도해 주세요."
                exceptionType?.contains("TimeoutException") == true ->
                    "요청 처리 시간이 초과되었습니다."
                else -> "주문 서비스 연결에 실패했습니다: $exceptionMessage"
            },
            path = request.path.value(),
            circuitBreakerOpen = isCircuitOpen
        )

        val status = if (isCircuitOpen) HttpStatus.SERVICE_UNAVAILABLE else HttpStatus.GATEWAY_TIMEOUT
        return Mono.just(ResponseEntity.status(status).body(response))
    }

    /**
     * 결제 서비스 폴백 — 캐시된 응답이나 기본값 반환
     */
    @RequestMapping("/payment")
    fun paymentFallback(exchange: ServerWebExchange): Mono<ResponseEntity<Map<String, Any>>> {
        val exceptionType = exchange.request.headers.getFirst("Execution-Exception-Type")
        val isCircuitOpen = exceptionType?.contains("CallNotPermittedException") == true

        val body = mapOf(
            "success" to false,
            "message" to if (isCircuitOpen) {
                "결제 서비스가 일시적으로 중단되었습니다. 고객센터(1234-5678)로 문의해 주세요."
            } else {
                "결제 처리 중 오류가 발생했습니다. 다시 시도해 주세요."
            },
            "retryAfter" to if (isCircuitOpen) 30 else 5,
            "circuitBreakerOpen" to isCircuitOpen
        )

        return Mono.just(
            ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body)
        )
    }

    /**
     * 범용 폴백
     */
    @RequestMapping
    fun genericFallback(exchange: ServerWebExchange): Mono<ResponseEntity<FallbackResponse>> {
        val response = FallbackResponse(
            status = 503,
            error = "Service Unavailable",
            message = "서비스를 일시적으로 사용할 수 없습니다.",
            path = exchange.request.path.value()
        )
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response))
    }
}
```

---

## FallbackHeaders 필터

폴백 컨트롤러에서 원본 에러 정보를 알 수 있도록 `FallbackHeaders` 필터를 함께 사용한다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - name: CircuitBreaker
              args:
                name: orderServiceCB
                fallbackUri: forward:/fallback/order
            # FallbackHeaders 필터: 폴백 요청에 에러 정보 헤더 추가
            - name: FallbackHeaders
              args:
                executionExceptionTypeHeaderName: Execution-Exception-Type
                executionExceptionMessageHeaderName: Execution-Exception-Message
                rootCauseExceptionTypeHeaderName: Root-Cause-Exception-Type
                rootCauseExceptionMessageHeaderName: Root-Cause-Exception-Message
```

폴백 요청에 추가되는 헤더:

| 헤더 | 내용 |
|------|------|
| `Execution-Exception-Type` | 발생한 예외 클래스명 (예: `CallNotPermittedException`) |
| `Execution-Exception-Message` | 예외 메시지 |
| `Root-Cause-Exception-Type` | 근본 원인 예외 클래스명 |
| `Root-Cause-Exception-Message` | 근본 원인 메시지 |

---

## 서킷 상태 모니터링

Actuator를 통해 런타임 서킷 상태를 확인할 수 있다.

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, circuitbreakers, circuitbreakerevents, metrics
  endpoint:
    health:
      show-details: always
  health:
    circuitbreakers:
      enabled: true
```

### 주요 엔드포인트

```bash
# 전체 CircuitBreaker 상태 조회
GET /actuator/circuitbreakers

# 응답 예시
{
  "circuitBreakers": {
    "orderServiceCB": {
      "failureRate": "20.0%",
      "slowCallRate": "0.0%",
      "failureRateThreshold": "50.0%",
      "slowCallRateThreshold": "80.0%",
      "bufferedCalls": 10,
      "slowCalls": 0,
      "slowFailedCalls": 0,
      "failedCalls": 2,
      "notPermittedCalls": 0,
      "state": "CLOSED"
    }
  }
}

# 특정 CB의 이벤트 히스토리
GET /actuator/circuitbreakerevents/orderServiceCB

# Health check (OPEN 상태 서킷 있으면 DOWN 표시)
GET /actuator/health
```

### Micrometer 메트릭으로 알람 설정

```yaml
# Prometheus 스크레이핑 활성화
management:
  metrics:
    export:
      prometheus:
        enabled: true
```

```promql
# Grafana 알람 쿼리 예시: 서킷이 OPEN 상태인 경우
resilience4j_circuitbreaker_state{state="open"} == 1

# 실패율이 40% 초과 시 경고
resilience4j_circuitbreaker_failure_rate > 40
```

---

## 실무 팁

### 1. 폴백 URL은 게이트웨이 자신의 경로로

`fallbackUri: forward:/fallback/xxx` 처럼 게이트웨이 내부 경로를 사용해야 한다. 외부 서비스 URL은 지원되지 않는다.

### 2. 폴백 엔드포인트 자체에 보안 적용

폴백 경로(`/fallback/**`)는 인증 없이 접근 가능해야 하므로 Security 설정에서 별도로 처리한다.

```kotlin
@Bean
fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
    return http
        .authorizeExchange { auth ->
            auth
                .pathMatchers("/fallback/**").permitAll()
                .anyExchange().authenticated()
        }
        .build()
}
```

### 3. 서킷 이름과 TimeLimiter 이름 일치

`CircuitBreaker` 필터의 `name`과 `resilience4j.timelimiter.instances`의 키가 동일해야 TimeLimiter가 올바르게 적용된다.

### 4. statusCodes 설정 주의

`statusCodes`에 `404`를 포함하면 정상적인 "Not Found" 응답도 실패로 집계된다. 서버 오류(5xx)만 포함하는 것이 일반적이다.

### 5. 최소 요청 수(minimumNumberOfCalls) 설정

트래픽이 낮은 시간대에 몇 번의 실패로 서킷이 열리지 않도록 `minimum-number-of-calls`를 적절히 설정한다.
