---
title: "Spring Cloud Gateway: 버전별 변경사항과 마이그레이션 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "migration", "changelog"]
---

# Spring Cloud Gateway: 버전별 변경사항과 마이그레이션 가이드

Spring Cloud Gateway를 업그레이드하거나 새 프로젝트에서 버전을 선택할 때 참고할 수 있도록 주요 변경사항과 마이그레이션 방법을 정리한다.

---

## 1. Spring Cloud 버전 체계

### 릴리즈 트레인 → 버전 번호 방식 변경

Spring Cloud는 초기에 알파벳 이름(Angel, Brixton, Camden, ...)을 사용하는 릴리즈 트레인 방식을 사용했다. 2020년부터 연도 기반 버전 번호 방식으로 변경되었다.

| Spring Boot | Spring Cloud | 코드명 |
|---|---|---|
| 2.2.x, 2.3.x | Hoxton (2020.x 이전) | Hoxton.SR12 |
| 2.4.x, 2.5.x | 2020.0.x | Ilford |
| 2.6.x, 2.7.x | 2021.0.x | Jubilee |
| 3.0.x, 3.1.x | 2022.0.x | Kilburn |
| 3.2.x, 3.3.x | 2023.0.x | Leyton |
| 3.4.x | 2024.0.x | Moore |

**Spring Boot와 Spring Cloud 버전 호환 확인:**

```
https://spring.io/projects/spring-cloud#adding-spring-cloud-to-an-existing-spring-boot-application
```

항상 공식 문서의 호환 표를 확인한다. 버전 불일치는 런타임 오류의 주요 원인이다.

### 버전 선택 방법 (build.gradle)

```groovy
// build.gradle
plugins {
    id 'org.springframework.boot' version '3.4.0'
    id 'io.spring.dependency-management' version '1.1.7'
}

ext {
    set('springCloudVersion', "2024.0.0")
}

dependencyManagement {
    imports {
        mavenBom "org.springframework.cloud:spring-cloud-dependencies:${springCloudVersion}"
    }
}

dependencies {
    implementation 'org.springframework.cloud:spring-cloud-starter-gateway'
    // 버전 번호 명시 불필요 - BOM이 관리
}
```

---

## 2. Spring Cloud 2020.x (Hoxton 이후 첫 번호 방식)

**Spring Boot 2.4.x / 2.5.x 대응**

### 주요 변경사항

**bootstrap.yml 기본 비활성화:**

Spring Boot 2.4부터 `bootstrap.yml`이 기본적으로 로드되지 않는다. Config Server를 사용하던 프로젝트는 마이그레이션이 필요하다.

```yaml
# 이전 방식 (bootstrap.yml)
spring:
  cloud:
    config:
      uri: http://config-server:8888

# 새 방식 (application.yml)
spring:
  config:
    import: "configserver:http://config-server:8888"
```

또는 `spring-cloud-starter-bootstrap` 의존성을 추가하면 이전 방식도 계속 사용할 수 있다.

**Spring Cloud Gateway 주요 변경:**
- `RouteLocatorBuilder` DSL 안정화
- `ReactiveLoadBalancerClientFilter` 개선 (Ribbon 제거, Spring Cloud LoadBalancer로 완전 전환)
- Ribbon 관련 자동 설정 제거

```yaml
# Ribbon 제거로 인한 설정 변경
# 이전: ribbon.eureka.enabled=true
# 이후: spring.cloud.loadbalancer.ribbon.enabled=false (이미 기본값)

spring:
  cloud:
    loadbalancer:
      retry:
        enabled: true  # 재시도 활성화
```

---

## 3. Spring Cloud 2022.x (Spring Boot 3.0 지원)

이것이 가장 큰 변화가 있었던 버전이다. Spring Boot 3.0은 Java 17과 Jakarta EE 10을 요구하며, 이에 따라 Gateway 코드도 전면 수정이 필요할 수 있다.

### Jakarta EE 10 전환 (javax → jakarta)

```java
// 이전 코드 (Spring Boot 2.x)
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.FilterChain;

// 새 코드 (Spring Boot 3.x)
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.FilterChain;
```

WebFlux 기반 Gateway는 서블릿을 직접 사용하지 않으므로 Gateway 자체 코드에는 영향이 적다. 그러나 같은 프로젝트에 있는 서블릿 관련 코드(예: Actuator 보안 설정)는 수정이 필요하다.

### Java 17 최소 요구사항

```groovy
// build.gradle
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}
```

Java 8, 11 전용 문법(예: `var` 미사용)을 사용하던 코드는 대부분 그대로 동작하지만, 일부 리플렉션 기반 라이브러리는 Java 17의 강화된 접근 제어(--add-opens 불필요하도록 개선)로 인해 문제가 생길 수 있다.

### Spring Security 6.x API 변경

Spring Security 5에서 6으로 업그레이드 시 WebFlux 보안 설정이 크게 바뀌었다.

```java
// 이전 코드 (Spring Security 5)
@Bean
public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
    return http
            .authorizeExchange()  // deprecated
                .pathMatchers("/public/**").permitAll()
                .anyExchange().authenticated()
                .and()
            .oauth2ResourceServer()
                .jwt()
                .and()
            .build();
}

// 새 코드 (Spring Security 6)
@Bean
public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
    return http
            .authorizeExchange(exchanges -> exchanges
                    .pathMatchers("/public/**").permitAll()
                    .anyExchange().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                    .jwt(Customizer.withDefaults())
            )
            .build();
}
```

### Deprecated된 API 목록 (2022.x 기준)

| Deprecated 항목 | 대체 항목 |
|---|---|
| `EnableDiscoveryClient` | 클래스패스에 구현체만 있으면 자동 활성화 |
| `authorizeExchange()` | `authorizeExchange(Customizer)` |
| `ReactiveUserDetailsServiceAutoConfiguration` | `UserDetailsServiceAutoConfiguration` (조건부) |
| `RouteLocator` 직접 구현 | `RouteLocatorBuilder` DSL 활용 |

---

## 4. Spring Cloud 2023.x

**Spring Boot 3.2.x / 3.3.x 대응**

### Gateway MVC 정식 출시 (GA)

2023.x에서 Gateway MVC가 정식(GA) 출시되었다. 이전까지는 실험적(Experimental) 상태였다.

```groovy
// Gateway MVC 정식 지원
implementation 'org.springframework.cloud:spring-cloud-starter-gateway-mvc'
```

### 성능 개선

- `HttpClient`(Netty 기반) 연결 풀 설정 개선
- 큰 요청/응답 바디 처리 시 메모리 효율 개선

```yaml
spring:
  cloud:
    gateway:
      httpclient:
        connect-timeout: 2000          # ms
        response-timeout: 10s
        pool:
          type: elastic
          max-connections: 500
          max-idle-time: 30s
          max-life-time: 60s
          eviction-interval: 10s       # 2023.x에서 추가
```

### 새로운 필터/Predicate 추가

**JsonToGrpc 필터:** REST → gRPC 변환 지원 (실험적)

```yaml
filters:
  - name: JsonToGrpc
    args:
      protoDescriptor: file:proto/hello.pb
      protoFile: file:proto/hello.proto
      service: HelloService
      method: SayHello
```

**RemoveJsonAttributesResponseBody 필터:** 응답 JSON에서 특정 필드 제거

```yaml
filters:
  - name: RemoveJsonAttributesResponseBody
    args:
      fieldNames: internalId, debugInfo
      deleteRecursively: true
```

---

## 5. Java 17+ 고려사항

### Virtual Thread (Java 21)와 Gateway MVC 조합

Java 21의 Virtual Thread는 블로킹 I/O를 수행하는 스레드의 비용을 크게 낮춘다. Gateway MVC(서블릿 기반)와 결합하면 WebFlux에 근접한 동시성 성능을 얻을 수 있다.

```yaml
# Spring Boot 3.2+ + Java 21
spring:
  threads:
    virtual:
      enabled: true
```

```java
// Virtual Thread 수동 설정 (Spring Boot 3.2 이전)
@Bean
public TomcatProtocolHandlerCustomizer<?> virtualThreadProtocolHandlerCustomizer() {
    return protocolHandler -> {
        protocolHandler.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
    };
}
```

### WebFlux는 Virtual Thread가 필요 없다

WebFlux 기반 Gateway는 이미 이벤트 루프 모델로 논블로킹 I/O를 처리한다. Virtual Thread를 추가로 사용해도 의미 있는 성능 향상이 없고, 오히려 스레드 전환 오버헤드가 발생할 수 있다.

```
Virtual Thread가 유용한 경우: 블로킹 I/O가 많은 서블릿 코드 (Gateway MVC)
Virtual Thread가 불필요한 경우: 이미 논블로킹인 WebFlux 코드
```

---

## 6. 마이그레이션 가이드

### Spring Boot 2.x → 3.x 체크리스트

#### 사전 준비

- [ ] Java 17 이상으로 업그레이드
- [ ] IDE와 빌드 도구(Gradle 7.x+ 또는 Maven 3.6.3+) 업데이트
- [ ] 의존성 버전 호환성 확인 (`./gradlew dependencyInsight`)

#### 패키지 변경

```bash
# 프로젝트 전체에서 javax → jakarta 일괄 변경
find . -name "*.java" -exec sed -i 's/import javax\./import jakarta\./g' {} +

# 단, javax.sql, javax.crypto 등 Java SE 패키지는 변경하지 않는다
# Jakarta EE 패키지만 변경: javax.servlet, javax.persistence, javax.validation 등
```

수동으로 처리해야 할 패키지:

| 이전 | 이후 |
|---|---|
| `javax.servlet.*` | `jakarta.servlet.*` |
| `javax.persistence.*` | `jakarta.persistence.*` |
| `javax.validation.*` | `jakarta.validation.*` |
| `javax.transaction.*` | `jakarta.transaction.*` |
| `javax.annotation.*` | `jakarta.annotation.*` |

유지되는 패키지 (변경 불필요):

| 유지 | 이유 |
|---|---|
| `javax.sql.*` | Java SE 표준 |
| `javax.crypto.*` | Java SE 표준 |
| `javax.net.*` | Java SE 표준 |

#### Spring Security 5 → 6 마이그레이션

```java
// authorizeRequests → authorizeHttpRequests (서블릿 Security)
// 이전
http.authorizeRequests()
        .antMatchers("/public/**").permitAll()
        .anyRequest().authenticated();

// 이후
http.authorizeHttpRequests(auth -> auth
        .requestMatchers("/public/**").permitAll()
        .anyRequest().authenticated()
);
```

```java
// WebFlux Security
// 이전
http.authorizeExchange()
        .pathMatchers("/public/**").permitAll()
        .anyExchange().authenticated()
        .and()
    .csrf().disable();

// 이후
http.authorizeExchange(exchanges -> exchanges
        .pathMatchers("/public/**").permitAll()
        .anyExchange().authenticated()
)
.csrf(CsrfSpec::disable);
```

#### 커스텀 필터 코드 마이그레이션

```java
// 이전: Spring Boot 2.x의 GlobalFilter
// javax.* 사용 없이 작성했다면 변경 불필요

// 그러나 응답 바디를 수정하는 필터는 API가 바뀜
// 이전 방식 (DataBuffer 조작)
@Override
public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
    return chain.filter(exchange.mutate()
            .response(new ModifiedServerHttpResponse(exchange))
            .build());
}

// ModifyResponseBody 필터 팩토리 활용 (권장)
@Bean
public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
    return builder.routes()
            .route("modify-response", r -> r
                    .path("/api/**")
                    .filters(f -> f
                            .modifyResponseBody(String.class, String.class,
                                    (exchange, body) -> {
                                        // 응답 바디 변환 로직
                                        return Mono.just(body.replace("old", "new"));
                                    }))
                    .uri("lb://backend"))
            .build();
}
```

### Deprecated API 대체 방법 정리

| Deprecated | 대체 방법 | 버전 |
|---|---|---|
| `EnableDiscoveryClient` 어노테이션 | 의존성만 추가하면 자동 등록 | 2020.x+ |
| `spring.cloud.gateway.discovery.locator.enabled` 단독 사용 | `lower-case-service-id: true` 함께 설정 | 2021.x+ |
| `Retry` 필터의 `firstBackoffMillis` | `backoff.firstBackoff` | 2022.x+ |
| `ReactorLoadBalancerExchangeFilterFunction` 직접 빈 등록 | `spring-cloud-starter-loadbalancer` 의존성 추가로 자동 구성 | 2022.x+ |
| `spring.cloud.loadbalancer.ribbon.enabled=false` 설정 | Ribbon 의존성 제거 (Spring Boot 3.x에서 Ribbon 미지원) | 2022.x+ |
| `HttpClientProperties.Pool.PoolType.DISABLED` | `PoolType.FIXED` with `maxConnections: 1` | 2023.x+ |
| `SetResponseHeader` 필터로 Content-Type 직접 설정 | `ModifyResponseBody` 필터 활용 | 2022.x+ |

### 마이그레이션 후 검증 체크리스트

```bash
# 1. 모든 라우트가 정상 로드되었는지 확인
curl http://localhost:8080/actuator/gateway/routes | jq '.[].id'

# 2. 헬스 체크
curl http://localhost:8080/actuator/health | jq '.status'

# 3. 각 라우트 동작 확인
curl -v http://localhost:8080/api/users/1

# 4. 필터 동작 확인 (응답 헤더 검증)
curl -I http://localhost:8080/api/users/1 | grep -E "X-|Content-"

# 5. Rate Limit 동작 확인
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/limited/resource
done

# 6. 메트릭 수집 확인
curl http://localhost:8080/actuator/metrics/spring.cloud.gateway.requests | jq
```

**실무 팁:** Spring Boot 3.x로의 마이그레이션은 한 번에 하지 말고 단계적으로 진행한다. 먼저 Spring Boot 2.7.x (LTS)에서 deprecated 경고를 모두 제거하고, 그다음 3.x로 업그레이드하면 마이그레이션 범위를 줄일 수 있다.
