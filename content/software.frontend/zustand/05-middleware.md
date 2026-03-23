---
title: "[Zustand 시리즈] 5. 미들웨어: devtools, persist, immer"
author: oscar.rs
date: 2026-03-22
tags: ["react", "zustand", "middleware", "devtools", "persist", "immer"]
---

# 미들웨어: devtools, persist, immer

Zustand는 미들웨어로 기능을 확장할 수 있습니다. 가장 많이 쓰이는 세 가지를 살펴봅니다.

## devtools: Redux DevTools 연결

브라우저의 Redux DevTools 확장을 통해 상태 변화를 추적할 수 있습니다.

```jsx
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useCountStore = create(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }), false, 'increment'),
      decrement: () => set((state) => ({ count: state.count - 1 }), false, 'decrement'),
    }),
    { name: 'CountStore' } // DevTools에서 표시될 스토어 이름
  )
);
```

`set`의 세 번째 인자로 액션 이름을 지정하면 `DevTools` 에서 어떤 액션이 상태를 바꿨는지 추적할 수 있습니다.

```
DevTools에서 보이는 것:
▶ increment   { count: 0 → 1 }
▶ increment   { count: 1 → 2 }
▶ decrement   { count: 2 → 1 }
```

## persist: 상태 영속화

페이지를 새로고침해도 상태를 유지하고 싶을 때 사용합니다. 기본적으로 `localStorage`에 저장합니다.

```jsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useSettingsStore = create(
  persist(
    (set) => ({
      theme: 'light',
      language: 'ko',
      fontSize: 14,

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'user-settings', // localStorage 키 이름
    }
  )
);
```

앱을 새로고침하면 `localStorage`에서 이전 상태를 복원합니다.

### 일부 상태만 저장하기

민감한 정보나 임시 상태는 저장에서 제외할 수 있습니다.

```jsx
const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false, // 저장 안 함
      error: null,      // 저장 안 함

      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'auth-store',
      // 저장할 상태만 지정
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
);
```

### sessionStorage 사용

```jsx
persist(
  (set) => ({ ... }),
  {
    name: 'session-store',
    storage: {
      getItem: (name) => sessionStorage.getItem(name),
      setItem: (name, value) => sessionStorage.setItem(name, value),
      removeItem: (name) => sessionStorage.removeItem(name),
    },
  }
)
```

## immer: 불변성 없이 직접 수정

중첩된 상태를 업데이트할 때 spread 연산자를 여러 번 쓰는 것이 불편하다면, Immer 미들웨어를 사용합니다. **마치 직접 수정하는 것처럼** 쓰면 Immer가 알아서 불변 업데이트를 처리합니다.

```bash
npm install immer
```

```jsx
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const useUserStore = create(
  immer((set) => ({
    user: {
      name: '홍길동',
      address: {
        city: '서울',
        district: '강남구',
      },
    },
    todos: [],

    // Immer 없이: spread 연산자 중첩
    // setCity: (city) => set((state) => ({
    //   user: { ...state.user, address: { ...state.user.address, city } }
    // })),

    // Immer 있음: 직접 수정처럼 작성
    setCity: (city) =>
      set((state) => {
        state.user.address.city = city; // 직접 수정!
      }),

    addTodo: (text) =>
      set((state) => {
        state.todos.push({ id: Date.now(), text, completed: false }); // push 사용!
      }),

    toggleTodo: (id) =>
      set((state) => {
        const todo = state.todos.find(t => t.id === id);
        if (todo) todo.completed = !todo.completed; // 직접 수정!
      }),
  }))
);
```

## 미들웨어 조합

여러 미들웨어를 함께 사용할 수 있습니다.

```jsx
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

const useStore = create(
  devtools(
    persist(
      immer((set) => ({
        items: [],
        addItem: (item) =>
          set((state) => {
            state.items.push(item);
          }),
      })),
      { name: 'my-store' }
    ),
    { name: 'MyStore' }
  )
);
```

순서 권장: `devtools(persist(immer(...)))`

## TypeScript와 함께

```tsx
interface BearState {
  count: number;
  increment: () => void;
}

const useBearStore = create<BearState>()(
  devtools(
    persist(
      (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      }),
      { name: 'bear-store' }
    )
  )
);
```

TypeScript 를 쓸 때는 `create<Type>()(...)` 형태로 타입을 명시합니다. 미들웨어가 있으면 `create<Type>()` 뒤에 바로 미들웨어를 감쌉니다.

## 정리

| 미들웨어 | 역할 | 주요 옵션 |
|---------|------|---------|
| `devtools` | Redux DevTools 연결 | `name`: 스토어 이름 |
| `persist` | localStorage 영속화 | `name`: 키, `partialize`: 저장할 것 |
| `immer` | 직접 수정 문법 허용 | 없음 |

세 가지 모두 실무에서 자주 쓰입니다. `devtools` 는 개발 편의를 위해, `persist` 는 새로고침 후 상태 복원을, `immer` 는 중첩 상태 업데이트를 간결하게 만들어줍니다.
