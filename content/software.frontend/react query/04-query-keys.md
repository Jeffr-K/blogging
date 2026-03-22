---
title: "[React Query 시리즈] 4. Query Keys: 캐시를 설계하는 방법"
author: oscar.rs
date: 2026-03-22
tags: ["react", "react-query", "query-keys", "캐싱", "설계"]
---

# Query Keys: 캐시를 설계하는 방법

`queryKey`는 React Query에서 **캐시의 주소**와 같습니다. 같은 키를 가진 쿼리는 같은 캐시를 공유하고, 키가 다르면 완전히 별개의 데이터로 취급됩니다. 키를 어떻게 설계하느냐에 따라 캐시 관리의 편의성이 크게 달라집니다.

## 기본 규칙

queryKey는 항상 **배열**이어야 합니다. 내부 값은 직렬화 가능한 어떤 값이든 됩니다.

```jsx
// 문자열 하나
useQuery({ queryKey: ['todos'], queryFn: ... })

// 여러 값의 조합
useQuery({ queryKey: ['todos', 'completed'], queryFn: ... })

// 객체 포함
useQuery({ queryKey: ['todos', { status: 'active', page: 1 }], queryFn: ... })
```

React Query는 배열 내부를 **깊은 비교(deep equal)**로 비교합니다. `['todos', { page: 1 }]`과 `['todos', { page: 2 }]`는 다른 캐시입니다.

## 동적 키: 변수가 있을 때

queryKey에 변수를 포함하면, 그 변수가 바뀔 때 자동으로 새 요청을 합니다.

```jsx
// userId에 따라 다른 캐시
function UserProfile({ userId }) {
  const { data } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });
}

// user/1, user/2, user/3 각각 별도 캐시
```

```jsx
// 필터, 정렬, 페이지도 키에 포함
function TodoList({ filter, sort, page }) {
  const { data } = useQuery({
    queryKey: ['todos', { filter, sort, page }],
    queryFn: () => fetchTodos({ filter, sort, page }),
  });
}
```

**중요**: queryFn 안에서 사용하는 모든 변수는 queryKey에 포함되어야 합니다. 그래야 해당 값이 바뀔 때 React Query가 새 요청을 합니다.

## 계층적 키 설계

관련된 쿼리들을 계층적으로 구성하면, 관련 캐시를 한 번에 무효화할 수 있습니다.

```jsx
// 계층 구조
['todos']                      // 모든 할 일
['todos', 'list']              // 목록
['todos', 'list', { filter }]  // 필터링된 목록
['todos', 'detail', id]        // 특정 할 일 상세
```

```jsx
// 'todos' 관련 모든 캐시 무효화
queryClient.invalidateQueries({ queryKey: ['todos'] });

// 'todos', 'list' 하위 캐시만 무효화
queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });

// 특정 할 일 하나만 무효화
queryClient.invalidateQueries({ queryKey: ['todos', 'detail', 1] });
```

새 할 일을 만들면 목록만 무효화하고 상세는 그대로 두거나, 삭제 시 목록과 해당 상세 모두 무효화하는 식의 세밀한 제어가 가능합니다.

## Query Key Factory 패턴

쿼리 키를 여러 파일에서 문자열로 직접 쓰면 오타가 발생하기 쉽고, 변경 시 모든 곳을 수정해야 합니다. 키를 한 곳에서 관리하는 패턴이 권장됩니다.

```jsx
// todoKeys.js
const todoKeys = {
  all: ['todos'],                              // 모든 todo 관련
  lists: () => [...todoKeys.all, 'list'],      // 목록들
  list: (filter) => [...todoKeys.lists(), { filter }], // 특정 필터 목록
  details: () => [...todoKeys.all, 'detail'], // 상세들
  detail: (id) => [...todoKeys.details(), id], // 특정 상세
};

// 사용
useQuery({ queryKey: todoKeys.list({ status: 'active' }), queryFn: ... });

// 무효화
queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
// → ['todos', 'list'] 포함하는 모든 캐시 무효화
```

```jsx
// 실제 사용 예시
function TodoList({ filter }) {
  return useQuery({
    queryKey: todoKeys.list(filter),
    queryFn: () => fetchTodos(filter),
  });
}

function TodoDetail({ id }) {
  return useQuery({
    queryKey: todoKeys.detail(id),
    queryFn: () => fetchTodo(id),
  });
}

function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      // todoKeys를 사용하므로 문자열 오타 걱정 없음
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
    },
  });
}
```

## 잘못된 키 설계 예시

```jsx
// 나쁜 예 1: 변수를 키에 포함하지 않음
function UserPosts({ userId }) {
  const { data } = useQuery({
    queryKey: ['posts'],        // userId가 바뀌어도 같은 캐시 반환!
    queryFn: () => fetchPostsByUser(userId),
  });
}

// 나쁜 예 2: 매번 새 객체 생성 (불필요한 리렌더링)
function App() {
  const { data } = useQuery({
    queryKey: ['user', { id: userId }], // 렌더링마다 새 객체지만, 내부 비교이므로 OK
    // React Query는 deep equal로 비교하므로 실제로는 괜찮음
  });
}
```

## 정리

| 원칙 | 이유 |
|------|------|
| queryFn에서 쓰는 변수는 모두 key에 포함 | 변수 변경 시 자동 재요청 |
| 계층적 구조 설계 | 관련 쿼리를 한 번에 무효화 |
| Key Factory로 중앙 관리 | 오타 방지, 변경 용이 |

queryKey를 잘 설계하는 것이 React Query를 잘 쓰는 핵심입니다. 처음부터 계층적 구조와 Factory 패턴을 도입하면 나중에 캐시 관리가 훨씬 편해집니다.
