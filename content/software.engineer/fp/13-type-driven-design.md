---
title: "[FP 시리즈] 13. 타입 주도 설계와 효과 분리"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "타입주도설계", "효과분리", "type-driven design", "FP"]
---

# 타입 주도 설계와 효과 분리

FP 시리즈의 마지막은 앞서 배운 개념들을 **설계 철학**으로 묶는 두 가지 원칙입니다.

## 타입 주도 설계 (Type-driven Design)

"타입을 먼저 설계하고, 그 타입이 구현을 안내하게 한다"는 접근법입니다. 코드보다 타입을 먼저 씁니다.

### 프로세스

```
1. 도메인의 상태와 전환을 파악
2. 타입으로 상태를 표현
3. 타입 시그니처로 함수를 정의
4. 컴파일러의 안내에 따라 구현
```

### 예시: 주문 처리 시스템

먼저 타입부터 설계합니다.

```typescript
// Step 1: 도메인 상태 파악
// 주문은 다음 상태를 가질 수 있다:
// 장바구니(draft) → 주문됨(placed) → 결제됨(paid) → 배송중(shipped) → 완료(delivered)
//                                                                        또는 취소(cancelled)

// Step 2: 타입으로 상태 표현
type CartItem = { productId: string; quantity: number; unitPrice: number };

type Order =
  | { status: 'draft'; items: CartItem[] }
  | { status: 'placed'; orderId: string; items: CartItem[]; placedAt: Date }
  | { status: 'paid'; orderId: string; amount: number; paidAt: Date }
  | { status: 'shipped'; orderId: string; trackingNumber: string; shippedAt: Date }
  | { status: 'delivered'; orderId: string; deliveredAt: Date }
  | { status: 'cancelled'; orderId: string; reason: string; cancelledAt: Date };

// Step 3: 함수 시그니처 정의 (구현 전에 타입만)
type PlaceOrder = (cart: Extract<Order, { status: 'draft' }>) =>
  Result<Extract<Order, { status: 'placed' }>, string>;

type PayOrder = (order: Extract<Order, { status: 'placed' }>, amount: number) =>
  Result<Extract<Order, { status: 'paid' }>, string>;

type ShipOrder = (order: Extract<Order, { status: 'paid' }>, trackingNumber: string) =>
  Extract<Order, { status: 'shipped' }>;
```

타입 시그니처만 보고도 각 함수가 무엇을 받고 무엇을 반환하는지 알 수 있습니다. `PlaceOrder`는 `draft` 상태의 주문만 받고 `placed` 상태의 주문을 반환합니다. `paid` 상태의 주문을 `PlaceOrder`에 전달하면 컴파일 에러가 납니다.

```typescript
// Step 4: 구현 — 타입이 이미 검증해주므로 구현에 집중
const placeOrder: PlaceOrder = (cart) => {
  if (cart.items.length === 0) return err('장바구니가 비어있습니다');
  return ok({
    status: 'placed',
    orderId: generateId(),
    items: cart.items,
    placedAt: new Date(),
  });
};

const payOrder: PayOrder = (order, amount) => {
  const total = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (amount < total) return err(`결제 금액이 부족합니다. 필요: ${total}, 받은: ${amount}`);
  return ok({
    status: 'paid',
    orderId: order.orderId,
    amount,
    paidAt: new Date(),
  });
};
```

### 타입으로 프로토콜 설계하기

```typescript
// 이메일 인증 흐름을 타입으로 먼저 설계
type UnverifiedEmail = { _tag: 'Unverified'; address: string };
type VerifiedEmail = { _tag: 'Verified'; address: string; verifiedAt: Date };

// 함수 시그니처: 무엇을 받고 무엇을 반환하는지 명확
type SendVerificationCode = (email: UnverifiedEmail) => Result<{ code: string }, string>;
type VerifyEmail = (email: UnverifiedEmail, code: string) => Result<VerifiedEmail, string>;
type SendWelcomeEmail = (email: VerifiedEmail) => Promise<void>; // 인증된 이메일만 받음

// 이 설계에서 SendWelcomeEmail은 미인증 이메일로 호출할 수 없음 — 컴파일 에러
```

## 효과 분리 (Separating Effects from Logic)

순수한 비즈니스 로직과 부수 효과(I/O, DB, 네트워크)를 **분리하는** 설계 원칙입니다.

### 나쁜 예: 로직과 효과 혼재

```typescript
// 비즈니스 로직과 I/O가 섞여있음
async function processRegistration(input: unknown): Promise<void> {
  // 검증 (순수 로직)
  if (!isValidEmail(input.email)) throw new Error('유효하지 않은 이메일');
  if (!isStrongPassword(input.password)) throw new Error('약한 비밀번호');

  // DB 조회 (효과)
  const existing = await db.findByEmail(input.email);
  if (existing) throw new Error('이미 존재하는 이메일');

  // 데이터 변환 (순수 로직)
  const hashedPassword = await bcrypt.hash(input.password, 10);
  const user = { id: generateId(), email: input.email, password: hashedPassword };

  // DB 저장 (효과)
  await db.save(user);

  // 이메일 전송 (효과)
  await emailService.send(input.email, '가입을 환영합니다!');
}

// 이 함수는 테스트하려면 DB, 이메일 서비스, bcrypt가 모두 필요
```

### 좋은 예: 효과 분리

```typescript
// Layer 1: 순수 검증 로직 — 부수 효과 없음, 쉽게 테스트 가능
type RegistrationInput = { email: string; password: string };
type ValidatedInput = RegistrationInput & { _validated: true };

function validateRegistration(input: RegistrationInput): Result<ValidatedInput, string> {
  if (!input.email.includes('@')) return err('유효하지 않은 이메일');
  if (input.password.length < 8) return err('비밀번호는 8자 이상이어야 합니다');
  return ok(input as ValidatedInput);
}

// Layer 2: 순수 데이터 변환 — 부수 효과 없음
function buildUser(input: ValidatedInput, hashedPassword: string): User {
  return {
    id: generateId(),
    email: input.email.toLowerCase(),
    password: hashedPassword,
    createdAt: new Date(),
  };
}

// Layer 3: 효과 레이어 — I/O를 명시적으로 처리
async function registerUser(input: RegistrationInput): Promise<Result<User, string>> {
  // 순수 검증 (테스트 가능)
  const validated = validateRegistration(input);
  if (!validated.ok) return validated;

  // 효과 1: DB 조회
  const existing = await db.findByEmail(validated.value.email);
  if (existing) return err('이미 존재하는 이메일');

  // 효과 2: 비밀번호 해싱
  const hashedPassword = await bcrypt.hash(validated.value.password, 10);

  // 순수 데이터 변환 (테스트 가능)
  const user = buildUser(validated.value, hashedPassword);

  // 효과 3: DB 저장
  await db.save(user);

  // 효과 4: 이메일
  await emailService.send(user.email, '가입을 환영합니다!');

  return ok(user);
}
```

`validateRegistration`과 `buildUser`는 DB, 이메일 서비스 없이 단독으로 테스트할 수 있습니다.

### 함수형 코어, 명령형 셸 (Functional Core, Imperative Shell)

Gary Bernhardt가 제안한 아키텍처 패턴입니다.

```
┌──────────────────────────────────────────┐
│             명령형 셸 (Imperative Shell)  │
│  ┌────────────────────────────────────┐  │
│  │       함수형 코어 (Functional Core) │  │
│  │                                    │  │
│  │  · 순수 함수                        │  │
│  │  · 비즈니스 로직                    │  │
│  │  · 데이터 변환                      │  │
│  │  · 쉽게 테스트 가능                 │  │
│  └────────────────────────────────────┘  │
│                                          │
│  · 부수 효과 (DB, 네트워크, 파일 시스템)  │
│  · I/O 처리                              │
│  · 의존성 조합                           │
└──────────────────────────────────────────┘
```

```typescript
// 함수형 코어 — 순수 로직
function calculateDiscount(
  user: User,
  cart: CartItem[],
  promotions: Promotion[],
): DiscountResult {
  const applicablePromotions = promotions.filter(p => isEligible(user, p));
  const bestPromotion = applicablePromotions.reduce(maxDiscount, null);
  return bestPromotion
    ? applyPromotion(cart, bestPromotion)
    : { discountRate: 0, items: cart };
}

// 명령형 셸 — 효과 처리
async function handleCheckout(userId: string, cartId: string): Promise<CheckoutResult> {
  // I/O: 데이터 조회
  const [user, cart, promotions] = await Promise.all([
    db.getUser(userId),
    db.getCart(cartId),
    db.getActivePromotions(),
  ]);

  // 순수 코어 호출
  const discounted = calculateDiscount(user, cart, promotions);

  // I/O: 결과 저장
  const order = await db.createOrder({ userId, ...discounted });
  await emailService.sendOrderConfirmation(user.email, order);

  return { order, discountApplied: discounted.discountRate > 0 };
}
```

`calculateDiscount`는 외부 의존성 없이 테스트할 수 있습니다. 복잡한 비즈니스 로직을 검증하는 데 DB나 서비스 mock이 필요 없습니다.

## 두 원칙을 함께 적용하기

```typescript
// 타입으로 도메인 모델 설계
type OrderCommand =
  | { type: 'place'; items: CartItem[] }
  | { type: 'pay'; orderId: string; amount: number }
  | { type: 'cancel'; orderId: string; reason: string };

type OrderEvent =
  | { type: 'placed'; orderId: string; items: CartItem[]; at: Date }
  | { type: 'paid'; orderId: string; amount: number; at: Date }
  | { type: 'cancelled'; orderId: string; reason: string; at: Date };

// 순수 코어: command → event (효과 없음)
function processCommand(
  state: Order,
  command: OrderCommand,
): Result<OrderEvent, string> {
  switch (command.type) {
    case 'place':
      if (state.status !== 'draft') return err('이미 주문된 상태입니다');
      if (command.items.length === 0) return err('빈 장바구니');
      return ok({ type: 'placed', orderId: generateId(), items: command.items, at: new Date() });

    case 'pay':
      if (state.status !== 'placed') return err('주문되지 않은 상태입니다');
      return ok({ type: 'paid', orderId: command.orderId, amount: command.amount, at: new Date() });

    case 'cancel':
      if (state.status === 'delivered') return err('이미 배송 완료된 주문');
      return ok({ type: 'cancelled', orderId: command.orderId, reason: command.reason, at: new Date() });
  }
}

// 명령형 셸: event를 실제로 저장하고 부수 효과 처리
async function handleCommand(orderId: string, command: OrderCommand): Promise<Result<void, string>> {
  const order = await db.getOrder(orderId);
  const eventResult = processCommand(order, command); // 순수 호출

  if (!eventResult.ok) return eventResult;

  await db.saveEvent(eventResult.value);
  await notifySubscribers(eventResult.value);

  return ok(undefined);
}
```

## 정리

**타입 주도 설계**:
- 타입을 먼저 설계하고 구현은 나중에
- 타입이 불가능한 상태를 컴파일 타임에 차단
- Make Illegal States Unrepresentable의 실천

**효과 분리**:
- 순수 비즈니스 로직과 I/O를 분리
- 함수형 코어 + 명령형 셸 아키텍처
- 핵심 로직을 부수 효과 없이 테스트 가능

이 두 원칙은 FP의 목표를 집약합니다: **코드를 이해하기 쉽고, 테스트하기 쉽고, 변경하기 쉽게** 만드는 것입니다. 타입 시스템으로 도메인을 정확하게 표현하고, 순수 로직을 효과로부터 분리하면 그 목표에 가까워집니다.

---

## FP 시리즈를 마치며

이 시리즈에서 다룬 개념들:

| 카테고리 | 개념 | 핵심 |
|---------|------|------|
| 기초 | 순수 함수, 불변성, 일급/고차 함수 | 부수 효과를 줄이고 함수를 값으로 |
| 조합 | 커링, 부분 적용, 합성, 파이프 | 작은 함수를 조립해 큰 함수를 |
| 타입 | ADT, 스마트 생성자 | 불가능한 상태를 타입으로 막기 |
| 컨테이너 | 펑터, 모나드, Maybe, Either, IO | 효과를 타입으로 표현하고 연쇄 |
| 설계 | 타입 주도 설계, 효과 분리 | 타입이 안내하고 로직과 효과를 분리 |

모든 개념이 하나의 방향을 향합니다: **코드가 하는 일을 명확하고 안전하게 표현하는 것**.
