---
title: "Spring Cloud Gateway MVC: 서블릿 기반 게이트웨이"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "mvc", "servlet"]
---

# Spring Cloud Gateway MVC: 서블릿 기반 게이트웨이

Spring Cloud Gateway는 오랫동안 WebFlux(리액티브) 스택만 지원했다. 그러나 Spring Framework 6.x부터 서블릿 기반의 **Gateway MVC**가 공식 지원되기 시작했다. 기존 Spring MVC 프로젝트에 Gateway 기능을 추가하려는 팀이라면 이 선택지가 현실적이다.

---

## 1. 등장 배경

### WebFlux 러닝커브 문제

Spring Cloud Gateway (WebFlux 버전)는 Reactor의 `Mono`, `Flux`를 직접 다뤄야 한다. 커스텀 필터 하나를 작성하더라도 리액티브 프로그래밍 패러다임을 이해해야 하고, 블로킹 코드가 섞이면 이벤트 루프가 막혀 심각한 성능 저하가 발생한다.

많은 팀이 이 러닝커브 때문에 도입을 포기하거나, 단순한 Nginx 설정으로 대체하는 상황이 반복되었다.

### Gateway MVC의 등장

Spring Framework 6.1과 Spring Boot 3.2에서 **HttpExchangeFilterFunction**과 **ProxyExchange** 기반의 서블릿 Gateway가 도입되었다. 이로써 기존 Spring MVC 개발자가 익숙한 방식으로 API Gateway를 구성할 수 있게 되었다.

핵심 장점:
- 기존 Spring MVC 코드베이스에 바로 통합 가능
- `GlobalFilter` 대신 익숙한 `HandlerInterceptor` 또는 `Filter` 활용
- 블로킹 코드 작성 가능 (스레드-퍼-요청 모델)
- Virtual Thread(Java 21)와 결합하면 높은 동시성도 처리 가능

---

## 2. 의존성 및 설정

### build.gradle

```groovy
dependencies {
    // Gateway MVC (서블릿 기반)
    implementation 'org.springframework.cloud:spring-cloud-starter-gateway-mvc'

    // Spring MVC (서블릿)
    implementation 'org.springframework.boot:spring-boot-starter-web'

    // 주의: spring-boot-starter-webflux와 함께 사용하지 않는다
    // WebFlux가 클래스패스에 있으면 리액티브 모드로 전환될 수 있다
}
```

### pom.xml

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-gateway-mvc</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
</dependencies>
```

### application.yml 라우트 설정

WebFlux 버전과 거의 동일한 형식을 사용한다.

```yaml
spring:
  cloud:
    gateway:
      mvc:
        routes:
          - id: user-service
            uri: http://user-service:8081
            predicates:
              - Path=/api/users/**
            filters:
              - RewritePath=/api/users/(?<segment>.*), /users/${segment}
              - AddRequestHeader=X-Gateway-Source, gateway-mvc

          - id: order-service
            uri: http://order-service:8082
            predicates:
              - Path=/api/orders/**
            filters:
              - RewritePath=/api/orders/(?<segment>.*), /orders/${segment}
              - StripPrefix=2
```

**주의:** WebFlux 버전은 `spring.cloud.gateway.routes`를 사용하지만, Gateway MVC는 `spring.cloud.gateway.mvc.routes`를 사용한다.

---

## 3. ProxyExchange 기반 동작

Gateway MVC의 핵심은 `ProxyExchange`다. 이를 통해 컨트롤러에서 직접 프록시 요청을 구성하고 실행할 수 있다.

### ProxyExchange를 활용한 컨트롤러 예제

```java
// ManualProxyController.java
@RestController
public class ManualProxyController {

    // GET 요청을 하위 서비스로 전달
    @GetMapping("/proxy/users/{id}")
    public ResponseEntity<?> proxyGetUser(
            @PathVariable String id,
            ProxyExchange<byte[]> proxy) throws Exception {

        return proxy.uri("http://user-service:8081/users/" + id)
                .get();
    }

    // 요청 헤더를 수정하고 전달
    @GetMapping("/proxy/orders/**")
    public ResponseEntity<?> proxyOrders(
            ProxyExchange<byte[]> proxy,
            @RequestHeader(value = "Authorization", required = false) String auth) throws Exception {

        return proxy.uri("http://order-service:8082" + proxy.path("/proxy/orders"))
                .header("X-Forwarded-From", "gateway")
                .header("X-Original-Auth", auth != null ? auth : "none")
                .get();
    }

    // POST 요청 전달 (바디 포함)
    @PostMapping("/proxy/users")
    public ResponseEntity<?> proxyCreateUser(
            @RequestBody String body,
            ProxyExchange<byte[]> proxy) throws Exception {

        return proxy.uri("http://user-service:8081/users")
                .body(body)
                .post();
    }

    // 응답을 가공해서 반환
    @GetMapping("/proxy/products/{id}")
    public ResponseEntity<ProductResponse> proxyGetProduct(
            @PathVariable String id,
            ProxyExchange<ProductResponse> proxy) throws Exception {

        return proxy.uri("http://product-service:8083/products/" + id)
                .get(response -> {
                    ProductResponse body = response.getBody();
                    if (body != null) {
                        // 응답 데이터 변환
                        body.setEnriched(true);
                    }
                    return ResponseEntity.ok(body);
                });
    }
}
```

### YAML 기반 자동 라우팅 (일반적인 사용법)

직접 `ProxyExchange` 컨트롤러를 작성하는 것보다 YAML 설정으로 자동 라우팅을 사용하는 것이 더 일반적이다.

```yaml
spring:
  cloud:
    gateway:
      mvc:
        routes:
          - id: product-service
            uri: http://product-service:8083
            predicates:
              - Path=/api/products/**
            filters:
              - RewritePath=/api/products/(?<segment>.*), /products/${segment}
              - AddRequestHeader=X-Gateway-Source, gateway-mvc
              - AddResponseHeader=X-Response-From, gateway
```

---

## 4. WebFlux 버전과의 기능 차이

### 지원 필터 비교

| 필터 | WebFlux 버전 | Gateway MVC |
|---|---|---|
| AddRequestHeader | ✅ | ✅ |
| AddResponseHeader | ✅ | ✅ |
| RewritePath | ✅ | ✅ |
| StripPrefix | ✅ | ✅ |
| SetPath | ✅ | ✅ |
| RedirectTo | ✅ | ✅ |
| RequestRateLimiter (Redis) | ✅ | ✅ (제한적) |
| CircuitBreaker | ✅ | ✅ |
| Retry | ✅ | ✅ |
| CacheRequestBody | ✅ | ✅ |
| ModifyRequestBody | ✅ (리액티브) | ❌ |
| ModifyResponseBody | ✅ (리액티브) | ❌ |
| ReactiveLoadBalancerClientFilter | ✅ | ❌ (블로킹 버전 사용) |
| SaveSession | ✅ | ✅ |

### 성능 차이

**WebFlux (이벤트 루프 모델):**
- 적은 스레드로 많은 동시 연결 처리
- I/O 대기 중에도 스레드를 블로킹하지 않음
- CPU-bound 작업에는 별도 스케줄러 필요

**Gateway MVC (스레드-퍼-요청 모델):**
- 요청마다 하나의 스레드 점유
- I/O 대기 중에는 스레드가 블로킹됨
- Java 21 Virtual Thread와 결합하면 블로킹 비용 최소화

```java
// Java 21 + Virtual Thread 활성화
// application.yml
spring:
  threads:
    virtual:
      enabled: true  # 모든 요청 처리를 Virtual Thread로
```

Virtual Thread를 사용하면 수천 개의 동시 요청을 처리할 수 있어, WebFlux에 근접한 동시성 성능을 얻을 수 있다.

---

## 5. 커스텀 필터 작성 비교

### WebFlux 버전 GlobalFilter

```java
// WebFlux 방식
@Component
public class RequestLoggingFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        log.info("Request: {} {}", exchange.getRequest().getMethod(),
                exchange.getRequest().getURI());

        return chain.filter(exchange)
                .doFinally(signal -> log.info("Response: {}",
                        exchange.getResponse().getStatusCode()));
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
```

### Gateway MVC: HandlerInterceptor

```java
// Gateway MVC 방식: HandlerInterceptor
@Component
public class RequestLoggingInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {
        request.setAttribute("startTime", System.currentTimeMillis());
        log.info("Request: {} {}", request.getMethod(), request.getRequestURI());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler,
                                Exception ex) {
        long startTime = (Long) request.getAttribute("startTime");
        long duration = System.currentTimeMillis() - startTime;
        log.info("Response: {} {}ms", response.getStatus(), duration);
    }
}

// WebMvcConfigurer에 등록
@Configuration
public class GatewayMvcConfig implements WebMvcConfigurer {

    private final RequestLoggingInterceptor loggingInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(loggingInterceptor)
                .addPathPatterns("/api/**");
    }
}
```

### Gateway MVC: Servlet Filter (전역 적용)

```java
// JWT 검증 필터 (서블릿 방식)
@Component
@Order(1)
public class JwtValidationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"인증이 필요합니다.\"}");
            return;
        }

        try {
            String token = authHeader.substring(7);
            Claims claims = jwtTokenProvider.parseToken(token);

            // 검증된 사용자 정보를 요청 속성으로 저장
            request.setAttribute("userId", claims.getSubject());
            request.setAttribute("roles", claims.get("roles", List.class));

            filterChain.doFilter(request, response);

        } catch (JwtException e) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"유효하지 않은 토큰입니다.\"}");
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // 인증이 필요 없는 경로 제외
        String path = request.getServletPath();
        return path.startsWith("/actuator/") || path.startsWith("/public/");
    }
}
```

---

## 6. 언제 어떤 버전을 선택하는가

### WebFlux 버전을 선택하는 경우

- 새로운 프로젝트를 시작하는 경우
- 팀이 리액티브 프로그래밍에 익숙한 경우
- 높은 동시성(수천 개의 동시 연결)이 요구되는 경우
- 리액티브 스택(Spring WebFlux, R2DBC, Reactive Redis)을 함께 사용하는 경우
- `ModifyRequestBody`, `ModifyResponseBody` 같은 고급 필터가 필요한 경우

### Gateway MVC 버전을 선택하는 경우

- 기존 Spring MVC 애플리케이션에 Gateway 기능을 통합하는 경우
- 팀이 WebFlux에 익숙하지 않고 학습 비용을 줄이고 싶은 경우
- JPA, JDBC 등 블로킹 라이브러리를 Gateway 필터에서 사용해야 하는 경우
- Java 21 Virtual Thread와 함께 사용하여 동시성을 보완하는 경우

```
판단 기준 요약:

리액티브 스택 + 높은 동시성 + 팀 역량   → WebFlux Gateway
서블릿 스택 + 레거시 통합 + 빠른 도입   → Gateway MVC
```

---

## 7. 마이그레이션 고려사항

기존 WebFlux Gateway를 Gateway MVC로 전환하거나, 반대 방향의 마이그레이션 시 고려할 사항이다.

### YAML 설정 호환성

대부분의 라우트 설정은 `spring.cloud.gateway.routes` → `spring.cloud.gateway.mvc.routes`로 경로만 변경하면 된다.

```yaml
# WebFlux
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/users/**

# Gateway MVC
spring:
  cloud:
    gateway:
      mvc:
        routes:
          - id: user-service
            uri: http://user-service:8081  # MVC는 lb:// 대신 실제 URL 사용 권장
            predicates:
              - Path=/api/users/**
```

**주의:** Gateway MVC에서 `lb://` (로드밸런서 URI)를 사용하려면 Spring Cloud LoadBalancer 의존성을 추가하고 추가 설정이 필요하다.

### GlobalFilter → HandlerInterceptor 전환

```java
// WebFlux GlobalFilter → Gateway MVC HandlerInterceptor 변환 예시

// 변환 전 (WebFlux)
public class CorrelationIdFilter implements GlobalFilter {
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String correlationId = UUID.randomUUID().toString();
        exchange.getRequest().mutate()
                .header("X-Correlation-Id", correlationId);
        return chain.filter(exchange);
    }
}

// 변환 후 (Gateway MVC)
public class CorrelationIdInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response, Object handler) {
        // 서블릿 필터에서는 요청 헤더를 직접 수정할 수 없다
        // HttpServletRequestWrapper를 사용하거나 요청 속성으로 대신 전달
        request.setAttribute("X-Correlation-Id", UUID.randomUUID().toString());
        return true;
    }
}
```

서블릿 환경에서는 `HttpServletRequest`의 헤더를 직접 수정할 수 없다. 하위 서비스로 헤더를 추가해서 전달하려면 `HttpServletRequestWrapper`를 사용해야 한다.

```java
// HeaderAddingRequestWrapper.java
public class HeaderAddingRequestWrapper extends HttpServletRequestWrapper {

    private final Map<String, String> extraHeaders;

    public HeaderAddingRequestWrapper(HttpServletRequest request,
                                      Map<String, String> extraHeaders) {
        super(request);
        this.extraHeaders = new HashMap<>(extraHeaders);
    }

    @Override
    public String getHeader(String name) {
        String extra = extraHeaders.get(name);
        return extra != null ? extra : super.getHeader(name);
    }

    @Override
    public Enumeration<String> getHeaders(String name) {
        String extra = extraHeaders.get(name);
        if (extra != null) {
            return Collections.enumeration(List.of(extra));
        }
        return super.getHeaders(name);
    }
}
```

**실무 팁:** Gateway MVC로 전환할 때 가장 큰 작업은 리액티브 GlobalFilter를 서블릿 Filter/Interceptor로 재작성하는 것이다. 라우트 YAML 설정은 거의 그대로 재사용할 수 있으므로 필터 마이그레이션에 집중하면 된다.
