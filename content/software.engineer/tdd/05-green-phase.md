---
title: "[TDD 시리즈] 5. Green — 최소한의 코드로 통과시키기"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "Green", "YAGNI", "Triangulation", "Fake It"]
---

# Green — 최소한의 코드로 통과시키기

Red 단계에서 실패하는 테스트를 만들었다. 이제 그 테스트를 통과시킬 차례다. Green 단계의 목표는 단 하나: **테스트를 통과시키는 것**. 가장 빠르게, 가장 단순하게.

"최소한"이라는 말이 모호하게 느껴진다면, 더 명확하게 표현하면 이렇다: **지금 실패하는 테스트를 통과시키는 데 필요한 것 이상은 쓰지 않는다.**

## Fake It Till You Make It

테스트를 가장 빠르게 통과시키는 방법은 하드코딩이다. 이걸 의도적으로 하는 기법을 **Fake It Till You Make It**이라고 한다.

```typescript
// Red: 실패하는 테스트
it('10만원 이상 구매 시 10% 할인을 적용한다', () => {
  const calculator = new CartDiscountCalculator();
  const result = calculator.calculate(110000);
  expect(result).toBe(99000);
});

// Green: 하드코딩으로 통과
export class CartDiscountCalculator {
  calculate(amount: number): number {
    return 99000; // 하드코딩
  }
}
```

이걸 보고 "이게 무슨 의미가 있냐"고 의문이 드는 게 정상이다. 의미는 다음 단계에서 드러난다.

## Triangulation — 두 번째 테스트가 일반화를 강제한다

하드코딩된 구현은 두 번째 테스트를 추가하면 더 이상 유지될 수 없다. **Triangulation**: 다른 입력으로 테스트를 추가해서 하드코딩을 강제로 일반화시킨다.

```typescript
// 두 번째 테스트 추가
it('10만원 이상 구매 시 10% 할인을 적용한다', () => {
  const calculator = new CartDiscountCalculator();
  expect(calculator.calculate(110000)).toBe(99000);
});

it('20만원 구매 시 10% 할인을 적용한다', () => {
  const calculator = new CartDiscountCalculator();
  expect(calculator.calculate(200000)).toBe(180000); // 이 테스트가 추가됨
});
```

이제 `return 99000`으로는 두 테스트를 모두 통과시킬 수 없다. 실제 계산 로직이 필요해진다.

```typescript
// Green: 두 테스트를 모두 통과시키는 일반화된 구현
export class CartDiscountCalculator {
  calculate(amount: number): number {
    if (amount >= 100000) {
      return amount * 0.9;
    }
    return amount;
  }
}
```

세 번째 테스트도 추가한다.

```typescript
it('10만원 미만 구매 시 할인을 적용하지 않는다', () => {
  const calculator = new CartDiscountCalculator();
  expect(calculator.calculate(50000)).toBe(50000);
});
```

이 테스트도 통과한다. 이미 일반화된 구현이 맞다.

## Obvious Implementation

해법이 너무 명확할 때는 하드코딩을 거칠 필요가 없다. 이걸 **Obvious Implementation**이라고 한다.

```typescript
// add 함수: 해법이 너무 명확하다
it('두 숫자를 더한다', () => {
  expect(add(2, 3)).toBe(5);
});

// Fake It 없이 바로 구현
function add(a: number, b: number): number {
  return a + b; // 명백하다
}
```

판단 기준은 이렇다: 구현을 쓰면서 "이게 맞나?" 하는 의심이 전혀 없다면 Obvious Implementation으로 바로 작성한다. 조금이라도 의심이 든다면 Fake It으로 시작한다.

## 단계적 흐름: 컴파일 오류 → 테스트 실패 → 테스트 통과

Green 단계는 하나의 큰 점프가 아니라 작은 단계들의 연속이다.

**장바구니 할인 예시 전체 흐름:**

```typescript
// ===== Step 1: Red =====
// 테스트 작성 — 컴파일 오류

import { CartDiscountCalculator } from './cart-discount-calculator';

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

// ===== Step 2: 컴파일 오류 수정 — 아직 Red =====
// cart-discount-calculator.ts
export class CartDiscountCalculator {
  calculate(amount: number): number {
    throw new Error('Not implemented');
  }
}
// 결과: 두 테스트 모두 실패 (Error: Not implemented)

// ===== Step 3: 첫 번째 테스트 통과 — Fake It =====
export class CartDiscountCalculator {
  calculate(amount: number): number {
    return 99000; // 하드코딩
  }
}
// 결과: 첫 번째 통과, 두 번째 실패 (expected 50000, received 99000)

// ===== Step 4: 두 번째 테스트도 통과 — 일반화 =====
export class CartDiscountCalculator {
  calculate(amount: number): number {
    if (amount >= 100000) {
      return amount * 0.9;
    }
    return amount;
  }
}
// 결과: 두 테스트 모두 통과 — Green!
```

이 흐름에서 각 단계가 작다는 게 핵심이다. 컴파일 오류를 먼저 고치고, 그다음 테스트를 통과시킨다. 한 번에 모든 걸 해결하려 하지 않는다.

## 경계값 테스트 추가

두 테스트가 통과했다. 하지만 경계값은 어떨까? 10만원 정확히의 동작을 확인한다.

```typescript
it('정확히 10만원 구매 시 10% 할인을 적용한다', () => {
  const calculator = new CartDiscountCalculator();
  expect(calculator.calculate(100000)).toBe(90000);
});
```

현재 구현은 `amount >= 100000`이므로 10만원도 할인된다. 테스트 통과. 하지만 요구사항이 "초과"였다면 경계값이 다르다. 테스트로 명세를 명확히 한다.

## "최소한"의 함정

Green 단계에서 흔한 실수는 테스트를 통과시키는 김에 "더 잘" 만들려고 하는 것이다.

```typescript
// Green 단계에서 하지 말아야 할 것
export class CartDiscountCalculator {
  private readonly DISCOUNT_THRESHOLD = 100_000;
  private readonly DISCOUNT_RATE = 0.1;

  calculate(amount: number): number {
    return this.isEligibleForDiscount(amount)
      ? this.applyDiscount(amount)
      : amount;
  }

  private isEligibleForDiscount(amount: number): boolean {
    return amount >= this.DISCOUNT_THRESHOLD;
  }

  private applyDiscount(amount: number): number {
    return amount * (1 - this.DISCOUNT_RATE);
  }
}
```

이 코드가 나쁜 게 아니다. 문제는 타이밍이다. Green 단계에서 이렇게 쓰면 Refactor 단계가 없어진다. 상수 추출, 메서드 추출, 이름 개선은 모두 Refactor 단계에서 할 일이다.

Green 단계에서는 더럽고 빠르게 통과시킨다. 아름답게 만드는 건 Refactor 단계의 일이다.

```typescript
// Green 단계: 이 정도로 충분하다
export class CartDiscountCalculator {
  calculate(amount: number): number {
    if (amount >= 100000) {
      return amount * 0.9;
    }
    return amount;
  }
}
```

## YAGNI — 지금 필요하지 않은 것은 만들지 않는다

Green 단계에서 YAGNI(You Aren't Gonna Need It)는 가장 중요한 원칙이다.

"나중에 다른 할인율도 지원해야 하니까 파라미터로 받아야겠다", "멤버십 등급별 할인도 생길 것 같으니 전략 패턴으로 미리 만들어야겠다" — 이런 생각이 드는 순간, 멈춰야 한다.

지금 실패하는 테스트가 요구하는 것만 구현한다. 나중에 테스트가 그것을 요구할 때 만든다. 그 테스트를 쓰는 시점에 어떤 설계가 적합한지 더 잘 알게 된다.

Green이 됐다면 멈추고 Refactor로 넘어간다.
