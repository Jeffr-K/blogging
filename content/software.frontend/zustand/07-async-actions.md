---
title: "[Zustand 시리즈] 7. 비동기 액션: API 호출과 로딩/에러 상태 관리"
author: oscar.rs
date: 2026-03-22
tags: ["react", "zustand", "async", "비동기", "로딩", "에러처리"]
---

# 비동기 액션: API 호출과 로딩/에러 상태 관리

`Zustand` 는 `Redux` 와 달리 별도의 미들웨어 없이 스토어 안에 바로 비동기 함수를 정의할 수 있습니다. 간단하지만 패턴을 잡아두면 일관되게 사용할 수 있습니다.

## 기본 비동기 액션

```jsx
const useUserStore = create((set) => ({
  user: null,
  isLoading: false,
  error: null,

  fetchUser: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const user = await api.getUser(id);
      set({ user, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
}));
```

비동기 함수를 그냥 `async`로 정의하면 됩니다. Redux-Thunk 같은 추가 설정이 필요 없습니다.

## 상태 패턴: 로딩/에러 관리

API 호출이 여러 개라면 각각 로딩/에러 상태를 관리하는 것이 좋습니다.

```jsx
const useStore = create((set) => ({
  // 데이터
  users: [],
  posts: [],

  // 각 API별 로딩/에러 상태
  usersLoading: false,
  usersError: null,
  postsLoading: false,
  postsError: null,

  fetchUsers: async () => {
    set({ usersLoading: true, usersError: null });
    try {
      const users = await api.getUsers();
      set({ users, usersLoading: false });
    } catch (error) {
      set({ usersError: error.message, usersLoading: false });
    }
  },

  fetchPosts: async () => {
    set({ postsLoading: true, postsError: null });
    try {
      const posts = await api.getPosts();
      set({ posts, postsLoading: false });
    } catch (error) {
      set({ postsError: error.message, postsLoading: false });
    }
  },
}));
```

## 더 나은 패턴: 상태를 객체로 묶기

로딩/에러/데이터를 하나의 객체로 묶으면 관련 상태가 한 곳에 모입니다.

```jsx
const createAsyncState = (initialData = null) => ({
  data: initialData,
  isLoading: false,
  error: null,
});

const useStore = create((set) => ({
  users: createAsyncState([]),
  posts: createAsyncState([]),

  fetchUsers: async () => {
    set((state) => ({ users: { ...state.users, isLoading: true, error: null } }));
    try {
      const data = await api.getUsers();
      set({ users: { data, isLoading: false, error: null } });
    } catch (error) {
      set((state) => ({
        users: { ...state.users, isLoading: false, error: error.message },
      }));
    }
  },
}));

// 사용
function UserList() {
  const { data: users, isLoading, error } = useStore((s) => s.users);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error} />;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

## 액션 취소 (AbortController)

컴포넌트가 언마운트된 후 API 응답이 오면 에러가 발생할 수 있습니다. AbortController로 요청을 취소합니다.

```jsx
const useSearchStore = create((set, get) => ({
  results: [],
  isLoading: false,
  _abortController: null,

  search: async (query) => {
    // 이전 요청 취소
    get()._abortController?.abort();
    const controller = new AbortController();
    set({ isLoading: true, _abortController: controller });

    try {
      const results = await api.search(query, { signal: controller.signal });
      set({ results, isLoading: false });
    } catch (error) {
      if (error.name === 'AbortError') return; // 취소된 요청은 무시
      set({ isLoading: false });
    }
  },
}));
```

## 낙관적 업데이트 패턴

실패 시 롤백할 이전 상태를 저장해둡니다.

```jsx
const useTodoStore = create((set, get) => ({
  todos: [],

  toggleTodo: async (id) => {
    const previousTodos = get().todos; // 롤백용 백업

    // 즉시 UI 업데이트 (낙관적)
    set((state) => ({
      todos: state.todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      ),
    }));

    try {
      await api.toggleTodo(id);
    } catch (error) {
      // 실패 시 롤백
      set({ todos: previousTodos });
      alert('업데이트에 실패했습니다.');
    }
  },
}));
```

## 순차 실행과 병렬 실행

```jsx
const useStore = create((set) => ({
  fetchDashboard: async () => {
    set({ isLoading: true });

    // 병렬 실행 (빠름)
    const [users, stats] = await Promise.all([
      api.getUsers(),
      api.getStats(),
    ]);

    set({ users, stats, isLoading: false });
  },

  fetchUserWithPosts: async (userId) => {
    // 순차 실행 (user를 먼저 가져와야 posts를 가져올 수 있을 때)
    const user = await api.getUser(userId);
    const posts = await api.getPostsByUser(user.id);
    set({ user, posts });
  },
}));
```

## 비동기 액션 재사용

같은 비동기 로직을 여러 액션에서 공유할 때는 헬퍼 함수로 분리합니다.

```jsx
// API 호출과 에러 처리를 래핑하는 헬퍼
const withLoading = async (set, key, asyncFn) => {
  set({ [`${key}Loading`]: true, [`${key}Error`]: null });
  try {
    const result = await asyncFn();
    set({ [key]: result, [`${key}Loading`]: false });
    return result;
  } catch (error) {
    set({ [`${key}Error`]: error.message, [`${key}Loading`]: false });
    throw error;
  }
};

const useStore = create((set) => ({
  users: [],
  usersLoading: false,
  usersError: null,

  fetchUsers: () => withLoading(set, 'users', api.getUsers),
}));
```

## Zustand vs React Query: 비동기 상태를 어디서?

`Zustand` 에서도 비동기 상태를 관리할 수 있지만, **서버 데이터 fetching 에는 React Query가 더 적합**합니다.

| | Zustand | React Query |
|--|---------|------------|
| 자동 캐싱 | ❌ 직접 구현 | ✅ |
| 백그라운드 갱신 | ❌ 직접 구현 | ✅ |
| 로딩/에러 상태 | ❌ 직접 관리 | ✅ |
| 재시도 | ❌ 직접 구현 | ✅ |
| 적합한 용도 | 클라이언트 상태, 전역 UI 상태 | 서버 데이터 |

실무에서는 **Zustand는 클라이언트 상태**, **React Query는 서버 상태** 담당으로 역할을 나눕니다.

## 정리

- Zustand 액션에서 `async/await`을 그냥 쓸 수 있습니다
- 로딩/에러 상태를 액션 안에서 함께 관리합니다
- 서버 데이터 `fetching` 이 주 목적이라면 `React Query` 와의 역할 분리를 고려하세요
