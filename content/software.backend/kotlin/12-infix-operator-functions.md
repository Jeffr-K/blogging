---
title: "[Kotlin 시리즈] 12. infix 함수와 operator 함수"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "infix", "operator", "연산자오버로딩", "중위함수"]
---

# infix 함수와 operator 함수

## infix 함수

`infix`로 표시한 멤버 함수 또는 확장 함수는 **중위 표기법**으로 호출할 수 있습니다. 점(`.`)과 괄호 없이 호출합니다.

### 조건

1. 멤버 함수 또는 확장 함수
2. 파라미터가 정확히 하나
3. `vararg` 없음, 기본값 없음

```kotlin
infix fun Int.plus2(other: Int): Int = this + other

3 plus2 4    // 7 — 중위 표기
3.plus2(4)   // 7 — 일반 표기도 여전히 가능
```

### 표준 라이브러리의 infix 함수

```kotlin
// to — Pair 생성
val pair = "key" to "value"    // Pair("key", "value")
val map = mapOf("a" to 1, "b" to 2)

// until — 범위 생성
for (i in 0 until 10) { }

// downTo — 내림차순 범위
for (i in 10 downTo 1) { }

// step — 진행 간격
for (i in 1..10 step 2) { }

// and, or, xor — 비트 연산
val flags = 0b0001 or 0b0010   // 0b0011
val mask = 0b1111 and 0b0110   // 0b0110

// shl, shr, ushr — 비트 시프트
val shifted = 1 shl 3   // 8
```

### 커스텀 infix 함수

```kotlin
// 테스트 DSL 스타일
infix fun <T> T.shouldBe(expected: T) {
    if (this != expected) throw AssertionError("Expected $expected but was $this")
}

// 도메인 표현
data class User(val name: String, val role: String)
infix fun User.hasRole(role: String) = this.role == role

val user = User("홍길동", "ADMIN")
user hasRole "ADMIN"  // true
```

```kotlin
// 날짜 범위 DSL
infix fun LocalDate.to(end: LocalDate) = DateRange(this, end)

val period = LocalDate.of(2024, 1, 1) to LocalDate.of(2024, 12, 31)
```

---

## operator 함수

Kotlin의 연산자(`+`, `-`, `[]`, `==` 등)는 특정 이름의 함수와 연결됩니다. `operator`로 표시한 함수를 정의하면 해당 연산자를 쓸 수 있습니다.

### 산술 연산자

```kotlin
data class Vector(val x: Double, val y: Double) {
    operator fun plus(other: Vector) = Vector(x + other.x, y + other.y)
    operator fun minus(other: Vector) = Vector(x - other.x, y - other.y)
    operator fun times(scalar: Double) = Vector(x * scalar, y * scalar)
    operator fun div(scalar: Double) = Vector(x / scalar, y / scalar)
    operator fun unaryMinus() = Vector(-x, -y)   // 단항 -
}

val v1 = Vector(1.0, 2.0)
val v2 = Vector(3.0, 4.0)

v1 + v2          // Vector(4.0, 6.0)
v1 - v2          // Vector(-2.0, -2.0)
v1 * 2.0         // Vector(2.0, 4.0)
-v1              // Vector(-1.0, -2.0)
```

### 복합 대입 연산자

```kotlin
data class MutableVector(var x: Double, var y: Double) {
    operator fun plusAssign(other: MutableVector) {
        x += other.x
        y += other.y
    }
}

var v = MutableVector(1.0, 2.0)
v += MutableVector(3.0, 4.0)  // v = MutableVector(4.0, 6.0)
```

### 비교 연산자

```kotlin
data class Version(val major: Int, val minor: Int, val patch: Int) : Comparable<Version> {
    override fun compareTo(other: Version): Int {
        return compareValuesBy(this, other, { it.major }, { it.minor }, { it.patch })
    }
}

val v1 = Version(1, 2, 3)
val v2 = Version(1, 3, 0)

v1 < v2    // true  — compareTo 사용
v1 > v2    // false
v1 <= v2   // true
```

### 동등성 연산자

```kotlin
class Money(val amount: Int, val currency: String) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Money) return false
        return amount == other.amount && currency == other.currency
    }
    override fun hashCode() = 31 * amount + currency.hashCode()
}

Money(1000, "KRW") == Money(1000, "KRW")  // true  — equals 호출
Money(1000, "KRW") === Money(1000, "KRW") // false — 참조 동등성 (항상 다른 객체)
```

`data class`는 `equals`와 `hashCode`를 자동 생성합니다.

### 인덱스 연산자

```kotlin
class Grid(private val data: Array<IntArray>) {
    operator fun get(row: Int, col: Int) = data[row][col]
    operator fun set(row: Int, col: Int, value: Int) {
        data[row][col] = value
    }
}

val grid = Grid(Array(3) { IntArray(3) })
grid[1, 2] = 42
println(grid[1, 2])  // 42
```

### in 연산자 — contains

```kotlin
class NumberSet(private val numbers: Set<Int>) {
    operator fun contains(n: Int) = n in numbers
}

val set = NumberSet(setOf(1, 2, 3, 4, 5))
3 in set     // true  — set.contains(3)
10 in set    // false
10 !in set   // true
```

### rangeTo / rangeUntil 연산자

```kotlin
data class Version(val major: Int, val minor: Int) : Comparable<Version> {
    override fun compareTo(other: Version) =
        compareValuesBy(this, other, { it.major }, { it.minor })

    operator fun rangeTo(other: Version) = VersionRange(this, other)
}

class VersionRange(val start: Version, val end: Version) {
    operator fun contains(v: Version) = v >= start && v <= end
}

val v1 = Version(1, 0)
val v5 = Version(5, 0)
val range = v1..v5

Version(3, 0) in range  // true
```

### invoke 연산자 — 객체를 함수처럼 호출

```kotlin
class Multiplier(private val factor: Int) {
    operator fun invoke(value: Int) = value * factor
}

val triple = Multiplier(3)
triple(5)     // 15 — triple.invoke(5)
triple(10)    // 30
```

```kotlin
// 함수형 인터페이스처럼 동작하는 클래스
class Validator(private val regex: Regex) {
    operator fun invoke(input: String) = regex.matches(input)
}

val isEmail = Validator(Regex("[^@]+@[^@]+\\.[^@]+"))
isEmail("user@example.com")  // true
isEmail("not-an-email")      // false
```

### 구조 분해 연산자 — componentN

```kotlin
class RGB(val r: Int, val g: Int, val b: Int) {
    operator fun component1() = r
    operator fun component2() = g
    operator fun component3() = b
}

val color = RGB(255, 128, 0)
val (r, g, b) = color   // 구조 분해
```

### 증감 연산자

```kotlin
data class Counter(val value: Int) {
    operator fun inc() = Counter(value + 1)
    operator fun dec() = Counter(value - 1)
}

var c = Counter(0)
c++  // Counter(1)
c++  // Counter(2)
c--  // Counter(1)
```

---

## 전체 연산자 함수 목록

| 식 | 함수 |
|----|------|
| `a + b` | `a.plus(b)` |
| `a - b` | `a.minus(b)` |
| `a * b` | `a.times(b)` |
| `a / b` | `a.div(b)` |
| `a % b` | `a.rem(b)` |
| `a += b` | `a.plusAssign(b)` |
| `a -= b` | `a.minusAssign(b)` |
| `+a` | `a.unaryPlus()` |
| `-a` | `a.unaryMinus()` |
| `!a` | `a.not()` |
| `a++` | `a.inc()` |
| `a--` | `a.dec()` |
| `a == b` | `a.equals(b)` |
| `a > b` 등 | `a.compareTo(b)` |
| `a[i]` | `a.get(i)` |
| `a[i] = b` | `a.set(i, b)` |
| `a in b` | `b.contains(a)` |
| `a..b` | `a.rangeTo(b)` |
| `a..<b` | `a.rangeUntil(b)` |
| `a()` | `a.invoke()` |
| `val (x, y) = a` | `a.component1()`, `a.component2()` |

---

## 정리

- **infix**: 파라미터 하나인 함수를 중위 표기로 호출 — `a method b`
- **operator**: 연산자와 함수를 연결 — `a + b` → `a.plus(b)`
- 두 기능 모두 기존 클래스에 **확장 함수**로도 추가 가능
- `data class`는 `equals`, `hashCode`, `componentN`을 자동 생성
