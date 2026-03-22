---
title: "[React 성능 최적화] 5. Context 리렌더링 문제와 해결법"
author: oscar.rs
date: 2026-03-22
tags: ["react", "optimization", "context", "리렌더링", "메모이제이션"]
---

# Context 리렌더링 문제와 해결법

Context는 편리하지만 잘못 쓰면 성능 문제의 원인이 됩니다. Context 값이 바뀌면 **그 Context를 구독하는 모든 컴포넌트가 리렌더링**되기 때문입니다.

## 문제: 하나의 값이 바뀌어도 전부 리렌더링

```jsx
const AppContext = createContext();

function App() {
  const [user, setUser] = useState({ name: '홍길동' });
  const [theme, setTheme] = useState('light');
  const [count, setCount] = useState(0);

  return (
    <AppContext.Provider value={{ user, theme, count, setCount }}>
      <Header />   {/* user만 씀 */}
      <Sidebar />  {/* theme만 씀 */}
      <Counter />  {/* count만 씀 */}
    </AppContext.Provider>
  );
}
```

`count`가 1씩 증가할 때마다 `Header`와 `Sidebar`도 리렌더링됩니다. `count`를 전혀 쓰지 않는데도요.

## 해결 1: Context 분리

관련 없는 값들을 별도 Context로 나눕니다.

```jsx
const UserContext = createContext();
const ThemeContext = createContext();
const CountContext = createContext();

function App() {
  const [user, setUser] = useState({ name: '홍길동' });
  const [theme, setTheme] = useState('light');
  const [count, setCount] = useState(0);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <CountContext.Provider value={{ count, setCount }}>
          <Header />   {/* UserContext만 구독 → count 변경에 리렌더링 안 됨 */}
          <Sidebar />  {/* ThemeContext만 구독 */}
          <Counter />  {/* CountContext만 구독 */}
        </CountContext.Provider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

이제 `count`가 바뀌어도 `CountContext`를 구독하는 `Counter`만 리렌더링됩니다.

## 해결 2: value 메모이제이션

Context value로 객체를 넘길 때, 매 렌더링마다 새 객체가 생성됩니다. `useMemo`로 안정화합니다.

```jsx
function UserProvider({ children }) {
  const [user, setUser] = useState(null);

  // 매 렌더링마다 새 객체 생성 → 모든 소비자 리렌더링
  // const value = { user, setUser }; // 나쁜 예

  // user가 바뀔 때만 새 객체 생성
  const value = useMemo(() => ({ user, setUser }), [user]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}
```

`setUser`는 `useState`가 보장하는 안정적인 참조이므로 의존성에 넣을 필요 없습니다.

## 해결 3: 상태와 dispatch 분리

`useReducer`를 쓸 때 state와 dispatch를 별도 Context로 분리합니다. `dispatch`는 항상 같은 참조이므로, dispatch만 쓰는 컴포넌트는 state 변경에 리렌더링되지 않습니다.

```jsx
const StateContext = createContext();
const DispatchContext = createContext();

function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <DispatchContext.Provider value={dispatch}>  {/* dispatch는 항상 같은 참조 */}
      <StateContext.Provider value={state}>
        {children}
      </StateContext.Provider>
    </DispatchContext.Provider>
  );
}

// state가 바뀌어도 dispatch만 쓰는 컴포넌트는 리렌더링 안 됨
function ActionButton() {
  const dispatch = useContext(DispatchContext);
  return <button onClick={() => dispatch({ type: 'INCREMENT' })}>+</button>;
}

// state가 바뀌면 리렌더링
function Counter() {
  const { count } = useContext(StateContext);
  return <div>{count}</div>;
}
```

## 해결 4: 소비자 컴포넌트에 memo 적용

Context를 사용하는 컴포넌트를 `memo`로 감싸면 **Context 값 자체가 바뀔 때만** 리렌더링됩니다. 부모의 다른 이유로 인한 리렌더링은 막을 수 있습니다.

```jsx
const ThemeToggle = memo(function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      현재 테마: {theme}
    </button>
  );
});
```

하지만 Context 값 자체가 바뀌면 `memo`와 무관하게 리렌더링됩니다.

## 해결 5: Context 선택적 구독 (고급)

같은 Context에서 특정 값만 구독하고 싶다면, 커스텀 훅에서 `useMemo`로 필요한 것만 반환합니다.

```jsx
// Context 전체
const UserContext = createContext();

// 이름만 쓰는 컴포넌트용 훅
function useUserName() {
  const { user } = useContext(UserContext);
  return user?.name;
}

// 권한만 쓰는 컴포넌트용 훅
function useUserRole() {
  const { user } = useContext(UserContext);
  return user?.role;
}
```

단, 이 방법만으로는 리렌더링을 막을 수 없습니다. Context 값이 바뀌면 훅이 있는 컴포넌트는 여전히 리렌더링됩니다. 완전한 선택적 구독이 필요하다면 Zustand 같은 외부 상태 관리 라이브러리를 사용하는 것이 현실적입니다.

## 전략 선택 가이드

```
Context 리렌더링 문제가 있을 때

1. Context에 관련 없는 값들이 섞여 있나?
   → YES: Context 분리

2. Context value가 매번 새 객체로 생성되나?
   → YES: useMemo로 value 안정화

3. state 읽기와 쓰기를 구분할 수 있나?
   → YES: state/dispatch Context 분리

4. Context 자체를 분리하기 어렵고 값이 자주 바뀌나?
   → Zustand 같은 전용 상태 관리 라이브러리 고려
```

## 정리

| 해결 방법 | 효과 | 복잡도 |
|---------|------|-------|
| Context 분리 | 관련 없는 구독자 리렌더링 제거 | 낮음 |
| value 메모이제이션 | 불필요한 참조 변경 방지 | 낮음 |
| state/dispatch 분리 | dispatch만 쓰는 컴포넌트 최적화 | 중간 |
| 소비자에 memo | 부모 리렌더링 전파 차단 | 낮음 |

Context를 처음 설계할 때부터 **하나의 Context에 너무 많은 것을 넣지 않는 것**이 가장 좋은 예방책입니다.
