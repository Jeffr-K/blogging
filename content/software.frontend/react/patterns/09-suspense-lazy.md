---
title: "[React 패턴 시리즈] 9. Suspense & Lazy Loading: 필요할 때 불러오기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "suspense", "lazy", "code-splitting", "성능최적화"]
---

# Suspense & Lazy Loading: 필요할 때 불러오기

React 앱을 빌드하면 보통 하나의 큰 JavaScript 번들이 만들어집니다. 앱이 커질수록 이 번들도 커지고, 사용자는 첫 화면에서 필요하지도 않은 코드까지 모두 다운로드해야 합니다. `React.lazy`와 `Suspense`는 이 문제를 해결합니다.

## React.lazy: 컴포넌트를 필요할 때 불러오기

`React.lazy`는 컴포넌트를 **처음 렌더링될 때 동적으로 불러옵니다.** 처음부터 번들에 포함하지 않습니다.

```jsx
import { lazy } from 'react';

// 기존 방식: 앱 시작 시 즉시 로드
import HeavyComponent from './HeavyComponent';

// lazy 방식: 처음 렌더링될 때 로드
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

`lazy`는 `import()`를 반환하는 함수를 받습니다. `import()`는 해당 파일을 별도의 번들 청크로 분리합니다.

## Suspense: 로딩 중 UI 표시

`lazy`로 불러오는 컴포넌트는 처음 렌더링될 때 잠깐 로딩 상태가 됩니다. `Suspense`는 이 로딩 중인 동안 보여줄 fallback UI를 지정합니다.

```jsx
import { lazy, Suspense } from 'react';

const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  return (
    <div>
      <h1>대시보드</h1>
      <Suspense fallback={<div>차트 불러오는 중...</div>}>
        <HeavyChart />
      </Suspense>
    </div>
  );
}
```

`HeavyChart`가 로드되기 전까지 "차트 불러오는 중..."이 보이고, 로드 완료 후 차트가 표시됩니다.

## 라우트 단위 코드 스플리팅

가장 효과적인 스플리팅은 **페이지(라우트) 단위**입니다. 현재 보고 있는 페이지의 코드만 불러오면 됩니다.

```jsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

사용자가 `/dashboard`에 접속하면 Dashboard 코드만 다운로드됩니다. About, Settings 코드는 해당 페이지에 가야 비로소 다운로드됩니다.

## 여러 Suspense 중첩하기

Suspense는 중첩해서 세밀하게 제어할 수 있습니다.

```jsx
function App() {
  return (
    <Suspense fallback={<AppShell />}> {/* 앱 전체 로딩 */}
      <Header />
      <main>
        <Suspense fallback={<SidebarSkeleton />}> {/* 사이드바만 */}
          <Sidebar />
        </Suspense>
        <Suspense fallback={<ContentSkeleton />}> {/* 콘텐츠만 */}
          <MainContent />
        </Suspense>
      </main>
    </Suspense>
  );
}
```

`Sidebar`가 로딩 중이어도 `MainContent`가 준비되면 바로 보여줄 수 있습니다.

## Error Boundary와 함께

코드 로딩에 실패할 수도 있습니다. `ErrorBoundary`와 함께 사용해 에러 상태도 처리합니다.

```jsx
import { ErrorBoundary } from 'react-error-boundary';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function SafeLazyComponent() {
  return (
    <ErrorBoundary fallback={<div>컴포넌트를 불러오지 못했습니다.</div>}>
      <Suspense fallback={<div>불러오는 중...</div>}>
        <HeavyComponent />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## 어떤 컴포넌트를 분리해야 할까?

모든 컴포넌트를 lazy로 만들 필요는 없습니다. 오히려 너무 잘게 나누면 네트워크 요청이 많아져 역효과가 납니다.

**좋은 분리 대상**
- 페이지 컴포넌트 (라우트 단위)
- 모달, 드로어처럼 처음에 보이지 않는 UI
- 차트, 에디터처럼 무거운 서드파티 라이브러리를 포함한 컴포넌트

**분리 효과가 적은 경우**
- 항상 바로 보이는 작은 컴포넌트
- 코드가 매우 작은 컴포넌트

## 정리

| 항목 | 설명 |
|------|------|
| `React.lazy` | 컴포넌트를 동적으로 import, 별도 번들 청크로 분리 |
| `Suspense` | 로딩 중일 때 보여줄 fallback UI 지정 |
| 핵심 전략 | 라우트 단위로 분리하면 가장 효과적 |
| Error 처리 | `ErrorBoundary`로 로딩 실패 상황도 처리 |

초기 번들 크기를 줄이면 첫 화면 로딩 속도가 빨라집니다. 특히 대규모 앱에서 체감 성능 개선에 효과적입니다.
