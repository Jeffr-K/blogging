---
title: "Jest-Cucumber: Jest 기반의 행위 주도 개발 실전 가이드"
author: jeffrey
date: 2026-04-13
tags: ["jest-cucumber", "bdd", "gherkin", "jest", "advanced-testing"]
---

## Jest-Cucumber: Jest 기반의 행위 주도 개발 실전 가이드

많은 팀이 BDD를 도입하고 싶어 하지만, Cucumber.js와 같은 별도의 도구를 설정하고 관리하는 비용 때문에 주저하곤 합니다. **`jest-cucumber`**는 이러한 고민을 해결해주는 대안으로, Jest의 강력한 기능 위에 Cucumber의 명세 능력을 얹은 라이브러리입니다.

본 아티클에서는 Jest 환경에서 Gherkin 시나리오를 어떻게 실행하고, 비즈니스 언어를 코드로 연결하는지 심층적으로 다룹니다.

---

### 1. 왜 `jest-cucumber`인가? (Motivation)

Jest는 이미 병렬 실행, 모킹, 스냅샷, 코드 커버리지 등 최고의 기능을 갖춘 테스트 러너입니다. 반면 Cucumber는 비즈니스 가독성이 높은 실행 가능한 명세서(Executable Specifications)를 만드는 데 탁월합니다.

`jest-cucumber`를 사용하면 다음과 같은 이득을 얻을 수 있습니다.

- **단일 런타임**: 단위 테스트와 인수 테스트(Acceptance Test)를 하나의 Jest 엔진에서 실행합니다.
- **IDE 통합**: VS Code의 Jest 익스텐션 등 기존 생태계를 그대로 활용할 수 있습니다.
- **동기화 보장**: Jest 테스트와 `.feature` 파일이 항상 일치하도록 강제합니다.

### 2. 시작하기: 설치 및 설정

먼저 필요한 패키지를 설치합니다.

```bash
npm install jest jest-cucumber --save-dev
```

그리고 `jest.config.js`에서 스텝 정의 파일을 찾을 수 있도록 설정합니다.

```json
{
  "testMatch": ["**/*.steps.ts"]
}
```

---

### 3. 실전 워크플로우

#### Step 1: Feature 파일 작성 (`logging-in.feature`)

기획자와 함께 자연어로 시나리오를 정의합니다.

```gherkin
Feature: 로그인 시스템

  Scenario: 유효한 비밀번호 입력
    Given 이전에 비밀번호를 생성한 사용자가 있다
    When 비밀번호를 올바르게 입력하면
    Then 시스템 접근이 허용되어야 한다
```

#### Step 2: Step Definition 작성 (`logging-in.steps.ts`)

`defineFeature`와 `loadFeature`를 사용하여 시나리오와 코드를 연결합니다.

```typescript
import { loadFeature, defineFeature } from 'jest-cucumber';
import { PasswordValidator } from './password-validator';

const feature = loadFeature('./features/logging-in.feature');

defineFeature(feature, (test) => {
  let validator: PasswordValidator;
  let isGranted = false;

  beforeEach(() => {
    validator = new PasswordValidator();
  });

  test('유효한 비밀번호 입력', ({ given, when, then }) => {
    given('이전에 비밀번호를 생성한 사용자가 있다', () => {
      validator.setPassword('1234');
    });

    when('비밀번호를 올바르게 입력하면', () => {
      isGranted = validator.validate('1234');
    });

    then('시스템 접근이 허용되어야 한다', () => {
      expect(isGranted).toBe(true);
    });
  });
});
```

---

### 4. 시니어의 조언: 글로벌 매칭 vs 로컬 매칭

표준 Cucumber는 스텝 코드를 전역적으로 공유하지만, `jest-cucumber`는 기본적으로 **로컬 스코프**를 권장합니다.

- **로컬 스코프 (권장)**: 개별 `.steps.ts` 파일이 특정 `.feature` 시나리오와 1:1로 대응됩니다. 테스트 코드만 봐도 시나리오 전체 흐름이 읽히므로 유지보수가 매우 쉽습니다.
- **글로벌 매칭 (`autoBindSteps`)**: 여러 피처 파일에서 동일한 문장을 공유하고 싶다면 `autoBindSteps` 기능을 사용할 수 있습니다. 중복은 줄어들지만, 코드가 비대해지면 스텝 정의를 찾기가 어려워지는 트레이드오프가 있습니다.

### 결론: 비즈니스 가치를 증명하는 테스트

`jest-cucumber`를 도입하는 것은 단순한 기술적 선택이 아닙니다. **"우리는 개발자끼리만 통하는 코드가 아니라, 비즈니스의 언어로 우리의 가치를 증명하겠다"**는 팀의 의지입니다.

기획자가 작성한 시나리오가 그대로 테스트 코드가 되고, 그 테스트가 Jest의 강력한 엔진 위에서 초록색 불을 밝힐 때, 비로소 기술과 비즈니스의 완벽한 결합이 이루어집니다.

---

> [!TIP]
> 비동기 작업이 포함된 시나리오의 경우, `given`, `when`, `then` 함수 내에서 `async/await`을 자유롭게 사용할 수 있습니다. Jest의 비동기 테스트 처리 방식과 완전히 동일하게 작동합니다.
