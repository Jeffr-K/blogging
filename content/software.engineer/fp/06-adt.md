---
title: "[FP 시리즈] 6. 대수적 데이터 타입: 합 타입과 곱 타입"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "ADT", "합타입", "곱타입", "sum type", "product type", "FP"]
---

# 대수적 데이터 타입: 합 타입과 곱 타입

대수적 데이터 타입(Algebraic Data Type, ADT)은 **타입을 조합해서 새 타입을 만드는 방법**입니다. 대수(algebra)라는 이름처럼 타입들 사이에 "덧셈"과 "곱셈"에 해당하는 두 가지 조합 방식이 있습니다.

## 곱 타입 (Product Type)

두 타입 A, B의 **모든 조합**을 가진 타입입니다. 가능한 값의 수가 `|A| × |B|`이기 때문에 곱 타입입니다.

```typescript
// 튜플 — 가장 단순한 곱 타입
type Point = [number, number]; // number × number

// 객체/레코드
type User = {
  name: string;  // 가능한 string 수
  age: number;   // × 가능한 number 수
  active: boolean; // × 2 (true | false)
};
// 가능한 User의 수 = string 수 × number 수 × 2
```

곱 타입은 **모든 필드가 동시에 존재**합니다. `User`는 `name`, `age`, `active`를 항상 동시에 가집니다.

## 합 타입 (Sum Type / Union Type)

두 타입 A, B 중 **하나인** 타입입니다. 가능한 값의 수가 `|A| + |B|`이기 때문에 합 타입입니다.

```typescript
// TypeScript의 union type이 합 타입
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rectangle'; width: number; height: number }
  | { kind: 'triangle'; base: number; height: number };

// Shape는 세 가지 형태 중 하나
```

합 타입은 **하나의 값이 여러 경우 중 하나**임을 표현합니다. 동시에 circle이면서 rectangle인 Shape는 없습니다.

## 패턴 매칭으로 합 타입 처리

합 타입은 모든 경우를 처리했는지 컴파일러가 확인할 수 있게 해줍니다.

```typescript
function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rectangle':
      return shape.width * shape.height;
    case 'triangle':
      return (shape.base * shape.height) / 2;
    // 모든 경우를 처리하지 않으면 TypeScript가 오류를 냄
  }
}
```

`never` 타입을 이용한 완전성 검사:

```typescript
function assertNever(x: never): never {
  throw new Error(`처리되지 않은 케이스: ${JSON.stringify(x)}`);
}

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rectangle':
      return shape.width * shape.height;
    case 'triangle':
      return (shape.base * shape.height) / 2;
    default:
      return assertNever(shape); // 새 케이스 추가 시 여기서 컴파일 에러
  }
}
```

나중에 `Shape`에 `'pentagon'`을 추가하면 `assertNever`를 호출하는 줄에서 컴파일 에러가 납니다. 처리를 강제할 수 있습니다.

## 합 타입이 해결하는 문제

### boolean 지옥

```typescript
// boolean 플래그가 늘어나면 유효하지 않은 상태가 생김
type LoadingState = {
  isLoading: boolean;
  data: User[] | null;
  error: string | null;
};

// 이런 상태가 이론상 가능:
// isLoading: true, data: [...], error: '오류' — 말이 안 됨
```

합 타입으로 유효한 상태만 표현:

```typescript
type LoadingState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User[] }
  | { status: 'error'; error: string };

// 이제 'loading'이면서 data가 있는 상태는 불가능
```

### null 체크 지옥

```typescript
// 합 타입 없이
function getUser(id: string): User | null {
  // 호출하는 쪽에서 null 체크를 잊을 수 있음
}

// 합 타입으로 명시
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function getUser(id: string): Result<User> {
  // 호출하는 쪽이 ok를 확인하지 않으면 value에 접근 불가
}

const result = getUser('123');
if (result.ok) {
  console.log(result.value.name); // 안전하게 접근
} else {
  console.log(result.error);
}
```

## 실용적인 ADT 예시

### 도메인 이벤트

```typescript
type OrderEvent =
  | { type: 'placed'; orderId: string; userId: string; items: Item[] }
  | { type: 'paid'; orderId: string; amount: number }
  | { type: 'shipped'; orderId: string; trackingNumber: string }
  | { type: 'delivered'; orderId: string; deliveredAt: Date }
  | { type: 'cancelled'; orderId: string; reason: string };

function handleOrderEvent(event: OrderEvent): void {
  switch (event.type) {
    case 'placed':
      console.log(`주문 생성: ${event.orderId}, 사용자: ${event.userId}`);
      break;
    case 'paid':
      console.log(`결제 완료: ${event.orderId}, 금액: ${event.amount}`);
      break;
    case 'shipped':
      console.log(`배송 시작: ${event.trackingNumber}`);
      break;
    case 'delivered':
      console.log(`배송 완료: ${event.deliveredAt}`);
      break;
    case 'cancelled':
      console.log(`주문 취소: ${event.reason}`);
      break;
  }
}
```

### 트리 구조 (재귀 ADT)

```typescript
type Tree<T> =
  | { kind: 'leaf'; value: T }
  | { kind: 'node'; left: Tree<T>; right: Tree<T> };

function sum(tree: Tree<number>): number {
  switch (tree.kind) {
    case 'leaf':
      return tree.value;
    case 'node':
      return sum(tree.left) + sum(tree.right);
  }
}

const tree: Tree<number> = {
  kind: 'node',
  left: { kind: 'node', left: { kind: 'leaf', value: 1 }, right: { kind: 'leaf', value: 2 } },
  right: { kind: 'leaf', value: 3 },
};

sum(tree); // 6
```

## 정리

- **곱 타입**: 모든 필드가 동시에 존재 — `A AND B` (객체, 튜플)
- **합 타입**: 여러 경우 중 하나 — `A OR B` (union type)
- **ADT**: 두 조합을 사용해 복잡한 데이터 구조를 표현

합 타입은 **불가능한 상태를 타입 시스템으로 막는** 핵심 도구입니다. `boolean` 플래그를 조합하는 대신 합 타입으로 유효한 상태만 표현하면 런타임 오류를 컴파일 타임에 잡을 수 있습니다.
