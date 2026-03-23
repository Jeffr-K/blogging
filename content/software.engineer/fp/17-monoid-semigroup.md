---
title: "[FP 시리즈] 17. 세미그룹과 모노이드"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "모노이드", "세미그룹", "monoid", "semigroup", "FP"]
---

# 세미그룹과 모노이드

`string`은 `+`로 합칠 수 있고, `number`는 `+`나 `*`로 합칠 수 있으며, `array`는 `concat`으로 합칠 수 있습니다. 이 패턴을 추상화한 것이 세미그룹(Semigroup)과 모노이드(Monoid)입니다.

## 세미그룹 (Semigroup)

**결합 가능한 이항 연산**이 있는 타입입니다.

```typescript
interface Semigroup<A> {
  concat: (x: A, y: A) => A;
}
```

규칙: **결합 법칙** — `concat(concat(a, b), c)` = `concat(a, concat(b, c))`

```typescript
// 문자열 세미그룹
const stringSemigroup: Semigroup<string> = {
  concat: (x, y) => x + y,
};

// 숫자 덧셈 세미그룹
const addSemigroup: Semigroup<number> = {
  concat: (x, y) => x + y,
};

// 숫자 곱셈 세미그룹
const multiplySemigroup: Semigroup<number> = {
  concat: (x, y) => x * y,
};

// 배열 세미그룹
const arraySemigroup = <A>(): Semigroup<A[]> => ({
  concat: (x, y) => [...x, ...y],
});

// 불리언 세미그룹
const andSemigroup: Semigroup<boolean> = { concat: (x, y) => x && y };
const orSemigroup: Semigroup<boolean> = { concat: (x, y) => x || y };
```

## 모노이드 (Monoid)

**세미그룹 + 항등원(identity element)**입니다.

```typescript
interface Monoid<A> extends Semigroup<A> {
  empty: A; // concat(empty, x) = x, concat(x, empty) = x
}
```

```typescript
const stringMonoid: Monoid<string> = {
  concat: (x, y) => x + y,
  empty: '',  // '' + x = x, x + '' = x
};

const addMonoid: Monoid<number> = {
  concat: (x, y) => x + y,
  empty: 0,   // 0 + x = x
};

const multiplyMonoid: Monoid<number> = {
  concat: (x, y) => x * y,
  empty: 1,   // 1 * x = x
};

const arrayMonoid = <A>(): Monoid<A[]> => ({
  concat: (x, y) => [...x, ...y],
  empty: [],  // [] + x = x
});
```

## fold: 모노이드로 리스트 줄이기

모노이드가 있으면 리스트를 하나의 값으로 쉽게 줄일 수 있습니다.

```typescript
function fold<A>(monoid: Monoid<A>, arr: A[]): A {
  return arr.reduce(monoid.concat, monoid.empty);
}

fold(stringMonoid, ['Hello', ', ', 'World']); // 'Hello, World'
fold(addMonoid, [1, 2, 3, 4, 5]);             // 15
fold(multiplyMonoid, [1, 2, 3, 4, 5]);        // 120
fold(arrayMonoid<number>(), [[1, 2], [3, 4]]); // [1, 2, 3, 4]
```

`Array.prototype.reduce`의 초기값이 바로 항등원입니다.

## 실용적인 모노이드들

### 최댓값/최솟값

```typescript
const maxMonoid: Monoid<number> = {
  concat: Math.max,
  empty: -Infinity, // Math.max(-Infinity, x) = x
};

const minMonoid: Monoid<number> = {
  concat: Math.min,
  empty: Infinity,
};

fold(maxMonoid, [3, 1, 4, 1, 5, 9, 2, 6]); // 9
fold(minMonoid, [3, 1, 4, 1, 5, 9, 2, 6]); // 1
```

### 객체 병합

```typescript
const objectMonoid = <A extends object>(): Monoid<A> => ({
  concat: (x, y) => ({ ...x, ...y } as A),
  empty: {} as A,
});

const configs = [
  { timeout: 3000 },
  { retries: 3 },
  { baseUrl: '/api' },
];

fold(objectMonoid<Record<string, unknown>>(), configs);
// { timeout: 3000, retries: 3, baseUrl: '/api' }
```

### 함수 모노이드

```typescript
// 같은 타입을 받고 반환하는 함수의 모노이드
const endomorphismMonoid = <A>(): Monoid<(a: A) => A> => ({
  concat: (f, g) => x => g(f(x)),
  empty: x => x, // 항등 함수
});

const transforms = [
  (s: string) => s.trim(),
  (s: string) => s.toLowerCase(),
  (s: string) => s.replace(/\s+/g, '-'),
];

const pipeline = fold(endomorphismMonoid<string>(), transforms);
pipeline('  Hello World  '); // 'hello-world'
```

## 왜 유용한가

### 병렬 처리

결합 법칙이 있으므로 순서를 바꿔 병렬로 처리할 수 있습니다.

```typescript
// 이 두 코드는 동일
fold(addMonoid, [1, 2, 3, 4]);
// = (1 + 2) + (3 + 4) — 병렬 처리 가능
// = 1 + (2 + (3 + 4)) — 순서 변경 가능
```

분산 시스템에서 데이터를 나눠서 처리 후 모노이드로 합치는 이유입니다 (MapReduce 패턴).

### 제네릭 알고리즘

타입에 상관없이 같은 `fold`를 재사용합니다.

```typescript
// 통계 집계 — 한 번의 순회로 여러 통계를 동시에 계산
type Stats = { sum: number; count: number; min: number; max: number };

const statsMonoid: Monoid<Stats> = {
  concat: (a, b) => ({
    sum: a.sum + b.sum,
    count: a.count + b.count,
    min: Math.min(a.min, b.min),
    max: Math.max(a.max, b.max),
  }),
  empty: { sum: 0, count: 0, min: Infinity, max: -Infinity },
};

const numbers = [5, 3, 8, 1, 9, 2, 7];
const stats = fold(
  statsMonoid,
  numbers.map(n => ({ sum: n, count: 1, min: n, max: n })),
);
// { sum: 35, count: 7, min: 1, max: 9 }

const average = stats.sum / stats.count; // 5
```

## fp-ts에서의 모노이드

```typescript
import * as M from 'fp-ts/Monoid';
import * as N from 'fp-ts/number';
import * as S from 'fp-ts/string';

// 내장 모노이드 사용
M.concatAll(N.MonoidSum)([1, 2, 3, 4, 5]); // 15
M.concatAll(S.Monoid)(['a', 'b', 'c']);     // 'abc'
```

## 정리

- **세미그룹**: 결합 가능한 이항 연산 — `concat(concat(a, b), c) = concat(a, concat(b, c))`
- **모노이드**: 세미그룹 + 항등원 — `concat(empty, x) = x`

모노이드는 **어떤 타입이든 리스트로 줄이는 보편적인 추상화**입니다. `reduce`의 초기값이 항등원, 콜백이 `concat`입니다. `string`, `number`, `array`, `object`, `function` 등 익숙한 타입들이 모두 모노이드입니다.
