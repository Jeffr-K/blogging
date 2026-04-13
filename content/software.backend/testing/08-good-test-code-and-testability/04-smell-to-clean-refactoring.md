---
title: "[실전] 테스트 불가능한 코드(Untestable)의 리팩토링 사례"
author: jeffrey
date: 2026-04-13
tags: ["refactoring", "testability", "clean-code", "domain-model", "test-smell"]
---

## [실전] 테스트 불가능한 코드(Untestable)의 리팩토링 사례

"코드가 너무 엉망이라 테스트를 짤 수가 없어요." 많은 개발자가 겪는 고충입니다. 하지만 반대로 생각하면, **테스트를 짜기 위해 코드를 고치는 과정**이 곧 최상의 리팩토링 과정입니다. 이번 아티클에서는 테스트가 불가능한 '코드 스멜' 가득한 로직을, 우아하고 견고한 **'테스트 가능한 설계'**로 수술해 보겠습니다.

---

### 1. [Before] 독이 든 성배: 테스트 불가능한 주문 처리 로직

아래 코드는 전형적인 **'테스트하기 힘든'** 코드입니다.

1. 내부에서 `new Date()`를 직접 호출 (비결정성)
2. `axios` 같은 외부 통신 라이브러리에 강하게 결합 (부수 효과)
3. DB 연결 없이 로직만 분리해 테스트할 수 없음 (강한 결합)

```typescript
// src/orders/order-processor.ts [Bad]
@Injectable()
export class OrderProcessor {
  async process(order: any) {
    const today = new Date();
    // 1. 금요일이면 특별 할인을 추가한다 (하드코딩된 비즈니스 로직)
    if (today.getDay() === 5) {
      order.amount *= 0.9;
    }

    // 2. 외부 알림 발송 (강한 결합)
    const response = await axios.post('https://api.notify.com/send', { orderId: order.id });
    if (response.status !== 200) throw new Error('알림 발송 실패');

    // 3. DB 저장 (테스트 시 실제 DB가 필요함)
    await this.db.save(order);
  }
}
```

이 코드를 테스트하려면? 금요일을 기다리거나, `axios`를 글로벌하게 Mocking 하고, 실제 DB 환경까지 구축해야 합니다.

### 2. [After] 테스트 가능 설계로의 진화 (격리와 추상화)

#### 2.1 첫 번째 수술: 비즈니스 로직의 순수 함수 추출 (FP)

금요일 할인 여부를 판단하는 핵심 로직을 떼어냅니다. 이제 날짜를 인자로 받으므로 언제든 테스트가 가능합니다.

```typescript
// src/orders/order-logic.ts [Good - Pure Logic]
export const applyDiscount = (amount: number, date: Date): number => {
  const FRIDAY = 5;
  return date.getDay() === FRIDAY ? amount * 0.9 : amount;
};
```

#### 2.2 두 번째 수술: 외부 통신의 추상화 (DIP/OOP)

`axios`를 직접 쓰지 않고 인터페이스를 통해 호출하도록 설계합니다.

```typescript
// src/orders/notifier.interface.ts [Good - Abstraction]
export interface INotifier {
  send(orderId: number): Promise<void>;
}
```

#### 2.3 최종 수립: 오케스트레이션(조합) 클래스

```typescript
// src/orders/order-processor.ts [Clean - Testable]
@Injectable()
export class OrderProcessor {
  constructor(
    @Inject('INotifier') private readonly notifier: INotifier,
    private readonly orderRepository: IOrderRepository,
  ) {}

  async process(order: any, now: Date) { // 날짜를 외부에서 주입
    // 1. 순수 함수로 금액 계산 (결함 없음)
    order.amount = applyDiscount(order.amount, now);

    // 2. 추상화된 인터페이스로 알림 발송 (Mocking 쉬움)
    await this.notifier.send(order.id);

    // 3. 리포지토리에 저장
    await this.orderRepository.save(order);
  }
}
```

---

### 3. 리팩토링 후 테스트 코드의 극적인 변화

#### [Before] 엉망인 코드 시절의 테스트 (100줄 이상)

- "금요일 환경을 만들기 위해 전역 Date 객체 오염시키기..."
- "Axios 모듈 전체를 가로채기..."
- "테스트용 실제 DB 테이블 생성하기..."

#### [After] 클린 코드 기반의 테스트 (10줄 내외)

```typescript
it('금요일에 주문 처리 시 10% 할인이 적용되어야 한다.', async () => {
    // 1. 준비 (Mocking이 매우 직관적임)
    const mockRepo = { save: jest.fn() };
    const mockNotifier = { send: jest.fn() };
    const processor = new OrderProcessor(mockNotifier, mockRepo);
    const order = { id: 1, amount: 1000 };
    const friday = new Date('2026-04-10'); // 실제 금요일 날짜 주입

    // 2. 실행
    await processor.process(order, friday);

    // 3. 검증 (로직이 정확히 수행되었는지 한눈에 확인 가능)
    expect(order.amount).toBe(900);
    expect(mockNotifier.send).toHaveBeenCalledWith(1);
    expect(mockRepo.save).toHaveBeenCalled();
});
```

---

### 시니어의 마무리: "테스트가 말해준다"

여러분이 코드를 리팩토링할 때, **"이게 정말 좋아진 걸까?"**라는 의구심이 든다면 테스트 코드를 보십시오.

- 테스트 코드가 간결해졌는가?
- Mocking 하는 대상이 줄어들었는가?
- 읽었을 때 비즈니스 스토리가 보이는가?

만약 그렇다면, 여러분은 정답을 찾은 것입니다. 테스트 가능성(Testability)은 **'유연한 아키텍처'**를 판가름하는 가장 정밀한 척도입니다. 리팩토링은 더 예쁜 코드를 만드는 것이 아니라, **나를 포함한 동료들이 더 테스트하기 쉬운 환경**을 만드는 숭고한 배려입니다.
