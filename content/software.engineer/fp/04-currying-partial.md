---
title: "[FP 시리즈] 4. 커링과 부분 적용"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "커링", "부분적용", "currying", "partial application", "FP"]
---

# 커링과 부분 적용

커링(Currying)과 부분 적용(Partial Application)은 비슷해 보이지만 다릅니다. 둘 다 **인자를 나눠서 적용**한다는 공통점이 있지만 목적과 메커니즘이 다릅니다.

## 커링

여러 인자를 받는 함수를 **인자를 하나씩 받는 함수들의 체인**으로 변환하는 것입니다.

```typescript
// 일반 함수
function add(a: number, b: number): number {
  return a + b;
}

add(2, 3); // 5

// 커링된 함수
function curriedAdd(a: number) {
  return function(b: number): number {
    return a + b;
  };
}

curriedAdd(2)(3); // 5

// 화살표 함수로 더 간결하게
const add = (a: number) => (b: number) => a + b;
add(2)(3); // 5
```

인자 3개도 마찬가지입니다.

```typescript
const multiply = (a: number) => (b: number) => (c: number) => a * b * c;

multiply(2)(3)(4); // 24
```

## 부분 적용

함수의 인자 중 **일부만 미리 적용**해서 새 함수를 만드는 것입니다.

```typescript
function add(a: number, b: number): number {
  return a + b;
}

// 첫 번째 인자를 미리 적용
const add5 = add.bind(null, 5);

add5(3); // 8
add5(10); // 15
```

또는 직접 구현할 수 있습니다.

```typescript
function partial<T extends unknown[], R>(
  fn: (...args: T) => R,
  ...presetArgs: Partial<T>
): (...laterArgs: unknown[]) => R {
  return (...laterArgs) => fn(...([...presetArgs, ...laterArgs] as T));
}

function greet(greeting: string, name: string): string {
  return `${greeting}, ${name}!`;
}

const hello = partial(greet, 'Hello');
hello('홍길동'); // "Hello, 홍길동!"
hello('김영희'); // "Hello, 김영희!"
```

## 커링 vs 부분 적용 차이

```typescript
// 커링: 인자를 하나씩 받는 구조로 함수를 변환
const curriedAdd = (a: number) => (b: number) => a + b;
// 항상 하나씩만 받음

// 부분 적용: 기존 함수에서 일부 인자를 미리 채운 새 함수 생성
const add10 = add.bind(null, 10);
// 나머지 인자를 한 번에 받을 수 있음
```

| | 커링 | 부분 적용 |
|--|------|---------|
| 변환 대상 | 함수 자체의 구조 변경 | 기존 함수의 인자를 고정 |
| 인자 수 | 항상 1개씩 | 여러 개 가능 |
| 목적 | 함수 조합에 적합한 구조 | 특정 맥락에 맞는 함수 생성 |

## 커링의 실용적 활용

### 재사용 가능한 함수 만들기

```typescript
const filter = (predicate: (x: number) => boolean) => (arr: number[]) =>
  arr.filter(predicate);

const isEven = (n: number) => n % 2 === 0;
const isPositive = (n: number) => n > 0;

const filterEven = filter(isEven);
const filterPositive = filter(isPositive);

filterEven([1, 2, 3, 4, 5]);    // [2, 4]
filterPositive([-1, 0, 1, 2]);   // [1, 2]
```

### 설정을 나중에 주입하기

```typescript
// DB 커넥션을 나중에 주입하는 패턴
const findUser = (db: Database) => (id: string) =>
  db.query(`SELECT * FROM users WHERE id = $1`, [id]);

// 테스트에서는 mock DB 주입
const findTestUser = findUser(mockDb);

// 프로덕션에서는 실제 DB 주입
const findProdUser = findUser(realDb);
```

### 이벤트 핸들러 설정

```typescript
const handleEvent = (action: string) => (event: Event) => {
  event.preventDefault();
  dispatch({ type: action, payload: event.target });
};

button.addEventListener('click', handleEvent('SAVE'));
input.addEventListener('change', handleEvent('UPDATE'));
```

## `curry` 유틸리티

매번 화살표 함수를 중첩하기 불편하면 `curry` 유틸리티를 사용합니다.

```typescript
// ramda나 lodash/fp의 curry와 유사한 구현
function curry<T extends unknown[], R>(fn: (...args: T) => R) {
  return function curried(...args: unknown[]): unknown {
    if (args.length >= fn.length) {
      return fn(...(args as T));
    }
    return (...moreArgs: unknown[]) => curried(...args, ...moreArgs);
  };
}

// 사용
const add = curry((a: number, b: number, c: number) => a + b + c);

add(1)(2)(3);    // 6 — 하나씩
add(1, 2)(3);    // 6 — 두 개 + 하나
add(1)(2, 3);    // 6 — 하나 + 두 개
add(1, 2, 3);    // 6 — 한 번에
```

실무에서는 직접 구현보다 [ramda](https://ramdajs.com/)나 `fp-ts`를 사용하는 경우가 많습니다.

## 함수 조합과의 연결

커링의 진가는 함수 조합(composition)과 함께 사용할 때 발휘됩니다. 함수 조합은 `f(g(x))` 패턴인데, 인자가 하나일 때 자연스럽게 연결됩니다.

```typescript
const users = [
  { name: '홍길동', age: 25, active: true },
  { name: '김영희', age: 17, active: true },
  { name: '이철수', age: 30, active: false },
];

// 커링된 함수들
const filterBy = (pred: (x: typeof users[0]) => boolean) =>
  (arr: typeof users) => arr.filter(pred);

const mapBy = <T>(fn: (x: typeof users[0]) => T) =>
  (arr: typeof users) => arr.map(fn);

// 조합해서 파이프라인 구성
const getActiveAdultNames = (arr: typeof users) =>
  mapBy(u => u.name)(
    filterBy(u => u.active)(
      filterBy(u => u.age >= 18)(arr)
    )
  );

getActiveAdultNames(users); // ['홍길동']
```

다음 아티클에서 함수 합성(compose)과 파이프(pipe)를 사용하면 이 코드를 더 읽기 좋게 만들 수 있습니다.

## 정리

- **커링**: `f(a, b)` → `f(a)(b)` — 함수를 인자 하나씩 받는 체인으로 변환
- **부분 적용**: 인자 일부를 미리 채운 새 함수 생성 — 특정 맥락에 맞게 특수화

커링은 함수를 재사용 가능한 조각으로 만들고 함수 조합을 가능하게 합니다. 의존성 주입, 설정 주입 등 FP 패턴의 기반이 됩니다.
