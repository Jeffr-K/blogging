---
title: "[Kotlin 시리즈] 3. Null 안전성"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "null안전성", "nullable", "엘비스연산자", "스마트캐스트"]
---

# Null 안전성

Java에서 `NullPointerException`은 "십억 달러짜리 실수"라 불립니다. Kotlin은 **null 가능성을 타입 시스템에 내장**해서 컴파일 타임에 대부분의 NPE를 잡아냅니다.

## Nullable 타입 (`T?`)

Kotlin에서 기본 타입은 `null`을 허용하지 않습니다.

```kotlin
var name: String = "홍길동"
name = null     // 컴파일 에러

var nullableName: String? = "홍길동"
nullableName = null     // OK
```

`?`를 붙이면 null을 허용하는 타입이 됩니다.

```kotlin
// 함수 파라미터와 반환 타입에도 적용
fun findUser(id: String): User? {  // 못 찾으면 null 반환
    return users.find { it.id == id }
}

fun greet(name: String?) {         // null 받을 수 있음
    // name을 사용하려면 null 체크 필요
}
```

---

## null 체크 방법들

### 1. 일반 if 체크

```kotlin
val name: String? = getName()

if (name != null) {
    println(name.length)  // 이 블록 안에서는 String으로 스마트 캐스트
}
```

이 안에서 `name`은 `String?`이 아닌 `String`으로 추론됩니다. 이것이 **스마트 캐스트**입니다.

### 2. 안전 호출 연산자 (`?.`)

null이면 전체 표현식이 `null`을 반환하고, null이 아니면 함수를 호출합니다.

```kotlin
val name: String? = "홍길동"

val length: Int? = name?.length    // name이 null이면 null, 아니면 length
val upper: String? = name?.uppercase()

// 체이닝 가능
data class Address(val city: String?)
data class User(val address: Address?)

val user: User? = getUser()
val city: String? = user?.address?.city   // 중간에 null이면 null
```

### 3. 엘비스 연산자 (`?:`)

null일 때 **기본값**을 제공합니다.

```kotlin
val name: String? = null
val display = name ?: "이름 없음"   // "이름 없음"

// 안전 호출과 함께
val length = name?.length ?: 0      // null이면 0

// 엘비스 오른쪽에 throw나 return도 가능
fun process(name: String?) {
    val validName = name ?: return           // null이면 함수 종료
    val nonEmpty = name.takeIf { it.isNotBlank() } ?: throw IllegalArgumentException("빈 이름")
}
```

### 4. Not-null 단언 (`!!`)

null이 아님을 **강제로 단언**합니다. null이면 `NullPointerException`을 던집니다.

```kotlin
val name: String? = "홍길동"
val length = name!!.length   // name이 null이면 NPE

// 나쁜 패턴 — !! 남용
val result = getUser()!!.address!!.city!!   // NPE 위치 추적 어려움
```

`!!`는 "null이 절대 아님을 내가 보장한다"는 의미입니다. 컴파일러를 믿지 않는 것이므로 최대한 피하고, 정말 null이 불가능하다고 확신할 때만 씁니다.

### 5. `let`과 함께

null이 아닐 때만 블록을 실행하고 싶을 때 씁니다.

```kotlin
val name: String? = "홍길동"

name?.let {
    println("이름 길이: ${it.length}")   // null이 아닐 때만 실행
    println("대문자: ${it.uppercase()}")
}

// 결과를 사용해야 할 때
val result: Int? = name?.let { it.length * 2 }
```

여러 nullable을 동시에 처리할 때:

```kotlin
val firstName: String? = "길동"
val lastName: String? = "홍"

// 둘 다 null이 아닐 때만
if (firstName != null && lastName != null) {
    println("$lastName$firstName")
}

// 더 코틀린스럽게
val fullName = if (firstName != null && lastName != null) "$lastName$firstName" else null
```

---

## 안전 캐스트 (`as?`)

타입 캐스트 실패 시 예외 대신 `null`을 반환합니다.

```kotlin
val obj: Any = "문자열"

val str: String? = obj as? String    // "문자열"
val num: Int? = obj as? Int          // null (캐스트 실패)

// 일반 as는 실패 시 ClassCastException
val fail: Int = obj as Int           // ClassCastException!
```

---

## `requireNotNull` / `checkNotNull`

`!!`보다 더 나은 대안입니다. **의미 있는 에러 메시지**를 제공합니다.

```kotlin
val name: String? = null

// requireNotNull — 조건 위반 시 IllegalArgumentException
val validName: String = requireNotNull(name) { "사용자 이름은 필수입니다" }

// checkNotNull — 조건 위반 시 IllegalStateException
val validName2: String = checkNotNull(name) { "이름이 초기화되지 않았습니다" }

// !! vs requireNotNull
name!!.length               // NPE: null 위치만 알 수 있음
requireNotNull(name).length // IAE: 무엇이 null인지, 왜 안 되는지 명시
```

`require`/`check`의 차이:
- `requireNotNull` — 함수 인자 검증 (잘못된 입력 → `IllegalArgumentException`)
- `checkNotNull` — 객체 상태 검증 (잘못된 상태 → `IllegalStateException`)

---

## 플랫폼 타입 (Platform Type)

Java 코드와 상호운용할 때 발생합니다. Kotlin이 null 여부를 알 수 없는 타입입니다.

```java
// Java
public class JavaUser {
    public String getName() { return null; }  // null 반환 가능
}
```

```kotlin
// Kotlin
val user = JavaUser()
val name = user.name  // 타입이 String! (플랫폼 타입) — null일 수도 있음
name.length           // 컴파일은 되지만 NPE 가능
```

플랫폼 타입(`String!`)은 `String` 또는 `String?` 중 어느 것으로도 사용할 수 있습니다. Java 코드에 `@Nullable` / `@NotNull` 애노테이션이 있으면 Kotlin이 인식합니다.

```java
// @Nullable 애노테이션 있으면 Kotlin이 String?로 인식
@Nullable
public String getName() { return null; }
```

---

## `takeIf` / `takeUnless`

조건을 만족할 때만 값을 반환합니다.

```kotlin
val name = "홍길동"

val result = name.takeIf { it.length > 2 }    // "홍길동" (조건 충족)
val result2 = name.takeIf { it.length > 10 }  // null (조건 미충족)

// takeUnless — 조건이 false일 때 반환
val result3 = name.takeUnless { it.isBlank() } // "홍길동"

// 활용
fun processName(input: String?) {
    val name = input
        ?.takeIf { it.isNotBlank() }
        ?.trim()
        ?: return  // null이면 종료
    println("처리: $name")
}
```

---

## 확정 비-nullable 타입 (`T & Any`)

제네릭 타입 파라미터에서 "이 타입은 null이 아님"을 강제할 때 씁니다. Kotlin 1.7+에서 도입됐습니다.

```kotlin
// T가 nullable일 수 있는 제네릭 함수
fun <T> process(value: T): T {
    return value  // T가 null일 수 있음
}

// T & Any — T는 무엇이든 되지만 null은 불허
fun <T : Any?> processNonNull(value: T & Any): T & Any {
    return value  // null 아님 보장
}

processNonNull("hello")   // OK
processNonNull(null)      // 컴파일 에러
```

---

## null 처리 패턴 비교

```kotlin
val name: String? = getName()

// 패턴 1: if-null 반환 (early return)
fun greet(name: String?) {
    if (name == null) return
    println("Hello, $name!")   // 이후로 String으로 스마트 캐스트
}

// 패턴 2: 엘비스 기본값
val display = name ?: "익명"

// 패턴 3: let으로 null 아닐 때 처리
name?.let { validName ->
    sendEmail(validName)
    logAccess(validName)
}

// 패턴 4: 조건 연산자
val length = name?.length ?: 0
val upper = name?.uppercase() ?: ""

// 패턴 5: when으로 명시적 분기
when (name) {
    null -> println("이름 없음")
    else -> println("이름: $name")
}
```

---

## 정리

| 연산자/문법 | 용도 | null일 때 |
|------------|------|----------|
| `T?` | nullable 타입 선언 | — |
| `?.` | 안전 호출 | null 반환 |
| `?:` | 기본값 제공 (엘비스) | 오른쪽 값 반환 |
| `!!` | null 아님 강제 단언 | NPE 발생 |
| `as?` | 안전 캐스트 | null 반환 |
| `requireNotNull` | 인자 검증 | IAE 발생 |
| `checkNotNull` | 상태 검증 | ISE 발생 |
| `takeIf` | 조건부 반환 | null 반환 |

**실무 원칙:**
1. `!!`는 최대한 피합니다. `requireNotNull` 또는 `?:` + `return`/`throw`로 대체합니다.
2. Java 코드를 쓸 때는 플랫폼 타입에 주의합니다. `@Nullable`/`@NotNull`을 붙이거나 방어적으로 처리합니다.
3. `?.` 체이닝이 너무 길어지면 코드를 분해하거나 `let`을 활용합니다.
