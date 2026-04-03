---
title: "[TDD 시리즈] 2. Classical TDD vs Mockist TDD"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "Classical TDD", "Mockist TDD", "Detroit School", "London School", "Mock"]
---

# Classical TDD vs Mockist TDD

TDD를 배울수록 두 진영이 존재한다는 걸 알게 된다. 한쪽은 Mock을 최대한 피하고, 다른 쪽은 Mock으로 모든 협력 객체를 격리한다. 같은 TDD인데 왜 이렇게 다를까.

## TDD의 기원 — Kent Beck과 XP

TDD는 1990년대 후반 Kent Beck이 Extreme Programming(XP)을 정립하면서 체계화됐다. 핵심 주장은 단순했다: **프로덕션 코드 한 줄을 쓰기 전에 실패하는 테스트를 먼저 작성하라.**

2002년 Beck의 저서 *Test-Driven Development: By Example*이 출판되면서 TDD가 널리 알려졌다. 이 책에서 보여주는 방식이 이후 "Classical TDD" 또는 "Detroit School"로 불리게 된다.

같은 시기 런던에서는 다른 접근이 등장했다. Steve Freeman과 Nat Pryce를 중심으로 한 그룹이 Mock 객체를 전면에 내세운 TDD를 발전시켰다. 이들의 방식이 "Mockist TDD" 또는 "London School"이다. 2009년 *Growing Object-Oriented Software, Guided by Tests* (GOOS)로 집대성됐다.

## Detroit School — Classical TDD

Detroit School의 철학은 **실제 객체를 사용하고 최종 상태를 검증한다**는 것이다.

가능하면 실제 의존 객체를 사용한다. 느리거나 외부에 연결된 의존성(DB, 네트워크)만 Test Double로 교체한다. 내부 도메인 객체는 실제를 사용한다.

```typescript
// Detroit School — 실제 객체를 사용한 테스트
describe('Order', () => {
  it('상품을 추가하면 총금액이 증가한다', () => {
    const order = new Order();
    const item = new OrderItem('상품A', 10000, 2); // 실제 OrderItem 사용

    order.addItem(item);

    // 상태 검증: 최종 결과가 올바른가
    expect(order.totalAmount).toBe(20000);
    expect(order.items).toHaveLength(1);
  });
});

describe('OrderService', () => {
  it('주문을 생성하면 재고가 차감된다', () => {
    // 실제 객체 사용 — InMemory 구현체로 빠르게 만들기도 함
    const inventory = new InMemoryInventory({ 'item-1': 10 });
    const orderRepo = new InMemoryOrderRepository();
    const service = new OrderService(orderRepo, inventory);

    service.createOrder({ itemId: 'item-1', quantity: 3 });

    // 상태 검증
    expect(inventory.getStock('item-1')).toBe(7);
    expect(orderRepo.findAll()).toHaveLength(1);
  });
});
```

테스트에서 `inventory.getStock()`를 호출해 상태를 직접 확인한다. "재고가 차감됐는가"라는 결과에 집중한다.

## London School — Mockist TDD

London School의 철학은 **Mock으로 협력 객체를 격리하고 상호작용을 검증한다**는 것이다.

테스트 대상(SUT, System Under Test)을 제외한 모든 협력 객체를 Mock으로 교체한다. 테스트는 SUT가 협력 객체에게 올바른 메시지를 보내는지 확인한다.

```typescript
// London School — Mock으로 협력 객체를 격리한 테스트
describe('OrderService', () => {
  it('주문을 생성하면 재고 차감을 요청한다', () => {
    const mockInventory = {
      decreaseStock: jest.fn(),
      getStock: jest.fn().mockReturnValue(10),
    };
    const mockOrderRepo = {
      save: jest.fn(),
    };
    const service = new OrderService(mockOrderRepo, mockInventory);

    service.createOrder({ itemId: 'item-1', quantity: 3 });

    // 행동 검증: 올바른 메시지를 보냈는가
    expect(mockInventory.decreaseStock).toHaveBeenCalledWith('item-1', 3);
    expect(mockOrderRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item-1', quantity: 3 })
    );
  });
});
```

`mockInventory.decreaseStock`이 올바른 인자로 호출됐는지 확인한다. 실제 재고가 얼마인지는 관심 없다. "차감 요청을 올바르게 했는가"에 집중한다.

## 같은 시나리오, 두 가지 방식

동일한 장바구니 할인 기능을 두 방식으로 테스트하면 차이가 더 명확해진다.

```typescript
// 시나리오: 쿠폰 서비스에서 쿠폰을 조회하고 장바구니에 할인을 적용한다

// === Detroit School ===
describe('CartService (Classical)', () => {
  it('유효한 쿠폰 코드로 할인 금액을 계산한다', () => {
    // 실제 구현체 또는 InMemory Fake 사용
    const couponRepo = new InMemoryCouponRepository([
      new Coupon('SAVE10', 0.1, isValid: true),
    ]);
    const service = new CartService(couponRepo);
    const cart = new Cart([new CartItem('상품A', 50000)]);

    const result = service.applyCoupon(cart, 'SAVE10');

    // 최종 상태 검증
    expect(result.discountedTotal).toBe(45000);
  });
});

// === London School ===
describe('CartService (Mockist)', () => {
  it('유효한 쿠폰 코드로 할인 금액을 계산한다', () => {
    // Mock으로 협력 객체 격리
    const mockCouponRepo = {
      findByCode: jest.fn().mockReturnValue(
        new Coupon('SAVE10', 0.1, isValid: true)
      ),
    };
    const service = new CartService(mockCouponRepo);
    const cart = new Cart([new CartItem('상품A', 50000)]);

    const result = service.applyCoupon(cart, 'SAVE10');

    // 행동 검증 + 상태 검증
    expect(mockCouponRepo.findByCode).toHaveBeenCalledWith('SAVE10');
    expect(result.discountedTotal).toBe(45000);
  });
});
```

Detroit School 테스트는 `CouponRepository`의 실제 구현이 필요하다. 테스트가 설정하고 검증하는 것은 최종 결과다.

London School 테스트는 `CouponRepository`를 Mock으로 교체한다. 테스트는 `findByCode`가 올바른 인자로 호출됐는지 추가로 확인한다.

## 철학적 차이 — 어디까지 격리할 것인가

두 학파의 근본적인 차이는 "격리의 범위"에 대한 생각이다.

**Detroit School**은 단위 테스트의 "단위"를 **동작(behavior)** 으로 본다. 하나의 동작을 검증하는 테스트라면 여러 클래스를 함께 테스트해도 된다. 중요한 건 결과가 올바른가이지, 어떤 클래스를 거쳤는가가 아니다.

**London School**은 단위 테스트의 "단위"를 **클래스(class)** 로 본다. 각 클래스는 독립적으로 테스트되어야 한다. Mock은 설계를 드러내는 도구다. 테스트를 먼저 작성하면서 Mock을 설정하는 과정이 협력 관계를 명확하게 만든다.

London School에서 Mock이 많아진다면 그 자체가 설계 신호다. "이 클래스는 너무 많은 협력 객체에 의존하고 있다"는 것을 테스트가 보여준다.

## 각각 언제 적합한가

**Detroit School이 적합한 경우:**
- 도메인 로직이 복잡하고 여러 도메인 객체가 협력하는 경우
- 불변 객체, 순수 함수 위주의 설계
- 리팩토링을 자주 하는 경우 (Mock은 구현에 결합되어 리팩토링을 방해할 수 있다)

**London School이 적합한 경우:**
- 객체 간 메시지 패싱이 설계의 핵심인 경우
- 아직 구현되지 않은 협력 객체와 함께 개발할 때 (Outside-In TDD)
- 레이어 간 경계를 명확하게 검증하고 싶을 때

## 실무에서는 혼합 사용

현실에서 한 학파만 고집하는 팀은 드물다. 도메인 레이어는 Detroit 방식으로, 애플리케이션 서비스 레이어는 London 방식으로 사용하는 것이 자연스럽다.

```typescript
// 도메인 레이어 — Detroit: 실제 객체 사용
describe('Order (Domain)', () => {
  it('취소된 주문에는 상품을 추가할 수 없다', () => {
    const order = Order.cancelled(); // 실제 도메인 객체

    expect(() => order.addItem(new OrderItem('상품', 1000, 1)))
      .toThrow('취소된 주문에는 상품을 추가할 수 없습니다');
  });
});

// 애플리케이션 서비스 레이어 — London: Mock으로 외부 의존성 격리
describe('OrderApplicationService', () => {
  it('주문 생성 시 재고 부족이면 예외를 던진다', () => {
    const mockInventory = {
      checkAvailability: jest.fn().mockReturnValue(false),
    };
    const service = new OrderApplicationService(mockInventory, mockOrderRepo);

    expect(() => service.createOrder({ itemId: 'item-1', quantity: 5 }))
      .toThrow(InsufficientStockError);

    expect(mockInventory.checkAvailability).toHaveBeenCalledWith('item-1', 5);
  });
});
```

어느 학파가 옳고 그름의 문제가 아니다. 각 방식의 트레이드오프를 이해하고 상황에 맞게 선택하는 것이 실용적인 접근이다.
