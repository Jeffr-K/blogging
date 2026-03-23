---
title: "[Kotlin 시리즈] 35. 표준 라이브러리 유틸리티"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "stdlib", "require", "check", "Result", "Duration", "measureTime", "runCatching"]
---

# 표준 라이브러리 유틸리티

## 전제 조건 체크

### require / check / error

```kotlin
// require — 입력값 검증 (IllegalArgumentException)
fun createUser(name: String, age: Int): User {
    require(name.isNotBlank()) { "이름은 비어있을 수 없습니다." }
    require(age in 0..150) { "나이는 0~150 사이여야 합니다. 입력값: $age" }
    return User(name, age)
}

// check — 상태 검증 (IllegalStateException)
class Connection {
    private var connected = false

    fun connect() { connected = true }

    fun send(data: String) {
        check(connected) { "연결되지 않은 상태에서 전송할 수 없습니다." }
        // 전송 로직
    }
}

// error — 도달 불가 분기 (IllegalStateException + Nothing)
fun getStatus(code: Int): String = when (code) {
    200 -> "OK"
    404 -> "Not Found"
    500 -> "Server Error"
    else -> error("알 수 없는 상태 코드: $code")
}
```

### requireNotNull / checkNotNull

```kotlin
fun process(value: String?) {
    val nonNull: String = requireNotNull(value) { "값이 null일 수 없습니다." }
    // 이후 nonNull은 String (non-nullable)
}

class Service {
    var config: Config? = null

    fun start() {
        val cfg = checkNotNull(config) { "config가 설정되지 않았습니다." }
        cfg.apply()
    }
}
```

### TODO

미구현 코드를 표시하고, 호출 시 `NotImplementedError`를 던집니다.

```kotlin
fun parseJson(json: String): Any = TODO("JSON 파싱 미구현")
fun fetchData(): List<String> = TODO()

// 반환 타입 추론에도 활용
val result: Int = if (condition) 42 else TODO("조건 false 처리 미구현")
```

---

## Result\<T\>

예외를 타입으로 다룹니다.

### runCatching

```kotlin
val result: Result<Int> = runCatching {
    "42".toInt()
}

val failed: Result<Int> = runCatching {
    "abc".toInt()  // NumberFormatException
}

result.isSuccess   // true
failed.isFailure   // true
```

### 값 추출

```kotlin
val result = runCatching { fetchUser(1L) }

result.getOrNull()                      // User? — 실패 시 null
result.getOrDefault(User.guest())       // 실패 시 기본값
result.getOrElse { error -> User.guest() }  // 실패 시 람다 결과
result.getOrThrow()                     // 실패 시 예외 재던짐
```

### 변환 및 체이닝

```kotlin
runCatching { readFile("config.json") }
    .map { parseJson(it) }               // 성공 시 변환
    .mapCatching { validateConfig(it) }  // 변환 중 예외 처리
    .recover { error ->                  // 실패 시 복구
        println("복구: ${error.message}")
        Config.default()
    }
    .recoverCatching { loadFromEnv() }   // 복구 중 예외 처리
    .onSuccess { config -> applyConfig(config) }
    .onFailure { error -> logger.error("설정 로드 실패", error) }
```

### 실전 패턴

```kotlin
// API 호출 래퍼
suspend fun <T> safeApiCall(call: suspend () -> T): Result<T> =
    runCatching { call() }

// 사용
val user = safeApiCall { api.getUser(id) }
    .getOrElse { error ->
        logger.warn("사용자 조회 실패: ${error.message}")
        User.unknown()
    }
```

---

## 수학 유틸리티

```kotlin
import kotlin.math.*

abs(-5)        // 5
abs(-3.14)     // 3.14
sqrt(16.0)     // 4.0
pow(2.0, 10.0) // 1024.0
ceil(3.2)      // 4.0
floor(3.8)     // 3.0
round(3.5)     // 4
ln(E)          // 1.0
log2(8.0)      // 3.0
log10(100.0)   // 2.0
sin(PI / 2)    // 1.0
max(3, 5)      // 5
min(3, 5)      // 3
```

### coerce — 범위 제한

```kotlin
val value = 150

value.coerceIn(0, 100)          // 100 — 상한 초과
value.coerceIn(0..100)          // 100
value.coerceAtLeast(0)          // 150 — 하한 이하면 0
value.coerceAtMost(100)         // 100 — 상한 초과면 100

(-5).coerceAtLeast(0)           // 0
3.14.coerceIn(0.0, 1.0)         // 1.0
```

---

## 시간 (kotlin.time)

### Duration

```kotlin
import kotlin.time.*
import kotlin.time.Duration.Companion.*

val oneSecond = 1.seconds
val twoMinutes = 2.minutes
val halfHour = 30.minutes
val oneDay = 24.hours

val total = oneSecond + twoMinutes  // 2분 1초

// 단위 변환
oneDay.inWholeHours       // 24
oneDay.inWholeMinutes     // 1440
oneSecond.inWholeMilliseconds  // 1000

// 비교
oneSecond < twoMinutes    // true
halfHour.isPositive()     // true

// 분해
twoMinutes.toComponents { hours, minutes, seconds, nanoseconds ->
    println("$hours:$minutes:$seconds")  // 0:2:0
}
```

### measureTime / measureTimedValue

```kotlin
val elapsed: Duration = measureTime {
    heavyComputation()
}
println("소요: ${elapsed.inWholeMilliseconds}ms")

val (result, elapsed2) = measureTimedValue {
    heavyComputation()  // 결과값 반환
}
println("결과: $result, 소요: $elapsed2")
```

### TimeSource

```kotlin
val mark = TimeSource.Monotonic.markNow()

doWork()

val elapsed = mark.elapsedNow()
println("경과: $elapsed")
```

---

## 문자열 유틸리티

```kotlin
// 빌더
val str = buildString {
    append("Hello")
    append(", ")
    repeat(3) { append("ha") }
    appendLine()
    append("!")
}
// "Hello, hahaha\n!"

// 체크
"".isEmpty()          // true
"  ".isBlank()        // true
"hello".isNotBlank()  // true

// 변환
"hello world".capitalize()    // "Hello world" (deprecated in 1.5, use replaceFirstChar)
"hello world".replaceFirstChar { it.uppercase() }  // "Hello world"
"HelloWorld".decapitalize()   // deprecated
"HelloWorld".replaceFirstChar { it.lowercase() }   // "helloWorld"

// 분리/결합
"a,b,c".split(",")          // ["a", "b", "c"]
"a,b,,c".split(",")         // ["a", "b", "", "c"]
listOf("a", "b", "c").joinToString("-")  // "a-b-c"

// 검사
"kotlin".startsWith("kot")  // true
"kotlin".endsWith("lin")    // true
"kotlin".contains("otl")    // true
"hello".matches(Regex("h.*o"))  // true

// 패딩
"5".padStart(3, '0')   // "005"
"hi".padEnd(5, '.')    // "hi..."
```

---

## 컬렉션 유틸리티

```kotlin
// repeat
repeat(3) { println("반복 $it") }

// generateSequence (이미 27번 시퀀스에서 다룸)

// DeepRecursiveFunction — 스택 오버플로 없는 재귀
val factorial = DeepRecursiveFunction<Long, Long> { n ->
    if (n <= 1) 1L
    else n * callRecursive(n - 1)
}
factorial(100_000L)  // 스택 오버플로 없음
```

---

## Random

```kotlin
import kotlin.random.Random

Random.nextInt()            // 임의 Int
Random.nextInt(10)          // 0..9
Random.nextInt(5, 15)       // 5..14
Random.nextLong()
Random.nextDouble()
Random.nextBoolean()

// 시드 고정 — 재현 가능
val seeded = Random(42)
seeded.nextInt(100)  // 항상 같은 값

// 컬렉션에서 랜덤
listOf(1, 2, 3, 4, 5).random()
listOf(1, 2, 3).shuffled()
```

---

## 기타 유틸리티

```kotlin
// also, let, run, apply, with — 스코프 함수 (28번 참고)

// repeat
repeat(5) { i -> println("$i") }

// swap (Pair)
val pair = 1 to "one"
val swapped = pair.second to pair.first

// comparisons
compareValuesBy(person1, person2, { it.age }, { it.name })

// lazy (18번 프로퍼티에서 다룸)
val expensive by lazy { heavyComputation() }
```

---

## 정리

| 유틸리티 | 함수 | 용도 |
|---------|------|------|
| 전제 조건 | `require`, `check`, `error`, `requireNotNull` | 검증, 상태 확인 |
| 결과 타입 | `runCatching`, `Result<T>` | 예외를 타입으로 |
| 수학 | `abs`, `sqrt`, `coerceIn` | 수치 계산/범위 제한 |
| 시간 | `Duration`, `measureTime` | 시간 측정 |
| 문자열 | `buildString`, `padStart`, `split` | 문자열 가공 |
| 랜덤 | `Random.nextInt`, `shuffled` | 임의 값 |
