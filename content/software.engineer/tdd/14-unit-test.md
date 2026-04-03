---
title: "[TDD 시리즈] 14. 단위 테스트 — 무엇이 '단위'인가"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "단위 테스트", "Classical TDD", "Mockist TDD", "도메인 테스트"]
---

# 단위 테스트 — 무엇이 '단위'인가

"단위 테스트"라는 말은 모두 쓰는데, '단위'가 무엇인지는 사람마다 다르게 이해한다. 어떤 팀은 클래스 하나가 단위라 하고, 어떤 팀은 함수 하나, 어떤 팀은 도메인 개념 하나가 단위라고 한다. 이 차이는 단순한 용어 문제가 아니다. **어떤 걸 Mock할 것인가**, **테스트를 어떻게 구성할 것인가**의 핵심 결정이 여기서 갈린다.

## "단위"의 정의 논쟁

단위 테스트의 정의를 두고 두 진영이 오랫동안 논쟁했다.

**Classical TDD (Chicago School)**
- 단위 = 동작하는 코드 덩어리. 클래스가 여러 개여도 괜찮다.
- 협력 객체를 Mock으로 교체하지 않는다. 실제 구현을 쓴다.
- Mock은 외부 의존성(DB, HTTP, 파일)에만 쓴다.
- 대표 주자: Martin Fowler, Kent Beck

**Mockist TDD (London School)**
- 단위 = 단일 클래스 (또는 단일 모듈)
- 협력 객체는 전부 Mock으로 교체한다.
- 테스트 간 격리가 완전하다.
- 대표 주자: Steve Freeman, Nat Pryce ("Growing Object-Oriented Software" 저자)

어느 쪽이 옳은가? 둘 다 장단점이 있다. 하지만 실무에서는 Classical TDD가 더 유지보수 하기 쉬운 테스트를 만들어내는 경향이 있다. Mockist 스타일은 내부 구현에 테스트가 결합되어, 리팩토링할 때 테스트를 함께 수정해야 하는 일이 잦다.

## Classical TDD의 단위

```typescript
// Order, OrderItem, DiscountPolicy — 세 클래스가 관여하지만 하나의 단위로 테스트
describe('Order 할인 계산', () => {
  it('VIP 고객의 10만원 이상 주문에는 15% 할인이 적용된다', () => {
    const order = new Order({
      customerId: 'vip-user-1',
      customerGrade: CustomerGrade.VIP,
      items: [
        new OrderItem({ name: '노트북 거치대', price: 60_000, quantity: 1 }),
        new OrderItem({ name: '기계식 키보드', price: 80_000, quantity: 1 }),
      ],
    });

    const discountPolicy = new BulkVipDiscountPolicy();
    const result = discountPolicy.apply(order);

    expect(result.discountAmount).toBe(21_000); // 140_000 * 0.15
    expect(result.finalPrice).toBe(119_000);
  });
});
```

`Order`, `OrderItem`, `BulkVipDiscountPolicy` 세 클래스가 협력하지만 Mock이 없다. 이 테스트는 "VIP 고객의 대량 주문에 15% 할인이 적용된다"는 **동작**을 검증한다. 어떤 클래스가 계산을 수행하는지는 중요하지 않다.

## Mockist TDD의 단위

```typescript
// DiscountPolicy를 Mock으로 교체 — OrderService 하나만 테스트
describe('OrderService', () => {
  it('주문 생성 시 할인 정책을 적용하고 저장한다', async () => {
    const mockDiscountPolicy = {
      apply: jest.fn().mockReturnValue({ discountAmount: 21_000, finalPrice: 119_000 }),
    };
    const mockOrderRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    const service = new OrderService(mockDiscountPolicy, mockOrderRepository);
    await service.createOrder({ customerId: 'vip-user-1', items: [...] });

    expect(mockDiscountPolicy.apply).toHaveBeenCalledOnce();
    expect(mockOrderRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ finalPrice: 119_000 })
    );
  });
});
```

`OrderService` 하나만 테스트하고, 나머지는 전부 Mock이다. 격리는 완벽하지만 "실제 할인 계산이 올바른가"는 이 테스트에서 알 수 없다. `DiscountPolicy`를 따로 테스트해야 한다.

Mockist 스타일의 문제는 `OrderService`가 내부적으로 `discountPolicy.apply()`를 호출하는지를 검증한다는 점이다. `OrderService`의 구현이 바뀌면 — 예를 들어 할인 계산을 다른 방식으로 위임하면 — 동작은 같아도 테스트가 깨진다.

## 좋은 단위 테스트의 특성

**빠름 (Fast)**
단위 테스트는 밀리초 단위로 실행되어야 한다. 느리면 자주 돌리지 않게 된다. 외부 I/O가 없어야 빠르다.

**격리 (Isolated)**
테스트 순서에 의존하지 않아야 한다. 테스트 A가 실행된 뒤 테스트 B가 실패하면 안 된다. 전역 상태를 변경하는 테스트는 격리가 안 된 것이다.

**결정적 (Deterministic)**
같은 입력에 항상 같은 결과가 나와야 한다. `Math.random()`, `new Date()`, 네트워크 호출이 있으면 결정적이지 않다. 이런 의존성은 주입받아서 테스트에서 제어해야 한다.

```typescript
// 비결정적 — new Date()가 테스트 실행 시점에 따라 다름
class SubscriptionService {
  isActive(subscription: Subscription): boolean {
    return subscription.expiresAt > new Date(); // 문제
  }
}

// 결정적 — 현재 시간을 주입받음
class SubscriptionService {
  constructor(private readonly clock: Clock) {}

  isActive(subscription: Subscription): boolean {
    return subscription.expiresAt > this.clock.now();
  }
}

// 테스트
it('만료일이 지나면 구독이 비활성화된다', () => {
  const fixedClock = { now: () => new Date('2026-04-03') };
  const service = new SubscriptionService(fixedClock);

  const expiredSubscription = { expiresAt: new Date('2026-04-01') };
  expect(service.isActive(expiredSubscription)).toBe(false);
});
```

## 단위 테스트로 잡을 수 있는 것 vs 잡을 수 없는 것

**잡을 수 있는 것**
- 계산 로직의 버그 (할인율 계산, 세금 계산, 집계)
- 상태 전이 오류 (주문 상태가 잘못 바뀌는 경우)
- 유효성 검증 로직 (이메일 형식, 금액 범위)
- 예외 처리 (잘못된 입력에 대한 에러 응답)
- 비즈니스 규칙 분기 (조건에 따른 다른 처리)

**잡을 수 없는 것**
- ORM 매핑 오류 (컬럼명이 틀린 경우)
- SQL 쿼리 결과 (잘못된 JOIN, WHERE 조건)
- HTTP 직렬화 오류 (JSON 필드명 불일치)
- 외부 서비스 계약 변경 (API 응답 구조 변경)
- 인프라 설정 오류 (잘못된 DB 연결, 권한 문제)
- 컴포넌트 간 연결 문제

후자는 통합 테스트가 필요한 영역이다. 단위 테스트만으로 충분하다는 착각이 아이스크림 콘 안티패턴을 만든다.

## 도메인 로직에 집중하라

단위 테스트가 가장 빛나는 곳은 도메인 로직이다. 계산, 검증, 상태 전이, 정책 적용 — 이런 로직은 외부 의존성 없이 순수 함수나 도메인 객체로 표현될 수 있다.

```typescript
// Order 도메인 — 할인 계산
describe('Order.calculateTotal()', () => {
  it('정상 주문의 총액을 계산한다', () => {
    const order = Order.create({
      items: [
        { price: 10_000, quantity: 3 },
        { price: 25_000, quantity: 1 },
      ],
    });

    expect(order.subtotal()).toBe(55_000);
  });

  it('쿠폰 할인이 적용된 총액을 계산한다', () => {
    const order = Order.create({ items: [{ price: 50_000, quantity: 1 }] });
    const coupon = new FixedDiscountCoupon({ discountAmount: 5_000 });

    order.applyCoupon(coupon);

    expect(order.totalPrice()).toBe(45_000);
  });

  it('쿠폰 할인이 주문 금액보다 크면 0원이 된다', () => {
    const order = Order.create({ items: [{ price: 3_000, quantity: 1 }] });
    const coupon = new FixedDiscountCoupon({ discountAmount: 5_000 });

    order.applyCoupon(coupon);

    expect(order.totalPrice()).toBe(0); // 음수가 되지 않는다
  });
});

// Order 도메인 — 상태 전이
describe('Order 상태 전이', () => {
  it('결제 완료 시 주문 상태가 PAID로 바뀐다', () => {
    const order = Order.create({ items: [...] }); // 초기 상태: PENDING

    order.confirmPayment({ transactionId: 'tx-001' });

    expect(order.status).toBe(OrderStatus.PAID);
  });

  it('취소된 주문은 결제 확인이 불가능하다', () => {
    const order = Order.create({ items: [...] });
    order.cancel();

    expect(() => order.confirmPayment({ transactionId: 'tx-002' }))
      .toThrow(InvalidOrderStateError);
  });
});

// Order 도메인 — 유효성 검증
describe('Order 생성 유효성', () => {
  it('주문 항목이 없으면 생성에 실패한다', () => {
    expect(() => Order.create({ items: [] }))
      .toThrow('주문 항목은 최소 1개 이상이어야 합니다');
  });

  it('주문 항목의 수량이 0이하면 생성에 실패한다', () => {
    expect(() => Order.create({ items: [{ price: 10_000, quantity: 0 }] }))
      .toThrow('수량은 1개 이상이어야 합니다');
  });
});
```

이 테스트들은 외부 의존성이 전혀 없다. DB도 없고, HTTP도 없다. 순수하게 도메인 로직만 검증한다. 빠르고, 격리되어 있고, 결정적이다.

## Java에서의 단위 테스트

Java/Spring 환경에서는 `@SpringBootTest` 없이 순수 JUnit으로 도메인을 테스트한다.

```java
class OrderTest {

    @Test
    @DisplayName("VIP 고객의 주문에는 추가 할인이 적용된다")
    void applyVipDiscount() {
        Order order = Order.builder()
            .customerGrade(CustomerGrade.VIP)
            .items(List.of(
                OrderItem.of("상품A", 50_000, 2)
            ))
            .build();

        DiscountResult result = new VipDiscountPolicy().apply(order);

        assertThat(result.getDiscountAmount()).isEqualTo(10_000); // 100_000 * 10%
        assertThat(result.getFinalPrice()).isEqualTo(90_000);
    }

    @Test
    @DisplayName("배송 중인 주문은 취소할 수 없다")
    void cannotCancelShippingOrder() {
        Order order = Order.withStatus(OrderStatus.SHIPPING);

        assertThatThrownBy(() -> order.cancel())
            .isInstanceOf(InvalidOrderStateException.class)
            .hasMessage("배송 중인 주문은 취소할 수 없습니다");
    }
}
```

`@SpringBootTest`가 없으니 컨텍스트 로딩 없이 밀리초 단위로 실행된다.

## 결론

"단위"는 클래스 하나가 아니다. **하나의 동작, 하나의 비즈니스 규칙**이 단위다. 그 동작을 검증하는 데 여러 클래스가 협력해도 된다.

단위 테스트를 어디에 쓸지 헷갈릴 때는 간단한 질문을 해보면 된다: "이 로직은 DB 없이 검증할 수 있는가?" 그렇다면 단위 테스트 대상이다. DB가 있어야만 알 수 있는 것이라면 통합 테스트가 맞다.
