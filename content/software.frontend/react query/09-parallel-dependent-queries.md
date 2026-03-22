---
title: "[React Query 시리즈] 9. 병렬 & 의존 쿼리: 여러 쿼리를 조합하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "react-query", "parallel-queries", "dependent-queries", "useQueries"]
---

# 병렬 & 의존 쿼리: 여러 쿼리를 조합하기

실제 앱에서는 여러 API를 동시에 호출하거나, 한 API의 결과를 바탕으로 다른 API를 호출해야 하는 경우가 많습니다.

## 병렬 쿼리 (Parallel Queries)

여러 `useQuery`를 나란히 쓰면 기본적으로 병렬 실행됩니다.

```jsx
function Dashboard() {
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const postsQuery = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });
  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: fetchStats });

  // 세 API 요청이 동시에 실행됨
  if (usersQuery.isLoading || postsQuery.isLoading || statsQuery.isLoading) {
    return <Spinner />;
  }

  return (
    <div>
      <UserList users={usersQuery.data} />
      <PostList posts={postsQuery.data} />
      <StatsPanel stats={statsQuery.data} />
    </div>
  );
}
```

## useQueries: 동적 개수의 병렬 쿼리

쿼리 개수가 렌더링 시점에 결정된다면 `useQueries`를 사용합니다. 훅은 조건부로 호출할 수 없기 때문입니다.

```jsx
import { useQueries } from '@tanstack/react-query';

function UserProfiles({ userIds }) {
  // userIds 배열 길이에 따라 동적으로 쿼리 생성
  const queries = useQueries({
    queries: userIds.map(id => ({
      queryKey: ['user', id],
      queryFn: () => fetchUser(id),
    })),
  });

  // queries: [{ data, isLoading, ... }, { data, isLoading, ... }, ...]
  const isLoading = queries.some(q => q.isLoading);
  const users = queries.map(q => q.data).filter(Boolean);

  if (isLoading) return <Spinner />;
  return (
    <div>
      {users.map(user => <UserCard key={user.id} user={user} />)}
    </div>
  );
}
```

```jsx
// combine 옵션: 여러 쿼리 결과를 하나로 합치기
const { users, isLoading } = useQueries({
  queries: userIds.map(id => ({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
  })),
  combine: (results) => ({
    users: results.map(r => r.data).filter(Boolean),
    isLoading: results.some(r => r.isLoading),
  }),
});
```

## 의존 쿼리 (Dependent Queries)

첫 번째 쿼리 결과가 있어야 두 번째 쿼리를 실행할 수 있는 경우, `enabled`를 활용합니다.

```jsx
function UserPosts({ userId }) {
  // 1단계: 사용자 정보 가져오기
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  // 2단계: 사용자의 팀 ID가 있을 때만 팀 정보 가져오기
  const { data: team } = useQuery({
    queryKey: ['team', user?.teamId],
    queryFn: () => fetchTeam(user.teamId),
    enabled: !!user?.teamId, // user.teamId가 있을 때만 실행
  });

  return (
    <div>
      <p>사용자: {user?.name}</p>
      <p>팀: {team?.name ?? '팀 없음'}</p>
    </div>
  );
}
```

`enabled: !!user?.teamId`로 인해:
- `user`가 아직 로딩 중이면 → 두 번째 쿼리 실행 안 됨
- `user`는 있지만 `teamId`가 없으면 → 두 번째 쿼리 실행 안 됨
- `user.teamId`가 있으면 → 두 번째 쿼리 실행

## 의존 쿼리 체인

여러 단계로 이어지는 경우도 같은 방식으로 처리합니다.

```jsx
function OrderDetails({ orderId }) {
  // 1단계: 주문 정보
  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
  });

  // 2단계: 주문의 사용자 정보 (order가 있을 때만)
  const { data: user } = useQuery({
    queryKey: ['user', order?.userId],
    queryFn: () => fetchUser(order.userId),
    enabled: !!order?.userId,
  });

  // 3단계: 사용자의 배송지 (user가 있을 때만)
  const { data: address } = useQuery({
    queryKey: ['address', user?.addressId],
    queryFn: () => fetchAddress(user.addressId),
    enabled: !!user?.addressId,
  });

  return <div>...</div>;
}
```

## 모든 쿼리가 완료된 후 처리

```jsx
function TeamDashboard({ teamId }) {
  const membersQuery = useQuery({
    queryKey: ['team', teamId, 'members'],
    queryFn: () => fetchTeamMembers(teamId),
  });

  const projectsQuery = useQuery({
    queryKey: ['team', teamId, 'projects'],
    queryFn: () => fetchTeamProjects(teamId),
  });

  const allLoaded = !membersQuery.isLoading && !projectsQuery.isLoading;
  const hasError = membersQuery.isError || projectsQuery.isError;

  if (!allLoaded) return <Spinner />;
  if (hasError) return <ErrorMessage />;

  return (
    <div>
      <MemberList members={membersQuery.data} />
      <ProjectList projects={projectsQuery.data} />
    </div>
  );
}
```

## Suspense 모드와 병렬 쿼리

`suspense: true` 옵션을 사용하면 모든 쿼리가 완료될 때까지 Suspense fallback을 보여줍니다.

```jsx
function Dashboard() {
  // 각 useQuery에 suspense 옵션 추가
  const { data: users } = useSuspenseQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const { data: posts } = useSuspenseQuery({ queryKey: ['posts'], queryFn: fetchPosts });

  // 로딩 체크 불필요 - Suspense가 처리
  return (
    <div>
      <UserList users={users} />
      <PostList posts={posts} />
    </div>
  );
}

// 부모에서 Suspense로 감쌈
<Suspense fallback={<Spinner />}>
  <Dashboard />
</Suspense>
```

## 정리

| 패턴 | 방법 | 사용 시점 |
|------|------|---------|
| 병렬 쿼리 | 여러 `useQuery` 나란히 | 독립적인 데이터를 동시에 가져올 때 |
| 동적 병렬 | `useQueries` | 쿼리 개수가 동적일 때 |
| 의존 쿼리 | `enabled` 조건 | 이전 쿼리 결과가 필요할 때 |
