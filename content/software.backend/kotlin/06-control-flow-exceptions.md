---
title: "[Kotlin 시리즈] 6. 제어 흐름 — 예외 처리"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "예외처리", "try-catch", "throw", "runCatching", "Result"]
---

# 제어 흐름 — 예외 처리

## throw

`throw`는 Kotlin에서 **표현식**입니다. 값이 필요한 자리에 바로 쓸 수 있습니다.

```kotlin
throw IllegalArgumentException("잘못된 인자입니다")

// 표현식으로 활용 — 엘비스 연산자와 조합
val name = input ?: throw IllegalArgumentException("이름은 필수입니다")

// 단일 표현식 함수에서
fun fail(msg: String): Nothing = throw RuntimeException(msg)
```

`throw`의 타입은 `Nothing`입니다. `Nothing`은 모든 타입의 서브타입이므로 어떤 타입이 기대되는 자리에도 쓸 수 있습니다.

---

## try-catch-finally

### 기본 구조

```kotlin
try {
    val result = riskyOperation()
    println(result)
} catch (e: NumberFormatException) {
    println("숫자 형식 오류: ${e.message}")
} catch (e: IllegalArgumentException) {
    println("잘못된 인자: ${e.message}")
} catch (e: Exception) {
    println("알 수 없는 오류: ${e.message}")
} finally {
    println("항상 실행됨 — 자원 해제 등")
}
```

`finally`는 예외 발생 여부와 관계없이 항상 실행됩니다. 자원 해제에 사용하지만, Kotlin에서는 `use` 확장 함수가 더 권장됩니다.

### 표현식으로 사용 — 값 반환

```kotlin
val parsed: Int = try {
    "42".toInt()
} catch (e: NumberFormatException) {
    -1   // 파싱 실패 시 기본값
}
// parsed = 42

val failed: Int = try {
    "abc".toInt()
} catch (e: NumberFormatException) {
    -1
}
// failed = -1
```

`try-catch` 블록의 마지막 줄이 값으로 반환됩니다.

---

## Checked Exception 없음

Java와 달리 Kotlin에는 **checked exception이 없습니다**. 모든 예외는 unchecked입니다.

```kotlin
// Java에서는 IOException을 선언해야 함
// public void readFile() throws IOException { ... }

// Kotlin — throws 선언 불필요
fun readFile(path: String): String {
    return File(path).readText()   // IOException 발생 가능하지만 선언 없음
}
```

Java에서 Kotlin 코드를 호출할 때 checked exception을 선언해야 한다면 `@Throws`를 씁니다.

```kotlin
@Throws(IOException::class)
fun readFile(path: String): String {
    return File(path).readText()
}
```

---

## 자원 관리 — `use`

`Closeable`/`AutoCloseable`을 구현한 자원은 `use`로 안전하게 닫습니다.

```kotlin
// try-finally 대신
val content = File("file.txt").bufferedReader().use { reader ->
    reader.readText()   // 블록 종료 시 reader.close() 자동 호출
}

// 예외가 발생해도 close 보장
```

---

## runCatching — 예외를 Result로

예외를 던지는 대신 `Result<T>`로 감싸서 반환합니다.

```kotlin
val result: Result<Int> = runCatching {
    "42".toInt()
}

val failed: Result<Int> = runCatching {
    "abc".toInt()   // NumberFormatException 발생
}
```

### Result 처리

```kotlin
val result = runCatching { fetchData() }

// 값 꺼내기
result.getOrNull()              // 성공 시 값, 실패 시 null
result.getOrDefault(emptyList()) // 실패 시 기본값
result.getOrElse { e -> emptyList() }  // 실패 시 람다 실행
result.getOrThrow()             // 실패 시 예외 다시 던짐

// 분기 처리
result.onSuccess { data ->
    println("성공: $data")
}.onFailure { error ->
    println("실패: ${error.message}")
}

// 상태 확인
result.isSuccess   // true / false
result.isFailure   // true / false
```

### Result 변환

```kotlin
val result = runCatching { "42".toInt() }

// map — 성공 값 변환 (실패면 그대로 전달)
val doubled: Result<Int> = result.map { it * 2 }

// mapCatching — 변환 중 예외 발생 시 Failure로 변환
val parsed: Result<Int> = runCatching { "abc" }
    .mapCatching { it.toInt() }  // 여기서 예외 발생 → Failure

// recover — 실패를 복구
val recovered: Result<Int> = failed.recover { e ->
    when (e) {
        is NumberFormatException -> 0
        else -> throw e  // 다른 예외는 다시 던짐
    }
}

// recoverCatching — 복구 중 예외 발생 허용
val recovered2 = failed.recoverCatching { retryFetch() }
```

### 체이닝

```kotlin
val finalResult = runCatching { parseInput(raw) }
    .mapCatching { validate(it) }
    .mapCatching { process(it) }
    .recover { e -> defaultValue }
    .getOrThrow()
```

---

## 커스텀 예외

```kotlin
// 기본 커스텀 예외
class UserNotFoundException(id: String) :
    RuntimeException("사용자를 찾을 수 없습니다: id=$id")

class ValidationException(
    val field: String,
    message: String,
) : IllegalArgumentException("[$field] $message")

// 봉인 클래스로 계층 구성
sealed class AppException(message: String) : Exception(message)

class NetworkException(message: String) : AppException(message)
class DatabaseException(message: String, cause: Throwable?) :
    AppException(message) {
    init { cause?.let { initCause(it) } }
}
class AuthException(val userId: String) :
    AppException("인증 실패: $userId")
```

봉인 클래스로 예외 계층을 만들면 `when`으로 완전성 검사가 됩니다.

```kotlin
fun handle(e: AppException) = when (e) {
    is NetworkException  -> retry()
    is DatabaseException -> fallback()
    is AuthException     -> redirectToLogin(e.userId)
    // else 불필요
}
```

---

## try-catch vs runCatching 선택

| | `try-catch` | `runCatching` |
|--|-------------|---------------|
| 스타일 | 명령형 | 함수형 |
| 에러 타입 지정 | 타입별로 `catch` 가능 | 단일 `Throwable` |
| 체이닝 | 불편 | `map`, `recover` 등 |
| 여러 예외 타입 구분 | 유리 | `recover`에서 `when`으로 처리 |

복잡한 비즈니스 로직에서 에러를 타입별로 세밀하게 구분해야 하면 `try-catch`, 파이프라인 스타일로 연산을 체이닝하면 `runCatching`이 어울립니다.

---

## 주요 표준 예외

```kotlin
throw IllegalArgumentException("잘못된 인자")   // 인자 검증 실패
throw IllegalStateException("잘못된 상태")       // 상태 검증 실패
throw UnsupportedOperationException("미구현")    // 지원하지 않는 연산
throw IndexOutOfBoundsException("인덱스 초과")   // 인덱스 범위 초과
throw NoSuchElementException("요소 없음")        // 요소 없음
throw ConcurrentModificationException()         // 동시 변경

// Kotlin 표준 함수
error("메시지")         // IllegalStateException 던짐, Nothing 반환
require(x > 0)         // x <= 0이면 IllegalArgumentException
requireNotNull(value)  // null이면 IllegalArgumentException
check(isInitialized)   // false면 IllegalStateException
checkNotNull(value)    // null이면 IllegalStateException
TODO("미구현")          // NotImplementedError 던짐
```

---

## 정리

- `throw`는 표현식 — 엘비스 연산자 등과 함께 사용 가능
- `try-catch-finally`도 표현식 — 값을 반환할 수 있음
- Checked exception 없음 — Java 호환 필요시 `@Throws`
- `use` — `Closeable` 자원의 안전한 닫기
- `runCatching` — 예외를 `Result<T>`로 캡슐화, 함수형 체이닝 가능
- 커스텀 예외 + sealed class — `when`으로 완전성 검사
