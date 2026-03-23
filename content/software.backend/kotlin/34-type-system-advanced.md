---
title: "[Kotlin 시리즈] 34. 타입 시스템 고급 — 스마트 캐스트, typealias, Nothing"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "smart cast", "typealias", "Nothing", "타입별칭", "K2"]
---

# 타입 시스템 고급 — 스마트 캐스트, typealias, Nothing

## 스마트 캐스트 (Smart Cast)

`is` 검사 후 컴파일러가 자동으로 타입을 캐스팅합니다.

```kotlin
fun describe(obj: Any) {
    if (obj is String) {
        println(obj.length)   // String으로 자동 캐스트
        println(obj.uppercase())
    }

    when (obj) {
        is Int    -> println("정수: ${obj + 1}")    // Int로 캐스트
        is String -> println("문자열: ${obj.trim()}")  // String으로 캐스트
        is List<*> -> println("리스트: ${obj.size}")
        else      -> println("알 수 없음: $obj")
    }
}
```

### &&, || 에서도 동작

```kotlin
fun process(obj: Any?) {
    if (obj is String && obj.length > 5) {  // && 이후 String으로 캐스트
        println(obj.uppercase())
    }

    if (obj !is String || obj.length > 5) { // || 이후 String으로 캐스트 (반대)
        return
    }
    println(obj.lowercase())  // 여기서 String
}
```

### 스마트 캐스트 불가 케이스

```kotlin
class Example {
    var value: Any = "hello"  // var — 다른 스레드가 변경 가능

    fun process() {
        if (value is String) {
            // println(value.length)  // 컴파일 에러 — var는 스마트 캐스트 불가
            val v = value  // val로 복사 후 사용
            if (v is String) println(v.length)  // OK
        }
    }
}
```

스마트 캐스트 가능 조건:
- `val` 로컬 변수
- `val` 프로퍼티 (커스텀 getter 없는)
- `lateinit val`

### K2 컴파일러 개선 (Kotlin 2.0)

```kotlin
// Kotlin 2.0 이전 — 람다 내 스마트 캐스트 불가
fun process(obj: Any, condition: Boolean) {
    if (obj is String) {
        if (condition) {
            println(obj.length)  // 2.0 이전: 에러, 2.0 이후: OK
        }
    }
}

// 멤버 함수 내 흐름 분석 개선
class Container(val value: Any) {
    fun validate() = value is String

    fun process() {
        if (validate()) {
            // 2.0: value가 String임을 추론 (멤버 함수 흐름 분석)
        }
    }
}
```

---

## as / as? — 명시적 캐스트

```kotlin
val obj: Any = "hello"

// as — 실패 시 ClassCastException
val str: String = obj as String

// as? — 실패 시 null
val str2: String? = obj as? String
val num: Int? = obj as? Int   // null — String을 Int로 캐스트 불가
```

---

## typealias — 타입 별칭

복잡한 타입에 의미 있는 이름을 부여합니다.

```kotlin
// 함수 타입 별칭
typealias Predicate<T> = (T) -> Boolean
typealias Transform<A, B> = (A) -> B
typealias EventHandler = (event: String, data: Any?) -> Unit

fun filter(list: List<Int>, predicate: Predicate<Int>): List<Int> =
    list.filter(predicate)

// 복잡한 제네릭 타입
typealias UserMap = Map<String, List<User>>
typealias ResultList<T> = List<Result<T>>

// 멀티플랫폼 별칭
typealias OnClick = (View) -> Unit
```

```kotlin
// 의미 있는 이름
typealias Milliseconds = Long
typealias Port = Int
typealias Hostname = String

fun connect(host: Hostname, port: Port, timeout: Milliseconds) { ... }
// connect("localhost", 8080, 5000) — 더 읽기 쉬움
```

주의: `typealias`는 새 타입이 아닙니다. 타입 안전성이 필요하면 `value class`를 사용합니다.

```kotlin
typealias UserId = Long    // UserId와 Long은 완전히 같은 타입 — 혼용 가능
@JvmInline value class UserId(val value: Long)  // 다른 타입 — 컴파일러가 구분
```

---

## Nothing — 정상 반환 없음

`Nothing`은 절대 값을 반환하지 않는 함수의 반환 타입입니다. 모든 타입의 서브타입입니다.

```kotlin
fun fail(message: String): Nothing {
    throw IllegalStateException(message)
}

fun infiniteLoop(): Nothing {
    while (true) { }
}

// TODO — 미구현 마커, 호출 시 NotImplementedError
fun notImplemented(): String = TODO("아직 미구현")
```

### 타입 추론에서의 역할

`Nothing`은 모든 타입의 서브타입이므로, 타입 추론에서 "아무 타입이나 될 수 있음"을 의미합니다.

```kotlin
// when 식의 else가 Nothing 반환 — 타입 추론에 영향
fun getLength(value: Any): Int = when (value) {
    is String -> value.length
    is List<*> -> value.size
    else -> fail("지원하지 않는 타입: ${value::class}")
    // fail()이 Nothing을 반환하므로 else 분기가 Int를 반환하지 않아도 됨
}

// Elvis 연산자와 조합
fun findUser(id: Long): User =
    userMap[id] ?: throw NoSuchElementException("User $id not found")
    // ?: 오른쪽이 Nothing → 전체 표현식은 User 타입
```

### sealed class의 Nothing

```kotlin
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    // Nothing — 값이 없지만 Result<T> 어디든 사용 가능
    data class Failure(val error: String) : Result<Nothing>()
    data object Loading : Result<Nothing>()
}

val result: Result<String> = Result.Failure("오류")  // Result<Nothing>을 Result<String>에 대입 가능
```

---

## 교차 타입 — T & Any

Kotlin 1.7+. nullable 타입 파라미터를 비-nullable로 강제합니다.

```kotlin
// Java에서 온 T는 nullable 여부가 불명확 (플랫폼 타입)
fun <T> processNonNull(value: T & Any): T & Any {
    // value는 반드시 non-null
    return value
}

// 제네릭 경계 표현
fun <T : Any> nonNullable(value: T): T = value  // T는 Any의 서브타입 — non-null
fun <T> nullable(value: T): T = value            // T는 nullable 가능
```

---

## 공변 반환 타입

오버라이드 시 반환 타입을 더 구체적으로 좁힐 수 있습니다.

```kotlin
open class Animal {
    open fun create(): Animal = Animal()
}

class Dog : Animal() {
    override fun create(): Dog = Dog()  // Animal보다 구체적인 Dog 반환 — OK
}

val animal: Animal = Dog()
val created: Animal = animal.create()  // 런타임엔 Dog
```

---

## 타입 별칭 vs value class vs data class

```kotlin
// typealias — 새 타입 아님, 문서화 목적
typealias EmailString = String

// value class — 새 타입, 런타임 오버헤드 최소, 단일 값
@JvmInline value class Email(val value: String)

// data class — 새 타입, 여러 필드, equals/copy/toString
data class EmailAddress(val local: String, val domain: String)
```

---

## 정리

- **스마트 캐스트**: `is` 후 자동 캐스트, `val`에서만 완전히 동작, K2에서 개선
- **`as`**: 강제 캐스트 (실패 시 예외) / **`as?`**: 안전 캐스트 (실패 시 null)
- **`typealias`**: 타입에 별명, 새 타입 아님 — 문서화/가독성 목적
- **`Nothing`**: 절대 반환 안 함, 모든 타입의 서브타입, `throw`/`TODO`/무한루프
- **`T & Any`**: nullable 파라미터를 non-null로 강제 (Kotlin 1.7+)
