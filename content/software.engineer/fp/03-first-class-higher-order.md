---
title: "[FP 시리즈] 3. 일급 함수와 고차 함수"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "일급함수", "고차함수", "first-class", "higher-order", "FP"]
---

# 일급 함수와 고차 함수

함수형 프로그래밍이 가능하려면 언어가 함수를 **값처럼 다룰 수 있어야** 합니다. 이것이 일급 함수(First-class Function)이고, 이를 활용한 패턴이 고차 함수(Higher-order Function)입니다.

## 일급 함수

함수가 일급(first-class)이라는 말은 함수를 숫자나 문자열처럼 다룰 수 있다는 뜻입니다.

```typescript
// 1. 변수에 할당 가능
const double = (x: number) => x * 2;
const greet = (name: string) => `Hello, ${name}`;

// 2. 다른 함수의 인자로 전달 가능
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(double); // 함수를 인자로 전달

// 3. 함수에서 반환 가능
function multiplier(factor: number) {
  return (x: number) => x * factor; // 함수를 반환
}

const triple = multiplier(3);
triple(5); // 15

// 4. 배열이나 객체에 저장 가능
const operations = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  multiply: (a: number, b: number) => a * b,
};
```

JavaScript와 TypeScript는 일급 함수를 지원합니다.

## 고차 함수

**함수를 인자로 받거나 함수를 반환하는 함수**입니다.

### 함수를 인자로 받는 경우

가장 친숙한 예시는 배열 메서드들입니다.

```typescript
const users = [
  { name: '홍길동', age: 25, active: true },
  { name: '김영희', age: 30, active: false },
  { name: '이철수', age: 22, active: true },
];

// map: 배열의 각 요소를 변환
const names = users.map(user => user.name);
// ['홍길동', '김영희', '이철수']

// filter: 조건을 만족하는 요소만 추출
const activeUsers = users.filter(user => user.active);
// [{ name: '홍길동', ... }, { name: '이철수', ... }]

// reduce: 배열을 하나의 값으로 축약
const totalAge = users.reduce((sum, user) => sum + user.age, 0);
// 77
```

이 메서드들은 "무엇을 할지"만 함수로 받고, "어떻게 반복할지"는 내부에서 처리합니다. 이것이 고차 함수의 힘입니다.

### 함수를 반환하는 경우

반환된 함수를 나중에 호출하거나 다른 함수에 전달할 수 있습니다.

```typescript
// 특정 조건으로 필터링하는 함수를 만드는 함수
function createFilter<T>(predicate: (item: T) => boolean) {
  return (items: T[]) => items.filter(predicate);
}

const getActiveUsers = createFilter((user: typeof users[0]) => user.active);
const getAdults = createFilter((user: typeof users[0]) => user.age >= 25);

getActiveUsers(users); // active인 사용자만
getAdults(users);      // 25세 이상 사용자만
```

```typescript
// 로깅 래퍼 — 어떤 함수든 감싸서 로그를 추가
function withLogging<T extends unknown[], R>(
  fn: (...args: T) => R,
  name: string,
): (...args: T) => R {
  return (...args: T) => {
    console.log(`[${name}] 호출:`, args);
    const result = fn(...args);
    console.log(`[${name}] 결과:`, result);
    return result;
  };
}

const loggedAdd = withLogging((a: number, b: number) => a + b, 'add');
loggedAdd(2, 3);
// [add] 호출: [2, 3]
// [add] 결과: 5
```

## 직접 만들어보기: map, filter, reduce

고차 함수가 어떻게 동작하는지 이해하는 가장 좋은 방법은 직접 구현해보는 것입니다.

```typescript
function myMap<T, U>(arr: T[], fn: (item: T) => U): U[] {
  const result: U[] = [];
  for (const item of arr) {
    result.push(fn(item));
  }
  return result;
}

function myFilter<T>(arr: T[], predicate: (item: T) => boolean): T[] {
  const result: T[] = [];
  for (const item of arr) {
    if (predicate(item)) result.push(item);
  }
  return result;
}

function myReduce<T, U>(arr: T[], fn: (acc: U, item: T) => U, initial: U): U {
  let acc = initial;
  for (const item of arr) {
    acc = fn(acc, item);
  }
  return acc;
}
```

이렇게 보면 `map`, `filter`, `reduce`는 루프를 추상화한 고차 함수입니다. 반복 방식은 내부에 감추고, 핵심 로직만 인자로 받습니다.

## 고차 함수로 추상화 만들기

```typescript
// 반복되는 패턴을 고차 함수로 추상화
const users2 = [
  { name: '홍길동', role: 'admin' },
  { name: '김영희', role: 'user' },
  { name: '이철수', role: 'admin' },
];

// 고차 함수 없이
const adminNames: string[] = [];
for (const user of users2) {
  if (user.role === 'admin') {
    adminNames.push(user.name);
  }
}

// 고차 함수로
const adminNames2 = users2
  .filter(user => user.role === 'admin')
  .map(user => user.name);
```

고차 함수를 쓰면 **무엇을 할지**와 **어떻게 할지**가 분리됩니다. 의도가 더 명확하게 드러납니다.

## 실용 패턴: 함수 팩토리

```typescript
// 공통 API 요청 패턴을 추상화
function createApiCall<T>(endpoint: string) {
  return async (): Promise<T> => {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
}

const fetchUsers = createApiCall<User[]>('/api/users');
const fetchPosts = createApiCall<Post[]>('/api/posts');

// 사용
const users = await fetchUsers();
const posts = await fetchPosts();
```

```typescript
// 이벤트 핸들러 팩토리
function createHandler(action: string) {
  return (event: Event) => {
    event.preventDefault();
    console.log(`${action} 처리`);
  };
}

button.addEventListener('click', createHandler('저장'));
form.addEventListener('submit', createHandler('제출'));
```

## 정리

- **일급 함수**: 함수를 값처럼 다룰 수 있음 — 변수 할당, 인자 전달, 반환, 저장 모두 가능
- **고차 함수**: 함수를 받거나 반환하는 함수 — `map`, `filter`, `reduce`가 대표적

고차 함수는 반복 패턴을 추상화하고 코드의 중복을 줄이는 핵심 도구입니다. 커링, 함수 합성, 의존성 주입 등 FP의 다른 패턴들은 모두 일급 함수와 고차 함수 위에서 작동합니다.
