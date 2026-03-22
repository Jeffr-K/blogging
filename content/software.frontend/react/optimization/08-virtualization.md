---
title: "[React 성능 최적화] 8. 리스트 가상화: 수천 개 항목을 버벅임 없이 렌더링하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "optimization", "virtualization", "가상화", "react-window", "TanStack Virtual"]
---

# 리스트 가상화: 수천 개 항목을 버벅임 없이 렌더링하기

수천 개의 항목을 한 번에 렌더링하면 앱이 심하게 버벅입니다. 모든 DOM 노드를 만드는 것 자체가 너무 비싼 작업이기 때문입니다. **가상화(Virtualization)**는 현재 화면에 **보이는 항목만** 실제로 렌더링하고, 나머지는 DOM에서 제거해서 이 문제를 해결합니다.

## 문제 상황

```jsx
// 10,000개 항목을 그냥 렌더링
function HugeList({ items }) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
// → 10,000개의 DOM 노드 생성
// → 초기 렌더링 수초 소요, 스크롤 버벅임
```

## 가상화의 원리

```
스크롤 전:
  [항목 0]  ← 화면에 보임, DOM에 존재
  [항목 1]  ← 화면에 보임, DOM에 존재
  [항목 2]  ← 화면에 보임, DOM에 존재
  ...
  [빈 공간] ← 나머지 항목의 높이만큼 공간 확보

스크롤 후:
  [빈 공간] ← 지나간 항목의 높이만큼 공간 확보
  [항목 50] ← 화면에 보임, DOM에 존재
  [항목 51] ← 화면에 보임, DOM에 존재
  ...
```

실제 DOM에는 화면에 보이는 항목(약 10~20개)만 존재합니다. 스크롤하면 보이지 않는 것은 제거하고, 새로 보이는 것을 추가합니다. 사용자는 전체 목록을 보는 것 같지만, 실제 DOM은 항상 작습니다.

## react-window 사용법

```bash
npm install react-window
```

### FixedSizeList: 모든 항목 높이가 같을 때

```jsx
import { FixedSizeList } from 'react-window';

function VirtualizedList({ items }) {
  // 각 항목을 렌더링하는 함수
  const Row = ({ index, style }) => (
    <div style={style}>  {/* style은 위치 계산에 필요, 반드시 적용 */}
      {items[index].name}
    </div>
  );

  return (
    <FixedSizeList
      height={600}       // 리스트 컨테이너 높이 (px)
      width="100%"       // 너비
      itemCount={items.length}  // 전체 항목 수
      itemSize={50}      // 각 항목의 높이 (px)
    >
      {Row}
    </FixedSizeList>
  );
}
```

10,000개를 렌더링해도 DOM에는 약 12~15개만 존재합니다.

### VariableSizeList: 항목 높이가 다를 때

```jsx
import { VariableSizeList } from 'react-window';

// 각 항목의 높이를 반환하는 함수
const getItemSize = (index) => {
  return items[index].isExpanded ? 120 : 50;
};

function VirtualizedList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <p>{items[index].title}</p>
      {items[index].isExpanded && <p>{items[index].detail}</p>}
    </div>
  );

  return (
    <VariableSizeList
      height={600}
      width="100%"
      itemCount={items.length}
      itemSize={getItemSize}  // 함수로 각 항목 높이 계산
    >
      {Row}
    </VariableSizeList>
  );
}
```

### 무한 스크롤과 결합

```jsx
import { FixedSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

function InfiniteVirtualList({ items, loadMore, hasMore }) {
  const isItemLoaded = (index) => !hasMore || index < items.length;

  const Item = ({ index, style }) => {
    if (!isItemLoaded(index)) {
      return <div style={style}>로딩 중...</div>;
    }
    return <div style={style}>{items[index].name}</div>;
  };

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={hasMore ? items.length + 1 : items.length}
      loadMoreItems={loadMore}
    >
      {({ onItemsRendered, ref }) => (
        <FixedSizeList
          ref={ref}
          height={600}
          width="100%"
          itemCount={hasMore ? items.length + 1 : items.length}
          itemSize={50}
          onItemsRendered={onItemsRendered}
        >
          {Item}
        </FixedSizeList>
      )}
    </InfiniteLoader>
  );
}
```

## TanStack Virtual (react-virtual)

더 최신이고 유연한 대안입니다.

```bash
npm install @tanstack/react-virtual
```

```jsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function VirtualList({ items }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // 항목 높이 추정값
  });

  return (
    <div
      ref={parentRef}
      style={{ height: '600px', overflow: 'auto' }}
    >
      {/* 전체 목록의 높이를 확보 */}
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 가상화가 필요한 시점

| 항목 수 | 권장 |
|--------|------|
| ~100개 | 가상화 불필요 |
| 100~500개 | 상황에 따라 (항목이 복잡하면 고려) |
| 500개 이상 | 가상화 강력 권장 |
| 1000개 이상 | 가상화 필수 |

항목이 단순한 텍스트라면 1000개도 괜찮을 수 있지만, 이미지나 복잡한 레이아웃이 포함된 항목이라면 200~300개부터 문제가 생길 수 있습니다.

## 주의 사항

- **스크롤 위치 복원**: 라우트 이동 후 돌아왔을 때 스크롤 위치가 초기화됩니다. `initialScrollOffset` 또는 별도 저장 로직이 필요합니다.
- **항목 높이 동적 변경**: 내용에 따라 높이가 달라지는 경우 `VariableSizeList`를 쓰고, 렌더링 후 높이를 측정해서 업데이트해야 합니다.
- **검색/필터**: 항목이 줄어들어도 가상화 라이브러리가 이를 자동으로 처리합니다.

## 정리

| 라이브러리 | 특징 |
|----------|------|
| `react-window` | 가볍고 안정적, 고정 높이에 간단 |
| `@tanstack/react-virtual` | 최신, 더 유연, Grid도 지원 |

수백 개 이상의 항목을 렌더링할 때 `memo`로 최적화하는 것보다 **가상화가 훨씬 효과적**입니다. 항목 수가 많다면 가장 먼저 고려하세요.
