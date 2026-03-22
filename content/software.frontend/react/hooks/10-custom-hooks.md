---
title: "[React 훅 시리즈] 10. 커스텀 훅: 로직을 재사용 가능한 단위로 분리하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "hooks", "custom-hooks", "재사용", "관심사분리"]
---

# 커스텀 훅: 로직을 재사용 가능한 단위로 분리하기

React에서 컴포넌트는 UI를 재사용하는 단위입니다. 그렇다면 로직은 어떻게 재사용할까요? 커스텀 훅이 그 답입니다. 커스텀 훅은 여러 컴포넌트에서 공통으로 필요한 **상태 관련 로직**을 별도의 함수로 분리하는 방법입니다.

## 커스텀 훅의 규칙

커스텀 훅은 두 가지 규칙만 지키면 됩니다.
1. 함수 이름이 **`use`로 시작**해야 합니다
2. 내부에서 다른 훅을 호출할 수 있습니다

```jsx
// 커스텀 훅
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = () => setCount(prev => prev + 1);
  const decrement = () => setCount(prev => prev - 1);
  const reset = () => setCount(initialValue);

  return { count, increment, decrement, reset };
}

// 사용하는 컴포넌트
function Counter() {
  const { count, increment, decrement, reset } = useCounter(10);

  return (
    <div>
      <p>{count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
      <button onClick={reset}>초기화</button>
    </div>
  );
}
```

`use`로 시작하는 이름 덕분에 React는 이 함수가 훅의 규칙을 따라야 한다는 것을 인식합니다.

## 실전 예제들

### useLocalStorage: 로컬스토리지와 동기화된 상태

```jsx
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// 사용
function Settings() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      현재 테마: {theme}
    </button>
  );
}
```

### useFetch: 데이터 가져오기 로직 추상화

```jsx
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [url]);

  return { data, loading, error };
}

// 사용
function UserProfile({ userId }) {
  const { data: user, loading, error } = useFetch(`/api/users/${userId}`);

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>오류 발생</div>;
  return <div>{user.name}</div>;
}
```

### useDebounce: 연속된 입력을 지연 처리

```jsx
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer); // 클린업: 이전 타이머 취소
  }, [value, delay]);

  return debouncedValue;
}

// 사용: 타이핑을 멈춘 후 300ms 뒤에만 검색
function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      searchAPI(debouncedQuery);
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

## 훅 합성: 훅 위에 훅 쌓기

커스텀 훅은 다른 커스텀 훅을 조합해서 만들 수 있습니다.

```jsx
function useSearchResults(url) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300); // 커스텀 훅 사용
  const { data, loading } = useFetch(`${url}?q=${debouncedQuery}`); // 또 다른 커스텀 훅

  return { query, setQuery, results: data, loading };
}

// 이제 컴포넌트는 아주 단순해집니다
function SearchPage() {
  const { query, setQuery, results, loading } = useSearchResults('/api/search');

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      {loading ? <div>검색 중...</div> : <ResultList items={results} />}
    </>
  );
}
```

## 커스텀 훅의 장점

1. **재사용성**: 같은 로직을 여러 컴포넌트에서 사용할 수 있습니다
2. **관심사 분리**: 컴포넌트는 UI만, 훅은 로직만 담당합니다
3. **테스트 용이성**: 로직을 독립적으로 테스트할 수 있습니다
4. **가독성**: 컴포넌트 코드가 간결해집니다

## 정리

커스텀 훅은 특별한 API가 아닙니다. `use`로 시작하는 이름을 가진 일반 함수입니다. 같은 패턴의 훅 조합이 두 곳 이상에서 반복된다면, 커스텀 훅으로 추출할 때가 된 것입니다. UI 로직과 비즈니스 로직을 분리하는 가장 React다운 방법입니다.
