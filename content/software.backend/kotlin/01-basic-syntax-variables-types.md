---
title: "[Kotlin 시리즈] 1. 기초 문법 — 변수, 타입, 문자열"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "기초문법", "변수", "타입", "문자열"]
---

# 기초 문법 1 — 변수, 타입, 문자열

## 패키지와 임포트

```kotlin
package com.example.app         // 파일 최상단에 선언

import kotlin.math.sqrt         // 단일 임포트
import kotlin.math.*            // 와일드카드 임포트
import java.util.Date as JDate  // 별칭 임포트 (충돌 방지)
```

패키지 선언은 선택 사항입니다. 없으면 기본 패키지에 속합니다. 파일명과 클래스명이 달라도 됩니다.

---

## 변수

### val — 불변 참조

```kotlin
val name = "홍길동"     // 타입 추론
val age: Int = 30       // 타입 명시

name = "김영희"          // 컴파일 에러 — 재할당 불가
```

`val`은 Java의 `final`과 유사합니다. **참조**가 불변이지, 참조하는 객체의 내부 상태는 변경될 수 있습니다.

```kotlin
val list = mutableListOf(1, 2, 3)
list.add(4)  // OK — list가 가리키는 객체를 변경하는 것
list = mutableListOf()  // 컴파일 에러 — 참조 자체는 변경 불가
```

### var — 가변 참조

```kotlin
var count = 0
count = 1     // OK
count += 1    // OK
```

기본적으로 `val`을 쓰고, 재할당이 필요할 때만 `var`을 씁니다.

### const val — 컴파일 타임 상수

```kotlin
const val MAX_SIZE = 100          // 최상위 레벨
const val APP_NAME = "MyApp"

object Config {
    const val BASE_URL = "https://api.example.com"  // object 안
}
```

`const val`의 제약:
- 최상위 레벨 또는 `object`/`companion object` 안에서만 선언 가능
- 타입은 원시 타입 또는 `String`만 가능
- 런타임이 아닌 컴파일 타임에 값이 결정됨 — 애노테이션 인자로 사용 가능

```kotlin
@SomeAnnotation(MAX_SIZE)      // const val은 애노테이션 인자로 사용 가능
fun foo() {}

// @SomeAnnotation(someVal)    // val은 불가 — 컴파일 에러
```

### 타입 추론

```kotlin
val x = 42          // Int
val y = 3.14        // Double
val z = "hello"     // String
val flag = true     // Boolean

// 타입이 모호할 때는 명시
val longVal: Long = 42
val floatVal: Float = 3.14f
```

---

## 기본 타입

Kotlin의 기본 타입은 모두 클래스입니다. JVM에서는 가능한 경우 원시 타입(`int`, `long` 등)으로 컴파일됩니다.

### 정수형

```kotlin
val byteVal: Byte   = 127               // -128 ~ 127
val shortVal: Short = 32767             // -32768 ~ 32767
val intVal: Int     = 2_147_483_647     // 약 ±21억 (언더스코어로 가독성)
val longVal: Long   = 9_223_372_036_854_775_807L  // L 접미사

// 진수 리터럴
val hex = 0xFF          // 16진수
val binary = 0b1010     // 2진수
```

### 부동소수형

```kotlin
val doubleVal: Double = 3.14       // 기본 부동소수
val floatVal: Float   = 3.14f      // f 접미사 필수

val scientific = 1.5e10            // 1.5 × 10^10
```

### Boolean

```kotlin
val isActive: Boolean = true
val isEmpty = false

// 논리 연산
val result = isActive && !isEmpty   // AND, NOT
val either = isActive || isEmpty    // OR
```

### Char

```kotlin
val letter: Char = 'A'
val newline: Char = '\n'
val unicode: Char = '\uFF00'

// Char는 숫자가 아님 — 명시적 변환 필요
val code: Int = letter.code   // 65
val char: Char = 65.toChar()  // 'A'
```

### 타입 변환

Kotlin은 **암묵적 타입 변환이 없습니다**. 항상 명시적으로 변환해야 합니다.

```kotlin
val int: Int = 42
val long: Long = int          // 컴파일 에러
val long2: Long = int.toLong()  // OK

// 변환 함수
42.toByte()
42.toShort()
42.toInt()
42.toLong()
42.toFloat()
42.toDouble()
42.toChar()
```

### Any, Unit, Nothing

```kotlin
// Any — 모든 non-null 타입의 루트 (Java의 Object와 유사)
val anything: Any = "문자열도 되고"
val also: Any = 42              // 숫자도 됨

// Unit — 반환값 없음 (Java의 void에 대응, 하지만 실제 타입)
fun printHello(): Unit {
    println("Hello")
}
fun printHello2() {  // Unit 생략 가능
    println("Hello")
}

// Nothing — 정상적으로 반환되지 않는 함수의 타입
fun fail(message: String): Nothing {
    throw IllegalStateException(message)
}

fun infiniteLoop(): Nothing {
    while (true) { }
}

// Nothing의 활용: 엘비스 연산자와 함께
val name = nullableName ?: fail("이름이 없습니다")
// name은 String으로 추론됨 (Nothing은 모든 타입의 서브타입)
```

---

## 문자열

### 기본 문자열

```kotlin
val str = "Hello, World!"

// 인덱스 접근
val first: Char = str[0]    // 'H'
val last: Char = str.last() // '!'

// 길이
val len: Int = str.length

// 반복
for (c in str) {
    print(c)
}
```

### 문자열 템플릿

```kotlin
val name = "홍길동"
val age = 30

// $ 변수
println("이름: $name")          // 이름: 홍길동

// ${} 표현식
println("내년 나이: ${age + 1}") // 내년 나이: 31
println("대문자: ${name.uppercase()}")

// $ 자체를 출력하려면
println("가격: ${'$'}1,000")    // 가격: $1,000
```

### 멀티라인 문자열

```kotlin
val text = """
    SELECT *
    FROM users
    WHERE id = 1
""".trimIndent()
// 들여쓰기 제거, 앞뒤 개행 제거

val text2 = """
    |첫 번째 줄
    |두 번째 줄
    |세 번째 줄
""".trimMargin("|")
// | 앞의 공백과 | 제거
```

### 멀티 달러 보간 (`$$`) — Kotlin 2.0

문자열 안에 `$`를 리터럴로 포함해야 할 때 유용합니다.

```kotlin
// 기존 방식 — 번거로움
val template = "가격은 ${'$'}{price}원 입니다"

// Kotlin 2.0 — $$ 접두사로 보간 기호 변경
val template2 = $$"가격은 ${price}원 입니다"
// $$가 붙으면 $$ 두 개로 변수 접근, $ 하나는 리터럴
```

### 주요 문자열 함수

```kotlin
val str = "  Hello, Kotlin!  "

str.trim()                    // "Hello, Kotlin!"
str.trimStart()               // "Hello, Kotlin!  "
str.trimEnd()                 // "  Hello, Kotlin!"
str.uppercase()               // "  HELLO, KOTLIN!  "
str.lowercase()               // "  hello, kotlin!  "
str.replace("Kotlin", "World") // "  Hello, World!  "
str.contains("Kotlin")        // true
str.startsWith("  Hello")     // true
str.endsWith("!  ")           // true
str.split(", ")               // ["  Hello", "Kotlin!  "]
str.substring(2, 7)           // "Hello"
str.isEmpty()                 // false
str.isBlank()                 // false (공백만 있으면 true)
"".isEmpty()                  // true
"   ".isBlank()               // true
```

---

## 배열

### 기본 배열

```kotlin
// 타입 파라미터 배열
val names: Array<String> = arrayOf("Alice", "Bob", "Carol")
val nums: Array<Int> = arrayOf(1, 2, 3)  // 박싱됨 (Integer[])

// 크기로 생성
val zeros = Array(5) { 0 }           // [0, 0, 0, 0, 0]
val squares = Array(5) { i -> i * i } // [0, 1, 4, 9, 16]

// 빈 배열
val empty = emptyArray<String>()
```

### 원시 타입 배열 — 박싱 없음

```kotlin
val intArr: IntArray = intArrayOf(1, 2, 3)     // int[] (JVM)
val longArr: LongArray = longArrayOf(1L, 2L)
val doubleArr: DoubleArray = doubleArrayOf(1.0, 2.0)
val boolArr: BooleanArray = booleanArrayOf(true, false)

// 크기로 생성
val intArr2 = IntArray(5)          // [0, 0, 0, 0, 0]
val intArr3 = IntArray(5) { it * 2 } // [0, 2, 4, 6, 8]
```

`Array<Int>` vs `IntArray` — 성능이 중요한 코드에서는 `IntArray`를 씁니다. `Array<Int>`는 `Integer[]`로 컴파일되어 박싱 오버헤드가 있습니다.

### 배열 접근

```kotlin
val arr = intArrayOf(10, 20, 30, 40, 50)

arr[0]            // 10
arr[arr.size - 1] // 50
arr.last()        // 50
arr.first()       // 10
arr.size          // 5

// 수정
arr[0] = 100

// 순회
for (x in arr) print(x)
arr.forEach { print(it) }
arr.forEachIndexed { i, v -> println("$i: $v") }
```

### 배열 → 컬렉션

```kotlin
val arr = intArrayOf(1, 2, 3)
val list: List<Int> = arr.toList()
val mutableList = arr.toMutableList()

// 반대
val backToArr = list.toIntArray()
```

---

## 정리

| 구분 | 내용 |
|------|------|
| `val` | 불변 참조 — 기본으로 사용 |
| `var` | 가변 참조 — 필요할 때만 |
| `const val` | 컴파일 타임 상수 — 최상위/object 안 |
| 암묵적 변환 | 없음 — `toLong()` 등 명시적 변환 필요 |
| `Nothing` | 정상 반환 없는 함수의 타입 |
| `IntArray` | 원시 타입 배열 — `Array<Int>`보다 성능 유리 |

다음 아티클에서는 범위(Range), 구조 분해, 스프레드 연산자를 다룹니다.
