---
title: "Spring Cloud Gateway: Predicate 팩토리 완전 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "predicate"]
---

# Spring Cloud Gateway: Predicate 팩토리 완전 가이드

## Predicate란?

**Predicate**는 HTTP 요청이 특정 라우트에 매칭되는지 판단하는 조건입니다. Java 8의 `java.util.function.Predicate<T>`와 동일한 개념으로, 조건이 `true`이면 해당 라우트가 선택됩니다.

Spring Cloud Gateway는 요청의 다양한 속성(경로, 메서드, 헤더, 쿠키, 파라미터, 시간, IP 등)을 기반으로 조건을 평가하는 **Predicate Factory**를 제공합니다. 여러 Predicate는 **AND 조건**으로 조합됩니다.

```
클라이언트 요청
    │
    ▼
RoutePredicateHandlerMapping
    │
    ├── Route 1: [Path=/api/orders/**, Method=GET] → AND → false (Method가 POST)
    ├── Route 2: [Path=/api/orders/**]              → true  ← 이 Route 선택
    └── Route 3: [Path=/**]                         → true  (이미 Route 2 선택됨)
```

---

## 빌트인 Predicate 팩토리

### Path — 경로 매칭

가장 많이 사용되는 Predicate. Ant 패턴(`**`, `*`, `?`)을 지원합니다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        # 단순 prefix 매칭
        - id: orders-route
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**

        # 경로 변수 포함
        - id: user-detail-route
          uri: lb://user-service
          predicates:
            - Path=/api/users/{id}

        # 여러 패턴
        - id: multi-path-route
          uri: lb://product-service
          predicates:
            - Path=/api/products/**, /api/catalog/**

        # 후행 슬래시 처리 (matchTrailingSlash=false 기본값은 true)
        - id: strict-path-route
          uri: lb://strict-service
          predicates:
            - name: Path
              args:
                patterns: /api/strict
                matchTrailingSlash: false
```

### Method — HTTP 메서드 매칭

```yaml
routes:
  - id: read-only-route
    uri: lb://catalog-service
    predicates:
      - Path=/api/catalog/**
      - Method=GET,HEAD

  - id: write-route
    uri: lb://catalog-service
    predicates:
      - Path=/api/catalog/**
      - Method=POST,PUT,PATCH,DELETE
```

### Host — 호스트 헤더 패턴

멀티 테넌트 아키텍처에서 도메인 기반 라우팅에 유용합니다.

```yaml
routes:
  # **.example.com → 메인 서비스
  - id: main-host-route
    uri: lb://main-service
    predicates:
      - Host=**.example.com

  # api.example.com → API 서비스
  - id: api-host-route
    uri: lb://api-service
    predicates:
      - Host=api.example.com,api2.example.com

  # {sub}.example.com → 서브도메인별 라우팅 (경로 변수 캡처)
  - id: tenant-route
    uri: lb://tenant-service
    predicates:
      - Host={tenant}.myapp.com
```

`Host` Predicate는 `{tenant}` 같은 캡처 그룹을 `ServerWebExchange`의 attribute에 저장하므로, 필터에서 `exchange.getAttribute(ServerWebExchangeUtils.URI_TEMPLATE_VARIABLES_ATTRIBUTE)`로 꺼낼 수 있습니다.

### Header — 헤더 매칭 (정규식 지원)

```yaml
routes:
  # X-Request-Id 헤더 존재 여부 확인
  - id: traced-route
    uri: lb://traced-service
    predicates:
      - Header=X-Request-Id

  # X-Api-Version: v2 패턴 매칭 (정규식)
  - id: v2-api-route
    uri: lb://v2-service
    predicates:
      - Header=X-Api-Version, v\d+

  # Authorization: Bearer ... 패턴
  - id: secured-route
    uri: lb://secured-service
    predicates:
      - Header=Authorization, Bearer .+
```

### Query — 쿼리 파라미터 매칭

```yaml
routes:
  # ?debug 파라미터 존재 여부
  - id: debug-route
    uri: lb://debug-service
    predicates:
      - Query=debug

  # ?color=green (정규식)
  - id: green-route
    uri: lb://green-service
    predicates:
      - Query=color, green

  # ?version=1 또는 ?version=2
  - id: versioned-route
    uri: lb://versioned-service
    predicates:
      - Query=version, [12]
```

### Cookie — 쿠키 매칭

```yaml
routes:
  # 쿠키 chocolate 값이 ch.p 패턴 (정규식)
  - id: cookie-route
    uri: lb://cookie-service
    predicates:
      - Cookie=chocolate, ch.p

  # 세션 쿠키 존재 여부
  - id: session-route
    uri: lb://session-service
    predicates:
      - Cookie=SESSION
```

### After / Before / Between — 시간 기반 매칭

배포 시간 제어, 이벤트 기간 한정 기능에 유용합니다. `ZonedDateTime` 형식을 사용합니다.

```yaml
routes:
  # 특정 날짜 이후에만 활성화 (신기능 출시일 제어)
  - id: new-feature-route
    uri: lb://new-feature-service
    predicates:
      - After=2026-04-01T00:00:00+09:00[Asia/Seoul]

  # 특정 날짜 이전에만 활성화 (레거시 API 종료 전)
  - id: legacy-route
    uri: lb://legacy-service
    predicates:
      - Before=2026-06-30T23:59:59+09:00[Asia/Seoul]

  # 이벤트 기간에만 활성화
  - id: event-route
    uri: lb://event-service
    predicates:
      - Between=2026-05-01T00:00:00+09:00[Asia/Seoul], 2026-05-31T23:59:59+09:00[Asia/Seoul]
```

ZonedDateTime 형식: `2026-04-01T00:00:00+09:00[Asia/Seoul]`

```java
// Java에서 ZonedDateTime 문자열 생성
ZonedDateTime launch = ZonedDateTime.of(2026, 4, 1, 0, 0, 0, 0, ZoneId.of("Asia/Seoul"));
System.out.println(launch); // 2026-04-01T00:00+09:00[Asia/Seoul]
```

### RemoteAddr — 클라이언트 IP/CIDR 매칭

```yaml
routes:
  # 특정 IP만 허용 (단일 IP)
  - id: office-only-route
    uri: lb://admin-service
    predicates:
      - RemoteAddr=203.0.113.1

  # 특정 서브넷 허용 (CIDR)
  - id: internal-route
    uri: lb://internal-service
    predicates:
      - RemoteAddr=192.168.1.0/24, 10.0.0.0/8
```

### XForwardedRemoteAddr — 프록시 뒤 실제 IP 매칭

로드 밸런서/프록시 뒤에서 `X-Forwarded-For` 헤더의 IP를 기준으로 매칭합니다.

```yaml
routes:
  - id: xff-route
    uri: lb://service
    predicates:
      - XForwardedRemoteAddr=192.168.1.0/24
```

> **실무 팁:** `RemoteAddr`는 게이트웨이에 직접 연결된 IP를 사용합니다. 로드 밸런서 뒤에 게이트웨이가 있다면 로드 밸런서의 IP만 보입니다. 이 경우 `XForwardedRemoteAddr`를 사용하고, 신뢰할 수 있는 프록시 IP만 허용하도록 설정해야 합니다.

### Weight — 가중치 기반 트래픽 분산 (카나리 배포)

`Weight` Predicate는 같은 그룹 내에서 가중치 비율로 트래픽을 분산합니다. 카나리 배포, A/B 테스트에 활용합니다.

```yaml
routes:
  # 그룹 "order-group"에서 90% 트래픽 → 안정 버전
  - id: order-stable
    uri: lb://order-service-v1
    predicates:
      - Path=/api/orders/**
      - Weight=order-group, 9

  # 그룹 "order-group"에서 10% 트래픽 → 카나리 버전
  - id: order-canary
    uri: lb://order-service-v2
    predicates:
      - Path=/api/orders/**
      - Weight=order-group, 1
```

위 설정에서 `/api/orders/**` 요청의 90%는 `order-service-v1`으로, 10%는 `order-service-v2`로 전달됩니다.

---

## 여러 Predicate 조합 (AND 조건)

같은 라우트에 여러 Predicate를 나열하면 모두 만족해야 라우트가 선택됩니다.

```yaml
routes:
  # GET /api/v2/orders/** + X-Api-Version: v2 헤더 + 2026년 이후 요청
  - id: v2-orders-route
    uri: lb://order-service-v2
    predicates:
      - Path=/api/v2/orders/**
      - Method=GET
      - Header=X-Api-Version, v2
      - After=2026-01-01T00:00:00+09:00[Asia/Seoul]
    order: 1

  # 기존 버전
  - id: v1-orders-route
    uri: lb://order-service-v1
    predicates:
      - Path=/api/orders/**
    order: 2
```

OR 조건이 필요한 경우, 별도 라우트를 두 개 만들어 동일한 `uri`를 지정합니다.

---

## 커스텀 Predicate 팩토리 구현

빌트인 Predicate로 표현할 수 없는 조건은 `AbstractRoutePredicateFactory`를 상속해 직접 구현합니다.

### 예: API Key 존재 여부 검증 Predicate

특정 헤더에 유효한 API Key가 있어야 라우트에 매칭되도록 합니다.

```java
// Java
@Component
public class ApiKeyRoutePredicateFactory
        extends AbstractRoutePredicateFactory<ApiKeyRoutePredicateFactory.Config> {

    public static final String HEADER_FIELD = "header";

    public ApiKeyRoutePredicateFactory() {
        super(Config.class);
    }

    // shortcutFieldOrder: YAML 단축 표기 시 파라미터 순서 정의
    // predicates:
    //   - ApiKey=X-Api-Key   ← 이 값이 Config.header에 매핑됨
    @Override
    public List<String> shortcutFieldOrder() {
        return List.of(HEADER_FIELD);
    }

    @Override
    public Predicate<ServerWebExchange> apply(Config config) {
        return exchange -> {
            String apiKey = exchange.getRequest()
                .getHeaders()
                .getFirst(config.getHeader());

            // API Key 유효성 검사 (실제로는 DB/Redis 조회)
            return isValidApiKey(apiKey);
        };
    }

    private boolean isValidApiKey(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            return false;
        }
        // 예시: 간단한 포맷 검증 (실제로는 외부 저장소 조회)
        return apiKey.startsWith("sk-") && apiKey.length() == 32;
    }

    // Config 내부 클래스: Predicate 설정을 담는 POJO
    @Getter
    @Setter
    public static class Config {
        private String header = "X-Api-Key"; // 기본값
    }
}
```

```kotlin
// Kotlin
@Component
class ApiKeyRoutePredicateFactory :
    AbstractRoutePredicateFactory<ApiKeyRoutePredicateFactory.Config>(Config::class.java) {

    companion object {
        const val HEADER_FIELD = "header"
    }

    override fun shortcutFieldOrder(): List<String> = listOf(HEADER_FIELD)

    override fun apply(config: Config): Predicate<ServerWebExchange> =
        Predicate { exchange ->
            val apiKey = exchange.request.headers.getFirst(config.header)
            isValidApiKey(apiKey)
        }

    private fun isValidApiKey(apiKey: String?): Boolean {
        if (apiKey.isNullOrBlank()) return false
        return apiKey.startsWith("sk-") && apiKey.length == 32
    }

    data class Config(
        var header: String = "X-Api-Key"
    )
}
```

### YAML에서 커스텀 Predicate 사용

```yaml
routes:
  # 단축 표기 (shortcutFieldOrder 정의 시 사용 가능)
  - id: api-key-route
    uri: lb://protected-service
    predicates:
      - Path=/api/protected/**
      - ApiKey=X-Api-Key

  # 완전 표기 (Config 필드를 명시적으로 지정)
  - id: api-key-route-verbose
    uri: lb://protected-service
    predicates:
      - Path=/api/protected/**
      - name: ApiKey
        args:
          header: X-Custom-Api-Key
```

빈 이름은 `ApiKeyRoutePredicateFactory`에서 접미사 `RoutePredicateFactory`를 제거한 `ApiKey`가 됩니다.

### 비동기 Predicate (ReactivePredicateFactory)

외부 서비스 조회가 필요한 경우, 비동기 Predicate를 구현할 수 있습니다.

```java
// Java — AsyncPredicate 반환
@Component
public class AsyncApiKeyRoutePredicateFactory
        extends AbstractRoutePredicateFactory<AsyncApiKeyRoutePredicateFactory.Config> {

    private final ApiKeyService apiKeyService; // WebClient 기반 서비스

    public AsyncApiKeyRoutePredicateFactory(ApiKeyService apiKeyService) {
        super(Config.class);
        this.apiKeyService = apiKeyService;
    }

    @Override
    public List<String> shortcutFieldOrder() {
        return List.of("header");
    }

    // apply() 대신 applyAsync()를 오버라이드
    @Override
    public AsyncPredicate<ServerWebExchange> applyAsync(Config config) {
        return exchange -> {
            String apiKey = exchange.getRequest()
                .getHeaders()
                .getFirst(config.getHeader());

            // Mono<Boolean> 반환 — 비동기 검증
            return apiKeyService.isValid(apiKey);
        };
    }

    @Override
    public Predicate<ServerWebExchange> apply(Config config) {
        throw new UnsupportedOperationException("Use applyAsync");
    }

    @Getter
    @Setter
    public static class Config {
        private String header = "X-Api-Key";
    }
}
```

> **실무 팁:** `applyAsync()`로 비동기 외부 조회를 Predicate에서 하면 모든 요청마다 외부 서비스를 호출하게 됩니다. 성능 영향을 최소화하려면 Caffeine 같은 로컬 캐시를 적용하거나, Predicate보다는 GlobalFilter에서 처리하는 것을 고려하세요.

---

## Predicate 디버깅

```yaml
logging:
  level:
    org.springframework.cloud.gateway.handler.predicate: TRACE
    org.springframework.cloud.gateway.handler: DEBUG
```

요청이 어떤 라우트에 매칭되는지 확인:

```
TRACE PathRoutePredicateFactory    : Pattern "/api/orders/**" matches against value "/api/orders/1"
DEBUG RoutePredicateHandlerMapping : Route matched: order-route
```

매칭 실패 시:

```
TRACE PathRoutePredicateFactory    : Pattern "/api/orders/**" does not match against value "/api/users/1"
TRACE RoutePredicateHandlerMapping : No routes found for [GET http://localhost:8080/api/users/1]
```
