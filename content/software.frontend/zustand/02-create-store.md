---
title: "[Zustand 시리즈] 2. 스토어 만들기: create와 set, get"
author: oscar.rs
date: 2026-03-22
tags: ["react", "zustand", "create", "store", "set", "get"]
---

# 스토어 만들기: create와 set, get

Zustand 스토어는 `create` 함수 하나로 만듭니다. 상태(state)와 그것을 바꾸는 함수(action)를 한 곳에 정의합니다.

## 기본 구조

```jsx
import { create } from 'zustand';

const useStore = create((set, get) => ({
  // 상태
  count: 0,
  name: '홍길동',

  // 액션 (상태를 바꾸는 함수)
  increment: () => set((state) => ({ count: state.count + 1 })),
  setName: (name) => set({ name }),
}));
```

`create`는 **커스텀 훅**을 반환합니다. 이 훅을 컴포넌트에서 호출해 상태와 액션을 가져옵니다.

## set: 상태 업데이트

`set`은 스토어 상태를 업데이트하는 함수입니다. **현재 상태와 병합**됩니다. (Object.assign처럼 동작)

```jsx
const useStore = create((set) => ({
  count: 0,
  name: '홍길동',

  // 방식 1: 새 값 직접 전달
  setName: (name) => set({ name }), // count는 그대로 유지됨

  // 방식 2: 함수로 이전 상태 참조
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

이전 상태를 기반으로 업데이트할 때는 함수 형태를 씁니다. `useState`의 함수형 업데이트와 같은 이유입니다.

### replace 옵션

기본 동작은 병합이지만, `replace: true`를 주면 상태 전체를 교체합니다.

```jsx
// 기본: 병합 (count는 유지)
set({ name: '이순신' }); // { count: 0, name: '이순신' }

// replace: 전체 교체
set({ name: '이순신' }, true); // { name: '이순신' } (count 사라짐!)
```

## get: 다른 상태 참조

액션 안에서 현재 상태를 읽어야 할 때 `get`을 사용합니다.

```jsx
const useStore = create((set, get) => ({
  items: [],
  selectedId: null,

  // get으로 현재 상태 참조
  getSelectedItem: () => {
    const { items, selectedId } = get();
    return items.find(item => item.id === selectedId);
  },

  // 조건부 업데이트
  toggleItem: (id) => {
    const { selectedId } = get();
    set({ selectedId: selectedId === id ? null : id });
  },
}));
```

`set`의 함수 형태로도 상태를 참조할 수 있지만, `get`은 액션 함수 어디서든 현재 상태를 읽을 수 있어 더 유연합니다.

## 컴포넌트에서 사용

```jsx
function Counter() {
  // 필요한 상태/액션만 셀렉터로 가져오기
  const count = useStore((state) => state.count);
  const increment = useStore((state) => state.increment);

  return (
    <div>
      <p>{count}</p>
      <button onClick={increment}>+1</button>
    </div>
  );
}
```

셀렉터 없이 전체를 가져올 수도 있습니다. 하지만 권장하지 않습니다.

```jsx
// 비권장: 스토어 전체를 구독 → 어떤 상태가 바뀌어도 리렌더링
const { count, increment } = useStore();

// 권장: 필요한 것만 구독
const count = useStore((state) => state.count);
```

## 실전 예제: 장바구니 스토어

```jsx
const useCartStore = create((set, get) => ({
  items: [],

  addItem: (product) => {
    const { items } = get();
    const existing = items.find(item => item.id === product.id);

    if (existing) {
      // 이미 있으면 수량 증가
      set({
        items: items.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ),
      });
    } else {
      // 없으면 추가
      set({ items: [...items, { ...product, quantity: 1 }] });
    }
  },

  removeItem: (id) => set((state) => ({
    items: state.items.filter(item => item.id !== id),
  })),

  clearCart: () => set({ items: [] }),

  getTotalPrice: () => {
    const { items } = get();
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  },
}));

// 사용
function CartButton({ product }) {
  const addItem = useCartStore((state) => state.addItem);
  return <button onClick={() => addItem(product)}>장바구니 추가</button>;
}

function CartTotal() {
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);
  return <div>총액: {getTotalPrice().toLocaleString()}원</div>;
}
```

## 컴포넌트 외부에서 접근

```jsx
// 스토어 인스턴스로 직접 접근
const state = useCartStore.getState();
state.addItem(product);

// 상태 변경 구독 (React 외부에서)
const unsubscribe = useCartStore.subscribe((state) => {
  localStorage.setItem('cart', JSON.stringify(state.items));
});

// 구독 해제
unsubscribe();
```

## 정리

| 항목 | 설명 |
|------|------|
| `create(fn)` | 스토어 생성, 커스텀 훅 반환 |
| `set({ ... })` | 상태 부분 업데이트 (병합) |
| `set(fn)` | 이전 상태 기반 업데이트 |
| `get()` | 현재 상태 읽기 (액션 안에서) |
| `useStore(selector)` | 컴포넌트에서 필요한 것만 구독 |
| `useStore.getState()` | 컴포넌트 외부에서 상태 접근 |
