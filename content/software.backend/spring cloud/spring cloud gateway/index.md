# Spring Cloud Gateway 완전 학습 인덱스

---

## 1. 개요 & 배경

### Spring Cloud Gateway란?
- API Gateway 패턴의 역할
- Spring Cloud Gateway vs Zuul 1.x / Zuul 2
- Spring MVC(서블릿) vs WebFlux(리액티브) 기반 차이
- 내부 구현 — Reactor Netty + Project Reactor
- Spring Cloud Gateway MVC (6.x 이후 서블릿 지원) 소개

### 핵심 구성 요소
- Route — 라우팅 단위 (id, uri, predicates, filters)
- Predicate — 요청 매칭 조건
- Filter — 요청/응답 변환 및 횡단 관심사
- 요청 처리 파이프라인 흐름

---

## 2. 시작하기

### 의존성 설정
- `spring-cloud-starter-gateway` (WebFlux 기반)
- `spring-cloud-starter-gateway-mvc` (서블릿 기반, 6.x+)
- Spring Cloud BOM 버전 관리
- 주의: `spring-boot-starter-web`과의 충돌

### 최소 설정 예제
- `application.yml` 기반 라우트 정의
- Java DSL(`RouteLocatorBuilder`) 기반 정의
- 자동 구성(`GatewayAutoConfiguration`) 동작 방식

---

## 3. Route (라우트)

### Route 구성 요소
- `id` — 라우트 식별자
- `uri` — 목적지 (http://, https://, lb://)
- `predicates` — 매칭 조건 목록
- `filters` — 적용 필터 목록
- `metadata` — 부가 설정 (connect-timeout, response-timeout 등)
- `order` — 라우트 우선순위

### RouteLocator 정의 방식
- YAML/Properties 선언형 방식
- `RouteLocatorBuilder` Java DSL 방식
- `@Bean RouteLocator` 등록
- 두 방식 혼합 사용

### 동적 라우트
- `RouteDefinitionRepository` 인터페이스
- `InMemoryRouteDefinitionRepository` (기본 구현)
- 커스텀 저장소 구현 (Redis, DB 기반)
- Actuator API를 통한 런타임 라우트 CRUD
- `RefreshRoutesEvent` — 라우트 갱신 이벤트

---

## 4. Predicate (조건 팩토리)

### 경로 & 메서드
- `Path` — Ant 패턴 경로 매칭 (`/api/**`)
- `Method` — HTTP 메서드 매칭
- `Host` — 호스트 헤더 패턴 매칭

### 헤더 & 파라미터
- `Header` — 헤더 존재 및 정규식 매칭
- `Query` — 쿼리 파라미터 매칭
- `Cookie` — 쿠키 값 매칭

### 시간 기반
- `After` — 특정 시각 이후
- `Before` — 특정 시각 이전
- `Between` — 시간 범위 내

### 네트워크
- `RemoteAddr` — 클라이언트 IP/CIDR 매칭
- `XForwardedRemoteAddr` — 프록시 환경 IP 매칭

### 트래픽 분산
- `Weight` — 가중치 기반 라우트 분기 (A/B, 카나리)

### 커스텀 Predicate
- `AbstractRoutePredicateFactory<C>` 상속
- Config 클래스 설계
- `shortcutFieldOrder` 구현
- YAML에서 단축 표기 사용

---

## 5. Filter (필터 팩토리)

### 요청 헤더 조작
- `AddRequestHeader` / `SetRequestHeader` / `RemoveRequestHeader`
- `MapRequestHeader` — 헤더 값 복사·변환
- `DedupeResponseHeader` — 중복 헤더 제거

### 응답 헤더 조작
- `AddResponseHeader` / `SetResponseHeader` / `RemoveResponseHeader`
- `SecureHeaders` — 보안 응답 헤더 자동 추가

### 경로 조작
- `RewritePath` — 정규식 경로 재작성
- `StripPrefix` — 앞 경로 세그먼트 제거
- `PrefixPath` — 경로 앞에 prefix 추가
- `SetPath` — 경로 고정 설정

### 상태 & 리다이렉트
- `SetStatus` — 응답 상태 코드 재설정
- `RedirectTo` — HTTP 리다이렉트

### 요청/응답 본문 수정
- `ModifyRequestBody` — 요청 바디 변환 (리액티브)
- `ModifyResponseBody` — 응답 바디 변환 (리액티브)
- `RequestSize` — 요청 크기 제한

### 재시도 & 복원력
- `Retry` — 재시도 횟수, 상태코드, 메서드, 백오프 설정
- `CircuitBreaker` — Resilience4j 연동, fallbackUri 설정
- `FallbackHeaders` — 폴백 요청에 에러 정보 헤더 추가

### Rate Limiting
- `RequestRateLimiter` — 요청 속도 제한
- `RedisRateLimiter` — Redis 토큰 버킷 구현
- `KeyResolver` — 제한 키 추출 (IP, 사용자, API Key 등)

### 세션 & 인증
- `SaveSession` — WebSession 강제 저장
- `TokenRelay` — OAuth2 Access Token 하위 서비스 전달
- `PreserveHostHeader` — 원본 Host 헤더 유지

### GlobalFilter
- `GlobalFilter` 인터페이스 구현
- `GatewayFilter` vs `GlobalFilter` 차이
- `Ordered` / `@Order` — 필터 실행 순서
- 빌트인 글로벌 필터 목록
  - `NettyRoutingFilter`
  - `NettyWriteResponseFilter`
  - `LoadBalancerClientFilter`
  - `WebsocketRoutingFilter`
  - `ForwardRoutingFilter`
  - `ReactiveLoadBalancerClientFilter`

### 커스텀 Filter
- `AbstractGatewayFilterFactory<C>` 상속
- Pre/Post 처리 패턴 (`chain.filter(exchange).then(...)`)
- `ServerWebExchange` 활용
- 필터 내 에러 처리

---

## 6. 로드 밸런싱

### Spring Cloud LoadBalancer 통합
- `lb://service-name` URI 스킴
- `ReactiveLoadBalancerClientFilter` 동작 원리
- 라운드 로빈 / 랜덤 알고리즘
- 커스텀 `ReactorServiceInstanceLoadBalancer`

### 서비스 디스커버리 연동
- Eureka 클라이언트 통합
- Consul 통합
- Kubernetes 서비스 디스커버리
- `DiscoveryClient` 기반 자동 라우트 (`spring.cloud.gateway.discovery.locator.enabled`)
- 자동 생성 라우트 커스터마이징

---

## 7. Circuit Breaker

### Resilience4j 통합
- `spring-cloud-starter-circuitbreaker-reactor-resilience4j` 의존성
- `CircuitBreakerFilter` 설정
- `fallbackUri` — 폴백 경로 지정 (`forward:/fallback`)
- 상태코드 기반 회로 차단 (`recordFailureBasedOnStatusCode`)

### CircuitBreaker 설정
- `Resilience4JCircuitBreakerFactory` 커스터마이징
- TimeLimiter 설정
- `application.yml` Resilience4j 속성 구성
- 슬라이딩 윈도우 / 실패율 임계값

---

## 8. Rate Limiting

### Redis 기반 Rate Limiter
- `spring-boot-starter-data-redis-reactive` 의존성
- `RedisRateLimiter` 설정 (replenishRate, burstCapacity, requestedTokens)
- Lua 스크립트 기반 원자적 토큰 버킷

### KeyResolver 구현
- IP 기반 (`exchange.getRequest().getRemoteAddress()`)
- 헤더 기반 (API Key, Authorization)
- Principal 기반 (인증된 사용자)
- SpEL 표현식 활용

### 커스텀 Rate Limiter
- `RateLimiter<C>` 인터페이스 구현
- Bucket4j 등 외부 라이브러리 연동

---

## 9. 보안

### Spring Security 통합
- WebFlux Security 설정 (`ReactiveSecurityFilterChain`)
- 경로별 접근 권한 설정
- `SecurityWebFilterChain` 구성

### OAuth2 / OIDC
- OAuth2 Resource Server 설정 (JWT 검증)
- OAuth2 Client 설정 (로그인 흐름)
- `TokenRelay` 필터로 토큰 하위 전달
- `spring-security-oauth2-resource-server` 의존성

### JWT 처리
- `ReactiveJwtDecoder` 설정
- JWK Set URI 자동 키 회전
- JWT 클레임 기반 인가
- 커스텀 JWT 검증 필터

### CORS
- `spring.cloud.gateway.globalcors` 설정
- 라우트별 `DedupeResponseHeader` 중복 제거
- Spring Security CORS와의 관계

### 기타 보안
- `SecureHeaders` 필터 — HSTS, X-Frame-Options, CSP 등
- HTTPS/TLS 강제 설정
- IP 화이트리스트/블랙리스트 (RemoteAddr Predicate)

---

## 10. 모니터링 & 관찰성

### Actuator 통합
- `spring-boot-starter-actuator` 연동
- `/actuator/gateway/routes` — 등록된 라우트 조회
- `/actuator/gateway/globalfilters` — 글로벌 필터 목록
- `/actuator/gateway/routefilters` — 라우트 필터 팩토리 목록
- `/actuator/gateway/refresh` — 라우트 캐시 갱신
- 런타임 라우트 CRUD API

### 메트릭
- Micrometer 기반 메트릭
- `spring.cloud.gateway.metrics.enabled`
- `spring.cloud.gateway.httpserver.requests` 타이머
- Prometheus / Grafana 연동
- 커스텀 메트릭 추가

### 분산 추적
- Micrometer Tracing (Spring Boot 3.x)
- Brave / OpenTelemetry 브릿지
- Zipkin / Jaeger 연동
- TraceId / SpanId 전파 헤더

### 로깅
- Reactor Netty 액세스 로그 (`reactor.netty.http.server.AccessLog`)
- MDC를 통한 요청 컨텍스트 로깅
- 커스텀 로깅 GlobalFilter 구현
- 요청/응답 바디 로깅 (주의사항 포함)

---

## 11. 고급 설정

### TLS/SSL
- HTTPS 리스너 설정
- 자체 서명 인증서 / Let's Encrypt
- Mutual TLS (mTLS) 설정
- 하위 서비스 SSL 신뢰 설정

### HTTP/2
- Reactor Netty HTTP/2 활성화
- h2c (cleartext HTTP/2)
- HTTP/2 → HTTP/1.1 다운그레이드

### WebSocket 라우팅
- `WebsocketRoutingFilter` 동작 원리
- `ws://`, `wss://` URI 지원
- WebSocket 라우트 설정
- 타임아웃 주의사항

### SSE (Server-Sent Events)
- 스트리밍 응답 라우팅
- 응답 버퍼링 비활성화

### 요청/응답 본문 수정 심화
- `RewriteFunction<S, T>` 구현
- 대용량 바디 처리 주의사항
- 스트리밍 vs 버퍼링 방식

---

## 12. 성능 & 튜닝

### Reactor Netty 설정
- `spring.cloud.gateway.httpclient.*` 속성
- 커넥션 풀 설정 (maxConnections, pendingAcquireMaxCount)
- Keep-Alive 설정

### 타임아웃 설정
- 글로벌 `connect-timeout` / `response-timeout`
- 라우트별 타임아웃 (`metadata`)
- Read/Write 타임아웃

### 버퍼 & 메모리
- `spring.codec.max-in-memory-size`
- Netty 버퍼 풀 설정
- 대용량 파일 스트리밍 처리

### 스레드 모델 이해
- 이벤트 루프 스레드 vs 워커 스레드
- 블로킹 코드 금지 원칙 (`Schedulers.boundedElastic()` 활용)
- 백프레셔(Backpressure)와 게이트웨이

---

## 13. 실무 패턴

### API 버전 관리
- 경로 기반 버전 (`/v1/`, `/v2/`)
- 헤더 기반 버전 (`Accept-Version`)
- `RewritePath`를 활용한 버전 제거

### 인증/인가 게이트웨이 패턴
- JWT 검증 후 헤더 주입 패턴
- 서비스별 권한 위임
- API Key 인증 게이트웨이

### BFF (Backend for Frontend) 패턴
- 클라이언트 유형별 라우팅 (모바일/웹)
- 응답 변환 및 집계 (제한적 지원)
- GraphQL BFF 연동

### 트래픽 분산 패턴
- 카나리 배포 (`Weight` Predicate)
- 블루/그린 배포 (라우트 전환)
- A/B 테스트
- 헤더 기반 스티키 세션

### 요청 로깅 & 감사
- 요청/응답 로깅 GlobalFilter 구현
- 민감 정보 마스킹
- 감사 로그 비동기 처리

### API 조합 (제한적)
- `ModifyResponseBody`를 통한 응답 변환
- 외부 서비스 호출 필터 (주의: 복잡도)
- WebClient 활용 패턴

### Multi-tenancy
- 테넌트 식별 (헤더, 경로, 도메인)
- 테넌트별 라우트 동적 생성
- 테넌트별 Rate Limit

---

## 14. 테스트

### 단위 테스트
- `GatewayFilterFactory` 단위 테스트
- `MockServerWebExchange` 활용
- Predicate 단위 테스트

### 통합 테스트
- `@SpringBootTest(webEnvironment = RANDOM_PORT)`
- `WebTestClient` 기반 E2E 테스트
- `WireMock` / `MockWebServer` 하위 서비스 모킹
- `@AutoConfigureWireMock`

### 라우트 테스트
- 라우트 매칭 검증
- 필터 동작 검증
- 타임아웃 / 재시도 테스트
- Circuit Breaker 폴백 테스트

---

## 15. 운영 & 배포

### 헬스 체크
- `/actuator/health` 엔드포인트
- 하위 서비스 Health Indicator 연동
- Kubernetes Liveness / Readiness Probe 설정

### 그레이스풀 셧다운
- `server.shutdown=graceful` 설정
- 진행 중인 요청 완료 대기
- 타임아웃 설정 (`spring.lifecycle.timeout-per-shutdown-phase`)

### 설정 외부화
- Spring Cloud Config 연동
- Kubernetes ConfigMap / Secret
- 환경별 프로파일 (`application-prod.yml`)
- 암호화된 설정값 처리

### 컨테이너 & 오케스트레이션
- Docker 이미지 최적화 (레이어 캐싱)
- Kubernetes Deployment / Service 설정
- Ingress vs Spring Cloud Gateway 역할 구분
- Helm Chart 구성

### 스케일링
- 수평 확장 시 세션/상태 고려사항
- Redis 기반 상태 공유 (Rate Limit, 세션)
- 로드 밸런서(L4/L7) 앞단 구성

---

## 16. Spring Cloud Gateway MVC (서블릿 기반)

- 등장 배경 — WebFlux 도입 장벽 해소
- `spring-cloud-starter-gateway-mvc` 설정
- WebFlux 버전과의 기능 차이
- `ProxyExchange` 기반 동작 방식
- 마이그레이션 고려사항

---

## 17. 버전별 주요 변경사항

- Spring Cloud 2020.x (Hoxton 이후) 변화
- Spring Cloud 2022.x (Kilburn) — Spring Boot 3.x 지원
- Spring Cloud 2023.x — Gateway MVC GA
- Java 17+ / Virtual Thread 고려사항
- Deprecated API 및 마이그레이션 가이드
