---
title: "Spring Cloud Gateway: 실무 패턴 모음"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "patterns", "canary", "bff"]
---

# Spring Cloud Gateway: 실무 패턴 모음

실제 운영 환경에서 자주 마주치는 Gateway 설계 문제를 패턴별로 정리한다. 각 패턴에 대해 개념 설명, 구현 코드, 그리고 실무 적용 시 주의할 점을 함께 다룬다.

---

## 1. API 버전 관리 패턴

### 경로 기반 버전 관리

가장 단순하고 직관적인 방법이다. `/v1/**`, `/v2/**` 경로로 서로 다른 하위 서비스(또는 같은 서비스의 다른 엔드포인트)로 라우팅한다.

```yaml
# application.yml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service-v1
          uri: lb://user-service-v1
          predicates:
            - Path=/v1/users/**
          filters:
            - RewritePath=/v1/(?<segment>.*), /${segment}

        - id: user-service-v2
          uri: lb://user-service-v2
          predicates:
            - Path=/v2/users/**
          filters:
            - RewritePath=/v2/(?<segment>.*), /${segment}
```

`RewritePath` 필터가 핵심이다. `/v1/users/123`으로 들어온 요청을 하위 서비스에는 `/users/123`으로 전달해서, 하위 서비스가 버전 prefix를 신경 쓰지 않아도 되게 한다.

### 헤더 기반 버전 관리

경로를 변경하지 않고 `Accept-Version` 헤더로 버전을 결정하는 방식이다. 클라이언트 API가 안정적으로 유지되어야 할 때 유용하다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service-v2-header
          uri: lb://user-service-v2
          predicates:
            - Path=/api/users/**
            - Header=Accept-Version, v2
          filters:
            - RemoveRequestHeader=Accept-Version

        - id: user-service-v1-default
          uri: lb://user-service-v1
          predicates:
            - Path=/api/users/**
```

라우트 순서가 중요하다. `v2` 헤더를 가진 요청을 먼저 매칭하고, 헤더가 없는 요청은 기본 `v1` 라우트로 떨어진다. `RemoveRequestHeader` 필터로 하위 서비스에 버전 헤더가 전달되지 않도록 정리한다.

### 버전별 서비스 분리 vs 단일 서비스 처리

| 방식 | 장점 | 단점 |
|---|---|---|
| 버전별 서비스 인스턴스 분리 | 독립 배포, 독립 스케일링 | 운영 복잡도 증가 |
| 단일 서비스 내 버전 처리 | 운영 단순 | 서비스 코드 복잡도 증가 |

**실무 팁:** 초기에는 단일 서비스에서 버전을 처리하다가, 버전 간 코드 차이가 커지면 서비스를 분리하는 전략이 현실적이다.

---

## 2. JWT 검증 후 헤더 주입 패턴

Gateway에서 JWT를 검증하고, 하위 서비스가 토큰 파싱 없이 사용자 정보를 받을 수 있도록 헤더로 주입한다.

### 구현 코드

```java
// JwtAuthenticationFilter.java
@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider jwtTokenProvider;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String authHeader = request.getHeaders().getFirst(AUTHORIZATION_HEADER);

        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return onError(exchange, HttpStatus.UNAUTHORIZED, "Authorization 헤더가 없습니다.");
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        try {
            Claims claims = jwtTokenProvider.parseToken(token);
            String userId = claims.getSubject();
            String roles = String.join(",", claims.get("roles", List.class));

            ServerHttpRequest mutatedRequest = request.mutate()
                    .header("X-User-Id", userId)
                    .header("X-User-Roles", roles)
                    .header(AUTHORIZATION_HEADER, "") // 하위 서비스에 원본 토큰 제거 (선택)
                    .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());

        } catch (ExpiredJwtException e) {
            return onError(exchange, HttpStatus.UNAUTHORIZED, "토큰이 만료되었습니다.");
        } catch (JwtException e) {
            return onError(exchange, HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다.");
        }
    }

    private Mono<Void> onError(ServerWebExchange exchange, HttpStatus status, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String body = String.format("{\"error\": \"%s\"}", message);
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -100; // SecurityWebFilter보다 먼저 실행
    }
}
```

```java
// JwtTokenProvider.java
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secret;

    public Claims parseToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
```

### 하위 서비스에서 헤더 신뢰하는 패턴

```java
// 하위 서비스 (user-service) 컨트롤러
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getMyInfo(
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Roles") String roles) {

        // JWT 파싱 없이 바로 사용 가능
        return ResponseEntity.ok(userService.findById(Long.parseLong(userId)));
    }
}
```

**실무 팁:** 이 패턴은 **내부망(서비스 메시, VPC 내부) 전제**로 동작한다. 하위 서비스가 외부에서 직접 접근 가능한 경우, `X-User-Id` 헤더를 조작한 공격이 가능하므로 반드시 내부 트래픽만 허용하는 네트워크 정책과 함께 적용해야 한다.

---

## 3. API Key 인증 게이트웨이

### Header Predicate로 API Key 존재 확인

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: public-api
          uri: lb://public-api-service
          predicates:
            - Path=/public/api/**
            - Header=X-API-Key, .+   # API Key 헤더가 존재하고 비어있지 않아야 함
          filters:
            - ApiKeyAuthFilter
```

### GlobalFilter에서 API Key 검증

```java
// ApiKeyAuthFilter.java
@Component
public class ApiKeyAuthFilter implements GlobalFilter, Ordered {

    private final ApiKeyRepository apiKeyRepository;
    private final RateLimiterService rateLimiterService;

    public ApiKeyAuthFilter(ApiKeyRepository apiKeyRepository,
                            RateLimiterService rateLimiterService) {
        this.apiKeyRepository = apiKeyRepository;
        this.rateLimiterService = rateLimiterService;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String apiKey = exchange.getRequest().getHeaders().getFirst("X-API-Key");

        if (apiKey == null || apiKey.isBlank()) {
            return onError(exchange, HttpStatus.UNAUTHORIZED, "API Key가 필요합니다.");
        }

        return apiKeyRepository.findByKey(apiKey)
                .switchIfEmpty(Mono.error(new UnauthorizedException("유효하지 않은 API Key입니다.")))
                .flatMap(apiKeyInfo -> {
                    // API Key → 서비스 플랜 매핑
                    ServicePlan plan = apiKeyInfo.getServicePlan();

                    // Rate Limit 확인
                    return rateLimiterService.isAllowed(apiKey, plan.getRateLimit())
                            .flatMap(allowed -> {
                                if (!allowed) {
                                    return onError(exchange, HttpStatus.TOO_MANY_REQUESTS,
                                            "요청 한도를 초과했습니다.");
                                }

                                // 하위 서비스에 플랜 정보 주입
                                ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                                        .header("X-Service-Plan", plan.getName())
                                        .header("X-Client-Id", apiKeyInfo.getClientId())
                                        .build();

                                return chain.filter(
                                        exchange.mutate().request(mutatedRequest).build());
                            });
                })
                .onErrorResume(UnauthorizedException.class,
                        e -> onError(exchange, HttpStatus.UNAUTHORIZED, e.getMessage()));
    }

    private Mono<Void> onError(ServerWebExchange exchange, HttpStatus status, String message) {
        exchange.getResponse().setStatusCode(status);
        byte[] bytes = ("{\"error\": \"" + message + "\"}").getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(bytes);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -50;
    }
}
```

**실무 팁:** API Key를 Redis에 캐싱하면 매 요청마다 DB를 조회하지 않아도 된다. TTL을 5분 정도로 설정하면 Key 폐기 시 최대 5분의 지연이 발생하지만 성능과 트레이드오프를 맞출 수 있다.

---

## 4. 카나리(Canary) 배포 패턴

### Weight Predicate 활용

```yaml
# application.yml
spring:
  cloud:
    gateway:
      routes:
        - id: order-service-stable
          uri: lb://order-service-v1
          predicates:
            - Path=/api/orders/**
            - Weight=order-group, 90     # 90% 트래픽
          filters:
            - RewritePath=/api/orders/(?<segment>.*), /orders/${segment}

        - id: order-service-canary
          uri: lb://order-service-v2
          predicates:
            - Path=/api/orders/**
            - Weight=order-group, 10     # 10% 트래픽 (카나리)
          filters:
            - RewritePath=/api/orders/(?<segment>.*), /orders/${segment}
            - AddResponseHeader=X-Canary, true
```

`Weight` Predicate는 같은 그룹 이름(`order-group`)을 가진 라우트들 사이에서 가중치 비율로 트래픽을 분배한다. 내부적으로 `ThreadLocalRandom`을 사용하므로 정확히 90/10이 아닐 수 있지만, 통계적으로 근사한다.

### 점진적 트래픽 이동

카나리 검증이 완료되면 Actuator API로 동적으로 가중치를 변경한다.

```bash
# 카나리 비율을 50%로 증가
curl -X POST http://gateway:8080/actuator/gateway/routes/order-service-stable \
  -H "Content-Type: application/json" \
  -d '{
    "id": "order-service-stable",
    "uri": "lb://order-service-v1",
    "predicates": [
      {"name": "Path", "args": {"pattern": "/api/orders/**"}},
      {"name": "Weight", "args": {"group": "order-group", "weight": "50"}}
    ]
  }'

# 변경 사항 적용
curl -X POST http://gateway:8080/actuator/gateway/refresh
```

### 헤더로 특정 사용자만 카나리로 보내기

베타 테스터나 내부 직원만 카나리 버전을 사용하게 하는 패턴이다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: order-service-canary-beta
          uri: lb://order-service-v2
          predicates:
            - Path=/api/orders/**
            - Header=X-Beta-User, true   # 베타 사용자만
          filters:
            - RewritePath=/api/orders/(?<segment>.*), /orders/${segment}

        - id: order-service-stable
          uri: lb://order-service-v1
          predicates:
            - Path=/api/orders/**
          filters:
            - RewritePath=/api/orders/(?<segment>.*), /orders/${segment}
```

JWT 검증 필터에서 베타 사용자 여부를 확인하고 `X-Beta-User: true` 헤더를 주입하면 된다.

**실무 팁:** 카나리 배포 시 응답에 `X-Canary: true` 헤더를 추가해두면, 모니터링 도구(Datadog, Grafana)에서 카나리 트래픽만 필터링해서 오류율과 레이턴시를 비교하기 쉽다.

---

## 5. 블루/그린 배포 패턴

### 동적 라우트 갱신으로 블루→그린 전환

블루/그린 배포는 두 개의 동일한 환경(블루=현재, 그린=새 버전)을 유지하고, 검증 후 트래픽을 한 번에 전환하는 방식이다.

```yaml
# 초기 상태: 블루로 라우팅
spring:
  cloud:
    gateway:
      routes:
        - id: main-service
          uri: lb://main-service-blue
          predicates:
            - Path=/api/**
```

### Actuator API로 라우트 교체

```bash
# 1. 그린 서비스 배포 후 상태 확인
curl http://green-service/actuator/health

# 2. Gateway 라우트를 그린으로 전환
curl -X POST http://gateway:8080/actuator/gateway/routes/main-service \
  -H "Content-Type: application/json" \
  -d '{
    "id": "main-service",
    "uri": "lb://main-service-green",
    "predicates": [
      {"name": "Path", "args": {"pattern": "/api/**"}}
    ],
    "filters": []
  }'

# 3. 라우트 갱신 적용
curl -X POST http://gateway:8080/actuator/gateway/refresh

# 4. 현재 라우트 상태 확인
curl http://gateway:8080/actuator/gateway/routes
```

### 롤백 방법

```bash
# 문제 발생 시 블루로 즉시 롤백
curl -X POST http://gateway:8080/actuator/gateway/routes/main-service \
  -H "Content-Type: application/json" \
  -d '{
    "id": "main-service",
    "uri": "lb://main-service-blue",
    "predicates": [
      {"name": "Path", "args": {"pattern": "/api/**"}}
    ]
  }'

curl -X POST http://gateway:8080/actuator/gateway/refresh
```

**실무 팁:** Actuator 엔드포인트는 반드시 인증으로 보호해야 한다. `spring.security.user.name/password`로 기본 인증을 설정하거나, Spring Security로 `/actuator/**` 경로를 관리자 역할로 제한한다.

---

## 6. BFF (Backend for Frontend) 패턴

클라이언트 종류(모바일, 웹)에 따라 다른 하위 서비스로 라우팅하거나, 같은 서비스의 다른 엔드포인트로 연결한다.

### User-Agent 기반 분기

```yaml
spring:
  cloud:
    gateway:
      routes:
        # 모바일 앱 트래픽 → 경량 응답 서비스
        - id: bff-mobile
          uri: lb://product-service
          predicates:
            - Path=/api/products/**
            - Header=User-Agent, .*(iPhone|Android|Mobile).*
          filters:
            - AddRequestHeader=X-Client-Type, mobile
            - RewritePath=/api/products/(?<segment>.*), /mobile/products/${segment}

        # 웹 브라우저 트래픽 → 풍부한 데이터 서비스
        - id: bff-web
          uri: lb://product-service
          predicates:
            - Path=/api/products/**
          filters:
            - AddRequestHeader=X-Client-Type, web
            - RewritePath=/api/products/(?<segment>.*), /web/products/${segment}
```

### 커스텀 헤더 기반 분기

User-Agent 파싱은 신뢰성이 낮다. 클라이언트가 명시적으로 `X-Client-Type` 헤더를 보내는 방식이 더 안정적이다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: bff-mobile-explicit
          uri: lb://product-service
          predicates:
            - Path=/api/products/**
            - Header=X-Client-Type, mobile
          filters:
            - RewritePath=/api/products/(?<segment>.*), /mobile/products/${segment}
            - AddResponseHeader=Vary, X-Client-Type

        - id: bff-web-explicit
          uri: lb://product-service
          predicates:
            - Path=/api/products/**
            - Header=X-Client-Type, web
          filters:
            - RewritePath=/api/products/(?<segment>.*), /web/products/${segment}
```

**실무 팁:** 응답에 `Vary: X-Client-Type` 헤더를 추가하면 CDN이나 프록시 캐시가 클라이언트 타입별로 응답을 별도로 캐싱하도록 지시할 수 있다.

---

## 7. 요청 로깅 & 감사 GlobalFilter

### 전체 구현 코드

```java
// AuditLoggingFilter.java
@Component
@Slf4j
public class AuditLoggingFilter implements GlobalFilter, Ordered {

    private static final Set<String> SENSITIVE_HEADERS = Set.of(
            "authorization", "x-api-key", "cookie", "set-cookie"
    );

    private final AuditLogRepository auditLogRepository;

    public AuditLoggingFilter(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        long startTime = System.currentTimeMillis();
        ServerHttpRequest request = exchange.getRequest();

        String requestId = UUID.randomUUID().toString();
        String clientIp = getClientIp(request);
        String method = request.getMethod().name();
        String path = request.getURI().getPath();
        String query = request.getURI().getQuery();
        Map<String, String> safeHeaders = maskSensitiveHeaders(request.getHeaders());

        // 요청 로그 (즉시)
        log.info("[{}] --> {} {}{} ip={} headers={}",
                requestId, method, path,
                query != null ? "?" + query : "",
                clientIp, safeHeaders);

        return chain.filter(exchange)
                .doFinally(signalType -> {
                    long duration = System.currentTimeMillis() - startTime;
                    int statusCode = exchange.getResponse().getStatusCode() != null
                            ? exchange.getResponse().getStatusCode().value()
                            : 0;

                    // 응답 로그
                    log.info("[{}] <-- {} {} {}ms",
                            requestId, method, statusCode, duration);

                    // 비동기 감사 로그 저장 (메인 흐름을 블로킹하지 않음)
                    AuditLog auditLog = AuditLog.builder()
                            .requestId(requestId)
                            .clientIp(clientIp)
                            .method(method)
                            .path(path)
                            .statusCode(statusCode)
                            .durationMs(duration)
                            .userId(exchange.getRequest().getHeaders().getFirst("X-User-Id"))
                            .timestamp(Instant.now())
                            .build();

                    auditLogRepository.save(auditLog)
                            .subscribeOn(Schedulers.boundedElastic())
                            .subscribe(
                                null,
                                err -> log.error("감사 로그 저장 실패: {}", err.getMessage())
                            );
                });
    }

    private String getClientIp(ServerHttpRequest request) {
        String forwarded = request.getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeaders().getFirst("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp;
        }
        InetSocketAddress remoteAddress = request.getRemoteAddress();
        return remoteAddress != null ? remoteAddress.getAddress().getHostAddress() : "unknown";
    }

    private Map<String, String> maskSensitiveHeaders(HttpHeaders headers) {
        Map<String, String> result = new LinkedHashMap<>();
        headers.forEach((name, values) -> {
            String lower = name.toLowerCase();
            if (SENSITIVE_HEADERS.contains(lower)) {
                result.put(name, "***MASKED***");
            } else {
                result.put(name, String.join(", ", values));
            }
        });
        return result;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE; // 가장 먼저 실행, 가장 나중에 완료
    }
}
```

**실무 팁:** `doFinally`는 정상 완료, 에러, 취소 모두에서 실행된다. `doOnSuccess` / `doOnError`를 별도로 구현하는 것보다 `doFinally`로 한 번에 처리하는 것이 누락 없이 로그를 남길 수 있다.

---

## 8. Multi-tenancy 패턴

### 도메인 기반 테넌트 식별

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: tenant-alpha
          uri: lb://app-service
          predicates:
            - Host=alpha.example.com
          filters:
            - AddRequestHeader=X-Tenant-Id, alpha

        - id: tenant-beta
          uri: lb://app-service
          predicates:
            - Host=beta.example.com
          filters:
            - AddRequestHeader=X-Tenant-Id, beta
```

### 헤더 기반 테넌트 식별

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: multi-tenant-api
          uri: lb://app-service
          predicates:
            - Path=/api/**
            - Header=X-Tenant-Id, .+
```

### 테넌트별 Rate Limit KeyResolver

```java
// TenantAwareKeyResolver.java
@Bean
public KeyResolver tenantUserKeyResolver() {
    return exchange -> {
        String tenantId = exchange.getRequest().getHeaders().getFirst("X-Tenant-Id");
        String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");

        if (tenantId == null || userId == null) {
            // 인증되지 않은 요청은 IP 기반으로 제한
            InetSocketAddress addr = exchange.getRequest().getRemoteAddress();
            String ip = addr != null ? addr.getAddress().getHostAddress() : "unknown";
            return Mono.just("anonymous:" + ip);
        }

        // 테넌트 + 사용자 조합으로 제한 (테넌트 간 격리 + 사용자별 제한)
        return Mono.just(tenantId + ":" + userId);
    };
}
```

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: multi-tenant-api
          uri: lb://app-service
          predicates:
            - Path=/api/**
          filters:
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 100
                redis-rate-limiter.burstCapacity: 200
                key-resolver: "#{@tenantUserKeyResolver}"
```

### 테넌트별 동적 라우트 생성 개념

테넌트 수가 많거나 동적으로 증가한다면 `RouteDefinitionRepository`를 구현해서 DB에서 라우트를 로드할 수 있다.

```java
// DbRouteDefinitionRepository.java
@Component
public class DbRouteDefinitionRepository implements RouteDefinitionRepository {

    private final TenantRouteRepository tenantRouteRepository;

    @Override
    public Flux<RouteDefinition> getRouteDefinitions() {
        return tenantRouteRepository.findAll()
                .map(this::toRouteDefinition);
    }

    private RouteDefinition toRouteDefinition(TenantRoute tenantRoute) {
        RouteDefinition def = new RouteDefinition();
        def.setId("tenant-" + tenantRoute.getTenantId());
        def.setUri(URI.create("lb://" + tenantRoute.getServiceName()));

        PredicateDefinition hostPredicate = new PredicateDefinition();
        hostPredicate.setName("Host");
        hostPredicate.addArg("pattern", tenantRoute.getHostPattern());
        def.setPredicates(List.of(hostPredicate));

        FilterDefinition addHeader = new FilterDefinition();
        addHeader.setName("AddRequestHeader");
        addHeader.addArg("name", "X-Tenant-Id");
        addHeader.addArg("value", tenantRoute.getTenantId());
        def.setFilters(List.of(addHeader));

        return def;
    }

    // save, delete는 관리 API에서 사용
    @Override
    public Mono<Void> save(Mono<RouteDefinition> route) {
        return route.flatMap(r -> tenantRouteRepository.save(fromRouteDefinition(r)).then());
    }

    @Override
    public Mono<Void> delete(Mono<String> routeId) {
        return routeId.flatMap(tenantRouteRepository::deleteById);
    }
}
```

**실무 팁:** 테넌트별 라우트를 DB에 저장하면 재시작 없이 새 테넌트를 추가할 수 있다. 단, DB 조회 성능을 위해 Caffeine 같은 로컬 캐시를 앞단에 두고, 테넌트 추가/수정 시 `ApplicationEventPublisher`로 `RefreshRoutesEvent`를 발행해서 캐시를 갱신하는 패턴을 함께 적용하는 것이 좋다.
