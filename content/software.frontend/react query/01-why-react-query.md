---
title: "[React Query 시리즈] 1. 왜 React Query인가: 서버 상태 관리의 문제"
author: oscar.rs
date: 2026-03-22
tags: ["react", "react-query", "tanstack-query", "서버상태", "데이터페칭"]
---

# 왜 React Query인가: 서버 상태 관리의 문제

React로 앱을 만들다 보면 대부분의 상태는 **서버에서 가져온 데이터**입니다. 사용자 목록, 게시글, 프로필 정보 등은 모두 API를 통해 받아옵니다. 그런데 이런 데이터를 `useState` + `useEffect`로 직접 관리하면 생각보다 훨씬 복잡해집니다.

## 직접 관리할 때의 현실

간단해 보이는 데이터 fetching도 실제로는 이런 코드가 됩니다.

```jsx
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false; // 컴포넌트 언마운트 후 setState 방지
    setLoading(true);
    setError(null);

    fetch('/api/users')
      .then(res => {
        if (!res.ok) throw new Error('서버 오류');
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setUsers(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error}</div>;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

그리고 이것만으로는 부족합니다. 다음 요구사항들이 생깁니다.

- **데이터 캐싱**: 같은 데이터를 페이지 이동할 때마다 다시 불러오지 않으려면?
- **백그라운드 갱신**: 탭을 다시 포커스했을 때 최신 데이터로 갱신하려면?
- **중복 요청 제거**: 같은 API를 여러 컴포넌트에서 동시에 부르면?
- **에러 재시도**: 네트워크 오류 시 자동으로 재시도하려면?
- **낙관적 업데이트**: 뮤테이션 후 응답 전에 UI를 먼저 업데이트하려면?
- **페이지네이션**: 다음 페이지 데이터를 어떻게 관리하려면?

이것들을 직접 구현하면 수백 줄의 복잡한 코드가 됩니다.

## 클라이언트 상태 vs 서버 상태

근본적인 문제는 **두 종류의 상태를 같은 방식으로 관리하려 한 것**입니다.

| | 클라이언트 상태 | 서버 상태 |
|--|--------------|---------|
| 예시 | 모달 열림/닫힘, 폼 입력값, 선택된 탭 | 사용자 목록, 게시글, 설정 |
| 위치 | 내 브라우저 메모리 | 서버 DB |
| 소유권 | 내가 완전히 소유 | 서버가 소유, 나는 복사본 |
| 특성 | 동기적, 항상 최신 | 비동기, 오래되면 stale |
| 관리 도구 | useState, useReducer | React Query, SWR |

서버 상태는 클라이언트 상태와 근본적으로 다릅니다. 서버 상태는:
- 언제든 **내 모르게 서버에서 바뀔 수** 있습니다
- **비동기**로 가져와야 합니다
- 내가 가진 것은 **언젠가 구식이 될 복사본**입니다

React Query는 **서버 상태를 클라이언트와 동기화**하는 데 특화된 도구입니다. 공식적으로는 "Async State Management"라고 부릅니다.

## React Query로 바꾸면

```jsx
import { useQuery } from '@tanstack/react-query';

function UserList() {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(res => res.json()),
  });

  if (isLoading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error.message}</div>;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

위 코드는 단순히 짧은 게 아닙니다. 이 안에는 이미 다음이 포함되어 있습니다.

- **캐싱**: 같은 `queryKey`로 다시 요청하면 캐시된 데이터를 즉시 반환
- **중복 제거**: 동시에 여러 컴포넌트가 같은 쿼리를 요청해도 API는 한 번만 호출
- **백그라운드 갱신**: 탭 포커스, 네트워크 재연결 시 자동으로 최신 데이터 확인
- **에러 재시도**: 실패 시 자동으로 3번 재시도
- **로딩/에러 상태**: 별도로 관리할 필요 없음

## 설치

```bash
npm install @tanstack/react-query
```

```jsx
// main.jsx 또는 App.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <ReactQueryDevtools /> {/* 개발용 디버거 */}
    </QueryClientProvider>
  );
}
```

`QueryClientProvider`는 앱 최상단에 한 번만 추가합니다. 내부의 모든 컴포넌트에서 React Query를 사용할 수 있게 됩니다.

## 정리

React Query는 **서버 상태를 클라이언트와 동기화**하는 모든 복잡성을 대신 처리해줍니다. 캐싱은 그 수단 중 하나일 뿐입니다. `invalidateQueries`, `refetchOnWindowFocus`, `staleTime`, Optimistic Update 같은 기능들도 모두 "서버 데이터가 바뀌었을 때 클라이언트를 어떻게 정합하게 유지하느냐"라는 같은 문제를 해결합니다.

직접 구현해야 했던 것들:
- ❌ 로딩/에러 상태 관리
- ❌ 캐싱 및 중복 요청 제거
- ❌ 백그라운드 갱신 (탭 포커스, 네트워크 재연결)
- ❌ 재시도 로직
- ❌ 뮤테이션 후 관련 데이터 무효화
- ❌ 경쟁 조건(race condition) 처리

React Query 를 쓰면 이 모든 것이 기본으로 제공됩니다. 개발자는 "어떤 데이터를 어디서 가져오는지"와 "뮤테이션 후 어떤 데이터를 다시 동기화할지"만 정의하면 됩니다.
