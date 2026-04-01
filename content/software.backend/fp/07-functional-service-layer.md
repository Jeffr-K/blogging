---
title: "[Kotlin FP] 7. 순수 함수로 서비스 레이어 작성"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "순수함수", "부수효과", "테스트", "FP"]
---

# 순수 함수로 서비스 레이어 작성

서비스 레이어에서 비즈니스 로직과 부수 효과(DB 저장, 이벤트 발행, 외부 API 호출)가 뒤섞이면 테스트하기 어렵다. FP의 핵심 원칙 중 하나는 **순수 함수(비즈니스 로직)와 부수 효과를 분리**하는 것이다.

---

## 전형적인 서비스 — 뒤섞인 코드

```kotlin
@Service
class DiscountService(
    private val userRepository: UserRepository,
    private val orderRepository: OrderRepository,
    private val couponRepository: CouponRepository,
) {
    fun calculateDiscount(userId: Long, couponCode: String, orderAmount: Money): Money {
        val user = userRepository.findById(userId)    // 부수 효과 (DB)
            ?: throw UserNotFoundException()

        val coupon = couponRepository.findByCode(couponCode)  // 부수 효과 (DB)
            ?: throw CouponNotFoundException()

        if (!coupon.isValid()) throw InvalidCouponException()  // 비즈니스 로직

        val orderCount = orderRepository.countByUserId(userId)  // 부수 효과 (DB)

        // 비즈니스 로직이 부수 효과 사이에 흩어져 있음
        return when {
            user.isVip && orderCount >= 10 -> orderAmount * 0.2.toBigDecimal()
            coupon.discountRate != null    -> orderAmount * coupon.discountRate
            coupon.discountAmount != null  -> coupon.discountAmount
            else                           -> Money.ZERO
        }
    }
}
```

이 함수를 테스트하려면 DB Mock이 3개 필요하다.

---

## 부수 효과를 레이어 경계로 밀어내기

비즈니스 로직을 **순수 함수**로 분리한다. 순수 함수는 외부 상태에 접근하지 않고, 입력만으로 출력을 결정한다.

```kotlin
// ✅ 순수 함수 — 비즈니스 로직만
object DiscountCalculator {

    fun calculate(
        user: User,
        coupon: Coupon,
        orderCount: Int,
        orderAmount: Money,
    ): Either<DiscountError, Money> {
        if (!coupon.isValid()) return DiscountError.InvalidCoupon(coupon.code).left()

        val discount = when {
            user.isVip && orderCount >= 10 -> orderAmount * 0.2.toBigDecimal()
            coupon.discountRate != null    -> orderAmount * coupon.discountRate
            coupon.discountAmount != null  -> coupon.discountAmount
            else                           -> Money.ZERO
        }

        return discount.right()
    }
}
```

```kotlin
// 서비스 — 부수 효과(데이터 수집) + 순수 함수 호출
@Service
class DiscountService(
    private val userRepository: UserRepository,
    private val orderRepository: OrderRepository,
    private val couponRepository: CouponRepository,
) {
    fun calculateDiscount(
        userId: Long,
        couponCode: String,
        orderAmount: Money,
    ): Either<DiscountError, Money> = either {
        // 부수 효과: 데이터 수집
        val user       = userRepository.findById(userId)
            .toEither { DiscountError.UserNotFound(userId) }.bind()
        val coupon     = couponRepository.findByCode(couponCode)
            .toEither { DiscountError.CouponNotFound(couponCode) }.bind()
        val orderCount = orderRepository.countByUserId(userId)

        // 순수 함수: 비즈니스 로직
        DiscountCalculator.calculate(user, coupon, orderCount, orderAmount).bind()
    }
}
```

---

## 순수 함수 테스트 — Mock 없이

`DiscountCalculator`는 순수 함수이므로 Mock이 전혀 필요 없다.

```kotlin
class DiscountCalculatorTest {

    @Test
    fun `VIP 사용자가 10회 이상 주문 시 20% 할인`() {
        val user   = User(isVip = true)
        val coupon = Coupon(code = "VIP2024", isValid = true, discountRate = null, discountAmount = null)
        val amount = Money.of(100_000)

        val result = DiscountCalculator.calculate(user, coupon, orderCount = 10, orderAmount = amount)

        result shouldBe Money.of(20_000).right()
    }

    @Test
    fun `만료된 쿠폰 사용 시 InvalidCoupon 에러`() {
        val user   = User(isVip = false)
        val coupon = Coupon(code = "EXPIRED", isValid = false)
        val amount = Money.of(50_000)

        val result = DiscountCalculator.calculate(user, coupon, orderCount = 0, orderAmount = amount)

        result shouldBe DiscountError.InvalidCoupon("EXPIRED").left()
    }

    @Test
    fun `정액 쿠폰 — 5000원 할인`() {
        val user   = User(isVip = false)
        val coupon = Coupon(code = "SAVE5000", isValid = true, discountAmount = Money.of(5_000))
        val amount = Money.of(30_000)

        val result = DiscountCalculator.calculate(user, coupon, orderCount = 2, orderAmount = amount)

        result shouldBe Money.of(5_000).right()
    }
}
```

DB가 없어도 테스트가 통과한다. 실행 속도도 빠르다.

---

## 도메인 서비스 — 순수 비즈니스 로직 집합

순수 함수를 object로 묶으면 **도메인 서비스**가 된다.

```kotlin
object OrderPricingService {

    fun calculateTotal(items: List<OrderItem>): Money =
        items.fold(Money.ZERO) { acc, item -> acc + item.subtotal }

    fun applyDiscount(total: Money, discount: Money): Either<PricingError, Money> {
        if (discount > total) return PricingError.DiscountExceedsTotal.left()
        return (total - discount).right()
    }

    fun calculateShipping(total: Money, address: Address): Money = when {
        total >= Money.of(50_000) -> Money.ZERO  // 5만원 이상 무료
        address.isRemote          -> Money.of(5_000)
        else                      -> Money.of(3_000)
    }

    fun finalPrice(
        items: List<OrderItem>,
        discount: Money,
        address: Address,
    ): Either<PricingError, FinalPrice> = either {
        val itemTotal   = calculateTotal(items)
        val discounted  = applyDiscount(itemTotal, discount).bind()
        val shipping    = calculateShipping(discounted, address)
        FinalPrice(itemTotal, discount, shipping, discounted + shipping)
    }
}
```

```kotlin
data class FinalPrice(
    val itemTotal: Money,
    val discount: Money,
    val shipping: Money,
    val total: Money,
)
```

---

## 레이어별 역할 분리

```
Controller
  │  HTTP 요청/응답 변환, 인증 확인
  │
  ▼
Application Service (@Service)
  │  부수 효과 조율 (Repository, EventPublisher, 외부 API)
  │  순수 함수 호출
  │
  ▼
Domain Service (object)
  │  순수 비즈니스 로직
  │  의존성 없음, 테스트 쉬움
  │
  ▼
Domain Model (data class)
     상태 표현, copy()로 변경
```

```kotlin
// Application Service — 조율만 담당
@Service
class OrderApplicationService(
    private val userRepository: UserRepository,
    private val orderRepository: OrderRepository,
    private val couponRepository: CouponRepository,
    private val eventPublisher: ApplicationEventPublisher,
) {
    @Transactional
    fun placeOrder(command: PlaceOrderCommand): Either<OrderError, Order> = either {
        // 1. 데이터 수집 (부수 효과)
        val user   = userRepository.findById(command.userId).bind()
        val coupon = command.couponCode?.let {
            couponRepository.findByCode(it).bind()
        }

        // 2. 순수 함수로 가격 계산
        val pricing = OrderPricingService.finalPrice(
            items    = command.items,
            discount = coupon?.let { DiscountCalculator.calculate(user, it, ...).bind() } ?: Money.ZERO,
            address  = command.shippingAddress,
        ).bind()

        // 3. 도메인 모델 생성 (순수)
        val order = Order.create(command, pricing)

        // 4. 저장 (부수 효과)
        val saved = orderRepository.save(order)

        // 5. 이벤트 발행 (부수 효과)
        eventPublisher.publishEvent(OrderPlacedEvent(saved.id, saved.totalAmount))

        saved
    }
}
```

---

## 정리

- **순수 함수**: 외부 상태 없이 입력 → 출력만. Mock 없이 테스트 가능.
- **Application Service**: 부수 효과(DB, 이벤트, 외부 API)를 조율. 순수 함수를 호출.
- **Domain Service (`object`)**: 비즈니스 로직만 담당. Spring 빈이 아니어도 됨.
- 분리하면 비즈니스 로직 테스트가 `@SpringBootTest` 없이 밀리초 단위로 실행된다.
