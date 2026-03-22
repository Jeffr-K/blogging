---
title: "[React 훅 시리즈] 2. useEffect: 렌더링 바깥의 세계와 연결하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "hooks", "useEffect", "side-effect", "lifecycle"]
---

# `useEffect`: 렌더링 바깥의 세계와 연결하기

React 컴포넌트의 역할은 UI를 그리는 것입니다. 그런데 실제 앱을 만들다 보면 렌더링 외에도 해야 할 일들이 생깁니다. API 데이터 가져오기, 이벤트 리스너 등록, 타이머 설정 등이 그 예입니다. 이런 "부수 효과(side effect)"를 처리하는 것이 `useEffect`의 역할입니다.

## 기본 사용법

```jsx
import { useEffect } from 'react';

function MyComponent() {
  useEffect(() => {
    // 렌더링 이후 실행되는 코드
    console.log('렌더링 완료!');
  });

  return <div>안녕하세요</div>;
}
```

`useEffect`에 전달하는 함수는 **렌더링이 완료된 후** 실행됩니다. 화면이 먼저 그려지고, 그 다음에 이 함수가 실행됩니다.

## 의존성 배열 (Dependency Array)

`useEffect`의 두 번째 인자로 배열을 넘기면, **그 값들이 바뀔 때만** 효과가 다시 실행됩니다.

### 경우 1: 두 번째 인자 없음 → 매 렌더링마다 실행

```jsx
useEffect(() => {
  console.log('매 렌더링마다 실행');
});
```

### 경우 2: 빈 배열 `[]` → 마운트 시 단 한 번만 실행

```jsx
useEffect(() => {
  console.log('컴포넌트가 처음 나타날 때 한 번만 실행');
}, []);
```

API를 한 번 호출하거나 이벤트 리스너를 한 번 등록할 때 자주 사용합니다.

### 경우 3: 특정 값 → 그 값이 바뀔 때만 실행

```jsx
useEffect(() => {
  console.log(`userId가 ${userId}로 바뀌었을 때 실행`);
}, [userId]);
```

## 클린업 (Cleanup)

`useEffect` 함수가 **함수를 반환하면**, 그 함수는 효과가 정리될 때 실행됩니다.

- 컴포넌트가 화면에서 사라질 때 (언마운트)
- 다음 효과가 실행되기 전

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    console.log('1초마다 실행');
  }, 1000);

  // 클린업 함수: 타이머를 정리합니다
  return () => {
    clearInterval(timer);
  };
}, []);
```

클린업을 빠뜨리면 컴포넌트가 사라져도 타이머나 이벤트 리스너가 계속 남아 **메모리 누수(memory leak)**가 발생합니다.

```jsx
useEffect(() => {
  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize); // 반드시 정리
  };
}, []);
```

## 실전 예제: 데이터 가져오기

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => setUser(data));
  }, [userId]); // userId가 바뀔 때마다 새로 가져옴

  if (!user) return <div>로딩 중...</div>;
  return <div>{user.name}</div>;
}
```

## 무한 루프 주의

의존성 배열을 잘못 관리하면 무한 루프가 발생합니다.

```jsx
// 위험: count를 의존성에 포함시켰는데, 안에서 count를 바꿈
useEffect(() => {
  setCount(count + 1); // count 변경 → 렌더링 → effect 재실행 → 무한 반복!
}, [count]);

// 해결: 함수형 업데이트 사용
useEffect(() => {
  setCount(prev => prev + 1);
}, []); // count에 의존하지 않아도 됨
```

또한 객체나 함수를 의존성에 넣을 때도 주의가 필요합니다. 매 렌더링마다 새로 생성되므로 "바뀐 것"으로 인식됩니다.

```jsx
// 위험: options 객체가 매 렌더링마다 새로 생성됨
const options = { page: 1 };
useEffect(() => {
  fetchData(options);
}, [options]); // 매 렌더링마다 실행됨!
```

## 정리

| 의존성 배열 | 실행 시점 |
|------------|----------|
| 없음 | 매 렌더링 후 |
| `[]` | 마운트 시 한 번 |
| `[a, b]` | `a` 또는 `b`가 바뀔 때 |

`useEffect`는 React 세계와 외부 세계(API, DOM, 타이머 등)를 연결하는 다리입니다. 클린업을 통해 연결을 제대로 끊는 것이 안정적인 앱을 만드는 핵심입니다.
