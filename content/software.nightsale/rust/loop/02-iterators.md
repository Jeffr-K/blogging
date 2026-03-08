---
title: "[Rust 반복문 시리즈] 02. 이터레이터와 for 루프 심화"
author: anonymous.rs
date: 2026-01-07
tags: ["rust", "iterator", "for", "adapter", "collect", "실전"]
---

# 이터레이터와 for 루프 심화

01에서 `loop`, `while`, `for`의 기본을 다뤘다. 이번 글에서는 `for` 루프의 진짜 동력인 **이터레이터**를 깊이 파고든다.

## `for`의 정체

`for`는 문법적 설탕(sugar)이다. 실제로는 이터레이터의 `.next()`를 반복 호출하는 것과 같다.

```rust
let v = vec![1, 2, 3];

// 이것은
for val in v {
    println!("{}", val);
}

// 사실 이것과 같다
let mut iter = v.into_iter();
loop {
    match iter.next() {
        Some(val) => println!("{}", val),
        None => break,
    }
}
```

## `iter()`, `iter_mut()`, `into_iter()`

컬렉션을 순회하는 3가지 방법이 있다. 소유권을 어떻게 다루느냐의 차이다.

```rust
let names = vec!["alice".to_string(), "bob".to_string(), "charlie".to_string()];

// &T - 불변 참조로 순회 (원본 유지)
for name in names.iter() {
    println!("{}", name);  // name: &String
}
println!("원본 살아있음: {:?}", names);

// &mut T - 가변 참조로 순회 (원본 수정 가능)
let mut scores = vec![80, 90, 70];
for score in scores.iter_mut() {
    *score += 10;  // score: &mut i32
}
println!("수정됨: {:?}", scores);  // [90, 100, 80]

// T - 소유권을 가져감 (원본 소멸)
let data = vec![1, 2, 3];
for val in data.into_iter() {
    println!("{}", val);  // val: i32
}
// println!("{:?}", data);  // 컴파일 에러! data 이동됨
```

| 메서드 | 요소 타입 | 원본 | 용도 |
|--------|----------|------|------|
| `.iter()` | `&T` | 유지 | 읽기만 할 때 |
| `.iter_mut()` | `&mut T` | 수정 | 요소를 변경할 때 |
| `.into_iter()` | `T` | 소멸 | 소유권이 필요할 때 |

`for val in &collection`은 `.iter()`와 같고, `for val in &mut collection`은 `.iter_mut()`과 같다.

```rust
let v = vec![1, 2, 3];

// 이 두 줄은 동일하다
for val in &v { /* val: &i32 */ }
for val in v.iter() { /* val: &i32 */ }
```

## 이터레이터 어댑터 (Adapter)

이터레이터를 변환하는 메서드들이다. **지연 평가(lazy)**라서 최종 소비자를 만나기 전에는 실행되지 않는다.

### `map` - 각 요소를 변환

```rust
let numbers = vec![1, 2, 3, 4, 5];
let doubled: Vec<i32> = numbers.iter().map(|&x| x * 2).collect();
// [2, 4, 6, 8, 10]
```

### `filter` - 조건에 맞는 요소만

```rust
let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8];
let evens: Vec<&i32> = numbers.iter().filter(|&&x| x % 2 == 0).collect();
// [2, 4, 6, 8]
```

### `enumerate` - 인덱스 붙이기

```rust
let fruits = vec!["사과", "바나나", "체리"];
for (i, fruit) in fruits.iter().enumerate() {
    println!("{}: {}", i, fruit);
}
// 0: 사과
// 1: 바나나
// 2: 체리
```

### `zip` - 두 이터레이터 합치기

```rust
let names = vec!["alice", "bob", "charlie"];
let scores = vec![85, 92, 78];

let results: Vec<_> = names.iter().zip(scores.iter()).collect();
// [("alice", 85), ("bob", 92), ("charlie", 78)]

for (name, score) in names.iter().zip(scores.iter()) {
    println!("{}: {}점", name, score);
}
```

### `take`, `skip` - 잘라내기

```rust
let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

let first_three: Vec<_> = numbers.iter().take(3).collect();
// [1, 2, 3]

let after_five: Vec<_> = numbers.iter().skip(5).collect();
// [6, 7, 8, 9, 10]

// 조합
let middle: Vec<_> = numbers.iter().skip(2).take(3).collect();
// [3, 4, 5]
```

### `flatten` - 중첩 풀기

```rust
let nested = vec![vec![1, 2], vec![3, 4], vec![5]];
let flat: Vec<_> = nested.into_iter().flatten().collect();
// [1, 2, 3, 4, 5]

// Option에도 동작한다
let options = vec![Some(1), None, Some(3), None, Some(5)];
let values: Vec<_> = options.into_iter().flatten().collect();
// [1, 3, 5]
```

### `chain` - 이터레이터 이어붙이기

```rust
let a = vec![1, 2, 3];
let b = vec![4, 5, 6];
let combined: Vec<_> = a.iter().chain(b.iter()).collect();
// [1, 2, 3, 4, 5, 6]
```

## 소비자 (Consumer)

이터레이터를 최종적으로 실행하는 메서드들이다.

### `collect` - 컬렉션으로 모으기

```rust
// Vec로 수집
let v: Vec<i32> = (1..=5).collect();

// HashMap으로 수집
use std::collections::HashMap;
let map: HashMap<&str, i32> = vec![("a", 1), ("b", 2)].into_iter().collect();

// String으로 수집
let s: String = vec!['h', 'e', 'l', 'l', 'o'].into_iter().collect();
```

### `fold` - 누적 연산

```rust
let sum = (1..=100).fold(0, |acc, x| acc + x);
println!("1~100 합: {}", sum);  // 5050

// 문자열 합치기
let words = vec!["hello", "world", "rust"];
let sentence = words.iter().fold(String::new(), |mut acc, &word| {
    if !acc.is_empty() { acc.push(' '); }
    acc.push_str(word);
    acc
});
// "hello world rust"
```

### `find`, `any`, `all`, `position`

```rust
let numbers = vec![1, 3, 5, 7, 8, 9];

let first_even = numbers.iter().find(|&&x| x % 2 == 0);
println!("{:?}", first_even);  // Some(8)

let has_even = numbers.iter().any(|&x| x % 2 == 0);
println!("{}", has_even);  // true

let all_positive = numbers.iter().all(|&x| x > 0);
println!("{}", all_positive);  // true

let pos = numbers.iter().position(|&x| x == 7);
println!("{:?}", pos);  // Some(3)
```

### `sum`, `min`, `max`, `count`

```rust
let numbers = vec![3, 1, 4, 1, 5, 9];

let total: i32 = numbers.iter().sum();     // 23
let min = numbers.iter().min();             // Some(1)
let max = numbers.iter().max();             // Some(9)
let count = numbers.iter().count();         // 6
```

## 메서드 체이닝 실전 예시

```rust
struct Student {
    name: String,
    score: u32,
    grade: u32,
}

let students = vec![
    Student { name: "Alice".into(), score: 95, grade: 3 },
    Student { name: "Bob".into(), score: 72, grade: 3 },
    Student { name: "Charlie".into(), score: 88, grade: 2 },
    Student { name: "Diana".into(), score: 91, grade: 3 },
    Student { name: "Eve".into(), score: 65, grade: 2 },
];

// 3학년 중 80점 이상인 학생 이름만 뽑기
let honor: Vec<&str> = students.iter()
    .filter(|s| s.grade == 3)
    .filter(|s| s.score >= 80)
    .map(|s| s.name.as_str())
    .collect();

println!("{:?}", honor);  // ["Alice", "Diana"]

// 전체 평균 점수
let avg = students.iter().map(|s| s.score).sum::<u32>() as f64
    / students.len() as f64;
println!("평균: {:.1}", avg);  // 82.2
```

## `for` 루프 vs 이터레이터 체이닝

```rust
let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// for 루프 방식
let mut result = Vec::new();
for &n in &numbers {
    if n % 2 == 0 {
        result.push(n * n);
    }
}

// 이터레이터 방식
let result: Vec<i32> = numbers.iter()
    .filter(|&&n| n % 2 == 0)
    .map(|&n| n * n)
    .collect();

// 둘 다 결과는 [4, 16, 36, 64, 100]
```

성능은 거의 동일하다. 러스트 컴파일러는 이터레이터 체이닝을 루프와 동일한 코드로 최적화한다 (제로 코스트 추상화). 가독성이 좋은 쪽을 선택하면 된다.

## 정리

| 분류 | 메서드 | 역할 |
|------|--------|------|
| 순회 방식 | `iter`, `iter_mut`, `into_iter` | 참조/가변참조/소유권 |
| 어댑터 | `map`, `filter`, `enumerate`, `zip`, `take`, `skip`, `flatten`, `chain` | 변환 (지연 평가) |
| 소비자 | `collect`, `fold`, `find`, `any`, `all`, `sum`, `min`, `max`, `count` | 최종 실행 |

이터레이터는 러스트에서 `for` 루프보다 더 자주 쓰이는 도구다. 어댑터를 체이닝해서 데이터 변환 파이프라인을 만드는 패턴에 익숙해지면, 코드가 훨씬 간결해진다.
