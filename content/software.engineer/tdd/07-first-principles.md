---
title: "[TDD 시리즈] 7. F.I.R.S.T — 좋은 단위 테스트의 5가지 조건"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "단위테스트", "FIRST원칙", "테스트설계"]
---

# F.I.R.S.T — 좋은 단위 테스트의 5가지 조건

테스트가 있다고 해서 좋은 테스트는 아니다. 통과는 하지만 신뢰할 수 없고, 느리고, 환경마다 결과가 달라지고, 실패해도 무엇이 잘못됐는지 알 수 없는 테스트들이 있다. F.I.R.S.T는 단위 테스트가 갖춰야 할 다섯 가지 조건이다. 이 조건들은 서로 독립적이지 않다 — 하나가 무너지면 나머지도 흔들린다.

## Fast — 빠르게 실행돼야 한다

단위 테스트는 **밀리초 단위**로 실행되어야 한다. 느린 테스트는 실행하지 않게 된다. 실행하지 않는 테스트는 없는 것과 같다.

단위 테스트가 느려지는 원인은 거의 항상 같다: DB 접근, 네트워크 호출, 파일 I/O, sleep(). 이것들이 하나라도 섞이면 단위 테스트가 아니라 통합 테스트다.

```typescript
// 나쁜 예 — 실제 DB를 사용하면 테스트 전체가 느려진다
describe('UserService', () => {
  it('사용자를 저장하고 조회한다', async () => {
    const db = new PostgresDatabase(); // 실제 DB 연결
    const service = new UserService(db);

    await service.save({ id: '1', name: 'Alice' });
    const user = await service.findById('1');

    expect(user.name).toBe('Alice');
    // 이 테스트 하나에 200~500ms — 1000개면 몇 분
  });
});

// 좋은 예 — DB를 Fake로 교체
describe('UserService', () => {
  it('사용자를 저장하고 조회한다', async () => {
    const db = new InMemoryUserRepository(); // 메모리 내 구현
    const service = new UserService(db);

    await service.save({ id: '1', name: 'Alice' });
    const user = await service.findById('1');

    expect(user.name).toBe('Alice');
    // 1ms 미만
  });
});
```

느린 테스트가 생겼을 때의 잘못된 대응은 "어쩔 수 없지"가 아니라 "왜 느린가"를 따지는 것이다. 느린 테스트는 설계 문제의 신호다 — 의존성이 제대로 역전되어 있지 않다는 뜻이다.

## Isolated — 테스트는 서로 독립적이어야 한다

테스트는 **어떤 순서로 실행해도 같은 결과**를 내야 한다. 테스트 A가 통과해야 테스트 B가 통과하는 구조는 시한폭탄이다. 로컬에서는 성공하다가 CI에서 실패하는 테스트의 90%는 실행 순서 의존성 때문이다.

```typescript
// 나쁜 예 — 공유 상태가 테스트 간 오염을 만든다
let cart: Cart;

describe('Cart', () => {
  // 이 테스트가 먼저 실행되어야 아래 테스트가 통과함
  it('상품을 추가한다', () => {
    cart = new Cart();
    cart.add({ id: 'p1', price: 1000 });
    expect(cart.count()).toBe(1);
  });

  it('상품을 제거한다', () => {
    // cart가 위 테스트에서 초기화되어 있다고 가정
    cart.remove('p1');
    expect(cart.count()).toBe(0);
  });
});

// 좋은 예 — 각 테스트가 자신의 상태를 직접 준비한다
describe('Cart', () => {
  it('상품을 추가한다', () => {
    const cart = new Cart();
    cart.add({ id: 'p1', price: 1000 });
    expect(cart.count()).toBe(1);
  });

  it('상품을 제거한다', () => {
    const cart = new Cart();
    cart.add({ id: 'p1', price: 1000 }); // 이 테스트에서 직접 준비
    cart.remove('p1');
    expect(cart.count()).toBe(0);
  });
});
```

`beforeEach`로 상태를 초기화하는 것도 좋지만, 진짜 해법은 각 테스트가 필요한 것을 직접 만드는 것이다. 공유 Fixture는 줄일수록 좋다.

## Repeatable — 어떤 환경에서도 같은 결과

같은 테스트가 어떤 머신, 어떤 시간, 어떤 환경에서 실행해도 같은 결과를 내야 한다. 반복 불가능한 테스트는 신뢰할 수 없다. 신뢰할 수 없는 테스트는 팀 전체의 생산성을 갉아먹는다.

비결정적 테스트를 만드는 주범은 세 가지다: **시간**, **난수**, **외부 시스템**.

```typescript
// 나쁜 예 — 현재 시간에 의존하는 테스트
it('만료된 세션을 감지한다', () => {
  const session = new Session({ createdAt: new Date('2024-01-01') });
  // 이 테스트는 2024-01-01 이후에 실행해야만 통과
  expect(session.isExpired()).toBe(true);
});

// 좋은 예 — 시간을 주입받는 구조
interface Clock {
  now(): Date;
}

class Session {
  constructor(
    private readonly createdAt: Date,
    private readonly clock: Clock,
    private readonly ttlMs: number = 30 * 60 * 1000
  ) {}

  isExpired(): boolean {
    return this.clock.now().getTime() - this.createdAt.getTime() > this.ttlMs;
  }
}

it('만료된 세션을 감지한다', () => {
  const fixedClock: Clock = {
    now: () => new Date('2024-01-01T02:00:00Z'),
  };
  const session = new Session(
    new Date('2024-01-01T00:00:00Z'),
    fixedClock,
    60 * 60 * 1000 // 1시간
  );

  expect(session.isExpired()).toBe(true);
});
```

난수도 같은 방식으로 해결한다. `Math.random()`을 직접 호출하지 말고 `Random` 인터페이스로 주입받아라. 테스트에서는 고정값을 반환하는 구현을 넣는다.

## Self-validating — 테스트는 스스로 통과/실패를 판단해야 한다

테스트 결과를 확인하기 위해 로그를 읽거나, 파일을 열어보거나, 눈으로 출력을 비교해야 한다면 그것은 테스트가 아니다. 테스트는 `assert`로 스스로 판단해야 한다.

```typescript
// 나쁜 예 — 사람이 로그를 봐야 통과 여부를 알 수 있다
it('주문 금액을 계산한다', () => {
  const order = new Order([
    { price: 1000, quantity: 2 },
    { price: 500, quantity: 3 },
  ]);

  console.log('총액:', order.total()); // 2500이 출력되는지 사람이 확인?
});

// 좋은 예 — assert가 자동으로 검증한다
it('주문 금액을 계산한다', () => {
  const order = new Order([
    { price: 1000, quantity: 2 },
    { price: 500, quantity: 3 },
  ]);

  expect(order.total()).toBe(2500);
});
```

`console.log`로 확인하는 테스트는 항상 통과한다. 어떤 값이 나와도 테스트 프레임워크는 알 수 없다. CI 파이프라인에서는 아무도 그 로그를 보지 않는다.

Self-validating을 무너뜨리는 또 다른 패턴은 예외를 잡아 삼키는 것이다.

```typescript
// 나쁜 예 — 예외를 잡아버리면 테스트가 항상 통과
it('잘못된 입력을 처리한다', () => {
  try {
    parseAmount('-100');
  } catch (e) {
    // 무시
  }
  // 어떤 경우에도 통과
});

// 좋은 예
it('음수 금액은 예외를 던진다', () => {
  expect(() => parseAmount('-100')).toThrow(InvalidAmountError);
});
```

## Timely — 적시에 작성해야 한다

F.I.R.S.T의 나머지 네 조건은 테스트 품질에 관한 것이다. Timely만 유일하게 **언제 쓰는가**에 관한 것이다.

테스트는 프로덕션 코드와 **함께** 혹은 **직전**에 작성해야 한다. 기능 구현을 완료하고 나서 테스트를 나중에 쓰면 두 가지를 잃는다.

첫 번째는 **설계 피드백**이다. 테스트를 먼저 쓰면 코드를 사용하는 입장에서 API를 설계하게 된다. 나중에 쓰면 이미 만들어진 API에 테스트를 끼워 맞추게 된다. 테스트하기 어려운 코드가 나오는 이유다.

두 번째는 **명세의 역할**이다. 테스트를 나중에 쓰면 "구현이 이렇게 되어 있으니 테스트도 이렇게 쓴다"는 식이 된다. 구현의 버그까지 테스트가 그대로 따라간다.

```typescript
// 나쁜 순서 — 구현 먼저, 테스트 나중
// 이미 만들어진 구현에 맞춰 테스트를 작성하면
// 구현의 결함이 테스트에 그대로 고착된다
function discount(price: number, rate: number): number {
  return price - price * rate; // 구현 완료
}

// 나중에 쓴 테스트 — 구현 결함이 있어도 테스트가 통과하도록 쓰게 됨
it('할인 금액을 계산한다', () => {
  expect(discount(10000, 0.1)).toBe(9000); // 구현이 맞다고 가정
});

// 좋은 순서 — 테스트 먼저 (TDD)
// 1. 테스트가 요구사항을 명세한다
it('10% 할인 시 9000원이어야 한다', () => {
  expect(applyDiscount(10000, 0.1)).toBe(9000);
});

// 2. 테스트를 통과시키는 최소한의 구현을 작성한다
function applyDiscount(price: number, rate: number): number {
  return price * (1 - rate);
}
```

Timely는 TDD 사이클 전체를 관통하는 원칙이다. 테스트를 나중에 쓰는 것은 "테스트를 작성하는 것"이 아니라 "구현을 사후 검증하는 것"이다.

## 정리

| 원칙 | 핵심 | 위반 신호 |
|------|------|-----------|
| **Fast** | 밀리초 단위 실행 | DB/네트워크 호출, sleep() |
| **Isolated** | 순서 무관, 상태 공유 없음 | 로컬 성공/CI 실패, 공유 변수 |
| **Repeatable** | 환경 무관 동일 결과 | 시간, 난수, 외부 시스템 직접 의존 |
| **Self-validating** | Assert가 판단 | console.log로 확인, 예외 삼키기 |
| **Timely** | 프로덕션 코드와 함께 | 기능 완성 후 테스트 작성 |

다섯 조건 중 하나라도 어긴 테스트는 시간이 지나면서 유지보수 부담이 된다. 처음엔 "나중에 고치지"라고 생각하지만 그 나중은 오지 않는다.
