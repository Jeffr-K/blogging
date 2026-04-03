---
title: "[TDD 시리즈] 19. Gherkin — 비개발자도 읽는 테스트 명세"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "BDD", "Gherkin", "Cucumber", "시나리오", "LivingDocumentation"]
---

# Gherkin — 비개발자도 읽는 테스트 명세

BDD의 아이디어는 좋다. 비즈니스, QA, 개발자가 함께 예시를 만든다. 그런데 그 예시를 어디에 어떻게 기록할 것인가? 이메일에 쓰면 묻힌다. Wiki에 쓰면 코드와 분리된다. Gherkin은 이 문제를 해결하기 위해 만들어진 언어다. 자연어처럼 읽히지만 자동화된 테스트로 실행된다.

## Gherkin 문법 핵심

Gherkin은 몇 가지 키워드만 알면 된다.

```gherkin
Feature: 장바구니 상품 추가
  고객이 원하는 상품을 장바구니에 담아 나중에 구매할 수 있다.

  Background:
    Given 카탈로그에 다음 상품이 등록되어 있다
      | 상품명       | 가격   | 재고 |
      | 블루투스 이어폰 | 89000 | 10  |
      | USB-C 케이블  | 12000 | 0   |

  Scenario: 재고 있는 상품을 장바구니에 추가한다
    Given 빈 장바구니를 가진 고객이 있다
    When 고객이 "블루투스 이어폰"을 1개 장바구니에 담는다
    Then 장바구니에 상품이 1개 있다
    And 장바구니 총액은 89000원이다

  Scenario: 재고 없는 상품은 장바구니에 추가할 수 없다
    Given 빈 장바구니를 가진 고객이 있다
    When 고객이 "USB-C 케이블"을 1개 장바구니에 담으려 한다
    Then 장바구니 담기가 실패한다
    And "재고가 부족합니다" 메시지가 표시된다

  Scenario: 이미 담긴 상품을 추가하면 수량이 합산된다
    Given "블루투스 이어폰" 2개가 담긴 장바구니를 가진 고객이 있다
    When 고객이 "블루투스 이어폰"을 1개 더 장바구니에 담는다
    Then 장바구니에 "블루투스 이어폰"이 3개 있다
```

**Feature**: 기능 단위. 짧은 설명과 비즈니스 가치 서술.
**Background**: 모든 시나리오에 공통으로 적용되는 사전 조건.
**Scenario**: 하나의 구체적 예시. 독립적으로 실행 가능해야 한다.
**Given**: 사전 조건. 세계의 상태를 설정한다.
**When**: 행동. 사용자 또는 시스템이 수행하는 동작.
**Then**: 기대 결과. 검증 가능한 결과여야 한다.
**And / But**: 이전 키워드를 이어받아 가독성을 높인다.

## 선언적 vs 명령적 시나리오

Gherkin 시나리오를 망치는 가장 흔한 실수는 UI 동작을 그대로 기술하는 것이다.

```gherkin
# 나쁜 예: 명령적 시나리오 (UI 단계를 나열)
Scenario: 로그인한다
  Given 브라우저에서 "https://example.com/login" 페이지를 연다
  When "#email" 필드에 "user@example.com"을 입력한다
  And "#password" 필드에 "secret123"을 입력한다
  And "로그인" 버튼을 클릭한다
  Then URL이 "https://example.com/dashboard"가 된다
```

이 시나리오의 문제점이 있다. 로그인 폼 ID가 바뀌면 시나리오가 깨진다. 비개발자가 읽어도 "무엇을 하는 것인지"는 이해하지만 "왜 중요한지"는 이해하기 어렵다. 비즈니스 규칙이 드러나지 않는다.

```gherkin
# 좋은 예: 선언적 시나리오 (의도를 표현)
Scenario: 유효한 자격증명으로 로그인하면 대시보드로 이동한다
  Given 등록된 사용자 "user@example.com"이 있다
  When 사용자가 올바른 비밀번호로 로그인한다
  Then 사용자의 대시보드가 표시된다
```

선언적 시나리오는 구현 세부사항과 분리된다. UI가 완전히 재설계되어도 시나리오는 그대로 유효하다.

## Scenario Outline: 데이터 드리븐 테스트

여러 입력값에 대해 동일한 시나리오를 반복할 때 `Scenario Outline`을 사용한다.

```gherkin
Feature: 주문 할인 정책

  Scenario Outline: 주문 금액에 따라 할인율이 적용된다
    Given 장바구니 총액이 <주문금액>원이다
    When 주문을 확정한다
    Then 최종 결제 금액은 <결제금액>원이다
    And 적용된 할인율은 <할인율>이다

    Examples:
      | 주문금액 | 결제금액 | 할인율 |
      | 50000  | 50000  | 0%    |
      | 100000 | 90000  | 10%   |
      | 300000 | 255000 | 15%   |
      | 500000 | 400000 | 20%   |
```

`Examples` 테이블의 각 행이 독립적인 시나리오가 된다. 경계값(100000, 300000, 500000)을 명시적으로 기술하기 때문에 비즈니스 담당자도 정책을 한눈에 파악할 수 있다.

## Cucumber 연동: 시나리오를 코드로

Gherkin 시나리오는 Step Definition으로 연결된다. TypeScript + Jest-Cucumber 예시다.

```typescript
// features/cart.feature 의 스텝 정의

import { defineFeature, loadFeature } from 'jest-cucumber';
import { Cart } from '../../src/domain/Cart';
import { Product } from '../../src/domain/Product';
import { CartService } from '../../src/application/CartService';
import { InMemoryProductRepository } from '../fakes/InMemoryProductRepository';

const feature = loadFeature('./features/cart.feature');

defineFeature(feature, (test) => {
  let cart: Cart;
  let service: CartService;
  let productRepo: InMemoryProductRepository;
  let lastError: Error | null;

  beforeEach(() => {
    productRepo = new InMemoryProductRepository();
    service = new CartService(productRepo);
    lastError = null;
  });

  test('재고 있는 상품을 장바구니에 추가한다', ({ given, when, then, and }) => {
    given('빈 장바구니를 가진 고객이 있다', () => {
      cart = Cart.empty();
    });

    when('고객이 "블루투스 이어폰"을 1개 장바구니에 담는다', () => {
      cart = service.addItem(cart, '블루투스 이어폰', 1);
    });

    then('장바구니에 상품이 1개 있다', () => {
      expect(cart.itemCount()).toBe(1);
    });

    and('장바구니 총액은 89000원이다', () => {
      expect(cart.totalPrice()).toBe(89000);
    });
  });

  test('재고 없는 상품은 장바구니에 추가할 수 없다', ({ given, when, then, and }) => {
    given('빈 장바구니를 가진 고객이 있다', () => {
      cart = Cart.empty();
    });

    when('고객이 "USB-C 케이블"을 1개 장바구니에 담으려 한다', () => {
      try {
        cart = service.addItem(cart, 'USB-C 케이블', 1);
      } catch (e) {
        lastError = e as Error;
      }
    });

    then('장바구니 담기가 실패한다', () => {
      expect(lastError).not.toBeNull();
    });

    and('"재고가 부족합니다" 메시지가 표시된다', () => {
      expect(lastError?.message).toBe('재고가 부족합니다');
    });
  });
});
```

Step Definition을 보면 알 수 있다. 각 스텝이 도메인 객체와 서비스를 직접 호출한다. HTTP 요청이나 UI 렌더링 없이 도메인 레벨에서 인수 테스트를 실행할 수 있다.

## 시나리오 작성 원칙

좋은 시나리오와 나쁜 시나리오를 가르는 원칙 세 가지가 있다.

**구체적이어야 한다.** "많은 상품"이 아니라 "5개의 상품"이라고 써라. "비싼 주문"이 아니라 "200000원 이상의 주문"이라고 써라. 모호한 시나리오는 모호한 구현을 낳는다.

**단일 행동을 검증해야 한다.** 하나의 시나리오에서 여러 기능을 동시에 검증하면 실패했을 때 원인을 알기 어렵다. "로그인하고 상품을 주문하고 결제한다"는 세 개의 시나리오다.

**독립적이어야 한다.** 시나리오 A가 통과해야 시나리오 B를 실행할 수 있는 구조는 금물이다. 각 시나리오는 Background나 Given 스텝으로 필요한 상태를 직접 만든다.

## Living Documentation: 시나리오가 문서가 된다

Cucumber를 실행하면 시나리오 결과가 HTML 리포트로 출력된다. 이 리포트는 기획서나 Wiki와 달리 코드와 항상 동기화된다.

```
Feature: 장바구니 상품 추가
  ✅ 재고 있는 상품을 장바구니에 추가한다
  ✅ 재고 없는 상품은 장바구니에 추가할 수 없다
  ✅ 이미 담긴 상품을 추가하면 수량이 합산된다
  ✅ Scenario Outline: 주문 금액에 따라 할인율이 적용된다
     ✅ 50000원 → 할인 없음
     ✅ 100000원 → 10% 할인
     ✅ 300000원 → 15% 할인
     ✅ 500000원 → 20% 할인
```

이 리포트를 팀 Wiki에 자동 게시하거나 CI/CD 결과로 공유하면, 비즈니스 담당자도 "합의한 것이 실제로 동작하는가"를 매 배포마다 확인할 수 있다. 문서를 별도로 관리할 필요가 없다. 테스트가 통과하면 그것이 문서다.

Gherkin은 문법을 익히는 데 하루면 충분하다. 하지만 좋은 시나리오를 쓰는 것은 연습이 필요하다. 핵심은 도구가 아니라 대화다. Three Amigos가 합의한 예시를 Gherkin으로 옮기는 것뿐이다.
