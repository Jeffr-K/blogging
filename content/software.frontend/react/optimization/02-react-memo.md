---
title: "[React 성능 최적화] 2. React.memo: 컴포넌트 리렌더링 막기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "optimization", "React.memo", "메모이제이션", "리렌더링"]
---

# React.memo: 컴포넌트 리렌더링 막기

부모가 리렌더링되면 자식도 따라서 리렌더링됩니다. `React.memo`는 이 전파를 막는 도구입니다. 컴포넌트를 `React.memo`로 감싸면, **props가 변경됐을 때만** 리렌더링됩니다.

## 기본 사용법

```jsx
import { memo } from 'react';

// memo로 감싼 컴포넌트
const Greeting = memo(function Greeting({ name }) {
  console.log('Greeting 렌더링');
  return <h1>안녕하세요, {name}님</h1>;
});

function Parent() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <Greeting name="홍길동" /> {/* count가 바뀌어도 name이 같으면 리렌더링 안 됨 */}
    </div>
  );
}
```

`name`이 `"홍길동"`으로 변하지 않는 한, `Parent`가 몇 번을 리렌더링해도 `Greeting`은 리렌더링되지 않습니다.

## props 비교 방식

`React.memo`는 기본적으로 **얕은 비교(shallow equal)**로 props를 비교합니다.

```jsx
// 기본 타입: 값 비교 → 잘 동작
<Button count={5} />         // 이전과 같으면 리렌더링 안 됨

// 객체/배열: 참조 비교 → 매번 새 참조이면 리렌더링됨
<Button style={{ color: 'red' }} />  // 매번 새 객체 → 항상 리렌더링!
<Button items={[1, 2, 3]} />         // 매번 새 배열 → 항상 리렌더링!
<Button onClick={() => {}} />        // 매번 새 함수 → 항상 리렌더링!
```

`React.memo`의 효과를 제대로 보려면, 객체/함수 props를 `useMemo`/`useCallback`으로 안정화해야 합니다.

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  // 안정화: count가 바뀌어도 handleClick 참조 유지
  const handleClick = useCallback(() => {
    console.log('클릭');
  }, []);

  // 안정화: count가 바뀌어도 style 참조 유지
  const style = useMemo(() => ({ color: 'red' }), []);

  return <MemoChild onClick={handleClick} style={style} />;
}

const MemoChild = memo(function MemoChild({ onClick, style }) {
  console.log('MemoChild 렌더링');
  return <button onClick={onClick} style={style}>버튼</button>;
});
```

## 커스텀 비교 함수

얕은 비교가 부족하거나 특정 props만 비교하고 싶을 때, 두 번째 인자로 비교 함수를 넘깁니다.

```jsx
const UserCard = memo(
  function UserCard({ user, onEdit }) {
    return <div>{user.name}</div>;
  },
  // 두 번째 인자: (이전 props, 새 props) => 같으면 true (리렌더링 안 함)
  (prevProps, nextProps) => {
    return prevProps.user.id === nextProps.user.id
      && prevProps.user.name === nextProps.user.name;
    // onEdit은 비교하지 않음 (리렌더링에 영향 없음)
  }
);
```

## React.memo가 효과 없는 경우

### children을 받는 컴포넌트

```jsx
const Wrapper = memo(function Wrapper({ children }) {
  return <div>{children}</div>;
});

function Parent() {
  const [count, setCount] = useState(0);
  return (
    <Wrapper>
      <p>내용</p> {/* 매 렌더링마다 새 JSX 요소 생성 → 항상 리렌더링 */}
    </Wrapper>
  );
}
```

`children`으로 JSX를 넘기면 매 렌더링마다 새 객체가 생성되므로 `memo`가 효과 없습니다.

### 컴포넌트 안에서 다른 컴포넌트를 정의

```jsx
function Parent() {
  // 매 렌더링마다 새 컴포넌트 함수가 생성됨
  const Inner = () => <div>내용</div>;

  return <Inner />; // memo로 감싸도 의미 없음
}
```

컴포넌트는 항상 모듈 최상단에 정의하세요.

## React.memo를 쓰지 말아야 할 때

`memo`는 이전 props와 현재 props를 비교하는 비용이 있습니다. 이 비용보다 리렌더링 비용이 더 작다면 오히려 손해입니다.

**남용하면 안 되는 경우**
- 컴포넌트가 매우 가볍고 렌더링이 빠를 때
- props가 거의 항상 바뀔 때 (비교 비용만 추가됨)
- 최적화가 필요한지 확인하지 않고 습관적으로 적용할 때

**효과적인 경우**
- 렌더링 비용이 높은 복잡한 컴포넌트
- 부모는 자주 리렌더링되지만 해당 컴포넌트의 props는 잘 바뀌지 않을 때
- 리스트 아이템처럼 많은 인스턴스가 있는 컴포넌트

```jsx
// 효과적인 사례: 무거운 차트 컴포넌트
const HeavyChart = memo(function HeavyChart({ data, config }) {
  // 복잡한 차트 렌더링...
  return <canvas>...</canvas>;
});

// 효과 없는 사례: 가벼운 텍스트 컴포넌트
const Label = memo(function Label({ text }) {
  return <span>{text}</span>; // 너무 가벼워서 memo 비용이 더 큼
});
```

## 정리

| 상황 | 결과 |
|------|------|
| 기본 타입 props만 받는 경우 | `memo` 단독으로 효과적 |
| 객체/함수 props가 있는 경우 | `useMemo` / `useCallback`과 함께 사용 |
| children을 받는 경우 | `memo`만으로는 효과 없음 |
| 가벼운 컴포넌트 | `memo` 불필요, 오히려 손해 가능 |

`React.memo` → props를 안정화하려면 → `useMemo` / `useCallback`. 세 가지는 세트로 이해하세요.
