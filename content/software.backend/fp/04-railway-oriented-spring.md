---
title: "[Kotlin FP] 4. Railway Oriented Programming — Spring 서비스에 적용"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "railway-oriented", "Either", "FP", "파이프라인"]
---

# Railway Oriented Programming — Spring 서비스에 적용

Railway Oriented Programming(ROP)은 스콧 와슬라신이 제안한 패턴이다. 비즈니스 로직을 "두 개의 레일 위를 달리는 기차"로 모델링한다.

- **성공 레일(Right track)**: 모든 게 잘 될 때
- **실패 레일(Left track)**: 어딘가에서 에러가 발생했을 때

중간에 에러가 나면 기차가 실패 레일로 전환되고, 이후 구간은 전부 건너뛴다. `Either`가 바로 이 두 레일을 표현하는 타입이다.

---

## 기존 Spring 서비스의 문제

주문 생성 로직을 예시로 보자.

```kotlin
// ❌ 예외 기반 — 실패 경로가 분산되어 있음
@Service
class OrderService {
    fun createOrder(command: CreateOrderCommand): Order {
        val user = userRepository.findById(command.userId)
            ?: throw UserNotFoundException("사용자 없음: ${command.userId}")

        if (!user.isActive) throw InactiveUserException("비활성 사용자")

        command.items.forEach { item ->
            val stock = stockRepository.findByProductId(item.productId)
                ?: throw ProductNotFoundException("상품 없음: ${item.productId}")
            if (stock.quantity < item.quantity)
                throw InsufficientStockException("재고 부족")
        }

        val order = Order.create(command)
        val saved = orderRepository.save(order)

        val paymentResult = paymentService.charge(saved.id, saved.totalAmount)
        if (!paymentResult.isSuccess) throw PaymentFailedException("결제 실패")

        return saved.copy(status = OrderStatus.Confirmed)
    }
}
```

문제점:
- 예외가 어디서 던져질지 흐름을 따라가야 함
- 실패 경로가 함수 시그니처에 드러나지 않음
- `@ExceptionHandler`가 없으면 500으로 처리됨

---

## ROP로 재구성

각 단계를 `Either`를 반환하는 함수로 분리한다.

```kotlin
// 각 단계 함수 정의
private fun findActiveUser(userId: Long): Either<OrderError, User> =
    userRepository.findById(userId)
        .toEither { OrderError.UserNotFound(userId) }
        .flatMap { user ->
            if (user.isActive) user.right()
            else OrderError.InactiveUser(userId).left()
        }

private fun validateStock(items: List<OrderItem>): Either<OrderError, List<StockInfo>> = either {
    items.map { item ->
        val stock = stockRepository.findByProductId(item.productId)
            .toEither { OrderError.ProductNotFound(item.productId) }
            .bind()
        ensure(stock.quantity >= item.quantity) {
            OrderError.InsufficientStock(item.productId, item.quantity, stock.quantity)
        }
        StockInfo(item.productId, item.quantity)
    }
}

private fun saveOrder(command: CreateOrderCommand, user: User): Either<OrderError, Order> =
    Either.catch { orderRepository.save(Order.create(command, user)) }
        .mapLeft { OrderError.PersistenceFailed }

private fun processPayment(order: Order): Either<OrderError, Order> =
    paymentService.charge(order.id, order.totalAmount)
        .mapLeft { OrderError.PaymentFailed }
        .map { order.copy(status = OrderStatus.Confirmed) }
```

이제 각 단계를 파이프라인으로 연결한다.

```kotlin
// ✅ ROP — 파이프라인으로 구성
@Service
class OrderService {
    fun createOrder(command: CreateOrderCommand): Either<OrderError, Order> =
        findActiveUser(command.userId)
            .flatMap { user -> validateStock(command.items).map { user to it } }
            .flatMap { (user, _) -> saveOrder(command, user) }
            .flatMap { order -> processPayment(order) }
}
```

또는 `either { }` DSL로 더 읽기 쉽게:

```kotlin
fun createOrder(command: CreateOrderCommand): Either<OrderError, Order> = either {
    val user  = findActiveUser(command.userId).bind()
    val stock = validateStock(command.items).bind()
    val order = saveOrder(command, user).bind()
    processPayment(order).bind()
}
```

---

## 시각화

```
입력: CreateOrderCommand
  │
  ▼
findActiveUser()
  ├── Left(UserNotFound)  ──────────────────────────────► 종료
  └── Right(User)
        │
        ▼
      validateStock()
        ├── Left(InsufficientStock) ──────────────────► 종료
        └── Right(List<StockInfo>)
              │
              ▼
            saveOrder()
              ├── Left(PersistenceFailed) ──────────► 종료
              └── Right(Order)
                    │
                    ▼
                  processPayment()
                    ├── Left(PaymentFailed) ──────► 종료
                    └── Right(Order) ────────────► 성공 반환
```

어느 단계에서 Left가 나오면 기차는 실패 레일로 전환되고 이후 단계는 실행되지 않는다.

---

## 각 단계를 독립적으로 테스트

ROP의 핵심 장점 중 하나는 각 단계 함수를 **독립적으로 테스트할 수 있다**는 것이다.

```kotlin
class OrderServiceTest {

    private val userRepository = mockk<UserRepository>()
    private val stockRepository = mockk<StockRepository>()
    private val orderRepository = mockk<OrderRepository>()
    private val paymentService = mockk<PaymentService>()

    private val service = OrderService(userRepository, stockRepository, orderRepository, paymentService)

    @Test
    fun `비활성 사용자 주문 생성 시 InactiveUser 에러 반환`() {
        // given
        val inactiveUser = User(id = 1L, isActive = false)
        every { userRepository.findById(1L) } returns inactiveUser.some()

        // when
        val result = service.createOrder(CreateOrderCommand(userId = 1L, items = listOf()))

        // then
        result shouldBe OrderError.InactiveUser(1L).left()
        verify(exactly = 0) { stockRepository.findByProductId(any()) }  // 재고 확인 안 함
        verify(exactly = 0) { orderRepository.save(any()) }             // 저장 안 함
    }

    @Test
    fun `재고 부족 시 InsufficientStock 에러 반환`() {
        // given
        every { userRepository.findById(1L) } returns User(id = 1L, isActive = true).some()
        every { stockRepository.findByProductId(100L) } returns Stock(productId = 100L, quantity = 1).some()

        val command = CreateOrderCommand(userId = 1L, items = listOf(
            OrderItem(productId = 100L, quantity = 3)  // 1개만 있는데 3개 요청
        ))

        // when
        val result = service.createOrder(command)

        // then
        result shouldBe OrderError.InsufficientStock(100L, 3, 1).left()
    }
}
```

각 단계가 독립 함수이므로 테스트 케이스가 명확해진다.

---

## 트랜잭션과 Either

`@Transactional`과 `Either`를 함께 쓸 때 주의사항이 있다.

```kotlin
@Service
class OrderService {

    @Transactional
    fun createOrder(command: CreateOrderCommand): Either<OrderError, Order> = either {
        val user  = findActiveUser(command.userId).bind()
        val order = saveOrder(command, user).bind()
        // ⚠️ Left를 반환해도 @Transactional은 롤백하지 않음
        // → Either는 예외가 아니기 때문
        processPayment(order).bind()
    }
}
```

`Either`의 Left는 예외가 아니라 정상 반환값이다. `@Transactional`의 롤백은 예외에 의존하므로, Left 반환 시 트랜잭션을 롤백하려면 명시적으로 처리해야 한다.

```kotlin
@Transactional
fun createOrder(command: CreateOrderCommand): Either<OrderError, Order> {
    val result = either {
        val user  = findActiveUser(command.userId).bind()
        val order = saveOrder(command, user).bind()
        processPayment(order).bind()
    }

    // Left면 예외를 던져서 롤백 유발
    if (result.isLeft()) {
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()
    }

    return result
}
```

또는 트랜잭션 경계를 더 좁게 설정하는 방법이 더 깔끔하다:

```kotlin
// 트랜잭션 범위를 DB 작업만으로 한정
@Transactional
fun saveOrderTransactional(command: CreateOrderCommand, user: User): Either<OrderError, Order> =
    Either.catch { orderRepository.save(Order.create(command, user)) }
        .mapLeft { OrderError.PersistenceFailed }

// 결제는 트랜잭션 밖에서
fun createOrder(command: CreateOrderCommand): Either<OrderError, Order> = either {
    val user  = findActiveUser(command.userId).bind()
    val order = saveOrderTransactional(command, user).bind()
    processPayment(order).bind()  // 트랜잭션 밖 — 실패해도 주문은 저장됨
}
```

---

## 정리

ROP의 핵심:
1. 각 단계를 `Either`를 반환하는 함수로 분리
2. `flatMap` 또는 `either { bind() }` DSL로 연결
3. 어느 단계에서 실패해도 이후 단계는 건너뜀
4. 실패 경로가 타입으로 명시되어 컴파일 타임에 검증 가능
5. 각 단계 함수를 독립적으로 테스트 가능

트랜잭션 롤백은 Either와 직접 연동되지 않으므로 트랜잭션 범위를 의도적으로 설계해야 한다.
