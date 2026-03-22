---
title: "[React 성능 최적화] 3. useMemo & useCallback: 언제 써야 하고 언제 쓰지 말아야 하는가"
author: oscar.rs
date: 2026-03-22
tags: ["react", "optimization", "useMemo", "useCallback", "메모이제이션"]
---

# useMemo & useCallback: 언제 써야 하고 언제 쓰지 말아야 하는가

`useMemo`와 `useCallback`은 성능 최적화 도구입니다. 하지만 잘못 쓰면 오히려 코드 복잡도만 늘고 성능은 나빠집니다. "언제 쓰고 언제 안 쓰는지"가 핵심입니다.

## 빠른 복습

- **`useMemo`**: **값**을 캐싱합니다. 의존성이 바뀌지 않으면 이전 값을 재사용합니다.
- **`useCallback`**: **함수**를 캐싱합니다. 의존성이 바뀌지 않으면 같은 함수 참조를 유지합니다.

```jsx
// 비싼 계산 결과를 캐싱
const sortedList = useMemo(
  () => [...list].sort((a, b) => a.name.localeCompare(b.name)),
  [list]
);

// 함수 참조를 안정적으로 유지
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

## 쓰지 말아야 할 때

### 1. 단순한 계산

메모이제이션 자체도 비용입니다: 이전 값 저장 + 의존성 비교. 계산이 이보다 빠르면 낭비입니다.

```jsx
// 불필요: 단순 연산은 그냥 계산하는 게 더 빠름
const total = useMemo(() => price * quantity, [price, quantity]);
const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);

// 그냥 이렇게:
const total = price * quantity;
const fullName = `${firstName} ${lastName}`;
```

### 2. 자식이 memo로 감싸져 있지 않을 때

`useCallback`은 함수 참조를 안정화해서 자식의 불필요한 리렌더링을 막는 데 씁니다. 자식이 `memo`로 감싸져 있지 않으면 어차피 리렌더링됩니다.

```jsx
function Parent() {
  // 자식이 memo가 아니라면 이 useCallback은 의미 없음
  const handleClick = useCallback(() => {
    console.log('클릭');
  }, []);

  return <Child onClick={handleClick} />; // Child가 memo 아님 → 어차피 리렌더링
}
```

### 3. 의존성 배열 값이 자주 바뀔 때

의존성이 거의 항상 바뀐다면 캐싱 효과가 없습니다. 비교 비용만 추가됩니다.

```jsx
// 매 렌더링마다 timestamp가 바뀌므로 캐싱 의미 없음
const value = useMemo(() => expensiveCalc(timestamp), [timestamp]);
```

## 써야 할 때

### 1. 실제로 비싼 계산

```jsx
function ProductList({ products, filterText, sortKey }) {
  // 수천 개 정렬/필터링: 매 렌더링마다 하면 느림
  const processed = useMemo(() => {
    return products
      .filter(p => p.name.includes(filterText))
      .sort((a, b) => a[sortKey].localeCompare(b[sortKey]));
  }, [products, filterText, sortKey]);

  return processed.map(p => <ProductCard key={p.id} product={p} />);
}
```

"비싼 계산"의 기준은 약 1ms 이상. `console.time`으로 직접 측정해보는 것이 좋습니다.

```jsx
console.time('filter');
const result = products.filter(...).sort(...);
console.timeEnd('filter'); // 1ms 미만이면 useMemo 불필요
```

### 2. memo 자식에 객체/함수 props를 넘길 때

```jsx
const MemoChild = memo(function MemoChild({ config, onAction }) {
  return <div onClick={onAction}>{config.label}</div>;
});

function Parent() {
  const [count, setCount] = useState(0);

  // memo 자식에 넘기는 객체는 useMemo로 안정화
  const config = useMemo(() => ({ label: '버튼', color: 'blue' }), []);

  // memo 자식에 넘기는 함수는 useCallback으로 안정화
  const handleAction = useCallback(() => {
    doSomething();
  }, []);

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <MemoChild config={config} onAction={handleAction} />
    </div>
  );
}
```

### 3. useEffect 의존성에 객체/함수가 들어갈 때

```jsx
function Search({ query }) {
  // options 객체를 그냥 만들면 매 렌더링마다 새 참조 → useEffect 무한 실행
  const options = useMemo(() => ({
    debounce: 300,
    minLength: 2,
  }), []); // 한 번만 생성

  useEffect(() => {
    fetchSearch(query, options);
  }, [query, options]); // options가 안정적이므로 query가 바뀔 때만 실행
}
```

### 4. Context value 안정화

```jsx
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  // value가 매 렌더링마다 새 객체가 되면 모든 소비자 리렌더링
  const value = useMemo(() => ({
    theme,
    setTheme,
  }), [theme]); // theme이 바뀔 때만 새 객체 생성

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
```

## 의존성 배열 관리

의존성 배열에서 빠진 값이 있으면 버그가 생깁니다. 있어야 할 값을 빼고 싶은 유혹이 생기면 코드를 다시 구조화해야 한다는 신호입니다.

```jsx
// 잘못된 예: count를 빠뜨려서 항상 초기값 0을 참조
const handleClick = useCallback(() => {
  console.log(count); // 항상 0!
}, []); // count 빠뜨림

// 올바른 예 1: 의존성에 포함
const handleClick = useCallback(() => {
  console.log(count);
}, [count]);

// 올바른 예 2: 함수형 업데이트로 의존성 제거
const handleIncrement = useCallback(() => {
  setCount(prev => prev + 1); // count를 직접 참조하지 않음
}, []); // 빈 배열 가능
```

## 결정 흐름

```
useMemo / useCallback을 쓸까?
  │
  ├─ 자식이 memo로 감싸져 있나?
  │   └── NO → 불필요
  │
  ├─ 계산이 실제로 느린가? (1ms 이상)
  │   └── NO → useMemo 불필요
  │
  ├─ useEffect 의존성에 넣어야 하는 객체/함수인가?
  │   └── YES → 필요
  │
  └─ memo 자식에 객체/함수 props를 넘기는가?
      └── YES → 필요
```

## 정리

| 상황 | useMemo | useCallback |
|------|---------|------------|
| 단순 계산 | ❌ 불필요 | - |
| 무거운 계산 | ✅ 필요 | - |
| memo 자식에 함수 전달 | - | ✅ 필요 |
| memo 자식에 객체 전달 | ✅ 필요 | - |
| useEffect 의존성 | ✅ 필요 | ✅ 필요 |
| Context value | ✅ 필요 | - |

메모이제이션은 **문제를 발견한 후에 적용하는 도구**입니다. 먼저 코드를 간단하게 작성하고, 실제 성능 문제가 생겼을 때 측정 후 적용하세요.
