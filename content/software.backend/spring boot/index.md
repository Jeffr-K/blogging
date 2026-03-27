# Spring Boot 완전 학습 인덱스

---

## 1. 개요 & 배경

### Spring Boot란?
- Spring Framework와의 관계
- "Convention over Configuration" 철학
- Spring Boot가 해결한 문제들 (XML 설정, 의존성 충돌, 내장 서버)
- Spring Boot vs Spring Framework 직접 사용 비교
- Spring Boot 3.x 주요 변화 (Java 17 베이스라인, Jakarta EE 10)

### 핵심 특징
- Auto Configuration — 자동 구성 메커니즘
- Starter 의존성 — 의존성 묶음 관리
- 내장 서버 (Tomcat, Jetty, Undertow)
- Production-ready 기능 (Actuator)
- Spring Initializr

---

## 2. 시작하기

### 프로젝트 생성
- Spring Initializr (start.spring.io)
- IntelliJ IDEA / VS Code 플러그인
- Spring Boot CLI
- Maven Wrapper (`mvnw`) / Gradle Wrapper (`gradlew`)

### 프로젝트 구조
- 표준 디렉터리 레이아웃
- `@SpringBootApplication` 위치와 컴포넌트 스캔 범위
- `resources/` 디렉터리 구조 (static, templates, application.yml)
- `src/test/` 구조

### 첫 애플리케이션 실행
- `SpringApplication.run()`의 동작 원리
- 내장 Tomcat 기동 흐름
- 배너 커스터마이징 (`banner.txt`)
- 종료 코드 (`ExitCodeGenerator`)

---

## 3. 자동 구성 (Auto Configuration)

### 동작 원리
- `@EnableAutoConfiguration` / `@SpringBootApplication`
- `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- `@Conditional` 어노테이션 계열
  - `@ConditionalOnClass` / `@ConditionalOnMissingClass`
  - `@ConditionalOnBean` / `@ConditionalOnMissingBean`
  - `@ConditionalOnProperty`
  - `@ConditionalOnWebApplication`
  - `@ConditionalOnResource`
  - `@ConditionalOnExpression`

### 자동 구성 디버깅
- `--debug` 플래그 / `logging.level.` 설정
- Conditions Evaluation Report 읽기
- `/actuator/conditions` 엔드포인트
- 자동 구성 제외 (`exclude` 속성)

### 커스텀 Auto Configuration 작성
- `@AutoConfiguration` 어노테이션
- `AutoConfiguration.imports` 등록
- `@AutoConfigureBefore` / `@AutoConfigureAfter` / `@AutoConfigureOrder`
- 스타터 라이브러리 제작 패턴

---

## 4. 설정 관리 (Configuration)

### application.properties / application.yml
- 두 형식 비교 및 혼용
- YAML 다중 문서 (`---` 구분자)
- 계층 구조 바인딩

### 설정 우선순위 (Property Sources)
- 17가지 설정 소스와 우선순위 순서
- 커맨드라인 인수 (`--key=value`)
- 환경 변수 바인딩 (대소문자·점·언더스코어 변환 규칙)
- JVM 시스템 프로퍼티 (`-Dkey=value`)
- `@PropertySource` 커스텀 소스 등록

### 프로파일 (Profiles)
- `spring.profiles.active` 설정
- `application-{profile}.yml` 파일 분리
- `@Profile` 어노테이션
- 프로파일 그룹 (`spring.profiles.group`)
- 프로파일 중첩 활성화

### `@ConfigurationProperties`
- 타입 안전 설정 바인딩
- `@EnableConfigurationProperties`
- Record 기반 `@ConfigurationProperties` (Spring Boot 2.6+)
- 검증 (`@Validated`, JSR-303)
- 메타데이터 생성 (`spring-boot-configuration-processor`)
- Relaxed Binding 규칙

### `@Value`
- SpEL 표현식 사용
- 기본값 지정
- `@Value` vs `@ConfigurationProperties` 선택 기준

### 설정 암호화
- Jasypt 통합
- Spring Cloud Config 암호화
- Kubernetes Secret 연동 패턴

---

## 5. 의존성 주입 & Bean 관리

### Spring IoC 컨테이너 복습
- `ApplicationContext` 계층 (WebApplicationContext 포함)
- Bean 생명주기 (인스턴스화 → 의존성 주입 → 초기화 → 소멸)
- `BeanPostProcessor` / `BeanFactoryPostProcessor`

### Bean 등록 방식
- `@Component`, `@Service`, `@Repository`, `@Controller`
- `@Bean` 메서드 (in `@Configuration`)
- `@Import` / `@ImportResource`
- `@ComponentScan` 범위 설정

### 의존성 주입 방식
- 생성자 주입 (권장) — `@RequiredArgsConstructor`
- 세터 주입
- 필드 주입 (`@Autowired`) — 단점과 테스트 어려움
- `@Qualifier` / `@Primary`
- `@Lazy` 지연 초기화

### Bean 스코프
- `singleton` (기본)
- `prototype`
- `request` / `session` / `application` (웹 스코프)
- `@Scope("prototype")` + `proxyMode`

### 초기화 & 소멸 콜백
- `@PostConstruct` / `@PreDestroy`
- `InitializingBean` / `DisposableBean`
- `@Bean(initMethod, destroyMethod)`
- `SmartLifecycle` — 순서 있는 시작/종료

---

## 6. 웹 MVC

### DispatcherServlet 처리 흐름
- `HandlerMapping` → `HandlerAdapter` → `ViewResolver`
- `HandlerInterceptor` — preHandle / postHandle / afterCompletion
- `Filter` vs `HandlerInterceptor` 차이

### 컨트롤러
- `@RestController` / `@Controller`
- `@RequestMapping` / `@GetMapping` / `@PostMapping` 등
- `@PathVariable` / `@RequestParam` / `@RequestHeader` / `@CookieValue`
- `@RequestBody` / `@ResponseBody`
- `@ModelAttribute`
- `@ResponseStatus`

### 요청 데이터 바인딩 & 검증
- `@Valid` / `@Validated`
- `BindingResult`
- `@ExceptionHandler` — 컨트롤러 레벨
- `@ControllerAdvice` / `@RestControllerAdvice` — 전역 예외 처리
- `ProblemDetail` (RFC 7807, Spring 6+)

### 응답 처리
- `ResponseEntity<T>`
- `HttpMessageConverter` — 직렬화/역직렬화
- Jackson 통합 (`ObjectMapper` 커스터마이징)
- Content Negotiation

### 파일 업로드 & 다운로드
- `MultipartFile` 처리
- `spring.servlet.multipart.*` 설정
- 스트리밍 다운로드 (`StreamingResponseBody`)
- 대용량 파일 처리 주의사항

### 정적 리소스 & 뷰 템플릿
- 정적 리소스 경로 (`/static`, `/public`, `/resources`)
- Thymeleaf 통합
- 리소스 버전 관리 (Cache Busting)

### Async 요청 처리
- `DeferredResult<T>`
- `Callable<T>`
- `@Async` + 웹 레이어 조합 주의

---

## 7. WebFlux (리액티브 웹)

### WebFlux vs Spring MVC
- 이벤트 루프 모델 vs 스레드-퍼-요청 모델
- 언제 WebFlux를 선택하는가
- 블로킹 코드 금지 원칙

### 핵심 타입
- `Mono<T>` — 0 또는 1개 결과
- `Flux<T>` — 0개 이상의 스트림
- `Publisher`, `Subscriber`, `Subscription`
- `StepVerifier` — 테스트

### 어노테이션 기반 컨트롤러
- `@RestController` 동일 사용 (WebFlux 컨텍스트)
- 리액티브 타입 반환
- `ServerWebExchange`

### 함수형 라우터 (Router Functions)
- `RouterFunction<ServerResponse>`
- `HandlerFunction<ServerResponse>`
- `RouterFunctions.route()`
- `RequestPredicates`

### WebClient
- `WebClient.Builder` 구성
- 요청 / 응답 처리
- 에러 처리 (`onStatus`, `onErrorResume`)
- 필터 (`ExchangeFilterFunction`) — 로깅, 인증 헤더 주입
- 커넥션 풀 & 타임아웃 설정
- `WebClient` vs `RestTemplate` vs `RestClient` 비교

### RestClient (Spring 6.1+)
- 동기 HTTP 클라이언트 신규 API
- `RestClient.Builder` 구성
- `RestTemplate` 마이그레이션

---

## 8. 데이터 액세스

### Spring Data 공통 개념
- `Repository` 계층 (`CrudRepository`, `JpaRepository`, `PagingAndSortingRepository`)
- 쿼리 메서드 네이밍 규칙
- `@Query` — JPQL / Native Query
- Auditing (`@CreatedDate`, `@LastModifiedDate`, `@EnableJpaAuditing`)
- `Page<T>` / `Slice<T>` 페이징

### Spring Data JPA
- `@Entity`, `@Table`, `@Column`, `@Id`, `@GeneratedValue`
- 연관관계 매핑 (`@OneToMany`, `@ManyToOne`, `@ManyToMany`)
- Fetch 전략 (EAGER / LAZY) — N+1 문제와 해결
- JPQL / Criteria API / QueryDSL
- 영속성 컨텍스트와 트랜잭션 경계
- `@EntityGraph` — 패치 조인 제어
- Projections (Interface / DTO / Open Projection)
- `@Lock` — 비관적/낙관적 잠금

### 데이터소스 설정
- HikariCP 커넥션 풀 (`spring.datasource.hikari.*`)
- 다중 데이터소스 설정
- Read/Write 분리 (`AbstractRoutingDataSource`)

### 트랜잭션 관리
- `@Transactional` — 전파(Propagation), 격리(Isolation), readOnly
- 선언적 트랜잭션 vs 프로그래밍 방식 (`TransactionTemplate`)
- 트랜잭션 이벤트 (`@TransactionalEventListener`)
- 자기 호출(Self-invocation) 문제

### DB 마이그레이션
- Flyway 통합 (`spring.flyway.*`)
- Liquibase 통합
- 마이그레이션 전략 (버전 관리, 롤백)

### Spring Data Redis
- `RedisTemplate` / `StringRedisTemplate`
- `@Cacheable` 통합
- Pub/Sub (`RedisMessageListenerContainer`)
- Reactive Redis (`ReactiveRedisTemplate`)

### Spring Data MongoDB
- `MongoTemplate` / `ReactiveMongoTemplate`
- `@Document`, `@Field`
- Aggregation Pipeline

---

## 9. 캐싱

### Spring Cache 추상화
- `@EnableCaching`
- `@Cacheable` / `@CachePut` / `@CacheEvict` / `@Caching`
- `CacheManager` 구현체 선택 (ConcurrentMap, Caffeine, Redis, EhCache)
- 캐시 키 생성 (`KeyGenerator`, SpEL)
- 조건부 캐싱 (`condition`, `unless`)

### Caffeine 캐시
- 로컬 인메모리 캐시 (LRU / LFU / W-TinyLFU)
- TTL / 최대 크기 설정
- 캐시 통계

### Redis 캐시
- `RedisCacheManager` 설정
- TTL 정책
- 직렬화 설정 (JSON vs 기본 Java 직렬화)
- 캐시 키 네임스페이스

---

## 10. 보안 (Spring Security)

### Spring Security 아키텍처
- `SecurityFilterChain` (서블릿 필터 체인)
- `DelegatingFilterProxy` — Spring 컨테이너 연결
- `AuthenticationManager` / `AuthenticationProvider`
- `UserDetailsService` / `UserDetails`
- `SecurityContext` / `SecurityContextHolder`

### 인증 (Authentication)
- Form 로그인
- HTTP Basic / Digest
- JWT 인증 필터 구현
- OAuth2 로그인 (`spring-security-oauth2-client`)
- LDAP 인증

### 인가 (Authorization)
- URL 기반 접근 제어 (`requestMatchers`)
- 메서드 보안 (`@PreAuthorize`, `@PostAuthorize`, `@Secured`, `@RolesAllowed`)
- `@EnableMethodSecurity`
- SpEL 표현식 (`hasRole`, `hasAuthority`, `authentication`, `principal`)
- 계층 권한 (`RoleHierarchy`)

### JWT
- Access Token / Refresh Token 전략
- `JwtDecoder` (자체 발급 vs JWKS URI)
- 커스텀 Claim 처리
- 토큰 갱신 흐름

### OAuth2 Resource Server
- `spring-security-oauth2-resource-server`
- JWT / Opaque Token 검증
- `JwtAuthenticationConverter` — 클레임 → 권한 변환

### CSRF / CORS / 세션
- CSRF 보호 활성화/비활성화 시나리오
- CORS 설정 (`CorsConfigurationSource`)
- 세션 관리 (`SessionCreationPolicy.STATELESS`)

### 비밀번호 인코딩
- `PasswordEncoder` 구현체 (`BCryptPasswordEncoder`)
- `DelegatingPasswordEncoder` — 알고리즘 마이그레이션

---

## 11. 이벤트 & 비동기

### Spring Application Events
- `ApplicationEvent` / `@EventListener`
- 빌트인 이벤트 (`ApplicationStartedEvent`, `ApplicationReadyEvent` 등)
- `ApplicationEventPublisher`
- 비동기 이벤트 (`@Async` + `@EventListener`)
- `@TransactionalEventListener`

### @Async
- `@EnableAsync` 설정
- `ThreadPoolTaskExecutor` 구성
- `Future<T>` / `CompletableFuture<T>` 반환
- 예외 처리 (`AsyncUncaughtExceptionHandler`)
- 자기 호출(Self-invocation) 문제

### 스케줄링
- `@EnableScheduling`
- `@Scheduled` — fixedRate / fixedDelay / cron
- `TaskScheduler` / `ScheduledTaskRegistrar`
- 동적 스케줄 등록/해제

---

## 12. 메시징

### Spring AMQP (RabbitMQ)
- `RabbitTemplate` — 메시지 발행
- `@RabbitListener` — 메시지 소비
- Exchange / Queue / Binding 선언
- 메시지 직렬화 (Jackson2JsonMessageConverter)
- 재처리(Retry) / DLQ(Dead Letter Queue) 패턴

### Spring Kafka
- `KafkaTemplate` — 메시지 발행
- `@KafkaListener` — 메시지 소비
- Consumer Group / Partition / Offset
- 트랜잭션 메시징
- 에러 처리 (`SeekToCurrentErrorHandler`, `DeadLetterPublishingRecoverer`)

### Spring JMS
- `JmsTemplate`
- `@JmsListener`
- ActiveMQ / ActiveMQ Artemis 연동

---

## 13. 테스트

### Spring Boot Test 개요
- `@SpringBootTest` — 전체 애플리케이션 컨텍스트 로드
- `webEnvironment` 옵션 (MOCK, RANDOM_PORT, DEFINED_PORT, NONE)
- 컨텍스트 캐싱 원리와 성능 영향

### 슬라이스 테스트 (Slice Tests)
- `@WebMvcTest` — 컨트롤러 레이어 단독
- `@DataJpaTest` — JPA 레이어 단독 (H2 인메모리)
- `@JsonTest` — JSON 직렬화/역직렬화
- `@RestClientTest` — 클라이언트 테스트
- `@WebFluxTest` — WebFlux 컨트롤러 단독
- `@DataRedisTest` / `@DataMongoTest`

### Mocking
- `@MockBean` / `@SpyBean` — Spring 컨텍스트 내 교체
- Mockito `@Mock` / `@InjectMocks` — 순수 단위 테스트
- `MockMvc` — 서블릿 없이 MVC 테스트
- `WebTestClient` — WebFlux / RestTemplate 대체

### 테스트 설정
- `@TestConfiguration`
- `@ActiveProfiles("test")`
- `@TestPropertySource`
- `@DynamicPropertySource` — Testcontainers 연동
- `ApplicationContextInitializer`

### Testcontainers
- `@Testcontainers` + `@Container`
- Spring Boot 3.1+ 서비스 연결 (`@ServiceConnection`)
- MySQL, PostgreSQL, Redis, Kafka 컨테이너
- 재사용 모드 (`reuse = true`)

### 테스트 모범 사례
- Given-When-Then 구조
- 테스트 격리와 `@Transactional` 롤백
- 컨텍스트 재사용으로 속도 최적화
- BDDMockito 스타일

---

## 14. Actuator & 관찰성

### Actuator 엔드포인트
- `/actuator/health` — 헬스 체크 (상세 정보, 커스텀 HealthIndicator)
- `/actuator/info` — 애플리케이션 정보 (`build-info.properties`, git 정보)
- `/actuator/metrics` — Micrometer 메트릭
- `/actuator/env` — 현재 환경 변수
- `/actuator/beans` — 등록된 Bean 목록
- `/actuator/mappings` — URL 매핑 정보
- `/actuator/loggers` — 런타임 로그 레벨 변경
- `/actuator/threaddump` / `/actuator/heapdump`
- `/actuator/httpexchanges` — 최근 HTTP 요청 이력

### 보안 & 노출 설정
- `management.endpoints.web.exposure.include`
- `management.server.port` — 관리 포트 분리
- Spring Security로 Actuator 보호

### 커스텀 엔드포인트
- `@Endpoint` / `@WebEndpoint` / `@JmxEndpoint`
- `@ReadOperation` / `@WriteOperation` / `@DeleteOperation`

### Micrometer
- 메트릭 타입 (Counter, Gauge, Timer, DistributionSummary)
- 태그(Tag) 전략
- `MeterRegistry` 사용
- 커스텀 메트릭 등록
- Prometheus / Grafana 연동 (`micrometer-registry-prometheus`)

### 분산 추적 (Micrometer Tracing)
- Spring Boot 3.x Observability API
- Brave / OpenTelemetry 브릿지
- Zipkin / Jaeger 연동
- Trace / Span 전파
- `@Observed` 어노테이션

### 로깅
- Logback 자동 구성 (`logback-spring.xml`)
- Log4j2 전환
- 로그 레벨 설정 (`logging.level.*`)
- JSON 로그 포맷 (Logstash Encoder)
- MDC를 통한 요청 컨텍스트 추가
- 로그 파일 롤링 (`logging.logback.rollingpolicy.*`)

---

## 15. 운영 & 배포

### 빌드 & 패키징
- Executable JAR (Fat JAR) 구조 이해
- `spring-boot-maven-plugin` / `spring-boot-gradle-plugin`
- 레이어드 JAR (Layered JAR) — Docker 이미지 최적화
- 전통적 WAR 배포 (`SpringBootServletInitializer`)
- Native Image (GraalVM) — AOT 컴파일

### Docker & 컨테이너
- `Dockerfile` 작성 (멀티 스테이지 빌드)
- Cloud Native Buildpacks (`./mvnw spring-boot:build-image`)
- Jib (Google) — Gradle/Maven 플러그인
- 환경 변수로 설정 주입

### Kubernetes 배포
- `Deployment` / `Service` / `ConfigMap` / `Secret` 설정
- Liveness / Readiness / Startup Probe (`/actuator/health/liveness`)
- 그레이스풀 셧다운 (`server.shutdown=graceful`)
- Spring Boot + Kubernetes 서비스 디스커버리

### 성능 튜닝
- JVM 옵션 (`-Xms`, `-Xmx`, `-XX:+UseG1GC` 등)
- 가상 스레드 (Virtual Threads, Java 21+, Spring Boot 3.2+)
- 시작 시간 최적화 (Lazy Bean 초기화, AOT)
- `spring.main.lazy-initialization=true`

### 그레이스풀 셧다운
- `server.shutdown=graceful` 설정
- `spring.lifecycle.timeout-per-shutdown-phase`
- 진행 중 요청 완료 대기 동작 원리

---

## 16. Spring Boot + Spring Cloud

### Spring Cloud Config
- 중앙화된 설정 서버
- Git 백엔드 설정
- 클라이언트 `bootstrap.yml` vs `spring.config.import`
- 설정 갱신 (`@RefreshScope`, `/actuator/refresh`)

### Spring Cloud Discovery
- Eureka Server / Client 설정
- 서비스 등록 & 발견
- 헬스 체크 통합

### OpenFeign
- `@FeignClient` 선언적 HTTP 클라이언트
- `@FeignClient(fallback)` — Circuit Breaker 연동
- 인터셉터 / 에러 디코더 커스터마이징
- 로깅 레벨 설정

### Spring Cloud Circuit Breaker
- Resilience4j 통합
- `@CircuitBreaker`, `@Retry`, `@Bulkhead`, `@RateLimiter`
- `CircuitBreakerFactory`

---

## 17. 버전별 주요 변경사항

### Spring Boot 2.x → 3.x 마이그레이션
- Java 17 최소 요구사항
- `javax.*` → `jakarta.*` 패키지 변경
- Spring Security 6.x API 변경
- Actuator 변경사항
- Hibernate 6.x 변경사항

### Spring Boot 3.x 주요 기능
- 3.0 — Jakarta EE 10, GraalVM Native Image GA
- 3.1 — Testcontainers 서비스 연결, Docker Compose 통합
- 3.2 — Virtual Threads GA, RestClient, `@Observed` 개선, Micrometer Tracing
- 3.3 — CDS(Class Data Sharing) 지원, 로그 구조화 개선
- Deprecated API 및 제거 목록
