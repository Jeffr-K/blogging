---
title: "Spring Cloud Gateway: 테스트 전략"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "testing", "wiremock", "webflux"]
---

# Spring Cloud Gateway: 테스트 전략

Spring Cloud Gateway는 리액티브 스택 위에서 동작하므로 테스트 방식도 일반 Spring MVC와 다르다. 단위 테스트부터 통합 테스트까지 계층별로 어떻게 검증할지 정리한다.

---

## 1. 테스트 전략 개요

Gateway 테스트는 크게 두 가지 계층으로 나눌 수 있다.

| 계층 | 목적 | 도구 |
|---|---|---|
| 단위 테스트 | Filter, Predicate 로직 개별 검증 | JUnit 5, Mockito, MockServerWebExchange |
| 통합 테스트 | 전체 Gateway 동작 검증 (라우팅, 필터 체인) | @SpringBootTest, WebTestClient, WireMock |

단위 테스트는 빠르고 격리된 환경에서 비즈니스 로직을 검증하는 데 적합하다. 통합 테스트는 실제 Gateway가 올바른 하위 서비스를 호출하는지, 필터가 올바른 순서로 적용되는지 확인한다.

---

## 2. GatewayFilter 단위 테스트

`MockServerWebExchange`와 `MockGatewayFilterChain`을 활용하면 실제 서버 없이 필터 로직을 검증할 수 있다.

### 커스텀 필터 예제 (테스트 대상)

```java
// RequestIdFilter.java
@Component
public class RequestIdFilter implements GlobalFilter, Ordered {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (exchange.getRequest().getHeaders().containsKey(REQUEST_ID_HEADER)) {
            return chain.filter(exchange);
        }

        String requestId = UUID.randomUUID().toString();
        ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                .header(REQUEST_ID_HEADER, requestId)
                .build();

        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
```

### 단위 테스트 코드

```java
// RequestIdFilterTest.java
class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    void 요청에_X_Request_Id_헤더가_없으면_자동으로_추가한다() {
        // given
        MockServerHttpRequest request = MockServerHttpRequest
                .get("/api/test")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        List<ServerWebExchange> capturedExchanges = new ArrayList<>();
        GatewayFilterChain chain = capturedExchange -> {
            capturedExchanges.add(capturedExchange);
            return Mono.empty();
        };

        // when
        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        // then
        assertThat(capturedExchanges).hasSize(1);
        String requestId = capturedExchanges.get(0)
                .getRequest()
                .getHeaders()
                .getFirst(RequestIdFilter.REQUEST_ID_HEADER);

        assertThat(requestId).isNotNull().isNotBlank();
    }

    @Test
    void 요청에_이미_X_Request_Id_헤더가_있으면_그대로_유지한다() {
        // given
        String existingId = "existing-request-id-123";
        MockServerHttpRequest request = MockServerHttpRequest
                .get("/api/test")
                .header(RequestIdFilter.REQUEST_ID_HEADER, existingId)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        List<ServerWebExchange> capturedExchanges = new ArrayList<>();
        GatewayFilterChain chain = capturedExchange -> {
            capturedExchanges.add(capturedExchange);
            return Mono.empty();
        };

        // when
        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        // then
        String requestId = capturedExchanges.get(0)
                .getRequest()
                .getHeaders()
                .getFirst(RequestIdFilter.REQUEST_ID_HEADER);

        assertThat(requestId).isEqualTo(existingId);
    }
}
```

### Mockito를 활용한 GatewayFilterChain 모킹

```java
// JwtAuthenticationFilterTest.java
@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private GatewayFilterChain chain;

    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(jwtTokenProvider);
        when(chain.filter(any())).thenReturn(Mono.empty());
    }

    @Test
    void 유효한_JWT로_요청하면_사용자_정보_헤더가_주입된다() {
        // given
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn("user-123");
        when(claims.get("roles", List.class)).thenReturn(List.of("ROLE_USER"));
        when(jwtTokenProvider.parseToken("valid-token")).thenReturn(claims);

        MockServerHttpRequest request = MockServerHttpRequest
                .get("/api/users/me")
                .header("Authorization", "Bearer valid-token")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        // when
        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        // then
        ArgumentCaptor<ServerWebExchange> exchangeCaptor =
                ArgumentCaptor.forClass(ServerWebExchange.class);
        verify(chain).filter(exchangeCaptor.capture());

        HttpHeaders headers = exchangeCaptor.getValue().getRequest().getHeaders();
        assertThat(headers.getFirst("X-User-Id")).isEqualTo("user-123");
        assertThat(headers.getFirst("X-User-Roles")).isEqualTo("ROLE_USER");
    }

    @Test
    void Authorization_헤더가_없으면_401을_반환한다() {
        // given
        MockServerHttpRequest request = MockServerHttpRequest
                .get("/api/users/me")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        // when
        StepVerifier.create(filter.filter(exchange, chain))
                .verifyComplete();

        // then
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }
}
```

---

## 3. 커스텀 Predicate 단위 테스트

```java
// ClientVersionRoutePredicateFactory.java
public class ClientVersionRoutePredicateFactory
        extends AbstractRoutePredicateFactory<ClientVersionRoutePredicateFactory.Config> {

    public ClientVersionRoutePredicateFactory() {
        super(Config.class);
    }

    @Override
    public Predicate<ServerWebExchange> apply(Config config) {
        return exchange -> {
            String version = exchange.getRequest()
                    .getHeaders()
                    .getFirst("X-Client-Version");
            if (version == null) return false;

            try {
                int clientVersion = Integer.parseInt(version);
                return clientVersion >= config.getMinVersion()
                        && clientVersion <= config.getMaxVersion();
            } catch (NumberFormatException e) {
                return false;
            }
        };
    }

    @Data
    public static class Config {
        private int minVersion;
        private int maxVersion;
    }
}
```

```java
// ClientVersionRoutePredicateFactoryTest.java
class ClientVersionRoutePredicateFactoryTest {

    private final ClientVersionRoutePredicateFactory factory =
            new ClientVersionRoutePredicateFactory();

    private Predicate<ServerWebExchange> buildPredicate(int min, int max) {
        ClientVersionRoutePredicateFactory.Config config =
                new ClientVersionRoutePredicateFactory.Config();
        config.setMinVersion(min);
        config.setMaxVersion(max);
        return factory.apply(config);
    }

    @Test
    void 버전이_범위_내에_있으면_매칭된다() {
        Predicate<ServerWebExchange> predicate = buildPredicate(3, 5);

        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/test")
                        .header("X-Client-Version", "4")
                        .build());

        assertThat(predicate.test(exchange)).isTrue();
    }

    @Test
    void 버전이_최솟값보다_낮으면_매칭되지_않는다() {
        Predicate<ServerWebExchange> predicate = buildPredicate(3, 5);

        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/test")
                        .header("X-Client-Version", "2")
                        .build());

        assertThat(predicate.test(exchange)).isFalse();
    }

    @Test
    void 버전_헤더가_없으면_매칭되지_않는다() {
        Predicate<ServerWebExchange> predicate = buildPredicate(3, 5);

        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/test").build());

        assertThat(predicate.test(exchange)).isFalse();
    }
}
```

---

## 4. 통합 테스트 설정

### 의존성

```groovy
// build.gradle
dependencies {
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.cloud:spring-cloud-contract-wiremock'
    testImplementation 'io.projectreactor:reactor-test'
    testImplementation 'it.ozimov:embedded-redis:0.7.3'
}
```

### 통합 테스트 기본 설정

```java
// GatewayIntegrationTestBase.java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public abstract class GatewayIntegrationTestBase {

    @LocalServerPort
    protected int port;

    protected WebTestClient webTestClient;

    @Autowired
    protected ApplicationContext applicationContext;

    // WireMock 서버 (하위 서비스 시뮬레이션)
    protected static WireMockServer userServiceMock;
    protected static WireMockServer orderServiceMock;

    @BeforeAll
    static void startMocks() {
        userServiceMock = new WireMockServer(WireMockConfiguration.options().dynamicPort());
        orderServiceMock = new WireMockServer(WireMockConfiguration.options().dynamicPort());
        userServiceMock.start();
        orderServiceMock.start();
    }

    @AfterAll
    static void stopMocks() {
        userServiceMock.stop();
        orderServiceMock.stop();
    }

    @BeforeEach
    void setUpWebTestClient() {
        webTestClient = WebTestClient
                .bindToServer()
                .baseUrl("http://localhost:" + port)
                .responseTimeout(Duration.ofSeconds(10))
                .build();
    }

    @AfterEach
    void resetMocks() {
        userServiceMock.resetAll();
        orderServiceMock.resetAll();
    }
}
```

### application-test.yml

```yaml
# src/test/resources/application-test.yml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: http://localhost:${wiremock.user-service.port}
          predicates:
            - Path=/api/users/**
          filters:
            - RewritePath=/api/users/(?<segment>.*), /users/${segment}

        - id: order-service
          uri: http://localhost:${wiremock.order-service.port}
          predicates:
            - Path=/api/orders/**
          filters:
            - RewritePath=/api/orders/(?<segment>.*), /orders/${segment}

  redis:
    host: localhost
    port: 6370   # Embedded Redis 포트
```

### WireMock 포트를 Spring 설정에 주입

```java
// WireMockPortInitializer.java
public class WireMockPortInitializer
        implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext context) {
        // 테스트 클래스에서 WireMock 서버를 시작한 후 포트를 주입
        // 실제 환경에서는 @DynamicPropertySource 활용
    }
}
```

```java
// 더 간단한 방법: @DynamicPropertySource
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class GatewayRoutingTest {

    static WireMockServer userServiceMock = new WireMockServer(
            WireMockConfiguration.options().dynamicPort());

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        userServiceMock.start();
        registry.add("wiremock.user-service.port", userServiceMock::port);
    }
    // ...
}
```

---

## 5. 라우트 통합 테스트

### 경로 매칭 및 필터 동작 검증

```java
// GatewayRoutingIntegrationTest.java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GatewayRoutingIntegrationTest {

    @LocalServerPort
    int port;

    static WireMockServer userServiceMock;
    static WireMockServer orderServiceMock;

    WebTestClient webTestClient;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        userServiceMock = new WireMockServer(WireMockConfiguration.options().dynamicPort());
        orderServiceMock = new WireMockServer(WireMockConfiguration.options().dynamicPort());
        userServiceMock.start();
        orderServiceMock.start();
        registry.add("wiremock.user-service.port", userServiceMock::port);
        registry.add("wiremock.order-service.port", orderServiceMock::port);
    }

    @BeforeEach
    void setUp() {
        webTestClient = WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + port)
                .build();
    }

    @AfterEach
    void reset() {
        userServiceMock.resetAll();
        orderServiceMock.resetAll();
    }

    @Test
    void GET_api_users_경로가_user_service로_라우팅된다() {
        // given: 하위 서비스 stubbing
        userServiceMock.stubFor(
                WireMock.get(WireMock.urlPathEqualTo("/users/123"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"id\": 123, \"name\": \"홍길동\"}")));

        // when & then
        webTestClient.get()
                .uri("/api/users/123")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(123)
                .jsonPath("$.name").isEqualTo("홍길동");

        // 하위 서비스가 실제로 호출되었는지 확인
        userServiceMock.verify(1,
                WireMock.getRequestedFor(WireMock.urlPathEqualTo("/users/123")));
    }

    @Test
    void RewritePath_필터가_버전_prefix를_제거하고_전달한다() {
        // given
        userServiceMock.stubFor(
                WireMock.get(WireMock.urlPathEqualTo("/users/456"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"id\": 456}")));

        // when: /v1/users/456 요청
        webTestClient.get()
                .uri("/v1/users/456")
                .exchange()
                .expectStatus().isOk();

        // then: 하위 서비스에는 /users/456으로 전달되었는지 확인
        userServiceMock.verify(1,
                WireMock.getRequestedFor(WireMock.urlPathEqualTo("/users/456")));
    }

    @Test
    void AddRequestHeader_필터로_헤더가_하위_서비스에_전달된다() {
        // given
        userServiceMock.stubFor(
                WireMock.get(WireMock.urlPathMatching("/users/.*"))
                        .withHeader("X-Gateway-Version", WireMock.equalTo("1.0"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withBody("{\"id\": 1}")));

        // when
        webTestClient.get()
                .uri("/api/users/1")
                .exchange()
                .expectStatus().isOk();

        // then: 헤더가 포함된 요청이 왔는지 검증
        userServiceMock.verify(WireMock.getRequestedFor(
                WireMock.urlPathEqualTo("/users/1"))
                .withHeader("X-Gateway-Version", WireMock.equalTo("1.0")));
    }

    @Test
    void 존재하지_않는_경로는_404를_반환한다() {
        webTestClient.get()
                .uri("/unknown/path")
                .exchange()
                .expectStatus().isNotFound();
    }
}
```

---

## 6. Circuit Breaker 폴백 테스트

```java
// CircuitBreakerFallbackTest.java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CircuitBreakerFallbackTest {

    @LocalServerPort
    int port;

    static WireMockServer downstreamMock;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        downstreamMock = new WireMockServer(WireMockConfiguration.options().dynamicPort());
        downstreamMock.start();
        registry.add("wiremock.product-service.port", downstreamMock::port);
    }

    WebTestClient webTestClient;

    @BeforeEach
    void setUp() {
        webTestClient = WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + port)
                .responseTimeout(Duration.ofSeconds(15))
                .build();
    }

    @Test
    void 하위_서비스_5xx_오류_시_폴백_응답을_반환한다() {
        // given: 하위 서비스가 500 에러 반환
        downstreamMock.stubFor(
                WireMock.get(WireMock.urlPathMatching("/products/.*"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(500)
                                .withBody("{\"error\": \"Internal Server Error\"}")));

        // when & then: Gateway는 폴백 응답 반환
        webTestClient.get()
                .uri("/api/products/999")
                .exchange()
                .expectStatus().isOk()  // 폴백은 200 반환
                .expectBody()
                .jsonPath("$.message").isEqualTo("서비스를 일시적으로 사용할 수 없습니다.");
    }

    @Test
    void 하위_서비스_타임아웃_시_폴백_응답을_반환한다() {
        // given: 하위 서비스가 응답 지연 (타임아웃 유발)
        downstreamMock.stubFor(
                WireMock.get(WireMock.urlPathMatching("/products/.*"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withFixedDelay(10000)  // 10초 지연
                                .withBody("{}")));

        // when & then
        webTestClient.get()
                .uri("/api/products/999")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.message").isEqualTo("서비스를 일시적으로 사용할 수 없습니다.");
    }
}
```

---

## 7. Rate Limit 테스트

### Embedded Redis 설정

실제 Redis 없이 테스트하기 위해 Embedded Redis를 사용한다.

```java
// TestRedisConfiguration.java
@TestConfiguration
public class TestRedisConfiguration {

    private RedisServer redisServer;

    @Value("${spring.redis.port:6370}")
    private int port;

    @PostConstruct
    public void startRedis() throws IOException {
        redisServer = new RedisServer(port);
        redisServer.start();
    }

    @PreDestroy
    public void stopRedis() {
        if (redisServer != null && redisServer.isActive()) {
            redisServer.stop();
        }
    }
}
```

```yaml
# application-test.yml
spring:
  redis:
    host: localhost
    port: 6370

  cloud:
    gateway:
      routes:
        - id: rate-limited-api
          uri: lb://some-service
          predicates:
            - Path=/limited/**
          filters:
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 2
                redis-rate-limiter.burstCapacity: 2
                key-resolver: "#{@ipKeyResolver}"
```

### Rate Limit 통합 테스트

```java
// RateLimitIntegrationTest.java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestRedisConfiguration.class)
class RateLimitIntegrationTest {

    @LocalServerPort
    int port;

    static WireMockServer backendMock;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        backendMock = new WireMockServer(WireMockConfiguration.options().dynamicPort());
        backendMock.start();
        registry.add("wiremock.some-service.port", backendMock::port);
    }

    WebTestClient webTestClient;

    @BeforeEach
    void setUp() {
        webTestClient = WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + port)
                .build();

        // 하위 서비스는 항상 200 반환
        backendMock.stubFor(
                WireMock.get(WireMock.anyUrl())
                        .willReturn(WireMock.aResponse().withStatus(200).withBody("{}")));
    }

    @Test
    void 허용_횟수_초과_시_429를_반환한다() throws InterruptedException {
        // replenishRate=2, burstCapacity=2 이므로 초기 2번 허용

        // 첫 번째 요청: 200
        webTestClient.get().uri("/limited/resource")
                .header("X-Forwarded-For", "10.0.0.1")
                .exchange()
                .expectStatus().isOk();

        // 두 번째 요청: 200
        webTestClient.get().uri("/limited/resource")
                .header("X-Forwarded-For", "10.0.0.1")
                .exchange()
                .expectStatus().isOk();

        // 세 번째 요청: 429 Too Many Requests
        webTestClient.get().uri("/limited/resource")
                .header("X-Forwarded-For", "10.0.0.1")
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void 다른_IP는_별도로_제한된다() {
        // IP-A: 첫 번째 요청
        webTestClient.get().uri("/limited/resource")
                .header("X-Forwarded-For", "10.0.0.1")
                .exchange()
                .expectStatus().isOk();

        // IP-A: 두 번째 요청
        webTestClient.get().uri("/limited/resource")
                .header("X-Forwarded-For", "10.0.0.1")
                .exchange()
                .expectStatus().isOk();

        // IP-B: 첫 번째 요청 (IP-A와 독립적)
        webTestClient.get().uri("/limited/resource")
                .header("X-Forwarded-For", "10.0.0.2")
                .exchange()
                .expectStatus().isOk();

        // IP-A: 세 번째 요청 → 429
        webTestClient.get().uri("/limited/resource")
                .header("X-Forwarded-For", "10.0.0.1")
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }
}
```

---

## 8. 테스트 팁

### WireMock 요청 이력 검증 (verify)

단순히 응답 상태코드만 확인하는 것을 넘어, 하위 서비스에 어떤 요청이 실제로 전달되었는지 검증해야 필터 동작을 제대로 확인할 수 있다.

```java
// 특정 헤더를 포함한 요청이 1번 왔는지 검증
wireMockServer.verify(1, WireMock.getRequestedFor(WireMock.urlPathEqualTo("/users/123"))
        .withHeader("X-User-Id", WireMock.equalTo("user-42"))
        .withHeader("X-Correlation-Id", WireMock.matching("[a-f0-9\\-]+")));

// 특정 헤더가 없는 요청인지 검증 (민감 헤더 제거 확인)
wireMockServer.verify(WireMock.getRequestedFor(WireMock.anyUrl())
        .withoutHeader("Authorization"));

// 요청이 전혀 없었는지 검증
wireMockServer.verify(0, WireMock.anyRequestedFor(WireMock.anyUrl()));
```

### @DirtiesContext 활용 시점

`@DirtiesContext`는 테스트 후 Spring 컨텍스트를 재시작시킨다. 성능 비용이 크므로 신중하게 사용해야 한다.

```java
// 동적 라우트를 추가/삭제하는 테스트는 컨텍스트를 오염시킬 수 있다
@Test
@DirtiesContext  // 이 테스트 후 컨텍스트 재생성
void 동적_라우트_추가_테스트() {
    // RouteDefinitionWriter로 라우트를 추가하는 테스트
}
```

**언제 사용하는가:**
- Actuator API로 라우트를 동적으로 변경하는 테스트
- Circuit Breaker 상태(OPEN/CLOSED)를 특정 상태로 만드는 테스트
- 전역 상태(Redis 데이터 등)를 변경하고 격리가 필요한 테스트

**대안:** 테스트 순서 의존성이 없도록 `@AfterEach`에서 상태를 정리하는 것이 `@DirtiesContext`보다 성능상 유리하다.

### 리액티브 테스트의 주의사항

```java
// 잘못된 예: block()은 테스트에서도 데드락을 유발할 수 있다
@Test
void bad_example() {
    String result = webTestClient.get().uri("/api/test")
            .exchange()
            .expectBody(String.class)
            .returnResult()
            .getResponseBody(); // 이 방식은 OK
    // block()을 직접 호출하는 것은 피한다
}

// 올바른 예: StepVerifier 또는 WebTestClient 체이닝 활용
@Test
void good_example() {
    webTestClient.get().uri("/api/test")
            .exchange()
            .expectStatus().isOk()
            .expectBody()
            .jsonPath("$.key").isEqualTo("value");
}
```
