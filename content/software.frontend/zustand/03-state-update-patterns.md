---
title: "[Zustand 시리즈] 3. 상태 업데이트 패턴: 객체, 배열, 중첩 상태"
author: oscar.rs
date: 2026-03-22
tags: ["react", "zustand", "불변성", "상태업데이트", "immer"]
---

# 상태 업데이트 패턴: 객체, 배열, 중첩 상태

Zustand의 `set`은 상태를 **병합**합니다. 하지만 중첩된 객체나 배열은 직접 수정하지 않고 새로운 값을 만들어서 전달해야 합니다. React의 불변성 규칙과 동일합니다.

## 기본: 평평한(flat) 상태

평평한 상태는 간단합니다.

```jsx
const useStore = create((set) => ({
  count: 0,
  name: '',
  isLoading: false,

  setName: (name) => set({ name }),
  setLoading: (isLoading) => set({ isLoading }),
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

`set`이 알아서 병합하므로 나머지 상태는 건드리지 않아도 됩니다.

## 중첩 객체 업데이트

중첩된 객체는 spread 연산자로 복사해서 업데이트합니다.

```jsx
const useUserStore = create((set) => ({
  user: {
    name: '홍길동',
    address: {
      city: '서울',
      district: '강남구',
    },
  },

  // 얕은 중첩
  setUserName: (name) =>
    set((state) => ({
      user: { ...state.user, name },
    })),

  // 깊은 중첩
  setCity: (city) =>
    set((state) => ({
      user: {
        ...state.user,
        address: { ...state.user.address, city },
      },
    })),
}));
```

중첩이 깊어질수록 코드가 장황해집니다. 이 문제는 Immer 미들웨어로 해결합니다(05 아티클).

## 배열 업데이트

배열은 직접 수정하지 않고 새 배열을 만들어서 전달합니다.

```jsx
const useTodoStore = create((set) => ({
  todos: [],

  // 추가
  addTodo: (text) =>
    set((state) => ({
      todos: [
        ...state.todos,
        { id: Date.now(), text, completed: false },
      ],
    })),

  // 삭제
  removeTodo: (id) =>
    set((state) => ({
      todos: state.todos.filter(todo => todo.id !== id),
    })),

  // 수정
  toggleTodo: (id) =>
    set((state) => ({
      todos: state.todos.map(todo =>
        todo.id === id
          ? { ...todo, completed: !todo.completed }
          : todo
      ),
    })),

  // 전체 삭제
  clearCompleted: () =>
    set((state) => ({
      todos: state.todos.filter(todo => !todo.completed),
    })),
}));
```

## Map, Set 같은 특수 자료구조

Map이나 Set도 불변하게 업데이트해야 합니다.

```jsx
const useStore = create((set) => ({
  selected: new Set(),

  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selected); // 복사
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selected: next };
    }),
}));
```

## 액션을 스토어 밖에서 정의하기

스토어가 커지면 액션을 밖에서 정의하는 패턴도 있습니다.

```jsx
const useStore = create(() => ({
  todos: [],
}));

// 액션을 스토어 밖에서 정의
const addTodo = (text) =>
  useStore.setState((state) => ({
    todos: [...state.todos, { id: Date.now(), text, completed: false }],
  }));

const removeTodo = (id) =>
  useStore.setState((state) => ({
    todos: state.todos.filter(todo => todo.id !== id),
  }));

// 사용
function TodoForm() {
  return <button onClick={() => addTodo('새 할 일')}>추가</button>;
}
```

스토어가 초기 상태만 담고, 액션 로직은 별도 파일에 관리하면 코드 분리가 깔끔해집니다.

## 여러 상태를 한 번에 업데이트

여러 상태를 동시에 바꾸는 것도 하나의 `set` 호출로 할 수 있습니다. 여러 번 `set`을 호출하는 것보다 한 번에 처리하는 것이 리렌더링 횟수를 줄입니다.

```jsx
const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null }); // 로딩 시작

    try {
      const { user, token } = await api.login(credentials);
      set({ user, token, isLoading: false }); // 성공: 한 번에 업데이트
    } catch (error) {
      set({ error: error.message, isLoading: false }); // 실패: 한 번에 업데이트
    }
  },

  logout: () => set({ user: null, token: null }), // 여러 필드 초기화
}));
```

## 정리

| 상태 형태 | 업데이트 방법 |
|----------|------------|
| 단순 값 | `set({ key: value })` |
| 이전 상태 기반 | `set(state => ({ key: newValue }))` |
| 중첩 객체 | spread 연산자로 각 단계 복사 |
| 배열 추가 | `[...state.arr, newItem]` |
| 배열 삭제 | `state.arr.filter(...)` |
| 배열 수정 | `state.arr.map(...)` |
| 중첩이 깊을 때 | Immer 미들웨어 사용 권장 |
