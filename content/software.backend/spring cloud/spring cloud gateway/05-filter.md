---
title: "Spring Cloud Gateway: Filter 완전 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "filter", "globalfilter"]
---

# Spring Cloud Gateway: Filter 완전 가이드

## Filter 두 종류

Spring Cloud Gateway의 Filter는 적용 범위에 따라 두 가지로 나뉩니다.

| 종류 | 적용 범위 | 구현 인터페이스 | 정의 방식 |
|------|----------|----------------|-----------|
| **GatewayFilter** | 특정 라우트에만 적용 | `GatewayFilter` | 라우트의 `filters` 항목에 선언 |
| **GlobalFilter** | 모든 라우트에 자동 적용 | `GlobalFilter` | `@Bean`으로 등록 |

---

## Pre 필터 vs Post 필터

```
요청 흐름:
클라이언트 → [Pre 필터 실행] → 하위 서비스 → [Post 필터 실행] → 클라이언트

코드 구조:
public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
    // ← 여기가 Pre 처리 (요청 가공)
    log.info("Pre: 요청 처리");
    modifyRequest(exchange);

    return chain.filter(exchange)  // 하위 서비스 호출
        .then(Mono.fromRunnable(() -> {
            // ← 여기가 Post 처리 (응답 가공)
            log.info("Post: 응답 처리");
        }));
}
```

Post 필터는 `chain.filter(exchange)` 이후에 실행되며, **Pre 필터와 반대 순서**로 실행됩니다.

```
Filter 순서: A(order=1) → B(order=2) → C(order=3)

Pre:  A → B → C → [하위 서비스]
Post: [하위 서비스] → C → B → A
```

---

## 빌트인 GatewayFilter 팩토리

### 요청 헤더 조작

```yaml
routes:
  - id: header-manipulation-route
    uri: lb://user-service
    predicates:
      - Path=/api/users/**
    filters:
      # 헤더 추가 (기존 동일 헤더가 있으면 추가)
      - AddRequestHeader=X-Gateway-Source, api-gateway
      - AddRequestHeader=X-Request-Time, #{T(java.time.Instant).now().toString()}

      # 헤더 덮어쓰기 (기존 값 교체)
      - SetRequestHeader=X-App-Name, my-gateway

      # 헤더 제거
      - RemoveRequestHeader=X-Internal-Token
      - RemoveRequestHeader=Cookie
```

### 응답 헤더 조작

```yaml
    filters:
      # 응답에 헤더 추가
      - AddResponseHeader=X-Powered-By, Spring-Cloud-Gateway
      - AddResponseHeader=Cache-Control, no-cache, no-store

      # 응답 헤더 덮어쓰기
      - SetResponseHeader=X-Response-Version, v2

      # 응답 헤더 제거
      - RemoveResponseHeader=X-Internal-Trace
```

### MapRequestHeader — 헤더 값 복사 및 변환

다운스트림에서 올라온 헤더를 다른 이름으로 복사합니다.

```yaml
    filters:
      # X-Request-Red 헤더 값을 X-Request-Blue로 복사
      - MapRequestHeader=X-Request-Red, X-Request-Blue
```

### DedupeResponseHeader — 중복 헤더 제거

CORS 설정 시 Gateway와 하위 서비스가 모두 `Access-Control-Allow-Origin`을 추가하면 중복 문제가 발생합니다.

```yaml
    filters:
      # RETAIN_FIRST: 첫 번째 값만 유지 (기본값)
      # RETAIN_LAST: 마지막 값만 유지
      # RETAIN_UNIQUE: 중복 제거 후 유니크한 값만 유지
      - DedupeResponseHeader=Access-Control-Allow-Origin Access-Control-Allow-Credentials, RETAIN_FIRST
```

---

### 경로 조작

### RewritePath — 정규식 경로 재작성

```yaml
    filters:
      # /red/users/1 → /users/1
      - RewritePath=/red(?<segment>/?.*), ${segment}

      # /api/v1/orders → /orders
      - RewritePath=/api/v1(?<segment>/?.*), ${segment}

      # /shop/products/123 → /products?id=123 (쿼리 파라미터로 변환)
      - RewritePath=/shop/products/(?<id>.*), /products?id=${id}
```

### StripPrefix — 앞 경로 세그먼트 제거

```yaml
    filters:
      # /api/v1/users/1 → /users/1 (앞의 2개 세그먼트 제거)
      - StripPrefix=2

      # /api/orders → /orders (앞의 1개 세그먼트 제거)
      - StripPrefix=1
```

### PrefixPath — 경로 앞에 prefix 추가

```yaml
    filters:
      # /users/1 → /api/users/1
      - PrefixPath=/api
```

### SetPath — 경로 고정 (URI 템플릿 변수 활용)

```yaml
routes:
  - id: set-path-route
    uri: lb://service
    predicates:
      - Path=/api/{segment}
    filters:
      # /api/orders → /service/orders
      - SetPath=/service/{segment}
```

---

### 상태 및 리다이렉트

### SetStatus — 응답 상태 코드 강제 설정

```yaml
    filters:
      # 항상 401 반환 (인증 실패 처리)
      - SetStatus=401

      # HTTP 상태명도 사용 가능
      - SetStatus=UNAUTHORIZED
```

### RedirectTo — HTTP 리다이렉트

```yaml
    filters:
      # 302 임시 리다이렉트
      - RedirectTo=302, https://example.com

      # 301 영구 리다이렉트
      - RedirectTo=301, https://new-domain.com

      # includeRequestParams=true: 원래 쿼리 파라미터 유지
      - name: RedirectTo
        args:
          status: 302
          url: https://example.com
          includeRequestParams: true
```

---

### 요청 크기 제한

### RequestSize

```yaml
    filters:
      # 요청 바디 크기를 5MB로 제한
      - RequestSize=5MB

      # 단위: KB, MB, GB, B(bytes)
      - name: RequestSize
        args:
          maxSize: 5000000  # bytes
```

크기 초과 시 `413 Payload Too Large`를 반환합니다.

---

### 재시도

### Retry — 실패 시 재시도

```yaml
    filters:
      - name: Retry
        args:
          retries: 3              # 최대 재시도 횟수
          statuses: BAD_GATEWAY, SERVICE_UNAVAILABLE  # 재시도할 HTTP 상태코드
          methods: GET, HEAD      # 재시도할 HTTP 메서드 (기본: GET)
          series: SERVER_ERROR    # 재시도할 상태 계열 (5xx)
          backoff:
            firstBackoff: 50ms    # 첫 재시도 대기 시간
            maxBackoff: 500ms     # 최대 대기 시간
            factor: 2             # 지수 백오프 계수 (50ms → 100ms → 200ms → ...)
            basedOnPreviousValue: false
```

> **실무 팁:** `POST`, `PUT`은 멱등성(idempotency)이 보장되지 않으므로 재시도 메서드에 포함하지 않는 것이 원칙입니다. 결제, 주문 등 상태를 변경하는 요청의 재시도는 중복 처리 위험이 있습니다.

---

### 보안 헤더

### SecureHeaders — 보안 응답 헤더 자동 추가

```yaml
    filters:
      # 다음 헤더들을 자동으로 응답에 추가
      - SecureHeaders
```

추가되는 헤더들:

| 헤더 | 기본값 |
|------|--------|
| `X-Xss-Protection` | `1 ; mode=block` |
| `Strict-Transport-Security` | `max-age=631138519` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Content-Security-Policy` | `(복합 정책)` |
| `X-Download-Options` | `noopen` |
| `X-Permitted-Cross-Domain-Policies` | `none` |

```yaml
# 특정 헤더 비활성화
spring:
  cloud:
    gateway:
      filter:
        secure-headers:
          disable:
            - x-frame-options  # iframe 허용이 필요한 경우
```

---

### 세션 및 인증 관련

```yaml
    filters:
      # WebSession을 강제로 저장 (Spring Session 연동 시)
      - SaveSession

      # OAuth2 Access Token을 하위 서비스에 그대로 전달
      - TokenRelay

      # 게이트웨이가 아닌 원본 Host 헤더를 하위 서비스에 전달
      - PreserveHostHeader
```

---

## GlobalFilter 구현

`GlobalFilter`는 모든 라우트에 자동으로 적용됩니다. `Ordered` 인터페이스로 실행 순서를 제어합니다.

### 요청 처리 시간 로깅 GlobalFilter

```java
// Java
@Component
public class RequestTimingGlobalFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(RequestTimingGlobalFilter.class);
    private static final String START_TIME_ATTR = "startTime";

    @Override
    public int getOrder() {
        // 낮은 값이 먼저 실행. NettyRoutingFilter보다 먼저 실행되어야 함
        // NettyRoutingFilter의 order = Integer.MAX_VALUE
        return -1;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        // Pre 처리: 요청 시작 시간 기록
        exchange.getAttributes().put(START_TIME_ATTR, System.currentTimeMillis());

        ServerHttpRequest request = exchange.getRequest();
        log.info("[Pre] {} {} from {}",
            request.getMethod(),
            request.getURI(),
            request.getRemoteAddress()
        );

        return chain.filter(exchange)
            .then(Mono.fromRunnable(() -> {
                // Post 처리: 응답 후 처리 시간 계산
                Long startTime = exchange.getAttribute(START_TIME_ATTR);
                if (startTime != null) {
                    long duration = System.currentTimeMillis() - startTime;
                    int statusCode = exchange.getResponse().getStatusCode() != null
                        ? exchange.getResponse().getStatusCode().value()
                        : -1;

                    log.info("[Post] {} {} → {} ({}ms)",
                        request.getMethod(),
                        request.getURI().getPath(),
                        statusCode,
                        duration
                    );
                }
            }));
    }
}
```

```kotlin
// Kotlin
@Component
class RequestTimingGlobalFilter : GlobalFilter, Ordered {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        private const val START_TIME_ATTR = "startTime"
    }

    override fun getOrder(): Int = -1

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        exchange.attributes[START_TIME_ATTR] = System.currentTimeMillis()

        val request = exchange.request
        log.info("[Pre] {} {} from {}", request.method, request.uri, request.remoteAddress)

        return chain.filter(exchange)
            .then(Mono.fromRunnable<Unit> {
                val startTime = exchange.getAttribute<Long>(START_TIME_ATTR) ?: return@fromRunnable
                val duration = System.currentTimeMillis() - startTime
                val statusCode = exchange.response.statusCode?.value() ?: -1

                log.info("[Post] {} {} → {} ({}ms)",
                    request.method,
                    request.uri.path,
                    statusCode,
                    duration
                )
            }.cast(Void::class.java))
    }
}
```

---

## 커스텀 GatewayFilter 팩토리 구현

### 예: Correlation-ID 헤더 자동 주입

요청에 `X-Correlation-Id` 헤더가 없으면 UUID를 생성해 주입하고, 응답에도 동일한 값을 추가합니다.

```java
// Java
@Component
public class CorrelationIdGatewayFilterFactory
        extends AbstractGatewayFilterFactory<CorrelationIdGatewayFilterFactory.Config> {

    private static final Logger log = LoggerFactory.getLogger(CorrelationIdGatewayFilterFactory.class);
    private static final String CORRELATION_ID_HEADER = "X-Correlation-Id";

    public CorrelationIdGatewayFilterFactory() {
        super(Config.class);
    }

    @Override
    public List<String> shortcutFieldOrder() {
        return List.of("headerName");
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            String headerName = config.getHeaderName();

            // Pre: Correlation-Id가 없으면 생성
            String correlationId = exchange.getRequest()
                .getHeaders()
                .getFirst(headerName);

            if (correlationId == null || correlationId.isBlank()) {
                correlationId = UUID.randomUUID().toString();
                log.debug("Generated correlationId: {}", correlationId);
            }

            final String finalCorrelationId = correlationId;

            // 요청 헤더에 추가 (ServerHttpRequest는 불변이므로 mutate() 사용)
            ServerWebExchange mutatedExchange = exchange.mutate()
                .request(exchange.getRequest().mutate()
                    .header(headerName, finalCorrelationId)
                    .build())
                .build();

            return chain.filter(mutatedExchange)
                .then(Mono.fromRunnable(() -> {
                    // Post: 응답에도 Correlation-Id 추가
                    mutatedExchange.getResponse()
                        .getHeaders()
                        .set(headerName, finalCorrelationId);
                }));
        };
    }

    @Getter
    @Setter
    public static class Config {
        private String headerName = CORRELATION_ID_HEADER;
    }
}
```

```kotlin
// Kotlin
@Component
class CorrelationIdGatewayFilterFactory :
    AbstractGatewayFilterFactory<CorrelationIdGatewayFilterFactory.Config>(Config::class.java) {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        private const val CORRELATION_ID_HEADER = "X-Correlation-Id"
    }

    override fun shortcutFieldOrder(): List<String> = listOf("headerName")

    override fun apply(config: Config): GatewayFilter =
        GatewayFilter { exchange, chain ->
            val headerName = config.headerName

            val correlationId = exchange.request.headers.getFirst(headerName)
                ?.takeIf { it.isNotBlank() }
                ?: UUID.randomUUID().toString().also {
                    log.debug("Generated correlationId: {}", it)
                }

            val mutatedExchange = exchange.mutate()
                .request(exchange.request.mutate().header(headerName, correlationId).build())
                .build()

            chain.filter(mutatedExchange)
                .then(Mono.fromRunnable<Unit> {
                    mutatedExchange.response.headers[headerName] = correlationId
                }.cast(Void::class.java))
        }

    data class Config(
        var headerName: String = CORRELATION_ID_HEADER
    )
}
```

### YAML에서 커스텀 Filter 사용

```yaml
routes:
  - id: order-route
    uri: lb://order-service
    predicates:
      - Path=/api/orders/**
    filters:
      # 단축 표기 (shortcutFieldOrder 사용)
      - CorrelationId=X-Correlation-Id

      # 완전 표기
      - name: CorrelationId
        args:
          headerName: X-Correlation-Id
```

---

## 필터 실행 순서 (Ordered)

필터는 `Ordered` 인터페이스 또는 `@Order` 어노테이션으로 실행 순서를 제어합니다.

```java
// GlobalFilter 순서 제어
@Component
@Order(-2)  // @Order 사용
public class AuthGlobalFilter implements GlobalFilter {
    // ...
}

// 또는 Ordered 인터페이스 구현
@Component
public class LoggingGlobalFilter implements GlobalFilter, Ordered {

    @Override
    public int getOrder() {
        return -1;  // 낮을수록 먼저 실행
    }
}
```

빌트인 GlobalFilter의 실행 순서:

| 필터 | Order | 역할 |
|------|-------|------|
| `GatewayMetricsFilter` | `Integer.MIN_VALUE + 1000` | 메트릭 수집 |
| `RouteToRequestUrlFilter` | 10000 | lb:// → 실제 URL 변환 |
| `ReactiveLoadBalancerClientFilter` | 10150 | 로드 밸런싱 |
| `WebsocketRoutingFilter` | `Integer.MAX_VALUE - 1` | WebSocket 라우팅 |
| `NettyRoutingFilter` | `Integer.MAX_VALUE` | 실제 HTTP 요청 전송 |
| `NettyWriteResponseFilter` | `-1` | 응답 쓰기 |

> **실무 팁:** 인증 필터는 `NettyRoutingFilter`(실제 요청 전송)보다 먼저 실행되어야 합니다. `order` 값을 `1`이나 `-1`처럼 양수/음수 영역에 설정하면 대부분의 빌트인 필터보다 먼저 실행됩니다.

---

## ServerWebExchange — 요청/응답 조작

```java
// 요청 헤더 수정 (불변 객체이므로 mutate() 필요)
ServerWebExchange modified = exchange.mutate()
    .request(r -> r
        .header("X-Custom-Header", "value")
        .header("Authorization", null)  // 헤더 제거
    )
    .build();

// 응답 헤더 수정 (응답은 mutable)
exchange.getResponse().getHeaders().set("X-Custom-Response", "value");

// 요청 속성 저장 (다른 필터에서 공유)
exchange.getAttributes().put("userId", "12345");

// 요청 속성 읽기
String userId = exchange.getAttribute("userId");

// 라우트 정보 가져오기
Route route = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR);
log.info("Matched route: {}", route.getId());
```

---

## 실무 패턴: JWT 검증 후 사용자 정보 주입

```java
// Java
@Component
public class JwtAuthGlobalFilter implements GlobalFilter, Ordered {

    private final JwtTokenProvider jwtTokenProvider;

    public JwtAuthGlobalFilter(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public int getOrder() {
        return -1; // 라우팅보다 먼저 실행
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String token = extractToken(exchange.getRequest());

        if (token == null) {
            return chain.filter(exchange); // 토큰 없으면 그냥 통과 (인가는 각 서비스에서)
        }

        try {
            Claims claims = jwtTokenProvider.parseToken(token);
            String userId = claims.getSubject();
            String roles = String.join(",", claims.get("roles", List.class));

            // 하위 서비스에 사용자 정보 헤더로 전달
            ServerWebExchange mutated = exchange.mutate()
                .request(exchange.getRequest().mutate()
                    .header("X-User-Id", userId)
                    .header("X-User-Roles", roles)
                    .build())
                .build();

            return chain.filter(mutated);

        } catch (JwtException e) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
    }

    private String extractToken(ServerHttpRequest request) {
        String auth = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7);
        }
        return null;
    }
}
```

```kotlin
// Kotlin
@Component
class JwtAuthGlobalFilter(
    private val jwtTokenProvider: JwtTokenProvider
) : GlobalFilter, Ordered {

    override fun getOrder(): Int = -1

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val token = extractToken(exchange.request)
            ?: return chain.filter(exchange)

        return try {
            val claims = jwtTokenProvider.parseToken(token)
            val userId = claims.subject
            val roles = claims.get("roles", List::class.java).joinToString(",")

            val mutated = exchange.mutate()
                .request(exchange.request.mutate()
                    .header("X-User-Id", userId)
                    .header("X-User-Roles", roles)
                    .build())
                .build()

            chain.filter(mutated)
        } catch (e: JwtException) {
            exchange.response.statusCode = HttpStatus.UNAUTHORIZED
            exchange.response.setComplete()
        }
    }

    private fun extractToken(request: ServerHttpRequest): String? =
        request.headers.getFirst(HttpHeaders.AUTHORIZATION)
            ?.takeIf { it.startsWith("Bearer ") }
            ?.substring(7)
}
```

이 패턴에서 게이트웨이는 JWT를 검증하고 사용자 정보를 헤더로 변환합니다. 하위 마이크로서비스는 JWT 검증 로직 없이 `X-User-Id`, `X-User-Roles` 헤더만 읽어 인가 처리를 할 수 있습니다.
