---
title: "[React 훅 시리즈] 5. useCallback: 함수를 캐싱하는 방법"
author: oscar.rs
date: 2026-03-22
tags: ["react", "hooks", "useCallback", "memoization", "성능최적화"]
---

# `useCallback`: 함수를 캐싱하는 방법

`useCallback`은 함수를 메모이제이션합니다. 의존성이 바뀌지 않으면 매 렌더링마다 새 함수를 만드는 대신, 이전에 만든 함수를 재사용합니다. `useMemo`의 함수 버전이라고 생각하면 됩니다.

## 기본 사용법

```jsx
import { useCallback } from 'react';

const cachedFn = useCallback(() => {
  // 함수 내용
}, [의존성]);
```

실제로 `useCallback(fn, deps)`는 `useMemo(() => fn, deps)`와 동일합니다.

## 왜 필요한가?

React 컴포넌트가 렌더링될 때마다 그 안에 정의된 함수들은 **새로 생성**됩니다. 내용이 같아도 새 함수이므로 참조가 다릅니다.

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  // 매 렌더링마다 새 함수가 만들어짐
  const handleClick = () => {
    console.log('클릭!');
  };

  return <Child onClick={handleClick} />;
}
```

`Child`가 `React.memo`로 감싸져 있어도, `handleClick`의 참조가 매번 바뀌므로 `Child`는 매 렌더링마다 다시 렌더링됩니다. `useCallback`으로 이를 막을 수 있습니다.

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  // count가 바뀌지 않으면 같은 함수 참조를 유지
  const handleClick = useCallback(() => {
    console.log('클릭!');
  }, []);

  return <Child onClick={handleClick} />;
}
```

## 의존성이 있는 경우

함수 내부에서 상태나 props를 참조한다면, 의존성 배열에 포함해야 합니다.

```jsx
function SearchForm({ onSearch }) {
  const [query, setQuery] = useState('');

  const handleSubmit = useCallback(() => {
    onSearch(query); // query를 사용하므로 의존성에 포함
  }, [query, onSearch]);

  return (
    <form onSubmit={handleSubmit}>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <button type="submit">검색</button>
    </form>
  );
}
```

## useMemo와의 차이

| | `useMemo` | `useCallback` |
|--|----------|--------------|
| 캐싱 대상 | **값** | **함수** |
| 반환 | `fn()` 실행 결과 | `fn` 자체 |
| 예 | 필터링된 배열 | 이벤트 핸들러 |

```jsx
// 값을 캐싱
const sortedList = useMemo(() => [...list].sort(), [list]);

// 함수를 캐싱
const handleSort = useCallback(() => {
  setSortedList([...list].sort());
}, [list]);
```

## 언제 써야 할까?

`useCallback`도 `useMemo`와 마찬가지로 **남용하면 오히려 성능이 나빠집니다**. 메모이제이션 자체도 비용(메모리, 비교 연산)이 있기 때문입니다.

**사용이 적합한 경우**
- `React.memo`로 감싼 자식 컴포넌트에 함수를 prop으로 전달할 때
- `useEffect`의 의존성으로 함수를 넣어야 할 때

**불필요한 경우**
- 자식이 `React.memo`로 감싸지 않은 경우 (어차피 리렌더링됨)
- 단순한 이벤트 핸들러를 같은 컴포넌트 내에서만 사용하는 경우

## 정리

- `useCallback`은 함수의 참조를 안정적으로 유지합니다
- 내부에서 사용하는 값은 반드시 의존성 배열에 포함해야 합니다
- `React.memo`와 함께 사용할 때 가장 효과적입니다
- 성능 문제가 실제로 발생하기 전까지는 무작정 추가하지 마세요
