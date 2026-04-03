---
title: "[TDD 시리즈] 1. TDD는 테스트가 아니라 설계다"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "설계", "테스트", "리팩토링", "피드백루프"]
---

# TDD는 테스트가 아니라 설계다

TDD를 "테스트를 먼저 쓰는 것"으로 이해하면 금방 포기하게 된다. 테스트 파일을 열고 아직 존재하지 않는 클래스를 호출하는 코드를 쓰는 게 왜 좋다는 건지 납득이 안 된다. TDD의 핵심은 테스트 순서가 아니라 **설계 피드백 루프**다.

## 전통적 개발의 문제

전통적인 개발 흐름은 이렇다.

```
요구사항 → 설계 → 구현 → 테스트
```

테스트는 마지막에 온다. 구현이 끝난 뒤 "잘 동작하는지 확인"하는 용도다. 이 구조에서 발생하는 문제가 있다.

설계 결정의 피드백이 너무 늦게 온다. 클래스 간 결합도가 너무 높았다는 걸, 의존성 주입이 빠졌다는 걸, 인터페이스 설계가 사용하기 어렵다는 걸 구현을 다 끝낸 뒤에야 알게 된다.

```typescript
// 전통적 방식으로 만든 결과 — 테스트를 나중에 쓰려 하면 막힌다
class OrderService {
  processOrder(orderId: string): void {
    // 직접 DB 연결
    const conn = new DatabaseConnection('postgres://prod-db/orders');
    const order = conn.query(`SELECT * FROM orders WHERE id = '${orderId}'`);

    // 직접 외부 서비스 호출
    const paymentResult = PaymentGateway.charge(order.userId, order.amount);

    // 직접 이메일 발송
    EmailSender.send(order.email, `주문 ${orderId} 처리 완료`);

    conn.execute(`UPDATE orders SET status = 'done' WHERE id = '${orderId}'`);
  }
}
```

이 코드를 테스트하려면 실제 DB가 필요하고, 실제 결제 게이트웨이가 필요하고, 실제 이메일 서버가 필요하다. 테스트가 불가능한 게 아니라, 설계가 나쁜 것이다.

## Testability = Designability

테스트하기 어려운 코드는 설계가 나쁜 코드다. 이 등식이 TDD의 핵심 통찰이다.

테스트하기 어려운 이유를 나열하면 항상 설계 문제로 귀결된다.

- "DB가 없어서 테스트가 안 된다" → 의존성이 역전되어 있지 않다
- "다른 서비스가 필요해서 단독으로 실행이 안 된다" → 결합도가 너무 높다
- "전역 상태를 바꿔서 테스트 순서에 따라 결과가 달라진다" → 부수 효과가 관리되지 않는다
- "어떤 상황을 재현해야 하는지 모르겠다" → 인터페이스가 명확하지 않다

테스트를 먼저 쓰면 이 문제들을 구현 전에 발견할 수 있다.

```typescript
// 테스트를 먼저 쓰면 설계가 강제된다
describe('OrderService', () => {
  it('주문을 처리하면 결제가 요청되고 상태가 업데이트된다', async () => {
    // 테스트를 쓰는 시점에 "무엇을 주입해야 하는가"가 명확해진다
    const mockOrderRepo = { findById: jest.fn(), save: jest.fn() };
    const mockPaymentGateway = { charge: jest.fn().mockResolvedValue({ success: true }) };
    const mockEmailSender = { send: jest.fn() };

    const service = new OrderService(mockOrderRepo, mockPaymentGateway, mockEmailSender);

    await service.processOrder('order-123');

    expect(mockPaymentGateway.charge).toHaveBeenCalledWith('order-123');
    expect(mockOrderRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done' })
    );
  });
});
```

테스트를 먼저 쓰는 순간 `OrderService`가 무엇에 의존하는지, 어떻게 의존성을 주입받아야 하는지가 드러난다. 이 설계 결정을 구현 전에 하게 되는 것이다.

## 빠른 피드백 루프의 가치

버그를 나중에 발견할수록 수정 비용이 증가한다. 이 개념은 직관적으로 이해되지만 실제로 얼마나 차이가 나는지는 체감하기 어렵다.

```
코딩 중 발견:   수정 비용 1x
코드 리뷰 중:   수정 비용 6x
QA 테스트 중:   수정 비용 15x
프로덕션 배포 후: 수정 비용 64x
```

TDD의 피드백 루프는 초 단위다. 테스트를 실행하면 방금 쓴 코드가 의도대로 동작하는지 즉시 알 수 있다. 설계 결정의 적절함도 마찬가지다. 테스트 작성이 어려워지는 순간 설계에 문제가 있다는 신호를 즉시 받는다.

## Living Documentation

테스트는 코드의 명세다. 주석보다 신뢰할 수 있는 명세다.

주석은 코드가 바뀌어도 업데이트되지 않는다. 테스트는 코드가 바뀌면 실패한다. 따라서 통과하는 테스트는 항상 현재 동작을 정확하게 기술한다.

```typescript
describe('CartDiscountCalculator', () => {
  describe('10만원 이상 구매 시', () => {
    it('10% 할인을 적용한다', () => {
      const cart = new Cart([
        new CartItem('상품A', 60000),
        new CartItem('상품B', 50000),
      ]);

      const discounted = calculator.calculate(cart);

      expect(discounted.totalPrice).toBe(99000); // 110000 * 0.9
    });
  });

  describe('10만원 미만 구매 시', () => {
    it('할인을 적용하지 않는다', () => {
      const cart = new Cart([new CartItem('상품A', 50000)]);

      const discounted = calculator.calculate(cart);

      expect(discounted.totalPrice).toBe(50000);
    });
  });
});
```

이 테스트를 읽으면 `CartDiscountCalculator`가 무엇을 하는지, 어떤 조건에서 어떻게 동작하는지 즉시 알 수 있다. 구현 코드를 볼 필요가 없다.

## 회귀 방어와 리팩토링 용기

테스트가 없으면 리팩토링을 두려워하게 된다. "건드렸다가 뭔가 깨지면 어쩌지"라는 생각이 코드를 그대로 두게 만든다. 기술 부채가 쌓이는 주요 원인이다.

테스트가 있으면 리팩토링 후 테스트를 돌려보면 된다. 모두 통과하면 동작이 유지된다는 확신이 있다. 이것이 **리팩토링 용기**다.

```typescript
// 리팩토링 전 — 중복이 있고 이름이 불명확
function calc(items: { p: number; q: number }[]): number {
  let t = 0;
  for (const i of items) {
    t += i.p * i.q;
  }
  if (t >= 100000) {
    t = t * 0.9;
  }
  return t;
}

// 리팩토링 후 — 의도가 명확
function calculateTotalWithDiscount(items: OrderItem[]): number {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return applyBulkDiscount(subtotal);
}

function applyBulkDiscount(subtotal: number): number {
  const BULK_THRESHOLD = 100_000;
  const BULK_DISCOUNT_RATE = 0.1;
  return subtotal >= BULK_THRESHOLD
    ? subtotal * (1 - BULK_DISCOUNT_RATE)
    : subtotal;
}
```

리팩토링 전후 테스트는 동일하다. 테스트가 통과하는 한 리팩토링은 안전하다.

## TDD 흐름

TDD의 실제 흐름은 세 단계의 반복이다.

```
Red   → 실패하는 테스트를 작성한다 (설계를 탐색한다)
Green → 최소한의 코드로 테스트를 통과시킨다
Refactor → 동작을 유지하면서 설계를 개선한다
```

"테스트를 먼저 쓴다"는 것은 이 루프의 시작점일 뿐이다. 루프를 반복하면서 설계가 점진적으로 드러나고 개선된다.

TDD는 테스트 기법이 아니다. 설계를 주도하는 개발 방법론이다.
