---
title: "[FP 시리즈] 5. 함수 합성과 파이프"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "함수합성", "파이프", "composition", "pipe", "FP"]
---

# 함수 합성과 파이프

함수 합성(Function Composition)과 파이프(Pipe)는 작은 함수들을 연결해 더 큰 함수를 만드는 방법입니다. 수학의 합성 함수 `f ∘ g`를 코드로 옮긴 것입니다.

## 함수 합성

`compose(f, g)(x)` = `f(g(x))` — **오른쪽에서 왼쪽으로** 실행됩니다.

```typescript
const double = (x: number) => x * 2;
const addOne = (x: number) => x + 1;
const square = (x: number) => x * x;

// 직접 중첩
const result = double(addOne(square(3)));
// square(3) = 9 → addOne(9) = 10 → double(10) = 20

// compose로 새 함수 만들기
function compose<T>(...fns: Array<(x: T) => T>) {
  return (x: T) => fns.reduceRight((acc, fn) => fn(acc), x);
}

const transform = compose(double, addOne, square);
transform(3); // 20 — 오른쪽(square)부터 실행
```

## 파이프

`pipe(f, g)(x)` = `g(f(x))` — **왼쪽에서 오른쪽으로** 실행됩니다.

```typescript
function pipe<T>(...fns: Array<(x: T) => T>) {
  return (x: T) => fns.reduce((acc, fn) => fn(acc), x);
}

const transform = pipe(square, addOne, double);
transform(3); // 20 — 왼쪽(square)부터 실행
```

compose와 pipe는 실행 순서만 다릅니다. 대부분의 실무 코드에서는 읽는 순서와 실행 순서가 일치하는 **pipe**가 더 직관적입니다.

## 왜 쓰는가

```typescript
// 중첩 호출 — 안쪽부터 읽어야 해서 불편
const processedName = trim(capitalize(removeSpecialChars(raw)));

// pipe — 왼쪽에서 오른쪽으로 읽힘
const processName = pipe(removeSpecialChars, capitalize, trim);
const processedName2 = processName(raw);
```

파이프는 데이터가 변환 단계를 거쳐 흘러가는 과정을 그대로 표현합니다. 각 단계가 무엇을 하는지 순서대로 읽힙니다.

## 실용 예시

### 사용자 이름 처리

```typescript
const trim = (s: string) => s.trim();
const toLowerCase = (s: string) => s.toLowerCase();
const removeSpaces = (s: string) => s.replace(/\s+/g, '-');
const truncate = (max: number) => (s: string) => s.slice(0, max);

const toSlug = pipe(trim, toLowerCase, removeSpaces, truncate(50));

toSlug('  Hello World  '); // 'hello-world'
toSlug('  TypeScript는 멋지다  '); // 'typescript는-멋지다'
```

### 데이터 변환 파이프라인

```typescript
type User = { name: string; age: number; active: boolean; score: number };

const users: User[] = [
  { name: '홍길동', age: 25, active: true, score: 85 },
  { name: '김영희', age: 17, active: true, score: 92 },
  { name: '이철수', age: 30, active: false, score: 78 },
  { name: '박민준', age: 22, active: true, score: 95 },
];

// 커링된 유틸리티
const filter = <T>(pred: (x: T) => boolean) => (arr: T[]) => arr.filter(pred);
const map = <T, U>(fn: (x: T) => U) => (arr: T[]) => arr.map(fn);
const sortBy = <T>(key: keyof T) => (arr: T[]) =>
  [...arr].sort((a, b) => (a[key] > b[key] ? 1 : -1));

// pipe로 파이프라인 구성
const getTopActiveAdults = pipe(
  filter<User>(u => u.active),
  filter<User>(u => u.age >= 18),
  sortBy<User>('score'),
  map<User, string>(u => u.name),
);

getTopActiveAdults(users); // ['홍길동', '박민준'] (score 오름차순)
```

### 미들웨어 패턴

```typescript
type Handler = (req: Request) => Response;
type Middleware = (handler: Handler) => Handler;

const withLogging: Middleware = handler => req => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  return handler(req);
};

const withAuth: Middleware = handler => req => {
  if (!req.headers.get('Authorization')) {
    return new Response('Unauthorized', { status: 401 });
  }
  return handler(req);
};

const withCors: Middleware = handler => req => {
  const res = handler(req);
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
};

// compose로 미들웨어 스택 구성
const applyMiddlewares = compose(withLogging, withAuth, withCors);

const myHandler: Handler = req => new Response('OK');
const wrappedHandler = applyMiddlewares(myHandler);
```

## 타입 안전한 pipe

TypeScript에서 타입이 안전한 pipe를 만들려면 오버로드가 필요합니다.

```typescript
// TypeScript 오버로드로 타입 추론 지원
function pipe<A>(value: A): A;
function pipe<A, B>(value: A, fn1: (a: A) => B): B;
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
function pipe<A, B, C, D>(
  value: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
): D;
// ... 필요한 만큼 추가

function pipe(value: unknown, ...fns: Array<(x: unknown) => unknown>): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}

// 타입 추론이 동작함
const result = pipe(
  '  Hello World  ',
  (s: string) => s.trim(),
  (s: string) => s.toLowerCase(),
  (s: string) => s.split(' '),
);
// result: string[]
```

실무에서는 `fp-ts`의 `pipe`, `flow`나 ramda의 `pipe`, `compose`를 사용하면 타입 안전성이 보장됩니다.

## compose vs pipe 선택

```typescript
// compose: 수학 표기법에 가까움 (f ∘ g ∘ h)
const f = compose(h, g, f_original); // h(g(f_original(x)))

// pipe: 쉘 파이프와 유사 (f | g | h)
const f = pipe(f_original, g, h); // h(g(f_original(x)))
```

수학적 표기를 선호하면 compose, 읽기 쉬움을 선호하면 pipe를 선택합니다. 실무에서는 pipe가 훨씬 많이 쓰입니다.

## 정리

- **compose**: 오른쪽 → 왼쪽 실행 (`f(g(x))`)
- **pipe**: 왼쪽 → 오른쪽 실행 (`g(f(x))`) — 더 직관적

작은 순수 함수들을 pipe로 연결하면 복잡한 변환 로직도 읽기 쉬운 파이프라인으로 표현할 수 있습니다. 커링과 함께 사용하면 재사용 가능한 변환 단계를 조립해 새 함수를 만들 수 있습니다.
