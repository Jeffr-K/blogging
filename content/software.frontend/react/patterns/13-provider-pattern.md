---
title: "[React 패턴 시리즈] 13. Provider 패턴: 전역 의존성을 주입하는 방법"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "provider", "dependency-injection", "context"]
---

# Provider 패턴: 전역 의존성을 주입하는 방법

**Provider 패턴**은 Context의 `Provider`를 활용해서 컴포넌트 트리 전체에 데이터나 기능을 주입하는 방법입니다. 데이터베이스 연결, 인증 정보, 테마, 설정처럼 앱 전반에서 필요한 것들을 props 없이 공급합니다.

## 단순 Provider

```jsx
const ThemeContext = createContext('light');

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

## 여러 Provider 계층 구성

실제 앱에는 여러 Provider가 필요합니다. 이것들을 계층적으로 구성하는 방법이 중요합니다.

### 나쁜 예: Provider 지옥

```jsx
// 가독성이 떨어지는 중첩
function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LocaleProvider>
          <RouterProvider>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <Router />
              </ToastProvider>
            </QueryClientProvider>
          </RouterProvider>
        </LocaleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
```

### 좋은 예: Provider 합성

```jsx
// providers.jsx: 모든 Provider를 한 곳에서 관리
const providers = [
  AuthProvider,
  ThemeProvider,
  LocaleProvider,
  [QueryClientProvider, { client: queryClient }], // props가 필요한 경우
  ToastProvider,
];

function composeProviders(providers) {
  return providers.reduceRight((children, provider) => {
    const [Provider, props] = Array.isArray(provider) ? provider : [provider, {}];
    return <Provider {...props}>{children}</Provider>;
  }, null);
}

function AppProviders({ children }) {
  return composeProviders([...providers, children]);
}

// App.jsx: 깔끔
function App() {
  return (
    <AppProviders>
      <Router />
    </AppProviders>
  );
}
```

## 기능별 Provider 분리

한 Provider에 너무 많은 것을 넣지 말고, 관심사별로 나눕니다.

```jsx
// Auth 관련만
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const login = async (credentials) => { /* ... */ };
  const logout = () => { /* ... */ };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 토스트 알림만
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type) => { /* ... */ };
  const removeToast = (id) => { /* ... */ };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}
```

`ToastProvider`는 Provider이면서 동시에 `ToastContainer`를 렌더링합니다. 토스트 기능을 사용하려면 `ToastProvider`만 추가하면 됩니다.

## 지연 초기화가 필요한 Provider

무거운 초기화 작업이 있는 Provider는 `Suspense`와 함께 사용합니다.

```jsx
function DatabaseProvider({ children }) {
  const [db, setDb] = useState(null);

  useEffect(() => {
    initializeDatabase().then(setDb);
  }, []);

  if (!db) return null; // 또는 로딩 UI

  return (
    <DatabaseContext.Provider value={db}>
      {children}
    </DatabaseContext.Provider>
  );
}
```

## 테스트에서의 활용

Provider 패턴은 테스트를 쉽게 만듭니다. 테스트용 mock Provider를 만들어 실제 API 없이 테스트할 수 있습니다.

```jsx
// 테스트용 Provider
function MockAuthProvider({ children, user = null }) {
  return (
    <AuthContext.Provider value={{
      user,
      login: jest.fn(),
      logout: jest.fn(),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// 테스트
test('로그인한 사용자에게 프로필 표시', () => {
  render(
    <MockAuthProvider user={{ name: '홍길동' }}>
      <ProfileMenu />
    </MockAuthProvider>
  );
  expect(screen.getByText('홍길동')).toBeInTheDocument();
});
```

## 정리

| 핵심 원칙 | 설명 |
|----------|------|
| 관심사별 분리 | Provider 하나에 너무 많은 책임을 주지 않기 |
| 합성으로 관리 | Provider 중첩을 조합 함수로 정리하기 |
| 커스텀 훅 제공 | `useContext` 직접 사용 대신 전용 훅 노출 |
| 테스트 고려 | mock Provider로 교체 가능하게 설계 |

Provider 패턴은 의존성 주입(Dependency Injection)의 React 버전입니다. 컴포넌트가 구체적인 구현에 의존하지 않고, Provider를 통해 주입받게 하면 유연하고 테스트하기 쉬운 코드가 됩니다.
