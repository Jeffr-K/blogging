---
title: "Spring Boot: Actuator, 메트릭, 분산 추적"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "actuator", "micrometer", "observability"]
---

# Actuator, 메트릭, 분산 추적

## Spring Boot Actuator

운영 중인 애플리케이션의 상태를 HTTP 또는 JMX로 노출하는 엔드포인트 모음이다.

```kotlin
implementation("org.springframework.boot:spring-boot-starter-actuator")
```

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus,env,loggers
      base-path: /actuator
  endpoint:
    health:
      show-details: when-authorized  # never | always | when-authorized
    shutdown:
      enabled: false  # 운영 환경에서 비활성화
  server:
    port: 8081  # 별도 포트로 분리 (외부 노출 방지)
```

### 주요 엔드포인트

| 엔드포인트 | 설명 |
|---|---|
| `/actuator/health` | 헬스 상태 (UP/DOWN) |
| `/actuator/info` | 빌드/Git 정보 |
| `/actuator/metrics` | JVM, HTTP, DB 메트릭 |
| `/actuator/prometheus` | Prometheus 스크랩 포맷 |
| `/actuator/env` | 환경 변수 (민감 정보 마스킹) |
| `/actuator/loggers` | 런타임 로그 레벨 변경 |
| `/actuator/threaddump` | 스레드 덤프 |
| `/actuator/heapdump` | 힙 덤프 |
| `/actuator/flyway` | 마이그레이션 이력 |
| `/actuator/caches` | 캐시 상태 |

---

## 커스텀 HealthIndicator

```java
@Component
public class ExternalApiHealthIndicator implements HealthIndicator {

    private final PaymentApiClient paymentApiClient;

    @Override
    public Health health() {
        try {
            ResponseEntity<String> response = paymentApiClient.ping();
            if (response.getStatusCode().is2xxSuccessful()) {
                return Health.up()
                    .withDetail("responseTime", "50ms")
                    .withDetail("endpoint", "payment-api")
                    .build();
            }
            return Health.down()
                .withDetail("status", response.getStatusCode())
                .build();
        } catch (Exception e) {
            return Health.down(e)
                .withDetail("endpoint", "payment-api")
                .build();
        }
    }
}
```

### 복합 헬스 체크

```java
@Component("database")
public class DatabaseHealthIndicator extends AbstractHealthIndicator {

    private final DataSource dataSource;

    @Override
    protected void doHealthCheck(Health.Builder builder) throws Exception {
        try (Connection conn = dataSource.getConnection()) {
            builder.up()
                .withDetail("database", conn.getMetaData().getDatabaseProductName())
                .withDetail("version", conn.getMetaData().getDatabaseProductVersion());
        }
    }
}
```

응답 예시:
```json
{
  "status": "UP",
  "components": {
    "database": { "status": "UP", "details": { "database": "PostgreSQL" } },
    "externalApi": { "status": "UP", "details": { "responseTime": "50ms" } },
    "redis": { "status": "UP" }
  }
}
```

---

## Micrometer 메트릭

Micrometer는 벤더 중립적인 메트릭 API다. Prometheus, Datadog, CloudWatch 등에 메트릭을 전송할 수 있다.

```kotlin
implementation("io.micrometer:micrometer-registry-prometheus")
```

### 빌트인 메트릭

Spring Boot가 자동으로 수집하는 메트릭:

- **JVM**: `jvm.memory.used`, `jvm.gc.pause`, `jvm.threads.live`
- **HTTP**: `http.server.requests` (URI, method, status별 카운트/시간)
- **DB**: `hikaricp.connections.active`, `spring.data.repository.invocations`
- **캐시**: `cache.gets`, `cache.puts`, `cache.evictions`
- **Kafka/RabbitMQ**: 프로듀서/컨슈머 지연 시간

### 커스텀 메트릭

```java
@Component
public class OrderMetrics {

    private final Counter orderCreatedCounter;
    private final Timer orderProcessingTimer;
    private final AtomicLong pendingOrders;

    public OrderMetrics(MeterRegistry registry) {
        // 카운터: 단조 증가
        this.orderCreatedCounter = Counter.builder("order.created.total")
            .description("생성된 주문 수")
            .tag("region", "kr")
            .register(registry);

        // 타이머: 실행 시간 측정
        this.orderProcessingTimer = Timer.builder("order.processing.duration")
            .description("주문 처리 시간")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(registry);

        // 게이지: 현재 상태 (증감 가능)
        this.pendingOrders = registry.gauge("order.pending.count",
            new AtomicLong(0));
    }

    public void recordOrderCreated() {
        orderCreatedCounter.increment();
    }

    public <T> T recordProcessingTime(Supplier<T> supplier) {
        return orderProcessingTimer.record(supplier);
    }

    public void updatePendingCount(long count) {
        pendingOrders.set(count);
    }
}
```

### @Timed 어노테이션

```java
@Service
public class OrderService {

    @Timed(
        value = "order.service.create",
        description = "주문 생성 시간",
        percentiles = {0.5, 0.95}
    )
    public OrderResponse createOrder(CreateOrderRequest request) {
        // ...
    }
}
```

`@EnableAspectJAutoProxy`와 `TimedAspect` 빈 등록이 필요하다:

```java
@Bean
public TimedAspect timedAspect(MeterRegistry registry) {
    return new TimedAspect(registry);
}
```

---

## Prometheus + Grafana 연동

```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
```

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'spring-boot'
    metrics_path: '/actuator/prometheus'
    scrape_interval: 15s
    static_configs:
      - targets: ['host.docker.internal:8080']
```

---

## 분산 추적 (Micrometer Tracing)

Spring Boot 3.x는 Micrometer Tracing을 통해 분산 추적을 지원한다.

```kotlin
// Micrometer Tracing + Brave (Zipkin)
implementation("io.micrometer:micrometer-tracing-bridge-brave")
implementation("io.zipkin.reporter2:zipkin-reporter-brave")

// 또는 OpenTelemetry
implementation("io.micrometer:micrometer-tracing-bridge-otel")
implementation("io.opentelemetry.exporter:opentelemetry-exporter-otlp")
```

```yaml
management:
  tracing:
    sampling:
      probability: 1.0  # 100% 샘플링 (개발), 운영은 0.1~0.3
  zipkin:
    tracing:
      endpoint: http://localhost:9411/api/v2/spans
```

### 로그에 Trace ID 포함

Spring Boot 3.x는 자동으로 MDC에 `traceId`, `spanId`를 추가한다.

```yaml
logging:
  pattern:
    console: "%d{HH:mm:ss} [%thread] %-5level [%X{traceId},%X{spanId}] %logger{36} - %msg%n"
```

로그 출력 예시:
```
14:23:45 [http-1] INFO  [abc123def456,abc123def456] OrderController - 주문 생성 요청
14:23:45 [http-1] INFO  [abc123def456,789xyz000] OrderService - 주문 저장 완료
```

### 커스텀 Span

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final Tracer tracer;

    public OrderResponse createOrder(CreateOrderRequest request) {
        Span span = tracer.nextSpan().name("createOrder").start();
        try (Tracer.SpanInScope ws = tracer.withSpan(span)) {
            span.tag("order.userId", request.userId().toString());

            Order order = processOrder(request);
            span.tag("order.id", order.getId().toString());
            return OrderResponse.from(order);
        } catch (Exception e) {
            span.error(e);
            throw e;
        } finally {
            span.end();
        }
    }
}
```

---

## 구조화 로깅 (Structured Logging)

Spring Boot 3.4+에서 지원한다. JSON 형식으로 로그를 출력해 ELK, Loki 등과 연동한다.

```yaml
logging:
  structured:
    format:
      console: ecs     # ECS (Elastic Common Schema) 형식
      # 또는 gelf, logstash
```

JSON 출력 예시:
```json
{
  "@timestamp": "2026-03-27T14:23:45.123Z",
  "log.level": "INFO",
  "message": "주문 생성 완료",
  "service.name": "order-service",
  "trace.id": "abc123def456",
  "span.id": "abc123def456",
  "order.id": "1234"
}
```

### MDC에 커스텀 필드 추가

```java
@Component
public class RequestLoggingFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
        throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String requestId = UUID.randomUUID().toString();

        MDC.put("requestId", requestId);
        MDC.put("userId", extractUserId(httpRequest));
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
```

---

## 런타임 로그 레벨 변경

Actuator를 통해 재시작 없이 로그 레벨을 바꿀 수 있다.

```bash
# 현재 로그 레벨 확인
curl http://localhost:8081/actuator/loggers/com.example.order

# 로그 레벨 변경 (DEBUG로)
curl -X POST http://localhost:8081/actuator/loggers/com.example.order \
  -H "Content-Type: application/json" \
  -d '{"configuredLevel": "DEBUG"}'

# 원복
curl -X POST http://localhost:8081/actuator/loggers/com.example.order \
  -H "Content-Type: application/json" \
  -d '{"configuredLevel": null}'
```

---

## 커스텀 Info Contributor

```java
@Component
public class BuildInfoContributor implements InfoContributor {

    @Override
    public void contribute(Info.Builder builder) {
        builder.withDetail("build", Map.of(
            "version", "1.2.3",
            "commitId", "abc123",
            "buildTime", Instant.now()
        ));
    }
}
```

`spring-boot-actuator`가 `META-INF/build-info.properties`를 자동으로 읽도록 Gradle 설정:

```kotlin
// build.gradle.kts
springBoot {
    buildInfo()  // build-info.properties 자동 생성
}
```
