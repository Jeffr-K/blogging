---
title: "[FP 시리즈] 10. IO 모나드"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "IO모나드", "IO", "부수효과", "FP"]
---

# IO 모나드

IO 모나드는 **부수 효과를 값으로 표현**하는 패턴입니다. "나중에 실행될 부수 효과"를 데이터로 다룰 수 있게 합니다.

## 문제: 순수 함수와 부수 효과

순수 함수형 프로그래밍에서는 부수 효과가 없어야 합니다. 그런데 실제 프로그램은 파일을 읽고, 네트워크를 호출하고, 콘솔에 출력해야 합니다.

어떻게 순수성을 유지하면서 부수 효과를 다룰까요?

```typescript
// 부수 효과를 직접 실행하면 순수하지 않음
function getUsername(): string {
  console.log('이름을 가져옵니다'); // 부수 효과 실행
  return localStorage.getItem('username') ?? 'guest'; // 부수 효과 실행
}
```

## IO 모나드의 아이디어

부수 효과를 **즉시 실행하지 않고, "나중에 실행할 것"을 기술**합니다.

```typescript
// IO<T>는 "T를 반환하는 부수 효과"를 나타내는 타입
type IO<T> = () => T;

// IO를 만드는 함수들
const readUsername: IO<string> = () => localStorage.getItem('username') ?? 'guest';
const printLine = (msg: string): IO<void> => () => console.log(msg);
const getCurrentTime: IO<Date> = () => new Date();
```

`IO<T>`는 함수(`() => T`)일 뿐입니다. **실제 실행은 나중에** 합니다.

## map과 flatMap

IO를 조합할 수 있어야 합니다.

```typescript
class IOClass<T> {
  constructor(private readonly effect: () => T) {}

  // IO를 실행하지 않고 변환을 등록
  map<U>(fn: (value: T) => U): IOClass<U> {
    return new IOClass(() => fn(this.effect()));
  }

  // IO를 반환하는 함수를 연결
  flatMap<U>(fn: (value: T) => IOClass<U>): IOClass<U> {
    return new IOClass(() => fn(this.effect()).run());
  }

  // 실제로 실행 (프로그램의 최외곽에서만 호출)
  run(): T {
    return this.effect();
  }
}

const io = <T>(effect: () => T): IOClass<T> => new IOClass(effect);

// IO 생성 — 아직 실행 안 됨
const readName = io(() => localStorage.getItem('name') ?? 'guest');
const getTime = io(() => new Date().toISOString());

// 변환 조합 — 아직 실행 안 됨
const greeting = readName.map(name => `Hello, ${name}!`);
const log = (msg: string) => io(() => { console.log(msg); });

// 연쇄 — 아직 실행 안 됨
const program = readName
  .flatMap(name => io(() => `Hello, ${name}!`))
  .flatMap(msg => log(msg));

// 여기서 비로소 실행
program.run();
```

## 부수 효과를 프로그램 끝으로 밀어내기

IO 모나드의 핵심 아이디어는 **부수 효과 실행을 프로그램의 가장 바깥으로** 미루는 것입니다.

```typescript
// 순수 로직 — IO를 조합만 하고 실행하지 않음
function buildGreeting(name: string): string {
  return `Hello, ${name}! 오늘도 좋은 하루 되세요.`;
}

function createProgram(): IOClass<void> {
  const readName = io(() => process.env.USER ?? 'World');
  const getTime = io(() => new Date().getHours());

  return readName.flatMap(name =>
    getTime.flatMap(hour => {
      const timeGreeting = hour < 12 ? '좋은 아침' : hour < 18 ? '좋은 오후' : '좋은 저녁';
      const message = `${timeGreeting}이에요, ${name}!`;
      return io(() => console.log(message));
    }),
  );
}

// main: 프로그램 최외곽에서 실행
const main = createProgram();
main.run(); // 여기서만 부수 효과 발생
```

## 비동기 IO

비동기 효과는 `IO<Promise<T>>` 또는 별도의 `Task<T>` 타입으로 다룹니다.

```typescript
// Task<T> = IO<Promise<T>> — 비동기 부수 효과
type Task<T> = () => Promise<T>;

const fetchUser = (id: string): Task<User> =>
  () => fetch(`/api/users/${id}`).then(r => r.json());

const saveUser = (user: User): Task<void> =>
  () => fetch('/api/users', { method: 'POST', body: JSON.stringify(user) }).then(() => {});

// 조합
async function updateUsername(id: string, newName: string): Task<void> {
  return async () => {
    const user = await fetchUser(id)();  // Task 실행
    const updated = { ...user, name: newName };
    await saveUser(updated)();           // Task 실행
  };
}

// 실행
updateUsername('123', '홍길동')();
```

## 실무에서의 IO 모나드

순수 Haskell과 달리 TypeScript에서는 IO 모나드를 엄격하게 사용하지 않습니다. 대신 **핵심 아이디어**를 차용합니다.

### 효과를 나중에 실행하기 패턴

```typescript
// 테스트하기 어려운 버전
function processOrder(orderId: string): void {
  const order = db.find(orderId);    // 실행
  const result = calculateTotal(order); // 실행
  db.save({ ...order, total: result }); // 실행
  emailService.send(order.userId, '주문 처리 완료'); // 실행
}

// IO 아이디어를 차용한 버전 — 효과 기술과 실행 분리
type Effect =
  | { type: 'saveOrder'; order: Order }
  | { type: 'sendEmail'; userId: string; message: string };

function processOrder(order: Order): Effect[] {
  // 순수 함수 — 무엇을 할지만 기술, 실제 실행은 안 함
  const total = calculateTotal(order);
  return [
    { type: 'saveOrder', order: { ...order, total } },
    { type: 'sendEmail', userId: order.userId, message: '주문 처리 완료' },
  ];
}

// 실행 레이어 — 여기서만 실제 I/O 발생
async function runEffects(effects: Effect[]): Promise<void> {
  for (const effect of effects) {
    switch (effect.type) {
      case 'saveOrder': await db.save(effect.order); break;
      case 'sendEmail': await emailService.send(effect.userId, effect.message); break;
    }
  }
}

// 사용
const order = await db.find(orderId);
const effects = processOrder(order); // 순수, 테스트 쉬움
await runEffects(effects);           // 실제 I/O
```

이 패턴의 장점:
- `processOrder`는 순수 함수 — DB/이메일 없이 테스트 가능
- 어떤 효과가 발생할지 데이터로 검사 가능
- 효과의 실행 방식을 쉽게 교체 가능 (테스트용 mock)

## fp-ts의 IO

실무에서 IO 모나드를 사용하려면 `fp-ts`를 활용합니다.

```typescript
import { IO, map, chain } from 'fp-ts/IO';
import { pipe } from 'fp-ts/function';

const readLine: IO<string> = () => 'user input'; // 실제로는 readline

const program: IO<void> = pipe(
  readLine,
  map(input => input.toUpperCase()),
  chain(upper => () => console.log(upper)),
);

program(); // 실행
```

## 정리

IO 모나드의 핵심 아이디어:

1. **부수 효과를 값으로 표현** — `() => T` 형태의 지연 실행
2. **조합 가능** — map, flatMap으로 효과를 연결
3. **실행은 바깥에서** — 순수 코어와 효과 실행 레이어를 분리

TypeScript에서는 엄격한 IO 모나드보다 "효과를 데이터로 표현하고 마지막에 실행한다"는 아이디어를 실용적으로 적용하는 경우가 많습니다. 이 아이디어는 Redux의 action, React의 event handler, 도메인 이벤트 패턴 등 이미 많은 곳에 녹아 있습니다.
