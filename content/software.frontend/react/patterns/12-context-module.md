---
title: "[React 패턴 시리즈] 12. Context Module 패턴: Context를 안전하고 편리하게 사용하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "context", "useReducer", "모듈패턴"]
---

# Context Module 패턴: Context를 안전하고 편리하게 사용하기

`useContext`를 사용할 때 흔히 볼 수 있는 문제들이 있습니다. Context를 잘못된 위치에서 사용하거나, 같은 dispatch 로직을 여러 곳에서 중복 작성하는 것입니다. **Context Module 패턴**은 Context와 관련된 모든 것을 하나의 모듈에 캡슐화해서 이 문제를 해결합니다.

## 기존 방식의 문제

```jsx
// 여러 컴포넌트에서 같은 dispatch 로직이 중복됨
function ComponentA() {
  const dispatch = useContext(UserDispatchContext);

  function handleUpdate(data) {
    dispatch({ type: 'UPDATE_USER', payload: data }); // 중복
    dispatch({ type: 'SET_LOADING', payload: false }); // 중복
  }
}

function ComponentB() {
  const dispatch = useContext(UserDispatchContext);

  function handleUpdate(data) {
    dispatch({ type: 'UPDATE_USER', payload: data }); // 중복
    dispatch({ type: 'SET_LOADING', payload: false }); // 중복
  }
}
```

dispatch 타입 문자열을 직접 사용하면 오타가 나도 컴파일 에러가 없고, 로직이 변경될 때 모든 곳을 수정해야 합니다.

## Context Module 패턴

Context, reducer, Provider, 커스텀 훅, 헬퍼 함수를 **하나의 파일**에 모읍니다.

```jsx
// UserContext.js
import { createContext, useContext, useReducer } from 'react';

// 1. Context 생성
const UserStateContext = createContext(null);
const UserDispatchContext = createContext(null);

// 2. Reducer
function userReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'UPDATE_USER':
      return { ...state, user: action.payload, isLoading: false };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    default:
      throw new Error(`알 수 없는 액션: ${action.type}`);
  }
}

// 3. Provider
function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, {
    user: null,
    isLoading: false,
    error: null,
  });

  return (
    <UserStateContext.Provider value={state}>
      <UserDispatchContext.Provider value={dispatch}>
        {children}
      </UserDispatchContext.Provider>
    </UserStateContext.Provider>
  );
}

// 4. 커스텀 훅 (안전한 접근 + 편의 제공)
function useUserState() {
  const context = useContext(UserStateContext);
  if (!context) {
    throw new Error('useUserState는 UserProvider 안에서 사용해야 합니다.');
  }
  return context;
}

function useUserDispatch() {
  const context = useContext(UserDispatchContext);
  if (!context) {
    throw new Error('useUserDispatch는 UserProvider 안에서 사용해야 합니다.');
  }
  return context;
}

// 5. 헬퍼 함수: dispatch 로직을 한 곳에서 관리
async function updateUser(dispatch, userData) {
  dispatch({ type: 'SET_LOADING', payload: true });
  try {
    const updated = await api.updateUser(userData);
    dispatch({ type: 'UPDATE_USER', payload: updated });
  } catch (error) {
    dispatch({ type: 'SET_ERROR', payload: error.message });
  }
}

// 외부로 내보내기
export { UserProvider, useUserState, useUserDispatch, updateUser };
```

```jsx
// 사용하는 컴포넌트
import { useUserState, useUserDispatch, updateUser } from './UserContext';

function UserProfile() {
  const { user, isLoading } = useUserState();
  const dispatch = useUserDispatch();

  async function handleSave(data) {
    await updateUser(dispatch, data); // 중복 없이 헬퍼 함수 호출
  }

  if (isLoading) return <div>저장 중...</div>;
  return (
    <div>
      <p>{user?.name}</p>
      <button onClick={() => handleSave({ name: '홍길동' })}>저장</button>
    </div>
  );
}
```

## 상태와 dispatch 분리의 이유

State와 dispatch를 별도 Context로 분리하면, dispatch만 사용하는 컴포넌트가 state 변경 시 불필요하게 리렌더링되지 않습니다.

```jsx
// dispatch만 쓰는 버튼 컴포넌트
function SaveButton() {
  const dispatch = useUserDispatch(); // state Context를 구독하지 않음
  // state가 바뀌어도 이 컴포넌트는 리렌더링 안 됨
  return (
    <button onClick={() => updateUser(dispatch, data)}>저장</button>
  );
}
```

## Provider 조합 패턴

앱에 Context가 여럿이라면 Provider를 조합하는 컴포넌트를 만들어 관리합니다.

```jsx
function AppProviders({ children }) {
  return (
    <AuthProvider>
      <UserProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </UserProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <AppProviders>
      <Router />
    </AppProviders>
  );
}
```

## 정리

Context Module 패턴이 제공하는 것:

| 항목 | 방법 |
|------|------|
| 안전한 접근 | Provider 외부 사용 시 명확한 에러 메시지 |
| 중복 제거 | dispatch 로직을 헬퍼 함수로 모듈화 |
| 리렌더링 최적화 | state와 dispatch를 별도 Context로 분리 |
| 캡슐화 | Context 관련 코드를 한 파일에 집중 |

규모가 있는 앱에서 Context를 사용할 때 가장 유지보수하기 좋은 구조입니다.
