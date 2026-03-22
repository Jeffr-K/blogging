---
title: "[React 훅 시리즈] 7. useReducer: 복잡한 상태를 체계적으로 관리하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "hooks", "useReducer", "상태관리", "reducer"]
---

# `useReducer`: 복잡한 상태를 체계적으로 관리하기

`useState`가 단순한 값 하나를 관리하는 도구라면, `useReducer`는 **여러 상태가 서로 연관되어 있거나, 업데이트 로직이 복잡할 때** 더 구조적으로 관리할 수 있게 해줍니다. Redux를 써본 적 있다면 같은 패턴입니다.

## 기본 개념: Action과 Dispatch

`useReducer`의 핵심 개념은 세 가지입니다.

- **state**: 현재 상태
- **action**: "무슨 일이 일어났는지"를 설명하는 객체 (예: `{ type: 'increment' }`)
- **reducer**: `(state, action) => newState` 형태의 순수 함수. 현재 상태와 액션을 받아 새 상태를 반환합니다.
- **dispatch**: 액션을 발생시키는 함수

```jsx
import { useReducer } from 'react';

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    case 'reset':
      return { count: 0 };
    default:
      return state;
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });

  return (
    <div>
      <p>카운트: {state.count}</p>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
      <button onClick={() => dispatch({ type: 'reset' })}>초기화</button>
    </div>
  );
}
```

상태를 바꾸고 싶을 때 직접 값을 쓰는 게 아니라, `dispatch`로 "어떤 일이 일어났는지"를 알리는 것이 핵심입니다.

## 실전 예제: 쇼핑 카트

여러 연관된 상태가 있을 때 `useReducer`가 빛을 발합니다.

```jsx
const initialState = {
  items: [],
  total: 0,
  isLoading: false,
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const newItems = [...state.items, action.item];
      return {
        ...state,
        items: newItems,
        total: newItems.reduce((sum, item) => sum + item.price, 0),
      };
    }
    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(item => item.id !== action.id);
      return {
        ...state,
        items: newItems,
        total: newItems.reduce((sum, item) => sum + item.price, 0),
      };
    }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

function Cart() {
  const [cart, dispatch] = useReducer(cartReducer, initialState);

  function addItem(item) {
    dispatch({ type: 'ADD_ITEM', item });
  }

  function removeItem(id) {
    dispatch({ type: 'REMOVE_ITEM', id });
  }

  return (
    <div>
      <p>총액: {cart.total}원</p>
      {cart.items.map(item => (
        <div key={item.id}>
          {item.name}
          <button onClick={() => removeItem(item.id)}>제거</button>
        </div>
      ))}
    </div>
  );
}
```

`items`, `total`이 항상 함께 업데이트되어야 하는데, reducer 안에서 일관되게 처리할 수 있습니다.

## useState vs useReducer 선택 기준

| 상황 | 추천 |
|------|------|
| 독립적인 값 하나 | `useState` |
| 서로 관련된 여러 상태 | `useReducer` |
| 단순한 `true/false`, 숫자 | `useState` |
| "어떤 일이 일어났는지" 기반으로 상태 변경 | `useReducer` |
| 업데이트 로직을 컴포넌트 밖으로 분리하고 싶을 때 | `useReducer` |

```jsx
// useState가 적합한 경우
const [isOpen, setIsOpen] = useState(false);
const [name, setName] = useState('');

// useReducer가 적합한 경우 (여러 상태가 함께 변경됨)
const [formState, dispatch] = useReducer(formReducer, {
  name: '',
  email: '',
  isSubmitting: false,
  error: null,
});
```

## reducer 함수의 규칙

reducer는 **순수 함수**여야 합니다.
- 같은 입력에는 항상 같은 출력
- 직접적인 사이드 이펙트 없음 (API 호출, 타이머 등)
- state를 직접 수정하지 않고 새 객체 반환

```jsx
// 잘못된 reducer: state를 직접 수정
function reducer(state, action) {
  state.count += 1; // 직접 수정 금지!
  return state;
}

// 올바른 reducer: 새 객체 반환
function reducer(state, action) {
  return { ...state, count: state.count + 1 };
}
```

## 정리

- `useReducer(reducer, 초기상태)`는 `[state, dispatch]`를 반환합니다
- 상태 변경은 `dispatch({ type: '...' })`로 요청합니다
- 실제 변경 로직은 reducer 함수 안에 있습니다
- 복잡하게 연관된 상태를 관리할 때 `useState`보다 더 명확하고 예측 가능합니다
