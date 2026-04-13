---
title: "순수 함수의 테스팅 파워와 명령형 쉘(Imperative Shell) 패턴"
author: jeffrey
date: 2026-04-13
tags: ["functional-core", "imperative-shell", "fp", "nest-js", "testability", "pure-function"]
---

## 순수 함수의 테스팅 파워와 명령형 쉘(Imperative Shell) 패턴

테스트 코드를 작성할 때 가장 고통스러운 지점은 **비즈니스 로직(Logic)**과 **외부 세계(I/O)**가 한데 뒤섞여 있을 때입니다. 시니어 엔지니어는 이를 **'Functional Core, Imperative Shell'** 아키텍처로 해결합니다. 모든 복잡한 비즈니스 로직은 순수한 **함수형 코어**에 가두고, 제어할 수 없는 외부 요인(I/O)은 시스템의 가장 바깥쪽인 **명령형 쉘**로 밀어내는 것이 이 패턴의 정수입니다.

---

### 1. 비정상적인 설계: 'Logic'과 'I/O'의 뒤섞임

대부분의 명령형 코드는 아래와 같이 작성됩니다. 이 코드는 테스트를 위해 반드시 Mocking이 필요하며, 작성 비용이 높고 깨지기 쉽습니다.

```typescript
// [Bad] Logic과 I/O가 결합된 형태 (Testing Nightmare)
@Injectable()
export class OrderService {
  async checkout(userId: number, items: any[]) {
    // 1. I/O (DB 조회)
    const user = await this.userRepo.findById(userId);

    // 2. 복잡한 비즈니스 로직 (Logic) - 실제 우리가 테스트하고 싶은 곳
    let total = items.reduce((acc, item) => acc + item.price, 0);
    if (user.isVip) total *= 0.9;
    if (total > 100000) total -= 5000;

    // 3. I/O (결제 처리)
    await this.paymentGateway.pay(total);
  }
}
```

### 2. 혁신적 설계: Functional Core, Imperative Shell

로직만 따로 떼어내어 **순수 함수**로 만듭니다. 이것이 **'Functional Core'**입니다. 이 코어는 어떤 외부 의존성(Repository, Gateway)도 모릅니다. 오직 값(Value)만 다룹니다.

#### 2.1 Functional Core (Pure Logic) - 테스트 강력함의 원천

```typescript
// src/domain/order.logic.ts [Pure Function]
export const calculateOrderAmount = (items: { price: number }[], isVip: boolean): number => {
  let total = items.reduce((acc, item) => acc + item.price, 0);
  if (isVip) total *= 0.9;
  if (total > 100000) total -= 5000;
  return total;
};

// [Testing]: Mocking 0회! 밀리초 단위의 초고속 테스트
describe('calculateOrderAmount (Core Logic Testing)', () => {
    it('VIP가 10만원 이상 구매 시 10% 할인을 하고 5,000원을 추가 감면한다.', () => {
      expect(calculateOrderAmount([{ price: 100000 }], true)).toBe(85000);
    });
});
```

#### 2.2 Imperative Shell (I/O & Integration)

코어 로직을 사용하는 바깥쪽 껍데기입니다. 비즈니스 판단은 코어에게 맡기고, 오직 **'데이터를 가져오고 결과를 저장'**하는 일에만 집중합니다.

```typescript
// src/application/order.service.ts [Imperative Shell]
@Injectable()
export class OrderService {
  async checkout(userId: number, items: any[]) {
    // 1. 데이터 수집 (I/O)
    const user = await this.userRepo.findById(userId);
    
    // 2. 코어 로직 호출 (Pure Function)
    const finalAmount = calculateOrderAmount(items, user.isVip);

    // 3. 결과 반영 (I/O)
    await this.paymentGateway.pay(finalAmount);
  }
}
```

---

### 3. 왜 이 패턴이 최강의 테스트 가능성을 갖는가?

1. **로직 테스트의 격리**: 복잡한 조건(If-Else)은 모두 순수 함수에 있으므로, 비즈니스 규칙이 수백 개 늘어나도 테스트 코드는 Mocking 없이 값만 넣어서 검증하면 됩니다.
2. **쉘 테스트의 단순화**: 쉘에서는 오직 "데이터를 잘 가져와서 코어에 전달했는가"와 "결과를 잘 저장했는가"만 검증하면 됩니다. (인수 테스트나 간단한 통합 테스트로 충분)
3. **가역성 (Reversibility)**: 코어 로직은 프레임워크나 외부 라이브러리에 의존하지 않으므로, 나중에 NestJS에서 다른 프레임워크로 옮기더라도 비즈니스 자산(테스트 코드와 로직)은 그대로 유지됩니다.

### 4. 시니어의 통찰: "로직을 값으로 변환하라"

테스트가 힘든 이유는 우리가 코드를 **'작용(Action)'**으로만 보기 때문입니다.

로직을 **'입력을 출력으로 바꾸는 데이터의 흐름(Data Transformation)'**으로 변환하십시오. **Functional Core**는 여러분의 비즈니스 지성을 보호하고, **Imperative Shell**은 여러분의 기술적 제약을 관리합니다. 이 조화가 바로 테스트 가능한 클린 아키텍처의 정점입니다.
 Jennifer 정 (Senior Backend Architect)
