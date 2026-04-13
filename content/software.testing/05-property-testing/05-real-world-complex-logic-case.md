---
title: "실전 사례: 복잡한 금융 계산과 데이터 정합성 증명"
author: jeffrey
date: 2026-04-13
tags: ["property-testing", "real-world-case", "financial-logic", "fast-check", "data-integrity"]
---

## 실전 사례: 복잡한 금융 계산과 데이터 정합성 증명

속성 기반 테스팅(Property-based Testing)이 가장 강력한 파괴력을 발휘하는 곳은 단 1원의 오차도 허용하지 않는 **금융 및 결제 도메인**입니다. 이번 아티클에서는 대출 이자 환급액을 계산하는 복잡한 비즈니스 로직을 예로 들어, 상상하지 못한 엣지 케이스를 어떻게 `fast-check`로 잡아내는지 실전 코드로 살펴보겠습니다.

---

### 1. 비즈니스 시나리오: 일할 계산기 (Pro-rata Calculator)

사용자가 대출을 중도 상환했을 때, 남은 기간에 대한 이자를 환급해 주는 로직입니다.

- **규칙 1**: 환급액은 원금보다 클 수 없다.
- **규칙 2**: 남은 기간이 0이면 환급액도 0이다.
- **규칙 3**: (가장 중요) 원금, 이율, 남은 기간 중 하나라도 늘어나면 환급액은 이전보다 줄어들지 않아야 한다 (단조 증가성).

### 2. NestJS 기반의 환급 엔진 구현

```typescript
// src/finance/refund.engine.ts
export const calculateRefund = (principal: number, rate: number, remainingDays: number): number => {
  if (remainingDays <= 0) return 0;
  
  // 단순화된 이자 계산 로직
  const dailyRate = rate / 365 / 100;
  const refund = principal * dailyRate * remainingDays;
  
  return Math.floor(refund); // 소수점 버림
};
```

### 3. 실전 속성 테스팅 (Property-based Test)

우리는 단순히 `100만원`을 넣었을 때 얼마가 나오는지를 테스트하는 대신, 위에서 정의한 **'불변의 규칙(Invariant)'**들을 수만 개의 세트로 검증합니다.

```typescript
import * as fc from 'fast-check';
import { calculateRefund } from '../src/finance/refund.engine';

describe('Financial Refund Engine - Invariant Check', () => {
    it('환급액은 절대로 원금을 초과하지 않아야 한다 (Upper Bound Property)', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100000000 }), // 원금: 1원 ~ 1억
                fc.float({ min: 0.1, max: 20.0 }),       // 이율: 0.1% ~ 20%
                fc.integer({ min: 1, max: 365 }),       // 잔여일: 1일 ~ 365일
                (principal, rate, days) => {
                    const result = calculateRefund(principal, rate, days);
                    expect(result).toBeLessThanOrEqual(principal);
                }
            )
        );
    });

    it('잔여일이 늘어나면 환급액은 감소하지 않아야 한다 (Monotonicity Property)', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 1000000 }),
                fc.float({ min: 1.0, max: 10.0 }),
                fc.integer({ min: 1, max: 300 }),
                (principal, rate, days) => {
                    const result1 = calculateRefund(principal, rate, days);
                    const result2 = calculateRefund(principal, rate, days + 1); // 1일 추가
                    expect(result2).toBeGreaterThanOrEqual(result1);
                }
            )
        );
    });
});
```

---

### 4. 발견된 '상상 못한' 버그: 부동 소수점 오차

위 테스트를 돌리다 보면 가끔 `P95` 지점에서 실패가 발생할 수 있습니다. 이유는 자바스크립트의 **심각한 부동 소수점 오차(Precision Error)** 때문입니다.

- **발생 사례**: 이율이 극도로 낮거나 기간이 매우 길 때, `principal * (rate/365/100) * days`의 결과가 미세하게 튀어 오를 수 있습니다.
- **해결책**: 실무에서는 `decimal.js`나 `big.js`를 사용하여 정밀도를 보장하거나, 모든 단위를 '1원'이 아닌 '0.1원' 단위의 정수로 치환하여 계산해야 함을 이 테스트가 미리 알려줍니다.

---

### 전문가의 총평: "테스트가 설계를 이끈다"

이처럼 속성 기반 테스팅은 단순히 버그를 찾는 행위를 넘어, **"우리의 비즈니스 공식이 수학적으로 타당한가?"**를 끊임없이 질문하게 만듭니다.

금융권뿐만 아니라 **복잡한 할인 쿠폰 시스템, 물류의 배송 최적화 알고리즘, 게임의 데미지 계산기** 등에 이 기법을 적용해 보십시오. 여러분의 서비스는 그 어떤 예외 상황에서도 흔들리지 않는 **'수학적 강건함'**을 갖추게 될 것입니다.
 Jennifer 정 (Master Backend Architect)
