---
title: "[Kotlin 시리즈] 20. object, companion object, data object, 익명 객체"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "object", "companion object", "data object", "싱글톤", "익명객체"]
---

# object, companion object, data object, 익명 객체

## object — 싱글톤 선언

`object`로 선언된 클래스는 **선언과 동시에 단일 인스턴스**가 생성됩니다. `new` 없이 바로 사용하고, JVM에서 thread-safe하게 지연 초기화됩니다.

```kotlin
object AppConfig {
    val appName = "MyApp"
    var debug = false
    const val VERSION = "1.0.0"

    fun printInfo() {
        println("$appName v$VERSION (debug=$debug)")
    }
}

AppConfig.appName       // "MyApp"
AppConfig.debug = true
AppConfig.printInfo()   // "MyApp v1.0.0 (debug=true)"
```

### 인터페이스 / 추상 클래스 구현

```kotlin
interface Repository<T> {
    fun findAll(): List<T>
    fun findById(id: Long): T?
}

object InMemoryUserRepository : Repository<User> {
    private val store = mutableMapOf<Long, User>()

    override fun findAll() = store.values.toList()
    override fun findById(id: Long) = store[id]

    fun save(user: User) { store[user.id] = user }
}
```

### object의 상속 관계

```kotlin
open class Comparators {
    open fun compare(a: Int, b: Int) = a - b
}

object NaturalOrder : Comparators() {
    override fun compare(a: Int, b: Int) = a.compareTo(b)
}

// 인터페이스 여러 개 구현 가능
object MultiImpl : Runnable, Callable<String> {
    override fun run() = println("run")
    override fun call() = "called"
}
```

---

## companion object — 동반 객체

클래스에 **귀속된 싱글톤**입니다. Java의 `static` 멤버에 대응하며, 클래스 이름으로 접근합니다.

```kotlin
class User private constructor(val id: Long, val name: String) {
    companion object {
        private var nextId = 1L

        fun create(name: String): User {
            return User(nextId++, name)
        }
    }
}

val user1 = User.create("홍길동")
val user2 = User.create("김철수")
```

### 이름 지정

```kotlin
class Circle(val radius: Double) {
    companion object Factory {
        fun unit() = Circle(1.0)
        fun fromDiameter(diameter: Double) = Circle(diameter / 2)
    }
}

Circle.unit()
Circle.Factory.unit()   // 이름으로도 접근 가능
```

### 인터페이스 구현

```kotlin
interface JsonSerializable<T> {
    fun fromJson(json: String): T
}

class Config(val host: String, val port: Int) {
    companion object : JsonSerializable<Config> {
        override fun fromJson(json: String): Config {
            // 파싱 로직
            return Config("localhost", 8080)
        }
    }
}

val config = Config.fromJson("{...}")
```

### @JvmStatic / @JvmField — Java 호환

```kotlin
class MathUtils {
    companion object {
        @JvmStatic
        fun square(n: Int) = n * n   // Java: MathUtils.square(5)

        @JvmField
        val PI = 3.14159              // Java: MathUtils.PI (getter 없이)

        const val E = 2.71828        // 자동으로 Java static final
    }
}
```

`@JvmStatic` 없이는 Java에서 `MathUtils.Companion.square(5)`로 호출해야 합니다.

### companion object 확장 함수

```kotlin
class MyClass {
    companion object
}

fun MyClass.Companion.create() = MyClass()

MyClass.create()  // 확장 함수를 마치 companion 멤버처럼 호출
```

---

## data object — 데이터 객체 (Kotlin 1.9+)

싱글톤에 `data class`의 `toString`, `equals`, `hashCode`를 추가합니다. 주로 sealed 계층의 **상태 없는 단말 노드**로 사용합니다.

```kotlin
sealed class NetworkResult<out T> {
    data class Success<T>(val data: T) : NetworkResult<T>()
    data class Error(val message: String) : NetworkResult<Nothing>()
    data object Loading : NetworkResult<Nothing>()   // 상태 없음
}

val result: NetworkResult<String> = NetworkResult.Loading

println(result)            // "Loading" (data object 덕분에 의미 있는 toString)
result == NetworkResult.Loading  // true (equals 올바르게 동작)
```

### object vs data object

```kotlin
object RegularSingleton {
    // toString: "RegularSingleton@1a2b3c" (주소 포함)
    // equals: 참조 동등성만
}

data object DataSingleton {
    // toString: "DataSingleton"
    // equals: 같은 타입이면 항상 true (싱글톤이므로)
    // hashCode: 일관된 값
}

println(RegularSingleton)  // RegularSingleton@5f4da5c3
println(DataSingleton)     // DataSingleton
```

### 직렬화 친화적

```kotlin
@Serializable
sealed class AppState {
    @Serializable data object Initial : AppState()
    @Serializable data class Running(val data: String) : AppState()
    @Serializable data object Stopped : AppState()
}
```

---

## 익명 객체 (Anonymous Object)

일회성으로 인터페이스나 추상 클래스를 구현할 때 사용합니다.

```kotlin
val clickListener = object : View.OnClickListener {
    override fun onClick(view: View) {
        println("클릭됨")
    }
}
```

### 타입 없이 선언

```kotlin
val point = object {
    val x = 3
    val y = 4
}

println(point.x)  // 3 — 로컬 스코프에서는 타입 추론으로 접근 가능
```

단, 함수 반환 타입이 `Any`면 멤버에 접근할 수 없습니다.

### 여러 인터페이스 구현

```kotlin
interface Drawable { fun draw() }
interface Resizable { fun resize(factor: Double) }

val widget = object : Drawable, Resizable {
    override fun draw() = println("그리기")
    override fun resize(factor: Double) = println("크기 조정: $factor")
}

widget.draw()
widget.resize(1.5)
```

### 외부 변수 캡처

익명 객체는 람다처럼 외부 변수를 캡처합니다. `var`도 수정할 수 있습니다.

```kotlin
fun makeCounter(start: Int): Runnable {
    var count = start
    return object : Runnable {
        override fun run() {
            println("카운트: ${count++}")
        }
    }
}

val counter = makeCounter(0)
counter.run()  // 카운트: 0
counter.run()  // 카운트: 1
```

---

## 비교 정리

| | `object` | `companion object` | `data object` | 익명 객체 |
|--|---------|------------------|--------------|---------|
| 인스턴스 | 단일 (싱글톤) | 단일 (클래스 귀속) | 단일 (싱글톤) | 1회성 |
| 이름 | 있음 | 선택 | 있음 | 없음 |
| toString | 주소 포함 | 주소 포함 | 클래스명 | 주소 포함 |
| 상속/구현 | 가능 | 가능 | 불가 (sealed 하위) | 가능 |
| 사용 위치 | 최상위/클래스 내 | 클래스 내부만 | 최상위/sealed 내 | 표현식 |

---

## 정리

- **`object`**: 싱글톤 — 선언과 동시에 인스턴스, 인터페이스 구현 가능
- **`companion object`**: 클래스의 정적 멤버 대용, 팩토리 패턴, `@JvmStatic`으로 Java 호환
- **`data object`**: 싱글톤 + 의미 있는 `toString`/`equals` — sealed 계층 단말 노드
- **익명 객체**: `object : Interface { }` — 일회성 구현, 외부 변수 캡처 가능
