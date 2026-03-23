---
title: "[Kotlin 시리즈] 13. 함수 참조와 invoke"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "함수참조", "invoke", "KFunction", "callable reference"]
---

# 함수 참조와 invoke

## 함수 참조 (`::`)

함수를 직접 호출하지 않고 **참조**로 만들어 전달합니다. 람다 대신 기존 함수를 그대로 넘길 수 있습니다.

### 최상위 함수 참조

```kotlin
fun isEven(n: Int): Boolean = n % 2 == 0
fun double(n: Int): Int = n * 2

// 람다로 전달
listOf(1, 2, 3, 4).filter { isEven(it) }
listOf(1, 2, 3, 4).map { double(it) }

// 함수 참조로 전달 — 더 간결
listOf(1, 2, 3, 4).filter(::isEven)
listOf(1, 2, 3, 4).map(::double)
```

`::isEven`의 타입은 `(Int) -> Boolean`입니다. 함수 타입과 완전히 호환됩니다.

### 멤버 함수 참조

```kotlin
data class User(val name: String, val age: Int) {
    fun isAdult(): Boolean = age >= 18
    fun greet(greeting: String): String = "$greeting, $name!"
}

val users = listOf(User("Alice", 25), User("Bob", 15), User("Carol", 30))

// 인스턴스::메서드
val alice = User("Alice", 25)
val aliceGreet: (String) -> String = alice::greet
aliceGreet("Hello")   // "Hello, Alice!"

// 타입::메서드 — 첫 번째 파라미터가 수신 객체
val isAdult: (User) -> Boolean = User::isAdult
users.filter(isAdult)          // 성인만
users.filter(User::isAdult)    // 동일

val getName: (User) -> String = User::name  // 프로퍼티 참조도 가능
users.map(User::name)          // ["Alice", "Bob", "Carol"]
```

### 생성자 참조

```kotlin
data class Point(val x: Int, val y: Int)

val createPoint: (Int, Int) -> Point = ::Point
createPoint(3, 4)   // Point(3, 4)

// 팩토리 함수 대신 생성자 참조
val points = listOf(Pair(1, 2), Pair(3, 4))
    .map { (x, y) -> Point(x, y) }

// 생성자 참조를 쓰면 구조 분해가 안 되므로 람다가 나을 수 있음
```

### 확장 함수 참조

```kotlin
fun String.toCamelCase(): String =
    split("_").joinToString("") { it.replaceFirstChar { c -> c.uppercase() } }
        .replaceFirstChar { it.lowercase() }

val convert: (String) -> String = String::toCamelCase
"hello_world".toCamelCase()  // "helloWorld"
listOf("foo_bar", "baz_qux").map(String::toCamelCase)  // ["fooBar", "bazQux"]
```

---

## 프로퍼티 참조

```kotlin
data class Product(val name: String, val price: Int, val inStock: Boolean)

val products = listOf(
    Product("사과", 1000, true),
    Product("바나나", 1500, false),
    Product("체리", 3000, true),
)

// 프로퍼티 참조로 정렬
val byPrice = products.sortedBy(Product::price)
val byName = products.sortedBy(Product::name)

// 프로퍼티 추출
val prices: List<Int> = products.map(Product::price)
val names: List<String> = products.map(Product::name)

// 필터
val inStock = products.filter(Product::inStock)
```

### KProperty — 프로퍼티 메타데이터

```kotlin
val prop = Product::name   // KProperty1<Product, String>

prop.name   // "name"
prop.get(products.first())  // "사과"
```

---

## KFunction — 런타임 함수 참조

`::` 참조는 `KFunction` 타입으로도 사용됩니다.

```kotlin
fun add(a: Int, b: Int) = a + b

val fn: KFunction2<Int, Int, Int> = ::add
fn.call(3, 4)           // 7 — 반사적 호출
fn.invoke(3, 4)         // 7 — 타입 안전 호출

// 함수 메타데이터
fn.name          // "add"
fn.parameters    // [a: Int, b: Int]
fn.returnType    // Int
```

---

## invoke 관례

객체에 `operator fun invoke()`를 정의하면 **함수처럼 호출**할 수 있습니다.

### 기본 사용

```kotlin
class Adder(private val base: Int) {
    operator fun invoke(n: Int) = base + n
}

val addFive = Adder(5)
addFive(3)   // 8  — addFive.invoke(3)
addFive(10)  // 15
```

### 함수 타입 인터페이스

`invoke`가 있으면 함수 타입과 호환됩니다.

```kotlin
class Validator(private val regex: Regex) {
    operator fun invoke(input: String): Boolean = regex.matches(input)
}

val emailValidator = Validator(Regex("[^@]+@[^@]+\\.[^@]+"))

// 함수처럼 호출
emailValidator("user@example.com")  // true

// 함수 타입으로 사용 가능
val validate: (String) -> Boolean = emailValidator
listOf("valid@mail.com", "invalid").filter(validate)
```

### 동반 객체의 invoke — 팩토리 패턴

```kotlin
class User private constructor(val name: String, val email: String) {
    companion object {
        operator fun invoke(name: String, email: String): User? {
            if (name.isBlank()) return null
            if (!email.contains("@")) return null
            return User(name, email)
        }
    }
}

// 생성자처럼 호출하지만 검증 로직 포함
val user = User("홍길동", "hong@example.com")   // User? 반환
val invalid = User("", "invalid")               // null
```

---

## 함수 참조 vs 람다 선택

```kotlin
val numbers = listOf(1, 2, 3, 4, 5)

// 함수 참조 — 기존 함수를 그대로 전달, 간결
numbers.filter(::isEven)
numbers.map(::double)

// 람다 — 즉석에서 로직 작성, 유연
numbers.filter { it % 2 == 0 && it > 2 }
numbers.map { it * 2 + 1 }
```

| | 함수 참조 | 람다 |
|--|---------|------|
| 가독성 | 함수 이름이 의도를 표현 | 로직이 명시적 |
| 재사용 | 기존 함수를 재사용 | 일회성 로직에 적합 |
| 추가 로직 | 불가 | 가능 |

---

## 정리

- `::함수이름` — 최상위 함수 참조 → `(params) -> Return` 타입
- `인스턴스::메서드` — 특정 인스턴스에 바인딩된 참조
- `타입::메서드` — 수신 객체를 첫 파라미터로 받는 참조
- `::생성자` — 생성자 참조 → `(params) -> Type` 타입
- `operator fun invoke()` — 객체를 함수처럼 호출 가능
- `KFunction`, `KProperty` — 런타임 함수/프로퍼티 메타데이터
