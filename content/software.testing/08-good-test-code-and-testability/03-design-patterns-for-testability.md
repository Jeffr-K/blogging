---
title: "디자인 패턴이 테스트 코드의 가독성에 미치는 영향"
author: jeffrey
date: 2026-04-13
tags: ["design-patterns", "strategy-pattern", "template-method", "testability", "refactoring"]
---

## 디자인 패턴이 테스트 코드의 가독성에 미치는 영향

디자인 패턴은 단순히 "코드를 예쁘게 짜는 법"이 아닙니다. 복잡한 비즈니스 분기를 객체지향 시스템으로 재배치하여, **테스트 코드의 복잡도를 낮추는 강력한 도구**입니다. 특히 복잡한 결제 할인이나 이메일 발송 같은 도메인 로직에서 그 차이는 극명하게 드러납니다.

---

### 1. 전략 패턴 (Strategy Pattern): 수천 개의 if-else를 박살내다

결제 수단별(카드, 현금, 포인트)로 각기 다른 할인 정책을 적용하는 로직을 예로 들어 보겠습니다.

#### 1.1 [Before] 절차지향적 설계 (if-else 지옥의 테스팅)

```typescript
// [Bad] 하나의 거대한 if-else 덩어리
@Injectable()
export class PaymentService {
  calculate(type: string, amount: number) {
    if (type === 'CARD') return amount * 0.9;
    if (type === 'CASH') return amount * 0.8;
    if (type === 'POINT') return amount * 0.95;
    return amount;
  }
}

// 테스트 코드: 모든 분기를 호출하며 확인해야 함 (취약함)
describe('PaymentService (Before Strategy)', () => {
  it('모든 결제 수단의 할인 로직을 하나의 파일에서 다 테스트해야 함', () => {
    expect(service.calculate('CARD', 100)).toBe(90);
    expect(service.calculate('CASH', 100)).toBe(80);
    // ... 새로운 수단이 추가될 때마다 이 테스트 코드는 길어집니다. (OCP 위반)
  });
});
```

#### 1.2 [After] 전략 패턴 도입 (전략별 고립된 테스팅)

```typescript
// [Good] 결제 수단별 전략 클래스 분리
export interface DiscountStrategy { calculate(amount: number): number; }

export class CardDiscount implements DiscountStrategy { calculate(amount: number) { return amount * 0.9; } }
export class CashDiscount implements DiscountStrategy { calculate(amount: number) { return amount * 0.8; } }

// 컨텍스트 클래스: 전략을 외부에서 주입받거나 찾아서 실행만 함
@Injectable()
export class PaymentContext {
  calculate(strategy: DiscountStrategy, amount: number) {
    return strategy.calculate(amount);
  }
}

// 테스트 코드: "각 전략의 완성도"와 "컨텍스트의 동작"을 완전히 분리
describe('CardDiscount (Strategy Testing)', () => {
  it('카드 할인은 독자적으로 10% 할인을 검증함', () => {
    const card = new CardDiscount();
    expect(card.calculate(100)).toBe(90);
  });
});
```

- **임팩트**: 새로운 결제 수단이 추가되어도 기존 `PaymentContext`의 테스트 코드는 단 한 줄도 고칠 필요가 없습니다. 이것이 바로 개방-폐쇄 원칙(OCP)의 실현입니다.

### 2. 템플릿 메서드 패턴 (Template Method): 공통 로직의 재사용과 고립

외부 API 연동 시 '로그 기록 -> 실제 호출 -> 결과 저장'이라는 공통 흐름(Template)이 있는 경우를 예로 들어 봅시다.

- **패턴 미적용 시**: 모든 API 연동 로직마다 '로그'와 '저장'이 섞여있어, 실제 '호출'만 테스트하기가 매우 까다롭습니다.
- **패턴 적용 시**: 상위 클래스에서 전체 흐름을 잡고, 하위 클래스에서 '구체적 호출'만 구현합니다. 테스트에서는 이 **'구체적 구현'**만 고립시켜 테스트할 수 있게 됩니다.

---

### 3. 디자인 패턴이 주는 테스팅 이점 요약

1. **테스트 대상의 축소**: 거대한 클래스를 테스트하는 대신, 작고 명확한 객체(Strategy, Command 등) 하나하나를 정교하게 검격할 수 있습니다.
2. **Mocking 비용 절감**: 복잡한 환경 설정 대신, 단순히 우리가 원하는 행동(Interface)만 Mocking 하여 주입하면 됩니다.
3. **가독성 향상**: 테스트 코드가 "어떤 상황(If/Else)"인지 설명하는 대신 "어떤 전략(Strategy)"인지 설명하게 되므로 훨씬 명확해집니다.

---

### 시니어의 팁: "테스트가 복잡하면 패턴이 필요한 신호다"

테스트 코드의 `describe` 중첩이 3단계를 넘어가거나, 한 가지 기능을 확인하기 위해 수많은 `if` 상황을 억지로 만들어야 한다면, 즉시 디자인 패턴 도입을 고려하십시오.

디자인 패턴은 여러분의 코드가 **'테스트하기 편한 객체들의 자율적인 공동체'**가 되도록 설계의 방향을 잡아줍니다. 테스트 코드를 간결하게 만드는 과정이 바로 최고의 소프트웨어 디자인 과정입니다.
