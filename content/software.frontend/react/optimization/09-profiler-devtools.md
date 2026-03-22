---
title: "[React 성능 최적화] 9. 성능 측정: Profiler와 DevTools 활용법"
author: oscar.rs
date: 2026-03-22
tags: ["react", "optimization", "profiler", "devtools", "성능측정"]
---

# 성능 측정: Profiler와 DevTools 활용법

최적화의 황금률은 **"측정 먼저, 최적화 나중"**입니다. 어디가 느린지 모르고 최적화하면 실제 문제와 다른 곳에 시간을 쓸 수 있습니다. React는 성능을 측정하는 도구를 기본으로 제공합니다.

## React DevTools Profiler

브라우저 확장 설치 후 DevTools에서 "Profiler" 탭을 사용합니다.

```
설치: Chrome/Firefox 웹스토어에서 "React Developer Tools" 검색
```

### 기본 사용법

1. DevTools 열기 → Profiler 탭
2. 녹화 버튼(●) 클릭
3. 앱에서 느린 동작 수행
4. 녹화 중지(■) 클릭
5. 결과 분석

### Flamegraph 읽기

```
[App]              100ms
  [Header]          5ms
  [Main]            90ms
    [ProductList]   85ms ← 가장 오래 걸림
      [ProductCard]  2ms × 50개
    [Sidebar]        3ms
  [Footer]           2ms
```

- 넓고 진한 색 = 렌더링에 오래 걸림
- 회색 = 리렌더링되지 않음 (memo 효과 있음)
- 점선 = 왜 리렌더링됐는지 이유 표시

### "왜 렌더링됐나" 확인

Profiler 설정에서 **"Record why each component rendered while profiling"** 옵션을 켜면, 각 컴포넌트가 왜 리렌더링됐는지 이유를 보여줍니다.

```
ProductCard 리렌더링 이유:
- Props changed: "onClick" (이전: [Function], 현재: [Function])
```

→ `onClick` 함수의 참조가 바뀌고 있음 → `useCallback` 필요

## `<Profiler>` 컴포넌트: 코드에서 측정

특정 컴포넌트의 렌더링 성능을 코드로 측정합니다.

```jsx
import { Profiler } from 'react';

function onRenderCallback(
  id,           // Profiler의 id prop
  phase,        // "mount" 또는 "update"
  actualDuration,  // 실제 렌더링 시간 (ms)
  baseDuration,    // memo 없이 렌더링하면 걸릴 시간
  startTime,
  commitTime,
) {
  console.log(`[${id}] ${phase}: ${actualDuration.toFixed(2)}ms`);
}

function App() {
  return (
    <Profiler id="ProductList" onRender={onRenderCallback}>
      <ProductList />
    </Profiler>
  );
}
```

```
콘솔 출력:
[ProductList] mount: 45.23ms
[ProductList] update: 12.10ms
[ProductList] update: 11.87ms
```

`actualDuration`이 `baseDuration`보다 낮다면 `memo`가 효과를 내고 있는 것입니다.

## Chrome Performance 탭

React DevTools 외에 브라우저 내장 Performance 탭으로 전체적인 병목을 찾을 수 있습니다.

```
1. Chrome DevTools → Performance 탭
2. 녹화 시작
3. 느린 동작 수행
4. 녹화 중지
5. Main 스레드 분석
```

**Long Tasks**(빨간색으로 표시, 50ms 이상)를 찾아 무엇이 원인인지 확인합니다.

## why-did-you-render: 불필요한 리렌더링 추적

개발 모드에서 불필요한 리렌더링을 자동으로 감지해 콘솔에 출력합니다.

```bash
npm install @welldone-software/why-did-you-render --save-dev
```

```jsx
// src/wdyr.js (개발 환경에서만)
import React from 'react';

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true, // memo 컴포넌트 전체 추적
  });
}
```

```jsx
// main.jsx 또는 index.jsx 최상단에서 import
import './wdyr'; // 반드시 React import 전에!
import React from 'react';
```

```jsx
// 특정 컴포넌트만 추적
function ProductCard({ product }) {
  return <div>{product.name}</div>;
}
ProductCard.whyDidYouRender = true; // 이 컴포넌트의 리렌더링 추적
```

콘솔 출력:
```
ProductCard re-rendered because of prop changes:
  prev: { onClick: [Function] }
  next: { onClick: [Function] }
  (equal by value but different reference)
```

→ 함수 참조가 바뀌고 있음을 즉시 알 수 있습니다.

## 성능 최적화 워크플로

```
1. 사용자 또는 측정으로 성능 문제 발견
       ↓
2. Chrome Performance로 Long Task 식별
       ↓
3. React Profiler로 느린 컴포넌트 찾기
       ↓
4. why-did-you-render로 불필요한 리렌더링 이유 파악
       ↓
5. 원인에 맞는 최적화 적용
   - 불필요한 리렌더링 → memo, useMemo, useCallback
   - 상태 위치 문제    → State Colocation
   - 긴 목록          → 가상화
   - 큰 번들          → 코드 스플리팅
       ↓
6. 다시 측정해서 효과 확인
```

## 빠른 점검 체크리스트

**리렌더링이 의심될 때**
```
□ Profiler에서 리렌더링 이유를 확인했는가?
□ 함수/객체 props가 매번 새 참조로 전달되고 있지 않은가?
□ 상태가 불필요하게 높은 곳에 있지 않은가?
□ Context에 너무 많은 값이 섞여 있지 않은가?
```

**첫 로딩이 느릴 때**
```
□ 번들 크기를 분석했는가?
□ 라우트 단위 코드 스플리팅을 적용했는가?
□ 큰 서드파티 라이브러리를 동적 import 했는가?
```

**스크롤이 버벅일 때**
```
□ 목록 항목이 몇 개인가? (100개 이상이면 가상화 고려)
□ 각 항목 컴포넌트의 렌더링이 얼마나 걸리는가?
```

## 정리

| 도구 | 용도 |
|------|------|
| React DevTools Profiler | 어떤 컴포넌트가 느린지 시각화 |
| `<Profiler>` 컴포넌트 | 코드에서 직접 렌더링 시간 측정 |
| Chrome Performance | 전체 메인 스레드 병목 분석 |
| why-did-you-render | 불필요한 리렌더링 원인 자동 감지 |

최적화는 증거 기반으로 해야 합니다. "느릴 것 같아서" 미리 최적화하는 것은 코드만 복잡하게 만듭니다. 측정하고, 원인을 찾고, 적용하고, 다시 측정하세요.
