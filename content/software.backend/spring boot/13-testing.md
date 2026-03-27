---
title: "Spring Boot: 테스트 전략 — 단위, 슬라이스, 통합 테스트"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "testing", "junit5", "testcontainers"]
---

# 테스트 전략

## 테스트 피라미드

```
          /\
         /통합\
        / 테스트\
       /----------\
      /  슬라이스   \
     /    테스트     \
    /----------------\
   /   단위 테스트     \
  /____________________\
```

- **단위 테스트**: 외부 의존성 없이 단일 클래스/메서드 검증. 빠르고 많이 작성.
- **슬라이스 테스트**: Spring 컨텍스트 일부만 로드. 레이어별 검증.
- **통합 테스트**: 전체 Spring 컨텍스트 + 실제 DB/외부 서비스. 느리지만 신뢰도 높음.

---

## 단위 테스트

### JUnit 5 + Mockito

```kotlin
// build.gradle.kts
testImplementation("org.springframework.boot:spring-boot-starter-test")
// JUnit 5, Mockito, AssertJ, Testcontainers 포함
```

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private OrderService orderService;

    @Test
    @DisplayName("주문 생성 시 OrderCreatedEvent를 발행한다")
    void createOrder_publishesEvent() {
        // given
        CreateOrderRequest request = new CreateOrderRequest(1L, List.of(
            new OrderItem(100L, 2, BigDecimal.valueOf(5000))
        ));
        Order mockOrder = Order.builder().id(1L).userId(1L).build();
        given(orderRepository.save(any())).willReturn(mockOrder);

        // when
        orderService.createOrder(request);

        // then
        then(eventPublisher).should().publishEvent(any(OrderCreatedEvent.class));
    }

    @Test
    @DisplayName("존재하지 않는 상품으로 주문 시 예외가 발생한다")
    void createOrder_withInvalidProduct_throwsException() {
        // given
        given(orderRepository.save(any()))
            .willThrow(new ResourceNotFoundException("상품 없음"));

        // when & then
        assertThatThrownBy(() -> orderService.createOrder(new CreateOrderRequest(1L, List.of())))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("상품 없음");
    }
}
```

### BDDMockito 스타일

```java
// given(mock.method()).willReturn(value) — 가독성 높은 BDD 스타일
given(userRepository.findById(1L)).willReturn(Optional.of(user));

// verify → then(mock).should()
then(eventPublisher).should(times(1)).publishEvent(any());
then(emailService).should(never()).send(any());
```

### ArgumentCaptor

```java
@Test
void sendEmail_capturesCorrectRecipient() {
    // given
    ArgumentCaptor<EmailMessage> captor = ArgumentCaptor.forClass(EmailMessage.class);

    // when
    notificationService.notifyUser(1L, "주문 완료");

    // then
    then(emailClient).should().send(captor.capture());
    EmailMessage sent = captor.getValue();
    assertThat(sent.getTo()).isEqualTo("user@example.com");
    assertThat(sent.getSubject()).contains("주문 완료");
}
```

---

## @WebMvcTest — Controller 슬라이스

웹 레이어만 로드한다. Service, Repository는 Mock으로 대체한다.

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("POST /api/orders — 주문 생성 성공")
    void createOrder_returns201() throws Exception {
        // given
        CreateOrderRequest request = new CreateOrderRequest(1L, List.of());
        OrderResponse response = new OrderResponse(1L, "PENDING", BigDecimal.valueOf(10000));
        given(orderService.createOrder(any())).willReturn(response);

        // when & then
        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(1L))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andDo(print());
    }

    @Test
    @DisplayName("잘못된 요청 — 400 Bad Request 반환")
    void createOrder_withInvalidRequest_returns400() throws Exception {
        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))  // 필수 필드 없음
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors").isArray());
    }
}
```

### Security 포함 테스트

```java
@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)
class OrderControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(roles = "USER")
    void getOrder_withAuthenticatedUser_returns200() throws Exception {
        mockMvc.perform(get("/api/orders/1"))
            .andExpect(status().isOk());
    }

    @Test
    void getOrder_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/orders/1"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    void deleteOrder_withUserRole_returns403() throws Exception {
        mockMvc.perform(delete("/api/orders/1"))
            .andExpect(status().isForbidden());
    }
}
```

---

## @DataJpaTest — JPA 슬라이스

JPA 관련 빈만 로드하고, 기본적으로 인메모리 H2를 사용한다.

```java
@DataJpaTest
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TestEntityManager em;

    @Test
    @DisplayName("이메일로 사용자를 조회한다")
    void findByEmail_returnsUser() {
        // given
        User user = User.builder()
            .name("김철수")
            .email("chulsoo@example.com")
            .build();
        em.persistAndFlush(user);
        em.clear();  // 1차 캐시 초기화

        // when
        Optional<User> found = userRepository.findByEmail("chulsoo@example.com");

        // then
        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("김철수");
    }

    @Test
    @DisplayName("존재하지 않는 이메일 조회 시 empty 반환")
    void findByEmail_withUnknownEmail_returnsEmpty() {
        Optional<User> found = userRepository.findByEmail("unknown@example.com");
        assertThat(found).isEmpty();
    }
}
```

### 실제 DB로 테스트 (Testcontainers 연동)

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class UserRepositoryIntegrationTest {

    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0")
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
    }

    @Autowired
    private UserRepository userRepository;

    @Test
    void fullTextSearch_withMysql() {
        // MySQL 전용 기능 테스트 가능
    }
}
```

---

## @SpringBootTest — 통합 테스트

전체 ApplicationContext를 로드한다.

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class OrderIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
        .withDatabaseName("testdb");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7")
        .withExposedPorts(6379);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    @DisplayName("전체 주문 생성 플로우 검증")
    void createOrder_fullFlow() {
        CreateOrderRequest request = new CreateOrderRequest(1L, List.of(
            new OrderItem(100L, 2, BigDecimal.valueOf(5000))
        ));

        ResponseEntity<OrderResponse> response = restTemplate.postForEntity(
            "/api/orders", request, OrderResponse.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().getId()).isNotNull();

        // DB에 저장됐는지 검증
        Optional<Order> saved = orderRepository.findById(response.getBody().getId());
        assertThat(saved).isPresent();
    }
}
```

### @ServiceConnection (Spring Boot 3.1+)

`@DynamicPropertySource` 없이 Testcontainers를 자동 연결한다.

```java
@SpringBootTest
@Testcontainers
class ModernIntegrationTest {

    @Container
    @ServiceConnection  // URL/username/password 자동 주입
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Container
    @ServiceConnection
    static RedisContainer redis = new RedisContainer("redis:7");

    // @DynamicPropertySource 불필요
}
```

---

## MockMvc vs WebTestClient

```java
// MockMvc — 서블릿 기반 (MVC)
mockMvc.perform(get("/api/users/1"))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.name").value("김철수"));

// WebTestClient — 리액티브 (WebFlux) 또는 서블릿도 사용 가능
webTestClient.get()
    .uri("/api/users/1")
    .exchange()
    .expectStatus().isOk()
    .expectBody()
    .jsonPath("$.name").isEqualTo("김철수");
```

---

## @RestClientTest — HTTP 클라이언트 슬라이스

외부 API 클라이언트를 테스트할 때 사용한다.

```java
@RestClientTest(PaymentClient.class)
class PaymentClientTest {

    @Autowired
    private PaymentClient paymentClient;

    @Autowired
    private MockRestServiceServer server;

    @Test
    void processPayment_success() {
        server.expect(requestTo("https://api.payment.com/v1/charge"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess(
                "{\"transactionId\": \"txn-123\", \"status\": \"SUCCESS\"}",
                MediaType.APPLICATION_JSON
            ));

        PaymentResult result = paymentClient.charge(new ChargeRequest("card-001", 10000L));

        assertThat(result.transactionId()).isEqualTo("txn-123");
    }
}
```

---

## 테스트 설정 공유

### @TestConfiguration

```java
@TestConfiguration
public class TestSecurityConfig {

    @Bean
    @Primary
    public SecurityFilterChain testSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
            .build();
    }
}
```

### @ActiveProfiles("test")

```yaml
# src/test/resources/application-test.yml
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.springframework.security: DEBUG
```

```java
@SpringBootTest
@ActiveProfiles("test")
class MyTest { ... }
```

---

## Testcontainers 공유 컨테이너 (성능 최적화)

테스트마다 컨테이너를 새로 시작하면 느리다. 공유 컨테이너를 사용하면 한 번만 시작된다.

```java
// 공통 베이스 클래스
@SpringBootTest
@Testcontainers
abstract class AbstractIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
        .withReuse(true);  // Testcontainers 재사용 모드

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
}

// 개별 테스트
class UserRepositoryTest extends AbstractIntegrationTest {
    @Test
    void test() { ... }
}

class OrderRepositoryTest extends AbstractIntegrationTest {
    @Test
    void test() { ... }
}
```

재사용 모드 활성화: `~/.testcontainers.properties`에 `testcontainers.reuse.enable=true` 추가.

---

## ArchUnit — 아키텍처 테스트

코드 구조 규칙을 테스트로 강제한다.

```java
@AnalyzeClasses(packagesOf = Application.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule controllers_should_not_access_repositories =
        noClasses().that().resideInAPackage("..controller..")
            .should().accessClassesThat().resideInAPackage("..repository..");

    @ArchTest
    static final ArchRule services_should_be_annotated =
        classes().that().resideInAPackage("..service..")
            .should().beAnnotatedWith(Service.class);

    @ArchTest
    static final ArchRule no_cycles =
        slices().matching("com.example.(*)..").should().beFreeOfCycles();
}
```
