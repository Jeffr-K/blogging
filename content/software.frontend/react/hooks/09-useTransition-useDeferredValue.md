---
title: "[React 훅 시리즈] 9. useTransition & useDeferredValue: UI를 막지 않고 업데이트하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "hooks", "useTransition", "useDeferredValue", "concurrent", "성능최적화"]
---

# `useTransition` & `useDeferredValue`: UI를 막지 않고 업데이트하기

React 18에서 도입된 두 훅은 **업데이트에 우선순위를 부여**합니다. 무거운 연산으로 인해 사용자 입력이 버벅이는 문제를 해결할 수 있습니다.

## 문제 상황: 무거운 업데이트가 UI를 막는다

검색 입력창을 생각해봅시다. 사용자가 타이핑할 때마다 수천 개의 결과를 필터링해야 한다면 어떻게 될까요?

```jsx
function SearchPage() {
  const [query, setQuery] = useState('');

  function handleChange(e) {
    setQuery(e.target.value); // 입력 → 필터링 → 렌더링
  }

  const results = items.filter(item => item.includes(query)); // 느릴 수 있음

  return (
    <>
      <input value={query} onChange={handleChange} />
      <ResultList results={results} /> {/* 수천 개 항목 */}
    </>
  );
}
```

매 키 입력마다 수천 개 항목을 다시 렌더링하면 입력 자체도 버벅입니다. 사용자 입력은 **즉각** 반응해야 하지만, 결과 목록은 조금 **늦어도** 괜찮습니다. 이 차이를 React에게 알려주는 것이 핵심입니다.

## useTransition

`useTransition`은 특정 상태 업데이트를 "긴급하지 않음"으로 표시합니다. React는 긴급한 업데이트(사용자 입력 등)를 먼저 처리하고, 여유가 생기면 트랜지션 업데이트를 처리합니다.

```jsx
import { useState, useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(items);
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    const value = e.target.value;
    setQuery(value); // 긴급: 즉시 업데이트

    startTransition(() => {
      // 긴급하지 않음: 여유가 생기면 처리
      setResults(items.filter(item => item.includes(value)));
    });
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <span>로딩 중...</span>}
      <ResultList results={results} />
    </>
  );
}
```

- `isPending`: 트랜지션이 처리 중일 때 `true`
- `startTransition(() => { ... })`: 내부 상태 업데이트를 낮은 우선순위로 표시

이제 입력은 즉시 반응하고, 결과 목록은 백그라운드에서 업데이트됩니다.

## useDeferredValue

`useDeferredValue`는 비슷한 문제를 다른 방식으로 해결합니다. 상태 업데이트 자체가 아니라 **값을 지연**시킵니다.

```jsx
import { useState, useDeferredValue } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query); // query의 지연된 버전

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      {/* deferredQuery가 query보다 늦게 업데이트됨 */}
      <SearchResults query={deferredQuery} />
    </>
  );
}
```

`deferredQuery`는 `query`의 "늦게 따라오는 복사본"입니다. 급하게 처리할 필요가 없는 컴포넌트에 이 지연된 값을 넘겨줍니다.

## 둘의 차이

| | `useTransition` | `useDeferredValue` |
|--|----------------|-------------------|
| 사용 위치 | 상태를 **업데이트하는 곳** | 값을 **사용하는 곳** |
| 제어 방법 | `startTransition`으로 감쌈 | 지연된 값 버전 사용 |
| `isPending` 제공 | ✅ | ❌ |
| 적합한 경우 | 업데이트 코드에 직접 접근 가능할 때 | 외부 라이브러리나 부모의 값을 지연할 때 |

## 시각적 피드백 추가

지연 중임을 사용자에게 알려주면 UX가 좋아집니다.

```jsx
function SearchResults({ query }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery; // 아직 업데이트 반영 전

  const results = useMemo(
    () => items.filter(item => item.includes(deferredQuery)),
    [deferredQuery]
  );

  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      {results.map(item => <div key={item}>{item}</div>)}
    </div>
  );
}
```

`isStale`이 `true`인 동안 결과 목록을 반투명하게 보여주어 "갱신 중"임을 표시합니다.

## 정리

- 두 훅 모두 **React 18의 Concurrent 기능**을 활용합니다
- 무거운 렌더링 작업이 사용자 입력을 방해할 때 사용합니다
- `useTransition`: 업데이트 코드를 `startTransition`으로 감쌉니다
- `useDeferredValue`: 느리게 반응해도 되는 컴포넌트에 지연된 값을 넘깁니다
- 로딩 인디케이터로 사용자에게 처리 중임을 알려주세요
