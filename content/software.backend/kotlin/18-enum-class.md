---
title: "[Kotlin 시리즈] 18. enum class"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "enum", "enum class", "entries", "ordinal", "상수"]
---

# enum class

`enum class`는 **고정된 상수 집합**을 타입으로 표현합니다. 각 항목은 해당 클래스의 인스턴스입니다.

## 기본 선언

```kotlin
enum class Direction {
    NORTH, SOUTH, EAST, WEST
}

val dir = Direction.NORTH
println(dir)          // NORTH
println(dir.name)     // "NORTH"
println(dir.ordinal)  // 0
```

---

## 프로퍼티와 메서드

각 enum 항목에 값을 부여할 수 있습니다.

```kotlin
enum class Planet(val mass: Double, val radius: Double) {
    MERCURY(3.303e+23, 2.4397e6),
    VENUS  (4.869e+24, 6.0518e6),
    EARTH  (5.976e+24, 6.37814e6),
    MARS   (6.421e+23, 3.3972e6);

    val surfaceGravity: Double
        get() = G * mass / (radius * radius)

    fun surfaceWeight(otherMass: Double) = otherMass * surfaceGravity

    companion object {
        private const val G = 6.67300E-11
    }
}

val weight = Planet.EARTH.surfaceWeight(75.0)  // 약 735.0 N
```

---

## 추상 메서드

각 항목이 메서드를 다르게 구현합니다.

```kotlin
enum class Operation(val symbol: String) {
    PLUS("+") {
        override fun apply(a: Double, b: Double) = a + b
    },
    MINUS("-") {
        override fun apply(a: Double, b: Double) = a - b
    },
    TIMES("*") {
        override fun apply(a: Double, b: Double) = a * b
    },
    DIVIDE("/") {
        override fun apply(a: Double, b: Double) = a / b
    };

    abstract fun apply(a: Double, b: Double): Double

    override fun toString() = symbol
}

val result = Operation.PLUS.apply(3.0, 4.0)   // 7.0
println(Operation.TIMES)                        // *
```

---

## entries — 모든 항목 열거 (Kotlin 1.9+)

```kotlin
enum class Color { RED, GREEN, BLUE }

// entries (Kotlin 1.9+) — 권장
Color.entries.forEach { println(it) }

// values() — 구식, 매 호출마다 배열 복사
Color.values().forEach { println(it) }
```

`entries`는 불변 리스트(`EnumEntries<Color>`)를 반환합니다.

---

## 이름으로 조회

```kotlin
enum class HttpMethod { GET, POST, PUT, DELETE, PATCH }

// valueOf — 없으면 IllegalArgumentException
val method = HttpMethod.valueOf("GET")

// enumValueOf (제네릭 버전)
val method2 = enumValueOf<HttpMethod>("POST")

// 안전한 조회
fun safeValueOf(name: String): HttpMethod? =
    runCatching { HttpMethod.valueOf(name) }.getOrNull()

// entries 활용
fun HttpMethod.Companion.fromOrNull(name: String) =
    HttpMethod.entries.find { it.name == name }
```

---

## 인터페이스 구현

```kotlin
interface Displayable {
    fun display(): String
}

enum class Season : Displayable {
    SPRING {
        override fun display() = "봄 🌸"
    },
    SUMMER {
        override fun display() = "여름 ☀️"
    },
    AUTUMN {
        override fun display() = "가을 🍂"
    },
    WINTER {
        override fun display() = "겨울 ❄️"
    };
}

Season.entries.forEach { println(it.display()) }
```

---

## when과 함께

```kotlin
enum class TrafficLight { RED, YELLOW, GREEN }

fun action(light: TrafficLight): String = when (light) {
    TrafficLight.RED    -> "정지"
    TrafficLight.YELLOW -> "주의"
    TrafficLight.GREEN  -> "출발"
    // else 불필요 — 완전성 검사
}
```

---

## 실용 패턴

### 상태 코드 매핑

```kotlin
enum class HttpStatus(val code: Int, val description: String) {
    OK(200, "OK"),
    CREATED(201, "Created"),
    BAD_REQUEST(400, "Bad Request"),
    UNAUTHORIZED(401, "Unauthorized"),
    NOT_FOUND(404, "Not Found"),
    INTERNAL_SERVER_ERROR(500, "Internal Server Error");

    val isSuccess: Boolean get() = code in 200..299
    val isClientError: Boolean get() = code in 400..499
    val isServerError: Boolean get() = code in 500..599

    companion object {
        fun fromCode(code: Int): HttpStatus? =
            entries.find { it.code == code }
    }
}

HttpStatus.fromCode(404)?.description   // "Not Found"
HttpStatus.OK.isSuccess                 // true
```

### 전략 패턴 대체

```kotlin
enum class SortOrder {
    ASCENDING {
        override fun <T : Comparable<T>> sort(list: List<T>) = list.sorted()
    },
    DESCENDING {
        override fun <T : Comparable<T>> sort(list: List<T>) = list.sortedDescending()
    };

    abstract fun <T : Comparable<T>> sort(list: List<T>): List<T>
}

val numbers = listOf(3, 1, 4, 1, 5, 9, 2, 6)
SortOrder.ASCENDING.sort(numbers)   // [1, 1, 2, 3, 4, 5, 6, 9]
SortOrder.DESCENDING.sort(numbers)  // [9, 6, 5, 4, 3, 2, 1, 1]
```

### 권한 레벨

```kotlin
enum class Role(val level: Int) {
    GUEST(0), USER(1), MODERATOR(2), ADMIN(3);

    fun canAccess(required: Role) = level >= required.level
}

val currentRole = Role.MODERATOR
currentRole.canAccess(Role.USER)   // true
currentRole.canAccess(Role.ADMIN)  // false
```

---

## enum class vs sealed class

```kotlin
// enum — 고정 인스턴스 집합, 반복 가능, 모든 항목이 같은 프로퍼티 구조
enum class Status { LOADING, SUCCESS, ERROR }

// sealed — 항목마다 다른 데이터 구조 가능
sealed class Status {
    data object Loading : Status()
    data class Success(val data: String) : Status()
    data class Error(val message: String, val code: Int) : Status()
}
```

| | `enum class` | `sealed class` |
|--|------------|--------------|
| 항목 수 | 고정 | 고정 |
| 각 항목 데이터 | 공통 프로퍼티 | 독립적 |
| 반복 | `entries` | 불가 |
| ordinal / name | O | X |
| 직렬화 | 간단 | 복잡 |

---

## 정리

- `enum class` — 고정 상수 집합, 각 항목은 인스턴스
- `name` / `ordinal` — 이름과 선언 순서
- `entries` — 불변 리스트 (Kotlin 1.9+, `values()` 대체)
- 프로퍼티, 추상 메서드, 인터페이스 구현 가능
- `when` 완전성 검사 지원
- 항목마다 다른 데이터가 필요하면 `sealed class` 사용
