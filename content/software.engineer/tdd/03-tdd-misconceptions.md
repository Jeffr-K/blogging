---
title: "[TDD 시리즈] 3. TDD에 대한 흔한 오해 5가지"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "오해", "커버리지", "Mock", "실무"]
---

# TDD에 대한 흔한 오해 5가지

TDD를 처음 접한 사람이 하는 질문들이 있다. "그게 실제로 빠른가요?", "커버리지 100%를 목표로 해야 하나요?", "모든 코드에 다 적용해야 하나요?". 이 질문들 뒤에는 오해가 깔려 있다. 하나씩 정리한다.

## 오해 1: "TDD는 느리다"

**오해:** 테스트를 먼저 작성하면 개발 속도가 떨어진다. 기능을 빨리 만들어야 하는 상황에서 TDD는 비현실적이다.

**실제:** 단기적으로는 맞다. 테스트를 작성하는 시간이 추가된다. 그러나 TDD가 제거하는 비용을 보면 얘기가 달라진다.

전통적 개발에서 숨겨진 비용:
- 수동 디버깅 시간 (같은 버그를 여러 번 디버깅)
- 회귀 버그 수정 시간
- "이 코드 건드리면 뭔가 깨질 것 같은데"로 인한 기술 부채 방치
- 기능 추가 시 기존 기능이 깨졌는지 매번 수동으로 확인

```typescript
// 디버깅 없이 개발하는 느낌
// 테스트를 작성하는 데 15분 → 디버깅에 2시간을 쓰지 않아도 된다

describe('DiscountPolicy', () => {
  it('VIP 회원은 항상 15% 할인을 받는다', () => {
    const policy = new DiscountPolicy();

    const discounted = policy.apply({ memberType: 'VIP', price: 10000 });

    expect(discounted).toBe(8500);
  });

  it('일반 회원은 할인이 없다', () => {
    const policy = new DiscountPolicy();

    const discounted = policy.apply({ memberType: 'REGULAR', price: 10000 });

    expect(discounted).toBe(10000);
  });
});
```

테스트를 먼저 쓴 덕분에 나중에 `DiscountPolicy`를 변경하거나 조건이 추가될 때 회귀를 즉시 잡는다. "빨리 만들었다가 나중에 고치는" 방식이 실제로는 더 느리다.

마틴 파울러는 이것을 **Design Payoff Line**으로 설명한다. 초반에는 TDD 없이 빠르지만 일정 시점이 지나면 TDD 코드베이스가 훨씬 빠르게 진행된다.

## 오해 2: "커버리지 100%가 목표다"

**오해:** TDD를 잘하면 코드 커버리지가 100%가 되어야 한다.

**실제:** 커버리지는 TDD의 부산물이다. 목표가 아니다.

커버리지 100%를 목표로 삼으면 의미 없는 테스트가 양산된다.

```typescript
// 커버리지를 채우기 위한 의미 없는 테스트
class UserDto {
  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}
}

// 이 테스트는 커버리지는 채우지만 아무 가치가 없다
it('UserDto가 생성된다', () => {
  const dto = new UserDto('1', '홍길동');
  expect(dto).toBeDefined();
});
```

이보다 더 나쁜 경우는 **검증 없는 테스트**다.

```typescript
// 최악: 실행만 되면 통과하는 테스트
it('주문을 처리한다', async () => {
  const service = new OrderService(repo, payment, email);
  await service.processOrder('order-1'); // expect가 없다
});
```

이런 테스트는 커버리지 수치를 올리지만 코드에 버그가 있어도 잡지 못한다. 오히려 "테스트가 있다"는 착각을 준다.

커버리지를 80% 유지하되 각 테스트가 실제로 의미 있는 동작을 검증하는 게 커버리지 100%에 의미 없는 테스트를 가득 채운 것보다 낫다.

## 오해 3: "모든 코드에 TDD를 적용해야 한다"

**오해:** TDD를 제대로 하려면 모든 코드에 테스트를 먼저 작성해야 한다.

**실제:** TDD의 ROI(투자 대비 수익)는 코드 종류에 따라 크게 다르다.

**TDD가 가장 효과적인 경우:**
- 복잡한 비즈니스 로직 (할인 정책, 정산 로직, 도메인 규칙)
- 알고리즘 구현
- 버그가 발생한 코드 (재발 방지용 회귀 테스트)

```typescript
// TDD 효과 최대: 복잡한 규칙이 있는 도메인 로직
describe('ShippingFeeCalculator', () => {
  it('제주/도서산간은 3000원 추가 배송비를 부과한다', () => { ... });
  it('5만원 이상 구매 시 배송비는 무료다', () => { ... });
  it('제주 지역이고 5만원 이상이면 추가 배송비만 부과된다', () => { ... });
  it('냉장 상품은 별도 콜드체인 배송비를 부과한다', () => { ... });
});
```

**TDD 효과가 낮은 경우:**
- 프레임워크 설정 코드 (Spring Config, Express middleware 설정)
- 단순한 CRUD 접착 코드
- 프로토타입, 탐색적 코드 (어떤 방향이 맞는지 아직 모를 때)

```typescript
// TDD 필요성 낮음: 단순 설정/접착 코드
// 이 코드보다 통합 테스트로 전체 흐름을 검증하는 게 낫다
function configureExpressApp(app: Express): void {
  app.use(cors());
  app.use(express.json());
  app.use('/api', router);
}
```

프로토타입이나 탐색 코드는 빠르게 작성하고 방향이 확정되면 TDD로 재작성하는 것도 현실적인 접근이다. 단, 프로토타입 코드가 그대로 프로덕션에 올라가는 것만 막으면 된다.

## 오해 4: "TDD를 하면 버그가 없다"

**오해:** TDD를 제대로 적용하면 버그가 사라진다.

**실제:** TDD는 잡을 수 없는 버그가 있다.

TDD로 잡을 수 없는 것들:

**잘못된 요구사항:** 요구사항 자체가 틀렸다면 테스트도 틀렸다. 코드는 명세를 정확히 구현하지만 명세가 잘못됐다면 버그가 생긴다.

```typescript
// 요구사항: "할인율은 10%다" → 잘못된 요구사항이었음
// 실제로는 "10% 포인트 할인"이 아니라 "정가의 10%"가 맞았는데
it('할인 가격을 계산한다', () => {
  expect(calculateDiscount(10000, 0.1)).toBe(9000); // 요구사항대로 구현됐지만 비즈니스 오해
});
```

**통합 이슈:** 단위 테스트는 각 컴포넌트가 격리된 상태에서 올바르게 동작함을 보장한다. 하지만 컴포넌트들이 실제로 연결되면 다른 문제가 발생할 수 있다.

```typescript
// 단위 테스트는 통과하지만 실제 DB와 연결하면 트랜잭션 격리 수준 이슈 발생
// 단위 테스트는 이런 걸 잡지 못한다
```

**성능 이슈:** 테스트가 통과해도 10만 건의 데이터로 실행하면 느릴 수 있다.

**동시성 이슈:** Race condition, deadlock은 단위 테스트로 재현하기 매우 어렵다.

TDD는 "명세대로 구현됐는가"를 보장하지, "명세가 올바른가"나 "시스템이 모든 조건에서 안정적인가"를 보장하지 않는다. 단위 테스트와 통합 테스트, 인수 테스트를 조합해야 한다.

## 오해 5: "Mock을 많이 쓸수록 좋은 TDD다"

**오해:** 모든 의존성을 Mock으로 교체하면 완벽히 격리된 단위 테스트가 된다.

**실제:** 과도한 Mock은 테스트의 신뢰성을 떨어뜨리고 리팩토링을 방해한다.

Mock을 과도하게 쓰면 두 가지 문제가 생긴다.

**첫째, 구현에 결합된 테스트가 된다.** Mock은 특정 메서드가 특정 인자로 호출됐는지를 검증한다. 내부 구현이 바뀌면 테스트가 깨진다. 동작은 유지됐는데 리팩토링했다는 이유로 테스트가 실패한다.

```typescript
// 과도한 Mock — 구현이 바뀌면 테스트도 깨진다
it('주문 처리 시 여러 단계를 수행한다', () => {
  const mockRepo = { findById: jest.fn(), save: jest.fn() };
  const mockPayment = { charge: jest.fn() };
  const mockNotification = { send: jest.fn() };
  const mockAudit = { log: jest.fn() };
  const mockInventory = { decrease: jest.fn() };

  service.processOrder('order-1');

  // 내부 구현 세부사항을 검증
  expect(mockRepo.findById).toHaveBeenCalledWith('order-1');
  expect(mockInventory.decrease).toHaveBeenCalledBefore(mockPayment.charge);
  expect(mockAudit.log).toHaveBeenCalledAfter(mockPayment.charge);
  // ...
});
```

이 테스트는 `processOrder`의 내부 실행 순서를 검증한다. 내부 순서를 바꾸는 리팩토링을 하면 기능은 동일하지만 테스트가 깨진다.

**둘째, Mock이 많다는 것은 설계 문제의 신호일 수 있다.** SUT가 너무 많은 의존성을 가지고 있다는 뜻이다.

```typescript
// Mock이 5개 이상 필요하다면 클래스가 너무 많은 일을 한다는 신호
class OrderService {
  constructor(
    private orderRepo: OrderRepository,      // Mock 1
    private paymentGateway: PaymentGateway,  // Mock 2
    private inventoryService: InventoryService, // Mock 3
    private emailSender: EmailSender,        // Mock 4
    private auditLogger: AuditLogger,        // Mock 5
    private notificationService: NotificationService // Mock 6
  ) {}
}
```

Mock 6개가 필요한 클래스는 책임이 너무 많다. Mock 수를 줄이는 방법은 클래스를 쪼개는 것이다.

Mock은 도구다. 외부 시스템(DB, 네트워크, 시간), 아직 구현되지 않은 협력 객체, 제어하기 어려운 비결정적 의존성에 사용한다. 도메인 내부 객체는 가능하면 실제를 사용하는 게 낫다.
