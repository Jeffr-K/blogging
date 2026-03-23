---
title: "[Kotlin 시리즈] 27. 시퀀스 (Sequence)"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "sequence", "lazy", "지연평가", "generateSequence", "yield"]
---

# 시퀀스 (Sequence)

## 왜 시퀀스인가

컬렉션 연산은 **즉시 평가(eager)**입니다 — 각 연산마다 중간 컬렉션을 만듭니다.

```kotlin
val result = (1..1_000_000)
    .filter { it % 2 == 0 }   // 중간 List 500_000개 생성
    .map { it * 3 }            // 중간 List 500_000개 생성
    .take(5)                   // [6, 12, 18, 24, 30]
```

`Sequence`는 **지연 평가(lazy)** — 중간 연산을 쌓아두고 최종 연산 시 원소 하나씩 처리합니다.

```kotlin
val result = (1..1_000_000).asSequence()
    .filter { it % 2 == 0 }   // 중간 객체 없음
    .map { it * 3 }            // 중간 객체 없음
    .take(5)                   // 최종 연산 — 10개만 처리
    .toList()                  // [6, 12, 18, 24, 30]
```

---

## 시퀀스 생성

```kotlin
// sequenceOf
val seq = sequenceOf(1, 2, 3, 4, 5)

// 컬렉션에서 변환
listOf(1, 2, 3).asSequence()
(1..10).asSequence()

// generateSequence — 무한 시퀀스
val naturals = generateSequence(1) { it + 1 }  // 1, 2, 3, 4, ...
naturals.take(5).toList()  // [1, 2, 3, 4, 5]

// 종료 조건 있는 generateSequence
val limited = generateSequence(1) { if (it < 100) it * 2 else null }
limited.toList()  // [1, 2, 4, 8, 16, 32, 64, 128] — null 반환 시 종료
```

---

## sequence 빌더

`yield` / `yieldAll`로 원소를 하나씩 생성합니다.

```kotlin
val fibonacci = sequence {
    var a = 0L
    var b = 1L
    while (true) {
        yield(a)
        val next = a + b
        a = b
        b = next
    }
}

fibonacci.take(10).toList()
// [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

```kotlin
// yieldAll — 컬렉션 전체 방출
val combined = sequence {
    yieldAll(listOf(1, 2, 3))
    yield(0)
    yieldAll(generateSequence(10) { if (it < 30) it + 10 else null })
}

combined.toList()  // [1, 2, 3, 0, 10, 20, 30]
```

### 실용 예 — 파일 레코드 읽기

```kotlin
fun readRecords(lines: Sequence<String>): Sequence<Record> = sequence {
    var header: List<String>? = null
    for (line in lines) {
        if (header == null) {
            header = line.split(",")
        } else {
            val values = line.split(",")
            yield(Record(header.zip(values).toMap()))
        }
    }
}
```

---

## 중간 연산 vs 최종 연산

| 종류 | 연산 | 특징 |
|------|------|------|
| **중간** | `filter`, `map`, `flatMap`, `take`, `drop`, `onEach` | 즉시 실행 안 됨 |
| **최종** | `toList`, `toSet`, `count`, `first`, `fold`, `forEach` | 실제 처리 시작 |

```kotlin
val seq = sequenceOf(1, 2, 3, 4, 5)
    .filter { println("filter $it"); it % 2 == 0 }
    .map { println("map $it"); it * 10 }
// 아직 아무것도 출력 안 됨

seq.first()
// filter 1
// filter 2
// map 2
// 결과: 20 — 필요한 만큼만 처리
```

---

## 처리 순서 — 컬렉션 vs 시퀀스

```kotlin
// 컬렉션 — 연산별 수평 처리
listOf(1, 2, 3)
    .map { it * 2 }    // [2, 4, 6] 전체 처리
    .filter { it > 3 } // [4, 6] 전체 처리
// map: 1→2, 2→4, 3→6 / filter: 2→X, 4→O, 6→O

// 시퀀스 — 원소별 수직 처리
sequenceOf(1, 2, 3)
    .map { it * 2 }
    .filter { it > 3 }
    .toList()
// 1: map→2, filter→X
// 2: map→4, filter→O
// 3: map→6, filter→O
```

---

## 무한 시퀀스 활용

```kotlin
// 소수 시퀀스
fun primes(): Sequence<Int> = sequence {
    val primesList = mutableListOf<Int>()
    var candidate = 2
    while (true) {
        if (primesList.none { candidate % it == 0 }) {
            primesList.add(candidate)
            yield(candidate)
        }
        candidate++
    }
}

primes().take(10).toList()
// [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]

// 2의 거듭제곱
val powers = generateSequence(1L) { it * 2 }
powers.takeWhile { it < 1000 }.toList()
// [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]

// 랜덤 샘플
val randomSamples = generateSequence { (1..100).random() }
randomSamples.take(5).toList()
```

---

## constrainOnce — 단일 소비 강제

```kotlin
val seq = sequenceOf(1, 2, 3).constrainOnce()

seq.toList()  // [1, 2, 3]
seq.toList()  // IllegalStateException — 이미 소비됨
```

스트림(Java Stream)처럼 한 번만 소비 가능하게 만듭니다.

---

## 시퀀스 vs 컬렉션 선택 기준

```
컬렉션이 유리한 경우:
  - 원소 수가 적다 (수백 개 이하)
  - 여러 번 반복 접근
  - 랜덤 접근 필요
  - 연산 체인이 짧다

시퀀스가 유리한 경우:
  - 원소 수가 많다 (수십만 이상)
  - 중간에 조기 종료 (take, first 등)
  - 무한 데이터 스트림
  - 파이프라인 연산이 길다
  - 메모리 효율이 중요하다
```

```kotlin
// 이 경우 시퀀스가 훨씬 효율적
val result = (1..Int.MAX_VALUE).asSequence()
    .filter { it % 3 == 0 }
    .map { it * it }
    .first { it > 1000 }  // 조건 만족하면 즉시 중단
```

---

## 정리

- `Sequence` — 지연 평가, 원소 하나씩 처리
- `sequenceOf`, `asSequence()` — 기존 컬렉션에서 변환
- `generateSequence` — 함수로 무한 시퀀스 생성
- `sequence { yield(...) }` — 빌더로 복잡한 시퀀스 구성
- **중간 연산**: 쌓기만 함 / **최종 연산**: 실제 처리 시작
- 원소 수 많거나 조기 종료가 있을 때 컬렉션 대비 성능 우위
