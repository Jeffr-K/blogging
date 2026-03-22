---
title: "[React 훅 시리즈] 1. useState: 컴포넌트에 기억을 심다"
author: oscar.rs
date: 2026-03-22
tags: ["react", "hooks", "useState", "state", "상태관리"]
---

# `useState`: 컴포넌트에 기억을 심다

React 컴포넌트는 기본적으로 **함수**입니다. 함수는 호출될 때마다 처음부터 실행되기 때문에, 일반 변수는 렌더링이 반복되어도 값이 유지되지 않습니다. `useState`는 이 문제를 해결합니다. React가 관리하는 특별한 저장공간에 값을 보관하여, 렌더링이 새로 일어나도 값이 유지되게 해줍니다.

## 기본 사용법

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0); // 초기값 0

  return (
    <button onClick={() => setCount(count + 1)}>
      클릭 수: {count}
    </button>
  );
}
```

`useState`는 배열을 반환하며, 구조 분해 할당으로 두 가지를 꺼냅니다.
- **첫 번째 요소** (`count`): 현재 상태 값
- **두 번째 요소** (`setCount`): 상태를 업데이트하는 함수

`setCount`를 호출하면 React는 해당 컴포넌트를 **다시 렌더링**합니다.

## 초기값 설정

초기값은 컴포넌트가 처음 렌더링될 때 한 번만 사용됩니다.

```jsx
const [name, setName] = useState('홍길동');
const [isOpen, setIsOpen] = useState(false);
const [items, setItems] = useState([]);
```

초기값 계산 비용이 크다면, **함수 형태**로 넘길 수 있습니다. 이렇게 하면 첫 렌더링 시에만 함수가 실행됩니다.

```jsx
// 매 렌더링마다 실행됨 (비효율적)
const [data, setData] = useState(heavyComputation());

// 첫 렌더링 시에만 실행됨 (효율적)
const [data, setData] = useState(() => heavyComputation());
```

## 함수형 업데이트

상태를 업데이트할 때, 이전 값에 기반해야 한다면 **함수형 업데이트**를 사용해야 합니다.

```jsx
// 잠재적으로 위험한 방식
setCount(count + 1);

// 안전한 방식: 이전 값을 받아서 계산
setCount(prev => prev + 1);
```

왜 차이가 생길까요? React는 성능을 위해 여러 상태 업데이트를 묶어서 처리(배칭)할 수 있습니다. 이 경우 `count`가 최신 값이 아닐 수 있기 때문에, `prev => prev + 1` 형태가 항상 올바른 이전 값을 보장합니다.

```jsx
// 문제 상황: 두 번 클릭해도 1만 증가할 수 있음
function handleClick() {
  setCount(count + 1);
  setCount(count + 1);
}

// 올바른 방식: 두 번 클릭하면 2 증가
function handleClick() {
  setCount(prev => prev + 1);
  setCount(prev => prev + 1);
}
```

## 객체 상태와 불변성

상태로 객체를 사용할 때는 **직접 수정하지 않고, 새 객체를 만들어서** 전달해야 합니다.

```jsx
const [user, setUser] = useState({ name: '홍길동', age: 30 });

// 잘못된 방식: 직접 수정 (React가 변경을 감지하지 못함)
user.age = 31;
setUser(user);

// 올바른 방식: 새 객체 생성
setUser({ ...user, age: 31 });
```

React는 **참조 값을 비교**해서 상태가 변했는지 판단합니다. 같은 객체를 그대로 넘기면 "변화 없음"으로 인식해 리렌더링이 발생하지 않습니다.

배열도 마찬가지입니다.

```jsx
const [items, setItems] = useState(['사과', '바나나']);

// 잘못된 방식
items.push('딸기');
setItems(items);

// 올바른 방식
setItems([...items, '딸기']);
// 또는
setItems(prev => [...prev, '딸기']);
```

## 정리

| 개념 | 설명 |
|------|------|
| `useState(초기값)` | 상태 변수와 업데이트 함수 반환 |
| 함수형 업데이트 | `prev => ...` 형태로 안전하게 이전 값 참조 |
| 불변성 | 객체/배열은 직접 수정하지 않고 새로 만들어서 전달 |
| 초기값 지연 | `() => 계산()` 형태로 첫 렌더링 시에만 실행 |

`useState`는 React 훅 중 가장 기본이 되는 훅입니다. 단순한 값 하나를 관리할 때는 충분하지만, 상태가 복잡해지고 여러 값이 연동된다면 `useReducer`를 고려해볼 수 있습니다.
