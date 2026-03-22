---
title: "[React 훅 시리즈] 6. useContext: prop drilling 없이 데이터 공유하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "hooks", "useContext", "context", "전역상태"]
---

# `useContext`: prop drilling 없이 데이터 공유하기

React에서 데이터는 기본적으로 부모에서 자식으로 props를 통해 전달됩니다. 그런데 컴포넌트 트리가 깊어지면, 중간 컴포넌트들이 단순히 데이터를 아래로 전달하기 위해 필요도 없는 props를 받아야 하는 상황이 생깁니다. 이를 **prop drilling** 문제라고 합니다.

`useContext`는 이 문제를 해결합니다. 트리 어느 깊이에서든 데이터에 직접 접근할 수 있게 해줍니다.

## Context 만들고 사용하기

총 3단계로 이루어집니다.

### 1단계: Context 생성

```jsx
import { createContext } from 'react';

const ThemeContext = createContext('light'); // 기본값 설정
```

### 2단계: Provider로 값 공급

```jsx
function App() {
  const [theme, setTheme] = useState('dark');

  return (
    <ThemeContext.Provider value={theme}>
      <Header />
      <Main />
      <Footer />
    </ThemeContext.Provider>
  );
}
```

`Provider`로 감싼 모든 자식 컴포넌트는 `theme` 값에 접근할 수 있습니다.

### 3단계: useContext로 값 소비

```jsx
import { useContext } from 'react';

function Button() {
  const theme = useContext(ThemeContext); // 어느 깊이에서든 직접 접근

  return (
    <button className={theme === 'dark' ? 'btn-dark' : 'btn-light'}>
      클릭
    </button>
  );
}
```

`Button`이 트리 몇 단계 아래에 있든, `Provider` 안에만 있으면 바로 `theme`을 가져올 수 있습니다.

## 실전 예제: 인증 정보 공유

```jsx
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (userData) => setUser(userData);
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 어느 컴포넌트에서든 사용
function ProfileMenu() {
  const { user, logout } = useContext(AuthContext);

  if (!user) return null;
  return (
    <div>
      <span>{user.name}</span>
      <button onClick={logout}>로그아웃</button>
    </div>
  );
}
```

## 리렌더링 주의사항

Context 값이 변경되면 **해당 Context를 구독하는 모든 컴포넌트**가 리렌더링됩니다. Context에 너무 많은 데이터를 넣거나, 자주 바뀌는 값을 넣으면 불필요한 리렌더링이 많이 발생합니다.

```jsx
// 문제: count가 바뀔 때마다 theme을 쓰는 컴포넌트도 리렌더링됨
const AppContext = createContext();
function App() {
  const [theme, setTheme] = useState('dark');
  const [count, setCount] = useState(0);

  return (
    <AppContext.Provider value={{ theme, count }}>
      ...
    </AppContext.Provider>
  );
}
```

**해결책: Context를 목적별로 분리합니다.**

```jsx
const ThemeContext = createContext();
const CountContext = createContext();

function App() {
  const [theme, setTheme] = useState('dark');
  const [count, setCount] = useState(0);

  return (
    <ThemeContext.Provider value={theme}>
      <CountContext.Provider value={count}>
        ...
      </CountContext.Provider>
    </ThemeContext.Provider>
  );
}
```

이제 `count`가 바뀌어도 `ThemeContext`만 구독하는 컴포넌트는 리렌더링되지 않습니다.

## Context가 적합하지 않은 경우

Context는 전역 상태가 아닙니다. 자주 바뀌는 데이터(예: 폼 입력값)를 Context로 관리하면 성능 문제가 생깁니다. 그런 경우에는 Zustand, Jotai 같은 전용 상태 관리 라이브러리가 더 적합합니다.

Context가 잘 맞는 사례:
- 테마 (다크/라이트 모드)
- 로그인한 사용자 정보
- 언어/로케일 설정

## 정리

1. `createContext`로 Context 생성
2. `Provider`로 값을 공급할 범위 설정
3. `useContext`로 어느 깊이에서든 값 소비

자주 바뀌는 데이터에는 Context보다 목적에 맞는 상태 관리 도구를 사용하고, Context는 자주 바뀌지 않는 전역 설정에 활용하세요.
