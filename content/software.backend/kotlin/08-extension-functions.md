---
title: "[Kotlin 시리즈] 8. 확장 함수와 확장 프로퍼티"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "확장함수", "확장프로퍼티", "extension function"]
---

# 확장 함수와 확장 프로퍼티

확장 함수는 **기존 클래스를 수정하지 않고** 새 함수를 추가하는 방법입니다. 상속이나 데코레이터 패턴 없이도 기능을 덧붙일 수 있습니다.

## 기본 선언

```kotlin
// String에 확장 함수 추가
fun String.addExclamation(): String = "$this!"

"Hello".addExclamation()   // "Hello!"
"Kotlin".addExclamation()  // "Kotlin!"
```

`this`는 수신 객체(receiver)를 가리킵니다. 여기서는 확장을 호출한 `String` 인스턴스입니다.

```kotlin
fun String.isPalindrome(): Boolean = this == this.reversed()

"racecar".isPalindrome()  // true
"kotlin".isPalindrome()   // false
```

---

## 표준 라이브러리도 확장 함수

Kotlin 표준 라이브러리의 대부분은 Java 클래스에 추가된 확장 함수입니다.

```kotlin
// 이것들이 모두 확장 함수
"hello".uppercase()         // String.uppercase()
listOf(1, 2, 3).filter { }  // Iterable.filter()
42.toString()               // Int.toString()
"  hi  ".trim()             // String.trim()
```

---

## Nullable 수신 객체

`null`이 될 수 있는 타입에도 확장 함수를 정의할 수 있습니다.

```kotlin
fun String?.orEmpty(): String = this ?: ""
// 표준 라이브러리에 이미 있음

fun String?.isNullOrBlankCustom(): Boolean = this == null || this.isBlank()

val name: String? = null
name.isNullOrBlankCustom()  // true — NPE 없이 호출 가능
```

---

## 확장 함수 vs 멤버 함수 우선순위

동일한 시그니처의 멤버 함수가 있으면 **멤버 함수가 항상 이깁니다**.

```kotlin
class Printer {
    fun print() = println("멤버 함수")
}

fun Printer.print() = println("확장 함수")

Printer().print()  // "멤버 함수" — 확장 함수 무시됨
```

확장 함수는 오버라이딩할 수 없습니다. 멤버가 없는 경우에만 호출됩니다.

---

## 정적 디스패치

확장 함수는 **컴파일 타임의 타입**을 기준으로 호출됩니다. 런타임 다형성이 없습니다.

```kotlin
open class Shape
class Circle : Shape()

fun Shape.describe() = "Shape"
fun Circle.describe() = "Circle"

val shape: Shape = Circle()  // 런타임 타입은 Circle
shape.describe()             // "Shape" — 컴파일 타임 타입(Shape) 기준
```

멤버 함수와의 차이:

```kotlin
open class Shape {
    open fun name() = "Shape"
}
class Circle : Shape() {
    override fun name() = "Circle"
}

val shape: Shape = Circle()
shape.name()  // "Circle" — 멤버 함수는 런타임 타입 기준
```

---

## 확장 함수를 멤버로 정의

클래스 안에서 다른 타입의 확장 함수를 정의할 수 있습니다. 두 개의 수신 객체가 존재합니다.

```kotlin
class HtmlBuilder {
    private val sb = StringBuilder()

    fun String.tag(name: String): String {
        // this@HtmlBuilder — HtmlBuilder 수신 객체
        // this — String 수신 객체
        sb.append("<$name>$this</$name>")
        return "<$name>$this</$name>"
    }

    fun build(): String = sb.toString()
}

val builder = HtmlBuilder()
// "hello".tag("p")  // HtmlBuilder 바깥에서는 호출 불가
```

이 패턴은 DSL 구현에 핵심적으로 쓰입니다.

---

## 동반 객체 확장 함수

```kotlin
class MyClass {
    companion object
}

fun MyClass.Companion.create(): MyClass = MyClass()

MyClass.create()   // 정적 메서드처럼 호출
```

---

## 확장 프로퍼티

함수처럼 기존 타입에 프로퍼티를 추가합니다. **backing field가 없으므로** 반드시 getter(와 필요시 setter)를 구현해야 합니다.

```kotlin
val String.lastChar: Char
    get() = this[length - 1]

"Kotlin".lastChar   // 'n'

// var 확장 프로퍼티 (setter 포함)
var StringBuilder.lastChar: Char
    get() = this[length - 1]
    set(value) {
        setCharAt(length - 1, value)
    }

val sb = StringBuilder("Kotlin")
sb.lastChar = '!'   // 마지막 문자 변경
println(sb)         // "Kotli!"
```

backing field가 없기 때문에 상태를 저장할 수 없습니다. 기존 데이터를 계산해서 반환하는 용도로만 씁니다.

```kotlin
val List<*>.lastIndex: Int
    get() = size - 1

val IntRange.size: Int
    get() = last - first + 1

listOf(1, 2, 3).lastIndex  // 2
(1..10).size               // 10
```

---

## 실용 패턴

### 유틸리티 함수 대체

```kotlin
// Java 스타일 — 유틸리티 클래스
StringUtils.capitalize("hello")

// Kotlin 확장 함수
fun String.capitalize2(): String =
    replaceFirstChar { it.uppercaseChar() }

"hello".capitalize2()  // "Hello"
```

### 도메인 특화 표현

```kotlin
// 금액 처리
fun Int.toKoreanWon(): String = "${this}원"
fun Double.percent(): String = "${"%.1f".format(this * 100)}%"

1000.toKoreanWon()   // "1000원"
0.153.percent()      // "15.3%"
```

### 컬렉션 유틸리티

```kotlin
fun <T> List<T>.second(): T = this[1]
fun <T> List<T>.secondOrNull(): T? = getOrNull(1)

fun <K, V> Map<K, V>.getOrThrow(key: K): V =
    this[key] ?: throw NoSuchElementException("Key not found: $key")

listOf(1, 2, 3).second()       // 2
mapOf("a" to 1).getOrThrow("b") // NoSuchElementException
```

---

## 정리

| 특성 | 내용 |
|------|------|
| 원본 수정 없음 | 상속/수정 없이 기능 추가 |
| 정적 디스패치 | 컴파일 타임 타입 기준 — 다형성 없음 |
| 멤버 함수 우선 | 같은 시그니처면 멤버가 이김 |
| Nullable 수신 객체 | `fun T?.foo()` — null에도 안전하게 호출 |
| 확장 프로퍼티 | backing field 없음 — getter/setter만 |

확장 함수는 Kotlin에서 가장 많이 쓰이는 기능 중 하나입니다. 외부 라이브러리 클래스에 도메인 특화 메서드를 추가하거나, 유틸리티 클래스를 대체하는 데 활용됩니다.
