# MockK 완전 정복 — Kotlin Mocking 프레임워크 학습 로드맵

> Kotlin을 위해 설계된 Mocking 라이브러리.
> Mockito의 Java 한계를 넘어 `data class`, `companion object`, `coroutine`, `extension function`까지 Mock 가능.

---

## 왜 MockK인가?

| 항목 | Mockito | MockK |
|------|---------|-------|
| 언어 | Java-first | Kotlin-first |
| `final class` mock | 별도 설정 필요 | 기본 지원 |
| `object` / `companion` mock | 불가 | `mockkObject` |
| Coroutine | 별도 라이브러리 | `coEvery` / `coVerify` |
| Extension function | 불가 | `mockkStatic` |
| DSL | verbose | 간결한 infix DSL |

---

## 학습 로드맵

| 단계 | 주제 | 목표 |
|------|------|------|
| 1 | 기본 Mock / Stub | mockk(), every, returns |
| 2 | Argument Matcher | any(), eq(), capture(), slot |
| 3 | Verification | verify, verifyOrder, verifySequence |
| 4 | Spy | spyk(), partial mock |
| 5 | Object / Static Mock | mockkObject, mockkStatic |
| 6 | Relaxed / Strict Mock | relaxed mock, 기본값 전략 |
| 7 | Coroutine 지원 | coEvery, coVerify, suspend 함수 |
| 8 | Spring Boot 통합 | @MockkBean, SpringMockK |

---

## Chapter 1. 기본 Mock & Stub

### mockk() — 인터페이스 / 클래스 Mock

```kotlin
// 인터페이스
val userRepository = mockk<UserRepository>()

// final class (Kotlin 기본값)
val emailService = mockk<EmailService>()

// 초기화 시 stubbing
val config = mockk<AppConfig> {
    every { timeout } returns 30
    every { retryCount } returns 3
}
```

### every { } — Stubbing

```kotlin
// 단순 반환
every { userRepository.findById(1L) } returns User(id = 1L, name = "김철수")

// null 반환
every { userRepository.findById(999L) } returns null

// 예외 던지기
every { userRepository.findById(-1L) } throws IllegalArgumentException("잘못된 ID")

// 순서대로 다른 값 반환
every { counter.next() } returnsMany listOf(1, 2, 3)

// 첫 번째 호출만 예외, 이후 정상
every { service.call() } throws RuntimeException() andThen "ok"

// 람다로 동적 응답
every { service.process(any()) } answers { firstArg<Int>() * 2 }
```

### answers — 동적 응답 (AnswerScope)

```kotlin
every { repository.save(any()) } answers {
    val user = firstArg<User>()
    user.copy(id = 100L)  // 저장된 엔티티에 ID 부여
}

every { service.execute(any(), any()) } answers {
    val (a, b) = args
    (a as Int) + (b as Int)
}
```

---

## Chapter 2. Argument Matcher

### 기본 Matcher

```kotlin
every { repo.findById(any()) } returns mockUser        // 모든 값
every { repo.findById(eq(1L)) } returns specificUser   // 정확히 1L
every { repo.findByName(any<String>()) } returns list  // 타입 한정
every { repo.findAll() } returns emptyList()           // 인수 없음
```

### 조건 Matcher

```kotlin
every { repo.findByAge(more(18)) } returns adults      // 18 초과
every { repo.findByAge(less(18)) } returns minors      // 18 미만
every { repo.findByAge(range(18, 65)) } returns workers

every { service.process(match { it.isNotBlank() }) } returns "ok"

every { validator.check(ofType<EmailRequest>()) } returns true
```

### Slot — 인수 캡처

```kotlin
val userSlot = slot<User>()

every { repository.save(capture(userSlot)) } answers { userSlot.captured }

service.createUser("kim@example.com")

// 저장된 User 검증
userSlot.captured.email shouldBe "kim@example.com"
userSlot.captured.createdAt.shouldNotBeNull()
```

### MutableList로 여러 번 캡처

```kotlin
val requests = mutableListOf<OrderRequest>()

every { orderClient.send(capture(requests)) } returns Unit

service.bulkOrder(listOf(req1, req2, req3))

requests shouldHaveSize 3
requests[0].productId shouldBe 1L
```

---

## Chapter 3. Verification

### verify { } — 호출 검증

```kotlin
// 최소 1번 호출됐는지
verify { repository.save(any()) }

// 정확히 N번
verify(exactly = 2) { emailService.send(any()) }

// 한 번도 호출되지 않음
verify(exactly = 0) { auditService.log(any()) }

// atLeast / atMost
verify(atLeast = 1, atMost = 3) { cacheService.put(any(), any()) }
```

### verifyOrder — 순서 검증 (비연속 허용)

```kotlin
verifyOrder {
    repository.findById(any())
    validator.validate(any())
    repository.save(any())
    eventPublisher.publish(any())
}
```

### verifySequence — 정확한 호출 순서 & 횟수

```kotlin
verifySequence {
    repository.findById(orderId)
    paymentClient.charge(any())
    repository.save(any())
    // 이 외의 호출이 있으면 실패
}
```

### confirmVerified — 검증되지 않은 호출 확인

```kotlin
verify { service.process(any()) }

confirmVerified(service)  // 검증하지 않은 메서드 호출이 있으면 실패
```

### wasNot Called

```kotlin
verify { notificationService wasNot Called }
verify { auditRepository wasNot Called }
```

---

## Chapter 4. Spy (부분 Mock)

```kotlin
// 실제 구현 + 일부만 Mock
val userService = spyk(UserService(repository))

// 특정 메서드만 Override
every { userService.sendEmail(any()) } returns Unit  // 이메일 전송만 Mock

// 나머지는 실제 로직 실행
val result = userService.createUser(request)  // 실제 로직

verify { userService.sendEmail(any()) }
```

### 실제 메서드 호출 (callOriginal)

```kotlin
every { spy.expensiveCalculation(any()) } answers { callOriginal() }
```

### spyk vs mockk

| | mockk | spyk |
|---|---|---|
| 기반 | 완전 Mock | 실제 인스턴스 기반 |
| stubbing 없는 메서드 | 예외 (relaxed=false) | 실제 구현 실행 |
| 사용 목적 | 협력 객체 교체 | 일부만 mock하고 싶을 때 |

---

## Chapter 5. Object & Static Mock

### mockkObject — Kotlin object / companion object

```kotlin
object OrderCodeGenerator {
    fun generate(): String = UUID.randomUUID().toString()
}

mockkObject(OrderCodeGenerator)

every { OrderCodeGenerator.generate() } returns "ORDER-001"

val code = OrderCodeGenerator.generate()
code shouldBe "ORDER-001"

unmockkObject(OrderCodeGenerator)
```

### companion object Mock

```kotlin
class User private constructor(val id: Long, val name: String) {
    companion object {
        fun create(name: String): User = User(System.nanoTime(), name)
    }
}

mockkObject(User.Companion)
every { User.create(any()) } returns User(999L, "Mock User")

unmockkObject(User.Companion)
```

### mockkStatic — Top-level / Java static 함수

```kotlin
// Kotlin top-level 함수
mockkStatic("com.example.util.DateUtilKt")
every { currentTimestamp() } returns 1712345678000L

// Java static 메서드
mockkStatic(LocalDate::class)
every { LocalDate.now() } returns LocalDate.of(2024, 1, 15)

unmockkStatic(LocalDate::class)
```

### mockkConstructor — 생성자 Mock

```kotlin
mockkConstructor(HttpClient::class)
every { anyConstructed<HttpClient>().get(any()) } returns mockResponse

val service = ExternalService()  // 내부에서 HttpClient() 생성
service.fetchData()  // Mock HttpClient 사용

unmockkConstructor(HttpClient::class)
```

---

## Chapter 6. Relaxed & Strict Mock

### Relaxed Mock — 기본값 자동 반환

```kotlin
// relaxed = true: stubbing 없는 메서드는 기본값 반환
val service = mockk<UserService>(relaxed = true)

// stubbing 없어도 예외 발생 안 함
service.doSomething()       // Unit 반환
service.getName()           // "" 반환
service.getCount()          // 0 반환
service.getUser()           // null 반환 (nullable) / 빈 mock (non-null)
```

### relaxedUnitFun — Unit 반환 메서드만 relaxed

```kotlin
val repository = mockk<UserRepository>(relaxedUnitFun = true)

// Unit 메서드는 stubbing 없이 호출 가능
repository.deleteAll()  // OK

// 반환값 있는 메서드는 여전히 stubbing 필요
every { repository.findById(any()) } returns user
```

### 전략 선택

| 상황 | 추천 설정 |
|------|-----------|
| 협력 객체 행동 검증이 주 목적 | `relaxed = true` |
| 반환값이 중요한 쿼리 테스트 | 기본 (strict) |
| void 메서드만 relaxed | `relaxedUnitFun = true` |
| 테스트 커버리지 엄격하게 | strict + `confirmVerified` |

---

## Chapter 7. Coroutine 지원

### coEvery — suspend 함수 Stubbing

```kotlin
class UserServiceTest : FunSpec({
    val repository = mockk<UserRepository>()
    val service = UserService(repository)

    test("suspend 함수 Mock") {
        coEvery { repository.findById(1L) } returns User(1L, "김철수")

        val user = service.getUser(1L)

        user.name shouldBe "김철수"
    }

    test("suspend 함수 예외") {
        coEvery { repository.findById(999L) } throws NotFoundException("User not found")

        shouldThrow<NotFoundException> {
            service.getUser(999L)
        }
    }
})
```

### coVerify — suspend 함수 호출 검증

```kotlin
coVerify { repository.findById(1L) }
coVerify(exactly = 1) { emailService.sendAsync(any()) }
coVerify(exactly = 0) { auditService.logAsync(any()) }

coVerifyOrder {
    repository.findById(any())
    paymentService.chargeAsync(any())
    repository.save(any())
}
```

### Flow Stubbing

```kotlin
val stream = flow {
    emit(Event.Started)
    emit(Event.Processing)
    emit(Event.Completed)
}

every { eventService.stream(any()) } returns stream

// turbine으로 검증
eventService.stream(orderId).test {
    awaitItem() shouldBe Event.Started
    awaitItem() shouldBe Event.Processing
    awaitItem() shouldBe Event.Completed
    awaitComplete()
}
```

---

## Chapter 8. Spring Boot 통합

### 의존성 설정

```kotlin
// build.gradle.kts
testImplementation("io.mockk:mockk:1.13.12")
testImplementation("com.ninja-squad:springmockk:4.0.2")
```

### @MockkBean / @SpykBean

```kotlin
@WebMvcTest(UserController::class)
class UserControllerTest(
    @Autowired val mockMvc: MockMvc,
    @MockkBean val userService: UserService,
) {
    @Test
    fun `사용자 조회 API`() {
        every { userService.getUser(1L) } returns UserResponse(1L, "김철수")

        mockMvc.get("/api/users/1")
            .andExpect {
                status { isOk() }
                jsonPath("$.name") { value("김철수") }
            }

        verify { userService.getUser(1L) }
    }
}
```

### Kotest + SpringMockK

```kotlin
@SpringBootTest
class OrderServiceIntegrationTest : FunSpec() {

    override fun extensions() = listOf(SpringExtension)

    @MockkBean
    lateinit var paymentClient: PaymentClient

    @Autowired
    lateinit var orderService: OrderService

    init {
        beforeEach {
            clearAllMocks()
        }

        test("결제 클라이언트 Mock으로 통합 테스트") {
            coEvery { paymentClient.pay(any()) } returns PaymentResult(
                transactionId = "TX-001",
                status = SUCCESS
            )

            val order = orderService.placeOrder(createOrderRequest())

            order.status shouldBe CONFIRMED
            coVerify { paymentClient.pay(match { it.amount > 0 }) }
        }
    }
}
```

---

## 유틸리티 함수

### clearMocks / unmockk

```kotlin
// Stubbing, 호출 기록 초기화 (Mock 객체 재사용)
clearMocks(repository, service)

// Stubbing만 초기화
clearMocks(repository, answers = false)

// 호출 기록만 초기화
clearMocks(repository, recordedCalls = false)

// 모든 Mock 초기화
clearAllMocks()

// object / static Mock 해제
unmockkObject(OrderCodeGenerator)
unmockkStatic(LocalDate::class)
unmockkAll()  // 모든 특수 Mock 해제
```

### every 블록 재사용

```kotlin
// 공통 Stub을 함수로 추출
fun mockUserFound(repository: UserRepository, user: User) {
    every { repository.findById(user.id) } returns user
    every { repository.existsById(user.id) } returns true
}

// 테스트에서 사용
val user = User(1L, "테스트")
mockUserFound(repository, user)
```

---

## 의존성 설정 (build.gradle.kts)

```kotlin
dependencies {
    testImplementation("io.mockk:mockk:1.13.12")

    // Spring Boot 통합
    testImplementation("com.ninja-squad:springmockk:4.0.2")
}
```

---

## MockK vs Mockito 마이그레이션

| Mockito | MockK |
|---------|-------|
| `mock(Foo.class)` | `mockk<Foo>()` |
| `when(x.foo()).thenReturn(y)` | `every { x.foo() } returns y` |
| `doThrow(e).when(x).foo()` | `every { x.foo() } throws e` |
| `verify(x).foo()` | `verify { x.foo() }` |
| `verifyNoInteractions(x)` | `verify { x wasNot Called }` |
| `@Mock` | `mockk()` (프로퍼티) 또는 `@MockkBean` |
| `@InjectMocks` | 생성자 주입 직접 |
| `ArgumentCaptor` | `slot<T>()` + `capture()` |
| `spy(realObj)` | `spyk(realObj)` |
| `mockStatic(Foo.class)` | `mockkStatic(Foo::class)` |

---

## 참고 자료

- [MockK 공식 문서](https://mockk.io)
- [MockK GitHub](https://github.com/mockk/mockk)
- [SpringMockK GitHub](https://github.com/Ninja-Squad/springmockk)
- [MockK Reference Card](https://mockk.io/#quick-start)
