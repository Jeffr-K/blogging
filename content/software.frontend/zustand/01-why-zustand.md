---
title: "[Zustand 시리즈] 1. 왜 Zustand 인가: 간결한 전역 상태 관리"
author: oscar.rs
date: 2026-03-22
tags: ["react", "zustand", "상태관리", "전역상태"]
---

# 왜 Zustand인가: 간결한 전역 상태 관리

React 앱이 커지면 상태를 여러 컴포넌트에서 공유해야 합니다. `useState`는 한 컴포넌트 안에서만 쓸 수 있고, Context는 성능 문제가 생기며, Redux는 보일러플레이트가 너무 많습니다. Zustand는 이 고민을 간단하게 해결합니다.

## 기존 방법들의 문제

### Context의 한계

```jsx
// Context는 값이 바뀌면 구독하는 모든 컴포넌트가 리렌더링됨
const CountContext = createContext();

function App() {
  const [count, setCount] = useState(0);
  const [user, setUser] = useState(null);

  // count가 바뀌면 user만 쓰는 컴포넌트도 리렌더링됨
  return (
    <CountContext.Provider value={{ count, setCount, user, setUser }}>
      ...
    </CountContext.Provider>
  );
}
```

Context를 분리하면 해결되지만, 상태가 많아질수록 Provider 중첩이 깊어집니다.

### Redux의 보일러플레이트

카운터 하나를 만들기 위해 action type, action creator, reducer, selector를 모두 작성해야 합니다. 간단한 상태 하나에도 수십 줄이 필요합니다.

## Zustand로 같은 것을 만들면

```jsx
import { create } from 'zustand';

const useCountStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));

// 컴포넌트에서 사용
function Counter() {
  const count = useCountStore((state) => state.count);
  const increment = useCountStore((state) => state.increment);

  return <button onClick={increment}>{count}</button>;
}
```

끝입니다. 파일 하나, 보일러플레이트 없음, Provider도 필요 없습니다.

## Zustand의 특징

### Provider 불필요

Redux나 Context와 달리 Provider로 앱을 감쌀 필요가 없습니다. 스토어는 컴포넌트 트리 외부에 존재하며, 어디서든 import해서 사용합니다.

```jsx
// Redux/Context
<Provider store={store}>
  <App />
</Provider>

// Zustand: 그냥 씁니다
function App() {
  return <Counter />;
}
```

### 셀렉터로 리렌더링 최적화

컴포넌트는 자신이 구독하는 값이 바뀔 때만 리렌더링됩니다.

```jsx
const useStore = create(() => ({
  count: 0,
  user: { name: '홍길동' },
}));

function Counter() {
  // count만 구독 → user가 바뀌어도 리렌더링 안 됨
  const count = useStore((state) => state.count);
  return <div>{count}</div>;
}

function UserName() {
  // user.name만 구독 → count가 바뀌어도 리렌더링 안 됨
  const name = useStore((state) => state.user.name);
  return <div>{name}</div>;
}
```

Context와 달리 자동으로 최적화됩니다.

### React 외부에서도 접근 가능

```jsx
// 컴포넌트 밖에서도 스토어 접근 가능
const { count, increment } = useCountStore.getState();
increment();

// 스토어 변경 구독
useCountStore.subscribe((state) => {
  console.log('count 변경:', state.count);
});
```

API 인터셉터, 라우터 가드 등 React 컴포넌트 외부에서도 상태를 읽고 쓸 수 있습니다.

## 언제 Zustand를 쓰면 좋을까?

| 상황 | 권장 도구 |
|------|---------|
| 컴포넌트 안에서만 쓰는 상태 | `useState` |
| 몇 단계 아래까지만 전달 | props |
| 자주 바뀌지 않는 전역 설정 (테마, 언어) | `Context` |
| 전역 클라이언트 상태 (장바구니, 모달, 인증) | **Zustand** |
| 서버에서 가져오는 데이터 | **React Query** |

Zustand는 **클라이언트 상태** 관리에 적합합니다. 서버 데이터(API 응답)는 React Query가 더 잘 처리합니다. 둘을 함께 사용하는 것이 현대 React 앱의 일반적인 패턴입니다.

## 설치

```bash
npm install zustand
```

별도 설정 없이 바로 사용할 수 있습니다.

## 정리

Zustand가 선택받는 이유:
- **작은 번들 크기** (~1KB)
- **Provider 불필요**
- **최소한의 보일러플레이트**
- **자동 리렌더링 최적화**
- **TypeScript 친화적**
- **React 외부 접근 가능**

단순하지만 강력합니다. 다음 아티클에서 스토어를 만들고 사용하는 방법을 자세히 살펴봅니다.
