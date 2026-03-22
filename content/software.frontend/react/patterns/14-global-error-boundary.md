---
title: "[React 패턴 시리즈] 14. 전역 에러 바운더리: 앱 어디에, 어떻게 설정하나"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "error-boundary", "에러처리", "react-query", "sentry"]
---

# 전역 에러 바운더리: 앱 어디에, 어떻게 설정하나

Error Boundary를 어떻게 만드는지는 이전 아티클에서 다뤘습니다. 이번에는 **실제 앱에서 어디에, 몇 개를, 어떻게 배치하는지** — 아키텍처 관점에서 봅니다.

## 배치 전략: 세 레벨

Error Boundary는 하나만 두는 게 아닙니다. 목적에 따라 레벨을 나눠서 중첩합니다.

```
main.jsx
└── <ErrorBoundary>          ← 레벨 1: 전역 (최후의 보루)
    └── <App>
        └── <Routes>
            └── <ErrorBoundary>   ← 레벨 2: 라우트 단위
                └── <PageComponent>
                    └── <ErrorBoundary>  ← 레벨 3: 컴포넌트 단위 (선택)
                        └── <Widget />
```

에러가 발생하면 **가장 가까운 상위 Error Boundary**가 잡습니다.

---

## 레벨 1: 전역 (main.jsx)

앱 전체를 감싸는 가장 바깥쪽 Error Boundary입니다. 어디서도 처리되지 않은 에러의 **최후 방어선**입니다.

```jsx
// main.jsx
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function GlobalErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>앱에 문제가 발생했습니다</h1>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>새로고침</button>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary
    FallbackComponent={GlobalErrorFallback}
    onError={(error, info) => {
      // Sentry 같은 에러 추적 서비스에 전송
      console.error('[Global Error]', error, info.componentStack);
    }}
  >
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ErrorBoundary>
);
```

`QueryClientProvider`는 Error Boundary 안쪽에 둡니다. 그래야 React Query 관련 에러도 같이 잡힙니다.

---

## 레벨 2: 라우트 단위 (App.jsx)

전역 Error Boundary만 있으면, 한 페이지에서 에러가 나도 **앱 전체**가 오류 화면으로 대체됩니다. 라우트마다 Error Boundary를 두면 에러가 해당 페이지에만 국한됩니다.

```jsx
// App.jsx
import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

function PageErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div>
      <h2>이 페이지를 불러올 수 없습니다</h2>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>다시 시도</button>
    </div>
  );
}

// 라우트를 Error Boundary로 감싸는 헬퍼
function WithErrorBoundary({ children }) {
  return (
    <ErrorBoundary FallbackComponent={PageErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<WithErrorBoundary><HomePage /></WithErrorBoundary>} />
      <Route path="/dashboard" element={<WithErrorBoundary><DashboardPage /></WithErrorBoundary>} />
      <Route path="/profile" element={<WithErrorBoundary><ProfilePage /></WithErrorBoundary>} />
    </Routes>
  );
}
```

`/dashboard`에서 에러가 나도 `/`나 `/profile`은 정상입니다.

---

## 레벨 3: 컴포넌트 단위 (선택)

중요도가 낮거나 독립적인 위젯에만 선택적으로 씁니다. 전체 페이지가 날아가는 것보다 해당 위젯만 에러 처리하는 게 나을 때입니다.

```jsx
function DashboardPage() {
  return (
    <div>
      <MainContent />  {/* 실패하면 페이지 레벨 ErrorBoundary가 잡음 */}

      {/* 이 위젯은 실패해도 나머지 대시보드는 정상이어야 함 */}
      <ErrorBoundary fallback={<p>추천 콘텐츠를 불러올 수 없습니다.</p>}>
        <RecommendationWidget />
      </ErrorBoundary>
    </div>
  );
}
```

---

## React Query와 연동

React Query는 기본적으로 에러를 `isError` 상태로 처리합니다. `throwOnError: true`를 주면 Error Boundary로 에러를 넘깁니다.

```jsx
// 특정 쿼리에서만 Error Boundary 사용
useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
  throwOnError: true, // → 가장 가까운 ErrorBoundary가 잡음
});

// QueryClient 기본값으로 전체 적용
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true,
    },
  },
});
```

`throwOnError: true`를 전체 기본값으로 설정하면 모든 쿼리 에러가 Error Boundary로 올라갑니다. `useQuery` 개별 옵션으로 `throwOnError: false`를 주면 특정 쿼리만 예외처리할 수 있습니다.

### Suspense + Error Boundary 조합

React Query의 `suspense: true`와 함께 쓰면 로딩과 에러를 컴포넌트 바깥에서 선언적으로 처리합니다.

```jsx
function UserProfile() {
  // Suspense가 로딩을 처리, ErrorBoundary가 에러를 처리
  // 이 컴포넌트 안에서는 로딩/에러 분기 없이 데이터만 씀
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: fetchUser,
    suspense: true,
    throwOnError: true,
  });

  return <div>{user.name}</div>;
}

// 사용 측
function App() {
  return (
    <ErrorBoundary FallbackComponent={PageErrorFallback}>
      <Suspense fallback={<Spinner />}>
        <UserProfile />
      </Suspense>
    </ErrorBoundary>
  );
}
```

---

## Sentry 연동

에러 추적 서비스와 연동할 때는 `onError` 콜백에서 전송합니다.

```jsx
import * as Sentry from '@sentry/react';

Sentry.init({ dsn: 'YOUR_DSN' });

createRoot(document.getElementById('root')).render(
  <ErrorBoundary
    FallbackComponent={GlobalErrorFallback}
    onError={(error, info) => {
      Sentry.captureException(error, {
        contexts: { react: { componentStack: info.componentStack } },
      });
    }}
  >
    <App />
  </ErrorBoundary>
);
```

혹은 `@sentry/react`의 `Sentry.ErrorBoundary`를 바로 사용할 수 있습니다.

```jsx
import { ErrorBoundary } from '@sentry/react';

createRoot(document.getElementById('root')).render(
  <ErrorBoundary fallback={<GlobalErrorFallback />} showDialog>
    <App />
  </ErrorBoundary>
);
```

`showDialog: true`를 주면 에러 발생 시 사용자에게 피드백 입력 다이얼로그를 자동으로 띄웁니다.

---

## 정리

| 레벨 | 위치 | 목적 | fallback |
|------|------|------|---------|
| **전역** | `main.jsx` | 최후의 보루, 에러 추적 | 앱 전체 오류 페이지 |
| **라우트** | `App.jsx` | 페이지 단위 격리 | "이 페이지를 불러올 수 없습니다" |
| **컴포넌트** | 필요한 곳 | 위젯 단위 격리 | 인라인 에러 메시지 |

전역 Error Boundary 하나만으로는 부족합니다. 라우트 단위로 에러를 격리해야 한 페이지의 에러가 앱 전체를 망가뜨리지 않습니다.
