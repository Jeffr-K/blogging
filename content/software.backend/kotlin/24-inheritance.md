---
title: "[Kotlin 시리즈] 24. 상속 & 인터페이스 구현"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "상속", "inheritance", "override", "super", "클래스위임"]
---

# 상속 & 인터페이스 구현

## 단일 상속

Kotlin의 모든 클래스는 기본 `final`입니다. 상속하려면 부모 클래스에 `open`이 있어야 합니다.

```kotlin
open class Animal(val name: String) {
    open fun sound(): String = "..."
    fun breathe() = "$name 숨쉬기"
}

class Dog(name: String) : Animal(name) {
    override fun sound() = "멍멍"
}

class Cat(name: String, val indoor: Boolean) : Animal(name) {
    override fun sound() = "야옹"
}
```

자식 클래스는 반드시 부모 생성자를 호출해야 합니다.

```kotlin
open class Person(val name: String, val age: Int)

// 주 생성자에서 부모 호출
class Student(name: String, age: Int, val grade: Int) : Person(name, age)

// 부 생성자에서 super()
class Teacher : Person {
    val subject: String

    constructor(name: String, age: Int, subject: String) : super(name, age) {
        this.subject = subject
    }
}
```

---

## super — 부모 멤버 접근

```kotlin
open class Vehicle(val brand: String) {
    open fun describe() = "차량: $brand"
    open val info: String get() = brand
}

class ElectricCar(brand: String, val range: Int) : Vehicle(brand) {
    override fun describe() = "${super.describe()}, 전기차, 주행거리 ${range}km"
    override val info: String get() = "${super.info} (전기)"
}

ElectricCar("Tesla", 500).describe()
// "차량: Tesla, 전기차, 주행거리 500km"
```

---

## 오버라이드 규칙

### final override — 하위 오버라이드 차단

```kotlin
open class Base {
    open fun step1() = "Base.step1"
    open fun step2() = "Base.step2"
}

open class Middle : Base() {
    override fun step1() = "Middle.step1"         // 여전히 open
    final override fun step2() = "Middle.step2"   // 더 이상 오버라이드 불가
}

class Child : Middle() {
    override fun step1() = "Child.step1"    // OK
    // override fun step2() = ...           // 컴파일 에러
}
```

### 프로퍼티 오버라이드

`val`을 `var`로 오버라이드할 수 있습니다 (반대는 불가).

```kotlin
open class Shape {
    open val sides: Int = 0
    open val area: Double get() = 0.0
}

class Square(val size: Double) : Shape() {
    override val sides = 4
    override val area get() = size * size

    // val → var 오버라이드 가능
    override var sides: Int = 4  // 가변으로 변경 가능
}
```

---

## 인터페이스 구현

```kotlin
interface Drawable {
    fun draw()
    fun color(): String = "검정"  // 디폴트 구현
}

interface Resizable {
    fun resize(factor: Double)
}

class Circle(var radius: Double) : Drawable, Resizable {
    override fun draw() = println("반지름 $radius 원 그리기")
    override fun resize(factor: Double) { radius *= factor }
    // color()는 디폴트 구현 사용
}
```

### 인터페이스 + 클래스 동시 상속

```kotlin
open class View(val id: Int)

interface Clickable {
    fun onClick()
}

interface Focusable {
    fun onFocus()
}

class Button(id: Int, val label: String) : View(id), Clickable, Focusable {
    override fun onClick() = println("$label 클릭")
    override fun onFocus() = println("$label 포커스")
}
```

클래스 상속은 하나만, 인터페이스는 여러 개 구현 가능합니다.

---

## 추상 클래스 상속

```kotlin
abstract class Template {
    // 템플릿 메서드 패턴
    fun execute() {
        setup()
        doWork()
        tearDown()
    }

    protected abstract fun doWork()

    protected open fun setup() = println("공통 셋업")
    protected open fun tearDown() = println("공통 정리")
}

class ConcreteTask : Template() {
    override fun doWork() = println("실제 작업 수행")
    override fun setup() {
        super.setup()
        println("추가 셋업")
    }
}

ConcreteTask().execute()
// "공통 셋업"
// "추가 셋업"
// "실제 작업 수행"
// "공통 정리"
```

---

## 클래스 위임 (Class Delegation)

인터페이스 구현을 다른 객체에 위임합니다. 상속 없이 기능을 재사용하는 **컴포지션** 패턴입니다.

```kotlin
interface Stack<T> {
    fun push(item: T)
    fun pop(): T?
    fun peek(): T?
    fun isEmpty(): Boolean
    fun size(): Int
}

class ArrayStack<T> : Stack<T> {
    private val list = ArrayDeque<T>()
    override fun push(item: T) { list.addLast(item) }
    override fun pop() = if (list.isEmpty()) null else list.removeLast()
    override fun peek() = list.lastOrNull()
    override fun isEmpty() = list.isEmpty()
    override fun size() = list.size
}

// 위임 — ArrayStack의 모든 메서드를 위임받고 필요한 것만 오버라이드
class LoggingStack<T>(private val delegate: Stack<T> = ArrayStack()) : Stack<T> by delegate {
    override fun push(item: T) {
        println("push: $item")
        delegate.push(item)
    }

    override fun pop(): T? {
        val item = delegate.pop()
        println("pop: $item")
        return item
    }
}

val stack = LoggingStack<Int>()
stack.push(1)    // "push: 1"
stack.push(2)    // "push: 2"
stack.pop()      // "pop: 2"
stack.size()     // 1 — delegate에 위임
```

### 여러 인터페이스 위임

```kotlin
interface Reader { fun read(): String }
interface Writer { fun write(data: String) }

class FileReader : Reader { override fun read() = "파일 읽기" }
class FileWriter : Writer { override fun write(data: String) = println("파일 쓰기: $data") }

class FileManager(
    reader: Reader = FileReader(),
    writer: Writer = FileWriter(),
) : Reader by reader, Writer by writer

val fm = FileManager()
fm.read()           // "파일 읽기"
fm.write("hello")   // "파일 쓰기: hello"
```

---

## 생성자 초기화 순서

상속 관계에서 초기화 순서가 중요합니다.

```kotlin
open class Parent(val name: String) {
    init { println("Parent init: $name") }
    open val greeting = "안녕"
}

class Child(name: String) : Parent(name) {
    init { println("Child init: $name, greeting=$greeting") }
    override val greeting = "Hello"
}

Child("홍길동")
// "Parent init: 홍길동"
// "Child init: 홍길동, greeting=안녕"  ← 주의! Child.greeting이 아직 초기화 전
```

**주의**: 부모 `init`에서 `open` 프로퍼티나 메서드를 호출하면 자식의 오버라이드 값이 아직 초기화되지 않았을 수 있습니다.

```kotlin
open class Base {
    open val value: Int = 0
    init { println("Base init, value=$value") }  // Child의 value가 아직 0
}

class Derived : Base() {
    override val value: Int = 42
    init { println("Derived init, value=$value") }
}

Derived()
// "Base init, value=0"   ← 42가 아님!
// "Derived init, value=42"
```

---

## 스마트 캐스트와 상속

```kotlin
open class Shape
class Circle(val radius: Double) : Shape()
class Rectangle(val width: Double, val height: Double) : Shape()

fun area(shape: Shape): Double = when (shape) {
    is Circle    -> Math.PI * shape.radius * shape.radius  // 스마트 캐스트
    is Rectangle -> shape.width * shape.height
    else         -> 0.0
}
```

---

## 정리

- Kotlin 기본 `final` — 상속하려면 `open` 필수
- 자식 클래스는 부모 생성자 반드시 호출 (`super()` 또는 `: Parent(args)`)
- `override` — 부모의 `open`/`abstract` 멤버 재정의
- `final override` — 이후 하위 클래스의 오버라이드 차단
- `super.method()` — 부모 구현 명시적 호출
- **클래스 위임** (`by`) — 상속 없이 컴포지션으로 구현 재사용
- 부모 `init`에서 `open` 멤버 호출 주의 — 자식 초기화 순서 문제
