---
title: "[FP 시리즈] 19. Reader, Writer, State 모나드"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "Reader", "Writer", "State", "모나드", "FP"]
---

# Reader, Writer, State 모나드

세 모나드는 각각 **의존성 주입**, **로깅**, **상태 관리**라는 흔한 문제를 순수하게 해결합니다.

## Reader 모나드

**의존성(환경)을 함수에 암묵적으로 전달**하는 패턴입니다.

### 문제

```typescript
// 매 함수마다 config, db, logger를 전달해야 함
function getUser(id: string, db: Database, logger: Logger): User {
  logger.info(`getUser: ${id}`);
  return db.find(id);
}

function processUser(id: string, db: Database, logger: Logger, config: Config): ProcessedUser {
  const user = getUser(id, db, logger); // 다시 전달
  return transform(user, config);
}
```

### Reader 구현

```typescript
// Reader<R, A> = "R 환경이 주어지면 A를 반환하는 함수"
class Reader<R, A> {
  constructor(private readonly run: (env: R) => A) {}

  static of<R, A>(value: A): Reader<R, A> {
    return new Reader(() => value);
  }

  static ask<R>(): Reader<R, R> {
    return new Reader(env => env); // 환경 자체를 반환
  }

  map<B>(fn: (a: A) => B): Reader<R, B> {
    return new Reader(env => fn(this.run(env)));
  }

  flatMap<B>(fn: (a: A) => Reader<R, B>): Reader<R, B> {
    return new Reader(env => fn(this.run(env)).run(env));
  }

  provide(env: R): A {
    return this.run(env); // 환경을 주입해 실행
  }
}
```

### Reader로 의존성 주입

```typescript
type AppEnv = { db: Database; logger: Logger; config: Config };

// 환경을 암묵적으로 사용하는 함수
const getUser = (id: string): Reader<AppEnv, User> =>
  Reader.ask<AppEnv>().flatMap(({ db, logger }) => {
    logger.info(`getUser: ${id}`);
    return Reader.of(db.find(id));
  });

const processUser = (id: string): Reader<AppEnv, ProcessedUser> =>
  getUser(id).flatMap(user =>
    Reader.ask<AppEnv>().map(({ config }) => transform(user, config)),
  );

// 최외곽에서 한 번만 환경 주입
const env: AppEnv = { db, logger, config };
const result = processUser('123').provide(env);
```

Reader의 핵심: 의존성을 함수 인자로 일일이 전달하지 않고 `Reader.ask()`로 필요할 때 꺼냅니다.

---

## Writer 모나드

**부수 효과 없이 로그를 쌓는** 패턴입니다. 로그를 출력하는 대신 값과 함께 반환합니다.

```typescript
// Writer<W, A> = 값 A와 로그 W를 함께 가짐
class Writer<W, A> {
  constructor(
    private readonly value: A,
    private readonly log: W[],
  ) {}

  static of<W, A>(value: A): Writer<W, A> {
    return new Writer(value, []);
  }

  static tell<W>(entry: W): Writer<W, void> {
    return new Writer(undefined as void, [entry]);
  }

  map<B>(fn: (a: A) => B): Writer<W, B> {
    return new Writer(fn(this.value), this.log);
  }

  flatMap<B>(fn: (a: A) => Writer<W, B>): Writer<W, B> {
    const next = fn(this.value);
    return new Writer(next.value, [...this.log, ...next.log]);
  }

  run(): [A, W[]] {
    return [this.value, this.log];
  }
}
```

### Writer로 순수 로깅

```typescript
type Log = string;

function validateAge(age: number): Writer<Log, number> {
  if (age < 0 || age > 150) {
    return Writer.tell<Log>(`유효하지 않은 나이: ${age}`).flatMap(() =>
      Writer.of(0),
    );
  }
  return Writer.of<Log, number>(age).flatMap(a =>
    Writer.tell<Log>(`나이 검증 통과: ${a}`).map(() => a),
  );
}

function applyDiscount(price: number, age: number): Writer<Log, number> {
  const discount = age >= 65 ? 0.2 : age < 18 ? 0.1 : 0;
  const discounted = price * (1 - discount);
  return Writer.of<Log, number>(discounted).flatMap(d =>
    Writer.tell<Log>(`할인 적용: ${(discount * 100).toFixed(0)}% → ${d}`).map(() => d),
  );
}

const [finalPrice, logs] = Writer.of<Log, number>(0)
  .flatMap(() => validateAge(70))
  .flatMap(age => applyDiscount(10000, age))
  .run();

console.log(finalPrice); // 8000
console.log(logs); // ['나이 검증 통과: 70', '할인 적용: 20% → 8000']
// console.log를 직접 호출한 적 없음 — 순수 함수
```

---

## State 모나드

**상태를 암묵적으로 전달하면서 변환**하는 패턴입니다.

```typescript
// State<S, A> = "상태 S를 받아 [결과 A, 새 상태 S]를 반환하는 함수"
class State<S, A> {
  constructor(private readonly run: (state: S) => [A, S]) {}

  static of<S, A>(value: A): State<S, A> {
    return new State(s => [value, s]);
  }

  static get<S>(): State<S, S> {
    return new State(s => [s, s]); // 현재 상태를 읽음
  }

  static put<S>(newState: S): State<S, void> {
    return new State(() => [undefined as void, newState]); // 상태를 교체
  }

  static modify<S>(fn: (s: S) => S): State<S, void> {
    return new State(s => [undefined as void, fn(s)]); // 상태를 변환
  }

  map<B>(fn: (a: A) => B): State<S, B> {
    return new State(s => {
      const [a, s2] = this.run(s);
      return [fn(a), s2];
    });
  }

  flatMap<B>(fn: (a: A) => State<S, B>): State<S, B> {
    return new State(s => {
      const [a, s2] = this.run(s);
      return fn(a).run(s2);
    });
  }

  execute(initialState: S): [A, S] {
    return this.run(initialState);
  }
}
```

### State로 스택 구현

```typescript
type Stack = number[];

const push = (n: number): State<Stack, void> =>
  State.modify<Stack>(stack => [n, ...stack]);

const pop: State<Stack, number> = new State(stack => {
  const [head, ...tail] = stack;
  return [head, tail];
});

const peek: State<Stack, number> = State.get<Stack>().map(s => s[0]);

// 상태 변이 없이 스택 연산 조합
const program = push(1)
  .flatMap(() => push(2))
  .flatMap(() => push(3))
  .flatMap(() => pop)
  .flatMap(top => peek.map(next => `꺼낸 값: ${top}, 다음: ${next}`));

const [result, finalStack] = program.execute([]);
console.log(result);      // "꺼낸 값: 3, 다음: 2"
console.log(finalStack);  // [2, 1]
```

### State로 ID 생성기

```typescript
type IdState = { nextId: number };

const generateId: State<IdState, number> = new State(s => [s.nextId, { nextId: s.nextId + 1 }]);

const createThreeUsers = generateId.flatMap(id1 =>
  generateId.flatMap(id2 =>
    generateId.map(id3 => [
      { id: id1, name: 'Alice' },
      { id: id2, name: 'Bob' },
      { id: id3, name: 'Carol' },
    ]),
  ),
);

const [users, finalState] = createThreeUsers.execute({ nextId: 1 });
// users: [{id:1, name:'Alice'}, {id:2, name:'Bob'}, {id:3, name:'Carol'}]
// finalState: { nextId: 4 }
```

## 세 모나드 비교

| 모나드 | 해결하는 문제 | 패턴 |
|--------|-------------|------|
| **Reader** | 의존성 주입 | 환경을 암묵적으로 전달 |
| **Writer** | 부수 효과 없는 로깅 | 로그를 값과 함께 반환 |
| **State** | 순수한 상태 변환 | 상태를 인자/반환으로 명시 |

세 모나드 모두 **부수 효과를 타입으로 표현해 순수 함수 안에서 다루는** 방법입니다.

## 실무에서

TypeScript에서는 이 모나드들을 직접 구현하기보다 아이디어를 차용합니다.

- **Reader**: 함수에 `deps` 객체를 첫 인자로 받거나, DI 컨테이너 사용
- **Writer**: 함수가 `{ result, logs }` 형태를 반환
- **State**: reducer 패턴 (`(state, action) => state`)

Redux의 reducer가 State 모나드의 정신을 그대로 따릅니다. 엄격한 구현보다 핵심 아이디어를 상황에 맞게 적용하는 것이 중요합니다.
