---
title: "[Kotlin 시리즈] 7. 함수 — 기본 선언, 매개변수, 지역 함수"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "함수", "기본매개변수", "명명인자", "vararg", "지역함수"]
---

# 함수 — 기본 선언, 매개변수, 지역 함수

## 함수 선언

```kotlin
fun greet(name: String): String {
    return "Hello, $name!"
}

// 반환 타입이 Unit이면 생략 가능
fun printHello() {
    println("Hello!")
}
```

### 단일 표현식 함수

본문이 단일 표현식이면 블록과 `return`을 생략할 수 있습니다.

```kotlin
fun double(x: Int): Int = x * 2

// 반환 타입도 추론 가능
fun double(x: Int) = x * 2

// 복잡한 표현식도 가능
fun max(a: Int, b: Int) = if (a > b) a else b

fun describe(n: Int) = when {
    n < 0  -> "음수"
    n == 0 -> "0"
    else   -> "양수"
}
```

블록이 있는 함수는 반환 타입을 항상 명시해야 합니다 (Unit 제외). 단일 표현식 함수는 추론됩니다.

---

## 기본 매개변수 (Default Parameters)

```kotlin
fun createUser(
    name: String,
    age: Int = 0,
    email: String = "",
    active: Boolean = true,
): String = "User($name, $age, $email, $active)"

createUser("홍길동")                    // User(홍길동, 0, , true)
createUser("홍길동", 30)               // User(홍길동, 30, , true)
createUser("홍길동", 30, "h@mail.com") // User(홍길동, 30, h@mail.com, true)
```

Java처럼 오버로드를 여러 개 만들 필요가 없습니다. `@JvmOverloads`를 붙이면 Java에서 호출 가능한 오버로드가 자동 생성됩니다.

```kotlin
@JvmOverloads
fun createUser(
    name: String,
    age: Int = 0,
    email: String = "",
): String = "..."
// Java에서: createUser("홍길동"), createUser("홍길동", 30) 모두 가능
```

---

## 명명 인자 (Named Arguments)

인자를 이름으로 지정해서 전달합니다.

```kotlin
fun sendEmail(
    to: String,
    subject: String,
    body: String,
    cc: String = "",
    bcc: String = "",
) { /* ... */ }

// 순서 상관없이, 필요한 것만
sendEmail(
    to = "user@example.com",
    subject = "안녕하세요",
    body = "내용입니다",
    bcc = "admin@example.com",  // cc는 건너뜀
)
```

명명 인자의 장점:
- 인자 순서를 기억하지 않아도 됩니다
- 불리언 플래그 등 의미를 명확히 할 수 있습니다
- 기본 매개변수를 선택적으로 건너뛸 수 있습니다

```kotlin
// 명명 인자 없이 — 무슨 의미인지 불명확
processUser("홍길동", true, false, true)

// 명명 인자 있음 — 의도가 명확
processUser(
    name = "홍길동",
    isActive = true,
    sendEmail = false,
    notify = true,
)
```

### 위치 인자와 혼용

명명 인자 뒤에는 위치 인자를 쓸 수 없습니다.

```kotlin
fun f(a: Int, b: Int, c: Int) {}

f(1, b = 2, c = 3)   // OK — 위치 후 명명
f(a = 1, 2, 3)       // 컴파일 에러 — 명명 후 위치 불가 (Kotlin 1.x)
// Kotlin 2.0에서는 가능한 경우 허용
```

---

## 가변 인자 (`vararg`)

```kotlin
fun sum(vararg numbers: Int): Int = numbers.sum()

sum(1, 2, 3)          // 6
sum(1, 2, 3, 4, 5)    // 15
sum()                  // 0

// 함수 안에서 numbers는 IntArray
fun printAll(vararg items: String) {
    for (item in items) println(item)  // Array처럼 순회
    println(items.size)
}
```

### 배열을 vararg에 전달 — 스프레드 연산자 `*`

```kotlin
val nums = intArrayOf(1, 2, 3)
sum(*nums)            // 스프레드로 펼치기

// 앞뒤에 추가 인자도 가능
sum(0, *nums, 4, 5)  // 0+1+2+3+4+5 = 15
```

### vararg 위치

`vararg`는 보통 마지막 파라미터로 씁니다. 중간에 쓰면 이후 인자는 명명 인자로만 전달 가능합니다.

```kotlin
fun log(level: String, vararg messages: String, separator: String = "\n") {
    println("[$level] ${messages.joinToString(separator)}")
}

log("INFO", "시작", "처리중", separator = " | ")
// [INFO] 시작 | 처리중
```

---

## 지역 함수 (Local Function)

함수 안에 함수를 정의합니다. 외부 함수의 변수를 캡처할 수 있습니다.

```kotlin
fun processUser(userId: String): Result<User> {
    // 반복되는 검증 로직을 지역 함수로 추출
    fun validateId(id: String) {
        require(id.isNotBlank()) { "ID는 비어있을 수 없습니다" }
        require(id.length <= 50) { "ID가 너무 깁니다: ${id.length}" }
    }

    validateId(userId)   // 지역 함수 호출

    return runCatching { userRepository.find(userId) }
}
```

### 외부 변수 캡처

```kotlin
fun buildReport(items: List<Item>): String {
    val errors = mutableListOf<String>()

    fun validate(item: Item) {
        if (item.price < 0) errors.add("${item.name}: 가격 음수")  // 외부 변수 캡처
        if (item.stock < 0) errors.add("${item.name}: 재고 음수")
    }

    items.forEach { validate(it) }

    return if (errors.isEmpty()) "정상" else errors.joinToString("\n")
}
```

### 지역 함수 vs private 함수

| | 지역 함수 | private 함수 |
|--|---------|------------|
| 접근 범위 | 선언된 함수 안 | 파일/클래스 안 |
| 외부 변수 캡처 | 가능 | 불가 (인자로만) |
| 재귀 | 가능 | 가능 |
| 적합한 경우 | 외부 변수 접근 필요, 매우 지역적 | 여러 곳에서 재사용 |

---

## 최상위 함수 (Top-level Function)

Kotlin은 클래스 밖에서 함수를 선언할 수 있습니다.

```kotlin
// utils.kt
package com.example.utils

fun formatDate(date: LocalDate): String = date.toString()
fun isValidEmail(email: String): Boolean = email.contains("@")
```

JVM에서는 파일명 기반의 클래스로 컴파일됩니다 (`UtilsKt`). `@JvmName`으로 이름을 변경할 수 있습니다.

```kotlin
@file:JvmName("Utils")  // 파일 최상단에
package com.example.utils

fun formatDate(...) { ... }
// Java에서: Utils.formatDate(...)
```

---

## tailrec — 꼬리 재귀 최적화

마지막 연산이 재귀 호출인 함수에 `tailrec`을 붙이면 컴파일러가 루프로 최적화합니다. 스택 오버플로 없이 깊은 재귀가 가능합니다.

```kotlin
// tailrec 없으면 깊은 n에서 스택 오버플로
tailrec fun factorial(n: Long, acc: Long = 1): Long =
    if (n <= 1) acc
    else factorial(n - 1, n * acc)

factorial(100000)   // OK — 스택 오버플로 없음

// tailrec 조건: 재귀 호출이 함수의 마지막 연산이어야 함
// tailrec fun bad(n: Int): Int = bad(n - 1) + 1  // 컴파일 에러 — 마지막이 + 1
```

---

## 정리

| 기능 | 핵심 |
|------|------|
| 단일 표현식 함수 | 블록/return 생략, 반환 타입 추론 |
| 기본 매개변수 | Java 오버로드 대체 |
| 명명 인자 | 순서 무관, 가독성 향상 |
| `vararg` | 가변 인자, 내부에서 배열로 사용 |
| 지역 함수 | 외부 변수 캡처 가능, 매우 지역적 로직에 사용 |
| `tailrec` | 꼬리 재귀 → 루프로 최적화 |
