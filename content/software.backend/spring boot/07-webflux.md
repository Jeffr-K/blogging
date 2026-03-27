---
title: "Spring Boot: WebFlux와 리액티브 프로그래밍"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "webflux", "reactive", "webclient"]
---

## WebFlux vs Spring MVC 비교

Spring Boot에서 웹 계층을 구성할 때 두 가지 선택지가 있다. 전통적인 서블릿 기반 Spring MVC와 리액티브 기반 Spring WebFlux다. 어떤 것을 선택하느냐에 따라 애플리케이션의 스레드 모델, 동시성 처리 방식, 메모리 사용 패턴이 완전히 달라진다.

| 항목 | Spring MVC | Spring WebFlux |
|------|-----------|----------------|
| 스레드 모델 | 스레드-퍼-요청 (Thread-per-Request) | 이벤트 루프 (Event Loop) |
| 블로킹 I/O | 허용 | 금지 (이벤트 루프 블로킹 시 전체 처리 중단) |
| 동시성 처리 | 스레드 수에 비례 (기본 200개) | 소수의 스레드로 수만 요청 처리 |
| 메모리 사용 | 스레드당 ~1MB 스택 | 이벤트 루프 스레드 최소화 |
| 학습 곡선 | 낮음 | 높음 (리액티브 패러다임) |
| 적합한 상황 | CPU 바운드, 단순 CRUD, 팀 역량 낮을 때 | I/O 바운드, 높은 동시성, MSA 게이트웨이 |
| 서버 | Tomcat, Jetty, Undertow | Netty, Undertow, Jetty |
| 반환 타입 | 일반 객체, ResponseEntity | Mono\<T\>, Flux\<T\> |

---

## 이벤트 루프 모델 vs 스레드-퍼-요청 모델

```
■ Spring MVC (스레드-퍼-요청 모델)
┌────────────────────────────────────────────┐
│  요청 1 → [Thread-1] → DB 대기... → 응답   │
│  요청 2 → [Thread-2] → DB 대기... → 응답   │
│  요청 3 → [Thread-3] → DB 대기... → 응답   │
│  요청 4 → [대기 큐] ← 스레드 풀 소진        │
└────────────────────────────────────────────┘
  스레드가 I/O 대기 중에도 블로킹 → 낭비

■ Spring WebFlux (이벤트 루프 모델)
┌───────────────────────────────────────────────────────┐
│                   Event Loop Thread                   │
│  요청 1 → I/O 요청 등록 → 다음 요청 처리              │
│  요청 2 → I/O 요청 등록 → 다음 요청 처리              │
│  요청 3 → I/O 요청 등록 → 다음 요청 처리              │
│           ↑ I/O 완료 콜백 수신 → 응답 전송            │
└───────────────────────────────────────────────────────┘
  소수의 스레드(CPU 코어 수)로 수만 개 동시 처리
```

이벤트 루프 스레드 안에서 절대로 블로킹 코드를 실행하면 안 된다. `Thread.sleep()`, 동기 JDBC 호출, 블로킹 파일 I/O 등이 이벤트 루프를 점유하면 해당 루프가 처리하는 모든 요청이 멈춘다.

---

## WebFlux 선택 기준

**WebFlux를 선택해야 하는 상황:**
- 수천~수만 동시 연결을 처리하는 API 게이트웨이
- 외부 API 호출이 많은 BFF(Backend for Frontend)
- SSE(Server-Sent Events), WebSocket 실시간 스트리밍
- R2DBC를 사용하는 완전 리액티브 스택

**Spring MVC를 유지해야 하는 상황:**
- CPU 집약적 연산(이미지 처리, 암호화)이 많은 경우
- 블로킹 라이브러리를 반드시 사용해야 하는 경우
- 팀이 리액티브 패러다임에 익숙하지 않은 경우
- 레거시 JDBC를 그대로 사용해야 하는 경우

> **실무 팁:** WebFlux 프로젝트에서 불가피하게 블로킹 코드를 써야 한다면 `Schedulers.boundedElastic()`으로 별도 스레드 풀에서 실행하라.

---

## Mono\<T\> / Flux\<T\> 핵심 연산자

### 의존성 설정

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

```kotlin
// build.gradle.kts
implementation("org.springframework.boot:spring-boot-starter-webflux")
```

### Mono 생성

```java
// 값이 있는 Mono
Mono<String> mono1 = Mono.just("Hello WebFlux");

// 빈 Mono (완료 신호만 발생)
Mono<String> mono2 = Mono.empty();

// 에러 Mono
Mono<String> mono3 = Mono.error(new RuntimeException("Something went wrong"));

// 블로킹 코드를 리액티브로 감싸기 (boundedElastic 스레드에서 실행)
Mono<User> mono4 = Mono.fromCallable(() -> userRepository.findById(1L))
    .subscribeOn(Schedulers.boundedElastic());

// 지연 생성 (구독 시점에 실행)
Mono<String> mono5 = Mono.fromSupplier(() -> computeValue());

// CompletableFuture 변환
Mono<String> mono6 = Mono.fromFuture(asyncService.fetchAsync());
```

### Flux 생성

```java
// 컬렉션에서 생성
Flux<String> flux1 = Flux.fromIterable(List.of("A", "B", "C"));

// 범위로 생성
Flux<Integer> flux2 = Flux.range(1, 10); // 1~10

// 일정 간격으로 발행 (0, 1, 2... 무한 스트림)
Flux<Long> flux3 = Flux.interval(Duration.ofSeconds(1));

// 배열에서 생성
Flux<String> flux4 = Flux.just("X", "Y", "Z");

// 프로그래밍 방식으로 생성
Flux<Integer> flux5 = Flux.create(sink -> {
    for (int i = 0; i < 5; i++) {
        sink.next(i);
    }
    sink.complete();
});
```

### 변환 연산자

```java
// map: 동기 변환 (1:1)
Flux<String> names = userFlux.map(user -> user.getName());

// flatMap: 비동기 변환 (1:N, 순서 보장 안 됨)
Flux<Order> orders = userFlux.flatMap(user -> orderService.findByUserId(user.getId()));

// concatMap: 비동기 변환 (순서 보장, 순차 처리)
Flux<Order> ordersOrdered = userFlux.concatMap(user -> orderService.findByUserId(user.getId()));

// filter: 조건부 필터링
Flux<User> activeUsers = userFlux.filter(user -> user.isActive());

// reduce: 집계 (최종 결과 하나)
Mono<Integer> total = Flux.range(1, 10).reduce(0, Integer::sum);

// collectList: Flux → Mono<List>
Mono<List<User>> userList = userFlux.collectList();

// take: 앞에서 N개만
Flux<Integer> first5 = Flux.range(1, 100).take(5);

// skip: 앞에서 N개 건너뜀
Flux<Integer> skip5 = Flux.range(1, 10).skip(5);

// distinct: 중복 제거
Flux<String> unique = Flux.just("A", "B", "A", "C").distinct();
```

### 조합 연산자

```java
// zipWith: 두 스트림을 쌍으로 묶음
Mono<String> zipped = Mono.just("Hello")
    .zipWith(Mono.just("World"))
    .map(tuple -> tuple.getT1() + " " + tuple.getT2());

// Flux zip
Flux<String> flux1 = Flux.just("A", "B", "C");
Flux<Integer> flux2 = Flux.just(1, 2, 3);
Flux<String> zippedFlux = Flux.zip(flux1, flux2, (s, i) -> s + i);
// 결과: A1, B2, C3

// merge: 두 스트림 병합 (도착 순서대로)
Flux<String> merged = Flux.merge(
    Flux.just("A", "B").delayElements(Duration.ofMillis(100)),
    Flux.just("C", "D")
);

// concat: 첫 번째 완료 후 두 번째 시작 (순서 보장)
Flux<String> concatenated = Flux.concat(
    Flux.just("A", "B"),
    Flux.just("C", "D")
);

// mergeWith (인스턴스 메서드 방식)
Flux<String> result = Flux.just("A", "B").mergeWith(Flux.just("C", "D"));
```

### 에러 처리

```java
// onErrorReturn: 에러 발생 시 기본값 반환
Mono<String> safe = Mono.error(new RuntimeException("fail"))
    .onErrorReturn("default");

// onErrorResume: 에러 발생 시 다른 Publisher로 전환
Mono<User> fallback = userService.findById(id)
    .onErrorResume(UserNotFoundException.class, e -> Mono.just(User.anonymous()));

// onErrorMap: 에러를 다른 에러로 변환
Mono<User> mapped = userService.findById(id)
    .onErrorMap(DataAccessException.class, e -> new ServiceUnavailableException(e));

// doOnError: 에러 로깅 (스트림 흐름에 영향 없음)
Mono<User> logged = userService.findById(id)
    .doOnError(e -> log.error("Error fetching user", e));

// retry: 에러 시 재시도
Mono<String> retried = externalService.call()
    .retry(3)
    .onErrorReturn("fallback");
```

### subscribe() vs block()

```java
// ✅ subscribe(): 비동기 구독 (권장)
userService.findById(id)
    .subscribe(
        user -> log.info("Found: {}", user),      // onNext
        error -> log.error("Error", error),        // onError
        () -> log.info("Completed")                // onComplete
    );

// ✅ WebFlux 컨트롤러에서는 그냥 반환만 하면 됨 (프레임워크가 구독)
@GetMapping("/users/{id}")
public Mono<User> getUser(@PathVariable Long id) {
    return userService.findById(id); // subscribe 불필요
}

// ❌ block(): 이벤트 루프를 블로킹하므로 WebFlux 환경에서 사용 금지
// 테스트나 main 메서드에서만 예외적으로 허용
User user = userService.findById(id).block(); // NEVER in reactive chain
```

---

## 어노테이션 기반 컨트롤러 (WebFlux)

Spring MVC와 동일한 어노테이션을 사용하지만 반환 타입이 `Mono<T>` 또는 `Flux<T>`다.

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}")
    public Mono<ResponseEntity<UserResponse>> getUser(@PathVariable Long id) {
        return userService.findById(id)
            .map(user -> ResponseEntity.ok(UserResponse.from(user)))
            .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @GetMapping
    public Flux<UserResponse> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return userService.findAll(page, size)
            .map(UserResponse::from);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<UserResponse> createUser(@RequestBody @Validated Mono<CreateUserRequest> request) {
        return request
            .flatMap(userService::create)
            .map(UserResponse::from);
    }

    @PutMapping("/{id}")
    public Mono<UserResponse> updateUser(
            @PathVariable Long id,
            @RequestBody @Validated Mono<UpdateUserRequest> request) {
        return request
            .flatMap(req -> userService.update(id, req))
            .map(UserResponse::from);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteUser(@PathVariable Long id) {
        return userService.delete(id);
    }

    // SSE (Server-Sent Events) 스트리밍
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<UserEvent> streamUsers() {
        return userService.streamEvents()
            .delayElements(Duration.ofMillis(500));
    }

    // ServerWebExchange로 요청/응답 직접 접근
    @GetMapping("/exchange-demo")
    public Mono<String> withExchange(ServerWebExchange exchange) {
        String clientIp = exchange.getRequest().getRemoteAddress().getAddress().getHostAddress();
        exchange.getResponse().getHeaders().add("X-Client-IP", clientIp);
        return Mono.just("Your IP: " + clientIp);
    }
}
```

---

## 함수형 라우터 (Functional Router)

어노테이션 방식 대신 함수형 방식으로 라우팅을 정의할 수 있다. 테스트 용이성과 명시적인 라우팅 구성이 장점이다.

### HandlerFunction 구현

```java
@Component
@RequiredArgsConstructor
public class UserHandler {

    private final UserService userService;

    public Mono<ServerResponse> getUser(ServerRequest request) {
        Long id = Long.valueOf(request.pathVariable("id"));
        return userService.findById(id)
            .map(UserResponse::from)
            .flatMap(user -> ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(user))
            .switchIfEmpty(ServerResponse.notFound().build());
    }

    public Mono<ServerResponse> getAllUsers(ServerRequest request) {
        int page = Integer.parseInt(request.queryParam("page").orElse("0"));
        int size = Integer.parseInt(request.queryParam("size").orElse("20"));
        Flux<UserResponse> users = userService.findAll(page, size).map(UserResponse::from);
        return ServerResponse.ok()
            .contentType(MediaType.APPLICATION_JSON)
            .body(users, UserResponse.class);
    }

    public Mono<ServerResponse> createUser(ServerRequest request) {
        return request.bodyToMono(CreateUserRequest.class)
            .flatMap(userService::create)
            .map(UserResponse::from)
            .flatMap(response -> ServerResponse.created(
                    URI.create("/api/users/" + response.getId()))
                .bodyValue(response));
    }

    public Mono<ServerResponse> updateUser(ServerRequest request) {
        Long id = Long.valueOf(request.pathVariable("id"));
        return request.bodyToMono(UpdateUserRequest.class)
            .flatMap(req -> userService.update(id, req))
            .map(UserResponse::from)
            .flatMap(user -> ServerResponse.ok().bodyValue(user));
    }

    public Mono<ServerResponse> deleteUser(ServerRequest request) {
        Long id = Long.valueOf(request.pathVariable("id"));
        return userService.delete(id)
            .then(ServerResponse.noContent().build());
    }
}
```

### RouterFunction 정의

```java
@Configuration
public class UserRouter {

    @Bean
    public RouterFunction<ServerResponse> userRoutes(UserHandler handler) {
        return RouterFunctions.route()
            .GET("/api/users/{id}", RequestPredicates.accept(MediaType.APPLICATION_JSON), handler::getUser)
            .GET("/api/users", handler::getAllUsers)
            .POST("/api/users", RequestPredicates.contentType(MediaType.APPLICATION_JSON), handler::createUser)
            .PUT("/api/users/{id}", handler::updateUser)
            .DELETE("/api/users/{id}", handler::deleteUser)
            .build();
    }

    // 여러 RouterFunction 조합
    @Bean
    public RouterFunction<ServerResponse> allRoutes(UserHandler userHandler, OrderHandler orderHandler) {
        return RouterFunctions.route()
            .path("/api/users", () -> userRoutes(userHandler))
            .path("/api/orders", () -> orderRoutes(orderHandler))
            .build();
    }
}
```

### RequestPredicates 조합

```java
@Bean
public RouterFunction<ServerResponse> advancedRoutes(UserHandler handler) {
    // AND 조합
    RequestPredicate jsonGet = RequestPredicates.GET("/api/users")
        .and(RequestPredicates.accept(MediaType.APPLICATION_JSON));

    // OR 조합
    RequestPredicate getOrHead = RequestPredicates.GET("/api/users/{id}")
        .or(RequestPredicates.HEAD("/api/users/{id}"));

    return RouterFunctions.route(jsonGet, handler::getAllUsers)
        .andRoute(getOrHead, handler::getUser);
}
```

### 함수형 vs 어노테이션 방식 선택 기준

| 기준 | 어노테이션 방식 | 함수형 방식 |
|------|----------------|------------|
| 학습 곡선 | 낮음 (MVC와 동일) | 높음 |
| 테스트 | `@WebFluxTest` | `WebTestClient` 직접 사용 |
| 라우팅 가시성 | 클래스 분산 | 한 곳에 집중 |
| AOP 적용 | 쉬움 | 수동 적용 필요 |
| 권장 상황 | 일반 CRUD API | 게이트웨이, 복잡한 라우팅 조건 |

---

## WebClient 완전 가이드

`WebClient`는 Spring 5부터 제공하는 논블로킹 HTTP 클라이언트다. `RestTemplate`의 리액티브 대체제이며, WebFlux가 아닌 MVC 환경에서도 사용할 수 있다.

### 기본 설정

```java
@Configuration
public class WebClientConfig {

    @Bean
    public WebClient userServiceClient() {
        // 커넥션 풀 & 타임아웃 설정
        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
            .responseTimeout(Duration.ofSeconds(10))
            .doOnConnected(conn -> conn
                .addHandlerLast(new ReadTimeoutHandler(10, TimeUnit.SECONDS))
                .addHandlerLast(new WriteTimeoutHandler(10, TimeUnit.SECONDS)));

        return WebClient.builder()
            .baseUrl("https://user-service.internal")
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
            .filter(loggingFilter())
            .filter(authHeaderFilter())
            .codecs(configurer -> configurer
                .defaultCodecs()
                .maxInMemorySize(2 * 1024 * 1024)) // 2MB 버퍼
            .build();
    }

    // 로깅 필터
    private ExchangeFilterFunction loggingFilter() {
        return ExchangeFilterFunction.ofRequestProcessor(request -> {
            log.info("HTTP {} {}", request.method(), request.url());
            return Mono.just(request);
        });
    }

    // 인증 헤더 주입 필터
    private ExchangeFilterFunction authHeaderFilter() {
        return (request, next) -> {
            ClientRequest filtered = ClientRequest.from(request)
                .header("X-Internal-Token", getInternalToken())
                .build();
            return next.exchange(filtered);
        };
    }

    private String getInternalToken() {
        return "internal-secret-token"; // 실무에서는 Vault 등에서 가져옴
    }
}
```

### GET 요청

```java
@Service
@RequiredArgsConstructor
public class UserApiClient {

    private final WebClient userServiceClient;

    // 단일 객체 조회
    public Mono<UserResponse> findById(Long id) {
        return userServiceClient.get()
            .uri("/users/{id}", id)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError, response -> {
                if (response.statusCode() == HttpStatus.NOT_FOUND) {
                    return Mono.error(new UserNotFoundException("User not found: " + id));
                }
                return response.bodyToMono(ErrorResponse.class)
                    .flatMap(err -> Mono.error(new ClientException(err.getMessage())));
            })
            .onStatus(HttpStatusCode::is5xxServerError, response ->
                Mono.error(new ServiceUnavailableException("User service unavailable")))
            .bodyToMono(UserResponse.class);
    }

    // 목록 조회
    public Flux<UserResponse> findAll(int page, int size) {
        return userServiceClient.get()
            .uri(uri -> uri
                .path("/users")
                .queryParam("page", page)
                .queryParam("size", size)
                .build())
            .retrieve()
            .bodyToFlux(UserResponse.class);
    }

    // ResponseEntity로 헤더 포함 응답 받기
    public Mono<ResponseEntity<UserResponse>> findByIdWithHeaders(Long id) {
        return userServiceClient.get()
            .uri("/users/{id}", id)
            .retrieve()
            .toEntity(UserResponse.class);
    }
}
```

### POST 요청

```java
public Mono<UserResponse> createUser(CreateUserRequest request) {
    return userServiceClient.post()
        .uri("/users")
        .bodyValue(request)
        .retrieve()
        .onStatus(HttpStatusCode::is4xxClientError, response ->
            response.bodyToMono(ErrorResponse.class)
                .flatMap(err -> Mono.error(new ValidationException(err.getMessage()))))
        .bodyToMono(UserResponse.class);
}

// Flux 스트림을 요청 바디로 전송
public Mono<Void> bulkCreate(Flux<CreateUserRequest> requests) {
    return userServiceClient.post()
        .uri("/users/bulk")
        .body(requests, CreateUserRequest.class)
        .retrieve()
        .bodyToMono(Void.class);
}
```

### 재시도 설정

```java
public Mono<UserResponse> findByIdWithRetry(Long id) {
    return userServiceClient.get()
        .uri("/users/{id}", id)
        .retrieve()
        .bodyToMono(UserResponse.class)
        .retryWhen(Retry.backoff(3, Duration.ofSeconds(1))
            .maxBackoff(Duration.ofSeconds(10))
            .jitter(0.5)
            .filter(e -> e instanceof ServiceUnavailableException) // 특정 에러만 재시도
            .doBeforeRetry(signal ->
                log.warn("Retrying... attempt {}", signal.totalRetries() + 1))
            .onRetryExhaustedThrow((spec, signal) ->
                new MaxRetriesExceededException("All retries exhausted")));
}
```

### WebClient vs RestTemplate vs RestClient 비교

| 항목 | RestTemplate | WebClient | RestClient (Spring 6.1+) |
|------|-------------|-----------|--------------------------|
| 블로킹 | 동기 블로킹 | 논블로킹 리액티브 | 동기 블로킹 |
| 반환 타입 | 일반 객체 | Mono/Flux | 일반 객체 |
| 스트리밍 | 미지원 | 지원 | 미지원 |
| 에러 처리 | try-catch | onStatus() | onStatus() |
| 상태 | Deprecated 예정 | 권장 | 새 권장 동기 클라이언트 |
| 적합한 환경 | MVC (레거시) | WebFlux, MVC | MVC |

---

## RestClient (Spring 6.1+)

Spring 6.1(Boot 3.2+)에서 도입된 새로운 동기 HTTP 클라이언트다. `WebClient`의 유창한 API 스타일을 동기 방식에서 그대로 사용할 수 있다. `RestTemplate`을 대체하는 현대적인 동기 클라이언트다.

### 기본 설정

```java
@Configuration
public class RestClientConfig {

    @Bean
    public RestClient userServiceClient(RestClient.Builder builder) {
        return builder
            .baseUrl("https://user-service.internal")
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + getToken())
            .requestInterceptor(loggingInterceptor())
            .build();
    }

    private ClientHttpRequestInterceptor loggingInterceptor() {
        return (request, body, execution) -> {
            log.info("HTTP {} {}", request.getMethod(), request.getURI());
            ClientHttpResponse response = execution.execute(request, body);
            log.info("Response Status: {}", response.getStatusCode());
            return response;
        };
    }
}
```

### GET / POST / PUT / DELETE 요청

```java
@Service
@RequiredArgsConstructor
public class UserRestClient {

    private final RestClient userServiceClient;

    // GET 단일 조회
    public UserResponse findById(Long id) {
        return userServiceClient.get()
            .uri("/users/{id}", id)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                throw new UserNotFoundException("User not found: " + id);
            })
            .body(UserResponse.class);
    }

    // GET 목록 조회
    public List<UserResponse> findAll() {
        return userServiceClient.get()
            .uri("/users")
            .retrieve()
            .body(new ParameterizedTypeReference<List<UserResponse>>() {});
    }

    // ResponseEntity로 전체 응답 받기
    public ResponseEntity<UserResponse> findByIdWithResponse(Long id) {
        return userServiceClient.get()
            .uri("/users/{id}", id)
            .retrieve()
            .toEntity(UserResponse.class);
    }

    // POST 생성
    public UserResponse create(CreateUserRequest request) {
        return userServiceClient.post()
            .uri("/users")
            .body(request)
            .retrieve()
            .body(UserResponse.class);
    }

    // PUT 수정
    public UserResponse update(Long id, UpdateUserRequest request) {
        return userServiceClient.put()
            .uri("/users/{id}", id)
            .body(request)
            .retrieve()
            .body(UserResponse.class);
    }

    // DELETE 삭제
    public void delete(Long id) {
        userServiceClient.delete()
            .uri("/users/{id}", id)
            .retrieve()
            .toBodilessEntity();
    }
}
```

### RestTemplate에서 RestClient로 마이그레이션

```java
// Before: RestTemplate
RestTemplate restTemplate = new RestTemplate();
UserResponse user = restTemplate.getForObject("/users/{id}", UserResponse.class, id);
restTemplate.postForObject("/users", request, UserResponse.class);

// After: RestClient
RestClient restClient = RestClient.create("https://api.example.com");
UserResponse user = restClient.get()
    .uri("/users/{id}", id)
    .retrieve()
    .body(UserResponse.class);
restClient.post()
    .uri("/users")
    .body(request)
    .retrieve()
    .body(UserResponse.class);
```

---

## StepVerifier (테스트)

리액티브 스트림을 테스트할 때는 `StepVerifier`를 사용한다. `reactor-test` 의존성이 필요하다.

```java
@SpringBootTest
class UserServiceTest {

    @Autowired
    private UserService userService;

    @Test
    void findById_존재하는_유저_반환() {
        StepVerifier.create(userService.findById(1L))
            .expectNextMatches(user -> user.getId().equals(1L))
            .verifyComplete();
    }

    @Test
    void findById_없는_유저_에러_발생() {
        StepVerifier.create(userService.findById(999L))
            .expectError(UserNotFoundException.class)
            .verify();
    }

    @Test
    void findAll_여러_유저_반환() {
        StepVerifier.create(userService.findAll(0, 3))
            .expectNextCount(3)
            .verifyComplete();
    }

    @Test
    void flux_값_순서_검증() {
        Flux<Integer> flux = Flux.range(1, 5);
        StepVerifier.create(flux)
            .expectNext(1)
            .expectNext(2)
            .expectNext(3, 4, 5)
            .verifyComplete();
    }

    @Test
    void 가상_시간으로_interval_테스트() {
        // 실제 시간 대기 없이 가상 시간 사용
        StepVerifier.withVirtualTime(() ->
                Flux.interval(Duration.ofHours(1)).take(3))
            .expectSubscription()
            .thenAwait(Duration.ofHours(3))
            .expectNext(0L, 1L, 2L)
            .verifyComplete();
    }
}
```

---

## 실무 팁 모음

**1. 블로킹 코드 격리**
```java
// 레거시 블로킹 코드를 리액티브로 래핑
Mono<User> user = Mono.fromCallable(() -> legacyRepository.findById(id))
    .subscribeOn(Schedulers.boundedElastic()); // 별도 스레드 풀 사용
```

**2. Context 전파 (MDC 로깅)**
```java
// WebFlux에서는 ThreadLocal 대신 Reactor Context 사용
return userService.findById(id)
    .contextWrite(Context.of("traceId", UUID.randomUUID().toString()));
```

**3. 배압(Backpressure) 처리**
```java
// 처리 속도보다 발행 속도가 빠를 때
Flux.range(1, 1000)
    .onBackpressureBuffer(100) // 버퍼 100개
    .flatMap(i -> processItem(i), 8) // 동시 처리 8개로 제한
    .subscribe();
```

**4. 타임아웃 설정**
```java
return userService.findById(id)
    .timeout(Duration.ofSeconds(3))
    .onErrorResume(TimeoutException.class, e -> Mono.just(User.anonymous()));
```

**5. 캐시 처리**
```java
// Mono.cache()로 구독 결과 캐싱
private final Mono<String> cachedToken = tokenService.fetchToken()
    .cache(Duration.ofMinutes(55)); // 55분간 캐시
```
