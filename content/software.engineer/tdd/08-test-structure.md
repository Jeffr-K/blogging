---
title: "[TDD 시리즈] 8. Given-When-Then으로 테스트를 명세처럼 쓰기"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "단위테스트", "GivenWhenThen", "AAA", "테스트구조"]
---

# Given-When-Then으로 테스트를 명세처럼 쓰기

테스트 코드는 두 가지 역할을 동시에 한다: 동작을 검증하고, 명세를 문서화한다. 구조가 잡혀 있지 않은 테스트는 두 역할을 모두 못한다. 읽어도 무슨 의도인지 모르고, 실패해도 무엇이 잘못됐는지 알기 어렵다.

Given-When-Then은 테스트를 명세처럼 쓰기 위한 구조다.

## Given-When-Then 구조

BDD에서 온 표현이지만 단위 테스트에도 그대로 적용된다. Arrange-Act-Assert(AAA)라고도 부른다. 이름만 다를 뿐 의미는 같다.

```
Given (Arrange) — 테스트 조건을 설정한다. 필요한 객체를 만들고, 상태를 준비한다.
When  (Act)     — 테스트 대상 동작을 실행한다. 딱 하나의 행동.
Then  (Assert)  — 결과를 검증한다. 기대한 상태 또는 반환값을 확인한다.
```

```typescript
it('재고가 충분하면 주문이 성공한다', () => {
  // Given
  const product = new Product({ id: 'p1', stock: 10 });
  const order = new Order({ productId: 'p1', quantity: 3 });

  // When
  const result = order.place(product);

  // Then
  expect(result.status).toBe('PLACED');
  expect(product.stock).toBe(7);
});
```

각 단계 사이에 빈 줄을 두는 것이 관례다. 주석 `// Given`, `// When`, `// Then`을 명시적으로 쓰는 것도 좋다. 특히 팀에 TDD가 익숙하지 않은 사람이 있을 때 가독성이 훨씬 좋아진다.

## 하나의 테스트에 하나의 Assert

하나의 테스트에서 여러 개를 검증하면 실패 시 어느 부분이 문제인지 알기 어렵다.

```typescript
// 나쁜 예 — 여러 개의 assert
it('주문 처리', () => {
  const order = new Order({ items: [{ price: 1000, quantity: 2 }] });

  order.place();

  expect(order.status).toBe('PLACED');
  expect(order.total()).toBe(2000);
  expect(order.placedAt).not.toBeNull();
  expect(order.items).toHaveLength(1);
  // 첫 번째 assert가 실패하면 나머지는 실행되지 않는다
  // 실패 메시지: "Expected 'PENDING' to be 'PLACED'" — 무엇을 검증하는 테스트인지 불분명
});
```

실패 메시지만 봐서는 "주문 처리 테스트가 실패했다"는 것만 알 뿐, 정확히 무엇이 문제인지 바로 보이지 않는다.

```typescript
// 좋은 예 — 각 검증을 별도 테스트로
it('주문이 접수되면 상태가 PLACED다', () => {
  const order = createBasicOrder();
  order.place();
  expect(order.status).toBe('PLACED');
});

it('주문이 접수되면 총액이 계산된다', () => {
  const order = createBasicOrder();
  order.place();
  expect(order.total()).toBe(2000);
});

it('주문이 접수되면 접수 시각이 기록된다', () => {
  const order = createBasicOrder();
  order.place();
  expect(order.placedAt).not.toBeNull();
});
```

테스트 이름만으로 무엇을 검증하는지 알 수 있다. 실패 시 정확히 어느 동작이 깨졌는지 즉시 보인다.

"하나의 Assert"를 지나치게 기계적으로 적용할 필요는 없다. 논리적으로 하나의 개념을 검증하는 여러 assert는 괜찮다. 예를 들어 좌표 객체의 x, y를 같이 검증하는 것은 자연스럽다. 원칙의 의도는 "하나의 테스트는 하나의 이유로만 실패해야 한다"는 것이다.

## 테스트 데이터 빌더 패턴

복잡한 도메인 객체를 테스트마다 새로 만들면 중복이 심해지고, 내부 구조가 바뀌면 모든 테스트를 고쳐야 한다.

```typescript
// 나쁜 예 — 매 테스트마다 복잡한 객체를 직접 생성
it('VIP 고객은 추가 할인을 받는다', () => {
  const customer = new Customer({
    id: 'c1',
    name: 'Alice',
    email: 'alice@example.com',
    grade: 'VIP',
    joinedAt: new Date('2020-01-01'),
    address: { city: 'Seoul', zipCode: '04524' },
  });
  // 실제로 테스트에서 중요한 건 grade: 'VIP' 하나뿐인데
  // 나머지 필드를 전부 채워야 한다
});
```

테스트 데이터 빌더는 기본값을 제공하고 필요한 속성만 오버라이드할 수 있게 한다.

```typescript
// 테스트 데이터 빌더
class CustomerBuilder {
  private data: Customer = {
    id: 'c-default',
    name: '기본 고객',
    email: 'default@example.com',
    grade: 'NORMAL',
    joinedAt: new Date('2023-01-01'),
    address: { city: 'Seoul', zipCode: '00000' },
  };

  withGrade(grade: CustomerGrade): this {
    this.data = { ...this.data, grade };
    return this;
  }

  withId(id: string): this {
    this.data = { ...this.data, id };
    return this;
  }

  build(): Customer {
    return new Customer(this.data);
  }
}

// 테스트에서 필요한 것만 지정
it('VIP 고객은 추가 할인을 받는다', () => {
  const customer = new CustomerBuilder().withGrade('VIP').build();
  const discount = discountPolicy.calculate(customer, 10000);
  expect(discount).toBe(2000); // VIP 20% 할인
});

it('일반 고객은 기본 할인만 받는다', () => {
  const customer = new CustomerBuilder().withGrade('NORMAL').build();
  const discount = discountPolicy.calculate(customer, 10000);
  expect(discount).toBe(500); // 일반 5% 할인
});
```

테스트 데이터 빌더는 **테스트 코드의 의도를 드러낸다**. 각 테스트에서 무엇이 중요한지 한 눈에 보인다.

## 경계값 분석

버그는 경계에서 난다. 중간값은 보통 잘 동작한다. 문제는 0, -1, 최댓값, 최솟값, null, 빈 문자열에서 터진다.

```typescript
// 할인율 적용 — 경계값 테스트
describe('할인율 검증', () => {
  it('0%는 유효한 할인율이다', () => {
    expect(() => new DiscountRate(0)).not.toThrow();
  });

  it('100%는 유효한 할인율이다', () => {
    expect(() => new DiscountRate(100)).not.toThrow();
  });

  it('음수 할인율은 거부된다', () => {
    expect(() => new DiscountRate(-1)).toThrow(InvalidDiscountRateError);
  });

  it('100%를 초과하는 할인율은 거부된다', () => {
    expect(() => new DiscountRate(101)).toThrow(InvalidDiscountRateError);
  });
});

// 장바구니 수량 — 경계값 테스트
describe('장바구니 수량', () => {
  it('수량 0은 상품을 추가하지 않는다', () => {
    const cart = new Cart();
    cart.add({ id: 'p1', price: 1000 }, 0);
    expect(cart.isEmpty()).toBe(true);
  });

  it('최대 수량(999)은 허용된다', () => {
    const cart = new Cart();
    expect(() => cart.add({ id: 'p1', price: 1000 }, 999)).not.toThrow();
  });

  it('최대 수량을 초과하면 예외가 발생한다', () => {
    const cart = new Cart();
    expect(() => cart.add({ id: 'p1', price: 1000 }, 1000)).toThrow(
      ExceededMaxQuantityError
    );
  });
});
```

경계값 분석의 원칙: **경계 바로 안쪽**, **경계 그 자체**, **경계 바로 바깥쪽**을 각각 테스트하라.

## 동등 클래스 분류

모든 입력값을 테스트할 수는 없다. 동등 클래스 분류는 비슷하게 동작하는 입력을 묶어 **대표값 하나**만 테스트하는 기법이다.

```typescript
// 나쁜 예 — 같은 동작을 하는 값들을 전부 테스트
it('양수를 입력하면 통과한다 (1)', () => { /* ... */ });
it('양수를 입력하면 통과한다 (2)', () => { /* ... */ });
it('양수를 입력하면 통과한다 (100)', () => { /* ... */ });
it('양수를 입력하면 통과한다 (9999)', () => { /* ... */ });
// 이것들은 모두 같은 동등 클래스에 속한다 — 하나면 충분

// 좋은 예 — 동등 클래스당 대표값 하나
describe('할인율 유효성 검사', () => {
  // 동등 클래스 1: 유효한 범위 (0 ~ 100)
  it('유효한 할인율은 생성된다', () => {
    expect(() => new DiscountRate(50)).not.toThrow();
  });

  // 동등 클래스 2: 음수 (유효하지 않음)
  it('음수 할인율은 거부된다', () => {
    expect(() => new DiscountRate(-5)).toThrow();
  });

  // 동등 클래스 3: 100 초과 (유효하지 않음)
  it('100 초과 할인율은 거부된다', () => {
    expect(() => new DiscountRate(150)).toThrow();
  });
});
```

동등 클래스 분류와 경계값 분석은 함께 쓴다. 클래스로 테스트 범위를 좁히고, 경계에서 정밀하게 검증한다.

## 테스트 이름 — 행동 명세 스타일

테스트 이름은 코드에서 **유일하게 사람이 읽기 위해 쓰는 것**이다. `test1`, `shouldWork`, `checkOrder` 같은 이름은 테스트 실패 리포트에서 아무 정보를 주지 않는다.

행동 명세 스타일은 `[주어]_[조건]_[기대 결과]` 혹은 `[상황]이면_[행동]_[결과]` 패턴을 따른다.

```typescript
// 나쁜 이름
it('test order', () => { /* ... */ });
it('주문 테스트', () => { /* ... */ });
it('order cancellation', () => { /* ... */ });

// 좋은 이름 — 행동 명세 스타일
it('재고가 부족하면_주문이_거부된다', () => { /* ... */ });
it('주문이_취소되면_재고가_복구된다', () => { /* ... */ });
it('VIP_고객의_첫_주문은_추가_할인이_적용된다', () => { /* ... */ });
it('만료된_쿠폰으로_결제하면_InvalidCouponError가_발생한다', () => { /* ... */ });
```

좋은 이름의 기준은 단순하다: **테스트 코드를 읽지 않고 이름만으로 무엇을 검증하는지 알 수 있는가**. CI에서 테스트가 실패했을 때 이름만 보고 어디를 봐야 하는지 알 수 있어야 한다.

## 정리

- **Given-When-Then** 구조를 따르면 테스트가 명세가 된다
- **하나의 테스트, 하나의 실패 이유** — 무엇이 깨졌는지 즉시 보인다
- **테스트 데이터 빌더**로 복잡한 객체 생성을 캡슐화한다
- **경계값 분석**으로 버그가 숨어 있는 곳을 정밀하게 찌른다
- **동등 클래스 분류**로 테스트 수를 적정하게 유지한다
- **행동 명세 스타일 이름**으로 테스트를 살아있는 문서로 만든다

구조가 잡힌 테스트는 새로운 팀원이 코드베이스를 이해하는 가장 빠른 경로가 된다.
