---
title: "[React 훅 시리즈] 4. useMemo: 비싼 계산 결과를 캐싱하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "hooks", "useMemo", "memoization", "성능최적화"]
---

# `useMemo`: 비싼 계산 결과를 캐싱하기

React 컴포넌트는 상태나 props가 바뀔 때마다 함수 전체가 다시 실행됩니다. 이때 계산 비용이 큰 작업이 있다면, 관련 없는 상태 변화에도 불필요하게 재계산이 일어납니다. `useMemo`는 이런 상황에서 계산 결과를 **기억해두었다가** 재사용합니다.

## 기본 사용법

```jsx
import { useMemo } from 'react';

const cachedValue = useMemo(() => {
  return 계산하는_함수();
}, [의존성]);
```

- 의존성 배열의 값이 바뀌지 않으면, 이전에 계산한 값을 그대로 반환합니다
- 의존성 배열의 값이 바뀌면, 함수를 다시 실행하고 새 값을 저장합니다

## 실전 예제

```jsx
function ProductList({ products, filterText }) {
  // filterText나 products가 바뀔 때만 다시 필터링
  const filteredProducts = useMemo(() => {
    console.log('필터링 실행됨');
    return products.filter(p =>
      p.name.includes(filterText)
    );
  }, [products, filterText]);

  return (
    <ul>
      {filteredProducts.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

`filterText`나 `products`가 바뀌지 않은 채 다른 이유로 렌더링이 발생해도, 필터링 연산은 다시 실행되지 않습니다.

## 언제 사용해야 할까?

`useMemo`는 **모든 계산에 쓰는 것이 좋은 게 아닙니다**. 오히려 성능이 나빠질 수도 있습니다.

**적합한 경우**
- 수천 개 데이터를 정렬/필터링하는 등 실제로 느린 연산
- 결과를 다른 훅의 의존성으로 사용할 때 (객체/배열 참조 안정성)

**적합하지 않은 경우**
- 단순한 덧셈, 문자열 연결 같은 가벼운 연산
- 의존성 배열의 값이 거의 항상 바뀌는 경우

```jsx
// 불필요한 useMemo: 단순 연산에는 그냥 계산하는 것이 더 빠름
const total = useMemo(() => price * quantity, [price, quantity]);

// 그냥 이렇게:
const total = price * quantity;
```

## 참조 안정성 (Reference Stability)

`useMemo`의 또 다른 중요한 용도는 객체나 배열의 **참조를 안정적으로 유지하는 것**입니다.

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  // count가 바뀌지 않으면 같은 객체 참조를 유지
  const config = useMemo(() => ({
    theme: 'dark',
    language: 'ko',
  }), []);

  return <Child config={config} />;
}
```

`config` 객체를 `useMemo` 없이 작성하면, `Parent`가 렌더링될 때마다 새 객체가 만들어집니다. 내용이 같아도 참조가 다르므로, `Child`가 불필요하게 리렌더링될 수 있습니다.

## 정리

| 항목 | 내용 |
|------|------|
| 역할 | 계산 결과를 캐싱하여 불필요한 재계산 방지 |
| 반환값 | 계산된 **값** |
| 사용 기준 | 실제로 느린 연산, 또는 참조 안정성이 필요할 때 |
| 남용 주의 | 가벼운 연산에 쓰면 오히려 오버헤드 발생 |

함수를 캐싱하고 싶다면 `useMemo` 대신 `useCallback`을 사용합니다.
