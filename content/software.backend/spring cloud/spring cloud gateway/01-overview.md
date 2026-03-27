---
title: "Spring Cloud Gateway: 개요와 핵심 아키텍처"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "api-gateway", "webflux"]
---

# Spring Cloud Gateway: 개요와 핵심 아키텍처

## API Gateway 패턴이란?

마이크로서비스 아키텍처에서 수십 개의 서비스가 각각의 엔드포인트를 노출하면, 클라이언트가 직접 각 서비스를 호출하는 방식은 여러 문제를 일으킵니다. **API Gateway**는 모든 클라이언트 요청의 단일 진입점(Single Entry Point)으로 동작하며, 다음 횡단 관심사(Cross-Cutting Concerns)를 한 곳에서 처리합니다.

| 역할 | 설명 |
|------|------|
| **인증 / 인가** | JWT 검증, OAuth2 토큰 확인을 각 서비스 대신 게이트웨이에서 처리 |
| **라우팅** | 요청 경로/헤더/파라미터 기반으로 적절한 하위 서비스로 전달 |
| **로드 밸런싱** | 여러 인스턴스 간 트래픽 분산 (Eureka, Kubernetes 연동) |
| **Rate Limiting** | 초당 요청 수 제한으로 서비스 보호 |
| **서킷 브레이커** | 하위 서비스 장애 시 빠른 실패(Fail Fast)와 폴백 처리 |
| **요청/응답 변환** | 헤더 추가/제거, 경로 재작성, 바디 변환 |
| **CORS 처리** | 전역 CORS 정책 일괄 적용 |
| **모니터링** | 요청 로깅, 분산 추적(Trace ID) 주입 |

---

## Zuul vs Spring Cloud Gateway 비교

Spring 진영의 API Gateway는 세대를 거쳐 발전해 왔습니다.

| 항목 | Zuul 1.x | Zuul 2 | Spring Cloud Gateway |
|------|----------|--------|----------------------|
| **I/O 모델** | 블로킹 (Servlet) | 논블로킹 (Netty) | 논블로킹 (Reactor Netty) |
| **스레드 모델** | 스레드-퍼-요청 | 이벤트 루프 | 이벤트 루프 |
| **기반 프레임워크** | Servlet API | Netty | WebFlux + Project Reactor |
| **Spring 통합** | 매우 좋음 | 보통 | 매우 좋음 (First-class) |
| **유지보수** | Maintenance 모드 | Netflix 내부 사용 | 활발한 개발 |
| **필터 모델** | ZuulFilter | ZuulFilter | GatewayFilter / GlobalFilter |
| **Spring Boot 3.x** | 미지원 | 미지원 | 완전 지원 |

Netflix는 Zuul 2를 내부적으로 사용하지만, Spring Cloud 진영에서는 공식적으로 Spring Cloud Gateway를 표준으로 채택했습니다. Zuul 1.x는 현재 Maintenance 모드입니다.

---

## Spring MVC vs WebFlux 차이 이해하기

Spring Cloud Gateway(WebFlux 기반)를 제대로 이해하려면 두 모델의 차이를 알아야 합니다.

### Spring MVC — 서블릿, 스레드-퍼-요청

```
요청 → Tomcat 스레드 풀에서 스레드 할당 → 컨트롤러 처리(블로킹 가능) → 응답
```

- 각 요청이 하나의 스레드를 독점합니다.
- DB 호출, 외부 API 호출 등 I/O 대기 시간에도 스레드가 점유됩니다.
- 동시 요청 수 = 스레드 풀 크기 (보통 200개 내외)
- 직관적이고 디버깅이 쉽습니다.

### WebFlux — 이벤트 루프, 논블로킹

```
요청 → 이벤트 루프 스레드(소수) → 논블로킹 I/O 처리 → 콜백/리액티브 파이프라인 → 응답
```

- CPU 코어 수 × 2 개의 이벤트 루프 스레드로 수천 개의 동시 요청 처리
- I/O 대기 중에 스레드를 반납하고 다른 요청을 처리
- Project Reactor의 `Mono<T>`, `Flux<T>`로 비동기 파이프라인 구성
- 블로킹 코드를 이벤트 루프에서 직접 실행하면 심각한 성능 저하 발생

> **실무 팁:** Spring Cloud Gateway는 WebFlux 기반이므로 `GatewayFilter`, `GlobalFilter` 구현 시 절대 블로킹 코드(`Thread.sleep`, JDBC 직접 호출 등)를 이벤트 루프 스레드에서 실행하면 안 됩니다. 불가피하다면 `Schedulers.boundedElastic()`으로 오프로드해야 합니다.

---

## 내부 구현: Reactor Netty + Project Reactor

Spring Cloud Gateway는 다음 레이어 위에서 동작합니다.

```
┌─────────────────────────────────────┐
│        Spring Cloud Gateway         │
│  (Route / Predicate / Filter API)   │
├─────────────────────────────────────┤
│           Spring WebFlux            │
│    (DispatcherHandler, Codecs)      │
├─────────────────────────────────────┤
│          Project Reactor            │
│       (Mono, Flux, Scheduler)       │
├─────────────────────────────────────┤
│          Reactor Netty              │
│     (Non-blocking HTTP Server)      │
├─────────────────────────────────────┤
│         Netty (NIO)                 │
│    (Java NIO, epoll, kqueue)        │
└─────────────────────────────────────┘
```

- **Reactor Netty**: Netty 위에 리액티브 API를 제공하는 HTTP 서버/클라이언트. Spring Cloud Gateway는 이를 내장 서버이자 HTTP 클라이언트로 사용합니다.
- **Project Reactor**: `Mono<T>`(0-1개 항목), `Flux<T>`(0-N개 항목) 타입으로 비동기 스트림을 구성합니다. 모든 요청 처리 파이프라인이 리액티브 시퀀스로 표현됩니다.
- **`ServerWebExchange`**: WebFlux의 핵심 타입으로, HTTP 요청(`ServerHttpRequest`)과 응답(`ServerHttpResponse`)을 함께 보유합니다. Gateway의 모든 Filter는 이 객체를 통해 요청/응답에 접근합니다.

---

## Spring Cloud Gateway MVC (6.x 이후)

Spring Cloud 2023.x(Spring Boot 3.2+)부터 **서블릿 기반** Gateway가 GA로 출시되었습니다.

```xml
<!-- WebFlux 기반 (기존) -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>

<!-- MVC 기반 (서블릿, Spring Boot 3.2+) -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway-mvc</artifactId>
</dependency>
```

Gateway MVC는 `RestClient`(Spring 6.1의 블로킹 HTTP 클라이언트)와 `ProxyExchange`를 기반으로 동작합니다. 기존 Spring MVC 애플리케이션에 Gateway 기능을 추가하거나, WebFlux 학습 곡선 없이 Gateway를 도입할 때 유용합니다. 단, 리액티브 I/O의 성능 이점은 없습니다.

이 시리즈는 WebFlux 기반 Spring Cloud Gateway를 다룹니다.

---

## 핵심 3요소: Route / Predicate / Filter

Spring Cloud Gateway의 모든 동작은 세 가지 핵심 개념으로 구성됩니다.

| 개념 | 역할 | 예시 |
|------|------|------|
| **Route** | 라우팅 규칙의 단위. id, uri, predicates, filters로 구성 | `id: order-route, uri: lb://order-service` |
| **Predicate** | 요청이 특정 라우트에 매칭되는지 판단하는 조건 | `Path=/api/orders/**` |
| **Filter** | 매칭된 라우트에서 요청/응답을 가공하는 컴포넌트 | `AddRequestHeader=X-User-Id, 12345` |

---

## 요청 처리 파이프라인

다음은 클라이언트 요청이 Spring Cloud Gateway를 통과하는 전체 흐름입니다.

```
클라이언트
    │
    │  HTTP Request
    ▼
┌──────────────────────────────────────────────────────┐
│                  Reactor Netty Server                │
│              (Non-blocking I/O 수신)                 │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│               HttpWebHandlerAdapter                  │
│         (ServerWebExchange 생성)                     │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│               DispatcherHandler                      │
│         (WebFlux 중앙 디스패처)                      │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│             FilteringWebHandler                      │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │           GlobalFilter 체인 실행               │  │
│  │  (RoutePredicateHandlerMapping이 라우트 매칭)   │  │
│  │                                                │  │
│  │  1. RoutePredicateHandlerMapping               │  │
│  │     → Predicate 평가 (Path? Method? Header?)   │  │
│  │     → 매칭된 Route 선택 → Exchange에 저장      │  │
│  │                                                │  │
│  │  2. GlobalFilter (Pre 단계)                    │  │
│  │     → ReactiveLoadBalancerClientFilter         │  │
│  │       (lb:// → 실제 호스트:포트 변환)           │  │
│  │     → 커스텀 GlobalFilter들                    │  │
│  │                                                │  │
│  │  3. GatewayFilter (Route 단위, Pre 단계)       │  │
│  │     → AddRequestHeader, RewritePath 등 실행    │  │
│  │                                                │  │
│  └──────────────────────┬─────────────────────────┘  │
└─────────────────────────┼────────────────────────────┘
                          │
                          │  가공된 요청 전달
                          ▼
              ┌───────────────────────┐
              │   Reactor Netty       │
              │   HTTP Client         │
              │   (하위 서비스 호출)  │
              └──────────┬────────────┘
                         │
              ┌──────────▼────────────┐
              │    하위 서비스        │
              │ (order-service 등)    │
              └──────────┬────────────┘
                         │
                         │  HTTP Response
                         ▼
              ┌──────────────────────────────────────┐
              │  GatewayFilter (Post 단계, 역순 실행) │
              │  GlobalFilter  (Post 단계, 역순 실행) │
              └──────────────────────┬───────────────┘
                                     │
                                     ▼
                                  클라이언트
```

### 처리 순서 핵심 규칙

1. **Predicate 평가**: `RoutePredicateHandlerMapping`이 등록된 모든 Route의 Predicate를 평가합니다. 첫 번째로 매칭된 Route가 선택됩니다(order 기준).
2. **Pre 필터**: GlobalFilter → GatewayFilter 순서로 `chain.filter()` 호출 전 로직 실행
3. **프록시 요청**: `NettyRoutingFilter`가 실제 HTTP 요청을 하위 서비스로 전달
4. **Post 필터**: 응답 수신 후 `chain.filter()` 이후 로직이 **역순**으로 실행 (`.then(Mono.fromRunnable(...))` 패턴)

---

## 실무 팁

### 게이트웨이가 적합한 경우

- 인증/인가를 중앙에서 처리하고 싶을 때
- 마이크로서비스 간 API 버전 관리가 필요할 때
- Rate Limiting, 서킷 브레이커를 각 서비스에 중복 구현하기 싫을 때
- 카나리 배포, A/B 테스트를 인프라 수준에서 처리할 때

### 게이트웨이가 적합하지 않은 경우

- 단순한 모놀리식 애플리케이션 (오버엔지니어링)
- 게이트웨이 자체가 병목이 될 수 있는 초고성능 요구사항 (이 경우 Nginx/Envoy 검토)
- 응답 집계(Aggregation)가 주 목적인 경우 (BFF 패턴은 별도 서비스로 분리 권장)

### 버전 정보

| Spring Boot | Spring Cloud | Gateway 버전 |
|-------------|--------------|--------------|
| 3.2.x | 2023.0.x | 4.1.x |
| 3.3.x | 2023.0.x | 4.1.x |
| 3.4.x | 2024.0.x | 4.2.x |

Spring Cloud의 BOM(Bill of Materials)을 통해 버전을 관리하면 호환성 문제를 피할 수 있습니다.
