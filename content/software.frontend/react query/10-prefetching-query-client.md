---
title: "[React Query 시리즈] 10. Prefetching & QueryClient: 캐시를 직접 다루기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "react-query", "prefetching", "QueryClient", "캐시"]
---

# Prefetching & QueryClient: 캐시를 직접 다루기

React Query의 모든 캐시는 `QueryClient`가 관리합니다. `QueryClient`를 직접 다루면 컴포넌트 외부에서도 캐시를 읽고 쓰거나, 데이터를 미리 가져올 수 있습니다.

## QueryClient 가져오기

```jsx
import { useQueryClient } from '@tanstack/react-query';

function MyComponent() {
  const queryClient = useQueryClient();
  // 이제 queryClient로 캐시를 직접 조작할 수 있음
}
```

## Prefetching: 데이터를 미리 가져오기

사용자가 어떤 동작을 하기 전에 미리 데이터를 가져와 캐시에 저장해두는 것입니다. 실제로 그 데이터가 필요해지는 순간 이미 준비되어 있어 즉각 반응합니다.

### 마우스 호버 시 미리 가져오기

```jsx
function TodoList() {
  const queryClient = useQueryClient();
  const { data: todos } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos });

  function prefetchTodoDetail(id) {
    queryClient.prefetchQuery({
      queryKey: ['todo', id],
      queryFn: () => fetchTodo(id),
      staleTime: 1000 * 60, // 1분간 fresh
    });
  }

  return (
    <ul>
      {todos?.map(todo => (
        <li
          key={todo.id}
          onMouseEnter={() => prefetchTodoDetail(todo.id)} // 마우스 올리면 미리 fetch
        >
          <Link to={`/todos/${todo.id}`}>{todo.title}</Link>
        </li>
      ))}
    </ul>
  );
}
```

링크에 마우스를 올리는 순간 상세 데이터를 미리 가져옵니다. 링크를 클릭하면 이미 캐시에 있으므로 즉시 보여집니다.

### 라우트 전환 전 미리 가져오기

```jsx
function UserListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function handleUserClick(userId) {
    // 페이지 이동 전에 미리 가져오기
    await queryClient.prefetchQuery({
      queryKey: ['user', userId],
      queryFn: () => fetchUser(userId),
    });
    navigate(`/users/${userId}`);
  }

  return (
    <ul>
      {users.map(user => (
        <li key={user.id} onClick={() => handleUserClick(user.id)}>
          {user.name}
        </li>
      ))}
    </ul>
  );
}
```

### 서버 사이드에서 미리 가져오기 (Next.js)

```jsx
// Next.js 페이지 컴포넌트
export async function getStaticProps() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  return {
    props: {
      dehydratedState: dehydrate(queryClient), // 캐시를 직렬화해서 전달
    },
  };
}

function PostsPage() {
  // 서버에서 prefetch된 데이터가 이미 캐시에 있음
  const { data } = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });
  // 클라이언트에서 로딩 없이 즉시 표시
  return <PostList posts={data} />;
}
```

## QueryClient 주요 메서드

### getQueryData / setQueryData

```jsx
// 캐시에서 데이터 읽기
const todos = queryClient.getQueryData(['todos']);

// 캐시에 데이터 직접 쓰기
queryClient.setQueryData(['todos'], newTodos);

// 함수형 업데이트
queryClient.setQueryData(['todos'], (old) => [...old, newTodo]);
```

### getQueryState: 쿼리 메타정보 확인

```jsx
const state = queryClient.getQueryState(['todos']);
// state.dataUpdatedAt: 마지막으로 데이터가 갱신된 시간
// state.status: 'pending' | 'error' | 'success'
// state.fetchStatus: 'fetching' | 'idle'

// 마지막 업데이트 이후 얼마나 됐는지 확인
const lastUpdated = Date.now() - state.dataUpdatedAt;
if (lastUpdated > 1000 * 60 * 5) {
  // 5분 이상 지났으면 재fetch
  queryClient.invalidateQueries({ queryKey: ['todos'] });
}
```

### fetchQuery: 컴포넌트 외부에서 fetch

```jsx
// 이벤트 핸들러, 유틸 함수 등 컴포넌트 밖에서 데이터 가져오기
async function loadUserData(userId) {
  const user = await queryClient.fetchQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });
  return user;
}
```

`prefetchQuery`와 달리 결과를 반환합니다. 이미 캐시에 있으면 캐시를 반환하고, 없으면 fetch합니다.

## QueryClient 전역 설정

```jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,           // 기본 1분
      gcTime: 1000 * 60 * 10,         // 기본 10분
      retry: 1,                        // 기본 재시도 1회
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0, // 뮤테이션은 기본적으로 재시도 안 함
    },
  },
  queryCache: new QueryCache({
    // 모든 쿼리 에러를 한 곳에서 처리
    onError: (error, query) => {
      if (error.status === 401) {
        navigate('/login');
      }
    },
  }),
  mutationCache: new MutationCache({
    // 모든 뮤테이션 성공을 한 곳에서 처리
    onSuccess: () => {
      toast.success('저장됐습니다.');
    },
    onError: (error) => {
      toast.error(`오류: ${error.message}`);
    },
  }),
});
```

`QueryCache`와 `MutationCache`의 전역 콜백은 개별 쿼리/뮤테이션 콜백과 함께 동작합니다. 공통 에러 처리(토스트, 로그, 리다이렉트)를 한 곳에서 관리할 수 있습니다.

## React Query DevTools

개발 중에 캐시 상태를 시각적으로 확인할 수 있습니다.

```jsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

DevTools에서 확인할 수 있는 것:
- 현재 캐시에 있는 모든 쿼리와 상태
- 각 쿼리의 데이터, stale 여부, 마지막 업데이트 시간
- 특정 쿼리를 수동으로 무효화/재fetch
- 쿼리 데이터를 직접 수정

## 정리

| 기능 | 메서드 | 사용 시점 |
|------|--------|---------|
| 미리 가져오기 | `prefetchQuery` | 마우스 호버, 라우트 전환 전 |
| 캐시 읽기 | `getQueryData` | 캐시 값 확인이 필요할 때 |
| 캐시 쓰기 | `setQueryData` | 낙관적 업데이트, 서버 응답으로 즉시 반영 |
| 강제 fetch | `fetchQuery` | 컴포넌트 외부에서 데이터 필요 시 |
| 전역 설정 | `QueryClient` 생성 시 | 앱 전체 기본 동작 설정 |

`prefetchQuery`로 사용자 행동을 예측하고 미리 데이터를 준비하면, 페이지 전환이나 데이터 표시가 즉각적으로 이루어져 UX를 크게 개선할 수 있습니다.
