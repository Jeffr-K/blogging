---
title: "[TDD 시리즈] 9. 테스트 냄새 — 나쁜 테스트를 알아보는 법"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "테스트냄새", "테스트품질", "리팩토링"]
---

# 테스트 냄새 — 나쁜 테스트를 알아보는 법

나쁜 테스트는 없는 것보다 나쁠 수 있다. 통과는 하지만 아무것도 보장하지 않고, 리팩토링할 때마다 깨지고, 읽어도 의도를 알 수 없고, CI를 느리게 만든다. 프로덕션 코드에 코드 냄새(Code Smell)가 있듯이 테스트 코드에도 테스트 냄새(Test Smell)가 있다.

일곱 가지 주요 테스트 냄새를 진단하고 개선하는 법을 다룬다.

## 1. Obscure Test — 의도를 파악하기 어려운 테스트

**증상**: 테스트 코드를 읽어도 무엇을 검증하는지, 왜 이 값을 쓰는지 알 수 없다. 매직 넘버가 넘쳐나고 불필요한 세부사항이 가득하다.

**왜 나쁜가**: 실패했을 때 원인 파악이 어렵다. 수정하면 안 되는 값과 바꿔도 되는 값을 구분할 수 없다. 팀원이 이해하는 데 시간이 걸린다.

```typescript
// 나쁜 예 — 의도 불명의 테스트
it('test1', () => {
  const o = new Order('u-123', [
    { pid: 'p-001', q: 2, p: 15000 },
    { pid: 'p-002', q: 1, p: 8000 },
  ]);
  o.apply('DISC10');
  expect(o.t()).toBe(34200);
});
// 34200이 왜 나오는가? DISC10은 무슨 쿠폰인가? t()는 뭔가?

// 좋은 예 — 의도가 드러나는 테스트
it('10% 할인 쿠폰 적용 시 총 주문금액에서 10%가 할인된다', () => {
  const TEN_PERCENT_COUPON = 'DISC10';
  const originalTotal = 38000; // (15000 * 2) + (8000 * 1)
  const expectedTotal = 34200; // 38000 * 0.9

  const order = new Order('user-123', [
    { productId: 'p-001', quantity: 2, price: 15000 },
    { productId: 'p-002', quantity: 1, price: 8000 },
  ]);

  order.applyCoupon(TEN_PERCENT_COUPON);

  expect(order.totalAmount()).toBe(expectedTotal);
});
```

**개선 방법**: 매직 넘버에 이름을 붙이고, 변수 이름을 의미 있게 쓰고, 불필요한 셋업을 제거하라. 테스트 이름은 행동 명세 스타일로.

## 2. Fragile Test — 구현 변경에 쉽게 깨지는 테스트

**증상**: 동작은 바뀌지 않았는데 내부 구현을 리팩토링했을 뿐인데 테스트가 깨진다.

**왜 나쁜가**: 리팩토링이 두려워진다. 테스트가 더 이상 안전망이 아니라 장애물이 된다. 점점 테스트를 건드리지 않게 된다.

```typescript
// 나쁜 예 — 내부 구현에 의존하는 테스트
it('할인이 적용된다', () => {
  const order = new Order(items);
  const mockDiscountCalculator = jest.spyOn(order as any, '_calculateDiscount');

  order.applyCoupon('DISC10');

  // 내부 메서드가 호출됐는지 검증 — 구현 세부사항에 의존
  expect(mockDiscountCalculator).toHaveBeenCalledWith(0.1);
  expect(mockDiscountCalculator).toHaveBeenCalledTimes(1);
});
// _calculateDiscount를 _applyRate로 이름을 바꾸면 즉시 깨진다

// 좋은 예 — 관찰 가능한 결과만 검증
it('10% 할인 쿠폰 적용 시 총액이 10% 감소한다', () => {
  const order = new Order(items); // 총액 10000원
  order.applyCoupon('DISC10');
  expect(order.totalAmount()).toBe(9000);
});
// 내부 구현이 어떻게 바뀌든 결과가 같으면 통과
```

**개선 방법**: 내부 메서드 호출, private 필드, 구현 클래스 이름을 테스트에서 참조하지 마라. 공개 인터페이스의 결과만 검증하라.

## 3. Slow Test — 수십 초 걸리는 단위 테스트

**증상**: 단위 테스트 스위트를 돌리는 데 수십 초 이상 걸린다. CI에서 테스트 단계가 병목이다.

**왜 나쁜가**: 느린 테스트는 실행 빈도가 줄어든다. 개발 중 피드백 루프가 느려진다. TDD를 불가능하게 만든다.

```typescript
// 나쁜 예 — 단위 테스트 안에 숨겨진 실제 HTTP 호출
it('환율을 조회한다', async () => {
  const service = new ExchangeRateService(); // 내부에서 fetch() 호출
  const rate = await service.getRate('USD', 'KRW');
  expect(rate).toBeGreaterThan(0);
  // 네트워크 상태에 따라 1~5초 소요, 외부 API 불안정 시 실패
});

// 좋은 예 — HTTP 클라이언트를 인터페이스로 분리하고 Stub 사용
interface HttpClient {
  get(url: string): Promise<unknown>;
}

class ExchangeRateService {
  constructor(private readonly http: HttpClient) {}

  async getRate(from: string, to: string): Promise<number> {
    const response = await this.http.get(`/rates/${from}/${to}`) as { rate: number };
    return response.rate;
  }
}

it('환율을 조회한다', async () => {
  const stubHttp: HttpClient = {
    get: async () => ({ rate: 1350 }),
  };
  const service = new ExchangeRateService(stubHttp);
  const rate = await service.getRate('USD', 'KRW');
  expect(rate).toBe(1350);
  // 1ms 미만
});
```

**개선 방법**: DB, 네트워크, 파일 시스템을 인터페이스 뒤로 숨기고 테스트에서는 Fake나 Stub으로 교체하라. 실제 연동 테스트는 통합 테스트로 분리하라.

## 4. Shared Fixture — 테스트 간 상태 공유

**증상**: 클래스 레벨이나 모듈 레벨에 공유되는 객체가 있다. 특정 테스트가 통과하려면 다른 테스트가 먼저 실행되어야 한다.

**왜 나쁜가**: 테스트 실행 순서에 의존성이 생긴다. 한 테스트가 상태를 변경하면 다른 테스트가 오염된다. 병렬 실행이 불가능해진다.

```typescript
// 나쁜 예 — 공유 상태
describe('OrderRepository', () => {
  const db = new InMemoryDatabase(); // 모든 테스트가 공유
  const repo = new OrderRepository(db);

  it('주문을 저장한다', () => {
    repo.save(new Order({ id: 'o1' }));
    expect(repo.count()).toBe(1);
  });

  it('주문을 조회한다', () => {
    // 위 테스트가 먼저 실행되어 o1이 저장되어 있다고 가정
    const order = repo.findById('o1');
    expect(order).not.toBeNull();
  });

  it('주문 목록이 비어있다', () => {
    // 앞의 테스트들이 데이터를 넣었으므로 실패
    expect(repo.count()).toBe(0); // 실패: count는 1 이상
  });
});

// 좋은 예 — 각 테스트가 독립적인 상태를 가짐
describe('OrderRepository', () => {
  let db: InMemoryDatabase;
  let repo: OrderRepository;

  beforeEach(() => {
    db = new InMemoryDatabase(); // 매 테스트 전 새로 생성
    repo = new OrderRepository(db);
  });

  it('주문을 저장하면 count가 1 증가한다', () => {
    repo.save(new Order({ id: 'o1' }));
    expect(repo.count()).toBe(1);
  });

  it('저장된 주문을 ID로 조회할 수 있다', () => {
    repo.save(new Order({ id: 'o1' }));
    const order = repo.findById('o1');
    expect(order).not.toBeNull();
  });
});
```

**개선 방법**: `beforeEach`에서 상태를 매번 새로 초기화하라. 테스트 간 공유 객체를 최소화하라.

## 5. Over-specification — Mock으로 너무 많은 것을 검증

**증상**: 테스트에 `expect(mock.method).toHaveBeenCalledWith(...)` 가 넘쳐난다. 내부 호출 순서, 인자, 횟수를 전부 검증한다.

**왜 나쁜가**: 구현 세부사항에 강하게 묶여 있어 리팩토링이 불가능해진다. 동작은 같은데 구조를 바꾸면 테스트가 줄줄이 깨진다.

```typescript
// 나쁜 예 — 내부 협력 관계 전체를 검증
it('주문을 처리한다', () => {
  const mockInventory = jest.fn();
  const mockNotification = jest.fn();
  const mockAuditLog = jest.fn();

  const service = new OrderService(mockInventory, mockNotification, mockAuditLog);
  service.processOrder(order);

  // 이 모든 내부 호출을 검증하면
  expect(mockInventory).toHaveBeenCalledWith('p1', -3);
  expect(mockInventory).toHaveBeenCalledBefore(mockNotification); // 순서까지?
  expect(mockNotification).toHaveBeenCalledWith('user-1', 'ORDER_PLACED');
  expect(mockAuditLog).toHaveBeenCalledWith({ event: 'ORDER_PLACED', orderId: 'o1' });
  // OrderService 내부를 조금이라도 바꾸면 이 테스트가 깨진다
});

// 좋은 예 — 중요한 부수 효과만 선별하여 검증
it('주문 처리 시 고객에게 확인 알림이 전송된다', () => {
  const mockNotification = { send: jest.fn() };
  const stubInventory = { reserve: jest.fn() };
  const service = new OrderService(stubInventory, mockNotification);

  service.processOrder(order);

  // 이 테스트에서 중요한 것은 알림 전송 여부
  expect(mockNotification.send).toHaveBeenCalledWith(
    expect.objectContaining({ userId: order.userId, type: 'ORDER_PLACED' })
  );
});
```

**개선 방법**: 테스트 하나가 검증해야 할 한 가지 동작에만 집중하라. 나머지 의존성은 Stub으로 처리하고 검증하지 마라.

## 6. Assertion-Free Test — Assert 없는 테스트

**증상**: 테스트에 `expect`가 없다. 혹은 `expect(true).toBe(true)` 같은 의미 없는 assert만 있다.

**왜 나쁜가**: 항상 통과한다. 어떤 버그가 있어도 이 테스트는 녹색이다. 커버리지를 채우는 데만 기여할 뿐 실제로는 아무것도 보장하지 않는다.

```typescript
// 나쁜 예 — assert가 없는 테스트
it('주문을 생성한다', () => {
  const order = new Order({
    userId: 'u1',
    items: [{ productId: 'p1', quantity: 1, price: 1000 }],
  });
  // 아무것도 검증하지 않음 — 항상 통과
});

// 나쁜 예 — 예외가 발생하지 않는다는 것만 검증 (의도가 있을 때는 명시적으로)
it('주문 생성이 실패하지 않는다', async () => {
  try {
    await createOrder(validPayload);
  } catch {
    // 예외를 잡아도 테스트는 통과
  }
});

// 좋은 예 — 명확한 검증
it('유효한 입력으로 주문이 생성된다', () => {
  const order = new Order({
    userId: 'u1',
    items: [{ productId: 'p1', quantity: 1, price: 1000 }],
  });

  expect(order.status).toBe('PENDING');
  expect(order.totalAmount()).toBe(1000);
});
```

**개선 방법**: 모든 테스트에는 의미 있는 assert가 있어야 한다. "예외가 발생하지 않는다"는 검증이 필요하다면 `expect(() => ...).not.toThrow()`를 명시적으로 쓴다.

## 7. Test Code Duplication — 준비 코드 반복

**증상**: 비슷한 테스트 셋업 코드가 여러 테스트에 복사-붙여넣기 되어 있다.

**왜 나쁜가**: 도메인 객체의 생성자가 바뀌면 수십 개의 테스트를 모두 수정해야 한다. 유지보수 비용이 선형이 아닌 N배로 증가한다.

```typescript
// 나쁜 예 — 셋업 코드가 반복됨
it('일반 고객의 할인율은 5%다', () => {
  const customer = new Customer({
    id: 'c1', name: 'Alice', grade: 'NORMAL',
    email: 'a@test.com', joinedAt: new Date(),
  });
  expect(discountPolicy.rateFor(customer)).toBe(0.05);
});

it('VIP 고객의 할인율은 20%다', () => {
  const customer = new Customer({
    id: 'c2', name: 'Bob', grade: 'VIP',
    email: 'b@test.com', joinedAt: new Date(),
  });
  expect(discountPolicy.rateFor(customer)).toBe(0.20);
});

it('GOLD 고객의 할인율은 10%다', () => {
  const customer = new Customer({
    id: 'c3', name: 'Carol', grade: 'GOLD',
    email: 'c@test.com', joinedAt: new Date(),
  });
  expect(discountPolicy.rateFor(customer)).toBe(0.10);
});

// 좋은 예 — 헬퍼 함수로 중복 제거
function createCustomer(grade: CustomerGrade): Customer {
  return new Customer({
    id: `c-${Math.random()}`,
    name: '테스트 고객',
    grade,
    email: 'test@test.com',
    joinedAt: new Date(),
  });
}

it('일반 고객의 할인율은 5%다', () => {
  expect(discountPolicy.rateFor(createCustomer('NORMAL'))).toBe(0.05);
});

it('VIP 고객의 할인율은 20%다', () => {
  expect(discountPolicy.rateFor(createCustomer('VIP'))).toBe(0.20);
});

it('GOLD 고객의 할인율은 10%다', () => {
  expect(discountPolicy.rateFor(createCustomer('GOLD'))).toBe(0.10);
});
```

**개선 방법**: 반복되는 셋업은 헬퍼 함수나 테스트 데이터 빌더로 추출하라. `beforeEach`는 모든 테스트에 공통인 초기화에만 쓰고, 특정 테스트에만 필요한 것은 테스트 내부에서 직접 준비하라.

## 정리

| 냄새 | 핵심 문제 | 해결책 |
|------|-----------|--------|
| Obscure Test | 의도 불명 | 이름, 변수명, 매직 넘버 제거 |
| Fragile Test | 구현에 묶임 | 공개 인터페이스 결과만 검증 |
| Slow Test | 숨겨진 I/O | 의존성 역전, Fake/Stub 사용 |
| Shared Fixture | 상태 오염 | beforeEach로 매번 초기화 |
| Over-specification | Mock 과잉 | 핵심 부수 효과만 선별 검증 |
| Assertion-Free | 항상 통과 | 의미 있는 assert 추가 |
| Test Duplication | 유지보수 폭발 | 헬퍼 함수, 빌더 패턴 |

테스트 냄새는 테스트 코드 리뷰에서 잡는다. 프로덕션 코드 리뷰만큼 테스트 코드 리뷰에도 공을 들이는 팀이 장기적으로 빠르다.
