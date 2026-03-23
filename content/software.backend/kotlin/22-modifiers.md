---
title: "[Kotlin 시리즈] 22. 수정자(Modifier) 키워드 완전 정리"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "modifier", "visibility", "open", "abstract", "sealed", "inline", "suspend"]
---

# 수정자(Modifier) 키워드 완전 정리

## 가시성 수정자

| 수정자 | 클래스 멤버 | 최상위 선언 |
|-------|-----------|-----------|
| `public` | 모든 곳 (기본값) | 모든 곳 (기본값) |
| `private` | 클래스 내부만 | 같은 파일만 |
| `protected` | 클래스 + 서브클래스 | 최상위에서 사용 불가 |
| `internal` | 같은 모듈 | 같은 모듈 |

```kotlin
class Account {
    public val id: Long = 0L          // 기본값, public 생략 가능
    private var balance: Long = 0L    // 클래스 내부만
    protected val owner: String = ""  // 서브클래스까지
    internal val branch: String = ""  // 같은 모듈
}

private fun helper() {}    // 같은 파일 내에서만
internal fun internal() {} // 같은 모듈에서
```

### private set

```kotlin
class Counter {
    var count: Int = 0
        private set  // 외부에서 읽기만 가능, 쓰기는 클래스 내부

    fun increment() { count++ }
}

val counter = Counter()
counter.increment()
println(counter.count)  // 읽기 OK
// counter.count = 5    // 컴파일 에러
```

---

## 상속 수정자

### final (기본값)

모든 클래스와 멤버는 기본적으로 `final`입니다.

```kotlin
class Animal        // final — 상속 불가
fun move() {}      // final — 오버라이드 불가
val name = "동물"  // final — 오버라이드 불가
```

### open

상속 또는 오버라이드를 허용합니다.

```kotlin
open class Vehicle {
    open val maxSpeed: Int = 100
    open fun describe() = "탈것"
    fun fuelType() = "미정"  // open 없음 — 오버라이드 불가
}

class Car : Vehicle() {
    override val maxSpeed = 200
    override fun describe() = "자동차"
}
```

### abstract

구현 없이 선언만 합니다. 반드시 서브클래스에서 구현해야 합니다.

```kotlin
abstract class Animal {
    abstract val name: String
    abstract fun sound(): String

    fun breathe() = "$name 숨쉬기"  // 공통 구현
}

class Dog : Animal() {
    override val name = "개"
    override fun sound() = "멍멍"
}
```

### override

부모 클래스 또는 인터페이스의 멤버를 재정의합니다. `override`된 멤버는 기본적으로 `open`입니다.

```kotlin
open class Base {
    open fun hello() = "Base"
}

open class Middle : Base() {
    override fun hello() = "Middle"      // 여전히 open
    final override fun toString() = "Middle"  // 이후 오버라이드 금지
}

class Child : Middle() {
    override fun hello() = "Child"       // 가능
    // override fun toString() = "Child" // 컴파일 에러 — final
}
```

### sealed

하위 클래스를 같은 패키지/모듈로 제한합니다. `when` 완전성 검사를 가능하게 합니다.

```kotlin
sealed class Result<out T>
data class Success<T>(val data: T) : Result<T>()
data class Failure(val error: String) : Result<Nothing>()
```

---

## 클래스 수정자

### data

`equals`, `hashCode`, `toString`, `copy`, `componentN`을 자동 생성합니다.

```kotlin
data class Point(val x: Int, val y: Int)
```

### inner

외부 클래스 인스턴스를 암묵적으로 참조합니다.

```kotlin
class Outer(val x: Int) {
    inner class Inner {
        fun getX() = x  // 외부 x 접근
    }
}
```

### value

단일 프로퍼티 래퍼 클래스. `@JvmInline`과 함께 사용해야 합니다.

```kotlin
@JvmInline
value class UserId(val value: Long)
```

### enum

열거형 클래스입니다.

```kotlin
enum class Direction { NORTH, SOUTH, EAST, WEST }
```

### annotation

어노테이션 클래스입니다.

```kotlin
@Target(AnnotationTarget.FUNCTION)
annotation class Log(val level: String = "INFO")
```

---

## 함수 / 프로퍼티 수정자

### const

컴파일 타임 상수. 최상위 또는 `companion object`에서만 사용 가능합니다.

```kotlin
const val MAX_SIZE = 100          // 최상위
class Config {
    companion object {
        const val DEFAULT_PORT = 8080
    }
}
```

- 기본 타입 또는 `String`만 가능
- 리플렉션 없이 인라인됨

### lateinit

선언 시 초기화하지 않는 `var` 프로퍼티. `null` 없이 나중에 초기화합니다.

```kotlin
class Service {
    lateinit var repository: Repository

    fun init(repo: Repository) {
        repository = repo
    }

    fun process() {
        if (::repository.isInitialized) {
            repository.find()
        }
    }
}
```

- `val` 불가, 기본 타입 불가, nullable 불가
- 초기화 전 접근 시 `UninitializedPropertyAccessException`

### operator

연산자 오버로딩을 허용합니다.

```kotlin
data class Vector(val x: Int, val y: Int) {
    operator fun plus(other: Vector) = Vector(x + other.x, y + other.y)
    operator fun get(index: Int) = if (index == 0) x else y
    operator fun invoke(scale: Int) = Vector(x * scale, y * scale)
}

val v = Vector(1, 2)
v + Vector(3, 4)   // Vector(4, 6)
v[0]               // 1
v(3)               // Vector(3, 6)
```

### infix

단일 파라미터 함수를 중위 표기로 호출할 수 있습니다.

```kotlin
infix fun Int.power(exp: Int): Int = Math.pow(toDouble(), exp.toDouble()).toInt()

2 power 10  // 1024
```

### inline

함수 본문을 호출 지점에 복사합니다. 람다 객체 생성이 없어집니다.

```kotlin
inline fun <T> measureTime(block: () -> T): T {
    val start = System.currentTimeMillis()
    return block().also {
        println("${System.currentTimeMillis() - start}ms")
    }
}
```

### noinline

`inline` 함수 내 특정 람다를 인라인에서 제외합니다.

```kotlin
inline fun execute(inlined: () -> Unit, noinline stored: () -> Unit) {
    inlined()
    val task = stored   // 변수에 저장 가능
    Thread { task() }.start()
}
```

### crossinline

인라인 람다에서 비지역 `return`을 금지합니다.

```kotlin
inline fun runLater(crossinline action: () -> Unit) {
    Thread { action() }.start()
    // action 안에서 return 불가 — 어느 함수로 반환해야 할지 모름
}
```

### tailrec

꼬리 재귀를 반복문으로 컴파일합니다. 스택 오버플로를 방지합니다.

```kotlin
tailrec fun sum(n: Long, acc: Long = 0): Long =
    if (n <= 0) acc
    else sum(n - 1, acc + n)

sum(1_000_000L)  // 스택 오버플로 없음
```

### suspend

코루틴 내에서만 호출 가능한 함수입니다. 일시 중단 지점을 가집니다.

```kotlin
suspend fun fetchData(url: String): String {
    delay(1000)  // 비블로킹 대기
    return "data"
}
```

### external

플랫폼 외부(JavaScript, Native C)에서 구현되는 함수입니다.

```kotlin
// Kotlin/JS
external fun alert(message: String)

// Kotlin/Native
external fun strlen(str: CPointer<ByteVar>): Int
```

---

## 타입 파라미터 수정자

### reified

`inline` 함수에서 타입 파라미터를 런타임에 접근할 수 있게 합니다.

```kotlin
inline fun <reified T> isInstance(value: Any) = value is T
inline fun <reified T> List<*>.filterAs() = filterIsInstance<T>()

isInstance<String>("hello")  // true
listOf(1, "a", 2, "b").filterAs<String>()  // ["a", "b"]
```

### out (공변)

타입 파라미터를 생산자 위치(반환)에만 사용합니다. 리스코프 치환 원칙에 따라 상위 타입에 할당 가능합니다.

```kotlin
interface Producer<out T> {
    fun produce(): T
}

val intProducer: Producer<Int> = object : Producer<Int> {
    override fun produce() = 42
}
val numProducer: Producer<Number> = intProducer  // Int는 Number의 서브타입
```

### in (반변)

타입 파라미터를 소비자 위치(파라미터)에만 사용합니다.

```kotlin
interface Consumer<in T> {
    fun consume(value: T)
}

val numConsumer: Consumer<Number> = object : Consumer<Number> {
    override fun consume(value: Number) = println(value)
}
val intConsumer: Consumer<Int> = numConsumer  // Number를 받는 곳에 Int도 가능
```

---

## 멀티플랫폼 수정자

### expect / actual

공통 코드에서 플랫폼별 구현을 요구합니다.

```kotlin
// commonMain
expect fun platformName(): String
expect class Platform() {
    val name: String
}

// jvmMain
actual fun platformName() = "JVM ${System.getProperty("java.version")}"
actual class Platform actual constructor() {
    actual val name = "JVM"
}

// jsMain
actual fun platformName() = "JavaScript"
actual class Platform actual constructor() {
    actual val name = "JS"
}
```

---

## 조합 예시

```kotlin
abstract class BaseRepository<T> {
    abstract suspend fun findById(id: Long): T?
    abstract suspend fun save(entity: T): T

    open suspend fun findAll(): List<T> = emptyList()
}

sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val code: Int, val message: String) : ApiResult<Nothing>()
    data object Loading : ApiResult<Nothing>()
}

@JvmInline
value class PageSize(val value: Int) {
    init { require(value in 1..100) }
}

inline fun <reified T> Any.tryCast(): T? = this as? T
```

---

## 정리

| 분류 | 수정자 | 핵심 역할 |
|------|--------|---------|
| 가시성 | `public`, `private`, `protected`, `internal` | 접근 범위 제어 |
| 상속 | `final`, `open`, `abstract`, `override`, `sealed` | 계층 제어 |
| 클래스 | `data`, `inner`, `value`, `enum`, `annotation` | 클래스 종류 |
| 함수 | `const`, `lateinit`, `operator`, `infix` | 호출 방식 |
| 인라인 | `inline`, `noinline`, `crossinline` | 컴파일 최적화 |
| 기타 함수 | `tailrec`, `suspend`, `external` | 실행 방식 |
| 제네릭 | `reified`, `out`, `in` | 타입 파라미터 |
| KMP | `expect`, `actual` | 멀티플랫폼 |
