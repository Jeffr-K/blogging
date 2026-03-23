---
title: "[Kotlin 시리즈] 2. 기초 문법 — 범위, 구조 분해, 스프레드"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "기초문법", "범위", "구조분해", "range", "destructuring"]
---

# 기초 문법 2 — 범위, 구조 분해, 스프레드

## 범위 (Range)와 진행 (Progression)

### 닫힌 범위 `..`

```kotlin
val range = 1..10        // 1, 2, 3, ..., 10 (양 끝 포함)

// 포함 여부 확인
println(5 in 1..10)      // true
println(11 in 1..10)     // false
println(11 !in 1..10)    // true

// 반복
for (i in 1..5) print("$i ")   // 1 2 3 4 5
```

### 열린 범위 `..<`

```kotlin
val range = 1..<10       // 1, 2, ..., 9 (끝 미포함)

for (i in 0..<list.size) {
    println(list[i])
}

// until과 동일
for (i in 0 until list.size) {
    println(list[i])
}
```

`..<`는 Kotlin 1.7.20에서 도입됐습니다. `until`은 이전 방식으로 동일하게 동작합니다.

### 내림차순 `downTo`

```kotlin
for (i in 5 downTo 1) print("$i ")   // 5 4 3 2 1
```

### 간격 `step`

```kotlin
for (i in 1..10 step 2) print("$i ")    // 1 3 5 7 9
for (i in 10 downTo 1 step 3) print("$i ") // 10 7 4 1
```

### 문자 범위

```kotlin
for (c in 'a'..'z') print(c)   // abcdefghijklmnopqrstuvwxyz

println('e' in 'a'..'z')       // true
```

### 범위 타입

```kotlin
val intRange: IntRange = 1..10
val charRange: CharRange = 'a'..'z'
val longRange: LongRange = 1L..100L
```

### 범위 함수들

```kotlin
val range = 1..10

range.first         // 1
range.last          // 10
range.step          // 1
range.count()       // 10
range.sum()         // 55
range.average()     // 5.5
range.toList()      // [1, 2, 3, ..., 10]
range.reversed()    // 10 downTo 1

range.contains(5)   // true (= 5 in range)
range.isEmpty()     // false
```

### 커스텀 범위 — `Comparable` 구현체

```kotlin
// Comparable을 구현하면 .. 사용 가능
val dateRange = LocalDate.of(2024, 1, 1)..LocalDate.of(2024, 12, 31)

// 단, 반복은 불가 (IntProgression처럼 step이 없으므로)
println(LocalDate.of(2024, 6, 15) in dateRange)  // true
```

---

## 구조 분해 선언 (Destructuring Declaration)

### Pair와 Triple

```kotlin
val pair = Pair("홍길동", 30)
val (name, age) = pair

println(name)  // 홍길동
println(age)   // 30

// to 중위 함수로 Pair 생성
val p = "key" to "value"
val (k, v) = p
```

### data class 구조 분해

`data class`는 자동으로 `component1()`, `component2()` 등을 생성합니다.

```kotlin
data class User(val name: String, val age: Int, val email: String)

val user = User("홍길동", 30, "hong@example.com")
val (name, age, email) = user

println(name)   // 홍길동
println(age)    // 30
println(email)  // hong@example.com
```

### `_` — 필요 없는 컴포넌트 무시

```kotlin
data class Point(val x: Int, val y: Int, val z: Int)

val point = Point(1, 2, 3)
val (x, _, z) = point   // y는 무시

println(x)  // 1
println(z)  // 3
```

### 반복문에서 구조 분해

```kotlin
val users = listOf(
    User("홍길동", 25, "hong@example.com"),
    User("김영희", 30, "kim@example.com"),
)

for ((name, age) in users) {
    println("$name: $age세")
}

// Map 순회
val map = mapOf("a" to 1, "b" to 2, "c" to 3)
for ((key, value) in map) {
    println("$key = $value")
}
```

### withIndex — 인덱스와 함께

```kotlin
val list = listOf("apple", "banana", "cherry")

for ((index, value) in list.withIndex()) {
    println("$index: $value")
}
// 0: apple
// 1: banana
// 2: cherry
```

### 람다 파라미터 구조 분해

```kotlin
val users = listOf(User("홍길동", 25, "hong@example.com"))

// 람다 파라미터를 바로 구조 분해
users.forEach { (name, age) ->
    println("$name: $age세")
}

// Map.forEach
map.forEach { (key, value) ->
    println("$key → $value")
}
```

### componentN() — 커스텀 구현

`data class`가 아니어도 `componentN()` 함수를 `operator`로 구현하면 구조 분해를 사용할 수 있습니다.

```kotlin
class Color(val r: Int, val g: Int, val b: Int) {
    operator fun component1() = r
    operator fun component2() = g
    operator fun component3() = b
}

val color = Color(255, 128, 0)
val (r, g, b) = color
println("R=$r G=$g B=$b")  // R=255 G=128 B=0
```

### 구조 분해의 위험성 — 순서 의존

구조 분해는 **이름이 아닌 순서**를 기반으로 합니다.

```kotlin
data class User(val name: String, val age: Int)

val (name, age) = User("홍길동", 30)   // OK
val (age, name) = User("홍길동", 30)   // 위험! age = "홍길동", name = 30

// data class 필드 순서가 바뀌면 구조 분해가 의미 없어짐
// 특히 외부 라이브러리 data class 구조 분해는 주의
```

---

## 스프레드 연산자 (`*`)

배열을 `vararg` 파라미터에 **펼쳐서** 전달할 때 사용합니다.

### 기본 사용

```kotlin
fun sum(vararg numbers: Int): Int = numbers.sum()

val nums = intArrayOf(1, 2, 3, 4, 5)
println(sum(*nums))        // 15 — 배열을 펼쳐서 전달
println(sum(1, 2, *nums))  // 1 + 2 + 1+2+3+4+5 = 18 (앞에 추가 가능)
```

### Array\<T\>에는 그대로

```kotlin
fun greet(vararg names: String) = names.forEach { println("Hello, $it!") }

val names = arrayOf("Alice", "Bob", "Carol")
greet(*names)
```

`IntArray`처럼 원시 타입 배열에도 `*`을 씁니다.

### listOf / mapOf에서 활용

```kotlin
val base = listOf(1, 2, 3)
val extended = listOf(0, *base.toTypedArray(), 4, 5)
// [0, 1, 2, 3, 4, 5]
```

---

## 세 개념의 연결 — 실용 예시

```kotlin
data class Config(
    val host: String,
    val port: Int,
    val timeout: Int,
    val retries: Int,
)

fun connect(vararg configs: Config) {
    configs.forEach { (host, port) ->   // 구조 분해
        println("Connecting to $host:$port")
    }
}

val defaultConfigs = arrayOf(
    Config("localhost", 8080, 3000, 3),
    Config("backup.host", 8081, 5000, 5),
)

val mainConfig = Config("prod.host", 443, 1000, 10)

// 스프레드로 배열 펼치고, 추가 요소도 전달
connect(mainConfig, *defaultConfigs)
```

---

## 정리

| 개념 | 핵심 |
|------|------|
| `1..10` | 닫힌 범위 (양 끝 포함) |
| `1..<10` / `1 until 10` | 열린 범위 (끝 미포함) |
| `10 downTo 1` | 내림차순 범위 |
| `step n` | 간격 지정 |
| `val (a, b) = pair` | 구조 분해 — 순서 기반 |
| `_` | 구조 분해에서 불필요한 컴포넌트 무시 |
| `*array` | 배열을 vararg에 펼치기 |

구조 분해는 순서 의존적이므로 필드가 많은 `data class`에서 무분별하게 쓰면 유지보수가 어려워집니다. 필요한 필드만 명시적으로 꺼내는 편이 나을 때가 많습니다.
