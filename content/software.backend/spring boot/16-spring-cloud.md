---
title: "Spring Boot: Spring Cloud — Config, Eureka, OpenFeign, Resilience4j"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "spring-cloud", "microservices", "resilience4j"]
---

# Spring Cloud

## Spring Cloud Config

분산 환경에서 설정을 중앙화한다. 설정 서버에서 모든 서비스의 설정을 관리한다.

### Config Server

```kotlin
implementation("org.springframework.cloud:spring-cloud-config-server")
```

```java
@SpringBootApplication
@EnableConfigServer
public class ConfigServerApplication { }
```

```yaml
# Config Server application.yml
server:
  port: 8888

spring:
  cloud:
    config:
      server:
        git:
          uri: https://github.com/myorg/config-repo
          default-label: main
          search-paths: '{application}'  # 애플리케이션별 폴더
          username: ${GIT_USERNAME}
          password: ${GIT_TOKEN}
```

Git 저장소 구조:
```
config-repo/
├── application.yml          # 모든 서비스 공통
├── order-service/
│   ├── application.yml      # order-service 공통
│   ├── application-dev.yml
│   └── application-prod.yml
└── user-service/
    └── application.yml
```

### Config Client

```kotlin
implementation("org.springframework.cloud:spring-cloud-starter-config")
```

```yaml
# bootstrap.yml (또는 application.yml)
spring:
  application:
    name: order-service
  config:
    import: "optional:configserver:http://config-server:8888"
  profiles:
    active: prod
```

### 설정 갱신 (@RefreshScope)

```java
@RestController
@RefreshScope  // POST /actuator/refresh 호출 시 빈 재생성
public class FeatureController {

    @Value("${feature.new-checkout: false}")
    private boolean newCheckoutEnabled;

    @GetMapping("/feature/checkout")
    public boolean isNewCheckout() {
        return newCheckoutEnabled;
    }
}
```

```bash
# 설정 변경 후 갱신
curl -X POST http://order-service:8080/actuator/refresh
```

Spring Cloud Bus를 쓰면 모든 인스턴스에 브로드캐스트할 수 있다.

---

## Spring Cloud Eureka (서비스 디스커버리)

마이크로서비스가 서로의 위치(IP:Port)를 동적으로 파악한다.

### Eureka Server

```kotlin
implementation("org.springframework.cloud:spring-cloud-starter-netflix-eureka-server")
```

```java
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication { }
```

```yaml
server:
  port: 8761

eureka:
  instance:
    hostname: localhost
  client:
    register-with-eureka: false
    fetch-registry: false
```

### Eureka Client

```kotlin
implementation("org.springframework.cloud:spring-cloud-starter-netflix-eureka-client")
```

```yaml
spring:
  application:
    name: order-service

eureka:
  client:
    service-url:
      defaultZone: http://eureka-server:8761/eureka/
  instance:
    prefer-ip-address: true
    instance-id: ${spring.application.name}:${server.port}
```

자동으로 Eureka에 등록되고, 다른 서비스 이름으로 RestClient/WebClient 호출이 가능해진다:

```java
// "user-service" 이름으로 로드밸런싱 자동 적용
RestClient restClient = RestClient.builder()
    .baseUrl("http://user-service")
    .build();
```

---

## OpenFeign (선언형 HTTP 클라이언트)

인터페이스 정의만으로 HTTP 클라이언트를 생성한다.

```kotlin
implementation("org.springframework.cloud:spring-cloud-starter-openfeign")
```

```java
@SpringBootApplication
@EnableFeignClients
public class OrderServiceApplication { }
```

### Feign 클라이언트 정의

```java
@FeignClient(
    name = "user-service",
    url = "${user-service.url:}",  // Eureka 없을 때 직접 URL 지정
    fallback = UserClientFallback.class
)
public interface UserClient {

    @GetMapping("/api/users/{id}")
    UserResponse findById(@PathVariable Long id);

    @PostMapping("/api/users/{id}/points")
    void addPoints(@PathVariable Long id, @RequestBody AddPointsRequest request);

    @GetMapping("/api/users")
    Page<UserResponse> findAll(@SpringQueryMap UserSearchRequest request);
}
```

### Feign 설정

```java
@Configuration
public class FeignConfig {

    @Bean
    public Retryer retryer() {
        // 100ms 시작, 최대 1초, 3회 재시도
        return new Retryer.Default(100, 1000, 3);
    }

    @Bean
    public Logger.Level feignLoggerLevel() {
        return Logger.Level.BASIC;  // NONE, BASIC, HEADERS, FULL
    }

    @Bean
    public ErrorDecoder errorDecoder() {
        return (methodKey, response) -> {
            if (response.status() == 404) {
                return new ResourceNotFoundException("리소스 없음");
            }
            return new FeignException.InternalServerError(
                "서버 오류", response.request(), null, null
            );
        };
    }
}
```

### Fallback (Resilience4j 연동)

```java
@Component
public class UserClientFallback implements UserClient {

    @Override
    public UserResponse findById(Long id) {
        return UserResponse.unknown(id);  // 기본값 반환
    }

    @Override
    public void addPoints(Long id, AddPointsRequest request) {
        log.warn("포인트 적립 실패 — 나중에 재시도: userId={}", id);
        // 실패 이벤트를 큐에 저장해 나중에 재처리
    }
}
```

---

## Resilience4j (회복 탄력성)

Circuit Breaker, Rate Limiter, Retry, Bulkhead 패턴을 제공한다.

```kotlin
implementation("io.github.resilience4j:resilience4j-spring-boot3")
```

### Circuit Breaker

```yaml
resilience4j:
  circuitbreaker:
    instances:
      user-service:
        sliding-window-type: COUNT_BASED
        sliding-window-size: 10          # 최근 10회 호출 기준
        failure-rate-threshold: 50       # 50% 실패 시 OPEN
        wait-duration-in-open-state: 10s # OPEN 유지 시간
        permitted-number-of-calls-in-half-open-state: 3  # HALF_OPEN 시 허용 호출
        register-health-indicator: true
```

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final UserClient userClient;

    @CircuitBreaker(name = "user-service", fallbackMethod = "getUserFallback")
    public UserResponse getUser(Long userId) {
        return userClient.findById(userId);
    }

    private UserResponse getUserFallback(Long userId, Throwable t) {
        log.warn("user-service circuit open, userId={}, reason={}", userId, t.getMessage());
        return UserResponse.unknown(userId);
    }
}
```

### Retry

```yaml
resilience4j:
  retry:
    instances:
      payment-service:
        max-attempts: 3
        wait-duration: 500ms
        retry-exceptions:
          - java.net.ConnectException
          - feign.RetryableException
        ignore-exceptions:
          - com.example.BusinessException
```

```java
@Retry(name = "payment-service", fallbackMethod = "paymentFallback")
@CircuitBreaker(name = "payment-service")
public PaymentResult processPayment(PaymentRequest request) {
    return paymentClient.charge(request);
}
```

### Rate Limiter

```yaml
resilience4j:
  ratelimiter:
    instances:
      external-api:
        limit-for-period: 100      # 1초당 100회
        limit-refresh-period: 1s
        timeout-duration: 500ms    # 초과 시 대기 시간
```

```java
@RateLimiter(name = "external-api", fallbackMethod = "rateLimitFallback")
public String callExternalApi(String query) {
    return externalApiClient.search(query);
}
```

### Bulkhead (동시 요청 제한)

```yaml
resilience4j:
  bulkhead:
    instances:
      slow-service:
        max-concurrent-calls: 10   # 최대 동시 10개
        max-wait-duration: 100ms
```

### 복합 어노테이션 순서

```java
// 올바른 순서: Bulkhead → CircuitBreaker → Retry → TimeLimiter
@Bulkhead(name = "service")
@CircuitBreaker(name = "service")
@Retry(name = "service")
@TimeLimiter(name = "service")
public CompletableFuture<String> callService() { ... }
```

---

## Spring Cloud LoadBalancer

Ribbon 대신 사용하는 로드밸런서. Eureka 연동 시 자동 등록된 인스턴스로 라운드로빈/랜덤 분배한다.

```kotlin
implementation("org.springframework.cloud:spring-cloud-starter-loadbalancer")
```

```java
@Configuration
public class LoadBalancerConfig {

    @Bean
    @LoadBalanced  // RestClient/WebClient에 로드밸런싱 적용
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }
}
```

```yaml
spring:
  cloud:
    loadbalancer:
      configurations: random  # round-robin (기본) | random
```

---

## Spring Cloud BOM

의존성 버전 충돌을 방지하기 위해 BOM을 사용한다.

```kotlin
// build.gradle.kts
extra["springCloudVersion"] = "2023.0.3"

dependencyManagement {
    imports {
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:${property("springCloudVersion")}")
    }
}
```

Spring Boot 버전과 Spring Cloud 버전 호환성:

| Spring Boot | Spring Cloud |
|---|---|
| 3.3.x | 2023.0.x |
| 3.2.x | 2023.0.x |
| 3.1.x | 2022.0.x |
