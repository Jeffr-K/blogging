---
title: "[Kotlin 시리즈] 4. 제어 흐름 — if와 when"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "제어흐름", "if", "when", "표현식", "스마트캐스트"]
---

# 제어 흐름 — if와 when

Kotlin의 `if`와 `when`은 **표현식(expression)**입니다. 값을 반환하기 때문에 변수에 바로 할당하거나 함수의 반환값으로 쓸 수 있습니다.

---

## if 표현식

### 기본 사용

```kotlin
val x = 10

// 구문(statement)으로 사용
if (x > 5) {
    println("크다")
} else {
    println("작다")
}
```

### 표현식으로 사용 — 값 반환

```kotlin
val result = if (x > 5) "크다" else "작다"

// 블록도 가능 — 마지막 줄이 반환값
val description = if (x > 5) {
    println("분기: 크다")
    "크다"       // 이 값이 반환됨
} else {
    println("분기: 작다")
    "작다"
}
```

표현식으로 쓸 때는 반드시 `else` 브랜치가 있어야 합니다. 없으면 컴파일 에러입니다.

### 삼항 연산자 대체

Kotlin에는 삼항 연산자(`? :`)가 없습니다. `if` 표현식이 그 역할을 합니다.

```kotlin
// Java: String label = x > 0 ? "양수" : "음수";
val label = if (x > 0) "양수" else "음수"
```

### 중첩 if

```kotlin
val grade = if (score >= 90) {
    "A"
} else if (score >= 80) {
    "B"
} else if (score >= 70) {
    "C"
} else {
    "F"
}
```

중첩이 세 단계 이상이면 `when`이 더 읽기 좋습니다.

---

## when 표현식

`when`은 Java의 `switch`보다 훨씬 강력합니다. 값 매칭뿐 아니라 타입 체크, 범위 검사, 조건식까지 처리합니다.

### 기본 — 값 매칭

```kotlin
val day = 3

when (day) {
    1 -> println("월요일")
    2 -> println("화요일")
    3 -> println("수요일")
    4 -> println("목요일")
    5 -> println("금요일")
    6, 7 -> println("주말")   // 쉼표로 여러 값 묶기
    else -> println("잘못된 값")
}
```

### 표현식으로 사용

```kotlin
val dayName = when (day) {
    1 -> "월요일"
    2 -> "화요일"
    3 -> "수요일"
    4 -> "목요일"
    5 -> "금요일"
    6, 7 -> "주말"
    else -> "알 수 없음"
}
```

표현식으로 쓸 때는 `else`가 필수입니다. 단, sealed class/interface나 enum class처럼 모든 경우가 커버되면 `else` 없이 가능합니다.

### 블록 브랜치

```kotlin
val result = when (day) {
    1 -> {
        println("월요일 처리")
        "Monday"      // 마지막 줄이 반환값
    }
    else -> "Other"
}
```

### 범위 매칭 (`in`, `!in`)

```kotlin
val score = 75

val grade = when (score) {
    in 90..100 -> "A"
    in 80..<90 -> "B"
    in 70..<80 -> "C"
    in 60..<70 -> "D"
    else       -> "F"
}
```

### 타입 체크 (`is`, `!is`)

```kotlin
fun describe(obj: Any): String = when (obj) {
    is Int    -> "정수: $obj"
    is String -> "문자열 길이: ${obj.length}"  // 스마트 캐스트 — obj는 String
    is List<*> -> "리스트 크기: ${obj.size}"
    is Boolean -> if (obj) "참" else "거짓"
    else       -> "알 수 없는 타입"
}
```

`is` 브랜치 안에서는 **스마트 캐스트**가 적용됩니다.

### 인자 없는 when — if-else if 대체

```kotlin
val x = 42

when {
    x < 0    -> println("음수")
    x == 0   -> println("0")
    x < 100  -> println("두 자리 이하")
    else     -> println("세 자리 이상")
}
```

인자 없는 `when`은 각 브랜치의 조건이 `Boolean` 표현식입니다.

### when에 변수 선언 (Kotlin 1.9)

```kotlin
when (val response = fetchData()) {
    is Success -> println(response.data)    // response는 Success로 스마트 캐스트
    is Error   -> println(response.message)
}
// response는 when 블록 밖에서 접근 불가
```

### 가드 조건 (`if`) — Kotlin 2.0

브랜치 안에 추가 조건을 인라인으로 붙일 수 있습니다.

```kotlin
sealed interface Shape
data class Circle(val radius: Double) : Shape
data class Rectangle(val w: Double, val h: Double) : Shape

fun describe(shape: Shape): String = when (shape) {
    is Circle if shape.radius > 100 -> "거대한 원"   // 가드 조건
    is Circle if shape.radius > 10  -> "큰 원"
    is Circle                       -> "작은 원"
    is Rectangle if shape.w == shape.h -> "정사각형"
    is Rectangle                       -> "직사각형"
}
```

Kotlin 2.0 이전에는 중첩 `when`이나 `&&`로 처리해야 했습니다.

### sealed class와 when — 완전성 검사 (Exhaustiveness)

```kotlin
sealed class Result<out T>
data class Success<T>(val value: T) : Result<T>()
data class Failure(val error: Throwable) : Result<Nothing>()
object Loading : Result<Nothing>()

fun <T> handle(result: Result<T>): String = when (result) {
    is Success -> "성공: ${result.value}"
    is Failure -> "실패: ${result.error.message}"
    is Loading -> "로딩 중..."
    // else 불필요 — sealed class의 모든 서브클래스를 다뤘으므로
}
```

새 서브클래스를 추가하면 `when` 표현식에서 컴파일 에러가 납니다. 처리를 강제합니다.

### enum과 when

```kotlin
enum class Direction { NORTH, SOUTH, EAST, WEST }

fun move(dir: Direction): String = when (dir) {
    Direction.NORTH -> "위로"
    Direction.SOUTH -> "아래로"
    Direction.EAST  -> "오른쪽으로"
    Direction.WEST  -> "왼쪽으로"
    // else 불필요 — 모든 enum 값을 다뤘으므로
}
```

### when vs if 선택 기준

| 상황 | 권장 |
|------|------|
| 단순 참/거짓 | `if` |
| 2~3개 분기 | `if-else if` |
| 4개 이상 분기 | `when` |
| 타입 체크 여러 개 | `when` |
| sealed/enum 완전성 필요 | `when` |

---

## 정리

- `if`와 `when`은 **표현식** — 변수에 할당, 함수 반환값으로 사용 가능
- `when`은 값, 범위(`in`), 타입(`is`), 조건식 모두 매칭 가능
- sealed class/enum + `when` = 모든 케이스 처리 강제 (컴파일 타임 안전)
- Kotlin 2.0 가드 조건 — `is Type if condition` 으로 브랜치 세분화
