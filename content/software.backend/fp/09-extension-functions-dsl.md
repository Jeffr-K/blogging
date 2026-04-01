---
title: "[Kotlin FP] 9. 확장 함수와 도메인 DSL"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "확장함수", "DSL", "FP"]
---

# 확장 함수와 도메인 DSL

확장 함수는 기존 클래스를 수정하지 않고 새 함수를 추가하는 Kotlin의 기능이다. FP 관점에서 확장 함수는 **데이터 변환 파이프라인을 읽기 쉽게 표현**하는 강력한 도구다.

---

## 확장 함수 기본

```kotlin
// String에 비즈니스 로직 추가
fun String.isValidEmail(): Boolean =
    matches(Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"))

fun String.maskEmail(): String {
    val (local, domain) = split("@")
    return "${local.take(2)}***@$domain"
}

// 사용
"test@example.com".isValidEmail()  // true
"test@example.com".maskEmail()     // "te***@example.com"
```

---

## 도메인 변환 파이프라인

확장 함수를 체이닝해서 변환 파이프라인을 표현한다.

```kotlin
// 확장 함수로 변환 정의
fun CreateOrderRequest.toCommand(): CreateOrderCommand =
    CreateOrderCommand(
        userId   = UserId(userId),
        items    = items.map { it.toCommand() },
        address  = shippingAddress.toAddress(),
        couponCode = couponCode,
    )

fun CreateOrderItemRequest.toCommand(): OrderItemCommand =
    OrderItemCommand(
        productId = ProductId(productId),
        quantity  = quantity,
    )

fun Order.toResponse(): OrderResponse =
    OrderResponse(
        id          = id.value,
        status      = status.name,
        items       = items.map { it.toResponse() },
        totalAmount = totalAmount.amount,
        createdAt   = createdAt,
    )

// Controller — 파이프라인이 명확하게 보임
@PostMapping("/api/orders")
fun createOrder(@RequestBody request: CreateOrderRequest): ResponseEntity<*> =
    orderService.createOrder(request.toCommand())
        .map { it.toResponse() }
        .fold(
            ifLeft  = { it.toResponseEntity() },
            ifRight = { ResponseEntity.status(201).body(it) }
        )
```

---

## Either에 확장 함수 추가

```kotlin
// Either를 HTTP 응답으로 변환하는 확장 함수
fun <E : AppError, T> Either<E, T>.toResponseEntity(
    successStatus: HttpStatus = HttpStatus.OK
): ResponseEntity<*> = fold(
    ifLeft  = { it.toResponseEntity() },
    ifRight = { ResponseEntity.status(successStatus).body(it) }
)

fun AppError.toResponseEntity(): ResponseEntity<ErrorResponse> = when (this) {
    is AppError.NotFound       -> ResponseEntity.status(404).body(ErrorResponse(message))
    is AppError.Conflict       -> ResponseEntity.status(409).body(ErrorResponse(message))
    is AppError.Unauthorized   -> ResponseEntity.status(401).body(ErrorResponse(message))
    is AppError.Forbidden      -> ResponseEntity.status(403).body(ErrorResponse(message))
    is AppError.UnprocessableEntity -> ResponseEntity.status(422).body(ErrorResponse(message))
}

// 사용
@GetMapping("/api/orders/{id}")
fun getOrder(@PathVariable id: Long): ResponseEntity<*> =
    orderService.getOrder(OrderId(id)).map { it.toResponse() }.toResponseEntity()
```

---

## 도메인 DSL 구성

Kotlin의 `@DslMarker`와 람다 수신자(receiver lambda)를 활용해 도메인 DSL을 만든다.

```kotlin
@DslMarker
annotation class OrderDsl

// DSL 빌더
@OrderDsl
class OrderBuilder {
    private var userId: UserId? = null
    private val items = mutableListOf<OrderItem>()
    private var shippingAddress: Address? = null
    private var couponCode: String? = null

    fun userId(id: Long) { userId = UserId(id) }

    fun item(block: OrderItemBuilder.() -> Unit) {
        items += OrderItemBuilder().apply(block).build()
    }

    fun shippingAddress(block: AddressBuilder.() -> Unit) {
        shippingAddress = AddressBuilder().apply(block).build()
    }

    fun coupon(code: String) { couponCode = code }

    fun build(): CreateOrderCommand = CreateOrderCommand(
        userId         = requireNotNull(userId) { "userId는 필수입니다" },
        items          = items.toList(),
        shippingAddress = requireNotNull(shippingAddress) { "배송지는 필수입니다" },
        couponCode     = couponCode,
    )
}

@OrderDsl
class OrderItemBuilder {
    var productId: Long = 0
    var quantity: Int = 1

    fun build() = OrderItem(ProductId(productId), quantity)
}

// DSL 진입점
fun order(block: OrderBuilder.() -> Unit): CreateOrderCommand =
    OrderBuilder().apply(block).build()
```

```kotlin
// 사용 — 읽기 쉬운 DSL
val command = order {
    userId(1L)

    item {
        productId = 100L
        quantity  = 2
    }

    item {
        productId = 200L
        quantity  = 1
    }

    shippingAddress {
        zipCode = "12345"
        street  = "강남대로 123"
        detail  = "101호"
    }

    coupon("SAVE5000")
}
```

---

## Spring Security DSL 분석

Spring Security 6은 Kotlin DSL을 공식 지원한다. 내부가 확장 함수 + 수신자 람다로 구성되어 있다.

```kotlin
@Bean
fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
    http {
        csrf { disable() }

        authorizeHttpRequests {
            authorize("/api/public/**", permitAll)
            authorize("/api/admin/**", hasRole("ADMIN"))
            authorize(anyRequest, authenticated)
        }

        sessionManagement {
            sessionCreationPolicy = SessionCreationPolicy.STATELESS
        }

        addFilterBefore<UsernamePasswordAuthenticationFilter>(jwtAuthFilter)
    }
    return http.build()
}
```

이 DSL은 다음처럼 구현되어 있다:

```kotlin
// Spring Security 내부 구현 패턴
fun HttpSecurity.invoke(block: HttpSecurityDsl.() -> Unit): HttpSecurity =
    apply { HttpSecurityDsl(this).apply(block) }

@SecurityMarker
class HttpSecurityDsl(private val http: HttpSecurity) {
    fun csrf(block: CsrfDsl.() -> Unit = {}) {
        val csrfCustomizer = CsrfDsl().apply(block)
        http.csrf(csrfCustomizer)
    }
    // ...
}
```

---

## QueryDSL Builder 확장

Spring Data JPA의 `JPAQueryFactory`에 확장 함수를 추가하면 반복 코드를 줄일 수 있다.

```kotlin
// 확장 함수로 공통 패턴 추출
fun <T> JPAQuery<T>.withPaging(pageable: Pageable): JPAQuery<T> =
    offset(pageable.offset).limit(pageable.pageSize.toLong())

fun <T> JPAQuery<T>.orderByPageable(pageable: Pageable, entity: EntityPathBase<*>): JPAQuery<T> {
    pageable.sort.forEach { order ->
        val path = entity.getString(order.property)
        if (order.isAscending) orderBy(path.asc()) else orderBy(path.desc())
    }
    return this
}

// Repository에서 사용
@Repository
class OrderQueryRepository(private val queryFactory: JPAQueryFactory) {

    fun findOrders(condition: OrderSearchCondition, pageable: Pageable): Page<Order> {
        val order = QOrderEntity.orderEntity

        val query = queryFactory
            .selectFrom(order)
            .where(
                condition.userId?.let { order.userId.eq(it) },
                condition.status?.let { order.status.eq(it) },
                condition.fromDate?.let { order.createdAt.goe(it) },
                condition.toDate?.let { order.createdAt.loe(it) },
            )
            .withPaging(pageable)
            .orderByPageable(pageable, order)

        val content = query.fetch().map { it.toDomain() }
        val total   = queryFactory.select(order.count()).from(order)
            .where(query.metadata.where).fetchOne() ?: 0L

        return PageImpl(content, pageable, total)
    }
}
```

---

## 테스트 DSL

테스트 픽스처를 DSL로 만들면 테스트 코드의 가독성이 올라간다.

```kotlin
// 테스트 픽스처 DSL
fun testUser(block: TestUserBuilder.() -> Unit = {}): User =
    TestUserBuilder().apply(block).build()

class TestUserBuilder {
    var id: Long = 1L
    var name: String = "테스트 사용자"
    var email: String = "test@example.com"
    var isVip: Boolean = false
    var isActive: Boolean = true

    fun build() = User(UserId(id), name, email, isVip, isActive)
}

// 테스트에서 사용
@Test
fun `VIP 사용자 할인 테스트`() {
    val vipUser = testUser { isVip = true }
    val coupon  = testCoupon { discountRate = BigDecimal("0.2") }

    val result = DiscountCalculator.calculate(vipUser, coupon, 10, Money.of(100_000))

    result shouldBe Money.of(20_000).right()
}
```

---

## 정리

- **확장 함수**: 기존 클래스 수정 없이 변환/유틸 함수 추가. 파이프라인을 자연스럽게 표현.
- **수신자 람다**: `block: Builder.() -> Unit` 패턴으로 DSL 구성.
- **@DslMarker**: DSL 중첩 오용을 컴파일 타임에 방지.
- Spring Security, Spring MVC 등 Spring의 Kotlin DSL도 동일한 패턴.
- 테스트 픽스처 DSL로 테스트 코드의 가독성 향상.
