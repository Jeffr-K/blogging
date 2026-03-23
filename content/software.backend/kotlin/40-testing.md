---
title: "[Kotlin 시리즈] 40. 테스트 — kotlin.test, JUnit5, Kotest, MockK"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "test", "junit5", "kotest", "mockk", "coroutines test", "turbine"]
---

# 테스트 — kotlin.test, JUnit5, Kotest, MockK

## kotlin.test — 멀티플랫폼 테스트

```kotlin
import kotlin.test.*

class CalculatorTest {
    @Test
    fun `덧셈 테스트`() {
        val result = 2 + 3
        assertEquals(5, result)
        assertNotEquals(6, result)
    }

    @Test
    fun `null 체크`() {
        val value: String? = "kotlin"
        assertNotNull(value)
        assertNull(null)
    }

    @Test
    fun `타입 체크`() {
        val obj: Any = "hello"
        assertIs<String>(obj)
        assertIsNot<Int>(obj)
    }

    @Test
    fun `예외 테스트`() {
        assertFailsWith<IllegalArgumentException> {
            require(false) { "실패" }
        }
    }
}
```

---

## JUnit5 + Kotlin

```kotlin
// build.gradle.kts
dependencies {
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
    testImplementation("io.kotest:kotest-runner-junit5:5.8.0")
}

tasks.test { useJUnitPlatform() }
```

### 기본 사용

```kotlin
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*

class UserServiceTest {
    private lateinit var service: UserService

    @BeforeEach
    fun setup() {
        service = UserService(InMemoryUserRepository())
    }

    @AfterEach
    fun tearDown() {
        // 정리
    }

    @Test
    fun `사용자 생성 성공`() {
        val user = service.create("홍길동", "hong@example.com")
        assertNotNull(user.id)
        assertEquals("홍길동", user.name)
    }

    @Test
    @DisplayName("이름이 비어있으면 예외 발생")
    fun createUserWithBlankNameThrows() {
        assertThrows<IllegalArgumentException> {
            service.create("", "email@example.com")
        }
    }
}
```

### 파라미터화 테스트

```kotlin
@ParameterizedTest
@MethodSource("validEmails")
fun `유효한 이메일 통과`(email: String) {
    assertTrue(isValidEmail(email))
}

@ParameterizedTest
@CsvSource(
    "hong@example.com, true",
    "invalid-email, false",
    "'', false",
)
fun `이메일 유효성`(email: String, expected: Boolean) {
    assertEquals(expected, isValidEmail(email))
}

@ParameterizedTest
@ValueSource(ints = [1, 2, 3, 4, 5])
fun `양수 검사`(value: Int) {
    assertTrue(value > 0)
}

companion object {
    @JvmStatic
    fun validEmails() = listOf(
        "user@example.com",
        "name+tag@domain.co.kr",
        "test.email@sub.domain.com",
    )
}
```

### @Nested — 계층적 구조

```kotlin
@Nested
inner class `생성 시` {
    @Test fun `정상 생성`() { ... }
    @Test fun `중복 이름 거부`() { ... }

    @Nested
    inner class `유효성 검사` {
        @Test fun `빈 이름 거부`() { ... }
        @Test fun `너무 긴 이름 거부`() { ... }
    }
}
```

---

## Kotest

다양한 테스트 스타일을 지원합니다.

```kotlin
// FunSpec — 함수 스타일
class CalculatorSpec : FunSpec({
    test("덧셈") {
        (2 + 3) shouldBe 5
    }

    context("나눗셈") {
        test("정상 나눗셈") {
            (10 / 2) shouldBe 5
        }
        test("0으로 나누기") {
            shouldThrow<ArithmeticException> { 1 / 0 }
        }
    }
})

// BehaviorSpec — BDD 스타일
class UserSpec : BehaviorSpec({
    given("유효한 사용자 데이터") {
        val data = UserData("홍길동", "hong@example.com")

        `when`("사용자를 생성하면") {
            val user = UserService().create(data)

            then("ID가 할당된다") {
                user.id shouldNotBe null
            }
            then("이름이 저장된다") {
                user.name shouldBe "홍길동"
            }
        }
    }
})

// DescribeSpec
class OrderSpec : DescribeSpec({
    describe("Order") {
        it("should have correct total") {
            val order = Order(listOf(Item("A", 1000), Item("B", 2000)))
            order.total shouldBe 3000
        }
    }
})
```

### Kotest Matchers

```kotlin
// 기본
5 shouldBe 5
"hello" shouldNotBe "world"
null.shouldBeNull()
"kotlin".shouldNotBeNull()

// 타입
obj.shouldBeInstanceOf<String>()
"hello".shouldBeTypeOf<String>()

// 컬렉션
listOf(1, 2, 3).shouldHaveSize(3)
listOf(1, 2, 3).shouldContain(2)
listOf(1, 2, 3).shouldContainAll(1, 3)
emptyList<Int>().shouldBeEmpty()

// 숫자
5.0 shouldBeExactly 5.0
5.0 shouldBeWithinPercentageOf(5.1, 2.0)  // 2% 오차 허용

// 문자열
"hello world".shouldContain("world")
"hello".shouldStartWith("hel")
"hello".shouldMatch(Regex("h.*o"))

// 예외
shouldThrow<IllegalArgumentException> { throw IllegalArgumentException() }
shouldThrowMessage("오류") { error("오류") }
```

### Property-based Testing

```kotlin
class StringSpec : StringSpec({
    "문자열 반전 두 번은 원본" {
        forAll<String> { str ->
            str.reversed().reversed() == str
        }
    }

    "리스트 정렬 후 크기 동일" {
        forAll<List<Int>> { list ->
            list.sorted().size == list.size
        }
    }
})
```

---

## MockK

Kotlin 전용 Mock 라이브러리입니다.

```kotlin
// build.gradle.kts
testImplementation("io.mockk:mockk:1.13.8")
```

### 기본 Mock

```kotlin
interface UserRepository {
    fun findById(id: Long): User?
    fun save(user: User): User
    suspend fun findAll(): List<User>
}

class UserServiceTest {
    private val repository = mockk<UserRepository>()
    private val service = UserService(repository)

    @Test
    fun `사용자 조회`() {
        // stub 설정
        every { repository.findById(1L) } returns User(1L, "홍길동")
        every { repository.findById(99L) } returns null

        // 실행
        val user = service.getUser(1L)

        // 검증
        assertEquals("홍길동", user.name)
        verify { repository.findById(1L) }
    }
}
```

### 다양한 stub

```kotlin
// 예외 던지기
every { repository.findById(any()) } throws NotFoundException()

// 순서대로 다른 값
every { repository.findById(1L) } returnsMany listOf(
    User(1L, "첫 번째 호출"),
    User(1L, "두 번째 호출"),
)

// 람다로 동적 반환
every { repository.findById(any()) } answers { call ->
    val id = call.invocation.args[0] as Long
    if (id > 0) User(id, "User-$id") else null
}

// 아무것도 하지 않음 (Unit 반환)
every { repository.delete(any()) } just Runs
```

### Coroutine 지원

```kotlin
@Test
fun `비동기 조회`() = runTest {
    coEvery { repository.findAll() } returns listOf(User(1L, "홍길동"))

    val users = service.getAllUsers()

    assertEquals(1, users.size)
    coVerify { repository.findAll() }
}
```

### verify

```kotlin
// 호출 여부 확인
verify { repository.findById(1L) }
verify(exactly = 2) { repository.findById(any()) }
verify(atLeast = 1) { repository.findById(any()) }
verify(atMost = 3) { repository.findById(any()) }

// 순서 확인
verifyOrder {
    repository.findById(1L)
    repository.save(any())
}

// 전혀 호출 안 됨
verify(exactly = 0) { repository.delete(any()) }
confirmVerified(repository)  // 검증 안 된 호출 없음 확인
```

### spyk — 부분 Mock

```kotlin
val real = UserService(repository)
val spy = spyk(real)

every { spy.validateUser(any()) } returns true  // 특정 메서드만 stub
// 나머지는 실제 구현 사용

spy.createUser("홍길동")  // validateUser는 stub, 나머지는 real
```

### slot — 인자 캡처

```kotlin
val slot = slot<User>()
every { repository.save(capture(slot)) } answers { slot.captured }

service.createUser("홍길동")

assertEquals("홍길동", slot.captured.name)
```

---

## 코루틴 테스트 (kotlinx-coroutines-test)

```kotlin
// build.gradle.kts
testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
```

### runTest

```kotlin
@Test
fun `코루틴 테스트`() = runTest {
    val result = async { delay(1000); 42 }.await()
    assertEquals(42, result)
    // delay는 가상 시간으로 처리 — 실제로 1초 기다리지 않음
}
```

### 가상 시간 제어

```kotlin
@Test
fun `타임아웃 테스트`() = runTest {
    val job = launch {
        delay(10_000)
        println("완료")
    }

    advanceTimeBy(5_000)    // 5초 전진
    assertTrue(job.isActive)

    advanceUntilIdle()      // 모든 코루틴 완료까지 전진
    assertTrue(job.isCompleted)
}
```

### TestScope / TestDispatcher

```kotlin
@Test
fun `디스패처 테스트`() {
    val testDispatcher = StandardTestDispatcher()
    val scope = TestScope(testDispatcher)

    scope.launch {
        delay(1000)
        println("완료")
    }

    scope.advanceUntilIdle()  // 명시적으로 실행 진행
}
```

---

## Flow 테스트 — Turbine

```kotlin
// build.gradle.kts
testImplementation("app.cash.turbine:turbine:1.0.0")

@Test
fun `Flow 테스트`() = runTest {
    val flow = flowOf(1, 2, 3)

    flow.test {
        assertEquals(1, awaitItem())
        assertEquals(2, awaitItem())
        assertEquals(3, awaitItem())
        awaitComplete()
    }
}

@Test
fun `StateFlow 테스트`() = runTest {
    val viewModel = CounterViewModel()

    viewModel.count.test {
        assertEquals(0, awaitItem())    // 초기값
        viewModel.increment()
        assertEquals(1, awaitItem())
        viewModel.increment()
        assertEquals(2, awaitItem())
    }
}
```

---

## 정리

| 라이브러리 | 역할 | 특징 |
|-----------|------|------|
| `kotlin.test` | 멀티플랫폼 기본 | assert, assertEquals |
| JUnit5 | JVM 테스트 표준 | @Nested, @ParameterizedTest |
| Kotest | Kotlin 전용 | 다양한 스타일, Matcher DSL |
| MockK | Kotlin Mock | coroutine 지원, spy, slot |
| `kotlinx-coroutines-test` | 코루틴 테스트 | 가상 시간, runTest |
| Turbine | Flow 테스트 | awaitItem, awaitComplete |
