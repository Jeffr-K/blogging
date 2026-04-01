---
title: "[Kotlin FP] 2. Arrow-kt 입문 — Option, Either, Raise"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "arrow-kt", "Either", "Option", "Raise", "FP"]
---

# Arrow-kt 입문 — Option, Either, Raise

Kotlin 표준 라이브러리는 `Result<T>`를 제공하지만, 에러 타입을 지정할 수 없다 (`Throwable`만 가능). **Arrow-kt**는 FP에서 자주 쓰이는 `Option`, `Either`, `Raise` 등을 Kotlin에 맞게 구현한 라이브러리다.

---

## 프로젝트 설정

```kotlin
// build.gradle.kts
dependencies {
    implementation("io.arrow-kt:arrow-core:1.2.4")
    implementation("io.arrow-kt:arrow-fx-coroutines:1.2.4")  // 코루틴 지원
}
```

---

## Option — null의 타입 안전한 대안

`Option<A>`는 값이 있거나(`Some<A>`) 없거나(`None`)를 명시적으로 표현한다.

```kotlin
import arrow.core.Option
import arrow.core.Some
import arrow.core.None
import arrow.core.toOption

// 직접 생성
val found: Option<User> = Some(User(id = 1L, name = "김철수"))
val notFound: Option<User> = None

// Nullable에서 변환
val user: User? = userRepository.findByEmail("test@example.com")
val option: Option<User> = user.toOption()

// 처리
val name: String = option
    .map { it.name }
    .getOrElse { "알 수 없는 사용자" }
```

### Nullable vs Option 선택 기준

```kotlin
// Nullable — 간단한 경우, 내부 로직
fun findUser(id: Long): User? = repository.findById(id)

// Option — 변환 체인이 길거나 명시성이 중요한 경우
fun findActiveUser(id: Long): Option<User> =
    repository.findById(id)
        .toOption()
        .filter { it.isActive }
```

실무에서는 Nullable을 주로 쓰고, 변환 체인이 복잡해질 때 `Option`으로 전환하는 것이 자연스럽다. **Either가 더 자주 쓰인다.**

---

## Either — 성공 또는 실패

`Either<A, B>`는 두 가지 상태를 가진다.
- `Left<A>` — 보통 실패/에러
- `Right<B>` — 보통 성공/값

```kotlin
import arrow.core.Either
import arrow.core.left
import arrow.core.right

sealed class UserError {
    data class NotFound(val id: Long) : UserError()
    data class InvalidEmail(val email: String) : UserError()
    object Inactive : UserError()
}

fun findUser(id: Long): Either<UserError, User> {
    val user = repository.findById(id)
        ?: return UserError.NotFound(id).left()  // Left — 실패
    if (!user.isActive) return UserError.Inactive.left()
    return user.right()  // Right — 성공
}
```

### map / flatMap 체인

```kotlin
fun getUserProfile(id: Long): Either<UserError, UserProfile> =
    findUser(id)
        .map { user -> user.toProfile() }  // Right면 변환, Left면 그대로 통과

fun getOrderHistory(id: Long): Either<UserError, List<Order>> =
    findUser(id)
        .flatMap { user ->                 // Right면 다음 Either 계산
            orderRepository.findByUserId(user.id)
                .right()
        }
```

### 여러 단계 체인

```kotlin
fun processOrder(command: CreateOrderCommand): Either<OrderError, Order> =
    validateCommand(command)          // Either<OrderError, ValidCommand>
        .flatMap { valid -> findUser(valid.userId) }   // Either<OrderError, User>
        .flatMap { user -> checkStock(command.items) } // Either<OrderError, StockResult>
        .flatMap { stock -> createOrder(command, stock) }
        .map { order -> orderRepository.save(order) }
```

체인 중 어느 단계에서든 `Left`가 반환되면 이후 단계는 건너뛰고 최종 `Left`가 된다. 예외 던지기 없이 실패 흐름이 자연스럽게 전파된다.

---

## Raise DSL — Either를 더 읽기 쉽게

Arrow 1.2부터 `Raise<E>` DSL이 권장 방식이다. `flatMap` 체인 대신 `raise()`와 일반 코드처럼 작성할 수 있다.

```kotlin
import arrow.core.raise.either
import arrow.core.raise.ensure
import arrow.core.raise.Raise

// Raise DSL 사용
fun processOrder(command: CreateOrderCommand): Either<OrderError, Order> = either {
    // ensure — 조건 불만족 시 자동으로 raise (Left 반환)
    ensure(command.items.isNotEmpty()) { OrderError.EmptyItems }

    val user = findUser(command.userId).bind()  // Left면 여기서 중단
    val stock = checkStock(command.items).bind()

    ensure(stock.isAvailable) {
        OrderError.InsufficientStock(stock.productId, stock.requested, stock.available)
    }

    val order = Order.create(command, user)
    orderRepository.save(order)  // 마지막 값이 Right로 래핑됨
}
```

`bind()`는 `Either<E, A>`에서 `A`를 꺼낸다. `Left`면 즉시 `either` 블록을 탈출해 해당 `Left`를 반환한다.

### Raise를 함수 시그니처에 직접 표현

```kotlin
// Raise<E>를 컨텍스트 수신자로 사용
context(Raise<OrderError>)
fun validateItems(items: List<OrderItem>): List<ValidItem> {
    ensure(items.isNotEmpty()) { OrderError.EmptyItems }
    return items.map { item ->
        ensure(item.quantity > 0) { OrderError.InvalidQuantity(item.productId) }
        ValidItem(item.productId, item.quantity)
    }
}

// 호출 시
val result: Either<OrderError, Order> = either {
    val validItems = validateItems(command.items)  // Raise 컨텍스트 자동 전달
    // ...
}
```

---

## fold — Either 최종 처리

컨트롤러 레이어에서 `Either`를 HTTP 응답으로 변환할 때 `fold`를 쓴다.

```kotlin
@RestController
class OrderController(private val orderService: OrderService) {

    @PostMapping("/api/orders")
    fun createOrder(@RequestBody command: CreateOrderCommand): ResponseEntity<*> =
        orderService.processOrder(command).fold(
            ifLeft = { error ->
                when (error) {
                    is OrderError.NotFound        -> ResponseEntity.notFound().build()
                    is OrderError.EmptyItems      -> ResponseEntity.badRequest().body(error)
                    is OrderError.InsufficientStock -> ResponseEntity.unprocessableEntity().body(error)
                    OrderError.PaymentFailed      -> ResponseEntity.status(502).body(error)
                }
            },
            ifRight = { order ->
                ResponseEntity.status(201).body(order)
            }
        )
}
```

---

## 표준 Result<T>와 비교

| | `kotlin.Result<T>` | `Either<E, A>` |
|---|---|---|
| 에러 타입 | `Throwable`만 | 커스텀 sealed class |
| 에러 정보 | 스택 트레이스 | 도메인 에러 값 |
| 체이닝 | `map`, `mapCatching` | `map`, `flatMap`, `bind()` |
| 패턴 매칭 | `isSuccess`/`isFailure` | `fold`, `when (error)` |

도메인 에러를 타입으로 다루고 싶다면 `Either`가 훨씬 적합하다.

---

## 정리

- `Option` — null을 명시적으로 표현. 단순한 경우 Nullable을 써도 됨.
- `Either` — 실패 가능한 연산. 에러 타입을 sealed class로 지정.
- `Raise` DSL — `either { ... }` 블록 안에서 일반 코드처럼 작성.
- `bind()` — Either에서 값을 꺼내고, Left면 즉시 탈출.
- `fold` — Either를 최종적으로 HTTP 응답 등으로 변환.

다음 글에서는 서비스 레이어 전체를 `Either`로 구성하는 방법을 다룬다.
