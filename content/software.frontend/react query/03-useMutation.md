---
title: "[React Query 시리즈] 3. useMutation: 데이터 변경하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "react-query", "useMutation", "POST", "PUT", "DELETE"]
---

# `useMutation`: 데이터 변경하기

`useQuery`가 데이터를 **읽는** 것이라면, `useMutation`은 데이터를 **변경하는** 것입니다. POST, PUT, PATCH, DELETE 같은 서버 데이터 변경 작업에 사용합니다.

## 기본 사용법

```jsx
import { useMutation } from '@tanstack/react-query';

function CreateTodoForm() {
  const mutation = useMutation({
    mutationFn: (newTodo) =>
      fetch('/api/todos', {
        method: 'POST',
        body: JSON.stringify(newTodo),
        headers: { 'Content-Type': 'application/json' },
      }).then(res => res.json()),
  });

  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate({ title: '새 할 일', completed: false });
  }

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? '저장 중...' : '추가'}
      </button>
      {mutation.isError && <p>오류: {mutation.error.message}</p>}
      {mutation.isSuccess && <p>저장 완료!</p>}
    </form>
  );
}
```

`useMutation`은 `mutate` 함수를 반환합니다. 이 함수를 호출할 때 데이터가 전달됩니다.

## 콜백: onSuccess, onError, onSettled

뮤테이션 결과에 따라 다른 동작을 실행할 수 있습니다.

```jsx
const mutation = useMutation({
  mutationFn: createTodo,

  onSuccess: (data) => {
    // data: 서버가 반환한 생성된 할 일
    console.log('생성됨:', data);
    alert('할 일이 추가됐습니다!');
  },

  onError: (error) => {
    console.error('실패:', error.message);
    alert('저장에 실패했습니다.');
  },

  onSettled: () => {
    // 성공/실패 모두 실행
    console.log('뮤테이션 완료');
  },
});
```

또는 `mutate` 호출 시 직접 콜백을 넘길 수 있습니다.

```jsx
mutation.mutate(newTodo, {
  onSuccess: (data) => {
    console.log('성공:', data);
  },
  onError: (error) => {
    console.error('실패:', error);
  },
});
```

`useMutation` 옵션과 `mutate` 옵션 둘 다 있으면 모두 실행됩니다. 전역 처리는 `useMutation`에, 호출별 처리는 `mutate`에 작성하면 됩니다.

## 뮤테이션 후 쿼리 무효화

뮤테이션이 성공하면 관련 쿼리 캐시를 무효화해서 최신 데이터를 다시 가져오게 합니다. 이것이 React Query에서 가장 중요한 패턴 중 하나입니다.

```jsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function CreateTodo() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      // 'todos' 쿼리를 무효화 → 자동으로 다시 fetch
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  return (
    <button onClick={() => mutation.mutate({ title: '새 항목' })}>
      추가
    </button>
  );
}
```

새 할 일을 만들면 → `onSuccess`에서 `['todos']` 쿼리 무효화 → 할 일 목록이 자동으로 최신 데이터로 갱신됩니다.

## mutateAsync: Promise 사용

`mutate`는 fire-and-forget 방식입니다. 결과를 `await`하고 싶다면 `mutateAsync`를 사용합니다.

```jsx
async function handleSubmit() {
  try {
    const newTodo = await mutation.mutateAsync({ title: '새 할 일' });
    // 성공 후 다음 작업
    router.push(`/todos/${newTodo.id}`);
  } catch (error) {
    console.error('실패:', error);
  }
}
```

`mutateAsync`는 에러를 throw하므로 반드시 try/catch로 감싸야 합니다.

## 실전 예제: CRUD

```jsx
function TodoApp() {
  const queryClient = useQueryClient();

  // 목록 조회
  const { data: todos } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  });

  // 생성
  const createMutation = useMutation({
    mutationFn: (title) => api.post('/todos', { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  // 수정
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/todos/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  // 삭제
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/todos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  return (
    <div>
      <button onClick={() => createMutation.mutate('새 할 일')}>추가</button>
      {todos?.map(todo => (
        <div key={todo.id}>
          <span>{todo.title}</span>
          <button onClick={() => updateMutation.mutate({ id: todo.id, completed: true })}>
            완료
          </button>
          <button onClick={() => deleteMutation.mutate(todo.id)}>삭제</button>
        </div>
      ))}
    </div>
  );
}
```

## 반환값 정리

```jsx
const {
  mutate,       // 뮤테이션 실행 (결과 무시)
  mutateAsync,  // 뮤테이션 실행 (Promise 반환)
  isPending,    // 실행 중
  isSuccess,    // 성공
  isError,      // 에러 발생
  error,        // 에러 객체
  data,         // 서버 응답 데이터
  reset,        // 상태를 idle로 초기화
} = useMutation({ mutationFn: ... });
```

## useQuery vs useMutation

| | `useQuery` | `useMutation` |
|--|-----------|--------------|
| 목적 | 데이터 읽기 (GET) | 데이터 변경 (POST/PUT/DELETE) |
| 실행 시점 | 자동 (마운트 시) | 수동 (`mutate` 호출 시) |
| 캐싱 | 있음 | 없음 |
| 재시도 | 자동 | 기본적으로 없음 |
| 로딩 상태 | `isLoading`, `isFetching` | `isPending` |
