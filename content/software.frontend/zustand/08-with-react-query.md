---
title: "[Zustand 시리즈] 8. Zustand + React Query: 역할 분리와 조합"
author: oscar.rs
date: 2026-03-22
tags: ["react", "zustand", "react-query", "상태관리", "조합패턴"]
---

# Zustand + React Query: 역할 분리와 조합

Zustand와 React Query는 경쟁 관계가 아닙니다. 서로 다른 종류의 상태를 잘 처리합니다. 둘을 함께 쓰는 것이 현대 React 앱의 일반적인 패턴입니다.

## 역할 분리

```
클라이언트 상태 → Zustand
서버 상태      → React Query
```

| 상태 종류 | 예시 | 도구 |
|---------|------|------|
| **클라이언트 상태** | 로그인한 사용자 정보, 장바구니, 모달 열림 여부, 선택된 탭, 테마 | **Zustand** |
| **서버 상태** | 게시글 목록, 상품 정보, 댓글, 검색 결과 | **React Query** |

## 안티패턴: React Query 데이터를 Zustand에 복사

```jsx
// 나쁜 예: 서버 데이터를 Zustand에 동기화
const usePostStore = create((set) => ({
  posts: [],
  setPosts: (posts) => set({ posts }),
}));

function PostList() {
  const setPosts = usePostStore((s) => s.setPosts);

  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
    onSuccess: (data) => setPosts(data), // ← 이렇게 하지 마세요
  });
}
```

서버 데이터를 Zustand에 복사하면 두 곳에 같은 데이터가 생겨 동기화 문제가 발생합니다. React Query의 캐싱 이점도 사라집니다.

## 올바른 분리 예시: 쇼핑몰

```jsx
// 서버 상태 → React Query
function useProducts(category) {
  return useQuery({
    queryKey: ['products', category],
    queryFn: () => api.getProducts(category),
  });
}

// 클라이언트 상태 → Zustand
const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        const existing = get().items.find(i => i.id === product.id);
        if (existing) {
          set((s) => ({
            items: s.items.map(i =>
              i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          }));
        } else {
          set((s) => ({ items: [...s.items, { ...product, quantity: 1 }] }));
        }
      },

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter(i => i.id !== id) })),

      clearCart: () => set({ items: [] }),
    }),
    { name: 'cart' }
  )
);

// 컴포넌트: 두 가지를 자연스럽게 조합
function ProductCard({ product }) {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <div>
      <h3>{product.name}</h3>
      <p>{product.price}원</p>
      <button onClick={() => addItem(product)}>장바구니 추가</button>
    </div>
  );
}

function ProductListPage({ category }) {
  const { data: products, isLoading } = useProducts(category); // React Query
  const cartItemCount = useCartStore((s) => s.items.length);   // Zustand

  if (isLoading) return <Spinner />;
  return (
    <div>
      <p>장바구니: {cartItemCount}개</p>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
```

## 뮤테이션 후 Zustand 상태 업데이트

서버 데이터 변경이 클라이언트 상태에 영향을 줄 때입니다.

```jsx
function useOrder() {
  const clearCart = useCartStore((s) => s.clearCart);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (orderData) => api.createOrder(orderData),
    onSuccess: (order) => {
      clearCart();                                          // Zustand 상태 초기화
      queryClient.invalidateQueries({ queryKey: ['orders'] }); // React Query 캐시 무효화
      navigate(`/orders/${order.id}`);
    },
  });
}
```

주문 완료 시:
1. 장바구니(Zustand) 비우기
2. 주문 목록(React Query) 갱신

## 인증 상태와 서버 데이터 연동

```jsx
// 인증 상태 → Zustand (클라이언트 상태)
const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      logout: () => set({ token: null }),
    }),
    { name: 'auth', partialize: (s) => ({ token: s.token }) }
  )
);

// API 클라이언트: Zustand에서 token 읽기
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token; // 컴포넌트 외부에서 접근
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 서버 데이터 → React Query (token이 있을 때만 fetch)
function useMe() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/me').then(r => r.data),
    enabled: !!token, // token이 있을 때만 실행
  });
}

// 로그아웃 시 React Query 캐시도 정리
function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  return () => {
    logout();                     // Zustand token 제거
    queryClient.clear();          // 모든 쿼리 캐시 삭제 (다른 사용자 데이터 노출 방지)
  };
}
```

## 체크리스트: 어느 도구를 쓸지 판단

```
이 상태는 서버에서 오는가?
  ├── YES → React Query
  └── NO → 다음 질문

여러 컴포넌트에서 공유해야 하는가?
  ├── YES → Zustand
  └── NO → useState

페이지 새로고침 후에도 유지해야 하는가?
  ├── YES → Zustand + persist
  └── NO → useState 또는 Zustand
```

## 정리

| | Zustand | React Query |
|--|---------|------------|
| **담당** | 클라이언트 상태 | 서버 상태 |
| **예시** | 장바구니, 모달, 테마, 인증 토큰 | API 데이터, 캐싱, 동기화 |
| **함께 쓸 때** | 클라이언트 상태 관리 | 서버 데이터 fetching |

Zustand와 React Query는 서로 다른 문제를 해결합니다. 두 도구의 역할을 명확히 나누면 각각의 장점을 최대로 활용할 수 있습니다.
