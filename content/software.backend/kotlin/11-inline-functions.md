---
title: "[Kotlin 시리즈] 11. inline 함수 — noinline, crossinline, reified"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "inline", "noinline", "crossinline", "reified", "인라인함수"]
---

# inline 함수 — noinline, crossinline, reified

## 왜 inline이 필요한가

고차 함수에는 성능 비용이 있습니다. 람다를 전달할 때마다 **객체가 생성**되고, 함수 호출 오버헤드가 발생합니다.

```kotlin
fun repeat(n: Int, action: () -> Unit) {
    for (i in 0 until n) action()
}

repeat(1000000) { doSomething() }
// 매 호출마다 () -> Unit 객체 생성 — 메모리 압박
```

JVM은 일부를 최적화하지만, 항상 보장되지 않습니다.

---

## inline 함수

`inline`을 붙이면 컴파일러가 **호출 지점에 함수 본문을 복사**합니다. 람다 객체 생성 없음, 함수 호출 없음.

```kotlin
inline fun repeat(n: Int, action: () -> Unit) {
    for (i in 0 until n) action()
}

// 컴파일 후 — 호출 지점에 펼쳐짐
repeat(3) { println("hello") }
// ↓ 실제로는 이렇게 됨
for (i in 0 until 3) println("hello")
```

### 비지역 return이 가능해짐

`inline` 함수에 전달된 람다 안에서 비지역 `return`을 쓸 수 있습니다.

```kotlin
inline fun findFirst(list: List<Int>, predicate: (Int) -> Boolean): Int? {
    for (item in list) {
        if (predicate(item)) return item
    }
    return null
}

fun search(list: List<Int>): Int? {
    list.forEach {
        if (it > 3) return it   // search 함수 자체를 반환 (forEach가 inline이므로)
    }
    return null
}
```

---

## noinline

`inline` 함수의 특정 람다 파라미터를 인라인에서 **제외**합니다.

```kotlin
inline fun execute(
    inlinedAction: () -> Unit,
    noinline storedAction: () -> Unit,   // 인라인 안 됨
) {
    inlinedAction()

    // storedAction은 객체로 저장/전달 가능
    val task = storedAction   // noinline이므로 변수에 저장 가능
    Thread { task() }.start()
}
```

`noinline`이 필요한 경우:
- 람다를 변수에 저장할 때
- 람다를 다른 함수에 비인라인으로 전달할 때

`inline` 람다는 본문이 호출 지점에 삽입되기 때문에 객체로 다룰 수 없습니다.

---

## crossinline

인라인 람다에서 **비지역 return을 금지**합니다. 람다가 다른 실행 컨텍스트(다른 람다, 스레드 등)에서 호출될 때 사용합니다.

```kotlin
inline fun runAsync(crossinline action: () -> Unit) {
    Thread {
        action()   // 다른 스레드에서 실행
        // 여기서 비지역 return이 가능하면 안 됨 — runAsync를 반환할 수 없음
    }.start()
}

fun test() {
    runAsync {
        println("백그라운드")
        // return  // 컴파일 에러 — crossinline이므로 비지역 return 금지
        return@runAsync  // 레이블 return은 OK
    }
}
```

### inline / noinline / crossinline 비교

| | 인라인 여부 | 비지역 return | 변수 저장 |
|--|-----------|-------------|---------|
| 기본 inline 람다 | O | O | X |
| `noinline` | X | X | O |
| `crossinline` | O | X | X |

---

## reified 타입 파라미터

일반 제네릭 함수에서는 런타임에 타입 파라미터가 소거(type erasure)됩니다. `inline` + `reified`를 조합하면 **런타임에 타입을 알 수 있습니다**.

```kotlin
// reified 없이 — 타입 소거로 불가
fun <T> isInstance(value: Any): Boolean {
    return value is T   // 컴파일 에러 — T를 런타임에 알 수 없음
}

// reified — 런타임 타입 접근 가능
inline fun <reified T> isInstance(value: Any): Boolean {
    return value is T   // OK — inline + reified로 타입 정보 유지
}

isInstance<String>("hello")  // true
isInstance<Int>("hello")     // false
```

### 대표 활용 사례

#### 타입 안전한 캐스팅

```kotlin
inline fun <reified T> Any.castOrNull(): T? = this as? T

"hello".castOrNull<String>()  // "hello"
42.castOrNull<String>()       // null
```

#### KClass 파라미터 대체

```kotlin
// reified 없이 — KClass를 인자로 받아야 함
fun <T : Any> createInstance(clazz: KClass<T>): T = clazz.createInstance()
createInstance(MyClass::class)

// reified — 더 깔끔
inline fun <reified T : Any> createInstance(): T = T::class.createInstance()
createInstance<MyClass>()
```

#### JSON 역직렬화

```kotlin
// Gson 활용
inline fun <reified T> Gson.fromJson(json: String): T =
    fromJson(json, T::class.java)   // T::class.java 접근 가능

val user: User = gson.fromJson<User>(jsonString)
// 타입 인자 추론으로 더 간결하게
val user: User = gson.fromJson(jsonString)
```

#### 타입 기반 분기

```kotlin
inline fun <reified T> printType(value: T) {
    when (T::class) {
        Int::class    -> println("정수: $value")
        String::class -> println("문자열: $value")
        else          -> println("기타: $value")
    }
}

printType(42)       // "정수: 42"
printType("hello")  // "문자열: hello"
```

#### filterIsInstance 내부 구현

표준 라이브러리의 `filterIsInstance`도 `reified`로 구현됩니다.

```kotlin
inline fun <reified T> Iterable<*>.filterIsInstance(): List<T> =
    filterIsInstanceTo(mutableListOf())

val mixed: List<Any> = listOf(1, "hello", 2, "world", 3)
val strings = mixed.filterIsInstance<String>()  // ["hello", "world"]
val numbers = mixed.filterIsInstance<Int>()     // [1, 2, 3]
```

---

## inline 사용 시 주의사항

### 코드 크기 증가

인라인은 호출 지점에 코드를 복사하므로 과하면 바이트코드가 커집니다. **람다를 받는 유틸리티 함수**에 적합합니다.

```kotlin
// 적합: 람다를 받는 짧은 유틸리티 함수
inline fun <T> measureTime(block: () -> T): T { ... }

// 부적합: 크고 복잡한 함수 (코드 크기만 증가)
inline fun complexFunction() { /* 수백 줄 */ }
```

### private 멤버 접근 불가

인라인된 람다는 `private` / `internal` 멤버에 접근할 수 없습니다.

```kotlin
class MyClass {
    private val secret = "비밀"

    inline fun expose(block: () -> Unit) {
        block()
        // println(secret)  // OK — 함수 본문은 접근 가능
    }
}

MyClass().expose {
    // println(secret)  // 컴파일 에러 — 람다는 인라인 후 외부 컨텍스트
}
```

---

## 정리

| 키워드 | 역할 |
|--------|------|
| `inline` | 함수/람다를 호출 지점에 복사 — 람다 객체 생성 없음, 비지역 return 가능 |
| `noinline` | 특정 람다 파라미터를 인라인 제외 — 변수 저장/전달 가능 |
| `crossinline` | 비지역 return 금지 — 다른 실행 컨텍스트에서 람다 실행 시 |
| `reified` | 런타임 타입 파라미터 접근 — `T::class`, `value is T` 가능 |

표준 라이브러리의 `map`, `filter`, `forEach` 등이 모두 `inline`입니다. 성능에 민감한 유틸리티 고차 함수를 만들 때 `inline`을 적극 활용하세요.
