---
title: "[Kotlin FP] 10. Coroutines — 함수형 비동기 처리"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "coroutines", "Flow", "비동기", "FP"]
---

# Coroutines — 함수형 비동기 처리

Kotlin Coroutines는 비동기 코드를 동기 코드처럼 작성하게 해준다. FP 관점에서 coroutine의 핵심 가치는 **부수 효과(IO)를 타입으로 표현하고, 비동기 데이터를 함수형 스트림으로 처리**하는 것이다.

---

## suspend 함수와 순수 함수

`suspend` 함수는 일시 중단(suspend)될 수 있는 함수다. IO 작업처럼 블로킹이 발생하는 지점에서 스레드를 점유하지 않고 다른 작업에 양보한다.

```kotlin
// suspend 함수 — 일시 중단 가능 (IO 안전)
suspend fun findUser(id: Long): User? =
    withContext(Dispatchers.IO) {
        userRepository.findById(id)
    }

// 호출 시 코루틴 컨텍스트 필요
suspend fun processOrder(command: CreateOrderCommand): Order {
    val user = findUser(command.userId) ?: throw UserNotFoundException()
    // ...
}
```

`suspend`는 **"이 함수는 IO 또는 비동기 작업을 포함한다"** 는 시그니처 수준의 표시다. IO 작업이 타입에 드러나는 점에서 FP의 "효과 추적" 개념과 유사하다.

---

## Spring Boot + Coroutines 설정

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor")  // WebFlux 연동
    implementation("org.springframework.boot:spring-boot-starter-webflux")
}
```

Spring MVC에서도 `suspend` 컨트롤러를 사용할 수 있다 (Spring Boot 3.2+ 권장).

```kotlin
@RestController
class OrderController(private val orderService: OrderService) {

    // suspend 함수 — Spring이 코루틴으로 자동 처리
    @GetMapping("/api/orders/{id}")
    suspend fun getOrder(@PathVariable id: Long): ResponseEntity<OrderResponse> {
        val order = orderService.findOrder(OrderId(id))
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(order.toResponse())
    }

    @PostMapping("/api/orders")
    suspend fun createOrder(@RequestBody command: CreateOrderCommand): ResponseEntity<OrderResponse> {
        val order = orderService.createOrder(command)
        return ResponseEntity.status(201).body(order.toResponse())
    }
}
```

---

## Either + suspend 조합

Arrow-kt는 `either` DSL 안에서 `suspend` 함수를 직접 사용할 수 있다.

```kotlin
@Service
class OrderService(
    private val userRepository: UserRepository,
    private val orderRepository: OrderRepository,
) {
    suspend fun createOrder(command: CreateOrderCommand): Either<OrderError, Order> = either {
        // suspend + bind() 조합
        val user = userRepository.findById(command.userId)
            .toEither { OrderError.UserNotFound(command.userId) }
            .bind()

        val order = Order.create(command, user)

        // suspend 저장
        orderRepository.save(order).bind()
    }
}
```

```kotlin
// 코루틴 Repository
interface UserRepository {
    suspend fun findById(id: UserId): Either<UserError, User>
    suspend fun save(user: User): Either<UserError, User>
}

@Repository
class UserRepositoryImpl(private val jpaRepository: UserJpaRepository) : UserRepository {

    override suspend fun findById(id: UserId): Either<UserError, User> =
        withContext(Dispatchers.IO) {
            jpaRepository.findById(id.value)
                .map { it.toDomain().right() }
                .orElse(UserError.NotFound(id).left())
        }
}
```

---

## Flow — 함수형 스트림

`Flow<T>`는 비동기 데이터 스트림이다. Rx Observable과 유사하지만 코루틴 기반이고, Kotlin 표준 라이브러리의 컬렉션 함수와 동일한 API를 갖는다.

```kotlin
// Flow 생성
fun ordersFlow(userId: UserId): Flow<Order> = flow {
    var page = 0
    while (true) {
        val orders = orderRepository.findByUserId(userId, page++)
        if (orders.isEmpty()) break
        orders.forEach { emit(it) }
    }
}
```

### 컬렉션과 동일한 API

```kotlin
// List와 동일한 함수형 연산
val totalRevenue: Money = ordersFlow(userId)
    .filter { it.status == OrderStatus.Confirmed }
    .map { it.totalAmount }
    .fold(Money.ZERO) { acc, amount -> acc + amount }

// 비동기 변환
val orderSummaries: Flow<OrderSummary> = ordersFlow(userId)
    .map { order ->
        val user = userRepository.findById(order.userId)  // 각 항목마다 비동기
        OrderSummary(order, user)
    }
    .catch { e -> log.error("스트림 오류", e) }
    .onEach { summary -> log.debug("처리: {}", summary.orderId) }
```

### flatMapMerge — 병렬 처리

```kotlin
// 각 주문의 배송 상태를 병렬로 조회
val ordersWithShipping: Flow<OrderWithShipping> = ordersFlow(userId)
    .flatMapMerge(concurrency = 4) { order ->
        flow {
            val shipping = shippingApiClient.getStatus(order.id)  // 병렬 호출
            emit(OrderWithShipping(order, shipping))
        }
    }
```

---

## Flow in Spring WebFlux

WebFlux에서 `Flow`를 `Flux`처럼 사용할 수 있다.

```kotlin
@RestController
class OrderStreamController(private val orderService: OrderService) {

    // Server-Sent Events 스트리밍
    @GetMapping("/api/orders/stream", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun streamOrders(@RequestParam userId: Long): Flow<OrderEvent> =
        orderService.getOrderEventsFlow(UserId(userId))

    // JSON 배열 반환 (전체 수집 후 반환)
    @GetMapping("/api/orders")
    suspend fun getOrders(@RequestParam userId: Long): List<OrderResponse> =
        orderService.getOrdersFlow(UserId(userId))
            .map { it.toResponse() }
            .toList()
}
```

---

## 병렬 실행 — async/await

```kotlin
// 순차 실행 (느림)
suspend fun getOrderDetail(orderId: OrderId): OrderDetail {
    val order    = orderRepository.findById(orderId)   // 100ms
    val user     = userRepository.findById(order.userId)  // 100ms
    val shipping = shippingRepository.findByOrderId(orderId)  // 100ms
    // 총 300ms
    return OrderDetail(order, user, shipping)
}

// 병렬 실행 (빠름)
suspend fun getOrderDetail(orderId: OrderId): OrderDetail = coroutineScope {
    val order    = findById(orderId)  // 먼저 필요

    val userDeferred     = async { userRepository.findById(order.userId) }     // 100ms 병렬
    val shippingDeferred = async { shippingRepository.findByOrderId(orderId) } // 100ms 병렬

    OrderDetail(order, userDeferred.await(), shippingDeferred.await())
    // 총 ~100ms
}
```

---

## WebFlux vs Coroutines 선택 기준

| | Coroutines | WebFlux (Mono/Flux) |
|---|---|---|
| 코드 스타일 | 순차형 (읽기 쉬움) | 리액티브 체인 (학습 곡선) |
| 팀 친숙도 | Kotlin 사용자에게 자연스러움 | RxJava 경험 있으면 쉬움 |
| 스트리밍 | Flow | Flux |
| 에러 처리 | try-catch 또는 Either | onErrorResume, onErrorMap |
| Spring 통합 | Spring MVC / WebFlux 모두 | WebFlux 필수 |
| 성능 | 동등 (내부적으로 Project Reactor 사용) | 동등 |

Spring Boot 3.2+에서 코루틴을 쓰려면 WebFlux 의존성이 필요하지만, MVC 스타일로 컨트롤러를 작성할 수 있다. **새 프로젝트라면 Coroutines + Spring WebFlux 조합**이 Kotlin 친화적이다.

---

## 구조화된 동시성 (Structured Concurrency)

```kotlin
@Service
class DashboardService(
    private val orderService: OrderService,
    private val userService: UserService,
    private val analyticsService: AnalyticsService,
) {
    // coroutineScope — 자식 코루틴이 모두 완료되어야 반환
    suspend fun getDashboard(userId: UserId): DashboardData = coroutineScope {
        val ordersDeferred   = async { orderService.getRecentOrders(userId) }
        val profileDeferred  = async { userService.getProfile(userId) }
        val statsDeferred    = async { analyticsService.getUserStats(userId) }

        // 하나라도 실패하면 나머지 취소 + 예외 전파
        DashboardData(
            orders  = ordersDeferred.await(),
            profile = profileDeferred.await(),
            stats   = statsDeferred.await(),
        )
    }
}
```

`coroutineScope`는 자식 코루틴이 모두 완료되어야 반환된다. 하나가 실패하면 나머지를 취소한다. 이 "부모-자식 관계"가 Structured Concurrency다.

---

## 정리

- `suspend` 함수: IO 작업이 타입에 드러남. 코루틴 컨텍스트 안에서만 호출 가능.
- `Either` + `suspend`: 비동기 + 타입 안전 에러 처리 조합.
- `Flow<T>`: 비동기 스트림. 컬렉션 함수(`map`, `filter`, `fold`)와 동일한 API.
- `async/await`: 독립적인 작업을 병렬 실행.
- `coroutineScope`: 구조화된 동시성. 자식 실패 시 전체 취소.
