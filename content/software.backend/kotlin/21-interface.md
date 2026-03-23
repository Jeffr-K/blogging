---
title: "[Kotlin 시리즈] 21. interface"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "interface", "디폴트메서드", "다중구현", "위임", "클래스위임"]
---

# interface

## 기본 선언

```kotlin
interface Greetable {
    fun greet(): String
}

class KoreanGreeter : Greetable {
    override fun greet() = "안녕하세요!"
}

class EnglishGreeter : Greetable {
    override fun greet() = "Hello!"
}
```

---

## 추상 프로퍼티

인터페이스는 상태(backing field)를 가질 수 없지만 추상 프로퍼티를 선언할 수 있습니다. 구현 클래스에서 `val` 또는 `var`로 구현합니다.

```kotlin
interface Identifiable {
    val id: Long
    val label: String get() = "ID-$id"  // 디폴트 구현 (backing field 없음)
}

class Product(override val id: Long, val name: String) : Identifiable {
    // label은 디폴트 구현 그대로 사용
}

class Order(override val id: Long) : Identifiable {
    override val label: String get() = "ORDER-$id"  // 오버라이드
}

Product(1L, "사과").label   // "ID-1"
Order(42L).label            // "ORDER-42"
```

---

## 디폴트 메서드 구현

메서드에 본문을 제공하면 구현 클래스에서 선택적으로 오버라이드합니다.

```kotlin
interface Logger {
    fun log(message: String)

    fun info(message: String) = log("[INFO] $message")
    fun warn(message: String) = log("[WARN] $message")
    fun error(message: String) = log("[ERROR] $message")
}

class ConsoleLogger : Logger {
    override fun log(message: String) = println(message)
    // info, warn, error는 디폴트 구현 사용
}

class SilentLogger : Logger {
    override fun log(message: String) {}   // 아무것도 안 함
}
```

---

## 다중 구현

클래스는 여러 인터페이스를 구현할 수 있습니다.

```kotlin
interface Flyable {
    fun fly() = "날기"
}

interface Swimmable {
    fun swim() = "수영"
}

interface Runnable {
    fun run() = "달리기"
}

class Duck : Flyable, Swimmable, Runnable {
    // 세 인터페이스의 디폴트 구현 그대로 사용
}

class Penguin : Swimmable, Runnable {
    override fun swim() = "펭귄 수영"
    override fun run() = "펭귄 달리기"
}

val duck = Duck()
duck.fly()   // "날기"
duck.swim()  // "수영"
```

---

## 다이아몬드 문제 — 충돌 해결

두 인터페이스가 같은 시그니처의 디폴트 메서드를 가지면, 구현 클래스가 반드시 오버라이드해야 합니다.

```kotlin
interface A {
    fun hello() = "A의 hello"
}

interface B {
    fun hello() = "B의 hello"
}

class C : A, B {
    // hello()가 충돌 — 반드시 오버라이드
    override fun hello(): String {
        // super<A>.hello() 또는 super<B>.hello()로 위임 가능
        return "${super<A>.hello()} + ${super<B>.hello()}"
    }
}

C().hello()  // "A의 hello + B의 hello"
```

---

## 인터페이스 상속

```kotlin
interface Shape {
    fun area(): Double
}

interface ColoredShape : Shape {
    val color: String
    fun describe() = "색상: $color, 넓이: ${area()}"
}

class RedCircle(private val radius: Double) : ColoredShape {
    override val color = "빨강"
    override fun area() = Math.PI * radius * radius
}

RedCircle(5.0).describe()  // "색상: 빨강, 넓이: 78.53..."
```

---

## 클래스 위임 (`by` 키워드)

인터페이스 구현을 다른 객체에 위임합니다. 데코레이터 패턴을 간결하게 구현할 수 있습니다.

```kotlin
interface Printer {
    fun print(text: String)
    fun println(text: String) = print("$text\n")
}

class BasicPrinter : Printer {
    override fun print(text: String) = kotlin.io.print(text)
}

// BasicPrinter의 모든 메서드를 위임, 필요한 것만 오버라이드
class LoggingPrinter(private val delegate: Printer) : Printer by delegate {
    override fun print(text: String) {
        kotlin.io.print("[LOG] ")
        delegate.print(text)
    }
    // println은 delegate의 구현 사용
}

val printer = LoggingPrinter(BasicPrinter())
printer.print("안녕")     // "[LOG] 안녕"
printer.println("세상")   // "[LOG] 세상\n"
```

### 위임 + 부분 오버라이드

```kotlin
interface Collection<T> {
    fun add(item: T)
    fun remove(item: T)
    fun contains(item: T): Boolean
    fun size(): Int
}

class LimitedCollection<T>(
    private val delegate: MutableList<T>,
    private val limit: Int,
) : Collection<T> by (delegate as Collection<T>) {
    override fun add(item: T) {
        check(delegate.size < limit) { "최대 $limit 개까지만 추가 가능" }
        delegate.add(item)
    }
}
```

---

## sealed interface — 봉인 인터페이스

`sealed interface`는 `sealed class`와 달리 다중 구현이 가능합니다.

```kotlin
sealed interface Expr {
    data class Num(val value: Double) : Expr
    data class Add(val left: Expr, val right: Expr) : Expr
    data class Mul(val left: Expr, val right: Expr) : Expr
}

fun eval(expr: Expr): Double = when (expr) {
    is Expr.Num -> expr.value
    is Expr.Add -> eval(expr.left) + eval(expr.right)
    is Expr.Mul -> eval(expr.left) * eval(expr.right)
}

val result = eval(
    Expr.Add(
        Expr.Num(3.0),
        Expr.Mul(Expr.Num(2.0), Expr.Num(4.0))
    )
)  // 11.0
```

---

## fun interface — SAM 인터페이스

단일 추상 메서드를 가진 인터페이스를 `fun interface`로 선언하면 람다로 인스턴스화할 수 있습니다.

```kotlin
fun interface Transformer<A, B> {
    fun transform(input: A): B
}

val toUpperCase = Transformer<String, String> { it.uppercase() }
val toLength = Transformer<String, Int> { it.length }

toUpperCase.transform("hello")  // "HELLO"
toLength.transform("kotlin")    // 6
```

---

## 실용 패턴

### 역할 분리

```kotlin
interface UserReader {
    fun findById(id: Long): User?
    fun findAll(): List<User>
}

interface UserWriter {
    fun save(user: User): User
    fun delete(id: Long)
}

interface UserRepository : UserReader, UserWriter

// 읽기 전용 서비스는 UserReader만 의존
class UserQueryService(private val reader: UserReader) {
    fun getUser(id: Long) = reader.findById(id)
        ?: throw NotFoundException("User $id")
}

// 쓰기 서비스는 UserWriter만 의존
class UserCommandService(private val writer: UserWriter) {
    fun createUser(name: String) = writer.save(User(name = name))
}
```

### 플러그인 / 전략 패턴

```kotlin
interface PricingStrategy {
    fun calculate(basePrice: Long, quantity: Int): Long
}

object RegularPricing : PricingStrategy {
    override fun calculate(basePrice: Long, quantity: Int) = basePrice * quantity
}

object BulkPricing : PricingStrategy {
    override fun calculate(basePrice: Long, quantity: Int): Long {
        val discount = when {
            quantity >= 100 -> 0.8
            quantity >= 50  -> 0.9
            quantity >= 10  -> 0.95
            else            -> 1.0
        }
        return (basePrice * quantity * discount).toLong()
    }
}

class ShoppingCart(private val strategy: PricingStrategy) {
    fun totalPrice(basePrice: Long, quantity: Int) =
        strategy.calculate(basePrice, quantity)
}

ShoppingCart(BulkPricing).totalPrice(1000L, 100)  // 80,000
```

---

## 정리

- **추상 프로퍼티**: 상태(backing field) 없음, 디폴트 getter 가능
- **디폴트 메서드**: 본문 제공, 구현 클래스에서 선택적 오버라이드
- **다중 구현**: 제한 없음
- **충돌 해결**: 동일 시그니처 시 `override` 필수, `super<Interface>.method()`로 위임
- **`class A : Interface by delegate`**: 위임으로 데코레이터 패턴 간소화
- **`sealed interface`**: 완전성 검사 + 다중 구현
- **`fun interface`**: SAM 변환으로 람다 인스턴스화
