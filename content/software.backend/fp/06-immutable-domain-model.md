---
title: "[Kotlin FP] 6. 불변 도메인 모델 설계"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "domain-model", "data-class", "JPA", "불변성", "FP"]
---

# 불변 도메인 모델 설계

객체지향 방식의 엔티티는 **상태를 직접 변경**한다.

```kotlin
// ❌ Mutable Entity 방식
@Entity
class Order {
    @Id var id: Long = 0
    var status: OrderStatus = OrderStatus.PENDING

    fun confirm() { this.status = OrderStatus.CONFIRMED }
    fun cancel() { this.status = OrderStatus.CANCELLED }
}
```

`confirm()`을 호출한 뒤 `order.status`가 변경됐는지 추적해야 한다. 멀티스레드 환경에서는 더 위험하다.

FP에서는 **새 객체를 반환**하는 방식으로 상태 변경을 표현한다.

---

## 도메인 모델과 JPA 엔티티 분리

핵심 전략: **순수 Kotlin data class로 도메인 모델**을 만들고, **JPA 엔티티는 별도**로 둔다.

```
도메인 레이어      영속성 레이어
─────────────    ─────────────
Order (data)  ↔  OrderEntity (@Entity)
User  (data)  ↔  UserEntity  (@Entity)
```

```kotlin
// 도메인 모델 — 순수 Kotlin, JPA 의존성 없음
data class Order(
    val id: OrderId,
    val userId: UserId,
    val status: OrderStatus,
    val items: List<OrderItem>,
    val totalAmount: Money,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class OrderItem(
    val productId: ProductId,
    val productName: String,
    val quantity: Int,
    val unitPrice: Money,
) {
    val subtotal: Money get() = unitPrice * quantity
}

// JPA 엔티티 — 영속성 관심사만
@Entity
@Table(name = "orders")
class OrderEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val userId: Long,

    @Enumerated(EnumType.STRING)
    var status: OrderStatusEntity = OrderStatusEntity.PENDING,

    @OneToMany(mappedBy = "order", cascade = [CascadeType.ALL])
    val items: MutableList<OrderItemEntity> = mutableListOf(),

    @Column(nullable = false)
    val totalAmount: BigDecimal,

    @CreationTimestamp
    val createdAt: Instant = Instant.now(),

    @UpdateTimestamp
    var updatedAt: Instant = Instant.now(),
)
```

### 변환 함수

```kotlin
// 엔티티 → 도메인 모델
fun OrderEntity.toDomain(): Order = Order(
    id = OrderId(id),
    userId = UserId(userId),
    status = status.toDomain(),
    items = items.map { it.toDomain() },
    totalAmount = Money(totalAmount, "KRW"),
    createdAt = createdAt,
    updatedAt = updatedAt,
)

// 도메인 모델 → 엔티티
fun Order.toEntity(): OrderEntity = OrderEntity(
    id = id.value,
    userId = userId.value,
    status = status.toEntity(),
    totalAmount = totalAmount.amount,
)
```

---

## 값 객체(Value Object)로 원시 타입 포장

```kotlin
// ❌ 원시 타입 사용 — userId와 orderId가 바뀌어도 컴파일 에러 없음
fun findOrdersByUser(userId: Long, orderId: Long): List<Order>

// ✅ 값 객체 — 타입이 다르면 컴파일 에러
fun findOrdersByUser(userId: UserId, orderId: OrderId): List<Order>
```

```kotlin
@JvmInline
value class UserId(val value: Long)

@JvmInline
value class OrderId(val value: Long)

@JvmInline
value class ProductId(val value: Long)

// 인라인 클래스 — 런타임에 Long과 동일, 래핑 비용 없음
val userId = UserId(1L)
val orderId = OrderId(1L)
// findOrdersByUser(orderId, userId)  // ← 컴파일 에러!
```

### Money 값 객체

```kotlin
data class Money(val amount: BigDecimal, val currency: String = "KRW") {

    companion object {
        val ZERO = Money(BigDecimal.ZERO)
        fun of(amount: Long) = Money(amount.toBigDecimal())
        fun of(amount: Int) = Money(amount.toBigDecimal())
    }

    operator fun plus(other: Money): Money {
        require(currency == other.currency) { "통화 불일치: $currency vs ${other.currency}" }
        return copy(amount = amount + other.amount)
    }

    operator fun minus(other: Money): Money {
        require(currency == other.currency) { "통화 불일치" }
        return copy(amount = amount - other.amount)
    }

    operator fun times(quantity: Int): Money =
        copy(amount = amount * quantity.toBigDecimal())

    fun isPositive() = amount > BigDecimal.ZERO
    fun isZero() = amount.compareTo(BigDecimal.ZERO) == 0
}
```

---

## copy()로 상태 전이 표현

도메인 모델에 상태 변경 메서드를 추가하되, 내부 상태를 변경하는 대신 새 객체를 반환한다.

```kotlin
data class Order(
    val id: OrderId,
    val status: OrderStatus,
    val items: List<OrderItem>,
    val totalAmount: Money,
    val shippingAddress: Address?,
    val cancelledAt: Instant?,
) {
    companion object {
        fun create(command: CreateOrderCommand): Order = Order(
            id = OrderId(0),
            status = OrderStatus.Pending,
            items = command.items.map { OrderItem.from(it) },
            totalAmount = command.items.sumOf { it.unitPrice * it.quantity },
            shippingAddress = null,
            cancelledAt = null,
        )
    }

    // 상태 전이 — 새 객체 반환
    fun confirm(): Order {
        require(status == OrderStatus.Pending) { "확인은 대기 상태에서만 가능합니다" }
        return copy(status = OrderStatus.Confirmed)
    }

    fun ship(trackingNumber: String): Order {
        require(status == OrderStatus.Confirmed) { "배송은 확인 상태에서만 가능합니다" }
        return copy(status = OrderStatus.Shipped(trackingNumber))
    }

    fun cancel(reason: String): Order {
        require(status !is OrderStatus.Cancelled) { "이미 취소된 주문입니다" }
        return copy(
            status = OrderStatus.Cancelled(reason),
            cancelledAt = Instant.now(),
        )
    }

    fun addItem(item: OrderItem): Order =
        copy(
            items = items + item,
            totalAmount = totalAmount + item.subtotal,
        )
}
```

---

## 불변 도메인 모델과 JPA의 긴장

JPA는 변경 감지(Dirty Checking)를 위해 엔티티를 mutable하게 유지하길 원한다. 불변 도메인 모델과 충돌이 생긴다.

해결책: **JPA 엔티티는 영속성 레이어에서만 mutable**하게 유지하고, **도메인 레이어는 완전히 불변**으로 분리한다.

```kotlin
// Repository — 도메인 모델을 받아 엔티티로 변환 후 저장
@Repository
class OrderRepository(private val jpaRepository: OrderJpaRepository) {

    fun findById(id: OrderId): Order? =
        jpaRepository.findById(id.value)
            .map { it.toDomain() }
            .orElse(null)

    fun save(order: Order): Order {
        val entity = if (order.id.value == 0L) {
            order.toEntity()  // 신규 — 새 엔티티 생성
        } else {
            jpaRepository.findById(order.id.value)
                .orElseThrow()
                .apply { updateFrom(order) }  // 기존 — 엔티티 상태 업데이트
        }
        return jpaRepository.save(entity).toDomain()
    }
}

// 엔티티 — 도메인 모델로부터 자신을 업데이트하는 메서드
fun OrderEntity.updateFrom(order: Order) {
    this.status = order.status.toEntity()
    this.updatedAt = Instant.now()
    // items 동기화 등...
}
```

---

## 정리

| | Mutable Entity | 불변 도메인 모델 |
|---|---|---|
| 상태 변경 | 직접 변경 (`order.status = ...`) | 새 객체 반환 (`order.copy(...)`) |
| JPA 연동 | 직접 사용 | 엔티티 별도 분리 |
| 테스트 | 상태 추적 필요 | 입력/출력만 검증 |
| 동시성 | 공유 상태 변경 위험 | 안전 |
| 코드량 | 적음 | 변환 함수 추가 필요 |

불변 도메인 모델은 초기 설정 비용이 있지만, 도메인 로직의 예측 가능성과 테스트 용이성이 크게 향상된다. 특히 복잡한 비즈니스 규칙이 있는 도메인에서 효과가 두드러진다.
