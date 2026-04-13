---
title: "실전 사례: 복잡한 비즈니스 폼과 전역 상태 관리의 무결성 테스트"
author: jeffrey
date: 2026-04-13
tags: ["real-world-case", "form-testing", "state-management", "integration-testing", "complex-domain"]
---

## 실전 사례: 복잡한 비즈니스 폼과 전역 상태 관리의 무결성 테스트

테스팅 마스터 시리즈의 마지막 단계입니다. 단순한 카운터를 넘어, 실무에서 마주치는 **'진짜 복잡한 문제'**를 코드로 풀어봅시다. 수십 개의 입력 필드, 조건부 렌더링, 외부 API 연동, 그리고 전역 상태가 뒤섞인 상황에서 우리는 어떻게 자신 있게 배포 버튼을 누를 수 있을까요?

---

### 1. 비즈니스 시나리오: 프로젝트 생성 마법사

우리가 테스트할 요구사항은 다음과 같습니다.

- **1단계**: 프로젝트 기본 정보 입력 (이름은 필수, 공백 불가)
- **2단계**: 팀원 초대 (최소 1명 이상 초대 필수)
- **3단계**: 설정 확인 및 제출 (제출 중에는 버튼 비활성화)

이 과정에서 상태는 **Zustand**나 **React Context**로 관리되고, 제출 후에는 결과 페이지로 이동합니다.

---

### 2. 통합 테스트 설계 (The Integration Test)

이런 복잡한 흐름은 단위 테스트 수십 개보다 **하나의 탄탄한 통합 테스트**가 훨씬 가치 있습니다.

```tsx
// ProjectWizard.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectWizard } from './ProjectWizard';

test('프로젝트 생성 전 과정을 성공적으로 완료한다', async () => {
  const user = userEvent.setup();
  render(<ProjectWizard />);
  
  // --- Step 1: 기본 정보 ---
  const nameInput = screen.getByLabelText(/프로젝트 이름/i);
  await user.type(nameInput, '신규 백엔드 고도화');
  await user.click(screen.getByRole('button', { name: /다음/i }));
  
  // --- Step 2: 팀원 초대 ---
  expect(screen.getByText(/팀원을 초대해주세요/i)).toBeInTheDocument();
  const emailInput = screen.getByPlaceholderText(/이메일 입력/i);
  await user.type(emailInput, 'jeffrey@example.com');
  await user.click(screen.getByRole('button', { name: /추가/i }));
  
  expect(screen.getByText('jeffrey@example.com')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /다음/i }));
  
  // --- Step 3: 최종 제출 ---
  const submitButton = screen.getByRole('button', { name: /생성하기/i });
  await user.click(submitButton);
  
  // 제출 중 상태 확인
  expect(submitButton).toBeDisabled();
  expect(screen.getByText(/생성 중.../i)).toBeInTheDocument();
  
  // 완료 페이지 이동 확인
  await waitFor(() => {
    expect(screen.getByText(/프로젝트가 생성되었습니다!/i)).toBeInTheDocument();
  });
});
```

---

### 3. 복잡한 폼 검증의 핵심 전략

1. **상태(State)를 보지 마라**: 유저에게 보이는 에러 메시지(`screen.getByText(/필수 항목입니다/i)`)가 나타나는지를 확인하세요. 폼 라이브러리(React Hook Form 등)의 내부 상태를 조회하는 것은 지양해야 합니다.
2. **현실적인 데이터**: `faker.js` 등을 활용하여 실제와 유사한 데이터를 입력하세요.
3. **엣지 케이스 포함**: "만약 2단계에서 '뒤로 가기'를 눌렀을 때 1단계 데이터가 유지되는가?"와 같은 시나리오를 통합 테스트에 추가하십시오. 전역 상태 관리 로직의 무결성을 검증하는 가장 좋은 방법입니다.

---

### 4. Senior's Insight: 테스트 주도 리팩토링의 쾌감

복잡한 컴포넌트일수록 테스트 코드는 빛을 발합니다.

어느 날 기획자가 "팀원 초대 시 권한 설정 기능을 추가해 주세요"라고 요청한다면? 여러분은 기존 테스트 코드를 믿고 과감하게 컴포넌트를 난도질할 수 있습니다. 수정을 마친 후 `vitest run`을 때렸을 때 나타나는 **초록색 PASS 메시지**는 시니어 개발자가 밤잠을 설치지 않게 해주는 유일한 보약입니다.

---

### 시리즈를 마치며: 테스팅은 '비용'이 아닌 '투자'입니다

많은 팀이 "바빠서 테스트 짤 시간이 없어요"라고 말합니다. 하지만 역설적으로 **바쁘고 복잡한 프로젝트일수록 테스트가 없으면 나중에 '수습하는 시간'이 '개발하는 시간'보다 많아지게 됩니다.**

오늘 우리가 다룬 프론트엔드 테스팅 전략들이 여러분의 코드베이스를 더 풍요롭고 견고하게 만들기를 바랍니다. 완벽한 코드는 없지만, **'증명된 코드'**는 있습니다.

---

> [!TIP]
> 이제 이 지식을 바탕으로 여러분의 프로젝트에 단 하나의 '핵심 유저 시나리오' 통합 테스트부터 작성해 보세요. 그것이 위대한 아키텍처의 시작입니다.
