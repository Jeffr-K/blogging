---
title: "[FP 시리즈] 2. 불변성과 값 객체"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "불변성", "값객체", "immutability", "FP"]
---

# 불변성과 값 객체

불변성(Immutability)은 **한 번 만든 값을 변경하지 않는다**는 원칙입니다. 값 객체(Value Object)는 불변성을 도메인 모델에 적용한 패턴입니다.

## 가변 상태의 문제

```typescript
const user = { name: '홍길동', age: 30 };

function birthday(u: typeof user) {
  u.age++; // 원본을 변경
}

birthday(user);
console.log(user.age); // 31 — 함수를 호출했을 뿐인데 user가 바뀜
```

이 코드의 문제:
- `birthday`를 호출한 쪽은 `user`가 바뀐다는 걸 알기 어렵습니다
- 여러 곳에서 `user`를 참조하면 어디서 바뀌었는지 추적하기 어렵습니다
- 함수의 동작을 시그니처만 보고 이해할 수 없습니다

## 불변으로 만들기

값을 변경하는 대신 **새로운 값을 만들어 반환**합니다.

```typescript
const user = { name: '홍길동', age: 30 };

function birthday(u: typeof user) {
  return { ...u, age: u.age + 1 }; // 새 객체 반환, 원본 유지
}

const olderUser = birthday(user);

console.log(user.age);      // 30 — 원본 그대로
console.log(olderUser.age); // 31 — 새 값
```

### 배열도 마찬가지

```typescript
const items = ['사과', '바나나'];

// 변이(mutation) — 피해야 함
items.push('체리');

// 불변 — 새 배열 반환
const newItems = [...items, '체리'];

// 다른 배열 메서드들
const filtered = items.filter(x => x !== '바나나'); // 새 배열
const mapped = items.map(x => x.toUpperCase());      // 새 배열
```

## TypeScript로 불변성 강제하기

`readonly`와 `as const`를 활용하면 컴파일 타임에 변이를 막을 수 있습니다.

```typescript
type User = {
  readonly name: string;
  readonly age: number;
};

const user: User = { name: '홍길동', age: 30 };
user.age = 31; // 컴파일 에러: Cannot assign to 'age' because it is a read-only property

// 배열도 마찬가지
const items: readonly string[] = ['사과', '바나나'];
items.push('체리'); // 컴파일 에러
```

```typescript
// 깊이 있는 객체 전체를 읽기 전용으로
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
```

## 값 객체 (Value Object)

불변성을 적용한 도메인 모델 패턴입니다. 핵심은 **동등성을 식별자(ID)가 아닌 값으로 판단**한다는 것입니다.

```typescript
// 나쁜 예 - 이메일을 그냥 string으로 다루면
function sendEmail(email: string) {
  // email이 유효한지 알 수 없음
  // 빈 문자열이 들어올 수도, 형식이 잘못될 수도 있음
}

// 값 객체로 만들기
class Email {
  private constructor(private readonly value: string) {}

  static create(raw: string): Email | null {
    if (!raw.includes('@')) return null;
    return new Email(raw.toLowerCase().trim());
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}

const email = Email.create('User@Example.com');
// email은 null이거나 유효한 Email 값 객체

function sendEmail(email: Email) {
  // Email 타입이면 반드시 유효한 이메일임이 보장됨
}
```

값 객체의 특성:
- **불변**: 생성 후 값이 바뀌지 않음 (바꾸려면 새로 생성)
- **값으로 동등성 판단**: 같은 이메일 주소면 같은 객체로 취급
- **유효성 보장**: 생성 시점에 검증을 거쳤으므로 항상 유효한 상태

### 더 많은 예시

```typescript
// 금액을 나타내는 값 객체
class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {}

  static of(amount: number, currency: string): Money {
    if (amount < 0) throw new Error('금액은 음수일 수 없습니다');
    return new Money(amount, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('통화가 다릅니다');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string {
    return `${this.amount} ${this.currency}`;
  }
}

const price = Money.of(10000, 'KRW');
const tax = Money.of(1000, 'KRW');
const total = price.add(tax); // 새 Money 객체, 원본 불변
```

## 불변성의 성능 우려

"복사를 매번 하면 느리지 않나?" — 대부분의 경우 실제 성능 문제로 이어지지 않습니다. 오히려:

- **변경 감지가 쉬워집니다**: 참조 비교(`===`)만으로 변경 여부를 알 수 있어 React의 re-render 최적화, Redux의 shallow comparison이 가능해집니다
- **Structural Sharing**: Immutable.js, immer 같은 라이브러리는 변경되지 않은 부분은 공유해 메모리를 절약합니다

```typescript
// immer: 불변성을 유지하면서 변이 스타일로 작성
import { produce } from 'immer';

const state = { user: { name: '홍길동', age: 30 }, items: ['사과'] };

const newState = produce(state, draft => {
  draft.user.age = 31;     // 내부적으로는 불변
  draft.items.push('바나나'); // 원본을 건드리지 않음
});

console.log(state.user.age);    // 30 — 원본 유지
console.log(newState.user.age); // 31 — 새 상태
```

## 정리

- **불변성**: 값을 변경하지 않고 새 값을 반환 — 부수 효과를 줄이고 추론을 쉽게 만듦
- **값 객체**: 불변 + 값으로 동등성 판단 + 생성 시 유효성 보장 — primitive obsession을 막는 패턴

불변성은 코드를 더 예측 가능하게 만드는 가장 직접적인 방법입니다.
