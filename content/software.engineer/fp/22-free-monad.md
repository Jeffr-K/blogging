---
title: "[FP 시리즈] 22. 자유 모나드 (Free Monad)"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "자유모나드", "free monad", "인터프리터패턴", "FP"]
---

# 자유 모나드 (Free Monad)

자유 모나드는 **프로그램의 명세(description)와 해석(interpretation)을 완전히 분리**하는 패턴입니다. "무엇을 할지"를 데이터로 표현하고, "어떻게 할지"는 나중에 결정합니다.

## 문제: 효과가 구현에 묶여있음

```typescript
// 프로그램 로직이 특정 구현(fetch, db)에 묶임
async function getUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`); // 실제 HTTP
  return res.json();
}

// 테스트하려면 fetch를 mock해야 함
// 다른 구현(GraphQL, gRPC)으로 바꾸려면 코드를 수정해야 함
```

## 자유 모나드의 아이디어

프로그램을 **명령들의 AST(추상 구문 트리)**로 표현합니다.

```typescript
// Step 1: 명령어 정의 (DSL)
type UserOp<Next> =
  | { type: 'GetUser'; id: string; next: (user: User) => Next }
  | { type: 'SaveUser'; user: User; next: Next }
  | { type: 'DeleteUser'; id: string; next: Next };
```

```typescript
// Step 2: Free 모나드 — AST를 모나드로 만들기
type Free<F, A> =
  | { type: 'Pure'; value: A }
  | { type: 'Impure'; op: F; next: (x: unknown) => Free<F, A> };

const pure = <F, A>(value: A): Free<F, A> => ({ type: 'Pure', value });

const lift = <F extends { next: unknown }, A>(op: F): Free<F, A> => ({
  type: 'Impure',
  op,
  next: (x) => pure(x as A),
});
```

### 간단한 구현으로 직관 얻기

복잡한 타입 없이 아이디어만 먼저 파악합니다.

```typescript
// 명령어 타입
type Command =
  | { type: 'GetUser'; id: string }
  | { type: 'SaveUser'; user: User }
  | { type: 'Log'; message: string }
  | { type: 'Pure'; value: unknown };

// 프로그램을 명령어 배열로 표현
type Program = Command[];

// 프로그램 빌더
function getUser(id: string): Program {
  return [{ type: 'GetUser', id }];
}

function saveUser(user: User): Program {
  return [{ type: 'SaveUser', user }];
}

function log(message: string): Program {
  return [{ type: 'Log', message }];
}

// 프로그램 조합
const program: Program = [
  { type: 'GetUser', id: '123' },
  { type: 'Log', message: '사용자 조회 완료' },
  { type: 'SaveUser', user: { id: '123', name: '홍길동', updatedAt: new Date() } },
];
```

## 인터프리터 패턴

같은 프로그램(AST)을 다른 방식으로 해석합니다.

```typescript
// 명령어 DSL
type DBOp<A> =
  | { kind: 'Find'; id: string; cont: (user: User | null) => A }
  | { kind: 'Save'; user: User; cont: () => A }
  | { kind: 'Delete'; id: string; cont: () => A };

// 간단한 Free 타입 (체이닝 가능)
class Free<A> {
  constructor(private readonly ops: Array<{ op: DBOp<unknown>; }>) {}

  static pure<A>(value: A): Free<A> {
    return new Free([]);
  }

  static find(id: string): Free<User | null> {
    return new Free([{ op: { kind: 'Find', id, cont: x => x } }]);
  }

  static save(user: User): Free<void> {
    return new Free([{ op: { kind: 'Save', user, cont: () => {} } }]);
  }

  getOps() { return this.ops; }
}

// 프로그램 정의 (순수 — 어떤 I/O도 없음)
const program = {
  findAndUpdate: (id: string, newName: string) => [
    { type: 'Find', id },
    { type: 'Save', user: { id, name: newName } },
    { type: 'Log', message: `${id} 업데이트 완료` },
  ],
};

// 인터프리터 1: 실제 DB
async function runWithDatabase(
  ops: Array<{ type: string; [key: string]: unknown }>,
  db: Database,
): Promise<void> {
  for (const op of ops) {
    switch (op.type) {
      case 'Find':
        await db.find(op.id as string);
        break;
      case 'Save':
        await db.save(op.user as User);
        break;
      case 'Log':
        console.log(op.message);
        break;
    }
  }
}

// 인터프리터 2: 테스트용 (메모리 DB)
async function runWithMemory(
  ops: Array<{ type: string; [key: string]: unknown }>,
  store: Map<string, User>,
): Promise<void> {
  for (const op of ops) {
    switch (op.type) {
      case 'Find':
        store.get(op.id as string);
        break;
      case 'Save':
        store.set((op.user as User).id, op.user as User);
        break;
      case 'Log':
        // 테스트에서는 로그 무시
        break;
    }
  }
}

// 같은 프로그램, 다른 해석
const ops = program.findAndUpdate('123', '홍길동');
await runWithDatabase(ops, realDb);           // 실제 실행
await runWithMemory(ops, new Map());           // 테스트
```

## 실용적인 접근: 태그된 DSL

자유 모나드의 완전한 구현보다 핵심 아이디어를 실용적으로 적용합니다.

```typescript
// Effect 타입으로 명령 표현
type Effect =
  | { type: 'http/get'; url: string }
  | { type: 'http/post'; url: string; body: unknown }
  | { type: 'db/query'; sql: string; params: unknown[] }
  | { type: 'cache/get'; key: string }
  | { type: 'cache/set'; key: string; value: unknown; ttl: number };

// 프로그램이 실행할 효과들을 반환
function getUserProfile(userId: string): Effect[] {
  return [
    { type: 'cache/get', key: `user:${userId}` },
    { type: 'http/get', url: `/api/users/${userId}` },
    { type: 'db/query', sql: 'SELECT * FROM users WHERE id = $1', params: [userId] },
  ];
}

// 인터프리터: 실제 실행
async function interpret(effects: Effect[]): Promise<unknown[]> {
  return Promise.all(effects.map(effect => {
    switch (effect.type) {
      case 'http/get': return fetch(effect.url).then(r => r.json());
      case 'db/query': return db.query(effect.sql, effect.params);
      case 'cache/get': return cache.get(effect.key);
      // ...
    }
  }));
}

// 테스트 인터프리터: 고정된 데이터 반환
async function testInterpret(effects: Effect[]): Promise<unknown[]> {
  return effects.map(effect => {
    switch (effect.type) {
      case 'http/get': return { id: '123', name: '테스트 유저' };
      case 'db/query': return [{ id: '123' }];
      case 'cache/get': return null;
    }
  });
}

// 같은 프로그램
const effects = getUserProfile('123');

// 다른 실행 환경
const prodResult = await interpret(effects);
const testResult = await testInterpret(effects);
```

## Redux의 Action이 자유 모나드

```typescript
// Redux action = 명령어 DSL
const actions = {
  fetchUser: (id: string) => ({ type: 'FETCH_USER', payload: id }),
  saveUser: (user: User) => ({ type: 'SAVE_USER', payload: user }),
};

// Redux middleware = 인터프리터
const sagaMiddleware = /* 비동기 효과 해석 */;
const testMiddleware = /* 테스트용 mock 해석 */;
```

Redux의 dispatch된 action이 바로 자유 모나드의 명령어 AST입니다.

## 정리

- **자유 모나드**: 프로그램을 데이터(AST)로 표현 — 실행 방식은 나중에 결정
- **인터프리터**: 같은 AST를 다른 방식으로 해석 (실제 DB, 메모리 DB, 로깅 등)
- **핵심 장점**: 프로그램 로직이 특정 효과 구현에 의존하지 않음

자유 모나드는 높은 추상화 비용이 있지만, 효과를 완전히 제어해야 하는 도메인 로직에서 강력합니다. Redux action, IO 모나드, 도메인 이벤트 패턴 등이 같은 아이디어를 다양한 형태로 구현한 것입니다.
