---
title: "[Kotlin 시리즈] 23. 프로퍼티 — backing field, lateinit, lazy, 위임"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "property", "backing field", "lateinit", "lazy", "delegate", "by"]
---

# 프로퍼티 — backing field, lateinit, lazy, 위임

## 기본 프로퍼티

```kotlin
class Person {
    val name: String = "홍길동"   // val — getter만
    var age: Int = 30             // var — getter + setter
}
```

### Custom getter / setter

```kotlin
class Circle(val radius: Double) {
    val area: Double
        get() = Math.PI * radius * radius     // 매번 계산

    val diameter: Double
        get() = radius * 2
}
```

```kotlin
class Temperature {
    var celsius: Double = 0.0

    var fahrenheit: Double
        get() = celsius * 9 / 5 + 32
        set(value) { celsius = (value - 32) * 5 / 9 }
}

val t = Temperature()
t.fahrenheit = 98.6
println(t.celsius)   // 37.0
```

### Backing field

setter/getter 안에서 `field`로 실제 저장 값에 접근합니다.

```kotlin
class Account {
    var balance: Long = 0L
        set(value) {
            require(value >= 0) { "잔액은 음수일 수 없습니다." }
            field = value   // field = backing field
        }

    var name: String = ""
        set(value) {
            field = value.trim()   // 저장 전 가공
        }
        get() = field.uppercase()  // 읽을 때 가공
}
```

`field`는 커스텀 getter/setter 안에서만 사용 가능합니다.

### private set

```kotlin
class EventLog {
    private val _events = mutableListOf<String>()
    val events: List<String> get() = _events.toList()  // 읽기 전용 노출

    var lastUpdated: Long = 0L
        private set   // 외부에서 쓰기 금지

    fun addEvent(event: String) {
        _events.add(event)
        lastUpdated = System.currentTimeMillis()
    }
}
```

---

## const val

컴파일 타임 상수입니다. 최상위 또는 `companion object`에 선언합니다.

```kotlin
const val MAX_RETRY = 3
const val BASE_URL = "https://api.example.com"

class ApiClient {
    companion object {
        const val TIMEOUT_MS = 5000L
        const val DEFAULT_VERSION = "v1"
    }
}
```

- 기본 타입 + `String`만 가능
- 리플렉션 없이 컴파일 시 값으로 인라인됨
- Java 에서 `static final`로 노출

---

## lateinit var

선언 시 초기화하지 않고 나중에 초기화하는 프로퍼티입니다.

```kotlin
class UserService {
    lateinit var repository: UserRepository

    fun setup(repo: UserRepository) {
        repository = repo
    }

    fun getUser(id: Long): User {
        check(::repository.isInitialized) { "repository가 초기화되지 않았습니다." }
        return repository.findById(id) ?: throw NotFoundException()
    }
}
```

### 제약

```kotlin
// 불가: val, 기본 타입, nullable
lateinit val x: String        // val 불가
lateinit var n: Int            // 기본 타입 불가
lateinit var s: String?        // nullable 불가
```

### vs by lazy

| | `lateinit var` | `by lazy` |
|--|--------------|---------|
| 변경 가능 | O (`var`) | X (`val`만) |
| 초기화 시점 | 수동 | 첫 접근 시 자동 |
| null 가능 | X | 람다 반환값에 따라 |
| 기본 타입 | X | O |
| 초기화 확인 | `::prop.isInitialized` | 항상 초기화됨 |

---

## by lazy — 지연 초기화

첫 접근 시에만 초기화됩니다. 기본적으로 thread-safe합니다.

```kotlin
class HeavyService {
    val data: List<String> by lazy {
        println("초기화 중...")
        loadFromDatabase()  // 첫 접근 시 한 번만 실행
    }
}

val service = HeavyService()
// 아직 초기화 안 됨
println(service.data)  // "초기화 중..." 출력 후 데이터 반환
println(service.data)  // 초기화 없이 바로 반환
```

### LazyThreadSafetyMode

```kotlin
// SYNCHRONIZED (기본) — 첫 접근 시 동기화, 멀티스레드 안전
val safe by lazy { heavyInit() }

// PUBLICATION — 여러 스레드가 초기화 가능, 먼저 완료된 값 사용
val pub by lazy(LazyThreadSafetyMode.PUBLICATION) { heavyInit() }

// NONE — 동기화 없음, 단일 스레드 환경에서 성능 최적화
val fast by lazy(LazyThreadSafetyMode.NONE) { heavyInit() }
```

---

## 위임 프로퍼티 (Delegated Property)

`by` 키워드로 프로퍼티 읽기/쓰기 로직을 다른 객체에 위임합니다.

```kotlin
class MyDelegate {
    private var value: String = ""

    operator fun getValue(thisRef: Any?, property: KProperty<*>): String {
        println("${property.name} 읽기")
        return value
    }

    operator fun setValue(thisRef: Any?, property: KProperty<*>, newValue: String) {
        println("${property.name} = $newValue")
        value = newValue
    }
}

class Example {
    var text: String by MyDelegate()
}

val e = Example()
e.text = "안녕"   // "text = 안녕"
println(e.text)   // "text 읽기" 후 "안녕"
```

### by observable — 변경 감지

```kotlin
import kotlin.properties.Delegates

class User {
    var name: String by Delegates.observable("초기값") { property, old, new ->
        println("${property.name}: $old → $new")
    }
}

val user = User()
user.name = "홍길동"   // "name: 초기값 → 홍길동"
user.name = "김철수"   // "name: 홍길동 → 김철수"
```

### by vetoable — 변경 거부

```kotlin
var age: Int by Delegates.vetoable(0) { _, _, newValue ->
    newValue >= 0   // false 반환 시 변경 거부
}

age = 25    // 적용됨
age = -1    // 거부됨 — age는 여전히 25
```

### by notNull — lateinit 대안 (기본 타입 가능)

```kotlin
var count: Int by Delegates.notNull()
// count = 0 선언하지 않음

count = 5
println(count)  // 5
// 초기화 전 접근 시 IllegalStateException
```

### by map — Map에서 프로퍼티 읽기

```kotlin
class Config(private val map: Map<String, Any?>) {
    val host: String by map
    val port: Int by map
    val debug: Boolean by map
}

val config = Config(mapOf(
    "host" to "localhost",
    "port" to 8080,
    "debug" to true,
))

config.host   // "localhost"
config.port   // 8080
```

### provideDelegate — 위임 생성 시 검증

```kotlin
class ValidatedDelegate(private val regex: Regex) {
    operator fun getValue(thisRef: Any?, property: KProperty<*>) = ""
    operator fun setValue(thisRef: Any?, property: KProperty<*>, value: String) {
        require(value.matches(regex)) { "${property.name}: '$value' 형식 오류" }
    }

    operator fun provideDelegate(thisRef: Any?, property: KProperty<*>): ValidatedDelegate {
        println("위임 초기화: ${property.name} (패턴: $regex)")
        return this
    }
}

fun validated(pattern: String) = ValidatedDelegate(Regex(pattern))

class Form {
    var email: String by validated("[^@]+@[^@]+\\.[^@]+")
    var phone: String by validated("\\d{10,11}")
}
```

### ReadOnlyProperty / ReadWriteProperty 인터페이스

```kotlin
import kotlin.properties.ReadOnlyProperty
import kotlin.properties.ReadWriteProperty
import kotlin.reflect.KProperty

class CachedProperty<T>(private val compute: () -> T) : ReadOnlyProperty<Any?, T> {
    private var cached: T? = null

    override fun getValue(thisRef: Any?, property: KProperty<*>): T {
        if (cached == null) cached = compute()
        return cached!!
    }
}

fun <T> cached(compute: () -> T) = CachedProperty(compute)

class Report {
    val summary: String by cached {
        println("계산 중...")
        "요약 결과"
    }
}
```

---

## 실용 패턴

### 설정 바인딩

```kotlin
class AppSettings(private val props: Properties) {
    val serverHost: String by props.required("server.host")
    val serverPort: Int by props.required<Int>("server.port")
    val debugMode: Boolean by props.optional("debug.mode", false)
}
```

### 변경 이력 추적

```kotlin
class Auditable {
    private val changes = mutableListOf<String>()

    var status: String by Delegates.observable("DRAFT") { prop, old, new ->
        changes.add("${prop.name}: $old → $new at ${System.currentTimeMillis()}")
    }

    fun getHistory() = changes.toList()
}
```

### 환경 변수 위임

```kotlin
class EnvDelegate(private val key: String, private val default: String = "") :
    ReadOnlyProperty<Any?, String> {
    override fun getValue(thisRef: Any?, property: KProperty<*>) =
        System.getenv(key) ?: default
}

fun env(key: String, default: String = "") = EnvDelegate(key, default)

object AppEnv {
    val databaseUrl: String by env("DATABASE_URL", "jdbc:h2:mem:test")
    val port: String by env("PORT", "8080")
    val secret: String by env("APP_SECRET")
}
```

---

## 정리

- **Custom getter/setter + `field`**: 접근/저장 시 로직 추가
- **`const val`**: 컴파일 타임 상수, 최상위/companion만
- **`lateinit var`**: 나중 수동 초기화, 기본 타입 불가
- **`by lazy`**: 첫 접근 시 자동 초기화, 기본적으로 thread-safe
- **`by observable`**: 변경 감지 콜백
- **`by vetoable`**: 조건부 변경 거부
- **`by map`**: Map을 프로퍼티 저장소로
- **`provideDelegate`**: 위임 생성 시 추가 검증/설정
