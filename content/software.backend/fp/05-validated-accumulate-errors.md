---
title: "[Kotlin FP] 5. Validated — 여러 에러 동시 수집"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "arrow-kt", "Validated", "검증", "FP"]
---

# Validated — 여러 에러 동시 수집

`Either`는 **fail-fast** 방식이다. 첫 번째 에러를 만나면 즉시 중단하고 그 에러를 반환한다. 폼 검증처럼 여러 필드를 동시에 검사해서 **모든 에러를 한꺼번에** 보여줘야 할 때는 적합하지 않다.

```kotlin
// Either — 이름 에러 발견 즉시 중단 → 이메일 에러는 모름
either {
    ensure(name.isNotBlank()) { "이름 필수" }   // 실패 → 여기서 중단
    ensure(email.contains("@")) { "이메일 형식 오류" }  // 실행 안 됨
}
```

Arrow-kt의 `Validated` (또는 `accumulate` DSL)를 쓰면 모든 검사를 실행하고 에러를 모아서 반환한다.

---

## NonEmptyList — 에러 목록 타입

에러가 1개 이상 있음을 타입으로 보장한다.

```kotlin
import arrow.core.NonEmptyList
import arrow.core.nonEmptyListOf

val errors: NonEmptyList<String> = nonEmptyListOf("이름 필수", "이메일 형식 오류")
```

---

## validatedNel — 기본 사용법

`Either<E, A>` 대신 `ValidatedNel<E, A>` = `Validated<NonEmptyList<E>, A>` 를 사용한다.

```kotlin
import arrow.core.ValidatedNel
import arrow.core.invalidNel
import arrow.core.validNel
import arrow.core.zip

fun validateName(name: String): ValidatedNel<String, String> =
    if (name.isNotBlank()) name.validNel()
    else "이름은 필수입니다".invalidNel()

fun validateEmail(email: String): ValidatedNel<String, String> =
    if (email.contains("@") && email.contains(".")) email.validNel()
    else "유효하지 않은 이메일 형식입니다".invalidNel()

fun validateAge(age: Int): ValidatedNel<String, Int> =
    if (age in 1..150) age.validNel()
    else "나이는 1~150 사이여야 합니다".invalidNel()

// 세 가지 검증을 동시에 실행 — zip으로 결합
fun validateCreateUserCommand(command: CreateUserCommand): ValidatedNel<String, ValidUser> =
    validateName(command.name).zip(
        validateEmail(command.email),
        validateAge(command.age)
    ) { name, email, age ->
        ValidUser(name, email, age)  // 모두 성공하면 결합
    }
```

```kotlin
// 결과 처리
when (val result = validateCreateUserCommand(command)) {
    is Valid   -> createUser(result.value)
    is Invalid -> ResponseEntity.badRequest().body(result.error.toList())
}
```

---

## accumulate DSL (Arrow 1.2+)

`zip`보다 더 읽기 쉬운 방식이다.

```kotlin
import arrow.core.raise.either
import arrow.core.raise.zipOrAccumulate

fun validateCreateUserCommand(command: CreateUserCommand): Either<NonEmptyList<String>, ValidUser> =
    either {
        zipOrAccumulate(
            { ensure(command.name.isNotBlank()) { "이름은 필수입니다" } },
            { ensure(command.email.contains("@")) { "유효하지 않은 이메일" } },
            { ensure(command.age in 1..150) { "나이는 1~150 사이여야 합니다" } },
            { ensure(command.password.length >= 8) { "비밀번호는 최소 8자 이상이어야 합니다" } },
        ) { _, _, _, _ -> ValidUser(command.name, command.email, command.age) }
    }
```

`zipOrAccumulate`는 인자로 받은 모든 검증을 실행하고, 에러가 있으면 **모두 수집**해서 반환한다.

---

## 실전: DTO 검증 파이프라인

```kotlin
data class CreateOrderCommand(
    val userId: Long,
    val items: List<OrderItemCommand>,
    val shippingAddress: AddressCommand,
    val couponCode: String?,
)

sealed class ValidationError {
    data class FieldError(val field: String, val message: String) : ValidationError()
    data class BusinessError(val message: String) : ValidationError()
}

fun validateCreateOrderCommand(
    command: CreateOrderCommand
): Either<NonEmptyList<ValidationError>, ValidatedOrderCommand> = either {
    zipOrAccumulate(
        {
            ensure(command.userId > 0) {
                ValidationError.FieldError("userId", "유효하지 않은 사용자 ID")
            }
        },
        {
            ensure(command.items.isNotEmpty()) {
                ValidationError.FieldError("items", "주문 항목은 최소 1개 이상이어야 합니다")
            }
            command.items.forEachIndexed { index, item ->
                ensure(item.quantity > 0) {
                    ValidationError.FieldError("items[$index].quantity", "수량은 1 이상이어야 합니다")
                }
                ensure(item.quantity <= 100) {
                    ValidationError.FieldError("items[$index].quantity", "수량은 최대 100개입니다")
                }
            }
        },
        {
            ensure(command.shippingAddress.zipCode.matches(Regex("\\d{5}"))) {
                ValidationError.FieldError("shippingAddress.zipCode", "우편번호는 5자리 숫자입니다")
            }
            ensure(command.shippingAddress.street.isNotBlank()) {
                ValidationError.FieldError("shippingAddress.street", "도로명 주소는 필수입니다")
            }
        },
    ) { _, _, _ ->
        ValidatedOrderCommand(command)
    }
}
```

---

## Bean Validation과 비교

Spring의 `@Valid` + `@NotBlank` 방식과 비교해보자.

```kotlin
// Bean Validation 방식
data class CreateUserRequest(
    @field:NotBlank(message = "이름은 필수입니다")
    val name: String,

    @field:Email(message = "유효하지 않은 이메일")
    val email: String,

    @field:Min(1) @field:Max(150)
    val age: Int,
)

// Controller
@PostMapping("/users")
fun create(@RequestBody @Valid request: CreateUserRequest): ResponseEntity<*> { ... }
// → MethodArgumentNotValidException → @ExceptionHandler에서 처리
```

| | Bean Validation (`@Valid`) | Arrow `Validated` |
|---|---|---|
| 설정 방식 | 어노테이션 | 코드 |
| 에러 수집 | 기본적으로 모두 수집 | 모두 수집 (zipOrAccumulate) |
| 비즈니스 로직 검증 | 어렵다 (커스텀 Validator 필요) | 자유롭게 가능 |
| 타입 안전 | 부분적 (RuntimeException 기반) | 완전히 타입 안전 |
| 재사용성 | 어노테이션 재사용 | 함수 재사용 |

**단순한 형식 검증** (빈 값, 이메일 형식, 숫자 범위)은 Bean Validation이 더 간결하다. **비즈니스 규칙과 얽힌 검증** (다른 필드와의 관계, DB 조회 필요)은 Arrow가 더 적합하다.

---

## 두 방식을 조합

실제 프로젝트에서 두 방식을 레이어별로 나눠 쓰는 것이 현실적이다.

```kotlin
// Controller — Bean Validation으로 형식 검증
@PostMapping("/orders")
fun createOrder(@RequestBody @Valid request: CreateOrderRequest): ResponseEntity<*> {
    val command = request.toCommand()
    return orderService.createOrder(command).fold(
        ifLeft = { errors -> ResponseEntity.badRequest().body(errors.toList()) },
        ifRight = { order -> ResponseEntity.status(201).body(order) }
    )
}

// Service — Arrow로 비즈니스 검증
fun createOrder(command: CreateOrderCommand): Either<NonEmptyList<ValidationError>, Order> = either {
    // 비즈니스 규칙 검증
    val validated = zipOrAccumulate(
        { ensureUserExists(command.userId) },
        { ensureStockAvailable(command.items) },
    ) { user, _ -> user }

    val user = validated.bind()
    // 이후 로직...
}
```

---

## 정리

- `Either` — fail-fast. 첫 에러에서 중단. 순차 처리.
- `Validated` / `zipOrAccumulate` — 에러 수집. 모든 검증 실행.
- 폼/DTO 검증처럼 여러 에러를 한 번에 보여줘야 할 때 `zipOrAccumulate`.
- Bean Validation과 역할을 나눠서 쓰는 것이 현실적.
