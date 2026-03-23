---
title: "[FP 시리즈] 20. 타입 클래스 (Type Classes)"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "타입클래스", "type class", "fp-ts", "FP"]
---

# 타입 클래스 (Type Classes)

타입 클래스는 **타입이 특정 인터페이스를 구현함을 선언하는** 방법입니다. Haskell의 핵심 개념으로, TypeScript에서는 fp-ts가 이 패턴을 적용합니다.

## 타입 클래스란

인터페이스와 비슷하지만, **타입을 수정하지 않고 나중에 인스턴스를 추가**할 수 있습니다.

```typescript
// 인터페이스 방식 — 타입 정의 시점에 구현을 포함해야 함
interface Printable {
  toString(): string;
}

// 타입 클래스 방식 — 타입과 구현을 분리
interface Show<A> {
  show: (a: A) => string;
}

// string에 대한 Show 인스턴스
const showString: Show<string> = {
  show: s => `"${s}"`,
};

// number에 대한 Show 인스턴스
const showNumber: Show<number> = {
  show: n => n.toString(),
};

// 나중에 만든 타입도 Show를 추가 가능
type Point = { x: number; y: number };
const showPoint: Show<Point> = {
  show: p => `(${p.x}, ${p.y})`,
};
```

외부 라이브러리의 타입이나 primitive 타입에도 인스턴스를 추가할 수 있습니다.

## 주요 타입 클래스

### Eq — 동등 비교

```typescript
interface Eq<A> {
  equals: (x: A, y: A) => boolean;
}

const eqNumber: Eq<number> = {
  equals: (x, y) => x === y,
};

const eqString: Eq<string> = {
  equals: (x, y) => x === y,
};

// 배열의 Eq를 원소의 Eq로부터 만들기
const eqArray = <A>(eqA: Eq<A>): Eq<A[]> => ({
  equals: (xs, ys) =>
    xs.length === ys.length && xs.every((x, i) => eqA.equals(x, ys[i])),
});

// 객체의 Eq를 필드별 Eq로부터 만들기
type User = { name: string; age: number };
const eqUser: Eq<User> = {
  equals: (x, y) => eqString.equals(x.name, y.name) && eqNumber.equals(x.age, y.age),
};

eqUser.equals({ name: '홍길동', age: 30 }, { name: '홍길동', age: 30 }); // true
```

### Ord — 순서 비교

```typescript
type Ordering = 'LT' | 'EQ' | 'GT';

interface Ord<A> extends Eq<A> {
  compare: (x: A, y: A) => Ordering;
}

const ordNumber: Ord<number> = {
  equals: (x, y) => x === y,
  compare: (x, y) => (x < y ? 'LT' : x > y ? 'GT' : 'EQ'),
};

// Ord로부터 min, max, sort 구현
function min<A>(ord: Ord<A>, x: A, y: A): A {
  return ord.compare(x, y) === 'GT' ? y : x;
}

function sortWith<A>(ord: Ord<A>, arr: A[]): A[] {
  return [...arr].sort((x, y) => {
    const c = ord.compare(x, y);
    return c === 'LT' ? -1 : c === 'GT' ? 1 : 0;
  });
}

// 나이로 정렬
const ordUserByAge: Ord<User> = {
  equals: eqUser.equals,
  compare: (x, y) => ordNumber.compare(x.age, y.age),
};

sortWith(ordUserByAge, [
  { name: '홍길동', age: 30 },
  { name: '김영희', age: 25 },
]); // 나이 오름차순
```

### Functor

```typescript
interface Functor<F> {
  map: <A, B>(fa: F, fn: (a: A) => B) => F;
}
```

이미 이전 아티클에서 다뤘습니다.

## 타입 클래스로 제네릭 알고리즘

타입 클래스의 힘은 **제네릭 알고리즘**을 작성할 수 있다는 점입니다.

```typescript
// Eq가 있는 모든 타입에 대해 동작하는 함수
function unique<A>(eq: Eq<A>, arr: A[]): A[] {
  return arr.filter((x, i) => arr.findIndex(y => eq.equals(x, y)) === i);
}

unique(eqNumber, [1, 2, 1, 3, 2]); // [1, 2, 3]
unique(eqString, ['a', 'b', 'a']); // ['a', 'b']
unique(eqUser, [
  { name: '홍길동', age: 30 },
  { name: '김영희', age: 25 },
  { name: '홍길동', age: 30 }, // 중복
]); // 중복 제거

// Ord가 있는 모든 타입에 대해 동작하는 함수
function maximum<A>(ord: Ord<A>, arr: A[]): A | null {
  if (arr.length === 0) return null;
  return arr.reduce((acc, x) => (ord.compare(x, acc) === 'GT' ? x : acc));
}
```

### 파생 인스턴스 만들기

작은 타입 클래스 인스턴스를 조합해 복잡한 인스턴스를 만듭니다.

```typescript
// Ord를 역순으로 뒤집기
function reverse<A>(ord: Ord<A>): Ord<A> {
  return {
    equals: ord.equals,
    compare: (x, y) => ord.compare(y, x), // 순서 반전
  };
}

// 여러 Ord를 순서대로 적용 (사전식 비교)
function chain<A>(first: Ord<A>, second: Ord<A>): Ord<A> {
  return {
    equals: (x, y) => first.equals(x, y) && second.equals(x, y),
    compare: (x, y) => {
      const c = first.compare(x, y);
      return c !== 'EQ' ? c : second.compare(x, y);
    },
  };
}

// 이름 오름차순, 같으면 나이 내림차순
const ordUserByNameThenAgeDesc = chain(
  { equals: (x: User, y: User) => x.name === y.name, compare: (x, y) => ordString.compare(x.name, y.name) },
  reverse({ equals: (x: User, y: User) => x.age === y.age, compare: (x, y) => ordNumber.compare(x.age, y.age) }),
);
```

## fp-ts에서의 타입 클래스

```typescript
import * as Eq from 'fp-ts/Eq';
import * as Ord from 'fp-ts/Ord';
import * as N from 'fp-ts/number';
import * as S from 'fp-ts/string';

// 이미 구현된 인스턴스 사용
N.Eq.equals(1, 1); // true
S.Ord.compare('a', 'b'); // 'LT'

// struct: 객체의 Eq/Ord를 필드별로 만들기
const eqPoint = Eq.struct({ x: N.Eq, y: N.Eq });
eqPoint.equals({ x: 1, y: 2 }, { x: 1, y: 2 }); // true

// contramap: 변환 함수를 통한 Ord 파생
const ordByName = Ord.contramap((u: User) => u.name)(S.Ord);
const ordByAge = Ord.contramap((u: User) => u.age)(N.Ord);
```

## 정리

- **타입 클래스**: 타입과 구현을 분리 — 나중에 인스턴스 추가 가능
- **Eq**: 동등 비교 / **Ord**: 순서 비교 / **Functor/Monad**: 이미 다룸
- **제네릭 알고리즘**: 타입 클래스를 인자로 받아 모든 타입에 적용 가능

TypeScript에는 타입 클래스가 언어 차원에서 없어서 딕셔너리 패턴(인스턴스를 인자로 전달)으로 구현합니다. fp-ts가 이 패턴을 체계적으로 제공합니다.
