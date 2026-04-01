---
title: "[Kotlin FP] 1. Kotlin FP 기초 — data class, sealed class, 불변성"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "함수형프로그래밍", "FP", "data-class", "sealed-class"]
---

# Kotlin FP 기초 — data class, sealed class, 불변성

함수형 프로그래밍의 핵심은 **불변성**과 **타입으로 도메인 표현하기**다. Kotlin은 언어 수준에서 이 두 가지를 강하게 지원한다. Spring Boot 프로젝트에 FP를 도입하기 전에, Kotlin이 제공하는 FP 도구부터 살펴본다.

---

## val 우선 원칙

```kotlin
// ❌ var — 언제 바뀔지 모름
var userId = "user-123"
userId = "user-456"  // 추적하기 어려움

// ✅ val — 변경 불가, 의도가 명확
val userId = "user-123"
```

`var`을 쓰면 해당 값이 어느 시점에 어떤 값인지 추적해야 한다. `val`을 기본으로 쓰면 읽을 때 "이 값은 절대 바뀌지 않는다"는 확신을 가질 수 있다.

Spring 서비스 클래스에서도 동일한 원칙을 적용한다.

```kotlin
@Service
class OrderService(
    private val orderRepository: OrderRepository,  // val — 재할당 불가
    private val eventPublisher: ApplicationEventPublisher,
) {
    fun createOrder(command: CreateOrderCommand): Order {
        val order = Order.create(command)           // val — 불변 참조
        val saved = orderRepository.save(order)    // val
        eventPublisher.publishEvent(OrderCreatedEvent(saved.id))
        return saved
    }
}
```

---

## 불변 컬렉션

Kotlin의 컬렉션은 기본이 불변(read-only)이다.

```kotlin
val items = listOf("a", "b", "c")  // List<String> — add() 없음
val map = mapOf("key" to "value")  // Map<String, String>

// 변경이 필요하면 새 컬렉션 반환
val newItems = items + "d"         // ["a", "b", "c", "d"] — 원본 유지
val filtered = items.filter { it != "b" }  // ["a", "c"]
```

```kotlin
// ❌ mutableListOf — 외부에서 변경 가능
fun getOrders(): MutableList<Order> = mutableListOf(...)

// ✅ List 반환 — 호출자가 변경 불가
fun getOrders(): List<Order> = listOf(...)
```

---

## data class — 값 객체 표현

`data class`는 `equals()`, `hashCode()`, `toString()`, `copy()`를 자동 생성한다. 도메인의 값 객체(Value Object)나 DTO를 표현하기에 적합하다.

```kotlin
data class Money(val amount: BigDecimal, val currency: String) {

    operator fun plus(other: Money): Money {
        require(currency == other.currency) { "통화 불일치" }
        return copy(amount = amount + other.amount)
    }

    operator fun times(quantity: Int): Money =
        copy(amount = amount * quantity.toBigDecimal())
}

val price = Money(BigDecimal("10000"), "KRW")
val doubled = price * 2   // Money(amount=20000, currency=KRW) — 원본 유지
```

### copy()로 상태 변경 표현

mutation 없이 "변경된 새 객체"를 만든다.

```kotlin
data class Order(
    val id: OrderId,
    val status: OrderStatus,
    val items: List<OrderItem>,
    val totalAmount: Money,
)

// ❌ mutation
fun confirmOrder(order: Order): Order {
    order.status = OrderStatus.CONFIRMED  // 컴파일 에러 — val이므로
    return order
}

// ✅ copy()
fun confirmOrder(order: Order): Order =
    order.copy(status = OrderStatus.CONFIRMED)

fun addItem(order: Order, item: OrderItem): Order =
    order.copy(
        items = order.items + item,
        totalAmount = order.totalAmount + item.price,
    )
```

---

## sealed class — 합 타입(Sum Type)

`sealed class`는 가능한 상태를 타입으로 닫아둔다. `when`과 함께 쓰면 컴파일러가 누락된 케이스를 잡아준다.

```kotlin
sealed class OrderStatus {
    object Pending : OrderStatus()
    object Confirmed : OrderStatus()
    data class Shipped(val trackingNumber: String) : OrderStatus()
    data class Cancelled(val reason: String) : OrderStatus()
}

fun describe(status: OrderStatus): String = when (status) {
    is OrderStatus.Pending   -> "결제 대기"
    is OrderStatus.Confirmed -> "주문 확인"
    is OrderStatus.Shipped   -> "배송 중 — ${status.trackingNumber}"
    is OrderStatus.Cancelled -> "취소됨 — ${status.reason}"
    // else 불필요 — 컴파일러가 모든 케이스를 강제
}
```

### 에러 타입으로 활용

```kotlin
sealed class OrderError {
    data class NotFound(val orderId: OrderId) : OrderError()
    data class AlreadyCancelled(val orderId: OrderId) : OrderError()
    data class InsufficientStock(val productId: ProductId, val requested: Int, val available: Int) : OrderError()
    object PaymentFailed : OrderError()
}
```

이렇게 정의하면 에러의 종류가 컴파일 타임에 확정된다. 처리 누락이 있으면 `when`에서 컴파일 에러가 발생한다.

---

## when expression — 패턴 매칭

```kotlin
// 값 기반
val label = when (order.status) {
    is OrderStatus.Pending   -> "대기"
    is OrderStatus.Confirmed -> "확인"
    is OrderStatus.Shipped   -> "배송"
    is OrderStatus.Cancelled -> "취소"
}

// 범위 기반
val grade = when (score) {
    in 90..100 -> "A"
    in 80..89  -> "B"
    in 70..79  -> "C"
    else       -> "F"
}

// 조건 기반
val message = when {
    order.items.isEmpty()       -> "주문 항목 없음"
    order.totalAmount.amount < BigDecimal.ZERO -> "금액 오류"
    else                        -> "정상"
}
```

`when`은 statement가 아닌 **expression**이다. 결과를 변수에 바로 담을 수 있고, 모든 케이스를 다루지 않으면 컴파일 에러가 발생한다.

---

## Java Spring 코드와 비교

같은 기능을 Java와 Kotlin으로 비교해보자.

```java
// Java — 변경 가능, null 위험, 장황
public class OrderService {
    public Order updateStatus(Long orderId, String status) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new RuntimeException("주문 없음"));
        order.setStatus(status);  // mutation
        return orderRepository.save(order);
    }
}
```

```kotlin
// Kotlin FP — 불변, null 안전, 간결
fun updateStatus(orderId: OrderId, status: OrderStatus): Either<OrderError, Order> =
    orderRepository.findById(orderId)
        .toEither { OrderError.NotFound(orderId) }
        .map { order -> order.copy(status = status) }
        .map { updated -> orderRepository.save(updated) }
```

다음 글에서는 `Either`와 같은 타입을 제공하는 Arrow-kt를 소개한다.

---

## 정리

| 도구 | FP 역할 |
|---|---|
| `val` | 불변 바인딩 |
| `data class` | 값 객체, copy()로 불변 변환 |
| `sealed class` | 합 타입, 완전한 케이스 열거 |
| `when expression` | 패턴 매칭, 컴파일 타임 케이스 검증 |
| 불변 컬렉션 | 공유 상태 변경 방지 |

Kotlin 자체가 이미 FP 친화적으로 설계되어 있다. Spring Boot 프로젝트에서 이 도구들을 일관되게 활용하는 것만으로도 코드의 예측 가능성이 크게 올라간다.
