---
title: "[Kotlin 시리즈] 9. 고차 함수, 람다, 익명 함수"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "고차함수", "람다", "익명함수", "함수타입", "클로저"]
---

# 고차 함수, 람다, 익명 함수

## 함수 타입

Kotlin에서 함수는 **일급 객체**입니다. 타입이 있고, 변수에 저장하고, 인자로 전달하고, 반환할 수 있습니다.

```kotlin
// 함수 타입 표기
val action: () -> Unit           // 파라미터 없음, 반환 없음
val transform: (Int) -> Int      // Int 받아서 Int 반환
val combine: (Int, Int) -> Int   // Int 두 개 받아서 Int 반환
val parse: (String) -> Int?      // 실패 시 null 반환

// 변수에 함수 저장
val double: (Int) -> Int = { x -> x * 2 }
val isEven: (Int) -> Boolean = { it % 2 == 0 }
```

---

## 람다 표현식

### 기본 문법

```kotlin
val sum = { a: Int, b: Int -> a + b }
sum(3, 5)  // 8

// 타입이 추론되면 람다 안에서 타입 생략 가능
val sum2: (Int, Int) -> Int = { a, b -> a + b }
```

### `it` — 단일 파라미터 암시적 이름

파라미터가 하나면 이름을 선언하지 않고 `it`으로 접근할 수 있습니다.

```kotlin
val double: (Int) -> Int = { it * 2 }
val isBlank: (String) -> Boolean = { it.isBlank() }

listOf(1, 2, 3).map { it * 2 }   // [2, 4, 6]
```

### 후행 람다 (Trailing Lambda)

마지막 인자가 함수 타입이면 괄호 밖으로 꺼낼 수 있습니다.

```kotlin
// 일반 호출
listOf(1, 2, 3).filter({ it > 1 })

// 후행 람다
listOf(1, 2, 3).filter { it > 1 }

// 유일한 인자가 람다면 괄호 생략
run({ println("hello") })
run { println("hello") }
```

### 멀티라인 람다 — 마지막 줄이 반환값

```kotlin
val process: (Int) -> String = { n ->
    val doubled = n * 2
    val message = "결과: $doubled"
    message   // 이 줄이 반환값
}

process(5)  // "결과: 10"
```

### 람다에서 return

람다 안의 `return`은 기본적으로 **둘러싼 함수를 반환**합니다(비지역 return). 이는 `inline` 함수에서만 허용됩니다.

```kotlin
fun findFirst(list: List<Int>): Int? {
    list.forEach {              // forEach는 inline
        if (it > 3) return it  // findFirst 함수를 반환
    }
    return null
}

// 람다만 종료하려면 레이블
fun findFirstLabel(list: List<Int>): Int? {
    list.forEach {
        if (it > 3) return@forEach  // 이번 이터레이션만 종료
    }
    return null
}
```

---

## 고차 함수 (Higher-order Function)

함수를 인자로 받거나 함수를 반환하는 함수입니다.

### 함수를 인자로 받기

```kotlin
fun applyTwice(f: (Int) -> Int, x: Int): Int = f(f(x))

applyTwice({ it * 2 }, 3)   // 12 — 3*2=6, 6*2=12
applyTwice({ it + 1 }, 3)   // 5  — 3+1=4, 4+1=5

// 후행 람다 스타일
applyTwice(x = 3) { it * 2 }
```

```kotlin
fun <T> List<T>.myFilter(predicate: (T) -> Boolean): List<T> {
    val result = mutableListOf<T>()
    for (item in this) {
        if (predicate(item)) result.add(item)
    }
    return result
}

listOf(1, 2, 3, 4, 5).myFilter { it % 2 == 0 }  // [2, 4]
```

### 함수를 반환하기

```kotlin
fun multiplier(factor: Int): (Int) -> Int = { it * factor }

val double = multiplier(2)
val triple = multiplier(3)

double(5)  // 10
triple(5)  // 15
```

```kotlin
// 조건에 따라 다른 함수 반환
fun getValidator(type: String): (String) -> Boolean = when (type) {
    "email"  -> { it.contains("@") }
    "phone"  -> { it.matches(Regex("\\d{10,11}")) }
    "url"    -> { it.startsWith("http") }
    else     -> { true }
}

val validateEmail = getValidator("email")
validateEmail("user@example.com")  // true
```

---

## 클로저 (Closure)

람다는 자신이 정의된 스코프의 변수를 **캡처**합니다.

```kotlin
fun makeCounter(): () -> Int {
    var count = 0
    return {
        count++   // 외부 변수 count를 캡처하고 수정
        count
    }
}

val counter = makeCounter()
counter()  // 1
counter()  // 2
counter()  // 3

val counter2 = makeCounter()  // 새 counter — 별도의 count 변수
counter2()  // 1
```

Java에서는 람다가 캡처하는 변수가 `final`이어야 합니다. Kotlin은 `var`도 캡처하고 수정할 수 있습니다.

```kotlin
var total = 0
listOf(1, 2, 3, 4, 5).forEach {
    total += it   // var 수정 가능
}
println(total)  // 15
```

---

## 익명 함수 (Anonymous Function)

람다와 유사하지만 `fun` 키워드를 사용하고 `return` 동작이 다릅니다.

```kotlin
// 익명 함수 — return이 함수 자체를 반환 (비지역 return 아님)
val double = fun(x: Int): Int {
    return x * 2
}

// 단일 표현식 형태
val triple = fun(x: Int) = x * 3

double(5)  // 10
triple(5)  // 15
```

### 람다 vs 익명 함수 — return 동작 차이

```kotlin
fun processLambda(list: List<Int>) {
    list.forEach {
        if (it == 3) return  // findWithLambda 함수 전체를 종료 (비지역)
        print("$it ")
    }
    println("완료")  // 실행 안 됨
}

fun processAnonymous(list: List<Int>) {
    list.forEach(fun(item) {
        if (item == 3) return  // 이 익명 함수만 종료 (로컬 return)
        print("$item ")
    })
    println("완료")  // 실행됨
}

processLambda(listOf(1, 2, 3, 4))    // 1 2
processAnonymous(listOf(1, 2, 3, 4)) // 1 2 4 완료
```

| | 람다 | 익명 함수 |
|--|------|---------|
| 문법 | `{ params -> body }` | `fun(params): ReturnType { body }` |
| 타입 명시 | 보통 생략 | 명시 가능 |
| `return` 동작 | 비지역 return (inline 함수 내) | 로컬 return |
| 후행 람다 | 가능 | 불가 |
| 일반적 사용 | 대부분 | return 동작이 중요할 때 |

---

## 함수 타입의 nullable

```kotlin
val callback: (() -> Unit)? = null

// null 체크 후 호출
if (callback != null) callback()

// 안전 호출
callback?.invoke()

// 파라미터로 받을 때
fun execute(action: (() -> Unit)? = null) {
    action?.invoke()
}
```

---

## 정리

- **함수 타입**: `(A, B) -> C` — 함수를 값으로 다룸
- **람다**: `{ a, b -> a + b }` — 가장 일반적인 형태, `it`으로 단일 파라미터 접근
- **후행 람다**: 마지막 인자가 함수면 괄호 밖으로
- **클로저**: 람다는 외부 `var`도 캡처 가능
- **익명 함수**: `fun(x) = ...` — 로컬 `return`이 필요할 때
- **비지역 return**: `inline` 함수 람다에서만 — 둘러싼 함수를 반환
