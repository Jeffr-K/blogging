---
title: "BDD: 기획자와 개발자의 언어를 하나로 묶는 기술"
author: jeffrey
date: 2026-04-13
tags: ["bdd", "given-when-then", "ubiquitous-language", "software-quality", "collaboration"]
---

## BDD: 기획자와 개발자의 언어를 하나로 묶는 기술

"기존 문법이 너무 개발자스러워요." TDD를 하던 많은 팀이 느낀 한계였습니다. **행위 주도 개발(BDD, Behavior Driven Development)**은 TDD에서 파생되었지만, 초점은 코드의 단위가 아니라 **'사용자의 행위와 비즈니스의 가치'**에 맞춥니다. BDD는 테스트 코드를 기획서 그 자체로 만듭니다.

---

### 1. BDD의 핵심: Given - When - Then

BDD는 누구나 이해할 수 있는 자연어에 가까운 구조(Gherkin 등)를 사용합니다.

- **Given (상황)**: 테스트를 수행하기 위한 사전 조건과 환경이 주어졌을 때
- **When (사건)**: 사용자가 특정 행동(Action)을 요청했을 때
- **Then (결과)**: 시스템은 예상된 결과와 상태의 변화를 보여주어야 한다

이 구조는 개발자뿐만 아니라 기획자, QA, 비즈니스 담당자 모두가 테스트 코드를 읽고 "우리가 의도한 대로 동작하는군"이라고 판단할 수 있게 해줍니다.

---

### 2. 대표적인 도구: Cucumber와 Gherkin

BDD를 실무에 적용할 때 가장 널리 쓰이는 표준 도구가 바로 **Cucumber**입니다. Cucumber는 영문(혹은 한글)으로 작성된 **Gherkin** 파일을 읽어 실제 테스트 코드와 매핑해줍니다.

[example.feature (Cucumber/Gherkin)](https://www.npmjs.com/package/jest-cucumber)

```gherkin
Feature: 결제 할인 시스템
  Scenario: VIP 회원은 주문 시 10% 할인을 받는다.
    Given VIP 회원 등급인 사용자가 로그인을 했을 때
    When 10,000원짜리 상품을 장바구니에 담고 결제를 요청하면
    Then 최종 결제 금액은 9,000원이 되어야 한다.
```

이렇게 작성된 시나리오는 기술적인 배경이 없는 비즈니스 파트너와 개발자 사이의 **'살아있는 명세서'**가 됩니다.

> [!TIP]
> 만약 이미 **Jest**를 메인 테스팅 도구로 사용하고 있다면, [jest-cucumber](https://www.npmjs.com/package/jest-cucumber) 라이브러리를 활용해 보세요. 별도의 Cucumber 러너를 띄울 필요 없이, Jest 환경 안에서 Gherkin 시나리오를 실행하고 Step Definition을 작성할 수 있어 환경 통합이 매우 간편해집니다.

---

### 3. TDD vs BDD: 무엇이 다른가?

- **TDD (Target: Code)**: `calculate() 함수가 10을 반환하는가?` (구현 중심)
- **BDD (Target: Behavior)**: `VIP 회원이 결제할 때 10% 할인이 정확히 적용되는가?` (행위 중심)

사실 기술적으로는 둘 다 비슷한 방식으로 테스트를 수행하지만, BDD는 **'유비쿼터스 언어(Ubiquitous Language)'**를 사용하여 비즈니스 시나리오를 코드로 치환하는 데 더 큰 가치를 둡니다.

### 4. 살아서 숨 쉬는 명세서 (Living Specification)

문서화는 항상 어렵습니다. 코드를 고치고 나면 문서는 낡게 되죠. 하지만 BDD 스타일로 작성된 테스트는 코드를 고칠 때 함께 수정되어야만 테스트가 통과하므로, 항상 **'최신 상태의 기획서'** 역할을 수행합니다. 이것이 바로 BDD가 추구하는 **'살아있는 문서화'**의 힘입니다.

---

### 결론: 언어의 장벽을 허물어라

소프트웨어 개발에서 가장 비싼 비용은 **'의사소통의 실패'**에서 나옵니다.

BDD를 도입한다는 것은 기획서의 문장을 그대로 테스트 코드로 옮기는 작업입니다. Given-When-Then의 리듬에 맞춰 시나리오를 작성하십시오. 개발자가 기획자의 언어를 이해하고 기획자가 개발자의 테스트 결과를 신뢰할 때, 비로소 고품질의 제품이 탄생합니다.
 Jennifer 정 (Senior Collaboration Specialist)
