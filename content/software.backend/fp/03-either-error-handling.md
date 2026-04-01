---
title: "[Kotlin FP] 3. Either로 에러 처리하기"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "arrow-kt", "Either", "에러처리", "FP"]
---

# Either로 에러 처리하기

Spring Boot 프로젝트에서 에러는 보통 예외(Exception)로 처리한다. `throw`로 던지고 `@ExceptionHandler`로 잡는 방식이다. 이 방식의 문제는 **함수 시그니처만 보고는 실패 가능성을 알 수 없다**는 점이다.

```kotlin
// 이 함수가 실패할 수 있다는 게 시그니처에 드러나지 않음
fun findUser(id: Long): User
```

`Either`를 쓰면 실패 가능성을 타입으로 명시한다.

```kotlin
// 실패하면 UserError, 성공하면 User
fun findUser(id: Long): Either<UserError, User>
```

---

## 도메인 에러 sealed class 설계

먼저 도메인에서 발생할 수 있는 에러를 sealed class로 정의한다.

```kotlin
sealed class UserError {
    data class NotFound(val id: Long) : UserError()
    data class EmailAlreadyExists(val email: String) : UserError()
    data class InvalidEmail(val email: String) : UserError()
    object Inactive : UserError()
}

sealed class OrderError {
    data class NotFound(val id: OrderId) : OrderError()
    data class UserNotFound(val userId: Long) : OrderError()
    data class InsufficientStock(
        val productId: ProductId,
        val requested: Int,
        val available: Int,
    ) : OrderError()
    object AlreadyCancelled : OrderError()
    object PaymentFailed : OrderError()
}
```

sealed class를 사용하면:
- 에러 종류가 컴파일 타임에 확정된다
- `when`에서 처리 누락 시 컴파일 에러
- 각 에러에 필요한 데이터를 data class로 담을 수 있다

---

## Repository 레이어

```kotlin
@Repository
class UserRepository(private val jpaRepository: UserJpaRepository) {

    fun findById(id: Long): Either<UserError, User> =
        jpaRepository.findById(id)
            .map { it.toDomain() }
            .map { it.right() }
            .orElse(UserError.NotFound(id).left())

    fun findByEmail(email: String): Either<UserError, User> =
        jpaRepository.findByEmail(email)
            ?.toDomain()
            ?.right()
            ?: UserError.NotFound(0L).left()

    fun existsByEmail(email: String): Boolean =
        jpaRepository.existsByEmail(email)

    fun save(user: User): Either<UserError, User> = Either.catch {
        jpaRepository.save(user.toEntity()).toDomain()
    }.mapLeft { e ->
        // DB 예외를 도메인 에러로 변환
        when {
            e.message?.contains("email") == true -> UserError.EmailAlreadyExists(user.email)
            else -> throw e  // 예상 외 예외는 다시 던짐
        }
    }
}
```

---

## Service 레이어

```kotlin
@Service
class UserService(
    private val userRepository: UserRepository,
    private val emailValidator: EmailValidator,
) {

    fun getUser(id: Long): Either<UserError, User> =
        userRepository.findById(id)
            .flatMap { user ->
                if (user.isActive) user.right()
                else UserError.Inactive.left()
            }

    fun createUser(command: CreateUserCommand): Either<UserError, User> = either {
        // 이메일 유효성 검사
        ensure(emailValidator.isValid(command.email)) {
            UserError.InvalidEmail(command.email)
        }

        // 중복 이메일 확인
        ensure(!userRepository.existsByEmail(command.email)) {
            UserError.EmailAlreadyExists(command.email)
        }

        val user = User.create(command)
        userRepository.save(user).bind()
    }

    fun deactivateUser(id: Long): Either<UserError, User> = either {
        val user = userRepository.findById(id).bind()
        ensure(user.isActive) { UserError.Inactive }
        val deactivated = user.copy(isActive = false)
        userRepository.save(deactivated).bind()
    }
}
```

`either { }` 블록 안에서는 `bind()`와 `ensure()`를 조합해 **예외 없이** 실패 흐름을 구성한다.

---

## Controller 레이어 — Either를 HTTP 응답으로 변환

```kotlin
@RestController
@RequestMapping("/api/users")
class UserController(private val userService: UserService) {

    @GetMapping("/{id}")
    fun getUser(@PathVariable id: Long): ResponseEntity<*> =
        userService.getUser(id).toResponse()

    @PostMapping
    fun createUser(@RequestBody @Valid command: CreateUserCommand): ResponseEntity<*> =
        userService.createUser(command).toResponse(201)
}

// 확장 함수로 변환 로직 재사용
fun <E : DomainError, T> Either<E, T>.toResponse(successStatus: Int = 200): ResponseEntity<*> =
    fold(
        ifLeft = { error -> error.toResponseEntity() },
        ifRight = { value -> ResponseEntity.status(successStatus).body(value) }
    )

fun DomainError.toResponseEntity(): ResponseEntity<ErrorResponse> = when (this) {
    is UserError.NotFound        -> ResponseEntity.notFound().build()
    is UserError.EmailAlreadyExists -> ResponseEntity.status(409)
        .body(ErrorResponse("이미 존재하는 이메일: $email"))
    is UserError.InvalidEmail    -> ResponseEntity.badRequest()
        .body(ErrorResponse("유효하지 않은 이메일: $email"))
    is UserError.Inactive        -> ResponseEntity.status(403)
        .body(ErrorResponse("비활성 사용자"))
    is OrderError.NotFound       -> ResponseEntity.notFound().build()
    is OrderError.InsufficientStock -> ResponseEntity.unprocessableEntity()
        .body(ErrorResponse("재고 부족 — 요청: $requested, 가용: $available"))
    // ...
}

data class ErrorResponse(val message: String, val timestamp: Instant = Instant.now())
```

---

## Either.catch — 예외를 Either로 감싸기

외부 라이브러리나 Java 코드처럼 예외를 던지는 코드를 `Either`로 감쌀 때 쓴다.

```kotlin
import arrow.core.Either

fun callExternalApi(request: PaymentRequest): Either<OrderError, PaymentResult> =
    Either.catch {
        paymentApiClient.charge(request)  // 예외를 던질 수 있는 외부 코드
    }.mapLeft { throwable ->
        when (throwable) {
            is HttpClientErrorException -> OrderError.PaymentFailed
            is ConnectException         -> OrderError.PaymentFailed
            else                        -> throw throwable  // 예상 외 예외는 전파
        }
    }
```

---

## @ExceptionHandler와 공존

`Either`로 처리되지 않은 예외 (인프라 수준 에러)는 기존 `@ExceptionHandler`가 잡는다.

```kotlin
@RestControllerAdvice
class GlobalExceptionHandler {

    // 예상 외 예외 — Either로 변환되지 않은 것
    @ExceptionHandler(Exception::class)
    fun handleUnexpected(e: Exception): ResponseEntity<ErrorResponse> {
        log.error("예상치 못한 에러", e)
        return ResponseEntity.internalServerError()
            .body(ErrorResponse("서버 오류"))
    }

    // Bean Validation 에러
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(e: MethodArgumentNotValidException): ResponseEntity<ErrorResponse> =
        ResponseEntity.badRequest().body(
            ErrorResponse(e.bindingResult.fieldErrors.joinToString { "${it.field}: ${it.defaultMessage}" })
        )
}
```

도메인 에러는 `Either`로, 인프라/프레임워크 에러는 `@ExceptionHandler`로 분리하면 각자의 역할이 명확해진다.

---

## 정리

```
예외 던지기 방식:
  서비스 → throw RuntimeException → @ExceptionHandler → 응답
  (실패 가능성이 시그니처에 없음, 흐름 추적 어려움)

Either 방식:
  서비스 → Either<Error, Value> → fold() → 응답
  (실패 가능성이 타입에 명시, 컴파일 타임 검증)
```

`Either`를 도입하면 코드가 조금 장황해질 수 있지만, **서비스 레이어의 실패 경로가 타입으로 문서화**된다는 이점이 크다. 특히 여러 개발자가 함께 작업하는 팀에서 실력 차와 무관하게 에러 처리 누락을 방지할 수 있다.
