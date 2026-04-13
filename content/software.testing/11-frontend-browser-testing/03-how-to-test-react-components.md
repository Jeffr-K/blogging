---
title: "실전 React 테스트: 훅(Hooks), 사용자 이벤트, DOM 쿼리 마스터하기"
author: jeffrey
date: 2026-04-13
tags: ["react-testing", "user-event", "hooks-testing", "vitest", "how-to"]
---

## 실전 React 테스트: 훅(Hooks), 사용자 이벤트, DOM 쿼리 마스터하기

이론을 넘어 이제 손으로 익힐 시간입니다. 현대적인 프론트엔드 테스트 환경의 표준인 **Vitest**와 **React Testing Library**를 사용하여, 실제 컴포넌트를 어떻게 견고하게 검증하는지 핵심 패턴 3가지를 살펴보겠습니다.

---

### 1. AAA 패턴으로 작성하는 기본 컴포넌트 테스트

모든 테스트는 **Arrange(준비)**, **Act(실행)**, **Assert(검증)**의 명확한 흐름을 가져야 합니다.

#### 예제: 수량 조절 카운터 컴포넌트

```tsx
// Counter.tsx
export const Counter = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span data-testid="count-value">{count}</span>
      <button onClick={() => setCount(count + 1)}>증가</button>
    </div>
  );
};

// Counter.test.tsx (Vitest + RTL)
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';

test('증가 버튼을 클릭하면 숫자가 1 증가한다', async () => {
  // 1. Arrange
  const user = userEvent.setup();
  render(<Counter />);
  const countDisplay = screen.getByTestId('count-value');
  const incrementButton = screen.getByRole('button', { name: /증가/i });

  // 2. Act
  await user.click(incrementButton);

  // 3. Assert
  expect(countDisplay).toHaveTextContent('1');
});
```

> [!IMPORTANT]
> `fireEvent` 대신 `user-event` 라이브러리를 사용하세요. `user-event`는 실제 브라우저의 전 과정을 시뮬레이션(Focus, KeyDown, KeyUp 등)하므로 더 신뢰도 높은 테스트를 제공합니다.

---

### 2. 비동기 작업 및 로딩 상태 테스트

API 호출이나 타이머가 포함된 비동기 로직은 `find*` 쿼리와 `waitFor`를 활용합니다.

```tsx
test('데이터 로딩 후 목록이 화면에 표시된다', async () => {
  render(<UserList />);
  
  // 로딩 상태 확인
  expect(screen.getByText(/불러오는 중/i)).toBeInTheDocument();
  
  // 비동기 요소 대기 (기본 1000ms 대기)
  const items = await screen.findAllByRole('listitem');
  
  expect(items).toHaveLength(5);
  expect(screen.queryByText(/불러오는 중/i)).not.toBeInTheDocument();
});
```

---

### 3. 커스텀 훅(Custom Hooks) 테스트하기

컴포넌트와 분리된 비즈니스 로직을 담은 훅은 `renderHook`을 사용하여 테스트합니다.

```tsx
// useCounter.ts
export const useCounter = () => {
  const [count, setCount] = useState(0);
  const increment = () => setCount((prev) => prev + 1);
  return { count, increment };
};

// useCounter.test.ts
import { renderHook, act } from '@testing-library/react';

test('increment를 호출하면 count가 증가한다', () => {
  const { result } = renderHook(() => useCounter());

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);
});
```

---

### 🎯 Senior's Insight: `queryBy`, `getBy`, `findBy`의 올바른 선택

시니어 개발자는 상황에 맞는 쿼리를 직관적으로 선택합니다.

| 쿼리 타입 | 요소가 없을 때 | 비동기 대기 | 주요 용도 |
| :--- | :--- | :--- | :--- |
| **getBy*** | **에러 발생** | No | 요소가 반드시 존재해야 함을 보장할 때 |
| **queryBy*** | **null 반환** | No | 요소가 **존재하지 않음**을 검증할 때 (`.not.toBeInTheDocument()`) |
| **findBy*** | **에러 발생** | **Yes (Promise)** | API 호출 등 요소를 기다려야 할 때 |

### 결론: 무엇을 테스트하지 않을 것인가?

테스트 코드를 작성할 때 가장 중요한 질문은 "이 테스트가 내 코드에 자유를 주는가, 족쇄를 채우는가?"입니다. 라이브러리 자체의 기능(예: `useState`가 잘 동작하는지)을 테스트하지 마십시오. 오직 **입력(사용자 행위)**과 **출력(DOM의 변화)** 사이의 관계에만 집중하십시오.

---

> [!NOTE]
> 다음 아티클에서는 Next.js 환경에서의 특수한 테스팅, 특히 서버 컴포넌트(RSC)와 API 라우트를 어떻게 다루는지 알아봅니다.
