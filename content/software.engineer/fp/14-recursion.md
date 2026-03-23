---
title: "[FP 시리즈] 14. 재귀와 꼬리 재귀"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "재귀", "꼬리재귀", "recursion", "tail call", "FP"]
---

# 재귀와 꼬리 재귀

FP에서 루프(`for`, `while`)는 상태를 변경합니다. 반복 변수 `i`가 계속 바뀌기 때문입니다. 불변성을 지키려면 반복 대신 **재귀**를 씁니다.

## 왜 재귀인가

```typescript
// 명령형 — 상태 변이
function sum(arr: number[]): number {
  let total = 0; // 변이되는 상태
  for (const n of arr) {
    total += n;  // 변이
  }
  return total;
}

// 함수형 — 재귀
function sum(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr[0] + sum(arr.slice(1));
}
```

재귀 버전은 변이되는 상태가 없습니다. "첫 번째 원소 + 나머지의 합"이라는 **정의**를 그대로 코드로 옮겼습니다.

## 기본 패턴

재귀 함수는 두 부분으로 이루어집니다.

```typescript
function recursive(input: T): R {
  // 1. 기저 사례 (base case) — 재귀를 멈추는 조건
  if (baseCondition(input)) return baseResult;

  // 2. 재귀 사례 (recursive case) — 더 작은 문제로 쪼개기
  return combine(result, recursive(smaller(input)));
}
```

### 리스트 처리

```typescript
// 길이
function length<T>(arr: T[]): number {
  if (arr.length === 0) return 0;
  return 1 + length(arr.slice(1));
}

// map
function map<T, U>(arr: T[], fn: (x: T) => U): U[] {
  if (arr.length === 0) return [];
  return [fn(arr[0]), ...map(arr.slice(1), fn)];
}

// filter
function filter<T>(arr: T[], pred: (x: T) => boolean): T[] {
  if (arr.length === 0) return [];
  const [head, ...tail] = arr;
  return pred(head) ? [head, ...filter(tail, pred)] : filter(tail, pred);
}
```

### 트리 처리

재귀는 트리 구조에서 특히 자연스럽습니다.

```typescript
type TreeNode = {
  value: number;
  left?: TreeNode;
  right?: TreeNode;
};

// 트리의 모든 값 합산
function sumTree(node?: TreeNode): number {
  if (!node) return 0;
  return node.value + sumTree(node.left) + sumTree(node.right);
}

// 트리 깊이
function depth(node?: TreeNode): number {
  if (!node) return 0;
  return 1 + Math.max(depth(node.left), depth(node.right));
}

// 트리의 모든 값을 배열로 (중위 순회)
function inOrder(node?: TreeNode): number[] {
  if (!node) return [];
  return [...inOrder(node.left), node.value, ...inOrder(node.right)];
}
```

## 스택 오버플로 문제

재귀의 약점입니다. 깊이가 깊어지면 콜 스택이 쌓여 터집니다.

```typescript
// 10만 개 배열에 재귀 sum 호출
sum(Array(100000).fill(1));
// RangeError: Maximum call stack size exceeded
```

## 꼬리 재귀 (Tail Call Optimization)

재귀 호출이 함수의 **마지막 연산**일 때, 일부 런타임은 스택 프레임을 재사용해 스택 오버플로를 방지합니다. 이것이 꼬리 재귀 최적화(TCO)입니다.

```typescript
// 일반 재귀 — 꼬리 위치가 아님
function sum(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr[0] + sum(arr.slice(1)); // sum 호출 후 + 연산이 더 있음
}
// 콜 스택: sum(1000) → sum(999) → ... → sum(0)
// 각 프레임이 결과를 기다리며 스택에 쌓임

// 꼬리 재귀 — accumulator 패턴
function sum(arr: number[], acc = 0): number {
  if (arr.length === 0) return acc;
  return sum(arr.slice(1), acc + arr[0]); // 마지막 연산이 재귀 호출
}
// 이론상 스택 프레임 재사용 가능
```

핵심은 **accumulator(누산기)**를 인자로 넘기는 것입니다. 중간 결과를 스택이 아닌 인자에 보관합니다.

```typescript
// 팩토리얼 — 꼬리 재귀
function factorial(n: number, acc = 1): number {
  if (n <= 1) return acc;
  return factorial(n - 1, n * acc); // 마지막이 재귀 호출
}

// 피보나치 — 꼬리 재귀
function fib(n: number, a = 0, b = 1): number {
  if (n === 0) return a;
  return fib(n - 1, b, a + b); // 마지막이 재귀 호출
}
```

> **주의**: JavaScript/TypeScript에서 TCO는 strict mode에서 이론적으로 지원되지만 대부분의 엔진(V8 등)이 실제로는 구현하지 않습니다. 실무에서 깊은 재귀가 필요하면 트램폴린을 사용합니다.

## 트램폴린 (Trampoline)

TCO가 없는 환경에서 깊은 재귀를 안전하게 실행하는 패턴입니다.

```typescript
// 즉시 실행 대신 "다음에 실행할 함수"를 반환
type Thunk<T> = () => T | Thunk<T>;

function trampoline<T>(fn: () => T | Thunk<T>): T {
  let result = fn();
  while (typeof result === 'function') {
    result = (result as Thunk<T>)();
  }
  return result as T;
}

// 트램폴린용 sum
function sumTrampoline(arr: number[], acc = 0): number | Thunk<number> {
  if (arr.length === 0) return acc;
  return () => sumTrampoline(arr.slice(1), acc + arr[0]); // 함수로 감싸 반환
}

const result = trampoline(() => sumTrampoline(Array(100000).fill(1)));
// 100000 — 스택 오버플로 없음
```

## 상호 재귀

두 함수가 서로를 호출하는 패턴입니다.

```typescript
// 짝수/홀수 판별
function isEven(n: number): boolean {
  if (n === 0) return true;
  return isOdd(n - 1);
}

function isOdd(n: number): boolean {
  if (n === 0) return false;
  return isEven(n - 1);
}

isEven(4); // true
isOdd(5);  // true
```

## 정리

- **재귀**: 변이 없는 반복 — 문제를 더 작은 같은 구조의 문제로 쪼갬
- **꼬리 재귀**: 마지막 연산이 재귀 호출 + accumulator 패턴 — 스택 최소화
- **트램폴린**: TCO 없는 환경에서 깊은 재귀를 안전하게

트리, 리스트, 파서, 상태 머신 등 **구조가 재귀적인 데이터**를 다룰 때 재귀는 가장 자연스러운 표현입니다.
