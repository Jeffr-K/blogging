---
title: "[Kotlin 시리즈] 39. Kotlin 2.0 신기능"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "kotlin 2.0", "K2", "when guard", "data object", "멀티달러보간"]
---

# Kotlin 2.0 신기능

## K2 컴파일러

### 컴파일 속도

K2는 FIR(Frontend Intermediate Representation) 아키텍처로 재설계되었습니다. 대형 프로젝트에서 최대 2배 빠른 컴파일 속도를 제공합니다.

```kotlin
// build.gradle.kts — K2 활성화 (Kotlin 2.0은 기본)
kotlin {
    compilerOptions {
        languageVersion.set(KotlinVersion.KOTLIN_2_0)
    }
}
```

### 스마트 캐스트 개선

```kotlin
// 1. 람다 내 스마트 캐스트
fun processAll(items: List<Any>) {
    items.forEach { item ->
        if (item is String) {
            println(item.uppercase())  // 2.0 이전: 에러 / 2.0: OK
        }
    }
}

// 2. 로컬 함수 내 스마트 캐스트
fun process(value: Any) {
    fun helper() {
        if (value is String) {
            println(value.length)  // 2.0: OK
        }
    }
    helper()
}

// 3. try-catch 후 스마트 캐스트
var x: Int? = null
try {
    x = parseInt()
} catch (e: Exception) {
    x = 0
}
println(x + 1)  // 2.0: x는 Int (항상 non-null이 확정됨)
```

---

## when 가드 조건 (Guard Conditions)

`when` 브랜치에 `if` 조건을 추가합니다. 타입 매칭 + 값 조건을 함께 쓸 때 유용합니다.

```kotlin
sealed class Expr {
    data class Num(val value: Int) : Expr()
    data class Div(val left: Expr, val right: Expr) : Expr()
}

fun eval(expr: Expr): Int = when (expr) {
    is Expr.Num -> expr.value
    is Expr.Div if expr.right is Expr.Num && (expr.right as Expr.Num).value == 0 ->
        error("0으로 나눌 수 없습니다.")
    is Expr.Div -> eval(expr.left) / eval(expr.right as Expr.Num).value
}

// 더 실용적인 예
fun classify(value: Any): String = when (value) {
    is Int if value < 0   -> "음수 정수"
    is Int if value == 0  -> "영"
    is Int if value > 0   -> "양수 정수"
    is String if value.isEmpty() -> "빈 문자열"
    is String             -> "문자열: $value"
    else                  -> "기타"
}
```

---

## 비지역 break/continue in inline lambda (2.0)

`inline` 함수의 람다에서 `break`/`continue`를 사용할 수 있습니다.

```kotlin
inline fun forEachIndexed(list: List<Int>, action: (Int, Int) -> Unit) {
    for ((index, value) in list.withIndex()) {
        action(index, value)
    }
}

fun findFirst(list: List<Int>): Int? {
    var result: Int? = null
    for (item in list) {
        forEachIndexed(listOf(1, 2, 3)) { _, v ->
            if (v == item) {
                result = v
                break   // 2.0: inline lambda에서 break 가능
            }
        }
    }
    return result
}
```

---

## 멀티 달러 문자열 보간 (`$$`)

`$` 자체를 문자열에 포함할 때 이스케이프 없이 처리합니다.

```kotlin
// 기존 — $ 출력 시 불편
val template = "가격: \$${price}원"
val template2 = "가격: ${'$'}${price}원"

// Kotlin 2.0 — $$ 접두사로 보간 시작 기호 변경
val template3 = $$"가격: $${price}원"   // 하나의 $ 출력
// $$로 시작하면 $${ }만 보간으로 인식, 단일 $는 리터럴

// 실전 — GraphQL, 쉘 스크립트, 정규식
val graphql = $$"""
    query GetUser($$userId: ID!) {
        user(id: $${userId}) {
            name
            email
        }
    }
""".trimIndent()
```

---

## data object (Kotlin 1.9 → 2.0 안정화)

`data class`의 `toString`/`equals`/`hashCode`를 `object`에 적용합니다.

```kotlin
// 이전 — object의 toString은 주소 포함
object OldSingleton
println(OldSingleton)  // OldSingleton@1a2b3c4d

// data object — 의미 있는 toString
data object NewSingleton
println(NewSingleton)  // NewSingleton

// sealed 계층에서 단말 노드
sealed class AppState {
    data object Loading : AppState()
    data class Success(val data: String) : AppState()
    data class Error(val message: String) : AppState()
}

// 직렬화 시 동작
@Serializable
sealed class Result {
    @Serializable data object Loading : Result()
    @Serializable data class Success(val data: String) : Result()
}
```

---

## enum entries (Kotlin 1.9 → 2.0 안정화)

`values()` 대신 `entries` 사용.

```kotlin
enum class Direction { NORTH, SOUTH, EAST, WEST }

// 구식 (deprecated)
Direction.values()  // 매 호출마다 배열 복사

// 신식 (권장)
Direction.entries   // 불변 List, 복사 없음

Direction.entries.forEach { println(it) }
Direction.entries.filter { it != Direction.NORTH }
```

---

## @SubclassOptInRequired (Kotlin 2.0)

실험적 클래스/인터페이스를 확장하려면 옵트인을 요구합니다.

```kotlin
@RequiresOptIn(
    "이 인터페이스는 실험적입니다. 구현 시 @OptIn 필요.",
    RequiresOptIn.Level.WARNING,
)
annotation class ExperimentalApi

@SubclassOptInRequired(ExperimentalApi::class)
interface ExperimentalService {
    fun execute()
}

// 구현 시 OptIn 필요
@OptIn(ExperimentalApi::class)
class ConcreteService : ExperimentalService {
    override fun execute() { println("실행") }
}
```

---

## KMP 안정화

### Kotlin/Wasm 베타

```kotlin
// build.gradle.kts — Wasm 타겟 추가
kotlin {
    wasmJs {
        browser()
    }

    sourceSets {
        val wasmJsMain by getting {
            dependencies {
                implementation(kotlin("stdlib-wasm-js"))
            }
        }
    }
}
```

### 공통 코드에서 플랫폼별 구현

```kotlin
// commonMain
expect fun getPlatformName(): String

// jvmMain
actual fun getPlatformName() = "JVM ${System.getProperty("java.version")}"

// jsMain
actual fun getPlatformName() = "JavaScript ${js("typeof window !== 'undefined' ? 'Browser' : 'Node.js'")}"

// wasmJsMain
actual fun getPlatformName() = "WebAssembly"
```

---

## 컴파일러 옵션 변경 (2.0)

```kotlin
// build.gradle.kts — 새 API
kotlin {
    compilerOptions {
        // 이전: freeCompilerArgs.add("-Xopt-in=...")
        optIn.add("kotlin.RequiresOptIn")

        // JVM 타겟
        jvmTarget.set(JvmTarget.JVM_17)

        // 언어 버전
        languageVersion.set(KotlinVersion.KOTLIN_2_0)
        apiVersion.set(KotlinVersion.KOTLIN_2_0)

        // 실험적 기능
        freeCompilerArgs.addAll(
            "-Xcontext-receivers",
            "-Xcontext-parameters",  // 2.2+
        )
    }
}
```

---

## Power-assert 플러그인 (Kotlin 2.0)

테스트 실패 시 표현식의 중간값을 자동으로 보여줍니다.

```kotlin
// build.gradle.kts
plugins {
    kotlin("plugin.power-assert") version "2.0.0"
}

powerAssert {
    functions = listOf("kotlin.assert", "kotlin.test.assertEquals")
}

// 테스트 코드
val user = User("홍길동", 25)
assert(user.age > 30)
// 실패 시:
// assert(user.age > 30)
//        |    |   |
//        |    25  false
//        User(name=홍길동, age=25)
```

---

## 정리

| 기능 | 버전 | 핵심 |
|------|------|------|
| K2 컴파일러 | 2.0 stable | 최대 2배 빠른 컴파일, 스마트 캐스트 개선 |
| `when` 가드 조건 | 2.0 | `is Type if condition ->` |
| 비지역 break/continue | 2.0 | inline lambda에서 사용 가능 |
| `$$` 멀티달러 보간 | 2.0 | `$` 리터럴 편의 |
| `data object` | 1.9 stable | 의미 있는 toString/equals |
| `enum.entries` | 1.9 stable | `values()` 대체, 불변 리스트 |
| `@SubclassOptInRequired` | 2.0 | 실험적 클래스 확장 제어 |
| Power-assert 플러그인 | 2.0 | 테스트 실패 표현식 자동 출력 |
| Kotlin/Wasm | 2.0 beta | WebAssembly 지원 |
