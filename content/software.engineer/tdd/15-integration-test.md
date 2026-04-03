---
title: "[TDD 시리즈] 15. 통합 테스트 — 실제로 연결해서 확인하기"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "통합 테스트", "TestContainers", "WireMock", "Spring", "슬라이스 테스트"]
---

# 통합 테스트 — 실제로 연결해서 확인하기

단위 테스트가 아무리 잘 통과해도 프로덕션에서 버그가 난다. 대부분의 경우 원인은 컴포넌트 간 연결 지점에 있다. ORM이 컬럼명을 잘못 매핑했거나, SQL 쿼리의 JOIN 조건이 틀렸거나, HTTP 응답의 JSON 필드가 예상과 달랐거나. 이런 버그는 단위 테스트로는 절대 잡을 수 없다. 통합 테스트가 필요한 이유다.

## 단위 테스트가 못 잡는 것들

```typescript
// 단위 테스트 — 이 코드는 완벽하게 통과한다
describe('OrderRepository', () => {
  it('주문을 저장하고 조회한다', () => {
    const mockDb = { query: jest.fn().mockResolvedValue([{ id: 1, status: 'PENDING' }]) };
    const repo = new OrderRepository(mockDb);

    const result = await repo.findById(1);
    expect(result.status).toBe('PENDING');
  });
});
```

```sql
-- 그런데 실제 DB 스키마에서 컬럼명은 order_status다
CREATE TABLE orders (
  id BIGINT PRIMARY KEY,
  order_status VARCHAR(20) NOT NULL  -- 'status'가 아니라 'order_status'
);
```

Mock이 `status`를 반환하도록 설정되어 있으니 단위 테스트는 통과한다. 하지만 실제 DB에서는 `order_status` 컬럼이 `status`로 매핑되지 않아서 `null`을 반환한다. 이 버그는 실제 DB와 연결해야만 발견된다.

비슷한 사례들:
- JPA `@Column(name = "...")` 오타
- TypeORM 엔티티 정의와 실제 스키마 불일치
- `findByUserIdAndStatus()`가 기대한 SQL을 생성하는지
- Redis TTL 설정이 실제로 적용되는지
- Kafka 컨슈머 그룹 설정이 올바른지

## Narrow vs Broad Integration Test

통합 테스트에도 범위가 있다.

**Narrow Integration Test**
- 하나의 통합 지점만 테스트
- DB와의 통합만, 또는 HTTP 클라이언트와의 통합만
- 빠르고 디버깅이 쉬움
- Spring의 슬라이스 테스트가 여기에 해당

**Broad Integration Test**
- 여러 컴포넌트가 함께 동작하는 시나리오
- HTTP 요청 → 서비스 → DB → 응답 전체 흐름
- 더 실제에 가깝지만 느리고 설정이 복잡
- 테스트 실패 원인을 찾기 어려움

실무 권장: Narrow Integration Test를 기본으로, 핵심 시나리오는 Broad Integration Test로 보완.

## Spring 슬라이스 테스트

Spring Boot는 애플리케이션의 일부 레이어만 로드하는 슬라이스 테스트를 지원한다. 전체 컨텍스트를 로드하는 `@SpringBootTest`보다 훨씬 빠르다.

**`@DataJpaTest` — 데이터 레이어만**

```java
@DataJpaTest
class OrderRepositoryTest {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TestEntityManager em;

    @Test
    @DisplayName("사용자 ID와 상태로 주문을 조회한다")
    void findByUserIdAndStatus() {
        // given
        User user = em.persist(User.builder().email("user@example.com").build());
        em.persist(Order.builder().user(user).status(OrderStatus.PENDING).build());
        em.persist(Order.builder().user(user).status(OrderStatus.PAID).build());
        em.flush();

        // when
        List<Order> pendingOrders = orderRepository.findByUserIdAndStatus(
            user.getId(), OrderStatus.PENDING
        );

        // then
        assertThat(pendingOrders).hasSize(1);
        assertThat(pendingOrders.get(0).getStatus()).isEqualTo(OrderStatus.PENDING);
    }
}
```

`@DataJpaTest`는 JPA 관련 빈만 로드한다. H2 인메모리 DB를 기본으로 쓰지만, TestContainers를 연결하면 실제 DB로 테스트할 수 있다.

**`@WebMvcTest` — 웹 레이어만**

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    @Test
    @DisplayName("주문 생성 요청이 올바른 응답을 반환한다")
    void createOrder() throws Exception {
        // given
        given(orderService.createOrder(any())).willReturn(
            OrderResponse.builder().orderId(1L).status("PENDING").build()
        );

        // when & then
        mockMvc.perform(post("/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "items": [{"productId": 1, "quantity": 2}]
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.orderId").value(1L))
            .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    @DisplayName("주문 항목이 없으면 400을 반환한다")
    void createOrderWithEmptyItems() throws Exception {
        mockMvc.perform(post("/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"items": []}"""))
            .andExpect(status().isBadRequest());
    }
}
```

`@WebMvcTest`는 웹 레이어(Controller, Filter, HandlerInterceptor)만 로드한다. `OrderService`는 `@MockBean`으로 대체된다. HTTP 직렬화, 유효성 검증, 응답 상태 코드를 빠르게 테스트할 수 있다.

## TypeScript — supertest로 API 통합 테스트

Node.js 환경에서는 `supertest`로 HTTP 레이어를 테스트한다.

```typescript
// tests/integration/orders.test.ts
import request from 'supertest';
import { createApp } from '../../src/app';
import { DataSource } from 'typeorm';
import { setupTestDatabase, teardownTestDatabase } from '../helpers/database';

describe('POST /orders', () => {
  let app: Express.Application;
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await setupTestDatabase();
    app = createApp({ dataSource });
  });

  afterAll(async () => {
    await teardownTestDatabase(dataSource);
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE orders CASCADE');
  });

  it('유효한 주문 요청은 201과 주문 ID를 반환한다', async () => {
    const response = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 1, quantity: 2 }] })
      .expect(201);

    expect(response.body.orderId).toBeDefined();
    expect(response.body.status).toBe('PENDING');
  });

  it('주문이 실제로 DB에 저장된다', async () => {
    const response = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 1, quantity: 2 }] });

    const saved = await dataSource.query(
      'SELECT * FROM orders WHERE id = $1',
      [response.body.orderId]
    );
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe('PENDING');
  });
});
```

## TestContainers — 실제 인프라와 테스트

H2 인메모리 DB는 편하지만 실제 PostgreSQL과 동작이 다르다. `JSONB` 타입, 특정 인덱스 힌트, DB 함수들이 H2에서는 지원되지 않는다. TestContainers는 테스트 중에 실제 Docker 컨테이너를 띄워서 이 문제를 해결한다.

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class OrderRepositoryWithRealDbTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private OrderRepository orderRepository;

    @Test
    @DisplayName("JSONB 타입의 메타데이터를 저장하고 조회한다")
    void saveAndFindWithJsonbMetadata() {
        Order order = Order.builder()
            .metadata(Map.of("source", "mobile", "campaign", "spring-sale"))
            .build();

        orderRepository.save(order);

        Order found = orderRepository.findById(order.getId()).orElseThrow();
        assertThat(found.getMetadata()).containsEntry("source", "mobile");
    }
}
```

TestContainers는 테스트 실행 시 Docker 이미지를 자동으로 pull하고, 컨테이너를 시작하고, 테스트가 끝나면 정리한다. Redis, Kafka, MongoDB도 동일하게 쓸 수 있다.

```java
// Redis 통합 테스트
@Container
static GenericContainer<?> redis = new GenericContainer<>("redis:7")
    .withExposedPorts(6379);

// Kafka 통합 테스트
@Container
static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.4.0"));
```

## WireMock — 외부 HTTP API 모킹

외부 결제 API, 배송 조회 API 같은 외부 HTTP 서비스는 테스트에서 실제로 호출하면 안 된다. 비용이 발생하고, 외부 서비스 장애가 테스트에 영향을 준다. WireMock은 외부 HTTP API를 로컬에서 모킹한다.

```java
@SpringBootTest
@AutoConfigureWireMock(port = 0) // 랜덤 포트
class PaymentServiceTest {

    @Autowired
    private PaymentService paymentService;

    @Test
    @DisplayName("결제 API 호출 성공 시 트랜잭션 ID를 반환한다")
    void chargeSuccess() {
        stubFor(post(urlEqualTo("/v1/charges"))
            .willReturn(aResponse()
                .withStatus(200)
                .withHeader("Content-Type", "application/json")
                .withBody("""
                    {
                      "id": "ch_test_001",
                      "status": "succeeded",
                      "amount": 50000
                    }
                    """)));

        PaymentResult result = paymentService.charge("card_001", 50_000);

        assertThat(result.getTransactionId()).isEqualTo("ch_test_001");
        assertThat(result.isSuccessful()).isTrue();
    }

    @Test
    @DisplayName("결제 API 타임아웃 시 PaymentTimeoutException을 던진다")
    void chargeTimeout() {
        stubFor(post(urlEqualTo("/v1/charges"))
            .willReturn(aResponse()
                .withFixedDelay(5_000))); // 5초 지연

        assertThatThrownBy(() -> paymentService.charge("card_001", 50_000))
            .isInstanceOf(PaymentTimeoutException.class);
    }
}
```

## 통합 테스트 속도 관리

통합 테스트는 단위 테스트보다 느리지만 관리할 수 있다.

**Spring 컨텍스트 재사용**
`@SpringBootTest`는 컨텍스트를 한 번 로드하면 같은 설정의 테스트끼리 재사용한다. 테스트마다 컨텍스트를 다르게 설정하면 재사용이 안 되니 주의한다.

```java
// 컨텍스트가 재사용되는 패턴 — 설정을 공통 기반 클래스로 모음
@SpringBootTest
@Testcontainers
abstract class IntegrationTestBase {
    @Container
    static PostgreSQLContainer<?> postgres = ...; // static으로 공유

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) { ... }
}

class OrderRepositoryTest extends IntegrationTestBase { ... }
class UserRepositoryTest extends IntegrationTestBase { ... }
// 두 테스트가 같은 컨텍스트와 컨테이너를 재사용
```

**TestContainers 컨테이너 재사용**
`Testcontainers.reuse(true)` 설정으로 컨테이너를 테스트 실행 간에 재사용할 수 있다. 컨테이너 시작 시간을 줄인다.

**병렬 실행**
JUnit 5의 병렬 실행 기능으로 통합 테스트를 병렬로 돌릴 수 있다. 테스트 간 데이터 충돌에 주의해야 한다.

## 언제 통합 테스트가 단위 테스트보다 나은가

단위 테스트로 Mock을 잔뜩 만들어도 "이 코드가 실제로 동작하는가"를 확신하기 어려운 경우가 있다. 그럴 때는 통합 테스트가 더 낫다.

- Repository 레이어: 쿼리 결과가 예상대로인지 실제 DB로 확인
- Controller 레이어: JSON 직렬화/역직렬화, 유효성 검증, 응답 코드
- 외부 서비스 클라이언트: HTTP 요청/응답 처리, 재시도, 타임아웃
- 이벤트 기반 처리: Kafka 메시지가 실제로 발행되고 소비되는지

단위 테스트가 더 나은 경우는 **도메인 로직**이다. DB 없이 검증할 수 있는 계산, 검증, 상태 전이는 단위 테스트가 빠르고 명확하다.

두 테스트는 경쟁 관계가 아니다. 각각이 커버하는 영역이 다르다.
