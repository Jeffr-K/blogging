---
title: "[React 패턴 시리즈] 2. 고차 컴포넌트 (HOC): 컴포넌트를 강화하는 래퍼"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "HOC", "고차컴포넌트", "재사용"]
---

# 고차 컴포넌트 (HOC): 컴포넌트를 강화하는 래퍼

**고차 컴포넌트(Higher-Order Component, HOC)**는 컴포넌트를 인자로 받아서, 기능이 추가된 새 컴포넌트를 반환하는 함수입니다. 이름은 어렵지만 개념은 간단합니다. "컴포넌트를 포장해서 새 기능을 씌워 주는 함수"입니다.

## 기본 구조

```jsx
function withSomething(WrappedComponent) {
  // 새 컴포넌트를 반환
  return function EnhancedComponent(props) {
    // 추가 로직...
    return <WrappedComponent {...props} />;
  };
}
```

관례적으로 HOC 이름은 `with`로 시작합니다.

## 실전 예제: 인증 HOC

로그인하지 않은 사용자는 접근을 막는 기능을 HOC로 만들어봅니다.

```jsx
function withAuth(WrappedComponent) {
  return function AuthenticatedComponent(props) {
    const { user } = useAuth();

    if (!user) {
      return <Navigate to="/login" />;
    }

    return <WrappedComponent {...props} />;
  };
}

// 사용
const ProtectedDashboard = withAuth(Dashboard);
const ProtectedSettings = withAuth(Settings);
```

`Dashboard`와 `Settings`는 인증 로직을 전혀 모릅니다. 인증이 필요한 페이지마다 같은 코드를 반복할 필요가 없습니다.

## 실전 예제: 로딩 상태 HOC

```jsx
function withLoading(WrappedComponent) {
  return function WithLoadingComponent({ isLoading, ...props }) {
    if (isLoading) {
      return <div className="spinner">로딩 중...</div>;
    }
    return <WrappedComponent {...props} />;
  };
}

// 사용
const UserListWithLoading = withLoading(UserList);

function App() {
  const { data, loading } = useFetch('/api/users');
  return <UserListWithLoading isLoading={loading} users={data} />;
}
```

## HOC의 한계

HOC는 강력하지만 주의해야 할 점들이 있습니다.

### props 출처가 불명확해짐

```jsx
function MyComponent({ user, theme, data, onSubmit }) {
  // 이 props들이 어디서 왔는지 바로 알 수 없음
}

export default withAuth(withTheme(withData(MyComponent)));
```

컴포넌트만 봐서는 어떤 HOC가 어떤 props를 주입했는지 알기 어렵습니다.

### props 이름 충돌

```jsx
function withUser(Component) {
  return (props) => <Component user={currentUser} {...props} />;
}

function withAdmin(Component) {
  return (props) => <Component user={adminUser} {...props} />;  // 같은 이름!
}

// 어느 user가 전달될까?
const Enhanced = withUser(withAdmin(MyComponent));
```

### 디버깅 어려움

React DevTools에서 컴포넌트 트리가 HOC 레이어로 가득 차서 실제 컴포넌트를 찾기 힘들어집니다.

## HOC vs 커스텀 훅

React 훅이 등장한 이후, 많은 HOC의 역할을 커스텀 훅이 더 명확하게 대체할 수 있게 됐습니다.

```jsx
// HOC 방식
const ProtectedPage = withAuth(PageComponent);

// 커스텀 훅 방식 (더 명시적)
function PageComponent() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;

  return <div>보호된 페이지</div>;
}
```

커스텀 훅 방식은 어떤 데이터를 어디서 가져오는지 컴포넌트 코드에서 바로 보입니다.

## 그래도 HOC가 적합한 경우

HOC가 여전히 유용한 상황도 있습니다.

- **클래스 컴포넌트에 기능 추가**: 훅은 클래스 컴포넌트에서 사용할 수 없습니다
- **JSX 래핑이 필요한 경우**: 컴포넌트 자체를 다른 요소로 감싸야 할 때
- **서드파티 라이브러리 통합**: `connect()` (Redux), `withRouter()` (React Router v4) 등

```jsx
// JSX 래핑이 필요한 경우 - HOC가 적합
function withErrorBoundary(WrappedComponent) {
  return function WithErrorBoundary(props) {
    return (
      <ErrorBoundary fallback={<ErrorPage />}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
```

## 정리

| 항목 | 내용 |
|------|------|
| 정의 | 컴포넌트를 받아 새 컴포넌트를 반환하는 함수 |
| 네이밍 관례 | `with`로 시작 |
| 장점 | 렌더링 로직 재사용, 컴포넌트에 기능 추가 |
| 단점 | props 출처 불명확, 이름 충돌, 디버깅 복잡 |
| 현재 위치 | 커스텀 훅으로 대부분 대체 가능, 특정 상황에서는 여전히 유용 |

새 코드를 작성할 때는 커스텀 훅을 먼저 고려하고, HOC는 훅으로 해결이 안 되는 특수한 경우에 사용하세요.
