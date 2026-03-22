---
title: "[Zustand 시리즈] 6. 슬라이스 패턴: 큰 스토어를 모듈로 나누기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "zustand", "slice-pattern", "스토어분리", "모듈화"]
---

# 슬라이스 패턴: 큰 스토어를 모듈로 나누기

앱이 커지면 스토어에 상태가 많아집니다. 모든 것을 하나의 `create` 안에 넣으면 파일이 거대해지고 관리하기 어려워집니다. **슬라이스 패턴**은 스토어를 기능별로 조각(slice)내어 분리하는 방법입니다.

## 문제: 하나의 거대한 스토어

```jsx
// store.js - 모든 것이 한 곳에
const useStore = create((set, get) => ({
  // 인증
  user: null,
  token: null,
  login: async (credentials) => { ... },
  logout: () => { ... },

  // 장바구니
  cartItems: [],
  addToCart: (item) => { ... },
  removeFromCart: (id) => { ... },

  // UI 상태
  isModalOpen: false,
  theme: 'light',
  openModal: () => { ... },
  closeModal: () => { ... },

  // 알림
  notifications: [],
  addNotification: (msg) => { ... },
  removeNotification: (id) => { ... },

  // ... 더 추가될수록 복잡해짐
}));
```

## 슬라이스 패턴

각 기능을 별도 파일의 슬라이스 함수로 만들고, 하나의 스토어에서 합칩니다.

### 슬라이스 정의

```jsx
// store/authSlice.js
export const createAuthSlice = (set) => ({
  user: null,
  token: null,

  login: async (credentials) => {
    const { user, token } = await api.login(credentials);
    set({ user, token });
  },

  logout: () => set({ user: null, token: null }),

  isAuthenticated: () => !!get().token, // get은 아래에서 전달
});
```

```jsx
// store/cartSlice.js
export const createCartSlice = (set, get) => ({
  cartItems: [],

  addToCart: (item) =>
    set((state) => ({
      cartItems: [...state.cartItems, { ...item, quantity: 1 }],
    })),

  removeFromCart: (id) =>
    set((state) => ({
      cartItems: state.cartItems.filter(item => item.id !== id),
    })),

  getCartTotal: () =>
    get().cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
});
```

```jsx
// store/uiSlice.js
export const createUiSlice = (set) => ({
  isModalOpen: false,
  theme: 'light',

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  setTheme: (theme) => set({ theme }),
});
```

### 슬라이스 합치기

```jsx
// store/index.js
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createAuthSlice } from './authSlice';
import { createCartSlice } from './cartSlice';
import { createUiSlice } from './uiSlice';

const useStore = create(
  devtools(
    (set, get) => ({
      ...createAuthSlice(set, get),
      ...createCartSlice(set, get),
      ...createUiSlice(set, get),
    }),
    { name: 'AppStore' }
  )
);

export default useStore;
```

## 기능별로 스토어 완전히 분리하기

슬라이스 패턴 대신 스토어 자체를 분리하는 방법도 있습니다.

```jsx
// store/authStore.js
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (credentials) => { ... },
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'auth' }
  )
);

// store/cartStore.js
export const useCartStore = create((set, get) => ({
  items: [],
  addItem: (item) => { ... },
  removeItem: (id) => { ... },
}));

// store/uiStore.js
export const useUiStore = create((set) => ({
  isModalOpen: false,
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
}));
```

### 두 방식 비교

| | 슬라이스 합치기 | 스토어 분리 |
|--|-------------|----------|
| 상태 접근 | 하나의 훅으로 모든 상태 | 기능별 다른 훅 사용 |
| 슬라이스 간 상태 참조 | `get()`으로 가능 | 직접 import 필요 |
| `persist` 적용 | 전체 또는 일부 선택 | 스토어별 독립 설정 |
| 파일 구조 | 하나의 진입점 | 명확한 기능 분리 |

슬라이스 간에 서로 상태를 참조해야 한다면 합치는 방식이 편하고, 완전히 독립적인 기능이라면 분리하는 방식이 더 명확합니다.

## 슬라이스 간 상태 참조

합치는 방식에서 슬라이스끼리 서로 참조가 필요할 때는 `get()`을 활용합니다.

```jsx
// cartSlice.js - 인증 상태 참조
export const createCartSlice = (set, get) => ({
  cartItems: [],

  checkout: async () => {
    const { token } = get(); // authSlice의 token 참조
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }
    await api.checkout(get().cartItems, token);
    set({ cartItems: [] });
  },
});
```

## 파일 구조 예시

```
src/
  store/
    index.js          ← 스토어 합치는 진입점
    authSlice.js      ← 인증 관련 상태/액션
    cartSlice.js      ← 장바구니 관련 상태/액션
    uiSlice.js        ← UI 상태/액션
    selectors.js      ← 공통 셀렉터 함수
```

```jsx
// store/selectors.js
export const selectUser = (state) => state.user;
export const selectCartTotal = (state) =>
  state.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
export const selectIsAdmin = (state) => state.user?.role === 'admin';
```

## 정리

- 스토어가 커지면 슬라이스 패턴으로 기능별로 분리합니다
- 슬라이스를 합치는 방법과 스토어를 완전히 분리하는 방법 중 선택합니다
- 슬라이스끼리 상태를 공유해야 한다면 하나로 합치는 것이 편합니다
- 셀렉터도 별도 파일로 분리하면 재사용하기 좋습니다
