---
title: "[Kotlin 시리즈] 14. 클래스 기초 — class, abstract class, open class"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "class", "abstract", "open", "생성자", "init", "상속"]
---

# 클래스 기초 — class, abstract class, open class

## class — 기본 클래스

### 선언과 인스턴스화

```kotlin
class Person(val name: String, val age: Int)

val p = Person("홍길동", 30)
println(p.name)  // "홍길동"
```

생성자 괄호가 없으면 기본 생성자는 파라미터 없이 자동 생성됩니다.

```kotlin
class Empty          // 기본 생성자 자동 생성
val e = Empty()
```

### 주 생성자 (Primary Constructor)

클래스 헤더에 선언합니다. `val` / `var`를 붙이면 자동으로 프로퍼티가 됩니다.

```kotlin
class User(
    val id: Long,
    val name: String,
    var email: String,
)
```

`constructor` 키워드는 `annotation` 또는 접근 제어자가 없으면 생략 가능합니다.

```kotlin
class AdminUser private constructor(val name: String) {
    companion object {
        fun create(name: String) = AdminUser(name)
    }
}
```

### init 블록

주 생성자 실행 직후 실행됩니다. 유효성 검사나 초기화 로직을 넣습니다.

```kotlin
class User(val name: String, val age: Int) {
    init {
        require(name.isNotBlank()) { "이름은 비어있을 수 없습니다." }
        require(age >= 0) { "나이는 음수일 수 없습니다." }
    }
}

User("홍길동", 30)   // OK
User("", 30)        // IllegalArgumentException
User("홍길동", -1)  // IllegalArgumentException
```

여러 개의 `init` 블록을 선언하면 순서대로 실행됩니다.

```kotlin
class Demo(val x: Int) {
    val doubled: Int

    init {
        println("첫 번째 init: x = $x")
        doubled = x * 2
    }

    init {
        println("두 번째 init: doubled = $doubled")
    }
}
```

### 부 생성자 (Secondary Constructor)

`constructor` 키워드로 선언하며, 반드시 주 생성자(또는 다른 부 생성자)를 `this()`로 위임해야 합니다.

```kotlin
class Rectangle(val width: Int, val height: Int) {
    val area = width * height

    // 정사각형 편의 생성자
    constructor(size: Int) : this(size, size)

    // 기본값 생성자
    constructor() : this(1, 1)
}

Rectangle(4, 6)  // 일반
Rectangle(5)     // 정사각형
Rectangle()      // 1x1
```

부 생성자가 많다면 기본 매개변수를 쓰는 게 더 간결합니다.

```kotlin
// 부 생성자 대신
class Rectangle(val width: Int = 1, val height: Int = width)
```

### 프로퍼티 초기화 순서

1. 주 생성자 매개변수
2. 프로퍼티 선언 초기화 / `init` 블록 (선언 순서대로)
3. 부 생성자 본문

```kotlin
class Order(val id: Int) {
    val label = "주문 #$id".also { println("label 초기화: $it") }

    init {
        println("init 블록: id = $id")
    }
}
// label 초기화: 주문 #1
// init 블록: id = 1
```

---

## open class — 상속 가능한 클래스

Kotlin의 모든 클래스는 기본적으로 `final`입니다. 상속을 허용하려면 `open`을 명시해야 합니다.

```kotlin
open class Animal(val name: String) {
    open fun sound(): String = "..."

    fun breathe() = "숨쉬기"  // final — 오버라이드 불가
}

class Dog(name: String) : Animal(name) {
    override fun sound() = "멍멍"
}

class Cat(name: String) : Animal(name) {
    override fun sound() = "야옹"
}

val dog = Dog("바둑이")
dog.sound()    // "멍멍"
dog.breathe()  // "숨쉬기"
```

### 오버라이드 규칙

- `open` 함수만 `override` 가능
- `override`된 함수는 기본적으로 `open` — 하위 클래스에서 다시 오버라이드 가능
- 더 이상 오버라이드를 막으려면 `final override`

```kotlin
open class Shape {
    open fun draw() = "도형 그리기"
}

open class Circle : Shape() {
    override fun draw() = "원 그리기"          // 여전히 open
    final override fun toString() = "Circle"   // 더 이상 오버라이드 불가
}

class SmallCircle : Circle() {
    override fun draw() = "작은 원 그리기"    // 가능 (Circle.draw는 open)
}
```

### 프로퍼티 오버라이드

```kotlin
open class Base {
    open val value: Int = 0
    open val description: String get() = "Base: $value"
}

class Derived : Base() {
    override val value: Int = 42
    override val description: String get() = "Derived: $value"

    // val → var로 오버라이드 가능 (반대는 불가)
    // override var value: Int = 42
}
```

### 생성자와 상속

```kotlin
open class Vehicle(val brand: String, val speed: Int)

class Car(brand: String, speed: Int, val doors: Int) : Vehicle(brand, speed)

class ElectricCar(brand: String, doors: Int) : Vehicle(brand, 200) {
    init {
        println("전기차 생성: $brand, 문 $doors 개")
    }
}
```

---

## abstract class — 추상 클래스

인스턴스를 직접 생성할 수 없습니다. 공통 구현 + 미완성 계약을 조합할 때 사용합니다.

```kotlin
abstract class Shape {
    abstract val name: String
    abstract fun area(): Double
    abstract fun perimeter(): Double

    // 공통 구현 — 하위 클래스가 그대로 사용
    fun describe() = "$name: 넓이 = ${area()}, 둘레 = ${perimeter()}"
}

class Circle(private val radius: Double) : Shape() {
    override val name = "원"
    override fun area() = Math.PI * radius * radius
    override fun perimeter() = 2 * Math.PI * radius
}

class Rectangle(private val width: Double, private val height: Double) : Shape() {
    override val name = "직사각형"
    override fun area() = width * height
    override fun perimeter() = 2 * (width + height)
}

val shapes: List<Shape> = listOf(Circle(5.0), Rectangle(4.0, 6.0))
shapes.forEach { println(it.describe()) }
```

### 추상 클래스 vs 인터페이스

```kotlin
abstract class AbstractLogger {
    // 상태(프로퍼티) 유지 가능
    private val logs = mutableListOf<String>()

    // 추상 메서드 — 하위 클래스 구현 필수
    abstract fun format(message: String): String

    // 공통 구현 — 상태 사용
    fun log(message: String) {
        val formatted = format(message)
        logs.add(formatted)
        println(formatted)
    }

    fun getLogs(): List<String> = logs.toList()
}

class TimestampLogger : AbstractLogger() {
    override fun format(message: String) = "[${System.currentTimeMillis()}] $message"
}
```

| | 추상 클래스 | 인터페이스 |
|--|-----------|----------|
| 인스턴스화 | 불가 | 불가 |
| 상태(필드) | 가능 | 불가 (val만, 백킹 필드 없음) |
| 생성자 | 가능 | 불가 |
| 다중 상속 | 불가 (단일) | 가능 (다중 구현) |
| 기본 구현 | 가능 | 가능 (default 메서드) |

---

## class / open class / abstract class 비교

```
class           — 최종 클래스, 상속 불가 (기본)
open class      — 상속 허용
abstract class  — 상속 강제, 직접 인스턴스화 불가
```

```kotlin
class Concrete         // final, 인스턴스화 O, 상속 X
open class Extendable  // 인스턴스화 O, 상속 O
abstract class Base    // 인스턴스화 X, 상속 필수
```

---

## 정리

- `class`: 기본 `final` — `open` 없으면 상속 불가
- **주 생성자**: 클래스 헤더에 선언, `val`/`var`로 프로퍼티 자동 생성
- **`init` 블록**: 주 생성자 실행 직후, 프로퍼티 초기화와 순서 공유
- **부 생성자**: `this()`로 주 생성자 위임 필수 — 대부분 기본 매개변수로 대체 가능
- `open class`: 명시적으로 상속 허용, `open fun`만 오버라이드 가능
- `abstract class`: 인스턴스화 불가, 공통 구현 + 추상 메서드 조합
