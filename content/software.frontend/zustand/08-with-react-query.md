---
title: "[Zustand 시리즈] 8. Zustand + React Query: 역할 분리와 조합"
author: oscar.rs
date: 2026-03-22
tags: ["react", "zustand", "react-query", "상태관리", "조합패턴"]
---

# Zustand + React Query: 역할 분리와 조합

`Zustand` 와 `React Query` 는 경쟁 관계가 아닙니다. 서로 다른 종류의 상태를 잘 처리합니다. 둘을 함께 쓰는 것이 현대 React 앱의 일반적인 패턴입니다.

## 역할 분리

```
클라이언트 상태 → Zustand
서버 상태      → React Query
```

| 상태 종류 | 예시 | 도구 |
|---------|------|------|
| **클라이언트 상태** | 로그인한 사용자 정보, 장바구니, 모달 열림 여부, 선택된 탭, 테마 | **Zustand** |
| **서버 상태** | 게시글 목록, 상품 정보, 댓글, 검색 결과 | **React Query** |

## 안티패턴: React Query 데이터를 Zustand 에 복사

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
    onSuccess: (data) => setPosts(data), // [!] 이렇게 하지 마세요
  });
}
```

서버 데이터를 `Zustand` 에 복사하면 두 곳에 같은 데이터가 생겨 동기화 문제가 발생합니다. `React Query` 의 캐싱 이점도 사라집니다.

## 올바른 분리 예시: 멀티스텝 폼

회원가입이나 결제 같은 여러 단계로 이루어진 폼은 Zustand와 React Query를 함께 쓰기에 적합한 패턴입니다. 사용자가 입력 중인 임시 데이터는 클라이언트 상태이고, 최종 제출은 서버로 보내야 합니다.

```jsx
// 클라이언트 상태 → Zustand (각 스텝 데이터 + 현재 스텝 위치)
const useSignupStore = create((set, get) => ({
  step: 1,
  formData: {
    // 스텝 1: 기본 정보
    email: '',
    password: '',
    // 스텝 2: 프로필
    name: '',
    bio: '',
    // 스텝 3: 약관
    agreedToTerms: false,
    agreedToMarketing: false,
  },

  setStep: (step) => set({ step }),
  updateFormData: (data) =>
    set((s) => ({ formData: { ...s.formData, ...data } })),
  reset: () => set({ step: 1, formData: {} }),
}));

// 서버 제출 → React Query (useMutation)
function useSignup() {
  const reset = useSignupStore((s) => s.reset);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData) => api.post('/users', formData),
    onSuccess: (user) => {
      reset();                                          // 폼 상태 초기화 (Zustand)
      queryClient.setQueryData(['me'], user);           // 로그인 사용자 데이터 세팅 (React Query)
      navigate('/dashboard');
    },
  });
}

// 스텝 컴포넌트들
function Step1() {
  const { formData, updateFormData, setStep } = useSignupStore();

  return (
    <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
      <input
        value={formData.email}
        onChange={(e) => updateFormData({ email: e.target.value })}
        placeholder="이메일"
      />
      <input
        type="password"
        value={formData.password}
        onChange={(e) => updateFormData({ password: e.target.value })}
        placeholder="비밀번호"
      />
      <button type="submit">다음</button>
    </form>
  );
}

function Step3() {
  const formData = useSignupStore((s) => s.formData);
  const setStep = useSignupStore((s) => s.setStep);
  const { mutate: signup, isPending, error } = useSignup();

  return (
    <form onSubmit={(e) => { e.preventDefault(); signup(formData); }}>
      <label>
        <input
          type="checkbox"
          checked={formData.agreedToTerms}
          onChange={(e) => useSignupStore.getState().updateFormData({ agreedToTerms: e.target.checked })}
        />
        이용약관 동의 (필수)
      </label>
      {error && <p>회원가입 실패: {error.message}</p>}
      <button type="button" onClick={() => setStep(2)}>이전</button>
      <button type="submit" disabled={isPending || !formData.agreedToTerms}>
        {isPending ? '처리 중...' : '가입하기'}
      </button>
    </form>
  );
}

// 스텝 라우터
function SignupPage() {
  const step = useSignupStore((s) => s.step); // Zustand: 현재 스텝
  return (
    <div>
      <ProgressBar current={step} total={3} />
      {step === 1 && <Step1 />}
      {step === 2 && <Step2 />}
      {step === 3 && <Step3 />}
    </div>
  );
}
```

여기서 각 도구의 역할이 명확합니다.
- **Zustand**: 스텝 간 이동과 임시 입력 데이터 — 서버에 보내기 전까지는 클라이언트에만 존재
- **React Query**: 최종 제출 (`useMutation`) + 제출 후 서버 상태 동기화 (`setQueryData`)

## 뮤테이션 후 Zustand 상태 업데이트

뮤테이션 성공 후 클라이언트 상태를 같이 정리해야 할 때 두 도구를 연결합니다. 위 멀티스텝 폼 예제에서 이미 이 패턴을 사용했습니다. 좀 더 명시적으로 보면:

```jsx
function useSubmitForm() {
  const resetForm = useFormStore((s) => s.reset);        // Zustand 액션
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.post('/submit', data),
    onSuccess: (result) => {
      resetForm();                                                  // 클라이언트 상태(Zustand) 초기화
      queryClient.invalidateQueries({ queryKey: ['myData'] });      // 서버 상태(React Query) 갱신
    },
  });
}
```

패턴:
1. `mutationFn`: 서버에 변경 요청
2. `onSuccess` → `zustandStore.action()`: 관련 클라이언트 상태 초기화
3. `onSuccess` → `queryClient.invalidateQueries()`: 관련 서버 캐시 무효화

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

// API 클라이언트: Zustand 에서 token 읽기
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

Zustand 와 React Query 는 서로 다른 문제를 해결합니다. 두 도구의 역할을 명확히 나누면 각각의 장점을 최대로 활용할 수 있습니다.
