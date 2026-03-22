---
title: "[React 훅 시리즈] 8. useLayoutEffect: DOM을 측정하고 즉시 반응하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "hooks", "useLayoutEffect", "DOM", "layout"]
---

# `useLayoutEffect`: DOM을 측정하고 즉시 반응하기

`useLayoutEffect`는 `useEffect`와 거의 동일하지만, **실행 타이밍**이 다릅니다. 이 차이가 언제 어떤 것을 써야 하는지를 결정합니다.

## useEffect vs useLayoutEffect: 실행 순서

React의 렌더링 흐름을 단계별로 보면 이렇습니다.

```
1. React가 컴포넌트를 계산하고 가상 DOM을 업데이트
2. React가 실제 DOM에 변경 사항을 반영
3. 브라우저가 화면에 그림을 그림 (Paint)
```

- `useEffect`: 3번(Paint) **이후**에 실행됩니다. 화면이 먼저 그려지고 나서 실행됩니다.
- `useLayoutEffect`: 2번과 3번 **사이**에 실행됩니다. DOM에 반영은 됐지만 아직 화면에 그리기 전에 실행됩니다.

```
DOM 업데이트 → [useLayoutEffect 실행] → 화면 그리기 → [useEffect 실행]
```

## 언제 useLayoutEffect를 써야 할까?

대부분의 경우에는 `useEffect`로 충분합니다. `useLayoutEffect`가 필요한 상황은 **DOM 크기나 위치를 측정한 뒤 즉시 DOM을 조정해야 할 때**입니다.

`useEffect`를 쓰면 화면이 한 번 그려진 뒤에 DOM을 수정하므로, 사용자에게 **깜빡임(flickering)**이 보일 수 있습니다. `useLayoutEffect`는 화면이 그려지기 전에 DOM을 수정하므로 깜빡임이 없습니다.

### 예제: 툴팁 위치 계산

```jsx
function Tooltip({ targetRef, content }) {
  const tooltipRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!tooltipRef.current || !targetRef.current) return;

    const target = targetRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();

    // DOM 측정 후 즉시 위치 계산
    setPosition({
      top: target.top - tooltip.height - 8,
      left: target.left + (target.width - tooltip.width) / 2,
    });
  });

  return (
    <div
      ref={tooltipRef}
      style={{ position: 'fixed', top: position.top, left: position.left }}
    >
      {content}
    </div>
  );
}
```

`useEffect`로 작성하면 툴팁이 잠깐 잘못된 위치에 렌더링됐다가 올바른 위치로 이동하는 깜빡임이 생깁니다. `useLayoutEffect`는 화면이 그려지기 전에 위치를 계산하므로 이 문제가 없습니다.

## 주의사항

### 서버 사이드 렌더링(SSR)과 호환 안 됨

`useLayoutEffect`는 브라우저 DOM이 있어야 동작합니다. Next.js 같은 SSR 환경에서는 서버에서 렌더링될 때 경고가 발생합니다.

```jsx
// SSR 환경에서 안전하게 사용하는 패턴
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
```

### 성능 영향

`useLayoutEffect`는 화면 그리기를 막고(blocking) 실행됩니다. 오래 걸리는 작업을 여기에 넣으면 사용자가 화면이 느리게 그려진다고 느낄 수 있습니다.

## 정리

| | `useEffect` | `useLayoutEffect` |
|--|------------|------------------|
| 실행 시점 | 화면 그린 **후** | 화면 그리기 **전** |
| 화면 블로킹 | 없음 | 있음 |
| 깜빡임 가능성 | 있음 | 없음 |
| 기본 선택 | ✅ 대부분의 경우 | DOM 측정/조정이 필요할 때만 |

**원칙**: `useEffect`를 기본으로 사용하고, 깜빡임 문제가 발생할 때만 `useLayoutEffect`로 교체하세요.
