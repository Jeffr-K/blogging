---
title: "[React 패턴 시리즈] 1. 합성 (Composition): 컴포넌트를 조립하는 방법"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "composition", "합성", "children"]
---

# 합성 (Composition): 컴포넌트를 조립하는 방법

React에서 UI를 구성하는 가장 자연스러운 방법은 **합성(Composition)**입니다. 작은 컴포넌트들을 조립해서 복잡한 UI를 만드는 방식입니다. React 공식 문서도 상속(Inheritance) 대신 합성을 권장합니다.

## children prop

가장 기본적인 합성 방법은 `children` prop입니다. JSX에서 여는 태그와 닫는 태그 사이에 넣은 내용이 `children`으로 전달됩니다.

```jsx
function Card({ children }) {
  return (
    <div className="card">
      {children}
    </div>
  );
}

// 사용
function App() {
  return (
    <Card>
      <h2>제목</h2>
      <p>내용입니다.</p>
    </Card>
  );
}
```

`Card`는 안에 무엇이 들어올지 모르지만, 어떤 내용이든 감쌀 수 있습니다. 레이아웃, 테두리, 그림자 같은 **외형**은 `Card`가 담당하고, **내용**은 사용하는 쪽에서 결정합니다.

## 컴포넌트를 prop으로 넘기기

`children` 외에도 컴포넌트(또는 JSX)를 일반 prop으로 넘길 수 있습니다. 여러 개의 "슬롯"이 필요할 때 유용합니다.

```jsx
function Layout({ header, sidebar, content }) {
  return (
    <div className="layout">
      <header>{header}</header>
      <aside>{sidebar}</aside>
      <main>{content}</main>
    </div>
  );
}

// 사용
function App() {
  return (
    <Layout
      header={<Navigation />}
      sidebar={<UserMenu />}
      content={<ArticleList />}
    />
  );
}
```

`Layout`은 각 영역에 무엇이 들어오는지 전혀 신경 쓰지 않습니다. 오직 **배치**만 담당합니다.

## HOC 대신 합성을 선호하는 이유

과거에는 로직을 재사용하기 위해 고차 컴포넌트(HOC)를 많이 사용했습니다. 하지만 HOC는 몇 가지 문제가 있습니다.

```jsx
// HOC 방식: 컴포넌트를 함수로 감쌈
const EnhancedComponent = withAuth(withTheme(withData(MyComponent)));
```

- 여러 HOC를 중첩하면 어느 HOC가 어느 props를 주는지 추적하기 어렵습니다
- props 이름이 충돌할 수 있습니다
- 디버깅 시 컴포넌트 트리가 복잡해집니다

합성으로 같은 결과를 더 명시적으로 표현할 수 있습니다.

```jsx
// 합성 방식: 명시적으로 조립
function ProfilePage() {
  const { user } = useAuth();         // 로직은 훅으로
  const theme = useTheme();           // 로직은 훅으로
  const { data } = useFetch('/api');  // 로직은 훅으로

  return (
    <ThemeProvider theme={theme}>
      <UserProfile user={user} data={data} />
    </ThemeProvider>
  );
}
```

어디서 무엇을 가져오는지 한눈에 보입니다.

## 실전 예제: 유연한 Modal

```jsx
function Modal({ children, footer }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-body">{children}</div>
        {footer && (
          <div className="modal-footer">{footer}</div>
        )}
      </div>
    </div>
  );
}

// 다양한 방식으로 조합
function ConfirmDialog({ onConfirm, onCancel }) {
  return (
    <Modal
      footer={
        <>
          <button onClick={onCancel}>취소</button>
          <button onClick={onConfirm}>확인</button>
        </>
      }
    >
      <p>정말 삭제하시겠습니까?</p>
    </Modal>
  );
}

function InfoModal() {
  return (
    <Modal> {/* footer 없이도 사용 가능 */}
      <h2>안내사항</h2>
      <p>내용...</p>
    </Modal>
  );
}
```

`Modal`을 수정하지 않아도 다양한 형태로 사용할 수 있습니다.

## 정리

- `children`은 컴포넌트를 투명한 컨테이너로 만드는 가장 간단한 방법입니다
- 여러 "슬롯"이 필요하면 컴포넌트를 일반 prop으로 넘깁니다
- HOC보다 합성 + 커스텀 훅 조합이 더 명시적이고 디버깅하기 쉽습니다
- 컴포넌트는 **어떻게 보이는지**만 담당하고, **무엇을 보여줄지**는 사용하는 쪽에서 결정하게 하세요
