---
title: "[Kotlin 시리즈] 16. value class"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "value class", "inline class", "JvmInline", "래퍼", "타입안전성"]
---

# value class

`value class`는 단일 프로퍼티를 감싸는 **타입 안전 래퍼**입니다. 런타임에 래퍼 객체 생성 없이 내부 값으로 대체되어(inlining) 성능 오버헤드가 없습니다.

## 선언

```kotlin
@JvmInline
value class UserId(val value: Long)

@JvmInline
value class Email(val value: String)
```

JVM 대상에서는 `@JvmInline`이 필수입니다.

---

## 왜 쓰는가 — 타입 혼동 방지

```kotlin
// 원시 타입 사용 — 컴파일러가 혼동을 잡지 못함
fun sendEmail(userId: Long, orderId: Long, recipientEmail: String) { ... }

sendEmail(orderId, userId, email)  // 컴파일 OK, 런타임 버그!
```

```kotlin
@JvmInline value class UserId(val value: Long)
@JvmInline value class OrderId(val value: Long)
@JvmInline value class Email(val value: String)

fun sendEmail(userId: UserId, orderId: OrderId, recipient: Email) { ... }

sendEmail(orderId, userId, email)  // 컴파일 에러 — 타입 불일치
```

---

## 특징

### 런타임에 언박싱

대부분의 경우 컴파일러가 `UserId` 객체 대신 내부 `Long` 값을 직접 사용합니다.

```kotlin
@JvmInline
value class Millis(val value: Long) {
    fun toSeconds() = value / 1000.0
}

val t = Millis(5000L)
t.toSeconds()  // 5.0 — 런타임에 Long 5000L로 동작
```

바이트코드 수준에서는 `long` 원시 타입이 됩니다.

### 멤버 함수 / 프로퍼티

```kotlin
@JvmInline
value class Password(val value: String) {
    val length: Int get() = value.length
    val isStrong: Boolean get() = length >= 8 && value.any { it.isDigit() }

    fun masked() = "*".repeat(length)
}

val pw = Password("kotlin2024")
pw.length     // 10
pw.isStrong   // true
pw.masked()   // "**********"
```

### 인터페이스 구현 가능

```kotlin
interface Printable {
    fun print()
}

@JvmInline
value class Name(val value: String) : Printable {
    override fun print() = println("이름: $value")
}

val name = Name("홍길동")
name.print()   // "이름: 홍길동"
```

---

## 제약

```kotlin
// 프로퍼티 하나만 — 여러 개 불가
@JvmInline
value class Pair(val a: Int, val b: Int)  // 컴파일 에러

// init 블록 가능 — 유효성 검사에 활용
@JvmInline
value class Age(val value: Int) {
    init {
        require(value >= 0) { "나이는 음수일 수 없습니다." }
    }
}

// 상속 불가 — 다른 클래스를 상속하거나 상속될 수 없음
@JvmInline
value class MyId(val value: Long) : SomeBaseClass()  // 에러

// var 프로퍼티 불가 — val만
@JvmInline
value class Counter(var value: Int)  // 에러
```

---

## 박싱이 발생하는 경우

다음 상황에서는 실제 래퍼 객체가 생성됩니다.

```kotlin
@JvmInline
value class UserId(val value: Long)

// nullable 사용 — 박싱
val id: UserId? = null

// 제네릭 — 박싱
val list: List<UserId> = listOf(UserId(1L), UserId(2L))

// 인터페이스 타입으로 사용 — 박싱
val printable: Printable = Name("홍길동")
```

일반 함수 파라미터로 쓸 때는 박싱 없이 동작합니다.

---

## 활용 패턴

### 도메인 원시 타입 (Primitive Obsession 해결)

```kotlin
@JvmInline value class ProductId(val value: UUID)
@JvmInline value class Price(val value: Long) {
    init { require(value >= 0) { "가격은 음수일 수 없습니다." } }
    operator fun plus(other: Price) = Price(value + other.value)
}
@JvmInline value class Quantity(val value: Int) {
    init { require(value > 0) { "수량은 양수여야 합니다." } }
}

data class OrderLine(
    val productId: ProductId,
    val price: Price,
    val quantity: Quantity,
) {
    val total: Price get() = Price(price.value * quantity.value)
}
```

### 단위 혼용 방지

```kotlin
@JvmInline value class Meters(val value: Double)
@JvmInline value class Kilograms(val value: Double)
@JvmInline value class Seconds(val value: Double)

data class PhysicsObject(
    val mass: Kilograms,
    val distance: Meters,
    val time: Seconds,
)

// 단위 실수 컴파일 에러
PhysicsObject(
    mass = Kilograms(10.0),
    distance = Meters(5.0),
    time = Seconds(2.0),
)
```

### 검증된 문자열 타입

```kotlin
@JvmInline
value class HexColor(val value: String) {
    init {
        require(value.matches(Regex("^#[0-9A-Fa-f]{6}$"))) {
            "올바른 HEX 색상이 아닙니다: $value"
        }
    }
}

@JvmInline
value class NonBlankString(val value: String) {
    init { require(value.isNotBlank()) { "빈 문자열은 허용되지 않습니다." } }
}

val color = HexColor("#FF5733")       // OK
val bad = HexColor("red")             // IllegalArgumentException
```

---

## data class vs value class

```kotlin
// data class — 여러 필드, 구조 분해, copy
data class Point(val x: Int, val y: Int)

// value class — 단일 필드, 타입 안전 래퍼, 성능 최적화
@JvmInline value class Latitude(val degrees: Double)
```

| | `data class` | `value class` |
|--|------------|-------------|
| 프로퍼티 수 | 여러 개 | 하나 |
| 런타임 객체 | 항상 생성 | 대부분 인라인 |
| copy | 자동 생성 | 없음 |
| 구조 분해 | 자동 생성 | 없음 |
| 주 목적 | 데이터 묶음 | 타입 안전 래퍼 |

---

## 정리

- `@JvmInline value class` — 단일 `val` 프로퍼티, 런타임 오버헤드 없음
- **Primitive Obsession** 해결 — `Long`, `String` 대신 의미 있는 타입
- `init` 블록으로 유효성 검사 가능
- 멤버 함수, 인터페이스 구현 가능
- nullable / 제네릭 / 인터페이스 타입으로 사용 시 박싱 발생
