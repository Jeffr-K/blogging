---
title: "[React Query 시리즈] 2. useQuery: 데이터 가져오기의 기본"
author: oscar.rs
date: 2026-03-22
tags: ["react", "react-query", "useQuery", "데이터페칭", "캐싱"]
---

# `useQuery`: 데이터 가져오기의 기본

`useQuery`는 React Query의 핵심 훅입니다. 서버에서 데이터를 가져오고, 캐싱하고, 상태를 관리합니다.

## 기본 사용법

```jsx
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['todos'],
  queryFn: () => fetch('/api/todos').then(res => res.json()),
});
```

두 가지만 필수입니다.
- **`queryKey`**: 이 쿼리의 고유 식별자 (캐시 키)
- **`queryFn`**: 데이터를 가져오는 비동기 함수

## 반환값: 상태 플래그들

`useQuery`는 다양한 상태 정보를 반환합니다.

```jsx
const {
  data,           // 가져온 데이터 (없으면 undefined)
  isLoading,      // 처음 로딩 중 (데이터도 없고, 로딩 중)
  isFetching,     // 백그라운드 갱신 포함 모든 fetching 중
  isError,        // 에러 발생 여부
  error,          // 에러 객체
  isSuccess,      // 성공적으로 데이터를 가져옴
  refetch,        // 수동으로 다시 가져오는 함수
  status,         // 'pending' | 'error' | 'success'
  fetchStatus,    // 'fetching' | 'paused' | 'idle'
} = useQuery({ queryKey: ['todos'], queryFn: fetchTodos });
```

### isLoading vs isFetching

헷갈리기 쉬운 두 플래그의 차이입니다.

- `isLoading`: **캐시된 데이터가 없고** 처음 로딩 중일 때 `true`
- `isFetching`: 캐시 유무와 관계없이 **현재 API 호출 중**일 때 `true`

```jsx
// 상황: 캐시된 데이터가 있고, 백그라운드에서 갱신 중
isLoading  → false (캐시 데이터가 있으므로)
isFetching → true  (API 호출은 진행 중)
```

```jsx
function TodoList() {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  });

  return (
    <div>
      {isFetching && <span>갱신 중...</span>} {/* 백그라운드 갱신 표시 */}
      {isLoading
        ? <Spinner />
        : <ul>{data.map(todo => <li key={todo.id}>{todo.title}</li>)}</ul>
      }
    </div>
  );
}
```

## 동적 쿼리: queryKey에 변수 포함

데이터가 특정 ID나 파라미터에 따라 달라진다면, queryKey에 포함합니다.

```jsx
function UserProfile({ userId }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],  // userId가 바뀌면 새로운 쿼리
    queryFn: () => fetch(`/api/users/${userId}`).then(res => res.json()),
  });

  if (isLoading) return <div>로딩 중...</div>;
  return <div>{user.name}</div>;
}
```

`userId`가 `1`에서 `2`로 바뀌면, React Query는 `['user', 2]` 키로 새 요청을 합니다. `['user', 1]`의 결과는 캐시에 남아있어서, `userId`가 다시 `1`이 되면 즉시 보여줍니다.

## enabled: 조건부 실행

특정 조건이 충족될 때만 쿼리를 실행하고 싶다면 `enabled`를 사용합니다.

```jsx
function UserPosts({ userId }) {
  const { data: posts } = useQuery({
    queryKey: ['posts', userId],
    queryFn: () => fetchPostsByUser(userId),
    enabled: !!userId, // userId가 있을 때만 실행
  });

  return <div>...</div>;
}
```

`enabled: false`이면 쿼리가 실행되지 않고 `isLoading`도 `false`입니다. (로딩 UI가 표시되지 않음)

## select: 데이터 변환

서버에서 받은 데이터를 컴포넌트에서 쓰기 좋은 형태로 변환합니다.

```jsx
const { data: todoCount } = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,
  select: (data) => data.filter(todo => !todo.completed).length,
  // 전체 할 일 목록 대신, 미완료 할 일 수만 반환
});
```

`select`는 캐시된 원본 데이터는 그대로 두고, 컴포넌트에만 변환된 값을 줍니다. 같은 쿼리를 여러 컴포넌트에서 다른 형태로 쓸 때 유용합니다.

## 에러 처리

```jsx
function TodoList() {
  const { data, isError, error } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const res = await fetch('/api/todos');
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.');
      return res.json();
    },
    retry: 2, // 실패 시 2번 재시도 (기본값: 3)
  });

  if (isError) return <div>{error.message}</div>;
  return <ul>...</ul>;
}
```

`queryFn`에서 에러를 `throw`하면 React Query가 잡아서 `error`로 제공합니다. `retry` 옵션으로 자동 재시도 횟수를 조절할 수 있습니다.

## 주요 옵션 정리

```jsx
useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,

  staleTime: 1000 * 60 * 5, // 5분간 fresh 상태 유지 (기본값: 0)
  gcTime: 1000 * 60 * 10,   // 10분 후 캐시에서 제거 (기본값: 5분)
  retry: 3,                  // 실패 시 재시도 횟수 (기본값: 3)
  refetchOnWindowFocus: true, // 탭 포커스 시 재조회 (기본값: true)
  enabled: true,             // 쿼리 활성화 여부 (기본값: true)
  select: (data) => data,    // 데이터 변환 함수
  placeholderData: [],       // 데이터 로드 전 임시 표시 데이터
});
```

`staleTime`과 캐싱 전략은 별도 아티클에서 자세히 다룹니다.

## 정리

| 항목 | 설명 |
|------|------|
| `queryKey` | 캐시 식별자, 변수가 있으면 배열에 포함 |
| `queryFn` | 데이터를 반환하는 비동기 함수, 에러는 throw |
| `isLoading` | 캐시 없이 처음 로딩 중 |
| `isFetching` | 모든 API 호출 중 (백그라운드 포함) |
| `enabled` | 조건부 실행 |
| `select` | 캐시 원본을 건드리지 않고 컴포넌트용으로 변환 |
