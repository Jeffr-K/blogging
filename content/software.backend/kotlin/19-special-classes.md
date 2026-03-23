---
title: "[Kotlin 시리즈] 19. annotation class, fun interface, inner/nested class"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "annotation", "fun interface", "SAM", "inner class", "nested class"]
---

# annotation class, fun interface, inner/nested class

## annotation class

런타임 또는 컴파일 타임에 코드에 메타데이터를 붙입니다.

### 선언

```kotlin
annotation class Alias(val value: String)
annotation class Range(val min: Int, val max: Int)
annotation class Flags(val flags: Array<String>)
```

`val` 프로퍼티만 가질 수 있으며, 허용 타입은 기본 타입, `String`, `KClass`, 다른 어노테이션, 그 배열입니다.

### 메타 어노테이션

어노테이션의 적용 대상과 보존 범위를 지정합니다.

```kotlin
@Target(AnnotationTarget.CLASS, AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
@MustBeDocumented
annotation class Api(val version: String = "v1")
```

| `@Target` | 적용 대상 |
|-----------|---------|
| `CLASS` | 클래스, 인터페이스, object |
| `FUNCTION` | 함수 |
| `PROPERTY` | 프로퍼티 |
| `VALUE_PARAMETER` | 함수/생성자 파라미터 |
| `FIELD` | 백킹 필드 |

| `@Retention` | 보존 범위 |
|-------------|---------|
| `SOURCE` | 소스 코드만 (컴파일 후 사라짐) |
| `BINARY` | 바이트코드 포함, 리플렉션 불가 |
| `RUNTIME` | 런타임 리플렉션 가능 (기본값) |

### 사용

```kotlin
@Api("v2")
class UserController {
    @Api
    fun getUser(@Alias("uid") id: Long): String = "user-$id"
}

// 리플렉션으로 읽기
val annotation = UserController::class.annotations
    .filterIsInstance<Api>()
    .firstOrNull()
println(annotation?.version)  // "v2"
```

### 실용 예 — 커스텀 검증

```kotlin
@Target(AnnotationTarget.VALUE_PARAMETER, AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.RUNTIME)
annotation class Positive

@Target(AnnotationTarget.VALUE_PARAMETER, AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.RUNTIME)
annotation class MaxLength(val value: Int)

data class CreateUserRequest(
    @MaxLength(50) val name: String,
    @Positive val age: Int,
)
```

---

## fun interface — 함수형 인터페이스 (SAM)

메서드 하나만 있는 인터페이스를 `fun interface`로 선언하면 **람다로 인스턴스화**할 수 있습니다.

### 선언과 사용

```kotlin
fun interface Predicate<T> {
    fun test(value: T): Boolean
}

// 람다로 직접 생성
val isEven = Predicate<Int> { it % 2 == 0 }
val isPositive = Predicate<Int> { it > 0 }

isEven.test(4)     // true
isPositive.test(-1) // false
```

### Java SAM과의 차이

Java의 SAM 인터페이스(`Runnable`, `Callable` 등)는 자동으로 람다 변환이 됩니다. Kotlin 인터페이스는 `fun interface`로 명시해야 합니다.

```kotlin
// Java SAM — 자동 변환
val runnable: Runnable = Runnable { println("run") }
Thread { println("thread") }.start()

// Kotlin fun interface
fun interface Transformer {
    fun transform(input: String): String
}

val upperCase = Transformer { it.uppercase() }
upperCase.transform("hello")  // "HELLO"
```

### 상태를 가진 함수형 인터페이스

```kotlin
fun interface EventHandler {
    fun handle(event: String)
}

class EventBus {
    private val handlers = mutableListOf<EventHandler>()

    fun subscribe(handler: EventHandler) {
        handlers.add(handler)
    }

    fun publish(event: String) {
        handlers.forEach { it.handle(event) }
    }
}

val bus = EventBus()
bus.subscribe { event -> println("Handler 1: $event") }
bus.subscribe { event -> println("Handler 2: $event") }
bus.publish("UserLoggedIn")
// Handler 1: UserLoggedIn
// Handler 2: UserLoggedIn
```

### 고차 함수와 비교

```kotlin
// 고차 함수 — 단순하고 인라인 가능
fun filter(list: List<Int>, predicate: (Int) -> Boolean): List<Int> =
    list.filter(predicate)

// fun interface — 인터페이스 정체성 필요할 때
fun interface Validator<T> {
    fun validate(value: T): Boolean
}

class CompositeValidator<T>(vararg validators: Validator<T>) {
    private val all = validators.toList()
    fun validate(value: T) = all.all { it.validate(value) }
}

val nameValidator = CompositeValidator<String>(
    Validator { it.isNotBlank() },
    Validator { it.length <= 50 },
    Validator { it.all { c -> c.isLetterOrDigit() || c == '_' } }
)
```

---

## nested class — 중첩 클래스

클래스 내부에 선언된 클래스입니다. 기본적으로 **정적** — 외부 클래스 인스턴스 없이 사용할 수 있습니다.

```kotlin
class Outer {
    private val outerValue = 10

    class Nested {
        fun hello() = "중첩 클래스"
        // outerValue에 접근 불가 — 외부 인스턴스가 없음
    }
}

val nested = Outer.Nested()   // Outer 인스턴스 불필요
nested.hello()                 // "중첩 클래스"
```

Java의 `static nested class`에 해당합니다.

---

## inner class — 내부 클래스

`inner` 키워드가 있는 중첩 클래스입니다. **외부 클래스 인스턴스를 참조**할 수 있습니다.

```kotlin
class Outer(private val value: Int) {
    inner class Inner {
        fun show() = "외부 값: $value"   // 외부 인스턴스 참조 가능

        fun labels() {
            println(this@Outer.value)   // 외부 this 명시
            println(this.show())        // 내부 this
        }
    }
}

val outer = Outer(42)
val inner = outer.Inner()    // 외부 인스턴스 필요
inner.show()                  // "외부 값: 42"
```

`inner class`는 외부 인스턴스를 암묵적으로 참조하기 때문에 **메모리 누수**에 주의해야 합니다.

---

## nested vs inner 비교

```kotlin
class Container(val name: String) {
    // nested — 정적, 외부 참조 없음
    class StaticHelper {
        fun help() = "도움말"
    }

    // inner — 외부 인스턴스 참조
    inner class DynamicHelper {
        fun help() = "도움말 from $name"
    }
}

Container.StaticHelper().help()              // "도움말"
Container("box").DynamicHelper().help()      // "도움말 from box"
```

| | `nested class` | `inner class` |
|--|--------------|-------------|
| 외부 참조 | X | O |
| 외부 인스턴스 필요 | X | O |
| 메모리 누수 위험 | 없음 | 있음 |
| Java 대응 | `static class` | 기본 inner class |

---

## 활용 패턴

### Builder 패턴 (nested)

```kotlin
class HttpRequest private constructor(
    val url: String,
    val method: String,
    val headers: Map<String, String>,
    val body: String?,
) {
    class Builder(private val url: String) {
        private var method = "GET"
        private val headers = mutableMapOf<String, String>()
        private var body: String? = null

        fun method(method: String) = apply { this.method = method }
        fun header(key: String, value: String) = apply { headers[key] = value }
        fun body(body: String) = apply { this.body = body }

        fun build() = HttpRequest(url, method, headers.toMap(), body)
    }
}

val request = HttpRequest.Builder("https://api.example.com/users")
    .method("POST")
    .header("Content-Type", "application/json")
    .body("""{"name": "홍길동"}""")
    .build()
```

### 이벤트 리스너 (inner)

```kotlin
class Button(val label: String) {
    inner class ClickListener {
        fun onClick() = println("$label 버튼 클릭!")
    }

    fun createListener() = ClickListener()
}

val btn = Button("확인")
val listener = btn.createListener()
listener.onClick()  // "확인 버튼 클릭!"
```

---

## 정리

**annotation class**
- 메타데이터 붙이기 — `@Target`, `@Retention`으로 적용 범위 제어
- `RUNTIME` retention → 리플렉션으로 읽기 가능

**fun interface**
- 단일 메서드 인터페이스를 람다로 생성 가능
- Java SAM (`Runnable` 등)은 자동 변환, Kotlin 인터페이스는 `fun` 명시 필요

**nested class**
- 기본 정적 — 외부 인스턴스 참조 없음
- 논리적 그룹화, Builder 패턴 등에 활용

**inner class**
- `inner` 키워드 — 외부 인스턴스 암묵적 참조
- `this@Outer`로 외부 this 접근
- 메모리 누수 주의
