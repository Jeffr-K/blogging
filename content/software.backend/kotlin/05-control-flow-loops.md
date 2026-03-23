---
title: "[Kotlin 시리즈] 5. 제어 흐름 — 반복문과 점프"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "제어흐름", "반복문", "for", "while", "레이블", "break", "continue"]
---

# 제어 흐름 — 반복문과 점프

## for 루프

Kotlin의 `for`는 **이터레이터(Iterator)**를 가진 모든 것을 순회합니다. Java의 enhanced for와 유사하지만 더 강력합니다.

### 범위 순회

```kotlin
for (i in 1..5) print("$i ")       // 1 2 3 4 5
for (i in 1..<5) print("$i ")      // 1 2 3 4
for (i in 5 downTo 1) print("$i ") // 5 4 3 2 1
for (i in 1..10 step 2) print("$i ") // 1 3 5 7 9
```

### 컬렉션 순회

```kotlin
val names = listOf("Alice", "Bob", "Carol")

for (name in names) {
    println(name)
}
```

### 인덱스와 함께 — `withIndex()`

```kotlin
for ((index, name) in names.withIndex()) {
    println("$index: $name")
}
// 0: Alice
// 1: Bob
// 2: Carol
```

### Map 순회

```kotlin
val scores = mapOf("Alice" to 95, "Bob" to 87, "Carol" to 92)

for ((name, score) in scores) {
    println("$name: $score점")
}
```

### 배열 순회

```kotlin
val arr = intArrayOf(10, 20, 30)

for (value in arr) {
    println(value)
}

// 인덱스만 필요하면
for (i in arr.indices) {
    println("arr[$i] = ${arr[i]}")
}
```

### for가 가능한 이유 — `iterator()` 관례

`iterator()` 함수를 `operator`로 구현한 타입이면 `for`로 순회할 수 있습니다.

```kotlin
class NumberRange(val start: Int, val end: Int) {
    operator fun iterator(): Iterator<Int> = object : Iterator<Int> {
        var current = start
        override fun hasNext() = current <= end
        override fun next() = current++
    }
}

for (n in NumberRange(1, 5)) print("$n ")  // 1 2 3 4 5
```

---

## while / do-while

```kotlin
var i = 0

// 조건이 true인 동안 반복 — 조건 먼저 평가
while (i < 5) {
    print("$i ")
    i++
}
// 0 1 2 3 4

// 최소 한 번은 실행 — 본문 먼저 실행 후 조건 평가
do {
    print("$i ")
    i++
} while (i < 8)
// 5 6 7
```

---

## repeat

단순히 N번 반복할 때는 `repeat`이 깔끔합니다.

```kotlin
repeat(3) {
    println("반복!")
}
// 반복!
// 반복!
// 반복!

// 인덱스 사용 가능
repeat(5) { index ->
    print("$index ")  // 0 1 2 3 4
}
```

---

## break와 continue

### break — 루프 탈출

```kotlin
for (i in 1..10) {
    if (i == 5) break
    print("$i ")
}
// 1 2 3 4
```

### continue — 이번 이터레이션 건너뜀

```kotlin
for (i in 1..10) {
    if (i % 2 == 0) continue
    print("$i ")
}
// 1 3 5 7 9
```

---

## 레이블 (Label)

중첩 루프에서 **어느 루프**를 대상으로 break/continue할지 지정합니다.

### 레이블 선언 — `이름@`

```kotlin
outer@ for (i in 1..3) {
    for (j in 1..3) {
        if (j == 2) continue@outer   // 바깥 루프의 다음 이터레이션으로
        print("($i,$j) ")
    }
}
// (1,1) (2,1) (3,1)
// j == 2에서 outer 루프로 continue하므로 j == 2, 3은 출력 안 됨
```

```kotlin
outer@ for (i in 1..3) {
    for (j in 1..3) {
        if (i == 2 && j == 2) break@outer  // 바깥 루프 탈출
        print("($i,$j) ")
    }
}
// (1,1) (1,2) (1,3) (2,1)
```

### 레이블 return

람다 안에서 `return`하면 기본적으로 **람다를 감싼 함수**를 반환합니다(비지역 반환). 람다 자체만 종료하려면 레이블을 씁니다.

```kotlin
fun findFirst() {
    listOf(1, 2, 3, 4, 5).forEach {
        if (it == 3) return  // forEach가 아닌 findFirst 함수 자체를 종료!
        print("$it ")
    }
    println("끝")  // 실행 안 됨
}

fun findFirstWithLabel() {
    listOf(1, 2, 3, 4, 5).forEach label@{
        if (it == 3) return@label  // 이 이터레이션만 종료 (continue처럼)
        print("$it ")
    }
    println("끝")  // 실행됨
}

findFirst()           // 1 2
findFirstWithLabel()  // 1 2 4 5 끝
```

암시적 레이블 — 람다를 전달한 함수 이름을 레이블로 쓸 수 있습니다.

```kotlin
listOf(1, 2, 3, 4, 5).forEach {
    if (it == 3) return@forEach  // forEach 이름 그대로 사용
    print("$it ")
}
// 1 2 4 5
```

### 비지역 return (Non-local Return)

`inline` 함수에 전달된 람다에서만 가능합니다. `forEach`, `map`, `filter` 등 표준 라이브러리의 대부분은 `inline`입니다.

```kotlin
fun processList(list: List<Int>): Boolean {
    list.forEach {         // forEach는 inline 함수
        if (it < 0) return false  // processList 함수 자체를 false로 반환
    }
    return true
}
```

`inline`이 아닌 함수에 전달된 람다에서는 비지역 return이 불가합니다.

```kotlin
fun notInline(action: () -> Unit) { action() }  // inline 아님

fun test() {
    notInline {
        return  // 컴파일 에러 — 비지역 return 불가
    }
}
```

---

## 반복문 선택 가이드

| 상황 | 선택 |
|------|------|
| 범위/컬렉션 순회 | `for` |
| 조건 기반 반복 | `while` |
| 최소 1회 실행 보장 | `do-while` |
| 단순 N회 반복 | `repeat` |
| 함수형 처리 | `forEach`, `map`, `filter` |
| 중첩 루프 탈출 | `break@label` |

---

## 정리

- `for`는 `iterator()` 관례를 구현한 모든 타입에 사용 가능
- `repeat(n) { }` — 단순 반복에 적합
- 레이블(`outer@`)로 중첩 루프의 `break`/`continue` 대상 지정
- `return@label` — 람다 안에서 현재 이터레이션만 종료 (continue 효과)
- 비지역 return — `inline` 함수 람다에서만 허용
