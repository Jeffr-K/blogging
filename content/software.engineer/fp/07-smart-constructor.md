---
title: "[FP 시리즈] 7. 스마트 생성자와 Make Illegal States Unrepresentable"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "스마트생성자", "타입설계", "smart constructor", "FP"]
---

# 스마트 생성자와 Make Illegal States Unrepresentable

"잘못된 상태를 표현 불가능하게 만들어라(Make Illegal States Unrepresentable)" — 이 원칙은 타입 시스템을 활용해 **유효하지 않은 데이터가 코드에 들어올 수 없도록** 설계하는 방법입니다. 스마트 생성자는 이를 구현하는 패턴입니다.

## 문제: 원시 타입 집착 (Primitive Obsession)

```typescript
// 이메일, 나이, URL을 전부 string과 number로 표현
function createUser(email: string, age: number, website: string) {
  // 호출 시점에 유효성을 알 수 없음
  // email이 "@"를 포함하는지?
  // age가 0~150 범위인지?
  // website가 URL 형식인지?
}

// 이렇게 잘못 호출해도 컴파일 에러가 없음
createUser('not-an-email', -5, 'not-a-url');
```

유효성 검증을 함수 내부에서 하면:

```typescript
function createUser(email: string, age: number, website: string) {
  if (!email.includes('@')) throw new Error('유효하지 않은 이메일');
  if (age < 0 || age > 150) throw new Error('유효하지 않은 나이');
  // ...
}
```

이 방법의 문제:
- 검증을 잊으면 런타임 에러
- 여러 함수에서 같은 검증을 반복
- `email: string`이라고 쓰여 있지만 "검증된 이메일"인지 "아무 문자열"인지 알 수 없음

## 스마트 생성자

유효성 검증을 **타입 생성 시점**으로 옮기는 패턴입니다. 한 번 만들어진 값은 항상 유효함이 보장됩니다.

```typescript
// 브랜디드 타입으로 "검증된 이메일"과 "아무 string"을 구분
type Email = string & { readonly _brand: 'Email' };

function createEmail(raw: string): Email | null {
  if (!raw.includes('@') || !raw.includes('.')) return null;
  return raw.toLowerCase().trim() as Email;
}

// 사용
const email = createEmail('user@example.com');
if (email === null) {
  // 유효하지 않은 이메일 처리
} else {
  sendEmail(email); // Email 타입만 받는 함수에 안전하게 전달
}

function sendEmail(to: Email) {
  // Email 타입이면 반드시 유효한 이메일임이 보장됨
  // 일반 string을 실수로 전달하면 컴파일 에러
}

sendEmail('raw-string'); // 컴파일 에러: string은 Email 타입이 아님
```

## Result 타입으로 에러 처리

예외를 던지는 대신 Result 타입을 반환하면 호출하는 쪽이 에러 처리를 강제받습니다.

```typescript
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// 스마트 생성자들
type Age = number & { readonly _brand: 'Age' };
type Url = string & { readonly _brand: 'Url' };

function createAge(n: number): Result<Age> {
  if (!Number.isInteger(n)) return err('나이는 정수여야 합니다');
  if (n < 0 || n > 150) return err('나이는 0~150 범위여야 합니다');
  return ok(n as Age);
}

function createUrl(raw: string): Result<Url> {
  try {
    new URL(raw);
    return ok(raw as Url);
  } catch {
    return err('유효하지 않은 URL 형식입니다');
  }
}
```

## Make Illegal States Unrepresentable

더 나아가 **합 타입으로 불가능한 상태 자체를 제거**합니다.

### 나쁜 예: boolean 플래그 조합

```typescript
// 로딩/성공/실패 상태를 boolean으로 표현
type FetchState = {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  data: User | null;
  error: string | null;
};

// 이론적으로 가능한 말도 안 되는 상태들:
// isLoading: true, isSuccess: true, isError: true — 동시에?
// isSuccess: true, data: null — 성공인데 데이터가 없음?
// isError: true, error: null — 에러인데 메시지가 없음?
```

### 좋은 예: 합 타입으로 유효한 상태만 표현

```typescript
type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }    // success면 반드시 data 있음
  | { status: 'error'; error: string }; // error면 반드시 message 있음

// 유효하지 않은 상태를 만드는 것 자체가 불가능
```

### 결제 수단 예시

```typescript
// 나쁜 예: 모든 필드가 nullable
type PaymentMethod = {
  type: 'card' | 'bank' | 'crypto';
  cardNumber?: string;      // card일 때만 필요
  bankAccount?: string;     // bank일 때만 필요
  walletAddress?: string;   // crypto일 때만 필요
};

// type이 'card'인데 cardNumber가 없는 상태가 가능

// 좋은 예: 각 경우에 필요한 필드만 존재
type PaymentMethod =
  | { type: 'card'; cardNumber: string; expiryDate: string }
  | { type: 'bank'; bankCode: string; accountNumber: string }
  | { type: 'crypto'; walletAddress: string; network: string };
```

### 주문 상태 흐름

```typescript
// 각 상태에서 의미 있는 필드만 존재
type Order =
  | { status: 'draft'; items: Item[] }
  | { status: 'placed'; orderId: string; items: Item[]; placedAt: Date }
  | { status: 'paid'; orderId: string; paidAt: Date; amount: number }
  | { status: 'shipped'; orderId: string; trackingNumber: string }
  | { status: 'delivered'; orderId: string; deliveredAt: Date }
  | { status: 'cancelled'; orderId: string; reason: string };

// 'draft' 상태에는 orderId가 없음 (아직 생성 전)
// 'shipped' 상태에는 trackingNumber가 있음 (항상)
// 각 상태에서 필요한 필드만 존재하고 필요한 필드는 반드시 존재
```

## 도메인 규칙을 타입으로 인코딩

```typescript
// 이메일 인증 흐름
type EmailVerification =
  | { status: 'unverified'; email: string }
  | { status: 'pending'; email: string; token: string; sentAt: Date }
  | { status: 'verified'; email: Email; verifiedAt: Date }; // Email은 브랜디드 타입

// 인증된 이메일만 Email 타입 — 인증 안 된 이메일은 string
function sendWelcomeEmail(email: Email): void {
  // 이 함수가 호출되려면 반드시 인증된 이메일이어야 함
}

// 인증 완료 핸들러
function handleVerified(verification: EmailVerification): void {
  if (verification.status !== 'verified') return;
  sendWelcomeEmail(verification.email); // verified 상태의 email은 Email 타입
}
```

## 정리

- **스마트 생성자**: 생성 시점에 유효성 검증 → 이후 코드에서 검증 불필요
- **Make Illegal States Unrepresentable**: 합 타입으로 유효하지 않은 상태 자체를 타입 시스템에서 제거

타입을 잘 설계하면 런타임 에러가 아닌 컴파일 에러로 버그를 잡을 수 있습니다. "이 함수가 null을 받을 수 있는가?"를 런타임에 확인하는 대신, 타입 시그니처에서 바로 알 수 있게 됩니다.
