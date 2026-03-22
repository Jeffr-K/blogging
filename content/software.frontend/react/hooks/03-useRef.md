---
title: "[React 훅 시리즈] 3. useRef: 렌더링 없이 값을 기억하는 방법"
author: oscar.rs
date: 2026-03-22
tags: ["react", "hooks", "useRef", "DOM", "ref"]
---

# `useRef`: 렌더링 없이 값을 기억하는 방법

`useRef`는 두 가지 용도로 사용됩니다. 첫째는 DOM 요소에 직접 접근하는 것, 둘째는 **렌더링을 일으키지 않으면서** 값을 유지하는 것입니다.

## ref 객체 이해하기

`useRef`는 `{ current: 초기값 }` 형태의 객체를 반환합니다.

```jsx
const ref = useRef(0);
console.log(ref); // { current: 0 }
console.log(ref.current); // 0
```

이 객체의 핵심 특징은 두 가지입니다.
1. `ref.current`를 변경해도 **컴포넌트가 리렌더링되지 않습니다**
2. 리렌더링이 발생해도 `ref.current`의 값이 **유지됩니다**

## DOM 요소에 직접 접근하기

React는 기본적으로 DOM을 직접 건드리지 않고 추상화를 통해 관리합니다. 하지만 input에 포커스를 주거나, 스크롤 위치를 측정하는 등 DOM에 직접 접근해야 할 때가 있습니다.

```jsx
function SearchInput() {
  const inputRef = useRef(null);

  function handleClick() {
    inputRef.current.focus(); // DOM 요소에 직접 접근
  }

  return (
    <>
      <input ref={inputRef} type="text" />
      <button onClick={handleClick}>검색창 포커스</button>
    </>
  );
}
```

JSX의 `ref` 속성에 ref 객체를 넘기면, React가 해당 DOM 요소를 `ref.current`에 자동으로 연결해줍니다.

## 렌더링 없이 값 유지하기

타이머 ID, 이전 값, 플래그 같은 정보를 **화면에 보여줄 필요는 없지만 기억해야 할 때** ref를 사용합니다.

```jsx
function Timer() {
  const [count, setCount] = useState(0);
  const timerIdRef = useRef(null); // 타이머 ID 저장

  function startTimer() {
    timerIdRef.current = setInterval(() => {
      setCount(prev => prev + 1);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerIdRef.current); // 저장해둔 ID로 정지
  }

  return (
    <div>
      <p>{count}초</p>
      <button onClick={startTimer}>시작</button>
      <button onClick={stopTimer}>정지</button>
    </div>
  );
}
```

`timerIdRef.current`를 바꿔도 렌더링이 발생하지 않으므로, 타이머 ID 같은 내부 정보를 저장하기에 적합합니다.

## ref vs state: 무엇을 써야 할까?

| 비교 항목 | `useRef` | `useState` |
|----------|---------|-----------|
| 값 변경 시 리렌더링 | 발생하지 않음 | 발생함 |
| 화면에 표시 | 적합하지 않음 | 적합함 |
| 주요 용도 | DOM 접근, 내부 값 추적 | UI에 반영할 상태 |

**화면에 보여줘야 하는 값**은 `useState`, **내부적으로만 필요한 값**은 `useRef`를 사용하세요.

```jsx
function ClickTracker() {
  const [displayCount, setDisplayCount] = useState(0); // 화면에 표시
  const totalClicksRef = useRef(0); // 내부 추적용 (렌더링 불필요)

  function handleClick() {
    totalClicksRef.current += 1; // 렌더링 없이 증가
    if (totalClicksRef.current % 10 === 0) {
      setDisplayCount(totalClicksRef.current); // 10번마다 화면 업데이트
    }
  }

  return <button onClick={handleClick}>클릭 수: {displayCount}</button>;
}
```

## 이전 값 기억하기

`useEffect`와 함께 사용하면 이전 렌더링의 값을 기억할 수 있습니다.

```jsx
function PreviousValue({ value }) {
  const prevValueRef = useRef();

  useEffect(() => {
    prevValueRef.current = value; // 렌더링 후 현재 값을 저장
  });

  const prevValue = prevValueRef.current; // 렌더링 시점에는 이전 값

  return (
    <div>
      현재: {value}, 이전: {prevValue}
    </div>
  );
}
```

## 정리

- `useRef`는 `{ current: 값 }` 형태의 객체를 반환합니다
- `ref.current` 변경은 리렌더링을 유발하지 않습니다
- DOM 요소에 `ref` 속성으로 연결하면 해당 DOM에 직접 접근할 수 있습니다
- 화면에 반영할 필요 없는 내부 값을 저장할 때 유용합니다
