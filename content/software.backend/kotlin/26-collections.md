---
title: "[Kotlin 시리즈] 26. 컬렉션 API"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "collections", "list", "set", "map", "filter", "map", "fold", "groupBy"]
---

# 컬렉션 API

## 불변 vs 가변

```kotlin
// 불변 — 읽기 전용 (내부적으로 같은 JVM 클래스지만 수정 API 없음)
val list: List<Int> = listOf(1, 2, 3)
val set: Set<String> = setOf("a", "b", "c")
val map: Map<String, Int> = mapOf("a" to 1, "b" to 2)

// 가변
val mList: MutableList<Int> = mutableListOf(1, 2, 3)
val mSet: MutableSet<String> = mutableSetOf("a", "b")
val mMap: MutableMap<String, Int> = mutableMapOf("a" to 1)

mList.add(4)
mMap["c"] = 3
```

### 특수 구현체

```kotlin
// List
ArrayList<Int>()
buildList { add(1); add(2) }

// Set
linkedSetOf(1, 2, 3)    // 순서 유지
sortedSetOf(3, 1, 2)    // 정렬 유지 (TreeSet)

// Map
linkedMapOf("a" to 1)   // 순서 유지
sortedMapOf("b" to 2)   // 키 정렬 (TreeMap)
```

---

## 변환 (Transformation)

### map / mapNotNull / mapIndexed

```kotlin
val nums = listOf(1, 2, 3, 4, 5)

nums.map { it * 2 }            // [2, 4, 6, 8, 10]
nums.mapIndexed { i, v -> "$i:$v" }  // ["0:1", "1:2", ...]

val strings = listOf("1", "abc", "2", "def", "3")
strings.mapNotNull { it.toIntOrNull() }  // [1, 2, 3] — null 제거
```

### flatMap / flatten

```kotlin
val nested = listOf(listOf(1, 2), listOf(3, 4), listOf(5))
nested.flatten()              // [1, 2, 3, 4, 5]
nested.flatMap { it.map { n -> n * 2 } }  // [2, 4, 6, 8, 10]

val words = listOf("Hello World", "Kotlin Coroutines")
words.flatMap { it.split(" ") }  // ["Hello", "World", "Kotlin", "Coroutines"]
```

### associate / associateBy / associateWith

```kotlin
data class User(val id: Int, val name: String)
val users = listOf(User(1, "Alice"), User(2, "Bob"), User(3, "Carol"))

// associateBy — 키 추출
users.associateBy { it.id }
// {1=User(1, Alice), 2=User(2, Bob), 3=User(3, Carol)}

// associateWith — 값 추출
users.associateWith { it.name.length }
// {User(1, Alice)=5, User(2, Bob)=3, User(3, Carol)=5}

// associate — 키-값 모두 지정
users.associate { it.id to it.name }
// {1=Alice, 2=Bob, 3=Carol}
```

### groupBy

```kotlin
data class Product(val name: String, val category: String, val price: Int)

val products = listOf(
    Product("사과", "과일", 1000),
    Product("바나나", "과일", 1500),
    Product("당근", "채소", 800),
    Product("시금치", "채소", 700),
)

val byCategory: Map<String, List<Product>> = products.groupBy { it.category }
// {과일=[사과, 바나나], 채소=[당근, 시금치]}

// 값도 변환
val pricesByCategory: Map<String, List<Int>> =
    products.groupBy({ it.category }, { it.price })
// {과일=[1000, 1500], 채소=[800, 700]}
```

### partition

```kotlin
val (evens, odds) = listOf(1, 2, 3, 4, 5, 6).partition { it % 2 == 0 }
// evens=[2, 4, 6], odds=[1, 3, 5]
```

### zip / unzip

```kotlin
val names = listOf("Alice", "Bob", "Carol")
val scores = listOf(90, 85, 95)

names.zip(scores)          // [(Alice, 90), (Bob, 85), (Carol, 95)]
names.zip(scores) { name, score -> "$name: $score" }
// ["Alice: 90", "Bob: 85", "Carol: 95"]

val pairs = listOf("A" to 1, "B" to 2, "C" to 3)
val (keys, values) = pairs.unzip()
// keys=["A", "B", "C"], values=[1, 2, 3]
```

### chunked / windowed

```kotlin
(1..10).toList().chunked(3)
// [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]

(1..5).toList().windowed(3)
// [[1, 2, 3], [2, 3, 4], [3, 4, 5]]

(1..5).toList().windowed(3, step = 2)
// [[1, 2, 3], [3, 4, 5]]

(1..5).toList().windowed(3, partialWindows = true)
// [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5], [5]]
```

---

## 필터 (Filtering)

```kotlin
val nums = listOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)

nums.filter { it % 2 == 0 }                    // [2, 4, 6, 8, 10]
nums.filterNot { it % 2 == 0 }                 // [1, 3, 5, 7, 9]
nums.filterIndexed { i, v -> i % 2 == 0 }      // 짝수 인덱스 [1, 3, 5, 7, 9]

val mixed: List<Any?> = listOf(1, null, "a", null, 2)
mixed.filterNotNull()                           // [1, "a", 2]
mixed.filterIsInstance<String>()               // ["a"]
```

---

## 집계 (Aggregation)

### fold / reduce

```kotlin
val nums = listOf(1, 2, 3, 4, 5)

nums.reduce { acc, n -> acc + n }    // 15 — 첫 번째 요소가 초기값
nums.fold(0) { acc, n -> acc + n }   // 15 — 초기값 명시
nums.fold(1) { acc, n -> acc * n }   // 120 — 팩토리얼

// foldRight — 오른쪽부터
nums.foldRight(0) { n, acc -> n + acc }  // 15
```

### runningFold / runningReduce (scan)

중간 과정을 모두 반환합니다.

```kotlin
listOf(1, 2, 3, 4, 5).runningFold(0) { acc, n -> acc + n }
// [0, 1, 3, 6, 10, 15]

listOf(1, 2, 3, 4, 5).runningReduce { acc, n -> acc + n }
// [1, 3, 6, 10, 15]
```

### 수치 집계

```kotlin
val nums = listOf(3, 1, 4, 1, 5, 9, 2, 6)

nums.sum()          // 31
nums.sumOf { it.toDouble() }  // 31.0
nums.average()      // 3.875
nums.count()        // 8
nums.count { it > 4 }  // 3
nums.min()          // 1
nums.max()          // 9
nums.minOrNull()    // 1 (빈 리스트 안전)
nums.maxOrNull()    // 9

data class Item(val name: String, val price: Int)
val items = listOf(Item("a", 100), Item("b", 300), Item("c", 200))

items.minBy { it.price }    // Item(a, 100)
items.maxBy { it.price }    // Item(b, 300)
items.sumOf { it.price }    // 600
```

---

## 검색 (Search)

```kotlin
val nums = listOf(1, 2, 3, 4, 5)

nums.find { it > 3 }           // 4 (첫 번째 매치)
nums.findLast { it > 3 }       // 5 (마지막 매치)
nums.first { it > 3 }          // 4 (없으면 예외)
nums.firstOrNull { it > 10 }   // null

nums.any { it > 4 }            // true
nums.all { it > 0 }            // true
nums.none { it > 10 }          // true

nums.contains(3)               // true
nums.indexOf(3)                // 2
nums.lastIndexOf(3)            // 2
nums.indexOfFirst { it % 2 == 0 }  // 1
nums.indexOfLast { it % 2 == 0 }   // 3

val list = listOf(1, 2, 3, 2, 1)
list.single { it == 3 }         // 3 (하나만 매치)
list.singleOrNull { it == 5 }   // null
// list.single { it == 2 }      // 예외 — 2개 매치
```

---

## 정렬 (Sorting)

```kotlin
val nums = listOf(3, 1, 4, 1, 5, 9)

nums.sorted()              // [1, 1, 3, 4, 5, 9]
nums.sortedDescending()    // [9, 5, 4, 3, 1, 1]
nums.reversed()            // [9, 5, 1, 4, 1, 3]
nums.shuffled()            // 임의 순서

data class Person(val name: String, val age: Int)
val people = listOf(Person("Charlie", 30), Person("Alice", 25), Person("Bob", 35))

people.sortedBy { it.age }
// [Alice(25), Charlie(30), Bob(35)]

people.sortedByDescending { it.name }
// [Charlie, Bob, Alice]

people.sortedWith(compareBy({ it.age }, { it.name }))
// 나이 → 이름 순 다중 정렬
```

---

## 슬라이싱 (Slicing)

```kotlin
val list = listOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)

list.take(3)             // [1, 2, 3]
list.takeLast(3)         // [8, 9, 10]
list.takeWhile { it < 5 }  // [1, 2, 3, 4]

list.drop(3)             // [4, 5, 6, 7, 8, 9, 10]
list.dropLast(3)         // [1, 2, 3, 4, 5, 6, 7]
list.dropWhile { it < 5 }  // [5, 6, 7, 8, 9, 10]

list.slice(2..5)         // [3, 4, 5, 6]
list.slice(listOf(0, 2, 4))  // [1, 3, 5]
```

---

## 집합 연산

```kotlin
val a = listOf(1, 2, 3, 4, 5)
val b = listOf(3, 4, 5, 6, 7)

a + b                // [1, 2, 3, 4, 5, 3, 4, 5, 6, 7]
a - b                // [1, 2]

a.intersect(b.toSet())  // {3, 4, 5}
a.union(b.toSet())      // {1, 2, 3, 4, 5, 6, 7}
a.subtract(b.toSet())   // {1, 2}

a.distinct()            // 중복 제거
listOf(1, 2, 1, 3, 2).distinctBy { it % 2 }  // [1, 2]
```

---

## 컬렉션 빌더

```kotlin
val list = buildList {
    add(1)
    add(2)
    addAll(listOf(3, 4))
    if (true) add(5)
}

val map = buildMap {
    put("a", 1)
    put("b", 2)
    putAll(mapOf("c" to 3))
}

val set = buildSet {
    add("x")
    addAll(listOf("y", "z"))
}
```

---

## 문자열 변환

```kotlin
val list = listOf("apple", "banana", "cherry")

list.joinToString()                    // "apple, banana, cherry"
list.joinToString(", ", "[", "]")      // "[apple, banana, cherry]"
list.joinToString("\n") { it.uppercase() }
// "APPLE\nBANANA\nCHERRY"
list.joinToString(limit = 2, truncated = "...")
// "apple, banana, ..."
```

---

## 컬렉션 변환

```kotlin
val list = listOf(1, 2, 3)

list.toList()          // 복사본
list.toMutableList()   // 가변 복사본
list.toSet()           // Set으로 (중복 제거)
list.toSortedSet()     // 정렬된 Set
list.toTypedArray()    // Array로

val map = mapOf("a" to 1, "b" to 2)
map.toList()           // [("a", 1), ("b", 2)]
map.toMutableMap()     // 가변 복사본
```

---

## 정리

| 카테고리 | 주요 함수 |
|---------|---------|
| 변환 | `map`, `flatMap`, `mapNotNull`, `associate`, `groupBy`, `zip` |
| 필터 | `filter`, `filterNot`, `filterIsInstance`, `partition` |
| 집계 | `fold`, `reduce`, `sum`, `count`, `min`, `max` |
| 검색 | `find`, `first`, `any`, `all`, `none`, `contains` |
| 정렬 | `sorted`, `sortedBy`, `sortedWith`, `reversed` |
| 슬라이스 | `take`, `drop`, `slice`, `chunked`, `windowed` |
| 집합 | `distinct`, `intersect`, `union`, `subtract` |
| 기타 | `joinToString`, `runningFold`, `scan` |
