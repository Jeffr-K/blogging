# Kotest 완전 정복 — Kotlin 테스트 프레임워크 학습 로드맵

> JUnit 5를 대체하는 Kotlin-first 테스트 프레임워크.
> DSL 기반 Spec 스타일, 강력한 Matcher, Property-based Testing까지 한 번에.

---

## 왜 Kotest인가?

| 항목 | JUnit 5 | Kotest |
|------|---------|--------|
| 언어 | Java (Kotlin 지원) | Kotlin-first |
| 테스트 구조 | 메서드 기반 | DSL/Spec 스타일 |
| Matcher | AssertJ 별도 필요 | 내장 Matcher 풍부 |
| Data-Driven | @ParameterizedTest | `withData {}` |
| Property-Based | 별도 라이브러리 | 내장 지원 |
| Coroutine | 추가 설정 필요 | 네이티브 지원 |

---

## 학습 로드맵

| 단계 | 주제 | 목표 |
|------|------|------|
| 1 | Spec 스타일 개요 | FunSpec, StringSpec, BehaviorSpec 이해 |
| 2 | Matcher 완전 정복 | shouldBe, shouldThrow, Collection/String matcher |
| 3 | Lifecycle & Hook | beforeTest, afterEach, TestListener |
| 4 | Data-Driven Testing | withData, forAll, 파라미터 조합 |
| 5 | Property-Based Testing | Arb, Gen, shrinking |
| 6 | Coroutine 테스트 | suspend 함수, Flow 테스트 |
| 7 | Spring Boot 통합 | @SpringBootTest + Kotest Extensions |
| 8 | 고급 패턴 | Custom Matcher, Soft Assertion, Tag/Filter |

---

## Chapter 1. Spec 스타일 선택 가이드

Kotest는 7가지 Spec 스타일을 지원한다.

```kotlin
// FunSpec — 함수 기반, 가장 간결
class OrderServiceTest : FunSpec({
    test("주문 생성 시 재고가 감소한다") {
        // ...
    }
})

// DescribeSpec — describe/it 구조 (RSpec 스타일)
class ProductSpec : DescribeSpec({
    describe("Product") {
        context("재고가 있을 때") {
            it("주문에 성공한다") { }
        }
        context("재고가 없을 때") {
            it("예외를 던진다") { }
        }
    }
})

// BehaviorSpec — Given/When/Then
class PaymentSpec : BehaviorSpec({
    given("유효한 카드") {
        `when`("결제 요청") {
            then("승인된다") { }
        }
    }
})

// StringSpec — 문자열만으로 테스트 이름
class SimpleTest : StringSpec({
    "1 + 1 은 2이다" {
        (1 + 1) shouldBe 2
    }
})

// ShouldSpec — should 키워드
class ShouldTest : ShouldSpec({
    should("양수를 반환한다") { }
})

// WordSpec — subject.should() 구조
// AnnotationSpec — JUnit 호환 @Test 방식
```

**선택 기준:**

| 스타일 | 추천 상황 |
|--------|-----------|
| FunSpec | 단순 유닛 테스트, 팀 온보딩 |
| DescribeSpec | 복잡한 도메인 시나리오 |
| BehaviorSpec | BDD, 기획자와 협업 |
| StringSpec | 간단한 유틸/순수 함수 |

---

## Chapter 2. Matcher 완전 정복

### 기본 Matcher

```kotlin
// 동등성
result shouldBe expected
result shouldNotBe null

// 타입
result shouldBeInstanceOf<OrderResponse>()
result.shouldBeTypeOf<List<String>>()

// Null
result.shouldBeNull()
result.shouldNotBeNull()

// Boolean
flag.shouldBeTrue()
flag.shouldBeFalse()
```

### 숫자 Matcher

```kotlin
price shouldBe 1000.0.plusOrMinus(0.01)
count shouldBeGreaterThan 0
count shouldBeLessThanOrEqualTo 100
count shouldBeInRange 1..50
```

### 문자열 Matcher

```kotlin
name shouldStartWith "Kim"
name shouldEndWith "이"
name shouldContain "서울"
name shouldMatch Regex("\\d{4}-\\d{2}-\\d{2}")
name.shouldHaveLength(10)
name.shouldBeEmpty()
name.shouldNotBeBlank()
```

### 컬렉션 Matcher

```kotlin
list shouldHaveSize 3
list shouldContain "item"
list shouldContainAll listOf("a", "b")
list shouldContainExactly listOf("a", "b", "c")
list shouldContainInOrder listOf("a", "b")
list.shouldBeEmpty()
list.shouldBeSorted()
list.shouldHaveAtLeastSize(1)

// Map
map shouldContainKey "id"
map shouldContainValue 42
map.shouldHaveSize(2)
```

### 예외 Matcher

```kotlin
// shouldThrow
val ex = shouldThrow<IllegalArgumentException> {
    service.create(invalidRequest)
}
ex.message shouldContain "유효하지 않은"

// shouldThrowExactly (서브타입 불허)
shouldThrowExactly<BusinessException> {
    service.process()
}

// shouldNotThrow
shouldNotThrowAny {
    service.safe()
}
```

### Soft Assertion

```kotlin
assertSoftly(response) {
    statusCode shouldBe 200
    body.id shouldNotBeNull()
    body.name shouldBe "테스트"
    // 모든 assertion 실행 후 실패 모아서 보고
}
```

---

## Chapter 3. Lifecycle & Hook

```kotlin
class UserServiceTest : FunSpec({

    // 전체 Spec에서 한 번
    beforeSpec {
        println("Spec 시작")
    }
    afterSpec {
        println("Spec 종료")
    }

    // 각 테스트마다
    beforeTest {
        println("테스트 시작: ${it.name.testName}")
    }
    afterTest { (test, result) ->
        println("테스트 종료: ${result.isSuccess}")
    }

    // 각 테스트 컨테이너마다 (DescribeSpec)
    beforeEach { }
    afterEach { }

    test("example") { }
})
```

### TestListener (재사용 가능한 훅)

```kotlin
object DatabaseListener : BeforeSpecListener, AfterSpecListener {
    override suspend fun beforeSpec(spec: Spec) {
        Database.connect()
    }
    override suspend fun afterSpec(spec: Spec) {
        Database.disconnect()
    }
}

class UserRepoTest : FunSpec({
    listener(DatabaseListener)

    test("조회") { }
})
```

### ProjectConfig (전역 설정)

```kotlin
// src/test/kotlin/io/kotest/provided/ProjectConfig.kt
object ProjectConfig : AbstractProjectConfig() {
    override val parallelism = 4
    override val testCaseOrder = TestCaseOrder.Random

    override fun listeners() = listOf(
        DatabaseListener,
        SlowTestListener
    )

    override fun extensions() = listOf(
        SpringExtension
    )
}
```

---

## Chapter 4. Data-Driven Testing

### withData

```kotlin
data class DivisionTest(val a: Int, val b: Int, val expected: Int)

class CalculatorTest : FunSpec({
    context("나눗셈") {
        withData(
            DivisionTest(10, 2, 5),
            DivisionTest(9, 3, 3),
            DivisionTest(15, 5, 3),
        ) { (a, b, expected) ->
            calculator.divide(a, b) shouldBe expected
        }
    }
})
```

### forAll / forNone

```kotlin
class ValidationTest : FunSpec({
    test("유효한 이메일 형식") {
        forAll(
            row("user@example.com"),
            row("admin@test.co.kr"),
            row("support+tag@mail.org"),
        ) { email ->
            Email.isValid(email) shouldBe true
        }
    }

    test("유효하지 않은 이메일") {
        forNone(
            row("not-an-email"),
            row("@missing.com"),
            row("no-domain@"),
        ) { email ->
            Email.isValid(email)
        }
    }
})
```

### 중첩 withData

```kotlin
withData(nameFn = { "할인율 ${it.rate}%" }, discountRates) { rate ->
    withData(nameFn = { "금액 ${it.amount}원" }, amounts) { amount ->
        calculator.discount(amount, rate) shouldBe (amount * rate / 100)
    }
}
```

---

## Chapter 5. Property-Based Testing

```kotlin
class MoneyTest : FunSpec({

    test("금액은 항상 양수") {
        checkAll(Arb.positiveInt()) { amount ->
            Money.of(amount).value shouldBeGreaterThan 0
        }
    }

    test("두 금액의 합은 교환법칙 성립") {
        checkAll(Arb.int(0..10000), Arb.int(0..10000)) { a, b ->
            Money.of(a).plus(Money.of(b)) shouldBe Money.of(b).plus(Money.of(a))
        }
    }

    test("커스텀 Arb — 유효한 주문 요청") {
        val orderArb = arbitrary {
            OrderRequest(
                productId = Arb.long(1..1000L).bind(),
                quantity = Arb.int(1..99).bind(),
                address = Arb.string(10..50).bind()
            )
        }

        checkAll(orderArb) { request ->
            request.isValid() shouldBe true
        }
    }
})
```

### Shrinking

Property-based test 실패 시 Kotest가 자동으로 최소 실패 케이스를 찾아준다.

```kotlin
// 실패한 케이스: amount=99743
// Shrinking 후:  amount=1 (최소 재현 케이스)
checkAll(Arb.positiveInt()) { amount ->
    assumeTrue(amount > 0)
    service.process(amount) shouldBe "ok" // 특정 값에서 실패
}
```

---

## Chapter 6. Coroutine 테스트

Kotest는 `suspend` 함수를 별도 설정 없이 테스트할 수 있다.

```kotlin
class AsyncServiceTest : FunSpec({

    test("suspend 함수 직접 호출") {
        val result = asyncService.fetchUser(1L)
        result.name shouldBe "김철수"
    }

    test("timeout 설정") {
        withTimeout(1000) {
            slowService.process()
        }
    }

    test("Flow 테스트") {
        val flow = eventService.stream()

        flow.test {
            awaitItem() shouldBe Event.Started
            awaitItem().shouldBeInstanceOf<Event.DataReceived>()
            awaitComplete()
        }
    }

    test("Flow 전체 수집") {
        val items = priceFlow.toList()
        items shouldHaveSize 5
        items.first() shouldBe Price(1000)
    }
})
```

### turbine — Flow 테스트 전용

```kotlin
// build.gradle.kts
testImplementation("app.cash.turbine:turbine:1.1.0")

test("이벤트 순서 검증") {
    orderService.orderEvents(orderId).test {
        val created = awaitItem()
        created.shouldBeInstanceOf<OrderEvent.Created>()

        val paid = awaitItem()
        paid.shouldBeInstanceOf<OrderEvent.Paid>()

        awaitComplete()
    }
}
```

---

## Chapter 7. Spring Boot 통합

```kotlin
// build.gradle.kts
testImplementation("io.kotest.extensions:kotest-extensions-spring:1.1.3")
```

### @SpringBootTest + Kotest

```kotlin
@SpringBootTest
class UserServiceIntegrationTest(
    private val userService: UserService,
    private val userRepository: UserRepository,
) : FunSpec() {

    override fun extensions() = listOf(SpringExtension)

    init {
        beforeEach {
            userRepository.deleteAll()
        }

        test("사용자 생성 통합 테스트") {
            val request = CreateUserRequest("kim@example.com", "김철수")
            val user = userService.create(request)

            user.id.shouldNotBeNull()
            user.email shouldBe "kim@example.com"
        }
    }
}
```

### Testcontainers + Kotest

```kotlin
@SpringBootTest
@Testcontainers
class RepositoryTest : FunSpec() {

    override fun extensions() = listOf(SpringExtension)

    companion object {
        @Container
        val postgres = PostgreSQLContainer<Nothing>("postgres:16").apply {
            withDatabaseName("testdb")
            withUsername("test")
            withPassword("test")
        }

        @DynamicPropertySource
        @JvmStatic
        fun configureProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
        }
    }

    init {
        test("실제 DB로 조회") {
            // ...
        }
    }
}
```

### MockK + Kotest 조합

```kotlin
class OrderServiceTest : FunSpec({

    val orderRepository = mockk<OrderRepository>()
    val paymentClient = mockk<PaymentClient>()
    val service = OrderService(orderRepository, paymentClient)

    beforeEach {
        clearAllMocks()
    }

    test("결제 성공 시 주문이 확정된다") {
        val order = Order(id = 1L, status = PENDING)
        every { orderRepository.findById(1L) } returns order
        coEvery { paymentClient.pay(any()) } returns PaymentResult.SUCCESS

        service.confirm(1L)

        verify { orderRepository.save(match { it.status == CONFIRMED }) }
    }
})
```

---

## Chapter 8. 고급 패턴

### Custom Matcher

```kotlin
fun beValidEmail(): Matcher<String> = object : Matcher<String> {
    override fun test(value: String): MatcherResult {
        val valid = value.matches(Regex("[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+"))
        return MatcherResult(
            valid,
            { "$value 은 유효한 이메일이 아닙니다" },
            { "$value 은 유효한 이메일입니다" }
        )
    }
}

// 사용
"user@example.com" should beValidEmail()
"invalid" shouldNot beValidEmail()

// 확장 함수로 등록
fun String.shouldBeValidEmail() = this should beValidEmail()
```

### Tag / Filter

```kotlin
object SlowTest : Tag()
object IntegrationTest : Tag()

class HeavyTest : FunSpec({
    test("느린 통합 테스트").config(tags = setOf(SlowTest, IntegrationTest)) {
        // ...
    }
})
```

```bash
# 특정 태그 실행
./gradlew test -Dkotest.tags="SlowTest & IntegrationTest"

# 특정 태그 제외
./gradlew test -Dkotest.tags="!SlowTest"
```

### 테스트 순서 제어

```kotlin
class OrderedTest : FunSpec({
    // 기본: 선언 순서
    // TestCaseOrder.Sequential, Random, Lexicographic

    test("1단계").config(order = 1) { }
    test("2단계").config(order = 2) { }
    test("3단계").config(order = 3) { }
})
```

---

## 의존성 설정 (build.gradle.kts)

```kotlin
val kotestVersion = "5.9.1"
val kotestExtSpringVersion = "1.1.3"

dependencies {
    testImplementation("io.kotest:kotest-runner-junit5:$kotestVersion")
    testImplementation("io.kotest:kotest-assertions-core:$kotestVersion")
    testImplementation("io.kotest:kotest-property:$kotestVersion")
    testImplementation("io.kotest.extensions:kotest-extensions-spring:$kotestExtSpringVersion")
    testImplementation("app.cash.turbine:turbine:1.1.0")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
```

---

## 참고 자료

- [Kotest 공식 문서](https://kotest.io)
- [Kotest GitHub](https://github.com/kotest/kotest)
- [kotest-extensions-spring](https://github.com/kotest/kotest-extensions-spring)
- [Turbine (Flow Testing)](https://github.com/cashapp/turbine)
