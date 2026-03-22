---
title: "[React Query 시리즈] 5. 캐싱 전략: staleTime과 gcTime 이해하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "react-query", "caching", "staleTime", "gcTime", "캐싱"]
---

# 캐싱 전략: staleTime과 gcTime 이해하기

React Query의 핵심 강점은 **스마트한 캐싱**입니다. 두 가지 핵심 개념인 `staleTime`과 `gcTime`을 이해하면, 어떤 상황에서 API를 호출하고 언제 캐시를 사용하는지 정확히 알 수 있습니다.

## 데이터의 두 가지 상태: fresh vs stale

React Query는 캐시된 데이터를 두 가지 상태로 구분합니다.

- **fresh**: 신선한 데이터. 백그라운드 재요청 없이 그대로 사용합니다.
- **stale**: 오래된 데이터. 기회가 생기면 백그라운드에서 새로 가져옵니다.

```
데이터 fetch 완료
      ↓
  [fresh 상태]  ← staleTime 동안 유지
      ↓ (staleTime 경과)
  [stale 상태]  ← 캐시에는 남아있지만 "구식"으로 표시
      ↓ (트리거 발생: 포커스, 마운트, 네트워크 재연결)
  백그라운드에서 새로 fetch
```

## staleTime: 얼마나 오래 fresh로 유지할까?

`staleTime`은 데이터가 **fresh 상태로 유지되는 시간**입니다.

```jsx
useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,
  staleTime: 1000 * 60 * 5, // 5분간 fresh
});
```

- 기본값: `0` (즉시 stale, fetch 후 바로 "구식"으로 표시)
- staleTime 내에는 같은 쿼리를 다시 마운트해도 API 호출 없이 캐시를 그대로 반환합니다

```jsx
// staleTime: 5분 설정 시
// 1분 전에 데이터를 가져왔다면
// → 같은 컴포넌트를 다시 마운트해도 API 호출 없음
// → 6분 후 다시 마운트하면 백그라운드에서 새로 fetch
```

**staleTime 설정 기준:**

| 데이터 종류 | 권장 staleTime |
|-----------|--------------|
| 실시간 데이터 (채팅, 주가) | `0` (기본값) |
| 자주 바뀌는 데이터 (할 일 목록) | `30초 ~ 1분` |
| 가끔 바뀌는 데이터 (사용자 프로필) | `5분 ~ 10분` |
| 거의 안 바뀌는 데이터 (국가 목록, 카테고리) | `Infinity` |

```jsx
// 국가 목록처럼 거의 변하지 않는 데이터
useQuery({
  queryKey: ['countries'],
  queryFn: fetchCountries,
  staleTime: Infinity, // 앱이 살아있는 동안 항상 fresh
});
```

## gcTime: 캐시를 언제 지울까?

`gcTime`(Garbage Collection Time)은 컴포넌트가 언마운트된 후 **캐시를 메모리에 얼마나 보관할지**를 결정합니다.

```jsx
useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,
  gcTime: 1000 * 60 * 10, // 10분간 캐시 보관 (기본값: 5분)
});
```

- 기본값: `5분`
- 쿼리를 구독하는 컴포넌트가 없어지면 타이머가 시작됩니다
- `gcTime`이 지나면 캐시에서 완전히 제거됩니다

```
컴포넌트 언마운트
      ↓
  gcTime 타이머 시작
      ↓ (gcTime 동안)
  캐시 메모리에 유지
  (다시 마운트하면 즉시 캐시 데이터 표시 후 백그라운드 fetch)
      ↓ (gcTime 경과)
  캐시에서 완전히 제거
  (다시 마운트하면 로딩 스피너 표시)
```

## staleTime vs gcTime 관계

```
[데이터 fetch]
      │
      ▼ (staleTime 경과)
[stale 상태]  ← 여전히 캐시에 있음, 기회가 되면 재fetch
      │
컴포넌트 언마운트
      │
      ▼ (gcTime 경과)
[캐시 제거]  ← 메모리에서 완전히 사라짐
```

**중요**: `staleTime`은 항상 `gcTime`보다 작아야 합니다. stale해진 데이터가 캐시에서 사라지기 전에 갱신되어야 의미가 있기 때문입니다.

## 백그라운드 재fetch 트리거

데이터가 stale 상태일 때 다음 상황이 발생하면 백그라운드에서 새로 가져옵니다.

```jsx
useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,
  refetchOnWindowFocus: true,     // 탭 포커스 (기본값: true)
  refetchOnMount: true,           // 컴포넌트 마운트 (기본값: true)
  refetchOnReconnect: true,       // 네트워크 재연결 (기본값: true)
  refetchInterval: 1000 * 30,     // 30초마다 폴링 (기본값: false)
});
```

`refetchOnWindowFocus`가 기본으로 켜져 있어서, 다른 탭을 갔다가 돌아오면 자동으로 최신 데이터로 갱신됩니다. 사용자가 느끼기에 앱이 항상 최신 상태인 것처럼 동작합니다.

## 전역 기본값 설정

모든 쿼리에 공통 설정을 적용할 수 있습니다.

```jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,      // 기본 staleTime: 1분
      gcTime: 1000 * 60 * 10,   // 기본 gcTime: 10분
      retry: 1,                  // 기본 재시도: 1회
      refetchOnWindowFocus: false, // 탭 포커스 재조회 끄기
    },
  },
});
```

개별 쿼리에서 설정하면 전역 설정을 덮어씁니다.

## 실전 시나리오

```jsx
// 시나리오: 사용자가 목록 페이지 → 상세 페이지 → 목록 페이지로 이동

// staleTime: 0, gcTime: 5분 (기본값)
// → 상세 페이지 갔다 오면 목록 API 재호출 (stale이므로)
//   하지만 gcTime 내라면 이전 데이터를 먼저 보여주면서 백그라운드 갱신

// staleTime: 5분, gcTime: 10분
// → 5분 내라면 목록 페이지로 돌아와도 API 호출 없음 (fresh이므로)
//   5분 이후라면 이전 데이터를 즉시 보여주고 백그라운드에서 갱신
```

## 정리

| 옵션 | 역할 | 기본값 |
|------|------|-------|
| `staleTime` | 데이터가 fresh로 유지되는 시간 | `0` |
| `gcTime` | 언마운트 후 캐시 보관 시간 | `5분` |
| 관계 | `staleTime` ≤ `gcTime`이어야 함 | - |

- `staleTime`이 클수록 API 호출이 줄어듭니다
- `gcTime`이 클수록 페이지 이동 시 즉각적인 UI 표시가 가능합니다
- 데이터 특성에 맞게 설정하는 것이 핵심입니다
