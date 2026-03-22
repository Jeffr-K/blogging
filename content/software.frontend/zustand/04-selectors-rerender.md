---
title: "[Zustand 시리즈] 4. 셀렉터와 리렌더링 최적화"
author: oscar.rs
date: 2026-03-22
tags: ["react", "zustand", "selector", "리렌더링", "성능최적화"]
---

# 셀렉터와 리렌더링 최적화

Zustand는 셀렉터(selector)로 **필요한 상태만 구독**할 수 있습니다. 구독한 값이 바뀔 때만 리렌더링되므로, 셀렉터를 잘 활용하면 불필요한 리렌더링을 줄일 수 있습니다.

## 셀렉터 기본

`useStore`에 함수를 넘기면 그 함수가 셀렉터입니다.

```jsx
const useStore = create(() => ({
  count: 0,
  user: { name: '홍길동', age: 30 },
  todos: [],
}));

// count만 구독 (user, todos가 바뀌어도 리렌더링 안 됨)
const count = useStore((state) => state.count);

// user.name만 구독
const name = useStore((state) => state.user.name);

// 파생 값도 셀렉터에서 계산 가능
const completedCount = useStore(
  (state) => state.todos.filter(t => t.completed).length
);
```

Zustand는 셀렉터가 반환한 값을 **이전 값과 비교**해서 달라졌을 때만 리렌더링합니다. 비교는 기본적으로 **얕은 비교(===)**입니다.

## 주의: 객체/배열을 반환하는 셀렉터

셀렉터가 **객체나 배열을 반환**하면 매 렌더링마다 새 참조가 생성되어, 값이 같아도 항상 리렌더링됩니다.

```jsx
// 문제: 매 렌더링마다 새 객체 반환 → 항상 리렌더링
const { count, name } = useStore((state) => ({
  count: state.count,
  name: state.user.name,
}));
```

### 해결 1: 따로따로 구독

```jsx
const count = useStore((state) => state.count);
const name = useStore((state) => state.user.name);
```

가장 간단한 방법입니다. 각자 독립적으로 구독합니다.

### 해결 2: useShallow로 얕은 비교

여러 값을 한 번에 가져오고 싶다면 `useShallow`를 사용합니다.

```jsx
import { useShallow } from 'zustand/react/shallow';

// 객체 형태로 여러 값 구독 (얕은 비교)
const { count, name } = useStore(
  useShallow((state) => ({
    count: state.count,
    name: state.user.name,
  }))
);

// 배열 형태로 여러 값 구독 (얕은 비교)
const [count, name] = useStore(
  useShallow((state) => [state.count, state.user.name])
);
```

`useShallow`는 반환된 객체/배열의 각 항목을 얕게 비교합니다. 값이 실제로 바뀌었을 때만 리렌더링됩니다.

## 파생 상태(Derived State) 셀렉터

셀렉터에서 계산을 수행하면 컴포넌트 코드가 깔끔해집니다.

```jsx
const useCartStore = create(() => ({
  items: [],
}));

function CartSummary() {
  // 셀렉터에서 계산
  const totalCount = useCartStore(
    (state) => state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  const totalPrice = useCartStore(
    (state) => state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  return (
    <div>
      <p>상품 수: {totalCount}개</p>
      <p>총액: {totalPrice.toLocaleString()}원</p>
    </div>
  );
}
```

**주의**: 셀렉터 안의 계산은 렌더링마다 다시 실행됩니다. 계산 비용이 크다면 `useMemo`와 함께 쓰거나, 스토어 안에서 파생 값을 관리하세요.

## 셀렉터 함수를 컴포넌트 밖에 정의하기

셀렉터 함수를 컴포넌트 밖에 정의하면 재사용성이 높아지고 테스트하기 쉬워집니다.

```jsx
// 셀렉터를 스토어 파일에 함께 정의 (권장)
export const useCartStore = create(() => ({ items: [] }));

export const selectTotalCount = (state) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectTotalPrice = (state) =>
  state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export const selectItemById = (id) => (state) =>
  state.items.find(item => item.id === id);

// 사용
function CartSummary() {
  const totalCount = useCartStore(selectTotalCount);
  const totalPrice = useCartStore(selectTotalPrice);
}

function CartItem({ id }) {
  const item = useCartStore(selectItemById(id));
}
```

셀렉터를 밖에 정의하면 동일한 함수 참조를 사용하므로 추가 최적화 효과도 있습니다.

## subscribe: 리렌더링 없이 구독

React 리렌더링을 유발하지 않고 상태 변경에 반응해야 할 때는 `subscribe`를 사용합니다.

```jsx
useEffect(() => {
  // count가 바뀔 때마다 실행 (리렌더링 없음)
  const unsubscribe = useStore.subscribe(
    (state) => state.count,    // 무엇을 감시할지
    (count, prevCount) => {    // 변경됐을 때 실행
      console.log(`count: ${prevCount} → ${count}`);
      analytics.track('count_changed', { count });
    }
  );

  return unsubscribe; // cleanup
}, []);
```

분석 이벤트, 로컬스토리지 동기화 같은 사이드 이펙트에 적합합니다.

## 정리

| 상황 | 방법 |
|------|------|
| 단일 값 구독 | `useStore((s) => s.value)` |
| 여러 값 구독 | 각각 따로 구독 또는 `useShallow` |
| 파생 값 | 셀렉터에서 계산 |
| 셀렉터 재사용 | 컴포넌트 밖에서 함수로 정의 |
| 리렌더링 없이 구독 | `store.subscribe()` |

셀렉터를 잘 쓰는 것이 Zustand 성능 최적화의 핵심입니다. 특히 큰 스토어에서 필요한 것만 정확히 구독하면 불필요한 리렌더링을 크게 줄일 수 있습니다.
