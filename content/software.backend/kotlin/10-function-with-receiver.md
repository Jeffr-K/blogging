---
title: "[Kotlin 시리즈] 10. 수신 객체 지정 람다"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "수신객체", "람다", "DSL", "function with receiver"]
---

# 수신 객체 지정 람다 (Function with Receiver)

수신 객체 지정 람다는 **람다 안에서 특정 객체의 멤버에 `this.` 없이 접근**할 수 있게 합니다. DSL과 빌더 패턴의 기반이 됩니다.

## 일반 람다 vs 수신 객체 지정 람다

```kotlin
// 일반 람다 — it으로 접근
val action: (StringBuilder) -> Unit = { sb ->
    sb.append("Hello")
    sb.append(", World!")
}

// 수신 객체 지정 람다 — this로 (생략 가능)
val action2: StringBuilder.() -> Unit = {
    append("Hello")         // this.append(...) 생략
    append(", World!")
}
```

`StringBuilder.() -> Unit`은 "StringBuilder를 수신 객체로 받아 Unit을 반환하는 람다"입니다.

---

## 함수 타입 표기

```kotlin
// 수신 객체 지정 함수 타입
TypeName.() -> ReturnType
TypeName.(Param) -> ReturnType
TypeName.(Param1, Param2) -> ReturnType
```

예시:

```kotlin
val greet: String.() -> String = { "Hello, $this!" }
val add: Int.(Int) -> Int = { other -> this + other }

"Kotlin".greet()  // "Hello, Kotlin!"
3.add(4)         // 7
```

---

## 고차 함수에서 활용

```kotlin
fun buildString(action: StringBuilder.() -> Unit): String {
    val sb = StringBuilder()
    sb.action()   // sb가 수신 객체가 되어 action 실행
    return sb.toString()
}

val result = buildString {
    append("Hello")   // this = StringBuilder
    append(", ")
    append("World!")
    insert(0, ">>> ")
}
// ">>> Hello, World!"
```

이것이 Kotlin 표준 라이브러리의 `buildString`과 동일한 구조입니다.

---

## apply — 수신 객체 지정 람다의 대표 예

스코프 함수 `apply`가 수신 객체 지정 람다를 사용합니다.

```kotlin
// apply의 시그니처 (간략화)
fun <T> T.apply(block: T.() -> Unit): T {
    block()   // this(= T 인스턴스)에서 block 실행
    return this
}

data class User(var name: String = "", var age: Int = 0, var email: String = "")

val user = User().apply {
    name = "홍길동"    // this.name = ...
    age = 30
    email = "hong@example.com"
}
```

---

## DSL 구축

수신 객체 지정 람다의 가장 강력한 활용입니다.

### 간단한 HTML DSL

```kotlin
class Tag(val name: String) {
    private val children = mutableListOf<Tag>()
    private var content = ""

    fun tag(name: String, block: Tag.() -> Unit): Tag {
        val child = Tag(name).apply(block)
        children.add(child)
        return child
    }

    operator fun String.unaryPlus() {
        content = this
    }

    fun render(indent: Int = 0): String {
        val prefix = "  ".repeat(indent)
        return if (children.isEmpty()) {
            "$prefix<$name>$content</$name>"
        } else {
            "$prefix<$name>\n" +
            children.joinToString("\n") { it.render(indent + 1) } +
            "\n$prefix</$name>"
        }
    }
}

fun html(block: Tag.() -> Unit) = Tag("html").apply(block)

val page = html {
    tag("body") {
        tag("h1") { +"제목" }
        tag("p")  { +"본문 내용" }
    }
}

println(page.render())
// <html>
//   <body>
//     <h1>제목</h1>
//     <p>본문 내용</p>
//   </body>
// </html>
```

### 설정 DSL

```kotlin
class ServerConfig {
    var host: String = "localhost"
    var port: Int = 8080
    var timeout: Int = 3000

    inner class DatabaseConfig {
        var url: String = ""
        var maxPool: Int = 10
    }

    val database = DatabaseConfig()
    fun database(block: DatabaseConfig.() -> Unit) = database.apply(block)
}

fun server(block: ServerConfig.() -> Unit): ServerConfig =
    ServerConfig().apply(block)

val config = server {
    host = "prod.example.com"
    port = 443
    timeout = 5000
    database {
        url = "jdbc:postgresql://localhost/mydb"
        maxPool = 20
    }
}
```

---

## `this`가 두 개인 경우

멤버로 정의된 확장 함수에서는 수신 객체가 두 개입니다.

```kotlin
class A {
    val valueA = "A"

    fun String.process() {
        println(this)         // String 수신 객체
        println(this@A.valueA) // A 수신 객체 (레이블로 구분)
    }

    fun test() {
        "hello".process()
    }
}
```

---

## `@DslMarker` — DSL 스코프 제한

중첩 DSL에서 바깥 스코프의 함수를 실수로 호출하는 것을 막습니다.

```kotlin
@DslMarker
annotation class HtmlDsl

@HtmlDsl
class BodyTag {
    fun p(block: PTag.() -> Unit) { /* ... */ }
}

@HtmlDsl
class PTag {
    operator fun String.unaryPlus() { /* ... */ }
}

fun body(block: BodyTag.() -> Unit) = BodyTag().apply(block)

body {
    p {
        +"내용"
        // p { } // @DslMarker로 인해 컴파일 에러 — p 안에서 p 호출 불가
    }
}
```

---

## 표준 라이브러리에서의 수신 객체 지정 람다

```kotlin
// buildString
val s = buildString {
    repeat(3) { append("ha") }
}  // "hahaha"

// buildList
val list = buildList {
    add(1)
    addAll(listOf(2, 3, 4))
    add(5)
}

// with
val result = with(StringBuilder()) {
    append("Hello")
    append(", World!")
    toString()
}

// apply, run, also, let 모두 수신 객체 지정 람다 활용
```

---

## 정리

- 수신 객체 지정 람다: `Type.() -> Unit` — 람다 안에서 `this` 없이 수신 객체 멤버 접근
- DSL의 기반 — 선언적이고 읽기 쉬운 API 구축
- `apply`, `run`, `with` 등 스코프 함수가 이 방식으로 구현됨
- `@DslMarker` — 중첩 스코프에서 잘못된 함수 호출 방지
