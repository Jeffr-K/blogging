---
title: "왜 React Testing Library인가? 접근성과 사용자 관점의 중요성"
author: jeffrey
date: 2026-04-13
tags: ["testing-library", "accessibility", "dom-testing", "philosophy", "senior-insight"]
---

## 왜 React Testing Library인가? 접근성과 사용자 관점의 중요성

과거의 React 테스팅 생태계는 `Enzyme`이 지배하고 있었습니다. Enzyme은 컴포넌트의 내부 구조를 파헤치고, `state`를 직접 조작하며, `props`가 잘 전달되었는지를 검증하는 데 탁월했죠. 하지만 결과는 어땠나요? "코드는 잘 돌아가는데 사용자는 화면이 깨져 보인다는 버그 제보가 들어와요."라는 상황이 속출했습니다.

이 문제를 근본적으로 해결하며 등장한 것이 바로 **React Testing Library (RTL)**입니다.

---

### 1. 내부 구현이 아닌 '출력(DOM)'에 집중하라

RTL의 핵심 철학은 **"테스트가 소프트웨어의 사용 방식을 닮을수록, 더 많은 확신을 줄 수 있다"**는 것입니다.

Enzyme 방식과 RTL 방식의 결정적 차이를 코드로 비교해 봅시다.

#### ❌ 과거의 방식 (Enzyme 스타일)

```typescript
// 컴포넌트 내부의 상태와 속성에 의존함
const wrapper = shallow(<LoginForm />);
expect(wrapper.state('isLoading')).toBe(false);
wrapper.find('button').simulate('click');
expect(wrapper.state('isLoading')).toBe(true);
```

위 코드는 `isLoading`이라는 내부 변수명이 바뀌면 즉시 실패합니다. 사용자는 저 변수가 존재하는지도 모르는데 말이죠.

#### ✅ 현재의 표준 (RTL 방식)

```typescript
// 사용자가 화면에서 보고 행동하는 방식 그대로
render(<LoginForm />);
const loginButton = screen.getByRole('button', { name: /로그인/i });
fireEvent.click(loginButton);

// "로딩 중"이라는 텍스트가 화면에 나타나는지 확인
expect(screen.getByText(/로그인 중.../i)).toBeInTheDocument();
```

RTL은 컴포넌트 인스턴스가 아닌 **실제 렌더링 된 DOM**을 테스트합니다. 이는 리팩토링 내성을 극대화합니다.

---

### 2. 접근성(Accessibility)이 곧 최고의 쿼리 전략이다

RTL이 권장하는 `getByRole`, `getByLabelText`, `getByPlaceholderText` 등은 모두 웹 접근성 표준을 기반으로 합니다.

- **getByRole**: 시각 장애인이 스크린 리더를 사용할 때 인식하는 방식과 동일합니다.
- **getByLabelText**: 폼 요소와 라벨이 올바르게 연결되어 있는지 강제합니다.

만약 여러분이 RTL 테스트를 작성하기가 어렵다면, 그것은 테스트 코드가 문제인 것이 아니라 **해당 컴포넌트의 HTML 구조가 접근성 표준을 어기고 있을 가능성이 99%**입니다. RTL은 우리에게 "테스트하기 좋은 코드가 사실은 모든 사용자에게 친절한 코드"라는 점을 일깨워줍니다.

---

### 3. Senior's Insight: 라이트 테스팅의 트레이드오프

모든 것을 RTL로만 테스트하는 것이 정답일까요? 시니어의 관점에서는 아래의 트레이드오프를 고려해야 합니다.

1. **테스트 실행 속도**: RTL은 실제 DOM(또는 JSDOM) 환경에서 렌더링을 수행하므로 단위 로직 테스트보다 느립니다. 순수 비즈니스 로직(예: 복잡한 계산식)은 Jest의 순수 함수 테스트로 분리하십시오.
2. **복잡한 애니메이션**: CSS 애니메이션이나 레이아웃 이동을 RTL로 검증하는 것은 한계가 있습니다. 이런 부분은 Visual Regression Test(예: Storybook Test Runner)가 더 적합합니다.

### 결론: 도구는 철학을 반영한다

React Testing Library를 사용한다는 것은 단순한 라이브러리 교체가 아닙니다. **"나는 개발자의 편의가 아닌 사용자의 경험을 검증하겠다"**라는 선언입니다. 접근성을 준수하며 사용자 관점에서 작성된 테스트는 프로젝트의 생명력을 연장하는 가장 강력한 리팩토링 보험이 될 것입니다.

---

> [!NOTE]
> 다음 아티클에서는 `screen` API와 다양한 쿼리(Query) 메서드를 실전에서 어떻게 조합하여 사용하는지 구체적인 코드로 다룹니다.
