---
title: "[React 성능 최적화] 1. 리렌더링 이해: 언제 컴포넌트가 다시 그려지는가"
author: oscar.rs
date: 2026-03-22
tags: ["react", "optimization", "리렌더링", "성능", "참조동일성"]
---

# 리렌더링 이해: 언제 컴포넌트가 다시 그려지는가

성능 최적화의 첫 번째 단계는 **왜 리렌더링이 발생하는지** 이해하는 것입니다. 원인을 모르면 최적화 도구를 올바르게 쓸 수 없습니다.

## 리렌더링이 발생하는 세 가지 조건

### 1. 자신의 state가 변경될 때

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  // setCount가 호출되면 Counter 리렌더링
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### 2. 부모 컴포넌트가 리렌더링될 때

```jsx
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <Child /> {/* Parent가 리렌더링되면 Child도 리렌더링 */}
    </div>
  );
}

function Child() {
  console.log('Child 리렌더링');
  return <div>자식</div>; // count와 관계없지만 리렌더링됨
}
```

이것이 성능 문제의 가장 흔한 원인입니다. 부모가 리렌더링되면 **props가 바뀌지 않아도** 모든 자식이 따라서 리렌더링됩니다.

### 3. 구독 중인 Context 값이 변경될 때

```jsx
const ThemeContext = createContext();

function Parent() {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={theme}>
      <Child />
    </ThemeContext.Provider>
  );
}

function Child() {
  const theme = useContext(ThemeContext); // theme이 바뀌면 리렌더링
  return <div className={theme}>내용</div>;
}
```

## 리렌더링은 나쁜 것이 아니다

중요한 사실: **리렌더링이 발생한다고 항상 DOM이 업데이트되는 것은 아닙니다.**

React는 리렌더링 결과(JSX)와 이전 결과를 비교해서, **실제로 바뀐 부분만** DOM에 반영합니다. 리렌더링 자체는 가상 DOM에서 일어나는 연산이고, 비용이 있지만 DOM 업데이트보다 훨씬 빠릅니다.

따라서 최적화는:
1. 리렌더링이 **실제로** 성능 문제를 일으킬 때 적용합니다
2. 리렌더링을 무조건 줄이는 것이 목표가 아닙니다
3. **측정 먼저, 최적화 나중**

## 참조 동일성 (Reference Equality)

JavaScript에서 기본 타입(숫자, 문자열, 불리언)은 값으로 비교하고, 객체와 함수는 **참조**로 비교합니다.

```js
// 기본 타입: 값 비교
1 === 1         // true
'hello' === 'hello' // true

// 객체/배열/함수: 참조 비교
{} === {}       // false (메모리 주소가 다름)
[] === []       // false
(() => {}) === (() => {}) // false
```

이 때문에 컴포넌트가 리렌더링될 때마다 객체와 함수는 "새로 만들어진" 것으로 인식됩니다.

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  // 매 렌더링마다 새 객체가 생성됨
  const style = { color: 'red' };

  // 매 렌더링마다 새 함수가 생성됨
  const handleClick = () => console.log('클릭');

  return <Child style={style} onClick={handleClick} />;
}
```

`style`과 `handleClick`의 내용은 같아도 매번 새 참조입니다. `Child`가 `React.memo`로 감싸져 있어도 props가 "바뀐 것"으로 인식해 리렌더링됩니다.

이것이 `useMemo`와 `useCallback`이 필요한 이유입니다.

## 리렌더링 확인하는 법

```jsx
// 간단한 방법: console.log 또는 ref로 횟수 세기
function MyComponent() {
  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log(`MyComponent 렌더링 횟수: ${renderCount.current}`);

  return <div>...</div>;
}
```

실제 측정은 React DevTools Profiler를 사용합니다. (09 아티클에서 자세히 다룹니다)

## 리렌더링 흐름 한눈에 보기

```
App (count 변경)
  └─▶ 리렌더링
      ├── Header ──▶ 리렌더링 (부모가 리렌더링됨)
      │   └── Logo ─▶ 리렌더링
      └── Main ───▶ 리렌더링
          └── Content ─▶ 리렌더링
```

`App`의 사소한 상태 변화가 트리 전체로 전파됩니다.

최적화 전략의 핵심은 이 **전파를 어디서 끊을 것인가**입니다. 다음 아티클들에서 각 방법을 다룹니다.

## 정리

| 리렌더링 원인 | 설명 |
|------------|------|
| state 변경 | `useState`, `useReducer` 값 변경 |
| 부모 리렌더링 | props 변경 없어도 발생 |
| Context 변경 | 구독 중인 Context 값 변경 |

- 리렌더링은 무조건 나쁜 것이 아닙니다
- 객체/함수는 참조로 비교되어 매번 "새 값"으로 인식됩니다
- 최적화는 **측정 후**, 실제 문제가 있을 때 적용합니다
