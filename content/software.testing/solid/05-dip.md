# DIP — 의존성 역전 원칙 (Dependency Inversion Principle)

> "고수준 모듈은 저수준 모듈에 의존해서는 안 된다. 둘 다 추상화에 의존해야 한다."
> "추상화는 세부 사항에 의존해서는 안 된다. 세부 사항이 추상화에 의존해야 한다."
> — Robert C. Martin

---

## 핵심 개념

```
DIP 이전 (전통적 의존 방향):
  고수준 (OrderService)
       ↓ 의존
  저수준 (MySQLOrderRepository)

DIP 이후 (역전된 의존 방향):
  고수준 (OrderService)
       ↓ 의존
  추상화 (OrderRepository 인터페이스)
       ↑ 의존 (구현)
  저수준 (MySQLOrderRepository)
```

의존성의 방향이 "역전"된다. 이제 저수준 모듈이 추상화(인터페이스)에 의존한다.

---

## 위반 예제 — 구체 클래스에 직접 의존

```kotlin
// 저수준 모듈 (구체 구현)
class MySQLOrderRepository {
    fun findById(id: Long): Order? {
        // MySQL 직접 쿼리
        return jdbcTemplate.queryForObject("SELECT * FROM orders WHERE id = ?", ...)
    }

    fun save(order: Order): Order { /* MySQL 저장 */ }
}

class SlackNotificationService {
    fun notify(message: String) {
        // Slack API 직접 호출
        slackClient.post(webhookUrl, message)
    }
}

// 고수준 모듈 — 저수준 구체 클래스에 직접 의존 (DIP 위반)
class OrderService {
    // 구체 클래스에 의존 → 테스트 불가, MySQL/Slack 교체 불가
    private val orderRepository = MySQLOrderRepository()
    private val notificationService = SlackNotificationService()

    fun createOrder(request: CreateOrderRequest): Order {
        val order = Order.create(request)
        val saved = orderRepository.save(order)
        notificationService.notify("주문 생성: ${saved.id}")
        return saved
    }
}
```

**문제점:**
1. `OrderService`를 테스트하려면 MySQL이 필요하다
2. Slack → 카카오 알림으로 바꾸려면 `OrderService` 수정이 필요하다
3. `MySQLOrderRepository` 내부 변경이 `OrderService`에 영향을 준다

---

## 개선 — 추상화(인터페이스)에 의존

### 인터페이스 정의

```kotlin
// 추상화 정의 (고수준 모듈 패키지에 위치)
interface OrderRepository {
    fun findById(id: Long): Order?
    fun save(order: Order): Order
}

interface OrderNotificationService {
    fun notifyCreated(order: Order)
}
```

### 저수준 모듈이 추상화를 구현

```kotlin
// 저수준 모듈이 인터페이스를 구현
@Repository
class MySQLOrderRepository(
    private val jdbcTemplate: JdbcTemplate
) : OrderRepository {
    override fun findById(id: Long): Order? = /* MySQL 쿼리 */
    override fun save(order: Order): Order = /* MySQL 저장 */
}

@Component
class SlackOrderNotificationService(
    private val slackClient: SlackClient
) : OrderNotificationService {
    override fun notifyCreated(order: Order) {
        slackClient.post("주문 생성: ${order.id}")
    }
}
```

### 고수준 모듈은 인터페이스에 의존

```kotlin
// 고수준 모듈 — 추상화에만 의존
@Service
class OrderService(
    private val orderRepository: OrderRepository,          // 인터페이스
    private val notificationService: OrderNotificationService,  // 인터페이스
) {
    fun createOrder(request: CreateOrderRequest): Order {
        val order = Order.create(request)
        val saved = orderRepository.save(order)
        notificationService.notifyCreated(saved)
        return saved
    }
}
```

---

## Spring DI와 DIP

Spring의 DI(Dependency Injection) 컨테이너는 DIP를 구현하는 핵심 도구다.

### 생성자 주입 (권장)

```kotlin
@Service
class ProductService(
    private val productRepository: ProductRepository,  // interface
    private val priceCalculator: PriceCalculator,      // interface
    private val stockChecker: StockChecker,            // interface
) {
    fun purchase(productId: Long, quantity: Int): PurchaseResult {
        val product = productRepository.findById(productId)
            ?: throw ProductNotFoundException(productId)

        if (!stockChecker.isAvailable(productId, quantity)) {
            throw OutOfStockException(productId)
        }

        val price = priceCalculator.calculate(product, quantity)
        return PurchaseResult(product, quantity, price)
    }
}
```

### 프로필별 구현체 교체

```kotlin
// 인터페이스 — 고수준 모듈이 의존
interface PaymentGateway {
    fun pay(amount: Int, cardNumber: String): PaymentResult
}

// 프로덕션 구현체
@Component
@Profile("!test")
class TossPaymentGateway(private val tossClient: TossClient) : PaymentGateway {
    override fun pay(amount: Int, cardNumber: String): PaymentResult {
        return tossClient.charge(amount, cardNumber)
    }
}

// 테스트 구현체 — 실제 결제 없이 시뮬레이션
@Component
@Profile("test")
class FakePaymentGateway : PaymentGateway {
    override fun pay(amount: Int, cardNumber: String): PaymentResult {
        return if (cardNumber.startsWith("4")) {
            PaymentResult(transactionId = "FAKE-${UUID.randomUUID()}", status = SUCCESS)
        } else {
            PaymentResult(transactionId = "", status = FAILED)
        }
    }
}
```

---

## 헥사고날 아키텍처와 DIP

DIP는 헥사고날 아키텍처(포트와 어댑터)의 핵심 원리다.

```
┌─────────────────────────────────────────┐
│              Application Core           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │         Domain Logic            │    │
│  │  (OrderService, Order, ...)     │    │
│  └────────────┬────────────────────┘    │
│               │ 의존                    │
│  ┌────────────▼────────────────────┐    │
│  │       Port (인터페이스)          │    │
│  │  OrderRepository (Outbound)     │    │
│  │  OrderController (Inbound)      │    │
│  └────────────▲────────────────────┘    │
│               │ 구현                    │
└───────────────┼─────────────────────────┘
                │
┌───────────────┼─────────────────────────┐
│   Adapter     │                         │
│  ┌────────────▼────────────────────┐    │
│  │  JpaOrderRepository             │    │
│  │  RestOrderController            │    │
│  │  KafkaOrderEventPublisher       │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

```kotlin
// Port (인터페이스) — 도메인 패키지에 위치
package com.example.order.domain.port

interface OrderRepository {           // Outbound port
    fun findById(id: Long): Order?
    fun save(order: Order): Order
}

interface OrderEventPublisher {       // Outbound port
    fun publish(event: OrderCreatedEvent)
}

// Adapter — 인프라 패키지에 위치
package com.example.order.infrastructure

@Repository
class JpaOrderRepository(
    private val jpa: OrderJpaRepository
) : OrderRepository {                // Port 구현
    override fun findById(id: Long) = jpa.findById(id).orElse(null)
    override fun save(order: Order) = jpa.save(order)
}

@Component
class KafkaOrderEventPublisher(
    private val kafkaTemplate: KafkaTemplate<String, String>
) : OrderEventPublisher {            // Port 구현
    override fun publish(event: OrderCreatedEvent) {
        kafkaTemplate.send("orders", event.toJson())
    }
}
```

---

## 자가 등록(Self-Registration) 패턴

```kotlin
// 전략 패턴 + DIP + Spring 자동 등록
interface ReportGenerator {
    fun supports(type: ReportType): Boolean
    fun generate(data: ReportData): ByteArray
}

@Component
class PdfReportGenerator : ReportGenerator {
    override fun supports(type: ReportType) = type == PDF
    override fun generate(data: ReportData): ByteArray { /* PDF 생성 */ }
}

@Component
class ExcelReportGenerator : ReportGenerator {
    override fun supports(type: ReportType) = type == EXCEL
    override fun generate(data: ReportData): ByteArray { /* Excel 생성 */ }
}

// ReportService는 구체 구현을 모른다
@Service
class ReportService(
    private val generators: List<ReportGenerator>  // Spring이 모두 주입
) {
    fun generate(type: ReportType, data: ReportData): ByteArray {
        return generators.find { it.supports(type) }
            ?.generate(data)
            ?: throw UnsupportedReportTypeException(type)
    }
}
```

---

## 테스트 관점

DIP를 지키면 단위 테스트에서 실제 DB/외부 API 없이 테스트할 수 있다.

```kotlin
// DIP 준수 → 인터페이스 Mock으로 완전한 단위 테스트
class OrderServiceTest : FunSpec({
    val orderRepository = mockk<OrderRepository>()
    val notificationService = mockk<OrderNotificationService>(relaxed = true)
    val service = OrderService(orderRepository, notificationService)

    test("주문 생성 성공") {
        val request = CreateOrderRequest(productId = 1L, quantity = 2)
        val expected = Order(id = 100L, status = PENDING)

        every { orderRepository.save(any()) } returns expected

        val result = service.createOrder(request)

        result.id shouldBe 100L
        verify { notificationService.notifyCreated(expected) }
    }

    test("알림 실패해도 주문은 성공") {
        every { orderRepository.save(any()) } returns Order(id = 1L)
        every { notificationService.notifyCreated(any()) } throws RuntimeException("Slack 다운")

        // 알림 실패가 주문에 영향 없어야 함 (요구사항에 따라)
        shouldThrow<RuntimeException> {
            service.createOrder(CreateOrderRequest(productId = 1L, quantity = 1))
        }
    }
})
```

### 인메모리 구현체로 통합 테스트

```kotlin
// 테스트용 인메모리 구현체 — DB 없이 빠른 통합 테스트
class InMemoryOrderRepository : OrderRepository {
    private val store = mutableMapOf<Long, Order>()
    private var idCounter = 1L

    override fun findById(id: Long) = store[id]

    override fun save(order: Order): Order {
        val saved = if (order.id == 0L) order.copy(id = idCounter++) else order
        store[saved.id] = saved
        return saved
    }
}

class OrderServiceIntegrationTest : FunSpec({
    val repository = InMemoryOrderRepository()
    val notificationService = RecordingNotificationService()
    val service = OrderService(repository, notificationService)

    test("주문 생성 후 알림 발송 확인") {
        val order = service.createOrder(CreateOrderRequest(productId = 1L, quantity = 3))

        // DB 없이 빠른 통합 검증
        repository.findById(order.id).shouldNotBeNull()
        notificationService.notifiedOrders shouldContain order
    }
})
```

---

## 패키지 구조로 DIP 강제

```
com.example
├── order
│   ├── domain          ← 고수준, 인터페이스 정의
│   │   ├── Order.kt
│   │   ├── OrderService.kt
│   │   └── port
│   │       ├── OrderRepository.kt     ← 인터페이스
│   │       └── OrderNotifier.kt       ← 인터페이스
│   └── infrastructure  ← 저수준, 인터페이스 구현
│       ├── JpaOrderRepository.kt
│       └── SlackOrderNotifier.kt
```

ArchUnit으로 DIP 위반을 자동 감지:

```kotlin
@Test
fun `도메인은 인프라에 의존하면 안 된다`() {
    val classes = ClassFileImporter().importPackages("com.example")

    noClasses()
        .that().resideInAPackage("..domain..")
        .should().dependOnClassesThat()
        .resideInAPackage("..infrastructure..")
        .check(classes)
}
```

---

## 정리

| | DIP 위반 | DIP 준수 |
|---|----------|----------|
| 의존 방향 | 고수준 → 저수준 구체 클래스 | 모두 → 인터페이스 |
| 테스트 | 실제 DB/API 필요 | Mock/인메모리로 가능 |
| 구현체 교체 | 고수준 코드 수정 필요 | 설정(Spring Bean)만 변경 |
| 빌드 의존성 | 구체 클래스에 강하게 결합 | 인터페이스에만 결합 |
| 독립 개발 | 저수준이 완성되어야 고수준 개발 가능 | 병렬 개발 가능 |

**실천 팁:**
- 생성자 주입 + 인터페이스 타입을 기본으로 한다
- 도메인 패키지에 인터페이스를, 인프라 패키지에 구현체를 위치시킨다
- `new ConcreteClass()`가 보이면 DIP 위반 신호 (팩토리 or DI 사용)
- ArchUnit으로 의존성 방향을 자동 검증한다
