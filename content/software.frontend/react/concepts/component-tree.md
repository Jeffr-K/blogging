---
title: "[React 개념] 컴포넌트 트리: React가 UI를 구성하는 방법"
author: oscar.rs
date: 2026-03-22
tags: ["react", "concepts", "component-tree", "virtual-dom", "reconciliation", "렌더링"]
---

# 컴포넌트 트리: React가 UI를 구성하는 방법

React 앱을 이해하려면 컴포넌트 트리가 무엇인지, 어떻게 만들어지고 업데이트되는지 알아야 합니다. 모든 React 개념(리렌더링, Context, key, 성능 최적화)은 이 컴포넌트 트리를 기반으로 합니다.

## 컴포넌트 트리란?

React 앱은 컴포넌트들이 **트리(tree) 구조**로 이루어집니다. 트리는 하나의 루트(root)에서 시작해 가지를 뻗는 계층 구조입니다.

```
App
├── Header
│   ├── Logo
│   └── Navigation
│       ├── NavLink (홈)
│       ├── NavLink (소개)
│       └── NavLink (문의)
├── Main
│   ├── Sidebar
│   │   └── UserProfile
│   └── Content
│       ├── ArticleList
│       │   ├── ArticleCard
│       │   ├── ArticleCard
│       │   └── ArticleCard
│       └── Pagination
└── Footer
```

각 네모가 컴포넌트이고, 위아래 관계가 부모-자식 관계입니다.

## 두 종류의 트리

React는 내부적으로 두 가지 트리를 관리합니다.

### 1. 컴포넌트 트리 (React Tree)

개발자가 작성한 JSX를 기반으로 만들어진 **React 컴포넌트의 계층 구조**입니다. `<App>`이 루트이고, 그 안에 중첩된 컴포넌트들이 있습니다.

### 2. DOM 트리 (Actual DOM)

브라우저가 실제로 화면을 그리는 데 사용하는 **HTML 요소의 계층 구조**입니다. React 컴포넌트 트리를 기반으로 만들어집니다.

```
React 트리          →     DOM 트리
<App>                     <div id="root">
  <Header>                  <header>
    <Logo>                    <img src="logo.png">
    <Navigation>              <nav>
      <NavLink>                 <a href="/">홈</a>
```

React 컴포넌트가 모두 DOM 요소를 만드는 것은 아닙니다. 컴포넌트는 논리적 단위이고, 최종적으로 `div`, `span`, `button` 같은 HTML 태그로 변환됩니다.

## Virtual DOM: 중간 계층

직접 DOM을 수정하는 것은 느립니다. React는 **Virtual DOM**이라는 중간 계층을 통해 효율적으로 업데이트합니다.

```
상태 변경
  ↓
새 Virtual DOM 생성 (메모리 안, 빠름)
  ↓
이전 Virtual DOM과 비교 (Diffing)
  ↓
실제로 바뀐 부분만 DOM에 반영 (Reconciliation)
```

예를 들어 목록에서 한 항목만 바뀌었다면, React는 그 항목의 DOM 노드만 업데이트합니다. 전체 목록을 다시 그리지 않습니다.

## 렌더링이 발생하는 조건

트리의 어떤 컴포넌트가 렌더링(함수 재실행)되는지 이해하는 것이 매우 중요합니다.

컴포넌트가 렌더링되는 조건:
1. **자신의 state가 변경될 때**
2. **부모 컴포넌트가 렌더링될 때**
3. **자신이 구독하는 Context 값이 변경될 때**

```
App (state 변경됨, 렌더링!)
├── Header (부모가 렌더링됐으므로, 렌더링!)
│   ├── Logo (부모가 렌더링됐으므로, 렌더링!)
│   └── Navigation (부모가 렌더링됐으므로, 렌더링!)
└── Main (부모가 렌더링됐으므로, 렌더링!)
    └── Content (부모가 렌더링됐으므로, 렌더링!)
```

`App`의 state 하나가 바뀌면, 그 아래 모든 자식이 렌더링됩니다. **렌더링은 트리 위에서 아래로 전파됩니다.**

> 중요: 렌더링(함수 재실행)이 발생해도 DOM 변경이 발생하지 않을 수 있습니다. React가 이전 결과와 비교해서 실제로 다른 부분만 DOM에 반영합니다.

## 트리에서의 마운트/언마운트

컴포넌트가 트리에 처음 **추가**되는 것을 **마운트(Mount)**, 트리에서 **제거**되는 것을 **언마운트(Unmount)**라고 합니다.

```jsx
function App() {
  const [showSidebar, setShowSidebar] = useState(true);

  return (
    <div>
      {showSidebar && <Sidebar />} {/* 조건에 따라 마운트/언마운트 */}
      <Content />
    </div>
  );
}
```

- `showSidebar`가 `true` → `Sidebar` 마운트 (처음 생성, useEffect 실행)
- `showSidebar`가 `false` → `Sidebar` 언마운트 (제거, useEffect 클린업 실행)
- `showSidebar`가 다시 `true` → `Sidebar` 재마운트 (완전히 새로 생성, state 초기화)

**언마운트되면 컴포넌트의 모든 state가 초기화됩니다.** 이것은 중요한 특성입니다.

## 트리에서의 state 위치

같은 위치에 같은 컴포넌트가 있으면 state가 유지됩니다.

```jsx
function App({ isAdmin }) {
  return (
    <div>
      {isAdmin ? <UserForm type="admin" /> : <UserForm type="user" />}
    </div>
  );
}
```

`isAdmin`이 바뀌어도 `UserForm`은 **같은 위치**에 있으므로 React는 같은 컴포넌트로 인식합니다. state가 유지됩니다. 이것이 의도치 않은 동작을 일으킬 수 있습니다.

state를 초기화하려면 `key`를 다르게 주면 됩니다.

```jsx
{isAdmin
  ? <UserForm key="admin" type="admin" />
  : <UserForm key="user" type="user" />
}
```

`key`가 다르면 React는 다른 컴포넌트로 인식하고 언마운트/재마운트합니다.

## key와 트리 재조정

리스트를 렌더링할 때 `key`가 중요한 이유도 트리 구조와 관련이 있습니다.

```jsx
// key 없이 아이템을 앞에 추가하는 경우
['B', 'C'] → ['A', 'B', 'C']

// React의 비교: 위치 기반
위치 0: 'B' → 'A' (다름, DOM 업데이트)
위치 1: 'C' → 'B' (다름, DOM 업데이트)
위치 2: 없음 → 'C' (새로 추가)
// 3번 모두 업데이트!
```

```jsx
// key 있을 때
위치 0: key='b' → key='a' (a가 새로 추가됨)
위치 1: key='c' → key='b' (b는 그대로)
위치 2: 없음 → key='c' (c는 그대로)
// a만 추가!
```

`key`는 React가 트리에서 컴포넌트의 **신원(identity)**을 추적하는 수단입니다.

## 트리와 Context

Context는 트리의 **특정 위치**에서 공급(Provider)하고, 그 아래 어디서든 소비(useContext)할 수 있습니다.

```
ThemeContext.Provider (value="dark")
├── Header ← useContext(ThemeContext) = "dark" 사용 가능
│   └── Logo ← useContext(ThemeContext) = "dark" 사용 가능
└── Main
    ├── ThemeContext.Provider (value="light") ← 더 가까운 Provider로 덮어씀
    │   └── Widget ← useContext(ThemeContext) = "light"
    └── Content ← useContext(ThemeContext) = "dark"
```

같은 Context라도 더 가까운(아래에 있는) Provider의 값을 사용합니다.

## 트리와 성능 최적화

리렌더링이 트리 아래로 전파된다는 것을 이해하면, 왜 성능 최적화가 필요한지 알 수 있습니다.

```
App (count state 있음)
├── ExpensiveComponent (count를 쓰지도 않는데 매번 리렌더링)
└── Counter (count를 사용함)
```

해결법은 두 가지입니다.

**방법 1: state를 아래로 내리기 (State Colocation)**

```jsx
// count state를 Counter 안으로 이동
function Counter() {
  const [count, setCount] = useState(0); // 여기서 관리
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

function App() {
  return (
    <>
      <ExpensiveComponent /> {/* 이제 리렌더링 안 됨 */}
      <Counter />
    </>
  );
}
```

**방법 2: React.memo로 차단**

```jsx
const ExpensiveComponent = React.memo(function ExpensiveComponent() {
  // props가 바뀌지 않으면 부모가 렌더링돼도 리렌더링 안 함
  return <div>...</div>;
});
```

## 정리

| 개념 | 설명 |
|------|------|
| 컴포넌트 트리 | 컴포넌트의 부모-자식 계층 구조 |
| Virtual DOM | 실제 DOM 업데이트 전 메모리 내 비교 계층 |
| 렌더링 전파 | 부모가 렌더링되면 자식도 렌더링됨 |
| 마운트/언마운트 | 트리에 추가/제거, state 생성/소멸 |
| key | 같은 위치에서 컴포넌트의 신원을 구분 |
| Context | 트리의 특정 위치에서 공급, 그 아래 어디서든 소비 |

React의 모든 동작은 이 트리 구조를 기반으로 합니다. 컴포넌트 트리를 머릿속에 그릴 수 있다면, 리렌더링이 왜 일어나는지, 왜 state가 초기화됐는지, Context 값이 왜 저 컴포넌트에만 적용되는지 직관적으로 이해할 수 있습니다.
