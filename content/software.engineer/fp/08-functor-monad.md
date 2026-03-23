---
title: "[FP 시리즈] 8. 펑터와 모나드"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "펑터", "모나드", "functor", "monad", "FP"]
---

# 펑터와 모나드

FP에서 가장 어렵다는 개념 두 가지입니다. 수학적 정의보다는 **실용적인 관점**에서 이해하겠습니다. 핵심은 간단합니다: 펑터는 `map`이 되는 컨테이너, 모나드는 `flatMap`이 되는 컨테이너입니다.

## 컨테이너

먼저 컨테이너 개념이 필요합니다. 컨테이너는 **값을 감싸는 구조**입니다.

```typescript
// 배열은 값들을 담는 컨테이너
const numbers = [1, 2, 3];

// null일 수도 있는 값을 담는 컨테이너
type Maybe<T> = T | null;

// 성공 또는 실패를 담는 컨테이너
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

컨테이너 안의 값에 함수를 적용하고 싶을 때 어떻게 할까요? 꺼내서 변환하고 다시 넣을 수 있지만, 이걸 **컨테이너가 직접 처리**하게 하면 더 편합니다.

## 펑터 (Functor)

**`map` 메서드가 있는 컨테이너**입니다. 컨테이너 안의 값에 함수를 적용하고, 결과를 같은 컨테이너에 담아 반환합니다.

```typescript
// 배열은 가장 친숙한 펑터
[1, 2, 3].map(x => x * 2); // [2, 4, 6]
// 배열이라는 컨테이너 안에서 변환이 일어남

// Maybe 펑터 구현
class Maybe<T> {
  private constructor(private readonly value: T | null) {}

  static of<T>(value: T | null): Maybe<T> {
    return new Maybe(value);
  }

  map<U>(fn: (value: T) => U): Maybe<U> {
    if (this.value === null) return Maybe.of<U>(null); // null이면 건너뜀
    return Maybe.of(fn(this.value));
  }

  getOrElse(fallback: T): T {
    return this.value ?? fallback;
  }
}

const name = Maybe.of(getUser(id))
  .map(user => user.profile)
  .map(profile => profile.name)
  .getOrElse('이름 없음');
// 중간에 null이 나와도 이후 map들은 안전하게 건너뜀
```

펑터의 규칙:
1. **항등원**: `fa.map(x => x)` = `fa` — 항등 함수로 map하면 변화 없음
2. **합성**: `fa.map(f).map(g)` = `fa.map(x => g(f(x)))` — 두 번 map과 합성 후 한 번 map이 동일

## 모나드 (Monad)

**`flatMap`(또는 `chain`, `bind`) 메서드가 있는 컨테이너**입니다. 컨테이너를 반환하는 함수를 적용할 때 중첩을 방지합니다.

### 문제: 중첩 컨테이너

```typescript
const parseAge = (s: string): Maybe<number> => {
  const n = parseInt(s);
  return isNaN(n) ? Maybe.of(null) : Maybe.of(n);
};

const validateAge = (n: number): Maybe<number> => {
  return n >= 0 && n <= 150 ? Maybe.of(n) : Maybe.of(null);
};

// map을 쓰면 Maybe<Maybe<number>>가 됨 (중첩!)
const result = Maybe.of('25').map(parseAge); // Maybe<Maybe<number>>
```

### 해결: flatMap

```typescript
class Maybe<T> {
  // ... 이전 코드

  flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    if (this.value === null) return Maybe.of<U>(null);
    return fn(this.value); // 중첩 제거: Maybe<Maybe<U>> → Maybe<U>
  }
}

const result = Maybe.of('25')
  .flatMap(parseAge)    // Maybe<number>
  .flatMap(validateAge) // Maybe<number>
  .getOrElse(0);

// 각 단계에서 null이 반환되면 이후 단계는 건너뜀
```

### 비동기 코드에서의 모나드

`Promise`도 모나드입니다. `then`이 `flatMap` 역할을 합니다.

```typescript
// then = flatMap
fetch('/api/user/1')
  .then(res => res.json())           // Response → Promise<User>
  .then(user => fetchPosts(user.id)) // User → Promise<Post[]>
  .then(posts => posts.map(p => p.title))
  .catch(err => console.error(err));

// 직접 중첩하면 이렇게 됨
fetch('/api/user/1')
  .then(res => {
    return res.json().then(user => {
      return fetchPosts(user.id).then(posts => {
        return posts.map(p => p.title);
      });
    });
  });
// Promise가 중첩되지만 then이 자동으로 평탄화해줌
```

## 모나드 법칙

1. **왼쪽 항등원**: `of(a).flatMap(f)` = `f(a)`
2. **오른쪽 항등원**: `m.flatMap(of)` = `m`
3. **결합법칙**: `m.flatMap(f).flatMap(g)` = `m.flatMap(x => f(x).flatMap(g))`

이 법칙들이 만족되면 함수들을 자유롭게 조합할 수 있습니다.

## 직관적으로 이해하기

| 개념 | 무엇인가 | 핵심 연산 | 비유 |
|------|---------|---------|------|
| 펑터 | 값을 담는 컨테이너 | `map` | 박스 안의 내용물을 변환 |
| 모나드 | 연쇄 가능한 컨테이너 | `flatMap` | 컨테이너를 반환하는 변환의 연쇄 |

```typescript
// 펑터: 내용물 변환
[1, 2, 3].map(x => x * 2); // 박스(배열) → 새 내용물로 채운 박스

// 모나드: 컨테이너 반환 함수 연쇄
[1, 2, 3].flatMap(x => [x, x * 2]); // [1, 2, 2, 4, 3, 6] — 중첩 배열 평탄화
```

## 왜 중요한가

모나드는 **부수 효과를 안전하게 연쇄**하는 추상화입니다.

```typescript
// null 처리를 연쇄 (Maybe 모나드)
const result = Maybe.of(user)
  .flatMap(u => Maybe.of(u.address))
  .flatMap(a => Maybe.of(a.city))
  .getOrElse('도시 없음');

// 에러 처리를 연쇄 (Either 모나드)
const result2 = parseInput(raw)
  .flatMap(validate)
  .flatMap(process)
  .fold(
    err => `오류: ${err}`,
    val => `성공: ${val}`,
  );

// 비동기를 연쇄 (Promise 모나드)
const result3 = await fetch(url)
  .then(parseResponse)
  .then(validate)
  .then(save);
```

각 단계가 실패할 수 있는 연산의 체인을 **깔끔하게** 표현할 수 있습니다. 중간에 실패하면 이후 단계는 자동으로 건너뜁니다.

## 정리

- **펑터**: `map`이 있는 컨테이너 — 내부 값을 변환, 컨테이너 구조는 유지
- **모나드**: `flatMap`이 있는 컨테이너 — 컨테이너를 반환하는 함수를 연쇄, 중첩 방지

모나드를 "부리또"나 "콘텍스트를 가진 값"으로 설명하는 비유들이 많지만, 가장 실용적인 이해는: **실패 가능하거나, null일 수 있거나, 비동기인 연산들을 깔끔하게 연쇄하는 패턴**입니다.

구체적인 모나드(Maybe, Either, IO)는 다음 아티클들에서 다룹니다.
