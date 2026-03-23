---
title: "[Kotlin 시리즈] 15. data class"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "data class", "copy", "구조분해", "equals", "hashCode", "componentN"]
---

# data class

`data class`는 데이터를 담는 용도의 클래스입니다. 컴파일러가 `equals`, `hashCode`, `toString`, `copy`, `componentN`을 자동 생성합니다.

## 선언

```kotlin
data class User(val id: Long, val name: String, val email: String)
```

주 생성자에 **최소 하나의 프로퍼티**가 있어야 합니다.

```kotlin
val u1 = User(1L, "홍길동", "hong@example.com")
val u2 = User(1L, "홍길동", "hong@example.com")

println(u1)          // User(id=1, name=홍길동, email=hong@example.com)
println(u1 == u2)    // true — 구조적 동등성
println(u1 === u2)   // false — 참조 동등성
```

---

## 자동 생성 함수

### equals / hashCode

주 생성자의 모든 프로퍼티를 기준으로 생성됩니다.

```kotlin
data class Point(val x: Int, val y: Int)

Point(1, 2) == Point(1, 2)    // true
Point(1, 2).hashCode() == Point(1, 2).hashCode()  // true

// Map / Set에서 올바르게 동작
val set = setOf(Point(1, 2), Point(1, 2), Point(3, 4))
println(set.size)  // 2
```

### toString

```kotlin
data class Order(val id: Long, val items: List<String>, val total: Int)

val order = Order(1L, listOf("사과", "바나나"), 2500)
println(order)
// Order(id=1, items=[사과, 바나나], total=2500)
```

### copy

일부 프로퍼티만 바꾼 새 인스턴스를 생성합니다. 불변 데이터를 다룰 때 핵심 패턴입니다.

```kotlin
data class Config(
    val host: String = "localhost",
    val port: Int = 8080,
    val debug: Boolean = false,
)

val default = Config()
val production = default.copy(host = "prod.example.com", port = 443)
val devDebug = default.copy(debug = true)

println(default)     // Config(host=localhost, port=8080, debug=false)
println(production)  // Config(host=prod.example.com, port=443, debug=false)
println(devDebug)    // Config(host=localhost, port=8080, debug=true)
```

### componentN — 구조 분해

```kotlin
data class Person(val name: String, val age: Int, val city: String)

val person = Person("홍길동", 30, "서울")
val (name, age, city) = person   // component1(), component2(), component3()

println("$name, $age, $city")  // 홍길동, 30, 서울

// 불필요한 컴포넌트는 _로 무시
val (n, _, c) = person
println("$n, $c")  // 홍길동, 서울
```

리스트나 맵에서도 활용됩니다.

```kotlin
data class Entry(val key: String, val value: Int)

val entries = listOf(Entry("a", 1), Entry("b", 2), Entry("c", 3))
for ((key, value) in entries) {
    println("$key → $value")
}

// Map.Entry도 동일
val map = mapOf("x" to 10, "y" to 20)
for ((k, v) in map) {
    println("$k = $v")
}
```

---

## 주의 사항

### 주 생성자 프로퍼티만 포함

클래스 본문의 프로퍼티는 `equals`, `hashCode`, `toString`에 포함되지 않습니다.

```kotlin
data class Product(val id: Int, val name: String) {
    var category: String = "일반"   // 본문 프로퍼티 — equals에 포함 안 됨
}

val p1 = Product(1, "사과").apply { category = "과일" }
val p2 = Product(1, "사과").apply { category = "채소" }

println(p1 == p2)   // true — category는 무시
println(p1)         // Product(id=1, name=사과) — category 미포함
```

### 상속 제한

`data class`는 `abstract`, `open`, `sealed`, `inner`를 붙일 수 없습니다. 다른 클래스를 상속할 수 없습니다 (인터페이스 구현은 가능).

```kotlin
interface Identifiable {
    val id: Long
}

data class User(override val id: Long, val name: String) : Identifiable
```

### 가변 프로퍼티 주의

`var` 프로퍼티를 쓰면 `hashCode`가 변해 Map / Set에서 문제가 생깁니다. `val`을 쓰는 것이 권장됩니다.

```kotlin
data class BadKey(var name: String)

val map = mutableMapOf<BadKey, Int>()
val key = BadKey("a")
map[key] = 1

key.name = "b"   // hashCode 변경
println(map[key])          // null — 잃어버림
println(map[BadKey("b")])  // null — 원래 키를 못 찾음
```

---

## 실용 패턴

### 불변 업데이트 체인

```kotlin
data class UserProfile(
    val name: String,
    val age: Int,
    val address: String,
    val premium: Boolean = false,
)

val initial = UserProfile("홍길동", 30, "서울")
val updated = initial
    .copy(address = "부산")
    .copy(premium = true)
```

### DTO / Value Object

```kotlin
data class Money(val amount: Long, val currency: String) {
    operator fun plus(other: Money): Money {
        require(currency == other.currency) { "통화가 다릅니다." }
        return copy(amount = amount + other.amount)
    }
}

val price = Money(1000L, "KRW")
val tax = Money(100L, "KRW")
val total = price + tax   // Money(amount=1100, currency=KRW)
```

### sealed class와 조합

```kotlin
sealed class ApiResult<out T>
data class Success<T>(val data: T) : ApiResult<T>()
data class Failure(val error: String, val code: Int) : ApiResult<Nothing>()
data object Loading : ApiResult<Nothing>()

fun handle(result: ApiResult<String>) = when (result) {
    is Success -> println("성공: ${result.data}")
    is Failure -> println("실패 (${result.code}): ${result.error}")
    Loading    -> println("로딩 중...")
}
```

---

## 정리

| 자동 생성 | 기준 | 용도 |
|----------|------|------|
| `equals` / `hashCode` | 주 생성자 프로퍼티 | 구조적 동등성, Map/Set 키 |
| `toString` | 주 생성자 프로퍼티 | 디버깅 |
| `copy(...)` | 모든 프로퍼티 | 불변 업데이트 |
| `componentN()` | 선언 순서 | 구조 분해 |

- 본문 프로퍼티는 자동 생성에서 제외 — 의도치 않은 동작에 주의
- `var` 프로퍼티는 해시 불변성 위반 가능 — `val` 권장
- 상속 불가, 인터페이스 구현은 가능
