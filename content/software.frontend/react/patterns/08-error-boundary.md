---
title: "[React 패턴 시리즈] 8. Error Boundary: 렌더링 에러를 우아하게 처리하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "error-boundary", "에러처리", "fallback"]
---

# Error Boundary: 렌더링 에러를 우아하게 처리하기

JavaScript에서 에러가 발생하면 `try/catch`로 잡습니다. 하지만 React 컴포넌트 렌더링 중 발생하는 에러는 `try/catch`로 잡을 수 없습니다. 렌더링은 React가 호출하기 때문입니다. 이 에러를 잡는 것이 **Error Boundary**입니다.

## Error Boundary 없으면?

```jsx
function UserProfile({ userId }) {
  const user = getUser(userId); // userId가 없으면 에러 발생
  return <div>{user.name}</div>; // user가 null이면 에러 발생
}
```

이런 에러가 발생하면 React는 **컴포넌트 트리 전체를 언마운트**합니다. 사용자는 빈 화면을 보게 됩니다. Error Boundary를 사용하면 에러가 발생한 부분만 fallback UI로 교체하고 나머지는 정상 동작합니다.

## Error Boundary 구현

Error Boundary는 **클래스 컴포넌트**로만 만들 수 있습니다. `getDerivedStateFromError`와 `componentDidCatch`라는 클래스 컴포넌트 전용 생명주기 메서드를 사용하기 때문입니다.

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // 에러 발생 시 state 업데이트 (렌더링 단계)
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // 에러 로깅 (커밋 단계, 사이드 이펙트 가능)
  componentDidCatch(error, info) {
    console.error('렌더링 에러:', error);
    console.error('컴포넌트 스택:', info.componentStack);
    // Sentry 같은 에러 추적 서비스에 보내기
    // logErrorToService(error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <div>문제가 발생했습니다.</div>;
    }
    return this.props.children;
  }
}
```

## 사용법

```jsx
function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <Header />
      <ErrorBoundary fallback={<p>피드를 불러올 수 없습니다.</p>}>
        <NewsFeed />
      </ErrorBoundary>
      <ErrorBoundary fallback={<p>추천 콘텐츠를 불러올 수 없습니다.</p>}>
        <Recommendations />
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
```

`NewsFeed`에서 에러가 나도 `Header`와 `Recommendations`는 정상적으로 보입니다. Error Boundary를 세밀하게 배치할수록 에러의 영향 범위가 줄어듭니다.

## react-error-boundary 라이브러리

클래스 컴포넌트를 직접 작성하는 대신, `react-error-boundary` 라이브러리를 쓰면 더 간편합니다.

```bash
npm install react-error-boundary
```

```jsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div>
      <p>오류가 발생했습니다: {error.message}</p>
      <button onClick={resetErrorBoundary}>다시 시도</button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => logError(error, info)}
      onReset={() => { /* 에러 상태 초기화 */ }}
    >
      <SomeComponent />
    </ErrorBoundary>
  );
}
```

`resetErrorBoundary`를 호출하면 에러 상태를 초기화하고 자식 컴포넌트를 다시 렌더링합니다.

## Error Boundary가 잡지 못하는 에러

Error Boundary는 **렌더링 중 발생하는 에러**만 잡습니다. 다음은 잡지 못합니다.

```jsx
// 이벤트 핸들러 안 에러 (try/catch로 직접 처리)
<button onClick={() => {
  try {
    doSomething();
  } catch (e) {
    setError(e);
  }
}}>

// 비동기 코드
useEffect(() => {
  fetch('/api').then(/* ... */); // Promise 에러는 잡지 못함
}, []);

// 서버 사이드 렌더링 중 에러
```

## Suspense와 함께 사용

```jsx
function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <Suspense fallback={<LoadingSpinner />}>
        <AsyncComponent />
      </Suspense>
    </ErrorBoundary>
  );
}
```

`Suspense`는 로딩 중 상태를, `ErrorBoundary`는 에러 상태를 담당합니다.

## 정리

- Error Boundary는 자식 컴포넌트 트리의 렌더링 에러를 잡습니다
- 에러 발생 시 전체 화면 대신 지정한 fallback UI를 보여줍니다
- 세밀하게 배치할수록 에러 영향 범위가 줄어듭니다
- 클래스 컴포넌트로 구현하거나, `react-error-boundary` 라이브러리를 사용합니다
- 이벤트 핸들러와 비동기 에러는 잡지 못하므로 별도 처리가 필요합니다
