---
title: "[React Query 시리즈] 6. Query Invalidation & Refetching: 캐시를 최신 상태로 유지하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "react-query", "invalidation", "refetch", "캐시무효화"]
---

# Query Invalidation & Refetching: 캐시를 최신 상태로 유지하기

서버 데이터가 변경됐을 때 React Query 캐시를 어떻게 최신 상태로 유지할까요? 핵심 도구는 **Query Invalidation**입니다.

## invalidateQueries: 캐시를 구식으로 표시

`invalidateQueries`는 해당 쿼리 캐시를 **stale로 표시**하고, 현재 구독 중인 컴포넌트가 있다면 즉시 백그라운드 재fetch를 트리거합니다.

```jsx
import { useQueryClient } from '@tanstack/react-query';

function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      // 새 할 일이 생겼으므로 목록 캐시를 무효화
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

무효화 후:
- 해당 쿼리를 구독하는 컴포넌트가 있으면 → 즉시 백그라운드 재fetch
- 구독하는 컴포넌트가 없으면 → stale로만 표시, 다음에 마운트될 때 재fetch

## 부분 매칭으로 관련 쿼리 한 번에 무효화

`invalidateQueries`는 key를 **접두사(prefix)로 매칭**합니다.

```jsx
// ['todos']로 시작하는 모든 쿼리 무효화
queryClient.invalidateQueries({ queryKey: ['todos'] });

// 무효화되는 쿼리들:
// ['todos']
// ['todos', 'list']
// ['todos', 'list', { filter: 'active' }]
// ['todos', 'detail', 1]
// ['todos', 'detail', 2]
```

```jsx
// 특정 상세만 무효화
queryClient.invalidateQueries({ queryKey: ['todos', 'detail', todoId] });

// 목록만 무효화 (상세는 그대로)
queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });
```

## exact: 정확히 일치하는 쿼리만 무효화

```jsx
// exact: true면 정확히 ['todos']인 쿼리만 무효화
// ['todos', 'list'] 같은 하위 쿼리는 무효화 안 됨
queryClient.invalidateQueries({
  queryKey: ['todos'],
  exact: true,
});
```

## refetchQueries vs invalidateQueries

```jsx
// invalidateQueries: stale로 표시, 마운트된 쿼리만 재fetch
queryClient.invalidateQueries({ queryKey: ['todos'] });

// refetchQueries: 즉시 강제로 재fetch (마운트 여부 상관없음)
queryClient.refetchQueries({ queryKey: ['todos'] });
```

대부분의 경우 `invalidateQueries`가 적합합니다. `refetchQueries`는 "지금 당장 무조건 새로 가져와야 할 때" 사용합니다.

## setQueryData: 서버 응답으로 캐시 직접 업데이트

API 응답에 이미 업데이트된 데이터가 포함되어 있다면, 추가 API 호출 없이 캐시를 직접 업데이트할 수 있습니다.

```jsx
const mutation = useMutation({
  mutationFn: updateTodo,
  onSuccess: (updatedTodo) => {
    // 서버 응답(updatedTodo)으로 캐시 직접 업데이트
    queryClient.setQueryData(
      ['todos', 'detail', updatedTodo.id],
      updatedTodo
    );
    // 목록은 무효화해서 재fetch
    queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });
  },
});
```

이 방식은 상세 쿼리에 대한 추가 API 호출을 줄입니다.

## 함수형 업데이트: 기존 캐시 기반으로 업데이트

```jsx
queryClient.setQueryData(['todos', 'list'], (oldData) => {
  if (!oldData) return oldData;
  return oldData.map(todo =>
    todo.id === updatedTodo.id ? updatedTodo : todo
  );
});
```

## removeQueries: 캐시에서 완전히 제거

```jsx
// 로그아웃 시 사용자 관련 캐시 전부 제거
function handleLogout() {
  queryClient.removeQueries({ queryKey: ['user'] });
  queryClient.removeQueries({ queryKey: ['todos'] });
  logout();
}
```

## cancelQueries: 진행 중인 요청 취소

낙관적 업데이트 시 기존 요청이 완료되어 상태를 덮어쓰는 것을 방지합니다.

```jsx
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    // 진행 중인 refetch가 낙관적 업데이트를 덮어쓰지 않도록 취소
    await queryClient.cancelQueries({ queryKey: ['todos'] });
  },
});
```

## 실전 패턴: 뮤테이션 후 처리 전략

```jsx
function useTodoMutations() {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: updateTodo,
    onSuccess: (updatedTodo) => {
      // 전략 1: 관련 쿼리 전부 무효화 (가장 단순, 추가 API 호출 발생)
      queryClient.invalidateQueries({ queryKey: ['todos'] });

      // 전략 2: 상세는 직접 업데이트, 목록만 무효화 (API 호출 최소화)
      queryClient.setQueryData(['todos', 'detail', updatedTodo.id], updatedTodo);
      queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });

      // 전략 3: 낙관적 업데이트 (07 아티클에서 자세히)
    },
  });

  return { updateMutation };
}
```

## 정리

| 메서드 | 역할 |
|--------|------|
| `invalidateQueries` | stale 표시 + 마운트된 쿼리 재fetch |
| `refetchQueries` | 강제 즉시 재fetch |
| `setQueryData` | 캐시 직접 업데이트 |
| `removeQueries` | 캐시 완전 제거 |
| `cancelQueries` | 진행 중인 요청 취소 |

뮤테이션 후 `invalidateQueries`로 관련 캐시를 무효화하는 것이 가장 기본이자 안전한 패턴입니다. 성능이 중요하다면 `setQueryData`로 추가 API 호출을 줄이세요.
