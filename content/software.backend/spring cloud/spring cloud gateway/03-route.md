---
title: "Spring Cloud Gateway: Route 완전 정복"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "route"]
---

# Spring Cloud Gateway: Route 완전 정복

## Route의 4요소

Route는 Spring Cloud Gateway의 라우팅 단위입니다. 다음 4가지 핵심 요소로 구성됩니다.

| 요소 | 타입 | 설명 |
|------|------|------|
| `id` | String | 라우트 식별자. 유일해야 함. 로그/Actuator에서 참조에 사용 |
| `uri` | URI | 요청을 전달할 목적지. `http://`, `https://`, `lb://` 지원 |
| `predicates` | List<Predicate> | 요청이 이 라우트에 매칭되는지 판단하는 조건 목록 (AND 조건) |
| `filters` | List<GatewayFilter> | 요청/응답을 가공하는 필터 목록 |

추가 요소:
- **`order`**: 라우트 우선순위. 낮은 값이 먼저 평가됩니다. 기본값은 `Integer.MAX_VALUE`
- **`metadata`**: 라우트별 추가 설정 (`connect-timeout`, `response-timeout` 등)

---

## URI 형태

### http:// / https://

직접 호스트를 지정합니다. 로드 밸런싱 없이 고정 주소로 전달합니다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: external-api-route
          uri: https://api.example.com
          predicates:
            - Path=/external/**
```

### lb:// — Spring Cloud LoadBalancer 연동

`lb://`는 서비스 이름으로 인스턴스를 동적으로 조회합니다. Eureka, Kubernetes, Consul 등 서비스 디스커버리와 연동됩니다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: order-route
          uri: lb://order-service   # order-service 이름으로 등록된 인스턴스
          predicates:
            - Path=/api/orders/**
```

`ReactiveLoadBalancerClientFilter`가 `lb://order-service`를 실제 `http://10.0.0.5:8081`과 같은 주소로 변환합니다.

---

## metadata — 라우트별 타임아웃

`metadata`를 통해 라우트마다 다른 타임아웃을 설정할 수 있습니다. 글로벌 설정보다 우선합니다.

```yaml
spring:
  cloud:
    gateway:
      # 글로벌 타임아웃
      httpclient:
        connect-timeout: 3000      # ms
        response-timeout: 10s

      routes:
        # 오래 걸리는 리포트 서비스는 타임아웃을 길게
        - id: report-route
          uri: lb://report-service
          predicates:
            - Path=/api/reports/**
          metadata:
            connect-timeout: 5000   # ms
            response-timeout: 60s   # Duration 형식

        # 결제 서비스는 빠른 타임아웃으로 장애 격리
        - id: payment-route
          uri: lb://payment-service
          predicates:
            - Path=/api/payments/**
          metadata:
            connect-timeout: 1000
            response-timeout: 5s
```

---

## order — 라우트 우선순위

여러 라우트의 Predicate가 동시에 매칭될 경우, `order`가 낮은 라우트가 먼저 선택됩니다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        # order=1: /api/orders/premium/** 먼저 처리
        - id: premium-order-route
          uri: lb://premium-order-service
          predicates:
            - Path=/api/orders/premium/**
          order: 1

        # order=2: 나머지 /api/orders/** 처리
        - id: order-route
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          order: 2
```

> **실무 팁:** 구체적인 경로가 더 일반적인 경로보다 먼저 매칭되도록 order를 명시적으로 설정하는 습관을 들이세요. order를 지정하지 않으면 등록 순서에 따라 결정되는데, YAML 순서와 Java DSL 빈 등록 순서가 혼용되면 예상치 못한 동작이 발생합니다.

---

## YAML 방식 전체 예제

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service-route
          uri: lb://user-service
          order: 1
          predicates:
            - Path=/api/v1/users/**
            - Method=GET,POST,PUT,DELETE
          filters:
            - StripPrefix=2          # /api/v1/users/1 → /users/1
            - AddRequestHeader=X-Gateway-Source, api-gateway
            - AddResponseHeader=X-Response-Source, user-service
          metadata:
            connect-timeout: 2000
            response-timeout: 10s
```

---

## Java DSL 방식 전체 예제

```java
// Java
@Configuration
public class GatewayRoutesConfig {

    @Bean
    public RouteLocator routeLocator(RouteLocatorBuilder builder) {
        return builder.routes()
            .route("user-service-route", r -> r
                .path("/api/v1/users/**")
                .and()
                .method(HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.DELETE)
                .filters(f -> f
                    .stripPrefix(2)
                    .addRequestHeader("X-Gateway-Source", "api-gateway")
                    .addResponseHeader("X-Response-Source", "user-service")
                )
                .metadata("connect-timeout", 2000)
                .metadata("response-timeout", "10s")
                .order(1)
                .uri("lb://user-service")
            )
            .build();
    }
}
```

```kotlin
// Kotlin
@Configuration
class GatewayRoutesConfig {

    @Bean
    fun routeLocator(builder: RouteLocatorBuilder): RouteLocator =
        builder.routes()
            .route("user-service-route") { spec ->
                spec.path("/api/v1/users/**")
                    .and()
                    .method(HttpMethod.GET, HttpMethod.POST)
                    .filters { f ->
                        f.stripPrefix(2)
                            .addRequestHeader("X-Gateway-Source", "api-gateway")
                    }
                    .uri("lb://user-service")
            }
            .build()
}
```

---

## 동적 라우트

정적으로 설정 파일에 정의된 라우트 외에도, 런타임에 라우트를 추가/수정/삭제할 수 있습니다.

### RouteDefinitionRepository 인터페이스

```java
public interface RouteDefinitionRepository extends RouteDefinitionLocator, RouteDefinitionWriter {
    // RouteDefinitionLocator: Flux<RouteDefinition> getRouteDefinitions()
    // RouteDefinitionWriter: Mono<Void> save(Mono<RouteDefinition>)
    //                         Mono<Void> delete(Mono<String> routeId)
}
```

`RouteDefinition`은 YAML에서 라우트 하나를 표현하는 객체입니다:

```java
public class RouteDefinition {
    private String id;
    private URI uri;
    private int order;
    private Map<String, Object> metadata;
    private List<PredicateDefinition> predicates;
    private List<FilterDefinition> filters;
}
```

### InMemoryRouteDefinitionRepository (기본 구현)

기본적으로 `InMemoryRouteDefinitionRepository`가 사용됩니다. 애플리케이션 재시작 시 런타임에 추가한 라우트는 사라집니다.

```java
// 기본 구현 — ConcurrentHashMap에 라우트 저장
@Bean
@ConditionalOnMissingBean(RouteDefinitionRepository.class)
public InMemoryRouteDefinitionRepository inMemoryRouteDefinitionRepository() {
    return new InMemoryRouteDefinitionRepository();
}
```

### Redis 기반 커스텀 RouteDefinitionRepository

재시작 후에도 라우트를 유지하려면 Redis나 DB에 저장하는 커스텀 구현이 필요합니다.

```java
// Java
@Component
@Primary  // 기본 InMemory 구현 대신 이 빈 사용
public class RedisRouteDefinitionRepository implements RouteDefinitionRepository {

    private static final String ROUTES_KEY = "gateway:routes";

    private final ReactiveRedisTemplate<String, RouteDefinition> redisTemplate;

    public RedisRouteDefinitionRepository(ReactiveRedisTemplate<String, RouteDefinition> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public Flux<RouteDefinition> getRouteDefinitions() {
        return redisTemplate.opsForHash()
            .values(ROUTES_KEY)
            .cast(RouteDefinition.class);
    }

    @Override
    public Mono<Void> save(Mono<RouteDefinition> route) {
        return route.flatMap(r ->
            redisTemplate.opsForHash()
                .put(ROUTES_KEY, r.getId(), r)
                .then()
        );
    }

    @Override
    public Mono<Void> delete(Mono<String> routeId) {
        return routeId.flatMap(id ->
            redisTemplate.opsForHash()
                .remove(ROUTES_KEY, id)
                .then()
        );
    }
}
```

```kotlin
// Kotlin
@Component
@Primary
class RedisRouteDefinitionRepository(
    private val redisTemplate: ReactiveRedisTemplate<String, RouteDefinition>
) : RouteDefinitionRepository {

    companion object {
        private const val ROUTES_KEY = "gateway:routes"
    }

    override fun getRouteDefinitions(): Flux<RouteDefinition> =
        redisTemplate.opsForHash<String, RouteDefinition>()
            .values(ROUTES_KEY)

    override fun save(route: Mono<RouteDefinition>): Mono<Void> =
        route.flatMap { r ->
            redisTemplate.opsForHash<String, RouteDefinition>()
                .put(ROUTES_KEY, r.id, r)
                .then()
        }

    override fun delete(routeId: Mono<String>): Mono<Void> =
        routeId.flatMap { id ->
            redisTemplate.opsForHash<String, RouteDefinition>()
                .remove(ROUTES_KEY, id)
                .then()
        }
}
```

Redis 직렬화 설정:

```java
@Configuration
public class RedisConfig {

    @Bean
    public ReactiveRedisTemplate<String, RouteDefinition> routeDefinitionRedisTemplate(
            ReactiveRedisConnectionFactory factory) {

        ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        Jackson2JsonRedisSerializer<RouteDefinition> serializer =
            new Jackson2JsonRedisSerializer<>(mapper, RouteDefinition.class);

        RedisSerializationContext<String, RouteDefinition> context =
            RedisSerializationContext.<String, RouteDefinition>newSerializationContext(
                new StringRedisSerializer()
            )
            .value(serializer)
            .hashValue(serializer)
            .build();

        return new ReactiveRedisTemplate<>(factory, context);
    }
}
```

### Actuator API로 런타임 라우트 관리

`spring-cloud-gateway` Actuator 엔드포인트를 통해 런타임에 라우트를 추가/삭제할 수 있습니다.

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: gateway
```

```bash
# 라우트 추가 (POST)
curl -X POST http://localhost:8080/actuator/gateway/routes/new-route \
  -H "Content-Type: application/json" \
  -d '{
    "id": "new-route",
    "uri": "http://localhost:9090",
    "predicates": [
      {
        "name": "Path",
        "args": {"_genkey_0": "/new-api/**"}
      }
    ],
    "filters": [
      {
        "name": "StripPrefix",
        "args": {"_genkey_0": "1"}
      }
    ]
  }'

# 라우트 삭제 (DELETE)
curl -X DELETE http://localhost:8080/actuator/gateway/routes/new-route

# 라우트 캐시 갱신 (POST) — 라우트 변경 후 반드시 호출
curl -X POST http://localhost:8080/actuator/gateway/refresh
```

> **주의:** Actuator의 라우트 CRUD API는 `GatewayControllerEndpoint`를 통해 동작합니다. 기본 `InMemoryRouteDefinitionRepository`를 사용하면 재시작 시 사라지므로, 영구 저장이 필요하다면 커스텀 Repository를 구현해야 합니다.

### RefreshRoutesEvent — 라우트 갱신

코드에서 직접 라우트를 갱신하려면 `RefreshRoutesEvent`를 발행합니다.

```java
// Java
@Service
public class DynamicRouteService {

    private final RouteDefinitionWriter routeDefinitionWriter;
    private final ApplicationEventPublisher eventPublisher;

    public DynamicRouteService(
            RouteDefinitionWriter routeDefinitionWriter,
            ApplicationEventPublisher eventPublisher) {
        this.routeDefinitionWriter = routeDefinitionWriter;
        this.eventPublisher = eventPublisher;
    }

    public Mono<Void> addRoute(RouteDefinition routeDefinition) {
        return routeDefinitionWriter.save(Mono.just(routeDefinition))
            .doOnSuccess(v -> {
                // 라우트 추가 후 캐시 갱신 이벤트 발행
                eventPublisher.publishEvent(new RefreshRoutesEvent(this));
            });
    }

    public Mono<Void> deleteRoute(String routeId) {
        return routeDefinitionWriter.delete(Mono.just(routeId))
            .doOnSuccess(v -> {
                eventPublisher.publishEvent(new RefreshRoutesEvent(this));
            });
    }
}
```

```kotlin
// Kotlin
@Service
class DynamicRouteService(
    private val routeDefinitionWriter: RouteDefinitionWriter,
    private val eventPublisher: ApplicationEventPublisher
) {

    fun addRoute(routeDefinition: RouteDefinition): Mono<Void> =
        routeDefinitionWriter.save(Mono.just(routeDefinition))
            .doOnSuccess {
                eventPublisher.publishEvent(RefreshRoutesEvent(this))
            }

    fun deleteRoute(routeId: String): Mono<Void> =
        routeDefinitionWriter.delete(Mono.just(routeId))
            .doOnSuccess {
                eventPublisher.publishEvent(RefreshRoutesEvent(this))
            }
}
```

`RefreshRoutesEvent`를 받으면 `CachingRouteLocator`가 내부 캐시를 무효화하고 라우트를 다시 로드합니다.

---

## 실무 팁

### 라우트 설계 원칙

1. **id는 의미 있게**: `route-1`, `route-2`보다 `order-service-route`처럼 서비스를 명확히 표현
2. **order 명시**: 모든 라우트에 `order`를 명시적으로 설정해 예측 가능한 매칭 순서 보장
3. **metadata 타임아웃 설정**: 서비스 SLA에 따라 라우트별 타임아웃을 다르게 설정
4. **동적 라우트는 신중하게**: 런타임 라우트 변경은 운영 위험이 있으므로, 가능하면 배포로 해결

### Spring Cloud Config와 연동

```yaml
# Spring Cloud Config Server의 gateway-service.yml
spring:
  cloud:
    gateway:
      routes:
        - id: order-route
          uri: ${ORDER_SERVICE_URL:lb://order-service}
          predicates:
            - Path=/api/orders/**
```

환경 변수와 Spring Cloud Config를 활용하면 환경별 라우트 설정을 유연하게 관리할 수 있습니다.
