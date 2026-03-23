---
title: "[Kotlin 시리즈] 17. sealed class & sealed interface"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "sealed class", "sealed interface", "ADT", "when", "상태머신"]
---

# sealed class & sealed interface

`sealed`는 **클래스 계층을 제한**합니다. 모든 하위 타입이 컴파일 타임에 알려지기 때문에 `when` 표현식에서 완전성(exhaustiveness) 검사를 받을 수 있습니다.

## sealed class

```kotlin
sealed class Shape {
    data class Circle(val radius: Double) : Shape()
    data class Rectangle(val width: Double, val height: Double) : Shape()
    data class Triangle(val base: Double, val height: Double) : Shape()
}

fun area(shape: Shape): Double = when (shape) {
    is Shape.Circle    -> Math.PI * shape.radius * shape.radius
    is Shape.Rectangle -> shape.width * shape.height
    is Shape.Triangle  -> 0.5 * shape.base * shape.height
    // else 불필요 — 컴파일러가 완전성 확인
}
```

새 하위 타입을 추가하면 `when`이 처리하지 못한 케이스를 컴파일 에러로 알려줍니다.

---

## 하위 클래스 위치 규칙 (Kotlin 1.5+)

Kotlin 1.1~1.4에서는 같은 파일에만 선언할 수 있었지만, 1.5부터는 **같은 패키지, 같은 컴파일 단위(모듈)** 안이면 됩니다.

```
// com/example/result/ 패키지
Result.kt         — sealed class Result<out T>
Success.kt        — class Success<T>(val data: T) : Result<T>()
Failure.kt        — class Failure(val error: Throwable) : Result<Nothing>()
```

일반적으로는 같은 파일에 두는 것이 가독성이 좋습니다.

---

## sealed interface

인터페이스도 `sealed`로 만들 수 있습니다. 다중 구현이 필요할 때 사용합니다.

```kotlin
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String, val cause: Throwable? = null) : UiState<Nothing>
}

fun <T> render(state: UiState<T>) = when (state) {
    UiState.Loading      -> println("로딩 중...")
    is UiState.Success   -> println("데이터: ${state.data}")
    is UiState.Error     -> println("오류: ${state.message}")
}
```

`sealed class`와 달리 `sealed interface`는 하위 타입이 **다른 클래스를 동시에 상속**할 수 있습니다.

```kotlin
sealed interface Drawable
sealed interface Clickable

data class Button(val label: String) : Drawable, Clickable
data class Icon(val name: String) : Drawable
```

---

## data object — 상태 없는 하위 타입

상태가 없는 케이스는 `data object`를 씁니다 (Kotlin 1.9+).

```kotlin
sealed class Command {
    data class Move(val x: Int, val y: Int) : Command()
    data class Attack(val targetId: Long) : Command()
    data object Idle : Command()
    data object Quit : Command()
}

fun execute(cmd: Command) = when (cmd) {
    is Command.Move   -> println("이동: (${cmd.x}, ${cmd.y})")
    is Command.Attack -> println("공격: ${cmd.targetId}")
    Command.Idle      -> println("대기")
    Command.Quit      -> println("종료")
}
```

`data object`는 `toString()`, `equals()`, `hashCode()`를 제공합니다. (`object`와 달리 `toString`이 클래스명만 나옴)

---

## 실용 패턴

### API 결과 타입

```kotlin
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Failure(val error: String, val code: Int = 0) : Result<Nothing>()
    data object Loading : Result<Nothing>()
}

// 확장 함수로 편의 메서드
fun <T> Result<T>.onSuccess(block: (T) -> Unit): Result<T> {
    if (this is Result.Success) block(data)
    return this
}

fun <T> Result<T>.onFailure(block: (String, Int) -> Unit): Result<T> {
    if (this is Result.Failure) block(error, code)
    return this
}

fun <T, R> Result<T>.map(transform: (T) -> R): Result<R> = when (this) {
    is Result.Success -> Result.Success(transform(data))
    is Result.Failure -> this
    Result.Loading    -> Result.Loading
}
```

### 이벤트 / 액션 모델링

```kotlin
sealed interface UserEvent {
    data class Login(val userId: Long, val sessionToken: String) : UserEvent
    data class Logout(val userId: Long) : UserEvent
    data class UpdateProfile(val userId: Long, val name: String) : UserEvent
    data class PurchaseItem(val userId: Long, val itemId: Long, val price: Int) : UserEvent
}

fun processEvent(event: UserEvent) = when (event) {
    is UserEvent.Login          -> createSession(event.userId, event.sessionToken)
    is UserEvent.Logout         -> invalidateSession(event.userId)
    is UserEvent.UpdateProfile  -> updateUserRecord(event.userId, event.name)
    is UserEvent.PurchaseItem   -> recordPurchase(event.userId, event.itemId, event.price)
}
```

### 상태 머신

```kotlin
sealed class OrderStatus {
    data object Pending : OrderStatus()
    data class Paid(val transactionId: String) : OrderStatus()
    data class Shipped(val trackingNumber: String) : OrderStatus()
    data class Delivered(val deliveredAt: Long) : OrderStatus()
    data class Cancelled(val reason: String) : OrderStatus()
}

fun OrderStatus.canTransitionTo(next: OrderStatus): Boolean = when (this) {
    OrderStatus.Pending      -> next is OrderStatus.Paid || next is OrderStatus.Cancelled
    is OrderStatus.Paid      -> next is OrderStatus.Shipped || next is OrderStatus.Cancelled
    is OrderStatus.Shipped   -> next is OrderStatus.Delivered
    is OrderStatus.Delivered -> false
    is OrderStatus.Cancelled -> false
}
```

### 에러 계층

```kotlin
sealed class AppError {
    sealed class NetworkError : AppError() {
        data object NoConnection : NetworkError()
        data class Timeout(val durationMs: Long) : NetworkError()
        data class ServerError(val code: Int, val body: String) : NetworkError()
    }

    sealed class DatabaseError : AppError() {
        data class QueryFailed(val query: String, val cause: Throwable) : DatabaseError()
        data object NotFound : DatabaseError()
    }

    data class ValidationError(val field: String, val message: String) : AppError()
}

fun AppError.userMessage(): String = when (this) {
    AppError.NetworkError.NoConnection     -> "인터넷 연결을 확인해주세요."
    is AppError.NetworkError.Timeout       -> "요청 시간이 초과되었습니다."
    is AppError.NetworkError.ServerError   -> "서버 오류가 발생했습니다. (${code})"
    is AppError.DatabaseError.QueryFailed  -> "데이터 처리 중 오류가 발생했습니다."
    AppError.DatabaseError.NotFound        -> "요청한 데이터를 찾을 수 없습니다."
    is AppError.ValidationError            -> "${field}: $message"
}
```

---

## sealed class vs enum class

```kotlin
// enum — 각 항목이 인스턴스, 추가 데이터 없음
enum class Direction { NORTH, SOUTH, EAST, WEST }

// sealed — 각 항목이 다른 타입, 개별 데이터 보유
sealed class Event {
    data class Click(val x: Int, val y: Int) : Event()
    data class KeyPress(val key: String) : Event()
    data object Scroll : Event()
}
```

| | `sealed class` | `enum class` |
|--|--------------|------------|
| 각 항목 타입 | 독립된 클래스 | 같은 타입(인스턴스) |
| 데이터 | 항목마다 다른 필드 | 공통 필드만 |
| 인스턴스 수 | 제한 없음 | 각 항목 하나씩 |
| 반복(iteration) | 불가 | `entries`로 가능 |

---

## 정리

- `sealed class` / `sealed interface` — 하위 타입을 같은 패키지/모듈로 제한
- `when` 완전성 검사 — `else` 없이 모든 케이스 처리 보장
- 상태 없는 케이스 → `data object` (Kotlin 1.9+)
- `sealed interface` → 하위 타입이 다중 상속 가능
- 중첩 sealed로 계층적 에러/상태 모델링 가능
