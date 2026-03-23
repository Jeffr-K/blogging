---
title: "[Kotlin 시리즈] 25. 제네릭 & 변성"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "generics", "variance", "out", "in", "reified", "타입파라미터", "변성"]
---

# 제네릭 & 변성

## 제네릭 기초

### 제네릭 클래스

```kotlin
class Box<T>(val value: T) {
    fun get(): T = value
    fun <R> transform(f: (T) -> R): Box<R> = Box(f(value))
}

val intBox = Box(42)
val strBox = Box("hello")
val mapped = intBox.transform { it.toString() }  // Box<String>
```

### 제네릭 함수

```kotlin
fun <T> singletonList(item: T): List<T> = listOf(item)

fun <T, R> List<T>.mapTo(transform: (T) -> R): List<R> =
    map(transform)

// 타입 추론 — 명시 불필요
singletonList(42)          // List<Int>
singletonList("kotlin")    // List<String>
```

### 타입 파라미터 제약

상한(upper bound)으로 타입을 제한합니다.

```kotlin
fun <T : Comparable<T>> max(a: T, b: T): T = if (a >= b) a else b

max(3, 5)         // 5
max("a", "z")     // "z"
// max(listOf(1), listOf(2))  // 컴파일 에러 — List는 Comparable 아님
```

### 다중 제약 (where)

```kotlin
fun <T> copyAndLog(list: List<T>): List<T>
        where T : Serializable, T : Comparable<T> {
    println(list.sorted())
    return list.toList()
}
```

### Nullable 제약

```kotlin
fun <T : Any> requireNonNull(value: T?): T =
    value ?: throw NullPointerException()

// T : Any? — null 허용 (기본값과 동일)
fun <T> identity(value: T): T = value
```

---

## 변성 (Variance)

### 무변 (Invariant) — 기본

```kotlin
class MutableBox<T>(var value: T)

// MutableBox<Int>는 MutableBox<Number>의 서브타입이 아님
val intBox = MutableBox(42)
// val numBox: MutableBox<Number> = intBox  // 컴파일 에러
```

읽기 + 쓰기 모두 필요하면 무변이어야 합니다. 쓰기를 허용하면 타입 안전성이 깨집니다.

### 공변 out — 생산자 (읽기 전용)

`out T`로 선언하면 `Producer<Int>`를 `Producer<Number>`에 할당할 수 있습니다.

```kotlin
interface Producer<out T> {
    fun produce(): T
    // fun consume(item: T) {}  // out 위치에서 소비 불가 — 컴파일 에러
}

class IntProducer : Producer<Int> {
    override fun produce() = 42
}

val intProducer: Producer<Int> = IntProducer()
val numProducer: Producer<Number> = intProducer  // OK — Int는 Number의 서브타입
```

표준 라이브러리의 `List<out E>`, `Sequence<out T>`가 공변입니다.

```kotlin
val ints: List<Int> = listOf(1, 2, 3)
val nums: List<Number> = ints  // OK — List는 out 공변
```

### 반변 in — 소비자 (쓰기 전용)

`in T`로 선언하면 `Consumer<Number>`를 `Consumer<Int>`에 할당할 수 있습니다.

```kotlin
interface Consumer<in T> {
    fun consume(item: T)
    // fun produce(): T {}  // in 위치에서 생산 불가 — 컴파일 에러
}

class NumberConsumer : Consumer<Number> {
    override fun consume(item: Number) = println(item)
}

val numConsumer: Consumer<Number> = NumberConsumer()
val intConsumer: Consumer<Int> = numConsumer  // OK — Number 소비자는 Int도 소비 가능
```

표준 라이브러리의 `Comparator<in T>`가 반변입니다.

### 생산자 + 소비자 패턴

```kotlin
fun <T> copy(from: List<out T>, to: MutableList<in T>) {
    for (item in from) {
        to.add(item)
    }
}

val ints = listOf(1, 2, 3)
val nums = mutableListOf<Number>()
copy(ints, nums)  // from: List<Int>, to: MutableList<Number> — OK
```

---

## 사용 지점 변성 (Use-site Variance)

선언 지점 변성이 없는 타입에 호출 지점에서 변성을 지정합니다.

```kotlin
// Array는 무변 (Array<T>)
fun <T> fillWith(arr: Array<in T>, value: T) {
    for (i in arr.indices) arr[i] = value
}

fun <T> copyFrom(arr: Array<out T>): List<T> = arr.toList()

val ints = Array(5) { 0 }
fillWith(ints, 42)           // Array<in Int>

val nums: Array<Number> = Array(3) { 0.0 }
val list = copyFrom(nums)    // Array<out Number>
```

---

## 스타 프로젝션 (`*`)

타입 파라미터를 알 수 없을 때 사용합니다.

```kotlin
fun printList(list: List<*>) {
    list.forEach { println(it) }   // Any?로 접근
}

fun printBox(box: Box<*>) {
    println(box.get())  // Any?로만 읽기 가능
}

// 타입 검사
val list: List<*> = listOf(1, 2, 3)
if (list is List<*>) println("리스트임")
```

- `List<*>` = `List<out Any?>` — 읽기만 가능, 타입은 `Any?`
- `MutableList<*>` = 읽기 가능, 쓰기 불가

---

## reified — 런타임 타입 접근

일반 제네릭 함수에서는 런타임에 타입이 소거됩니다. `inline` + `reified`로 타입 정보를 유지합니다.

```kotlin
// 타입 소거 — 컴파일 에러
fun <T> isType(value: Any): Boolean = value is T

// reified — 런타임 타입 접근
inline fun <reified T> isType(value: Any): Boolean = value is T
inline fun <reified T> cast(value: Any): T? = value as? T
inline fun <reified T> List<*>.filterAs(): List<T> = filterIsInstance<T>()

isType<String>("hello")      // true
isType<Int>("hello")         // false
cast<Int>(42)                // 42
cast<String>(42)             // null

val mixed: List<Any> = listOf(1, "a", 2, "b")
mixed.filterAs<String>()     // ["a", "b"]
```

### KClass 파라미터 대체

```kotlin
// 구식 — KClass 전달 필요
fun <T : Any> createInstance(clazz: KClass<T>): T = clazz.createInstance()
createInstance(MyClass::class)

// reified — 깔끔
inline fun <reified T : Any> createInstance(): T = T::class.createInstance()
createInstance<MyClass>()
```

### 타입 기반 JSON 역직렬화

```kotlin
inline fun <reified T> fromJson(json: String): T =
    ObjectMapper().readValue(json, T::class.java)

val user: User = fromJson("""{"name": "홍길동", "age": 30}""")
```

---

## typeOf — KType 획득

`reified` 없이도 타입 정보를 얻을 수 있습니다.

```kotlin
import kotlin.reflect.typeOf

val intType = typeOf<Int>()
val listType = typeOf<List<String>>()
val nullableType = typeOf<String?>()

println(intType)       // kotlin.Int
println(listType)      // kotlin.collections.List<kotlin.String>
println(nullableType)  // kotlin.String?
```

---

## 확정 비-nullable 타입 (`T & Any`)

Kotlin 1.7+. Java 상호운용에서 nullable 타입 파라미터를 비-nullable로 만듭니다.

```kotlin
// Java 메서드: <T> T process(T value)
// T는 플랫폼 타입 — nullable 여부 불명확

fun <T : Any> processNonNull(value: T & Any): T & Any {
    println(value)  // null 불가 보장
    return value
}
```

---

## 변성 요약

```
공변 out T  — 생산자, 읽기만, Producer<Int>를 Producer<Number>에 대입 가능
반변 in T   — 소비자, 쓰기만, Consumer<Number>를 Consumer<Int>에 대입 가능
무변        — 읽기+쓰기, 정확히 같은 타입만

PECS 원칙 (Producer Extends, Consumer Super)
  생산자 → out (공변)
  소비자 → in (반변)
```

---

## 정리

- **제네릭 클래스/함수**: `<T>` — 타입 파라미터, 타입 안전성 + 재사용성
- **상한 제약**: `<T : Comparable<T>>` — T는 반드시 Comparable 구현
- **다중 제약**: `where T : A, T : B`
- **공변 `out`**: 생산자, 서브타입 관계 유지 (`List<Int>` → `List<Number>`)
- **반변 `in`**: 소비자, 역방향 (`Consumer<Number>` → `Consumer<Int>`)
- **스타 프로젝션 `*`**: 타입 모를 때, 읽기만 가능
- **`reified`**: `inline` 함수에서 런타임 타입 접근, 타입 소거 우회
