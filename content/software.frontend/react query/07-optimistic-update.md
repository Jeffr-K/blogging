---
title: "[React Query 시리즈] 7. Optimistic Update: 응답 전에 UI 먼저 바꾸기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "react-query", "optimistic-update", "낙관적업데이트", "UX"]
---

# Optimistic Update: 응답 전에 UI 먼저 바꾸기

할 일 완료 버튼을 눌렀을 때, 서버 응답을 기다렸다가 UI를 업데이트하면 사용자는 딜레이를 느낍니다. **낙관적 업데이트(Optimistic Update)**는 서버 응답을 기다리지 않고 UI를 먼저 바꾸고, 나중에 서버 응답으로 확정하거나 실패 시 롤백하는 패턴입니다.

## 왜 낙관적 업데이트인가?

대부분의 뮤테이션은 **성공할 것이라고 낙관적으로 가정**할 수 있습니다. 네트워크 에러가 아닌 이상 할 일 완료 처리는 거의 항상 성공합니다. 실패 확률이 낮다면, 성공을 가정하고 UI를 먼저 업데이트하는 것이 UX를 크게 개선합니다.

## 구현 방법

`useMutation`의 세 가지 콜백을 활용합니다.

- **`onMutate`**: 뮤테이션 시작 직전 (UI 업데이트)
- **`onError`**: 실패 시 (롤백)
- **`onSettled`**: 성공/실패 모두 완료 후 (서버와 동기화)

```jsx
function useTodoToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, completed }) => updateTodo(id, { completed }),

    // 1단계: 뮤테이션 시작 전에 UI 먼저 업데이트
    onMutate: async ({ id, completed }) => {
      // 진행 중인 refetch가 낙관적 업데이트를 덮어쓰지 않도록 취소
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // 현재 캐시 값을 백업 (롤백용)
      const previousTodos = queryClient.getQueryData(['todos']);

      // 캐시를 낙관적으로 업데이트
      queryClient.setQueryData(['todos'], (oldTodos) =>
        oldTodos.map(todo =>
          todo.id === id ? { ...todo, completed } : todo
        )
      );

      // 롤백에 사용할 백업 데이터를 context로 반환
      return { previousTodos };
    },

    // 2단계: 실패 시 백업 데이터로 롤백
    onError: (error, variables, context) => {
      queryClient.setQueryData(['todos'], context.previousTodos);
    },

    // 3단계: 성공/실패 모두 서버 데이터로 동기화
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

```jsx
function TodoItem({ todo }) {
  const toggleMutation = useTodoToggle();

  return (
    <div>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => toggleMutation.mutate({
          id: todo.id,
          completed: !todo.completed,
        })}
      />
      <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
        {todo.title}
      </span>
    </div>
  );
}
```

체크박스를 누르는 순간 UI가 바뀝니다. 서버 응답을 기다리지 않습니다.

## 흐름 정리

```
사용자가 체크박스 클릭
  ↓
onMutate 실행
  - 기존 캐시 백업
  - 캐시 즉시 업데이트 → UI 즉각 반응
  ↓
서버에 API 요청 (백그라운드)
  ↓
성공 → onSettled: invalidateQueries로 서버 데이터로 확정
실패 → onError: 백업 데이터로 롤백 → UI 원래대로
```

## 목록에 새 항목 추가하는 낙관적 업데이트

```jsx
function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTodo,

    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const previousTodos = queryClient.getQueryData(['todos']);

      // 임시 ID로 새 항목을 목록에 추가
      queryClient.setQueryData(['todos'], (old) => [
        ...old,
        { id: `temp-${Date.now()}`, ...newTodo, isOptimistic: true },
      ]);

      return { previousTodos };
    },

    onError: (error, variables, context) => {
      // 실패 시 롤백
      queryClient.setQueryData(['todos'], context.previousTodos);
    },

    onSettled: () => {
      // 서버 응답으로 임시 항목을 실제 데이터로 교체
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

## 언제 낙관적 업데이트를 써야 할까?

**적합한 경우**
- 성공 확률이 높은 단순한 업데이트 (좋아요, 체크박스, 삭제)
- 네트워크 지연이 UX에 크게 영향을 주는 경우
- 롤백 로직 구현이 복잡하지 않은 경우

**적합하지 않은 경우**
- 서버 검증이 중요한 경우 (결제, 권한 변경)
- 실패 시 롤백이 복잡하고 혼란스러운 경우
- 서버 응답 데이터가 클라이언트에서 예측 불가능한 경우

## 정리

낙관적 업데이트 구현의 세 단계:

| 단계 | 콜백 | 역할 |
|------|------|------|
| 준비 | `onMutate` | 기존 캐시 백업, 캐시 즉시 업데이트 |
| 실패 처리 | `onError` | 백업 데이터로 롤백 |
| 동기화 | `onSettled` | `invalidateQueries`로 서버와 최종 동기화 |

항상 `onSettled`에서 `invalidateQueries`를 호출해 서버 데이터가 최종 상태가 되도록 보장하세요.
