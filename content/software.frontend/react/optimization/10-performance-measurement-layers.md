---
title: "[React 성능 최적화] 10. 성능 측정 레이어: 어디서부터 어떻게 측정할까"
author: oscar.rs
date: 2026-03-22
tags: ["react", "optimization", "성능측정", "web-vitals", "profiler", "네트워크"]
---

# 성능 측정 레이어: 어디서부터 어떻게 측정할까

성능 최적화에서 가장 흔한 실수는 **증거 없이 최적화하는 것**입니다. `useMemo`와 `React.memo`를 곳곳에 붙였는데도 사용자는 여전히 느리다고 느끼는 경우가 많습니다. 왜냐면 병목이 React 렌더링이 아닌 다른 곳에 있었기 때문입니다.

성능 측정은 **바깥에서 안으로** 좁혀가야 합니다. 사용자가 느끼는 것부터 시작해서, 원인이 있는 레이어까지 파고드는 것이 올바른 순서입니다.

---

## 레이어 전체 구조

```
┌─────────────────────────────────┐
│   Layer 1. 사용자 체감 (Web Vitals)  │  ← 가장 먼저 확인
├─────────────────────────────────┤
│   Layer 2. 네트워크 / 번들           │
├─────────────────────────────────┤
│   Layer 3. React 렌더링             │
├─────────────────────────────────┤
│   Layer 4. 함수 / 연산              │  ← 가장 마지막에 확인
└─────────────────────────────────┘
```

---

## Layer 1. 사용자 체감 레이어 (Web Vitals)

**"실제 사용자가 느리다고 느끼는가?"**

가장 먼저 봐야 하는 레이어입니다. 여기서 문제가 없다면 아래 레이어를 볼 이유가 없습니다.

### Core Web Vitals

구글이 정의한 사용자 경험의 핵심 지표입니다. 검색 순위와도 연결됩니다.

| 지표 | 의미 | 좋음 | 개선 필요 |
|------|------|------|---------|
| **LCP** (Largest Contentful Paint) | 주요 콘텐츠가 화면에 나타나기까지 | < 2.5s | > 4s |
| **INP** (Interaction to Next Paint) | 클릭/입력 후 화면이 반응하기까지 | < 200ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | 레이아웃이 얼마나 갑자기 튀는가 | < 0.1 | > 0.25 |

### 측정 방법

**Lighthouse (가장 빠른 시작)**

```
Chrome DevTools → Lighthouse 탭 → Analyze page load
```

로컬 환경의 스냅샷 측정입니다. 실제 사용자 환경보다 좋게 나올 수 있습니다.

**web-vitals 라이브러리로 실제 사용자 데이터 수집**

```bash
npm install web-vitals
```

```jsx
// 앱 진입점에서 측정 시작
import { onLCP, onINP, onCLS } from 'web-vitals';

function sendToAnalytics(metric) {
  // 자체 분석 서버나 Google Analytics로 전송
  console.log(metric.name, metric.value, metric.rating);
  // rating: 'good' | 'needs-improvement' | 'poor'
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

실제 사용자들의 기기와 네트워크 환경에서 측정한 값이 가장 신뢰할 수 있습니다.

---

## Layer 2. 네트워크 / 번들 레이어

**"코드가 얼마나 크고, 얼마나 빨리 전달되는가?"**

LCP가 느리다면 대부분 이 레이어가 원인입니다.

### 번들 크기 분석

빌드 결과물에서 어떤 코드가 얼마나 큰 비중을 차지하는지 확인합니다.

```bash
# Vite
npm run build
npx vite-bundle-visualizer

# CRA
npm run build
npx source-map-explorer 'build/static/js/*.js'
```

시각화 결과에서 확인할 것:
- 특정 라이브러리가 번들의 지나치게 큰 비중을 차지하는가?
- 코드 스플리팅이 제대로 적용됐는가? (청크가 나뉘어 있는가?)
- 사용하지 않는 코드가 포함됐는가? (Tree shaking 미적용)

### Chrome DevTools Network 탭

```
DevTools → Network 탭 → 페이지 새로고침
```

확인할 것:
- **JS 파일 크기**: 첫 로딩에 받는 JS 총량
- **청크 분리 여부**: 여러 파일로 나뉘어 있는가, 하나의 거대한 파일인가
- **API 응답 시간**: 느린 API가 LCP나 INP에 영향을 주는가
- **Waterfall**: 요청들이 직렬로 일어나는 병목이 있는가

```
개선 방향:
JS 크기가 큼 → 코드 스플리팅, 불필요한 의존성 제거
API가 느림  → 백엔드 최적화 or React Query prefetch
요청 직렬화 → Promise.all로 병렬 요청
```

---

## Layer 3. React 렌더링 레이어

**"어떤 컴포넌트가 얼마나 자주, 얼마나 오래 렌더링되는가?"**

INP가 느리거나, 특정 인터랙션에서 버벅임이 느껴질 때 확인합니다.

### React DevTools Profiler

```
브라우저 확장 설치 → DevTools → Profiler 탭
→ 녹화(●) → 느린 동작 수행 → 중지(■)
```

**Flamegraph 읽는 법**

```
[App]                  100ms  ← 전체
  [Header]               3ms
  [Main]                95ms  ← 병목
    [ProductList]        90ms ← 더 깊은 병목
      [ProductCard] ×50   2ms × 50 = 100ms
```

색이 진하고 넓을수록 오래 걸린 컴포넌트입니다. 회색은 리렌더링되지 않은 컴포넌트(memo가 효과를 냈거나, 업데이트에 포함되지 않은 것)입니다.

**"왜 렌더링됐나" 설정 켜기**

Profiler 설정(⚙️) → "Record why each component rendered" 체크

```
ProductCard 리렌더링 이유:
Props changed:
  "onClick": [Function] → [Function]  ← 함수 참조가 바뀜
```

→ `useCallback` 적용 대상 발견

### `<Profiler>` 컴포넌트로 수치 수집

특정 컴포넌트의 렌더링 시간을 코드로 측정하고 기록합니다.

```jsx
import { Profiler } from 'react';

function App() {
  return (
    <Profiler
      id="ProductList"
      onRender={(id, phase, actualDuration, baseDuration) => {
        // actualDuration: memo 적용 후 실제 시간
        // baseDuration: memo 없이 전체를 렌더링했을 시간
        if (actualDuration > 16) { // 60fps 기준 1프레임 = 16ms
          console.warn(`[${id}] 느린 렌더링: ${actualDuration.toFixed(1)}ms`);
        }
      }}
    >
      <ProductList />
    </Profiler>
  );
}
```

`actualDuration`이 `baseDuration`보다 낮으면 `memo`가 효과를 내고 있는 것입니다.

### why-did-you-render: 불필요한 리렌더링 자동 감지

```bash
npm install @welldone-software/why-did-you-render --save-dev
```

```jsx
// src/wdyr.js (개발 환경 전용)
import React from 'react';

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, { trackAllPureComponents: true });
}
```

```jsx
// index.jsx 최상단 (React import 전에)
import './wdyr';
import React from 'react';
```

콘솔에서 불필요한 리렌더링이 발생하면 자동으로 이유를 출력합니다.

```
ProductCard re-rendered.
  Props changed: { onClick: [prev Function] !== [next Function] }
  (same value, different reference)
```

---

## Layer 4. 함수 / 연산 레이어

**"특정 계산이 실제로 얼마나 걸리는가?"**

`useMemo`를 적용할 만큼 연산이 정말 비싼지 확인할 때 사용합니다.

### console.time

```jsx
// useMemo 적용 전에 먼저 측정
console.time('filter-and-sort');
const result = products
  .filter(p => p.name.includes(query))
  .sort((a, b) => a.price - b.price);
console.timeEnd('filter-and-sort');
// → filter-and-sort: 0.12ms  (이러면 useMemo 불필요)
// → filter-and-sort: 23.4ms  (이러면 useMemo 적용 가치 있음)
```

### performance.now()

더 정밀한 측정이 필요할 때 사용합니다.

```jsx
function measureRender(fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`${(end - start).toFixed(3)}ms`);
  return result;
}

const filtered = measureRender(() =>
  products.filter(p => p.price > 10000)
);
```

**기준**: 1ms 미만이면 `useMemo` 불필요. 메모이제이션 자체 비용이 더 클 수 있습니다.

---

## 전체 측정 흐름

```
1. Lighthouse / web-vitals
   → LCP, INP, CLS 수치 확인
   → 문제 있는 지표 파악

2. 문제가 LCP라면 (첫 로딩 느림)
   → Network 탭으로 번들 크기, API 속도 확인
   → 번들 크기가 크면 → 코드 스플리팅, 의존성 정리
   → API가 느리면 → 백엔드 최적화, prefetch 적용

3. 문제가 INP라면 (인터랙션 느림)
   → React Profiler로 어떤 컴포넌트가 느린지 확인
   → why-did-you-render로 불필요한 리렌더링 원인 파악
   → 항목이 많다면 → 가상화 적용
   → 특정 연산이 느리다면 → console.time으로 측정 후 useMemo 적용

4. 최적화 적용 후 다시 1번으로
   → 개선됐는지 수치로 확인
```

---

## 레이어별 도구 정리

| 레이어 | 문제 증상 | 측정 도구 | 해결 방향 |
|--------|---------|---------|---------|
| **사용자 체감** | "전반적으로 느리다" | Lighthouse, web-vitals | 아래 레이어 탐색 시작 |
| **네트워크/번들** | 첫 로딩 느림 (LCP) | Network 탭, bundle visualizer | 코드 스플리팅, 의존성 정리 |
| **React 렌더링** | 인터랙션 느림 (INP), 스크롤 버벅임 | React Profiler, why-did-you-render | memo, 가상화, State Colocation |
| **함수/연산** | 특정 계산이 의심될 때 | console.time, performance.now | useMemo |

---

## 핵심 원칙

**"Web Vitals가 괜찮으면 나머지는 사용자가 느끼지 못한다."**

React Profiler에서 50ms를 10ms로 줄여도, Web Vitals 상 문제가 없는 앱이라면 사용자 경험에 실질적 차이가 없습니다. 반대로 번들이 5MB라면 아무리 `memo`를 붙여도 첫 로딩은 느립니다.

항상 바깥에서 안으로, 사용자 관점에서 시작하세요.
