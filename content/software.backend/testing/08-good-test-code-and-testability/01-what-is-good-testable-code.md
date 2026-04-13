---
title: "좋은 테스트 코드란 무엇인가: 테스트 가능한(Testable) 설계의 본질"
author: jeffrey
date: 2026-04-13
tags: ["testability", "clean-code", "fp", "oop", "solid", "pure-function"]
---

## 좋은 테스트 코드란 무엇인가: 테스트 가능한(Testable) 설계의 본질

"테스트 코드가 너무 짜기 힘들어요." 이 말은 보통 테스트 기법의 부족이 아니라, **소스 코드의 설계 자체가 나쁘다는 강력한 증거**입니다. 좋은 테스트 코드는 좋은 설계(Design)에서 나옵니다. 10년 차 전문가의 시선으로 볼 때, 좋은 테스트 코드란 **'테스트 가능한 코드(Testable Code)'**를 바탕으로 비즈니스의 정수를 정교하게 타격하는 것입니다.

---

### 1. 테스트 가능한 코드의 핵심: 제어할 수 없는 것과의 결별

테스트가 어려운 가장 큰 이유는 **'제어할 수 없는 외부 요인'**에 의존하기 때문입니다. 현재 시간(`Date.now()`), 무작위 값(`Random`), 외부 API, 데이터베이스 상태 등은 테스트의 **'비결정성'**을 만듭니다.

좋은 설계는 이러한 **"나쁜 의존성"**을 비즈니스 로직(Pure Logic)으로부터 격리하는 데서 시작합니다.

### 2. 함수형 프로그래밍(FP)의 정수: 순수 함수 (Pure Function)

FP의 관점에서 테스트 가능성은 **순수성**에 비례합니다.

- **순수 함수**: 동일한 입력에 대해 항상 동일한 출력을 보장하며, 부수 효과(Side Effect)가 없는 함수.
- **불변성 (Immutability)**: 상태를 변경하지 않고 새로운 상태를 생성함으로써 테스트 중 데이터가 오염되는 것을 원천 차단합니다.

#### 2.1 FP 기반의 테스트 가능한 코드 예제 (NestJS)

```typescript
// [Bad] 테스트하기 힘든 소스 코드 (제어 불가능한 Date에 의존)
@Injectable()
export class TicketService {
  isDiscountable(ticket: any) {
    const today = new Date(); // 내부에서 직접 생성(제외 불가능)
    return ticket.expiredAt > today;
  }
}

// [Good] FP 스타일로 개선된 테스트 가능한 로직 (Pure Logic)
export const canDiscount = (targetDate: Date, now: Date): boolean => {
  return targetDate > now; // 입력을 명시적으로 받아 결과를 산출 (순수 함수)
};

// 테스트 코드: Mocking 없이 값만 넣으면 끝!
describe('Pure Function Testing', () => {
  it('만료일이 현재보다 이후라면 할인이 가능해야 한다.', () => {
    const expiredAt = new Date('2026-12-31');
    const now = new Date('2026-01-01');

    expect(canDiscount(expiredAt, now)).toBe(true); // 어떤 시점의 데이터든 테스트 가능!
  });
});
```

### 3. 객체지향 프로그래밍(OOP)의 정수: 의존성 주입과 추상화

OOP 관점에서는 **SOLID 원칙**, 특히 **의존성 역전 원칙(DIP)**과 **의존성 주입(DI)**이 테스트 가능성의 핵심입니다.

- **약한 결합 (Loose Coupling)**: 구체적인 클래스가 아닌 인터페이스에 의존하게 하여, 테스트 시 실제 DB 대신 Mock 객체로 언제든 '갈아끼울' 수 있어야 합니다.
- **단일 책임 원칙 (SRP)**: 클래스가 너무 많은 일을 하면 테스트 케이스가 기하급수적으로 복잡해집니다. 잘게 쪼개진 클래스는 테스트하기가 훨씬 수월합니다.

#### 3.1 OOP 기반의 테스트 가능한 설계 (NestJS + DI)

```typescript
// [Good] DIP를 적용하여 테스트 가능성을 확보한 설계
@Injectable()
export class OrderService {
  constructor(
    // 구체적인 구현(MySQLRepository)이 아닌 인터페이스(Repository)에 의존
    @Inject(IUserRepository) private readonly userRepository: IUserRepository,
  ) {}

  async completeOrder(userId: number) {
    const user = await this.userRepository.findById(userId); // 외부 세계인 DB 조회를 추상화
    if (!user) throw new NotFoundException();
    
    // ... 비즈니스 로직
  }
}

// 테스트 코드: 실제 DB 없이 UserRepository만 Mocking하여 주문 로직만 타격
describe('OrderService - OOP Testing', () => {
  it('ID로 사용자를 찾지 못하면 에러를 던져야 한다.', async () => {
    // Arrange (DIP 덕분에 Mock 주입 가능)
    const mockRepo = { findById: jest.fn().mockResolvedValue(null) };
    const service = new OrderService(mockRepo as any);

    // Act & Assert
    await expect(service.completeOrder(123)).rejects.toThrow(NotFoundException);
  });
});
```

---

### 4. 좋은 테스트 코드의 3대 품질 지표

진정으로 '빡세게' 관리되는 테스트 코드는 다음 요건을 충족해야 합니다.

1. **가독성 (Documentation)**: 테스트 코드는 그 자체로 기술 문서이자 사용자 가이드여야 합니다.
2. **신속성 (Speed)**: 테스트가 느리면 개발자는 어느 순간 테스트를 돌리지 않게 됩니다. I/O를 철저히 격리하여 수천 개의 테스트가 단 수 초 내에 끝나야 합니다.
3. **독립성 (Isolation)**: 어떤 테스트도 다른 테스트의 영향을 받지 않아야 하며, 어떤 순서로 실행되어도 결과가 일정(Deterministic)해야 합니다.

---

### 시니어의 결론: "좋은 설계는 테스트를 부르고, 테스트는 설계를 교정한다"

테스트를 짜는 과정에서 고통을 느낀다면, 그것은 당신의 설계가 경직(Rigid)되어 있다는 신호입니다.

- **FP**를 통해 비즈니스 로직의 결함을 없애고,
- **OOP**를 통해 인프라와의 결합도를 낮추십시오.

테스트 가능한 코드는 단순히 테스팅을 쉽게 만드는 것이 아니라, **'변경에 유연한 강한 시스템'**을 만드는 가장 확실한 지름길입니다. 좋은 테스트 코드는 당신의 실력을 증명하는 가장 우아한 자산입니다.
