---
title: "[React 성능 최적화] 4. 상태 위치 최적화: State Colocation"
author: oscar.rs
date: 2026-03-22
tags: ["react", "optimization", "state-colocation", "상태위치", "리렌더링"]
---

# 상태 위치 최적화: State Colocation

가장 효과적이고 간단한 최적화 중 하나는 **상태를 그것이 실제로 필요한 위치에 두는 것**입니다. 많은 경우 `memo`나 `useMemo` 없이도 상태를 올바른 위치로 옮기는 것만으로 불필요한 리렌더링을 없앨 수 있습니다.

## 문제: 상태를 불필요하게 위로 올리기

```jsx
function App() {
  // 검색 상태가 App에 있지만, 실제로는 SearchBar만 사용
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div>
      <Header />                              {/* 리렌더링 불필요 */}
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <ExpensiveChart />                       {/* 리렌더링 불필요 */}
      <Footer />                              {/* 리렌더링 불필요 */}
    </div>
  );
}
```

`searchQuery`가 바뀔 때마다 `App` 전체가 리렌더링됩니다. `Header`, `ExpensiveChart`, `Footer`는 검색과 무관하지만 매번 리렌더링됩니다.

## 해결: 상태를 아래로 내리기 (Colocate)

```jsx
function App() {
  return (
    <div>
      <Header />
      <Search />        {/* 검색 상태가 여기 안에 있음 */}
      <ExpensiveChart /> {/* searchQuery가 바뀌어도 리렌더링 안 됨 */}
      <Footer />
    </div>
  );
}

// 검색과 관련된 모든 것이 한 컴포넌트 안에
function Search() {
  const [query, setQuery] = useState('');

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <SearchResults query={query} />
    </div>
  );
}
```

`query`가 바뀌면 `Search`와 `SearchResults`만 리렌더링됩니다. `Header`, `ExpensiveChart`, `Footer`는 전혀 영향받지 않습니다. `memo` 없이 달성한 최적화입니다.

## 실전 예제: 모달

```jsx
// 나쁜 예: 모달 상태를 최상위에
function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <HeavyDashboard />       {/* isModalOpen이 바뀌면 리렌더링 */}
      <AnotherHeavyComponent /> {/* 마찬가지 */}
      <button onClick={() => setIsModalOpen(true)}>열기</button>
      {isModalOpen && <Modal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
```

```jsx
// 좋은 예: 모달 상태를 관련 컴포넌트 안으로
function App() {
  return (
    <div>
      <HeavyDashboard />       {/* 모달과 무관, 리렌더링 없음 */}
      <AnotherHeavyComponent /> {/* 마찬가지 */}
      <ModalTrigger />          {/* 모달 상태가 여기 안에 */}
    </div>
  );
}

function ModalTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button onClick={() => setIsOpen(true)}>열기</button>
      {isOpen && <Modal onClose={() => setIsOpen(false)} />}
    </>
  );
}
```

## 반대 방향: 상태를 위로 올려야 할 때

Colocation의 반대는 **상태 끌어올리기(Lifting State Up)**입니다. 이것은 성능이 아니라 기능적 필요에 의한 것입니다.

```jsx
// 두 컴포넌트가 같은 상태를 공유해야 할 때
function Parent() {
  const [selectedId, setSelectedId] = useState(null); // 공통 부모로 올림

  return (
    <>
      <ItemList onSelect={setSelectedId} />        {/* 선택 변경 */}
      <ItemDetail selectedId={selectedId} />       {/* 선택 표시 */}
    </>
  );
}
```

상태를 올려야 할 때는 올리되, **두 컴포넌트의 공통 부모 이상으로는 올리지 않는 것**이 원칙입니다.

## 상태 위치 결정 체크리스트

```
이 상태를 어디에 둬야 할까?

1. 한 컴포넌트에서만 쓰인다
   → 그 컴포넌트 안에 (Colocation)

2. 부모-자식 관계에서 자식만 쓴다
   → 자식 안에 (아래로 내리기)

3. 형제 컴포넌트들이 공유한다
   → 공통 부모로 (끌어올리기)

4. 멀리 떨어진 여러 컴포넌트가 쓴다
   → Context 또는 Zustand
```

## 상태 분리로 리렌더링 범위 좁히기

하나의 컴포넌트에 여러 관련 없는 상태가 있다면 분리합니다.

```jsx
// 나쁜 예: 관련 없는 상태들이 한 컴포넌트에
function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  // sidebarOpen이 바뀌면 전체가 리렌더링
  return (
    <div>
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <Tabs selected={selectedTab} onSelect={setSelectedTab} />
      <TabContent tab={selectedTab} />
    </div>
  );
}
```

```jsx
// 좋은 예: 각 컴포넌트가 자신의 상태를 관리
function Dashboard() {
  return (
    <div>
      <Sidebar />     {/* 자체적으로 isOpen 관리 */}
      <SearchBar />   {/* 자체적으로 query 관리 */}
      <TabSection />  {/* 자체적으로 selectedTab 관리 */}
    </div>
  );
}
```

이제 사이드바를 열어도 탭 섹션은 리렌더링되지 않습니다.

## 정리

State Colocation의 핵심 원칙:

1. **상태는 그것을 사용하는 컴포넌트 가까이에 둔다**
2. **공유가 필요할 때만** 공통 부모로 올린다
3. 불필요하게 위에 올려진 상태를 찾아 내리는 것이 `memo`보다 효과적일 때가 많다

"이 상태가 정말 이 높이에 있어야 하나?"를 항상 스스로 묻는 습관을 들이세요. 대부분의 경우 상태를 내릴 수 있고, 그것만으로도 충분한 최적화가 됩니다.
