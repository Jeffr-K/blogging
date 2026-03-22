---
title: "[React 패턴 시리즈] 6. 관심사 분리: UI와 로직을 나누는 방법"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "separation-of-concerns", "관심사분리", "커스텀훅"]
---

# 관심사 분리: UI와 로직을 나누는 방법

**관심사 분리(Separation of Concerns)**는 소프트웨어 설계의 오래된 원칙입니다. 서로 다른 역할을 하는 코드는 서로 다른 곳에 있어야 한다는 뜻입니다. React에서 이것은 주로 **UI(렌더링)와 로직(데이터, 상태)을 분리**하는 것을 의미합니다.

## 분리하지 않은 컴포넌트

```jsx
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    setLoading(true);
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filteredUsers = useMemo(() => {
    return users
      .filter(u => u.name.includes(searchQuery))
      .sort((a, b) =>
        sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      );
  }, [users, searchQuery, sortOrder]);

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error}</div>;

  return (
    <div>
      <input
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="검색..."
      />
      <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
        정렬: {sortOrder}
      </button>
      <ul>
        {filteredUsers.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

하나의 컴포넌트에 API 호출, 필터링, 정렬, 렌더링이 모두 섞여 있습니다. 로직만 테스트하고 싶어도 컴포넌트 전체를 마운트해야 합니다.

## 관심사 분리: 로직을 훅으로 분리

로직을 커스텀 훅으로 꺼냅니다.

```jsx
// useUserList.js - 로직만 담당
function useUserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    setLoading(true);
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filteredUsers = useMemo(() => {
    return users
      .filter(u => u.name.includes(searchQuery))
      .sort((a, b) =>
        sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      );
  }, [users, searchQuery, sortOrder]);

  const toggleSort = () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');

  return { filteredUsers, loading, error, searchQuery, setSearchQuery, sortOrder, toggleSort };
}
```

```jsx
// UserList.jsx - UI만 담당
function UserList() {
  const {
    filteredUsers,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    sortOrder,
    toggleSort,
  } = useUserList();

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error}</div>;

  return (
    <div>
      <input
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="검색..."
      />
      <button onClick={toggleSort}>정렬: {sortOrder}</button>
      <ul>
        {filteredUsers.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

컴포넌트는 이제 받아온 데이터를 어떻게 그릴지만 신경 씁니다.

## 더 나아가기: Presentational & Container 분리

로직을 담당하는 컴포넌트(Container)와 표현만 담당하는 컴포넌트(Presentational)를 분리하는 패턴입니다.

```jsx
// Presentational: UI만, 상태 없음, 순수하게 props만 받음
function UserListView({ users, searchQuery, onSearchChange, sortOrder, onToggleSort }) {
  return (
    <div>
      <input value={searchQuery} onChange={onSearchChange} />
      <button onClick={onToggleSort}>정렬: {sortOrder}</button>
      <ul>
        {users.map(user => <li key={user.id}>{user.name}</li>)}
      </ul>
    </div>
  );
}

// Container: 로직만, JSX 최소화
function UserListContainer() {
  const { filteredUsers, loading, error, ...handlers } = useUserList();

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error}</div>;

  return <UserListView users={filteredUsers} {...handlers} />;
}
```

`UserListView`는 완전히 순수합니다. 어떤 데이터든 props로 받으면 그것을 그립니다. 스토리북(Storybook)에서 UI만 독립적으로 개발하거나, 테스트에서 다양한 데이터로 렌더링을 확인할 때 편리합니다.

## 어느 정도로 분리해야 할까?

모든 컴포넌트를 항상 분리할 필요는 없습니다.

**분리가 도움이 되는 경우**
- 같은 로직을 여러 곳에서 쓸 때
- 로직을 독립적으로 테스트하고 싶을 때
- 컴포넌트가 너무 길어져서 읽기 힘들 때
- UI를 스토리북 등에서 독립적으로 개발할 때

**분리가 오히려 복잡성을 늘리는 경우**
- 한 곳에서만 쓰이는 단순한 컴포넌트
- 로직이 UI와 강하게 결합되어 있어 분리의 이점이 없을 때

## 정리

관심사 분리의 핵심은 "이 코드가 무엇을 책임지는가"를 명확히 하는 것입니다.

| 역할 | 담당 |
|------|------|
| 데이터 가져오기, 상태 관리 | 커스텀 훅 |
| 비즈니스 로직, 계산 | 커스텀 훅 또는 순수 함수 |
| 화면 그리기 | 컴포넌트 |

컴포넌트가 커스텀 훅으로부터 데이터와 핸들러를 받아 JSX를 반환하는 구조가 되면, 각 파일의 역할이 분명해지고 코드를 이해하기 쉬워집니다.
