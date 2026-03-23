---
title: "[Kotlin 시리즈] 37. 리플렉션 & 애노테이션"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "reflection", "annotation", "KClass", "KFunction", "KProperty"]
---

# 리플렉션 & 애노테이션

## KClass\<T\>

런타임에 클래스 정보를 나타냅니다.

```kotlin
// 클래스 참조 획득
val klass: KClass<String> = String::class
val klass2: KClass<out Any> = "hello"::class  // 인스턴스에서

// 기본 정보
klass.simpleName     // "String"
klass.qualifiedName  // "kotlin.String"
klass.isAbstract     // false
klass.isSealed       // false
klass.isData         // false
klass.objectInstance // null (object가 아니므로)

// object 싱글톤 접근
object MySingleton { val value = 42 }
MySingleton::class.objectInstance?.value  // 42
```

### 인스턴스 생성

```kotlin
data class Point(val x: Int, val y: Int)

// 기본 생성자로 인스턴스 생성
val instance = Point::class.createInstance()  // 기본 생성자 필요

// 생성자 파라미터가 있는 경우
val constructor = Point::class.primaryConstructor!!
val point = constructor.call(3, 4)  // Point(3, 4)

// callBy — 이름으로 파라미터 전달
val params = constructor.parameters.associateWith { param ->
    when (param.name) {
        "x" -> 10
        "y" -> 20
        else -> null
    }
}
constructor.callBy(params)  // Point(10, 20)
```

---

## KFunction

```kotlin
fun add(a: Int, b: Int): Int = a + b

val fn: KFunction2<Int, Int, Int> = ::add

fn.name         // "add"
fn.parameters   // [KParameter(a: Int), KParameter(b: Int)]
fn.returnType   // kotlin.Int

fn.call(3, 4)   // 7 — 타입 검사 없음 (vararg)
fn.invoke(3, 4) // 7 — 타입 안전

// isSuspend
suspend fun asyncFn() {}
::asyncFn.isSuspend  // true
```

---

## KProperty

```kotlin
data class User(val name: String, var age: Int)

val nameProp: KProperty1<User, String> = User::name
val ageProp: KMutableProperty1<User, Int> = User::age

val user = User("홍길동", 30)

nameProp.name         // "name"
nameProp.get(user)    // "홍길동"

ageProp.get(user)     // 30
ageProp.set(user, 31) // age 변경

// 프로퍼티 메타데이터
nameProp.returnType   // kotlin.String
nameProp.visibility   // KVisibility.PUBLIC
```

---

## 애노테이션 읽기

```kotlin
@Target(AnnotationTarget.CLASS, AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.RUNTIME)
annotation class Validate(val message: String = "유효하지 않음")

@Serializable
@Validate("사용자 유효성 검사 실패")
data class User(
    @Validate("이름은 필수") val name: String,
    val age: Int,
)

// 클래스 애노테이션 읽기
val classAnnotation = User::class.findAnnotation<Validate>()
println(classAnnotation?.message)  // "사용자 유효성 검사 실패"

// 프로퍼티 애노테이션 읽기
val nameProp = User::class.memberProperties.find { it.name == "name" }
val propAnnotation = nameProp?.findAnnotation<Validate>()
println(propAnnotation?.message)   // "이름은 필수"

// 모든 애노테이션
User::class.annotations.forEach { println(it) }
```

---

## 실전 패턴

### 리플렉션 기반 유효성 검사

```kotlin
@Target(AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.RUNTIME)
annotation class NotBlank(val field: String = "")

@Target(AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.RUNTIME)
annotation class Min(val value: Int)

@Target(AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.RUNTIME)
annotation class Max(val value: Int)

data class CreateUserRequest(
    @NotBlank("이름") val name: String,
    @Min(0) @Max(150) val age: Int,
    @NotBlank("이메일") val email: String,
)

fun validate(obj: Any): List<String> {
    val errors = mutableListOf<String>()
    val klass = obj::class

    klass.memberProperties.forEach { prop ->
        val value = prop.getter.call(obj)

        prop.findAnnotation<NotBlank>()?.let { ann ->
            if (value is String && value.isBlank()) {
                errors.add("${ann.field.ifBlank { prop.name }}: 비어있을 수 없습니다.")
            }
        }

        if (value is Int) {
            prop.findAnnotation<Min>()?.let { ann ->
                if (value < ann.value) errors.add("${prop.name}: 최솟값은 ${ann.value}입니다.")
            }
            prop.findAnnotation<Max>()?.let { ann ->
                if (value > ann.value) errors.add("${prop.name}: 최댓값은 ${ann.value}입니다.")
            }
        }
    }

    return errors
}

val request = CreateUserRequest("", -1, "invalid")
validate(request).forEach { println(it) }
// 이름: 비어있을 수 없습니다.
// age: 최솟값은 0입니다.
```

### 리플렉션 기반 복사

```kotlin
fun <T : Any> shallowCopy(source: T, overrides: Map<String, Any?> = emptyMap()): T {
    val klass = source::class
    val constructor = klass.primaryConstructor
        ?: error("주 생성자 없음: ${klass.simpleName}")

    val args = constructor.parameters.associateWith { param ->
        if (overrides.containsKey(param.name)) {
            overrides[param.name]
        } else {
            klass.memberProperties
                .find { it.name == param.name }
                ?.getter?.call(source)
        }
    }

    return constructor.callBy(args)
}

data class Config(val host: String, val port: Int, val debug: Boolean)
val original = Config("localhost", 8080, false)
val copy = shallowCopy(original, mapOf("port" to 9090))
// Config(host=localhost, port=9090, debug=false)
```

---

## typeOf — KType 획득

`reified` 없이도 타입 정보를 얻습니다.

```kotlin
import kotlin.reflect.typeOf

val intType = typeOf<Int>()
val listType = typeOf<List<String>>()
val mapType = typeOf<Map<String, List<Int>>>()
val nullableType = typeOf<String?>()

intType.isMarkedNullable    // false
nullableType.isMarkedNullable  // true
listType.arguments          // [TypeProjection(String)]
```

---

## 표준 애노테이션

```kotlin
// @Deprecated — 사용 중단 표시
@Deprecated(
    message = "use newFunction() instead",
    replaceWith = ReplaceWith("newFunction(arg)"),
    level = DeprecationLevel.WARNING,  // WARNING / ERROR / HIDDEN
)
fun oldFunction(arg: String) {}

// @Suppress — 경고 억제
@Suppress("UNCHECKED_CAST", "DEPRECATION")
fun legacyCode() {}

// @OptIn — 실험적 API 사용 선언
@OptIn(ExperimentalCoroutinesApi::class)
fun useExperimentalApi() {}

// @RequiresOptIn — 내 API를 실험적으로 표시
@RequiresOptIn(
    message = "이 API는 실험적입니다.",
    level = RequiresOptIn.Level.WARNING,
)
annotation class ExperimentalMyApi

@ExperimentalMyApi
fun experimentalFeature() {}
```

---

## Java 상호운용 애노테이션

```kotlin
class Service {
    companion object {
        @JvmStatic
        fun create(): Service = Service()  // Java: Service.create()

        @JvmField
        val MAX_CONNECTIONS = 100         // Java: Service.MAX_CONNECTIONS

        @JvmOverloads
        fun connect(host: String = "localhost", port: Int = 8080) {}
        // Java: connect(), connect(host), connect(host, port) 오버로드 생성
    }

    @JvmName("setValueInt")
    fun setValue(value: Int) {}           // JVM 메서드명 변경 (이름 충돌 해결)

    @Throws(IOException::class)
    fun readFile(path: String): String {  // Java checked 예외 선언
        return File(path).readText()
    }
}
```

---

## 정리

**리플렉션**
- `KClass<T>`: 클래스 정보, `::class`, `primaryConstructor`, `memberProperties`
- `KFunction`: 함수 참조, `call()`, `invoke()`, `parameters`
- `KProperty`: 프로퍼티 참조, `get()`, `set()` (mutable)
- `typeOf<T>()`: `reified` 없이 KType 획득

**애노테이션**
- `@Target`, `@Retention`, `@Repeatable` — 메타 애노테이션
- `RUNTIME` retention → `findAnnotation<T>()` 으로 런타임 읽기
- `@Deprecated`, `@Suppress`, `@OptIn` — 표준 애노테이션
- `@JvmStatic`, `@JvmField`, `@JvmOverloads`, `@Throws` — Java 상호운용
