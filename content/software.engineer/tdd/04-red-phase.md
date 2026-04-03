---
title: "[TDD 시리즈] 4. Red — 실패하는 테스트가 설계를 이끈다"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "Red", "테스트 설계", "API 설계", "장바구니"]
---

# Red — 실패하는 테스트가 설계를 이끈다

Red-Green-Refactor 사이클의 첫 단계, Red는 가장 많이 오해받는 단계다. 단순히 "테스트를 먼저 쓴다"가 아니다. 아직 존재하지 않는 코드를 사용하는 테스트를 작성하면서 **사용하는 사람 관점에서 설계를 탐색**하는 단계다.

## 왜 테스트를 먼저 쓰는가

구현을 먼저 하면 만든 사람의 관점에서 설계가 결정된다. 테스트를 먼저 쓰면 사용하는 사람의 관점에서 설계가 시작된다.

```typescript
// 구현 먼저: 만드는 사람 관점
class DiscountCalculator {
  // 내가 편한 방식으로 설계
  computeWithAppliedDiscount(
    rawAmount: number,
    discountConfig: { type: string; value: number; conditions: object }
  ): { amount: number; appliedRules: string[] } { ... }
}

// 테스트 먼저: 사용하는 사람 관점
// 테스트를 쓰면서 "어떻게 호출하고 싶은가"를 먼저 결정한다
it('10만원 이상 구매 시 10% 할인을 적용한다', () => {
  const calculator = new CartDiscountCalculator();

  const result = calculator.calculate(110000);

  expect(result).toBe(99000);
});
```

두 번째 방식에서 `calculate`는 인자가 단순하고 반환값도 직접적이다. 사용하는 입장에서 필요한 것만 드러난다.

## 컴파일 오류도 실패다

TypeScript에서 TDD를 할 때 중요한 원칙이 있다. **컴파일 오류도 Red 상태**다. 존재하지 않는 클래스를 테스트에서 참조하면 컴파일 오류가 난다. 이것이 첫 번째 Red다.

컴파일이 통과할 때까지 최소한의 인터페이스를 정의하는 것이 Green으로 가는 첫 걸음이다.

```typescript
// 1단계: 테스트 작성 — 컴파일 오류 (Red)
import { CartDiscountCalculator } from './CartDiscountCalculator';
//                ^--- 파일이 없음: 컴파일 오류

describe('CartDiscountCalculator', () => {
  it('10만원 이상 구매 시 10% 할인을 적용한다', () => {
    const calculator = new CartDiscountCalculator(); // 클래스 없음
    const result = calculator.calculate(110000);     // 메서드 없음
    expect(result).toBe(99000);
  });
});

// 2단계: 컴파일만 통과하는 최소 인터페이스 정의
// CartDiscountCalculator.ts
export class CartDiscountCalculator {
  calculate(amount: number): number {
    return 0; // 구현 없음, 컴파일만 통과
  }
}
// 이제 컴파일은 통과하지만 테스트는 실패 — Red 유지
```

인터페이스를 정의하는 단계에서 이미 설계 결정이 일어난다. 클래스 이름, 메서드 이름, 파라미터 타입, 반환 타입.

## 테스트 이름 작성법

테스트 이름은 코드의 명세다. 나쁜 테스트 이름은 테스트를 무의미하게 만든다.

```typescript
// 나쁜 테스트 이름 — 무엇을 검증하는지 불명확
it('할인 계산기 테스트', () => { ... });
it('calculate works', () => { ... });
it('test1', () => { ... });

// 좋은 테스트 이름 — 조건과 기대 결과가 명확
it('10만원 이상 구매 시 10% 할인을 적용한다', () => { ... });
it('10만원 미만 구매 시 할인을 적용하지 않는다', () => { ... });
it('할인 적용 후 금액이 0원 이하면 0원을 반환한다', () => { ... });
```

**패턴 1: `[조건] + [기대 결과]`**

```typescript
it('VIP 회원이 구매하면 15% 할인을 적용한다', () => { ... });
it('재고가 0개이면 구매할 수 없다', () => { ... });
```

**패턴 2: `should_[기대 결과]_when_[조건]`**

```typescript
it('should_apply_10_percent_discount_when_amount_is_over_100000', () => { ... });
```

**패턴 3: `describe` 계층으로 조건 분리**

```typescript
describe('CartDiscountCalculator', () => {
  describe('10만원 이상 구매 시', () => {
    it('10% 할인을 적용한다', () => { ... });
    it('할인 후 금액을 반환한다', () => { ... });
  });

  describe('10만원 미만 구매 시', () => {
    it('할인을 적용하지 않는다', () => { ... });
    it('원래 금액을 그대로 반환한다', () => { ... });
  });
});
```

## 하나의 테스트, 하나의 이유

하나의 테스트는 하나의 이유로만 실패해야 한다. 여러 동작을 한 테스트에서 검증하면 어디가 문제인지 알기 어렵다.

```typescript
// 나쁜 예: 여러 이유로 실패할 수 있다
it('장바구니 할인 계산', () => {
  const calculator = new CartDiscountCalculator();

  expect(calculator.calculate(110000)).toBe(99000);  // 조건 1
  expect(calculator.calculate(50000)).toBe(50000);   // 조건 2
  expect(calculator.calculate(200000)).toBe(180000); // 조건 3
  expect(calculator.calculate(0)).toBe(0);           // 조건 4
});

// 좋은 예: 각 테스트는 하나의 동작을 검증한다
it('10만원 이상 구매 시 10% 할인을 적용한다', () => {
  expect(calculator.calculate(110000)).toBe(99000);
});

it('10만원 미만 구매 시 할인을 적용하지 않는다', () => {
  expect(calculator.calculate(50000)).toBe(50000);
});

it('정확히 10만원 구매 시 10% 할인을 적용한다', () => {
  expect(calculator.calculate(100000)).toBe(90000);
});
```

## 테스트가 정말 실패하는지 확인하라

Red 단계에서 놓치기 쉬운 것이 있다. **테스트가 실제로 실패하는지 확인해야 한다.** 테스트를 작성했는데 이미 통과한다면 두 가지 중 하나다: 이미 구현되어 있거나, 테스트가 아무것도 검증하지 않는다.

```typescript
// false positive의 예
it('할인을 적용한다', () => {
  const calculator = new CartDiscountCalculator();
  const result = calculator.calculate(110000);
  // expect가 없다! 항상 통과한다
});

// 또 다른 false positive
it('할인을 적용한다', () => {
  const calculator = new CartDiscountCalculator();
  const result = calculator.calculate(110000);
  expect(result).toBeDefined(); // 항상 참이라 의미 없다
});
```

테스트를 작성한 뒤 실행해서 빨간 줄을 직접 눈으로 확인하는 습관이 중요하다. 빨간 줄을 보지 않으면 Green으로 만들었을 때 무언가를 고쳤다는 확신이 없다.

## 실제 예시: 장바구니 할인 계산 TDD로 시작하기

요구사항: 장바구니 합계 금액이 10만원 이상이면 10% 할인, 그렇지 않으면 할인 없음.

**Step 1: 첫 번째 테스트 작성 (파일조차 없음)**

```typescript
// cart-discount-calculator.test.ts
import { CartDiscountCalculator } from './cart-discount-calculator';
// ^^^ 아직 이 파일 없음 → 컴파일 오류 = Red

describe('CartDiscountCalculator', () => {
  it('10만원 이상 구매 시 10% 할인을 적용한다', () => {
    const calculator = new CartDiscountCalculator();

    const result = calculator.calculate(110000);

    expect(result).toBe(99000);
  });
});
```

**Step 2: 컴파일 오류 수정 — 인터페이스 정의**

```typescript
// cart-discount-calculator.ts
export class CartDiscountCalculator {
  calculate(amount: number): number {
    throw new Error('Not implemented');
  }
}
```

이제 컴파일은 통과하고, 테스트는 `Error: Not implemented`로 실패한다. Red 상태 유지. 실패 메시지를 직접 확인한다.

**Step 3: 두 번째 테스트 추가 (아직 구현 전)**

```typescript
describe('CartDiscountCalculator', () => {
  it('10만원 이상 구매 시 10% 할인을 적용한다', () => {
    const calculator = new CartDiscountCalculator();
    const result = calculator.calculate(110000);
    expect(result).toBe(99000);
  });

  it('10만원 미만 구매 시 할인을 적용하지 않는다', () => {
    const calculator = new CartDiscountCalculator();
    const result = calculator.calculate(50000);
    expect(result).toBe(50000);
  });
});
```

두 테스트 모두 실패한다. 이제 Green 단계로 넘어간다.

Red 단계의 목표는 테스트를 "제대로 실패시키는" 것이다. 실패하지 않는 테스트는 가치가 없다. 잘 실패하는 테스트를 만든 다음에야 Green으로 이동할 수 있다.
