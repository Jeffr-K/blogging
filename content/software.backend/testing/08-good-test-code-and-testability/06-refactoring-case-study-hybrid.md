---
title: "[실전] 하이브리드 리팩토링: 복잡한 레거시를 테스트 가능 설계로 전환하기"
author: jeffrey
date: 2026-04-13
tags: ["refactoring", "hybrid-architecture", "fp", "oop", "clean-code", "legacy-code"]
---

## [실전] 하이브리드 리팩토링: 복잡한 레거시를 테스트 가능 설계로 전환하기

우리는 지금까지 **함수형 프로그래밍(FP)**의 수학적 견고함과 **객체지향(OOP)**의 유연한 설계를 배웠습니다. 이 두 세계가 만났을 때, 즉 **'Functional Core(FP) + Imperative Shell(OOP)'** 기반의 하이브리드 설계가 구축되었을 때, 테스트 가능성은 비약적으로 상승합니다. 이번 실전 사례에서는 테스트가 아예 불가능했던 레거시 코드를 환골탈태시켜 보겠습니다.

---

### 1. [Before] 테스트 불가능한 레거시 (Imperative Nightmare)

아래 코드는 비즈니스 로직, I/O(DB), 외부 API 호출이 한곳에 뒤섞인 전형적인 **'스파게티 코드'**입니다.

```typescript
// [Bad] 한 메서드 안에서 모든 일이 일어남 (Testing Level 0)
@Injectable()
export class OrderProcessor {
  async process(order: any) {
    const isVip = await this.db.checkVip(order.userId); // I/O
    const now = new Date(); // 비결정적 요소
    
    // 복잡한 세금 및 할인 로직 (우리가 진짜 테스트하고 싶은 Logic)
    let amount = order.amount;
    if (isVip) amount *= 0.9;
    if (now.getDay() === 5) amount *= 0.95; // 금요일 특별 할인

    // 알림 발송 (사이드 이펙트)
    await axios.post('https://notification.io', { message: 'Processed' }); // I/O
    
    // DB 저장
    await this.db.save({ ...order, finalAmount: amount }); // I/O
  }
}
```

이 코드를 테스트하려면?

1. 금요일이 되어야 하거나 시스템 시간을 속여야 합니다.
2. `axios` 모듈 전체를 가로채야 합니다.
3. 실제 DB 환경까지 구축해야 합니다.

=> **결론: 개발자는 테스트 작성을 포기하게 됩니다.**

### 2. 하이브리드 수술 개시 (The Hybrid Refactoring)

#### Step 1: 비즈니스 로직의 순수 함수 추출 (Functional Core)

핵심 계산 로직을 외부 환경(DB, API, 시간)으로부터 완전히 격리합니다. 이제 이 코어는 어떤 Mocking 도구 없이도 **밀리초 단위**의 테스트가 가능해졌습니다.

```typescript
// src/domain/calculator.ts [Pure Function]
export const calculateFinalAmount = (amount: number, isVip: boolean, dayOfWeek: number): number => {
  let result = amount;
  if (isVip) result *= 0.9;
  if (dayOfWeek === 5) result *= 0.95;
  return result;
};

// [Testing]: 단순 값 대입 (Fast & Reliable)
it('VIP가 금요일에 주문하면 중복 할인이 적용되어야 한다.', () => {
    expect(calculateFinalAmount(1000, true, 5)).toBe(855); // 0.9 * 0.95
});
```

#### Step 2: 외부 의존성의 추상화와 의존성 주입 (OOP Shell)

`axios`와 `DB`를 인터페이스로 추상화하여, 테스트 시점에 쉽게 Mock으로 교체할 수 있는 **'열린 입구'**를 만듭니다.

```typescript
export interface INotifier { send(msg: string): Promise<void>; }
export interface IOrderRepo { save(order: any): Promise<void>; }

@Injectable()
export class OrderProcessor {
  constructor(
    @Inject('INotifier') private notifier: INotifier,
    private repo: IOrderRepo
  ) {}

  async process(order: any, now: Date) { // 시간도 주입받음
    const isVip = await this.repo.checkVip(order.userId);
    
    // [Core Logic 호출]: 로직 검증은 이미 Step 1에서 완료됨!
    const finalAmount = calculateFinalAmount(order.amount, isVip, now.getDay());

    await this.notifier.send('Processed');
    await this.repo.save({ ...order, finalAmount });
  }
}
```

---

### 3. 리나리 (Senior's Sight): "코드가 짧아지는 마법"

수술 후 테스트 코드는 어떻게 변했을까요?

- **Before**: 100줄이 넘는 복잡한 `jest.mock('axios')`와 DB 설정 코드가 가득했습니다.
- **After**:
  - 로직 테스트(Core)는 **5줄** 내외로 끝납니다.
  - 통합 테스트(Shell)는 "데이터를 잘 전달했는가"만 확인하는 **10줄** 내외의 코드가 됩니다.

이것이 바로 **고급 테스팅 설계**의 결과물입니다. 테스트가 쉬워지는 것이 목적이 아니라, **"변화에 강하고 버그가 숨을 곳 없는 투명한 코드"**를 얻은 것입니다.

여러분의 시스템에 **FP의 정교함**과 **OOP의 유연성**을 조화롭게 배치하십시오. 테스트 코드는 여러분의 설계가 옳았다는 것을 증명하는 가장 우아한 성적표가 될 것입니다.
 Jennifer 정 (Master Architect)
