---
title: "[React 성능 최적화] 7. 코드 스플리팅: 번들을 나눠서 첫 로딩 줄이기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "optimization", "code-splitting", "lazy", "Suspense", "번들"]
---

# 코드 스플리팅: 번들을 나눠서 첫 로딩 줄이기

React 앱을 빌드하면 모든 코드가 하나의 JavaScript 파일로 묶입니다. 앱이 커질수록 이 파일도 커지고, 사용자는 첫 화면을 보기 위해 필요하지도 않은 코드를 전부 다운로드해야 합니다. **코드 스플리팅**은 이 번들을 여러 조각으로 나눠서 필요할 때만 다운로드하게 합니다.

> 이 주제는 패턴 시리즈의 `09-suspense-lazy.md`와 연결됩니다. 여기서는 **성능 최적화 관점**에서 어떤 효과가 있고 어떻게 전략을 세우는지 다룹니다.

## 왜 첫 번들 크기가 중요한가

```
번들 크기 → 다운로드 시간 → 파싱/실행 시간 → 첫 화면 표시 (FCP, LCP)
```

구글의 Core Web Vitals 지표에서 **LCP(Largest Contentful Paint)**는 첫 주요 콘텐츠가 표시되는 시간입니다. 번들이 클수록 LCP가 늦어지고, 검색 순위와 사용자 경험 모두 나빠집니다.

## React.lazy + Suspense

```jsx
import { lazy, Suspense } from 'react';

// 기존: 번들에 포함
// import AdminPage from './pages/AdminPage';

// lazy: 처음 렌더링될 때 별도 요청으로 다운로드
const AdminPage = lazy(() => import('./pages/AdminPage'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Suspense>
  );
}
```

`/admin`에 접근할 때 비로소 `AdminPage` 코드를 다운로드합니다. 홈 화면을 보는 대부분의 사용자는 이 코드를 다운로드하지 않습니다.

## 라우트 단위 스플리팅 (가장 효과적)

페이지 단위로 나누는 것이 가장 큰 효과를 냅니다.

```jsx
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingPage />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

결과:
- 최초 로딩: 공통 코드 + Home 코드만 다운로드
- `/dashboard` 방문: Dashboard 코드 추가 다운로드 (이미 캐시됐으면 즉시)

## 컴포넌트 단위 스플리팅

처음에 보이지 않는 무거운 컴포넌트도 분리합니다.

```jsx
// 처음에는 보이지 않는 무거운 컴포넌트들
const RichTextEditor = lazy(() => import('./RichTextEditor'));
const DataGrid = lazy(() => import('./DataGrid'));
const ChartLibrary = lazy(() => import('./ChartLibrary'));

function ArticleEditor() {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div>
      <button onClick={() => setShowEditor(true)}>에디터 열기</button>
      {showEditor && (
        <Suspense fallback={<div>에디터 로딩 중...</div>}>
          <RichTextEditor />  {/* 버튼 클릭 시에만 다운로드 */}
        </Suspense>
      )}
    </div>
  );
}
```

Rich text editor, PDF 뷰어, 차트 라이브러리 같이 무거운 서드파티를 포함한 컴포넌트에 효과적입니다.

## 스플리팅 전략

### 어떤 것을 나눌까?

```
스플리팅 우선순위 (높음 → 낮음)

1. 페이지(라우트) 단위         ← 가장 큰 효과
2. 조건부로 보이는 무거운 UI   ← 모달, 드로어, 탭 패널
3. 무거운 서드파티 라이브러리  ← 에디터, 차트, PDF
4. 관리자/특정 역할 전용 페이지 ← 일반 사용자는 다운로드 불필요
```

### 너무 잘게 나누지 않기

```jsx
// 나쁜 예: 너무 작은 컴포넌트를 lazy로 만들면 오히려 느림
const Button = lazy(() => import('./Button'));       // 의미 없음
const Avatar = lazy(() => import('./Avatar'));       // 의미 없음
```

청크가 너무 작으면 네트워크 왕복이 많아져 오히려 느려질 수 있습니다.

## 번들 크기 분석

스플리팅 효과를 확인하려면 번들 크기를 분석합니다.

```bash
# CRA
npm run build
npx source-map-explorer 'build/static/js/*.js'

# Vite
npm run build
npx vite-bundle-visualizer

# Next.js
# 빌드 후 .next/analyze 폴더 또는 @next/bundle-analyzer 사용
```

어떤 라이브러리가 번들의 몇 %를 차지하는지 시각적으로 확인할 수 있습니다.

## ErrorBoundary와 함께

네트워크 오류로 청크 로딩이 실패할 수 있습니다.

```jsx
import { ErrorBoundary } from 'react-error-boundary';

const HeavyPage = lazy(() => import('./HeavyPage'));

function App() {
  return (
    <ErrorBoundary
      fallback={
        <div>
          페이지를 불러오지 못했습니다.
          <button onClick={() => window.location.reload()}>새로고침</button>
        </div>
      }
    >
      <Suspense fallback={<Spinner />}>
        <HeavyPage />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## 정리

| 항목 | 내용 |
|------|------|
| 핵심 도구 | `React.lazy` + `Suspense` |
| 가장 효과적인 단위 | 라우트(페이지) |
| 추가 후보 | 조건부 표시되는 무거운 컴포넌트 |
| 주의 | 너무 잘게 나누면 역효과 |
| 에러 처리 | `ErrorBoundary`로 로딩 실패 대비 |

코드 스플리팅은 앱의 첫 로딩 속도를 개선하는 가장 직접적인 방법입니다. 특히 라우트 단위 스플리팅을 적용하지 않은 앱이라면 즉각적인 효과를 볼 수 있습니다.
