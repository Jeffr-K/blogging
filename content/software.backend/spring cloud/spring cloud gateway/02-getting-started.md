---
title: "Spring Cloud Gateway: 시작하기"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "setup"]
---

# Spring Cloud Gateway: 시작하기

## 의존성 설정

### Gradle (Kotlin DSL)

```kotlin
// build.gradle.kts
plugins {
    id("org.springframework.boot") version "3.4.3"
    id("io.spring.dependency-management") version "1.1.7"
    kotlin("jvm") version "2.1.0"
    kotlin("plugin.spring") version "2.1.0"
}

dependencies {
    // Spring Cloud Gateway (WebFlux 기반)
    implementation("org.springframework.cloud:spring-cloud-starter-gateway")

    // Actuator (라우트 확인, 동적 라우트 관리)
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // 로드 밸런싱 (lb:// URI 스킴 사용 시 필요)
    implementation("org.springframework.cloud:spring-cloud-starter-loadbalancer")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("io.projectreactor:reactor-test")
}

// Spring Cloud BOM — 버전 관리의 핵심
dependencyManagement {
    imports {
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:2024.0.1")
    }
}
```

### Maven

```xml
<!-- pom.xml -->
<properties>
    <spring-cloud.version>2024.0.1</spring-cloud.version>
</properties>

<dependencies>
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-gateway</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
</dependencies>

<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>${spring-cloud.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

---

## spring-boot-starter-web 과의 충돌

Spring Cloud Gateway는 **WebFlux(리액티브)** 기반이므로 `spring-boot-starter-web`(서블릿 기반)과 함께 사용할 수 없습니다.

```kotlin
// 이렇게 하면 안 됩니다!
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")       // 서블릿
    implementation("org.springframework.cloud:spring-cloud-starter-gateway") // WebFlux
}
```

두 의존성이 함께 있으면 Spring Boot가 서블릿 컨텍스트를 우선 선택하려 하고, 게이트웨이가 정상 동작하지 않습니다. 시작 시 다음과 같은 오류를 만날 수 있습니다.

```
Spring MVC found on classpath, which is incompatible with Spring Cloud Gateway.
```

**해결 방법**: `spring-boot-starter-web`을 제거하거나, WebFlux를 명시적으로 강제합니다.

```kotlin
// 해결책 1: web 의존성 제거 (권장)
dependencies {
    // spring-boot-starter-web 제거
    implementation("org.springframework.cloud:spring-cloud-starter-gateway")
}

// 해결책 2: application.yml에서 WebFlux 강제 (임시 방편)
```

```yaml
# application.yml
spring:
  main:
    web-application-type: reactive
```

> **실무 팁:** Gateway 프로젝트는 별도의 독립 모듈로 분리하는 것이 좋습니다. 비즈니스 로직 없이 라우팅/필터만 담당하게 하면 충돌 위험이 없고 관심사 분리도 명확해집니다.

---

## 최소 라우트 설정: application.yml

```yaml
# application.yml
server:
  port: 8080

spring:
  application:
    name: api-gateway

  cloud:
    gateway:
      server:
        webflux:
          routes:
            # 라우트 1: /api/orders/** → order-service
            - id: order-route
              uri: http://localhost:8081
              predicates:
                - Path=/api/orders/**
              filters:
                - StripPrefix=1  # /api/orders/1 → /orders/1
    
            # 라우트 2: /api/users/** → user-service
            - id: user-route
              uri: http://localhost:8082
              predicates:
                - Path=/api/users/**
              filters:
                - StripPrefix=1
    
            # 라우트 3: 여러 조건 조합
            - id: product-v2-route
              uri: http://localhost:8083
              predicates:
                - Path=/api/products/**
                - Method=GET,POST
                - Header=X-Api-Version, v2
              filters:
                - AddRequestHeader=X-Gateway, true
                - StripPrefix=1
```

---

## Java DSL 방식: RouteLocatorBuilder

YAML 대신 코드로 동일한 설정을 구성할 수 있습니다.

```java
// Java
@Configuration
public class GatewayConfig {

    @Bean
    public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
        return builder.routes()
            // 라우트 1: order-service
            .route("order-route", r -> r
                .path("/api/orders/**")
                .filters(f -> f.stripPrefix(1))
                .uri("http://localhost:8081")
            )
            // 라우트 2: user-service
            .route("user-route", r -> r
                .path("/api/users/**")
                .filters(f -> f.stripPrefix(1))
                .uri("http://localhost:8082")
            )
            // 라우트 3: 여러 조건 조합
            .route("product-v2-route", r -> r
                .path("/api/products/**")
                .and()
                .method(HttpMethod.GET, HttpMethod.POST)
                .and()
                .header("X-Api-Version", "v2")
                .filters(f -> f
                    .addRequestHeader("X-Gateway", "true")
                    .stripPrefix(1)
                )
                .uri("http://localhost:8083")
            )
            .build();
    }
}
```

```kotlin
// Kotlin
@Configuration
class GatewayConfig {

    @Bean
    fun customRouteLocator(builder: RouteLocatorBuilder): RouteLocator =
        builder.routes()
            .route("order-route") { r ->
                r.path("/api/orders/**")
                    .filters { f -> f.stripPrefix(1) }
                    .uri("http://localhost:8081")
            }
            .route("user-route") { r ->
                r.path("/api/users/**")
                    .filters { f -> f.stripPrefix(1) }
                    .uri("http://localhost:8082")
            }
            .build()
}
```

---

## YAML 방식 vs Java DSL 방식 비교

| 항목 | YAML 방식 | Java DSL 방식 |
|------|-----------|---------------|
| **코드 가독성** | 선언적, 직관적 | 코드 기반, IDE 자동완성 지원 |
| **타입 안전성** | 없음 (문자열 기반) | 있음 (컴파일 타임 검증) |
| **동적 설정** | 프로파일/Config Server 활용 | 빈 조건부 등록(`@ConditionalOn*`) 활용 |
| **복잡한 로직** | 제한적 | 자유로운 Java/Kotlin 코드 활용 가능 |
| **Spring Cloud Config 연동** | 매우 편리 | 별도 처리 필요 |
| **팀 선호도** | DevOps/운영팀 친화적 | 개발팀 친화적 |

**선택 기준:**
- 라우트 설정이 환경별로 자주 바뀌거나, Spring Cloud Config로 외부화할 계획이면 → **YAML 방식**
- 라우트 조건에 복잡한 비즈니스 로직이 필요하거나, Kotlin의 타입 시스템을 활용하고 싶으면 → **Java DSL 방식**
- 두 방식을 혼용하는 것도 가능합니다. YAML로 정의한 라우트와 `@Bean`으로 등록한 라우트가 모두 동작합니다.

---

## GatewayAutoConfiguration 동작 방식

Spring Boot의 자동 구성 메커니즘(`@EnableAutoConfiguration`)에 의해 `GatewayAutoConfiguration` 이 활성화됩니다.

```
spring-cloud-gateway-server.jar
  └── META-INF/spring/
        └── org.springframework.boot.autoconfigure.AutoConfiguration.imports
              └── GatewayAutoConfiguration
              └── GatewayReactiveLoadBalancerClientAutoConfiguration
              └── GatewayDiscoveryClientAutoConfiguration
              ...
```

`GatewayAutoConfiguration`이 등록하는 주요 빈:

| 빈 | 역할 |
|----|------|
| `RoutePredicateHandlerMapping` | 요청을 받아 매칭 Route를 찾는 핵심 매핑 |
| `FilteringWebHandler` | 매칭된 Route의 Filter 체인을 실행 |
| `RouteLocator` | 모든 Route 정의의 집합체 |
| `RouteDefinitionLocator` | YAML/Java DSL 정의를 `RouteDefinition`으로 변환 |
| `GatewayControllerEndpoint` | Actuator 엔드포인트 (`/actuator/gateway/*`) |
| 빌트인 PredicateFactory들 | `PathRoutePredicateFactory`, `MethodRoutePredicateFactory` 등 |
| 빌트인 FilterFactory들 | `AddRequestHeaderGatewayFilterFactory` 등 |

`GatewayAutoConfiguration`은 `@ConditionalOnClass(ReactiveHttpInputMessage.class)`와 `@ConditionalOnWebApplication(type = REACTIVE)`가 붙어 있어, WebFlux 환경에서만 활성화됩니다.

---

## 실행 및 라우트 확인

### 애플리케이션 시작 로그

애플리케이션을 시작하면 등록된 라우트 정보가 DEBUG 레벨로 출력됩니다.

```yaml
# DEBUG 로깅 활성화
logging:
  level:
    org.springframework.cloud.gateway: DEBUG
    reactor.netty: DEBUG
```

```
DEBUG o.s.c.g.r.RouteDefinitionRouteLocator :
  Loaded RoutePredicateFactory [Path]

DEBUG o.s.c.g.h.RoutePredicateHandlerMapping :
  Mapping [Exchange: GET http://localhost:8080/api/orders/1] to
  Route{id='order-route', uri=http://localhost:8081, ...}
```

### Actuator 엔드포인트로 라우트 확인

```yaml
# application.yml — Actuator 노출 설정
management:
  endpoints:
    web:
      exposure:
        include: gateway, health, info
  endpoint:
    gateway:
      enabled: true
```

```bash
# 등록된 모든 라우트 조회
curl http://localhost:8080/actuator/gateway/routes | jq .

# 특정 라우트 조회
curl http://localhost:8080/actuator/gateway/routes/order-route | jq .

# GlobalFilter 목록 조회
curl http://localhost:8080/actuator/gateway/globalfilters | jq .

# GatewayFilter 팩토리 목록 조회
curl http://localhost:8080/actuator/gateway/routefilters | jq .
```

응답 예시:

```json
[
  {
    "predicate": "Paths: [/api/orders/**], match trailing slash: true",
    "metadata": {},
    "uri": "http://localhost:8081",
    "filters": ["[[StripPrefix parts = 1], order = 1]"],
    "order": 0,
    "route_id": "order-route"
  }
]
```

### 간단한 동작 테스트

```bash
# Gateway를 통해 order-service 호출
# 실제 전달: GET http://localhost:8081/orders/1
curl http://localhost:8080/api/orders/1

# 응답 헤더 확인 (-v 옵션)
curl -v http://localhost:8080/api/orders/1
```

---

## 최소 프로젝트 구조

```
api-gateway/
├── src/
│   └── main/
│       ├── kotlin/com/example/gateway/
│       │   ├── GatewayApplication.kt
│       │   └── config/
│       │       └── GatewayConfig.kt      # Java DSL 방식 사용 시
│       └── resources/
│           ├── application.yml           # 기본 설정
│           ├── application-local.yml     # 로컬 환경
│           └── application-prod.yml      # 운영 환경
├── build.gradle.kts
└── settings.gradle.kts
```

```kotlin
// GatewayApplication.kt
@SpringBootApplication
class GatewayApplication

fun main(args: Array<String>) {
    runApplication<GatewayApplication>(*args)
}
```

> **실무 팁:** `@EnableDiscoveryClient`는 Spring Boot 3.x에서 자동으로 활성화되므로 별도로 추가할 필요가 없습니다. `spring-cloud-starter-netflix-eureka-client` 또는 `spring-cloud-starter-kubernetes-client` 의존성만 추가하면 됩니다.
