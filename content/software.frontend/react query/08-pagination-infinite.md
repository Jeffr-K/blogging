---
title: "[React Query 시리즈] 8. Pagination & useInfiniteQuery: 페이지 데이터 다루기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "react-query", "pagination", "useInfiniteQuery", "무한스크롤"]
---

# Pagination & useInfiniteQuery: 페이지 데이터 다루기

목록 데이터는 대부분 **페이지 단위**로 가져옵니다. React Query는 일반 페이지네이션과 무한 스크롤 모두를 잘 지원합니다.

## 일반 페이지네이션

페이지 번호를 queryKey에 포함하면 각 페이지가 별도로 캐싱됩니다.

```jsx
function TodoList() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['todos', { page }],
    queryFn: () => fetchTodos({ page, limit: 10 }),
    placeholderData: keepPreviousData, // 페이지 전환 시 이전 데이터 유지
  });

  return (
    <div>
      {isLoading ? (
        <Spinner />
      ) : (
        <ul>
          {data.items.map(todo => <li key={todo.id}>{todo.title}</li>)}
        </ul>
      )}

      <div>
        <button
          onClick={() => setPage(p => p - 1)}
          disabled={page === 1}
        >
          이전
        </button>
        <span>{page} / {data?.totalPages}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={isPlaceholderData || page === data?.totalPages}
        >
          다음
        </button>
      </div>
    </div>
  );
}
```

### keepPreviousData

`placeholderData: keepPreviousData`를 설정하면 페이지 전환 시 새 데이터를 가져오는 동안 이전 페이지 데이터를 계속 보여줍니다. 화면이 깜빡이지 않습니다.

- `isPlaceholderData`: 현재 보이는 데이터가 이전 페이지 데이터(placeholder)인지 여부

### 다음 페이지 미리 가져오기

```jsx
const queryClient = useQueryClient();

// 현재 페이지 렌더링 후 다음 페이지 미리 가져오기
useEffect(() => {
  if (page < data?.totalPages) {
    queryClient.prefetchQuery({
      queryKey: ['todos', { page: page + 1 }],
      queryFn: () => fetchTodos({ page: page + 1, limit: 10 }),
    });
  }
}, [page, data]);
```

페이지 전환 버튼을 클릭하는 순간 이미 데이터가 캐시에 있으므로 즉시 보여집니다.

## useInfiniteQuery: 무한 스크롤

"더 보기" 버튼이나 무한 스크롤은 `useInfiniteQuery`가 적합합니다.

```jsx
import { useInfiniteQuery } from '@tanstack/react-query';

function InfiniteTodoList() {
  const {
    data,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['todos', 'infinite'],
    queryFn: ({ pageParam }) => fetchTodos({ page: pageParam, limit: 10 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      // 다음 페이지가 있으면 페이지 번호 반환, 없으면 undefined
      return lastPage.hasNextPage ? allPages.length + 1 : undefined;
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      {/* data.pages: 각 페이지 응답의 배열 */}
      {data.pages.map((page, i) => (
        <Fragment key={i}>
          {page.items.map(todo => (
            <div key={todo.id}>{todo.title}</div>
          ))}
        </Fragment>
      ))}

      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? '불러오는 중...' : hasNextPage ? '더 보기' : '모두 불러옴'}
      </button>
    </div>
  );
}
```

### 데이터 구조 이해

```
data.pages = [
  { items: [todo1, todo2, ...], hasNextPage: true },   // 1페이지
  { items: [todo11, todo12, ...], hasNextPage: true },  // 2페이지
  { items: [todo21, todo22, ...], hasNextPage: false }, // 3페이지
]
```

각 페이지 응답이 배열로 쌓입니다. UI에서는 이것을 펼쳐서(flat) 하나의 목록처럼 보여줍니다.

## Intersection Observer로 자동 무한 스크롤

"더 보기" 버튼 대신, 목록 끝에 도달하면 자동으로 다음 페이지를 불러올 수 있습니다.

```jsx
function AutoInfiniteList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['todos', 'infinite'],
    queryFn: ({ pageParam }) => fetchTodos({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
  });

  // 관찰할 요소 (목록 맨 아래에 배치)
  const loadMoreRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div>
      {data?.pages.map((page, i) => (
        <Fragment key={i}>
          {page.items.map(item => <TodoCard key={item.id} todo={item} />)}
        </Fragment>
      ))}

      {/* 이 요소가 화면에 보이면 다음 페이지 로드 */}
      <div ref={loadMoreRef}>
        {isFetchingNextPage && <Spinner />}
      </div>
    </div>
  );
}
```

## 페이지네이션 vs 무한 스크롤 선택 기준

| | 페이지네이션 | 무한 스크롤 |
|--|------------|-----------|
| 적합한 UX | 특정 페이지로 직접 이동해야 할 때 | 피드, SNS, 뉴스 목록 |
| URL 연동 | 용이 (쿼리스트링) | 복잡 |
| 특정 항목 위치 | 파악 가능 | 어려움 |
| 모바일 UX | 보통 | 자연스러움 |

## 정리

- **페이지네이션**: queryKey에 page를 포함, `keepPreviousData`로 깜빡임 방지
- **무한 스크롤**: `useInfiniteQuery` 사용, `getNextPageParam`으로 다음 페이지 결정
- **미리 가져오기**: `prefetchQuery`로 다음 페이지를 미리 캐싱하면 즉각적인 전환 가능
