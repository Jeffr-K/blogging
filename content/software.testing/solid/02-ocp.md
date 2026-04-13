# OCP — 개방-폐쇄 원칙 (Open/Closed Principle)

> "소프트웨어 엔티티는 확장에 열려 있어야 하고, 수정에는 닫혀 있어야 한다."
> — Bertrand Meyer / Robert C. Martin

---

## 핵심 개념

- **확장에 열림**: 새로운 기능을 추가할 수 있다
- **수정에 닫힘**: 기존 코드를 변경하지 않고 추가할 수 있다

```
OCP 위반 신호:
- 새 요구사항마다 기존 if/when 블록에 조건을 추가한다
- 새 타입 추가 시 여러 파일을 동시에 수정해야 한다
- "기능 추가했는데 왜 기존 테스트가 깨지지?" 현상
```

---

## 위반 예제 — 결제 수단이 늘어날 때마다 코드 수정

```kotlin
// 나쁜 예: 새 결제 수단마다 PaymentService 수정 필요
class PaymentService {
    fun pay(request: PaymentRequest): PaymentResult {
        return when (request.method) {
            "CARD" -> {
                // 카드 결제 로직
                val response = cardClient.charge(request.amount, request.cardNumber)
                PaymentResult(transactionId = response.tid, status = SUCCESS)
            }
            "KAKAO_PAY" -> {
                // 카카오페이 로직
                val response = kakaoPayClient.pay(request.amount, request.userId)
                PaymentResult(transactionId = response.tid, status = SUCCESS)
            }
            "TOSS" -> {
                // 토스 로직 — 나중에 추가
                val response = tossClient.pay(request.amount)
                PaymentResult(transactionId = response.paymentKey, status = SUCCESS)
            }
            // 네이버페이 추가 시 여기를 또 수정해야 함
            else -> throw UnsupportedPaymentMethodException(request.method)
        }
    }
}
```

**문제점:**
- 네이버페이, 페이팔 등이 추가될 때마다 `PaymentService` 수정
- 기존 카드/카카오페이 로직이 깨질 위험
- 테스트: 새 결제 수단 추가 시 전체 when 블록을 다시 테스트해야 함

---

## 개선 — 인터페이스로 확장점 정의

### 전략 패턴 (Strategy Pattern) 적용

```kotlin
// 확장 포인트: 인터페이스 정의
interface PaymentProcessor {
    fun supports(method: PaymentMethod): Boolean
    fun pay(request: PaymentRequest): PaymentResult
}

// 구현체 1: 카드 결제 (수정 없이 독립적으로 존재)
@Component
class CardPaymentProcessor(private val cardClient: CardClient) : PaymentProcessor {
    override fun supports(method: PaymentMethod) = method == PaymentMethod.CARD

    override fun pay(request: PaymentRequest): PaymentResult {
        val response = cardClient.charge(request.amount, request.cardNumber!!)
        return PaymentResult(transactionId = response.tid, status = SUCCESS)
    }
}

// 구현체 2: 카카오페이 (수정 없이 독립적으로 존재)
@Component
class KakaoPayProcessor(private val kakaoPayClient: KakaoPayClient) : PaymentProcessor {
    override fun supports(method: PaymentMethod) = method == PaymentMethod.KAKAO_PAY

    override fun pay(request: PaymentRequest): PaymentResult {
        val response = kakaoPayClient.pay(request.amount, request.userId!!)
        return PaymentResult(transactionId = response.tid, status = SUCCESS)
    }
}

// 구현체 3: 토스 — 기존 코드 수정 없이 추가
@Component
class TossPaymentProcessor(private val tossClient: TossClient) : PaymentProcessor {
    override fun supports(method: PaymentMethod) = method == PaymentMethod.TOSS

    override fun pay(request: PaymentRequest): PaymentResult {
        val response = tossClient.pay(request.amount)
        return PaymentResult(transactionId = response.paymentKey, status = SUCCESS)
    }
}
```

### PaymentService — 이제 수정 없이 새 결제 수단 지원

```kotlin
// PaymentService는 더 이상 수정할 필요 없음
@Service
class PaymentService(
    private val processors: List<PaymentProcessor>  // Spring이 모든 구현체 주입
) {
    fun pay(request: PaymentRequest): PaymentResult {
        val processor = processors.find { it.supports(request.method) }
            ?: throw UnsupportedPaymentMethodException(request.method)

        return processor.pay(request)
    }
}
```

**네이버페이 추가 시:**
```kotlin
// NaverPayProcessor.kt 파일 하나만 추가 — 기존 코드 무수정
@Component
class NaverPayProcessor(private val naverPayClient: NaverPayClient) : PaymentProcessor {
    override fun supports(method: PaymentMethod) = method == PaymentMethod.NAVER_PAY

    override fun pay(request: PaymentRequest): PaymentResult {
        // ...
    }
}
```

---

## 실전 예제 2 — 할인 정책

```kotlin
// 할인 정책 인터페이스
interface DiscountPolicy {
    fun calculate(order: Order): Money
}

@Component
class FixedAmountDiscount : DiscountPolicy {
    override fun calculate(order: Order): Money =
        if (order.amount >= Money(50_000)) Money(3_000) else Money.ZERO
}

@Component
class RateDiscount : DiscountPolicy {
    override fun calculate(order: Order): Money =
        order.amount * 0.1  // 10% 할인
}

@Component
class MemberGradeDiscount(
    private val memberRepository: MemberRepository
) : DiscountPolicy {
    override fun calculate(order: Order): Money {
        val member = memberRepository.findById(order.memberId) ?: return Money.ZERO
        return when (member.grade) {
            BRONZE -> order.amount * 0.03
            SILVER -> order.amount * 0.05
            GOLD   -> order.amount * 0.10
            VIP    -> order.amount * 0.20
        }
    }
}

// OrderService — 새 할인 정책 추가해도 수정 불필요
@Service
class OrderService(
    private val discountPolicies: List<DiscountPolicy>
) {
    fun calculateDiscount(order: Order): Money =
        discountPolicies.sumOf { it.calculate(order) }
}
```

---

## 실전 예제 3 — 이벤트 핸들러

```kotlin
// Spring ApplicationEvent + OCP
abstract class OrderEvent(val orderId: Long)
class OrderCreatedEvent(orderId: Long) : OrderEvent(orderId)
class OrderCancelledEvent(orderId: Long, val reason: String) : OrderEvent(orderId)

// 각 핸들러는 독립적으로 추가 가능 — OrderService 수정 불필요
@Component
class OrderEmailNotifier {
    @EventListener
    fun on(event: OrderCreatedEvent) {
        // 주문 확인 이메일 발송
    }
}

@Component
class OrderInventoryUpdater {
    @EventListener
    fun on(event: OrderCreatedEvent) {
        // 재고 차감
    }
}

@Component
class OrderAnalyticsTracker {
    @EventListener
    fun on(event: OrderCreatedEvent) {
        // 주문 분석 데이터 적재 — 나중에 추가, 기존 코드 무수정
    }
}
```

---

## Kotlin sealed class + OCP

sealed class는 OCP와 상충처럼 보이지만, 의도적으로 다르게 사용한다.

```kotlin
// sealed class: 타입 목록이 고정된 경우 (OCP보다 완전성 우선)
sealed class Result<out T> {
    data class Success<T>(val value: T) : Result<T>()
    data class Failure(val error: DomainError) : Result<Nothing>()
}

// 인터페이스: 구현체가 계속 늘어날 경우 (OCP 우선)
interface NotificationChannel {
    fun send(message: Notification)
}

// sealed class로 OCP를 준수하는 패턴
// — 처리 로직은 when에서, 새 타입 추가는 컴파일 에러로 감지
fun handle(event: DomainEvent): Unit = when (event) {
    is OrderCreated   -> handleOrderCreated(event)
    is OrderCancelled -> handleOrderCancelled(event)
    is OrderDelivered -> handleOrderDelivered(event)
    // 새 sealed subclass 추가 시 컴파일 에러 → 강제로 처리 추가
}
```

---

## 테스트 관점

OCP를 지키면 새 기능의 테스트가 기존 테스트에 영향을 주지 않는다.

```kotlin
// 각 PaymentProcessor 독립 테스트
class CardPaymentProcessorTest {
    private val cardClient = mockk<CardClient>()
    private val processor = CardPaymentProcessor(cardClient)

    @Test
    fun `카드 결제 성공`() {
        every { cardClient.charge(any(), any()) } returns CardResponse("TID-001")

        val result = processor.pay(PaymentRequest(amount = 10_000, method = CARD))

        result.status shouldBe SUCCESS
        result.transactionId shouldBe "TID-001"
    }
}

// 새 구현체 추가 시 이 테스트만 새로 작성
class NaverPayProcessorTest {
    // 기존 CardPaymentProcessorTest와 완전히 독립
}

// PaymentService 테스트는 인터페이스 Mock으로 작성 — 구현체 독립적
class PaymentServiceTest {
    private val processors = listOf(
        mockk<PaymentProcessor>().also {
            every { it.supports(CARD) } returns true
            every { it.pay(any()) } returns PaymentResult("TX-001", SUCCESS)
        }
    )
    private val service = PaymentService(processors)

    @Test
    fun `지원하는 결제 수단으로 결제`() {
        val result = service.pay(PaymentRequest(amount = 10_000, method = CARD))
        result.status shouldBe SUCCESS
    }

    @Test
    fun `지원하지 않는 결제 수단 예외`() {
        shouldThrow<UnsupportedPaymentMethodException> {
            service.pay(PaymentRequest(amount = 10_000, method = BITCOIN))
        }
    }
}
```

---

## 정리

| | OCP 위반 | OCP 준수 |
|---|----------|----------|
| 기능 추가 | 기존 클래스 수정 | 새 클래스 추가 |
| 기존 테스트 | 새 기능 추가 시 깨질 수 있음 | 안전함 |
| 새 기능 테스트 | 기존 로직과 얽힘 | 독립적 |
| 배포 리스크 | 기존 기능까지 재검증 필요 | 새 기능만 검증 |

**실천 팁:**
- `when (type)` 블록이 여러 곳에 반복된다면 인터페이스로 분리
- Spring의 `List<Interface>` 주입 패턴을 적극 활용
- 변경 이유가 다른 로직은 처음부터 인터페이스로 분리
