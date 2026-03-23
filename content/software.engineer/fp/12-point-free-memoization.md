---
title: "[FP 시리즈] 12. 포인트 프리 스타일과 메모이제이션"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "포인트프리", "메모이제이션", "point-free", "memoization", "FP"]
---

# 포인트 프리 스타일과 메모이제이션

## 포인트 프리 스타일 (Point-free Style)

"포인트"는 함수의 인자(argument)를 말합니다. 포인트 프리 스타일은 **함수를 정의할 때 인자를 명시하지 않는** 방식입니다.

### 비교

```typescript
// 포인트 있는 (pointful) 스타일 — 인자를 명시
const double = (x: number) => x * 2;
const isEven = (x: number) => x % 2 === 0;
const toString = (x: number) => x.toString();

// 포인트 프리 스타일 — 함수 자체를 조합
const double = (x: number) => x * 2; // 이건 원래 정의

const numbers = [1, 2, 3, 4, 5];

// 포인트 있는 방식
const doubled = numbers.map(x => double(x));

// 포인트 프리 방식 — x를 명시하지 않음
const doubled2 = numbers.map(double);
```

함수가 받는 인자와 콜백이 받는 인자가 같다면 중간 함수를 제거할 수 있습니다.

### 더 많은 예시

```typescript
const trim = (s: string) => s.trim();
const toLowerCase = (s: string) => s.toLowerCase();
const split = (sep: string) => (s: string) => s.split(sep);

// 포인트 있는 방식
const processInput = (s: string) => toLowerCase(trim(s));

// 포인트 프리 방식 — compose 활용
const processInput2 = compose(toLowerCase, trim);

// 배열 처리
const names = ['  Alice  ', '  Bob  ', '  CAROL  '];

// 포인트 있는 방식
const processed = names.map(name => toLowerCase(trim(name)));

// 포인트 프리 방식
const processed2 = names.map(compose(toLowerCase, trim));
```

### 커링과 함께

커링이 포인트 프리를 가능하게 합니다.

```typescript
const add = (a: number) => (b: number) => a + b;
const multiply = (a: number) => (b: number) => a * b;

// 포인트 있는 방식
const addTen = (x: number) => add(10)(x);
const double = (x: number) => multiply(2)(x);

// 포인트 프리 방식
const addTen2 = add(10);
const double2 = multiply(2);

// 배열에서
const numbers = [1, 2, 3, 4, 5];
numbers.map(add(10));    // [11, 12, 13, 14, 15]
numbers.map(multiply(2)); // [2, 4, 6, 8, 10]
```

### 언제 포인트 프리가 좋고 나쁜가

```typescript
// 좋은 예 — 의도가 명확
const getNames = map((user: User) => user.name);
const filterActive = filter((user: User) => user.active);
const sortByAge = sortBy((user: User) => user.age);

const processUsers = pipe(filterActive, sortByAge, getNames);

// 나쁜 예 — 읽기 어려움
const f = compose(
  filter(gt(__, 5)),  // 5보다 큰
  map(multiply(2)),   // 2배
);
// 이건 포인트 있는 방식이 더 명확
const f2 = (arr: number[]) => arr.map(x => x * 2).filter(x => x > 5);
```

포인트 프리는 **코드가 더 읽기 쉬울 때** 씁니다. 읽기 어려워진다면 인자를 명시하는 게 낫습니다.

---

## 메모이제이션 (Memoization)

**순수 함수의 결과를 캐싱**해서 같은 입력이 들어오면 다시 계산하지 않고 저장된 결과를 반환합니다.

### 왜 순수 함수에서만 안전한가

메모이제이션은 "같은 입력이면 항상 같은 출력"을 가정합니다. 이것이 순수 함수의 정의와 정확히 일치합니다. 부수 효과가 있는 함수를 메모이제이션하면 이후 호출에서 효과가 실행되지 않아 예상치 못한 동작이 발생합니다.

### 기본 구현

```typescript
function memoize<T extends unknown[], R>(
  fn: (...args: T) => R,
): (...args: T) => R {
  const cache = new Map<string, R>();

  return (...args: T): R => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
```

### 피보나치 예시

```typescript
// 메모이제이션 없음 — 지수 시간
function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

// fib(40)은 수십 초 걸림 (2^40번 가까이 호출)

// 메모이제이션 — 선형 시간
const fibMemo = memoize(function fib(n: number): number {
  if (n <= 1) return n;
  return fibMemo(n - 1) + fibMemo(n - 2);
});

// fibMemo(40)은 즉시 반환
```

### 비용이 큰 계산 캐싱

```typescript
// 복잡한 필터링/정렬이 반복되는 경우
const expensiveFilter = memoize((data: Item[], threshold: number): Item[] => {
  return data
    .filter(item => item.value > threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);
});
```

### React에서의 메모이제이션

React는 메모이제이션 훅을 제공합니다.

```typescript
// useMemo: 계산 결과를 캐싱
const expensiveValue = useMemo(() => {
  return data.filter(x => x.active).reduce((acc, x) => acc + x.value, 0);
}, [data]); // data가 바뀔 때만 재계산

// useCallback: 함수 자체를 캐싱
const handleClick = useCallback((id: string) => {
  dispatch({ type: 'SELECT', payload: id });
}, [dispatch]); // dispatch가 바뀔 때만 새 함수 생성

// React.memo: 컴포넌트를 메모이제이션
const ExpensiveComponent = React.memo(({ data }: { data: Item[] }) => {
  return <div>{data.map(item => <Item key={item.id} {...item} />)}</div>;
});
// props가 바뀔 때만 리렌더링
```

### WeakMap을 활용한 객체 키 캐싱

```typescript
// JSON.stringify 대신 WeakMap으로 객체를 키로 사용
function memoizeWithWeakMap<T extends object, R>(fn: (arg: T) => R) {
  const cache = new WeakMap<T, R>();
  return (arg: T): R => {
    if (cache.has(arg)) return cache.get(arg)!;
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}

// 참조가 같을 때만 캐시 히트 — 메모리 누수 없음 (WeakMap은 GC됨)
const processUser = memoizeWithWeakMap((user: User) => {
  return expensiveTransform(user);
});
```

### 무효화 전략

메모이제이션의 어려운 점은 캐시 무효화입니다.

```typescript
// TTL(Time To Live) 기반 캐시
function memoizeWithTTL<T extends unknown[], R>(
  fn: (...args: T) => R,
  ttlMs: number,
): (...args: T) => R {
  const cache = new Map<string, { value: R; expiresAt: number }>();

  return (...args: T): R => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    const value = fn(...args);
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  };
}

// 5분 캐시
const fetchUserCached = memoizeWithTTL(fetchUser, 5 * 60 * 1000);
```

## 정리

**포인트 프리 스타일**:
- 함수 정의에서 인자를 생략
- 함수 합성(compose/pipe)과 잘 어울림
- 가독성이 높아질 때만 사용 — 억지로 쓰면 역효과

**메모이제이션**:
- 순수 함수의 결과를 캐싱해 중복 계산 방지
- 순수 함수에서만 안전하게 사용 가능
- React의 `useMemo`, `useCallback`, `React.memo`가 이 패턴을 적용

두 기법 모두 순수 함수라는 기반 위에서 작동합니다.
