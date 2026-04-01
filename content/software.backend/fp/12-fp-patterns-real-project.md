---
title: "[Kotlin FP] 12. 실전 프로젝트 — FP 패턴 통합"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "FP", "실전", "아키텍처", "패턴"]
---

# 실전 프로젝트 — FP 패턴 통합

지금까지 배운 패턴을 하나의 주문 서비스 예제로 통합한다. 실제 프로젝트에서 어떤 레이어에 어떤 패턴을 적용하는지, 그리고 팀에 FP를 도입할 때의 현실적인 전략을 다룬다.

---

## 프로젝트 구조

```
src/main/kotlin/com/example/order/
├── domain/
│   ├── model/          ← 불변 data class (도메인 모델)
│   │   ├── Order.kt
│   │   ├── OrderItem.kt
│   │   ├── Money.kt
│   │   └── OrderId.kt  (value class)
│   ├── error/          ← sealed class 에러 타입
│   │   └── OrderError.kt
│   └── service/        ← 순수 함수 (object)
│       └── OrderPricingService.kt
├── application/
│   └── OrderApplicationService.kt  ← @Service, 부수 효과 조율
├── infrastructure/
│   ├── persistence/
│   │   ├── OrderEntity.kt          ← JPA 엔티티
│   │   └── OrderRepositoryImpl.kt
│   └── external/
│       └── PaymentApiClient.kt
└── presentation/
    ├── OrderController.kt          ← @RestController 또는 RouterFunction
    └── dto/
        ├── CreateOrderRequest.kt
        └── OrderResponse.kt
```

---

## Domain Layer — 불변 모델 + 에러 타입

```kotlin
// domain/model/Order.kt
data class Order(
    val id: OrderId,
    val userId: UserId,
    val status: OrderStatus,
    val items: List<OrderItem>,
    val pricing: OrderPricing,
    val shippingAddress: Address,
    val createdAt: Instant,
) {
    companion object {
        fun create(
            userId: UserId,
            items: List<OrderItem>,
            pricing: OrderPricing,
            address: Address,
        ): Order = Order(
            id = OrderId.UNASSIGNED,
            userId = userId,
            status = OrderStatus.Pending,
            items = items,
            pricing = pricing,
            shippingAddress = address,
            createdAt = Instant.now(),
        )
    }

    fun confirm(): Either<OrderError, Order> =
        if (status == OrderStatus.Pending) copy(status = OrderStatus.Confirmed).right()
        else OrderError.InvalidStatusTransition(status, OrderStatus.Confirmed).left()

    fun cancel(reason: String): Either<OrderError, Order> =
        if (status is OrderStatus.Cancelled) OrderError.AlreadyCancelled(id).left()
        else copy(status = OrderStatus.Cancelled(reason)).right()
}

// domain/error/OrderError.kt
sealed class OrderError {
    data class NotFound(val id: OrderId) : OrderError()
    data class UserNotFound(val userId: UserId) : OrderError()
    data class InsufficientStock(
        val productId: ProductId,
        val requested: Int,
        val available: Int,
    ) : OrderError()
    data class InvalidStatusTransition(
        val current: OrderStatus,
        val target: OrderStatus,
    ) : OrderError()
    data class AlreadyCancelled(val id: OrderId) : OrderError()
    object PaymentFailed : OrderError()
}
```

---

## Domain Service — 순수 비즈니스 로직

```kotlin
// domain/service/OrderPricingService.kt
object OrderPricingService {

    fun calculatePricing(
        items: List<OrderItemCommand>,
        products: List<ProductInfo>,
        coupon: Coupon?,
        address: Address,
    ): Either<OrderError, OrderPricing> = either {
        // 상품 정보 매핑 (순수 — DB 없음)
        val orderItems = items.map { item ->
            val product = products.find { it.id == item.productId }
                ?: raise(OrderError.ProductNotFound(item.productId))
            OrderItem(product.id, product.name, item.quantity, product.price)
        }

        val itemTotal = orderItems.fold(Money.ZERO) { acc, item -> acc + item.subtotal }

        // 할인 계산
        val discount = coupon?.let { c ->
            ensure(c.isValid()) { OrderError.InvalidCoupon(c.code) }
            when {
                c.discountRate != null   -> itemTotal * c.discountRate
                c.discountAmount != null -> minOf(c.discountAmount, itemTotal)
                else                     -> Money.ZERO
            }
        } ?: Money.ZERO

        // 배송비 계산
        val discounted = itemTotal - discount
        val shipping = when {
            discounted >= Money.of(50_000) -> Money.ZERO
            address.isRemote              -> Money.of(5_000)
            else                          -> Money.of(3_000)
        }

        OrderPricing(itemTotal, discount, shipping, discounted + shipping)
    }
}
```

---

## Application Service — 부수 효과 조율

```kotlin
// application/OrderApplicationService.kt
@Service
@Transactional
class OrderApplicationService(
    private val userRepository: UserRepository,
    private val productRepository: ProductRepository,
    private val couponRepository: CouponRepository,
    private val orderRepository: OrderRepository,
    private val paymentClient: PaymentApiClient,
    private val eventPublisher: ApplicationEventPublisher,
) {
    suspend fun placeOrder(command: PlaceOrderCommand): Either<OrderError, OrderResult> = either {
        // 1. 데이터 수집 (부수 효과)
        val user     = userRepository.findById(command.userId).bind()
        val products = productRepository.findAllByIds(command.items.map { it.productId }).bind()
        val coupon   = command.couponCode?.let {
            couponRepository.findByCode(it).bind()
        }

        // 2. 순수 함수로 비즈니스 로직 처리
        val pricing = OrderPricingService.calculatePricing(
            items    = command.items,
            products = products,
            coupon   = coupon,
            address  = command.shippingAddress,
        ).bind()

        // 3. 도메인 모델 생성 (순수)
        val order = Order.create(
            userId  = user.id,
            items   = pricing.items,
            pricing = pricing,
            address = command.shippingAddress,
        )

        // 4. 저장 (부수 효과)
        val saved = orderRepository.save(order).bind()

        // 5. 결제 (부수 효과 — 트랜잭션 외부)
        val paymentResult = paymentClient.charge(saved.id, saved.pricing.total).bind()

        // 6. 이벤트 발행 (부수 효과)
        eventPublisher.publishEvent(OrderPlacedEvent(saved.id, saved.pricing.total, user.email))

        OrderResult(saved, paymentResult.transactionId)
    }

    suspend fun cancelOrder(
        orderId: OrderId,
        reason: String,
    ): Either<OrderError, Order> = either {
        val order   = orderRepository.findById(orderId).bind()
        val cancelled = order.cancel(reason).bind()
        orderRepository.save(cancelled).bind()
    }
}
```

---

## Presentation Layer — Either → HTTP 응답

```kotlin
// presentation/OrderController.kt
@RestController
@RequestMapping("/api/orders")
class OrderController(private val orderService: OrderApplicationService) {

    @PostMapping
    suspend fun placeOrder(
        @RequestBody @Valid request: PlaceOrderRequest,
    ): ResponseEntity<*> =
        orderService.placeOrder(request.toCommand())
            .map { OrderResponse.from(it) }
            .toResponseEntity(HttpStatus.CREATED)

    @DeleteMapping("/{id}")
    suspend fun cancelOrder(
        @PathVariable id: Long,
        @RequestBody request: CancelOrderRequest,
    ): ResponseEntity<*> =
        orderService.cancelOrder(OrderId(id), request.reason)
            .map { OrderResponse.from(it) }
            .toResponseEntity()
}

// 공통 확장 함수
fun <E : OrderError, T> Either<E, T>.toResponseEntity(
    successStatus: HttpStatus = HttpStatus.OK
): ResponseEntity<*> = fold(
    ifLeft  = { error ->
        val (status, message) = when (error) {
            is OrderError.NotFound         -> HttpStatus.NOT_FOUND to "주문을 찾을 수 없습니다"
            is OrderError.UserNotFound     -> HttpStatus.NOT_FOUND to "사용자를 찾을 수 없습니다"
            is OrderError.InsufficientStock -> HttpStatus.UNPROCESSABLE_ENTITY to
                "재고 부족 (요청: ${error.requested}, 가용: ${error.available})"
            is OrderError.AlreadyCancelled -> HttpStatus.CONFLICT to "이미 취소된 주문입니다"
            OrderError.PaymentFailed       -> HttpStatus.BAD_GATEWAY to "결제 처리 실패"
            else                           -> HttpStatus.INTERNAL_SERVER_ERROR to "서버 오류"
        }
        ResponseEntity.status(status).body(ErrorResponse(message))
    },
    ifRight = { ResponseEntity.status(successStatus).body(it) }
)
```

---

## 레이어별 FP 적용 수준

모든 레이어에 FP를 동시에 도입할 필요는 없다. 효과 대비 비용을 고려해 단계적으로 적용하는 것이 현실적이다.

```
레이어          FP 적용 수준     기대 효과
──────────────────────────────────────────────────
도메인 모델      ★★★★★ (필수)    불변성, 타입 안전, 상태 추적 용이
도메인 서비스    ★★★★★ (필수)    Mock 없는 단위 테스트, 재사용성
Application  ★★★★☆          Either로 에러 흐름 명시
Repository   ★★★☆☆          Either 반환, 변환 함수
Controller   ★★☆☆☆          fold()로 HTTP 응답 변환
```

---

## 팀에 FP 도입 전략

### 1단계: 값 객체 + 불변 모델 (충격 없음)

```kotlin
// 이것만 해도 큰 효과
data class Order(val id: OrderId, val status: OrderStatus, ...)
@JvmInline value class OrderId(val value: Long)
```

코드 스타일만 바뀌므로 팀 저항이 거의 없다.

### 2단계: sealed class 에러 타입

```kotlin
sealed class OrderError { ... }
// @ExceptionHandler 방식과 병행 가능
```

### 3단계: 비즈니스 로직 순수 함수 분리

```kotlin
object OrderPricingService {
    fun calculate(...): OrderPricing  // 순수 함수
}
```

테스트 속도가 빨라지는 효과가 즉시 보인다. 팀 설득에 효과적.

### 4단계: Either 도입 (학습 비용 있음)

```kotlin
fun createOrder(...): Either<OrderError, Order>
```

Arrow-kt 도입이 필요하다. 팀 학습이 필요한 단계.

### 5단계: Coroutines / Flow (선택)

성능 요구사항이나 스트리밍이 필요한 경우에만.

---

## 정리 — 패턴 한눈에

```
Request
  │
  ▼ [Presentation]
Controller / Handler
  - @Valid 형식 검증
  - DTO → Command 변환
  - Either → ResponseEntity 변환
  │
  ▼ [Application]
ApplicationService (@Service)
  - 데이터 수집 (Repository, 외부 API)
  - 순수 함수 호출
  - 이벤트 발행
  - either { bind() } 파이프라인
  │
  ▼ [Domain]
Domain Service (object)        Domain Model (data class)
  - 순수 비즈니스 로직             - val 프로퍼티
  - Either<DomainError, Value>   - copy()로 상태 전이
  - Mock 없이 단위 테스트          - sealed class 에러 타입
  │
  ▼ [Infrastructure]
Repository (@Repository)
  - JPA Entity ↔ Domain Model 변환
  - Either<Error, Model> 반환
  - 영속성 세부사항 캡슐화
```

FP는 "올바른 방식"이 아니라 **예측 가능하고 테스트하기 쉬운 코드를 만드는 도구**다. 팀 상황과 도메인 복잡도에 맞춰 선택적으로 적용하는 것이 가장 현실적이다.
