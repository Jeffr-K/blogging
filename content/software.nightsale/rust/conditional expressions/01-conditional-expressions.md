---
title: "Episode 9. Conditional Expressions"
author: anonymous.rs
date: 2026-01-07
tags: ["rust", "control flow"]
---

# Deep Dive: Rust의 조건문

러스트의 조건문은 다른 언어와 비슷하면서도 강력한 차이점을 가집니다. 바로 `if`가 문(statement)이 아닌 식(expression)이라는 점입니다. 이번 에피소드에서는 이 개념이 코드의 유연성과 안정성에 어떻게 기여하는지 심층적으로 분석합니다.

---

## 1. `if-else` 기본 구문

가장 기본적인 형태의 조건문입니다. 조건이 참(`true`)일 때 특정 코드 블록을 실행합니다.

```rust
let number = 7;

if number < 10 {
    println!("The condition was true");
} else {
    println!("The condition was false");
}
```

- **괄호 불필요:** `if` 조건 주변에 괄호 `()`를 사용하지 않는 것이 러스트의 스타일 가이드입니다.
- **Boolean 강제:** `if`문의 조건은 반드시 `bool` 타입이어야 합니다. C나 JavaScript처럼 숫자 0을 `false`로 자동 변환해주지 않아 명시성과 타입 안정성을 높입니다.

---

## 2. `else if`를 이용한 다중 조건 처리

여러 조건을 순차적으로 확인할 수 있습니다.

```rust
let number = 6;

if number % 4 == 0 {
    println!("number is divisible by 4");
} else if number % 3 == 0 {
    println!("number is divisible by 3");
} else if number % 2 == 0 {
    println!("number is divisible by 2");
} else {
    println!("number is not divisible by 4, 3, or 2");
}
```

- **주의:** `if-else if` 체인이 너무 길어지면 `match` 표현식을 사용하는 것이 더 깔끔하고 효율적일 수 있습니다. `match`는 다음 에피소드에서 자세히 다룹니다.

---

## 3. `if`는 표현식이다 (Expression)

러스트에서 `if`는 값을 반환할 수 있는 표현식입니다. 이는 코드를 더 간결하고 함수형 프로그래밍 스타일에 가깝게 만들어줍니다.

```rust
let condition = true;
let number = if condition { 5 } else { 6 };

println!("The value of number is: {number}"); // 5
```

### 표현식으로서의 `if` 사용 시 주의사항

- **타입 일치:** `if`와 `else` 블록에서 반환하는 값은 반드시 **동일한 타입**이어야 합니다. 러스트는 컴파일 타임에 모든 변수의 타입을 알아야 하기 때문입니다.

```rust
// 🚨 컴파일 에러!
// `if` and `else` have incompatible types
let number = if condition { 5 } else { "six" };
```

- **세미콜론:** `let` 바인딩과 함께 사용할 때, `if` 표현식의 각 블록 마지막에는 세미콜론(`;`)을 붙이지 않습니다. 세미콜론은 해당 라인을 문(statement)으로 만들어 값을 반환하지 않게 만들기 때문입니다.

| 구분 | `if`를 표현식으로 사용 | `if`를 문으로 사용 |
| :--- | :--- | :--- |
| **목적** | 값(Value)을 생성하여 변수에 할당 | 조건에 따라 코드 블록(동작)을 실행 |
| **반환값** | 있음 (각 블록의 마지막 표현식) | 없음 (`()`, 유닛 타입) |
| **문법** | `let x = if ... { 1 } else { 2 };` | `if ... { println!("hello"); }` |
| **특징** | 코드를 간결하게 만들고, 삼항 연산자처럼 활용 가능 | 전통적인 방식의 조건 제어 |

`if`를 표현식으로 사용하는 것은 러스트의 핵심 철학인 **안정성과 표현력**을 동시에 보여주는 좋은 예시입니다. 이를 통해 개발자는 더 적은 코드로 명확한 의도를 전달할 수 있습니다.
