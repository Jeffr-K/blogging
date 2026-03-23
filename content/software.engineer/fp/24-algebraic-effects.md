---
title: "[FP 시리즈] 24. 대수적 효과 (Algebraic Effects)"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "대수적효과", "algebraic effects", "Effect.ts", "FP"]
---

# 대수적 효과 (Algebraic Effects)

대수적 효과는 **부수 효과를 선언하고 외부에서 처리(핸들링)하는** 최신 FP 개념입니다. 함수가 효과를 "던지면" 호출자 중 누군가가 처리합니다. 예외 처리와 비슷하지만, 처리 후 **함수가 중단된 지점부터 재개**할 수 있습니다.

## 기존 방법들의 한계

```typescript
// 1. 직접 부수 효과 — 테스트 어려움
function getUser(id: string): User {
  return db.find(id); // DB가 직접 연결됨
}

// 2. 의존성 주입 — 함수 시그니처가 복잡해짐
function getUser(id: string, db: Database): User {
  return db.find(id);
}

// 3. 모나드 — 체이닝 필요, 모나드 타입에 묶임
function getUser(id: string): IO<User> {
  return IO.of(() => db.find(id));
}
```

모나드는 강력하지만 `flatMap` 체이닝이 깊어지고 여러 효과(IO + Either + State)를 조합하면 복잡해집니다.

## 대수적 효과의 아이디어

```
함수가 효과를 "수행(perform)"하면 실행이 일시 중단됩니다.
호출 스택의 누군가가 효과를 "핸들링"합니다.
핸들러가 값을 반환하면 함수가 그 지점부터 재개됩니다.
```

```typescript
// 개념적 pseudocode (현재 JS에는 없음)
function getUser(id: string): User {
  const user = perform DbEffect.find(id); // 효과 수행 — 여기서 중단
  // DbEffect.find가 핸들링되어 user를 받으면 재개
  return user;
}

// 핸들러 등록
withHandler(DbEffect, {
  find: (id, resume) => {
    const user = realDb.find(id);
    resume(user); // getUser를 재개시키며 user 전달
  }
}, () => {
  getUser('123'); // 여기서 실행
});
```

효과를 직접 실행하는 게 아니라 **선언**하고, 바깥의 핸들러가 처리합니다.

## JavaScript에서의 유사 패턴

JavaScript에 대수적 효과가 없으므로 비슷한 패턴들을 씁니다.

### Generator 기반 (redux-saga 방식)

```typescript
import { call, put, select } from 'redux-saga/effects';

function* fetchUser(id: string) {
  // effect를 yield — 실행 중단
  const user = yield call(fetch, `/api/users/${id}`);
  // 핸들러(saga 미들웨어)가 처리 후 재개
  yield put({ type: 'USER_LOADED', payload: user });
}

// 핸들러 교체로 테스트
function* testFetchUser() {
  const action = { type: 'FETCH_USER', payload: '123' };
  const gen = fetchUser(action.payload);

  // call 효과 검사
  expect(gen.next().value).toEqual(call(fetch, '/api/users/123'));

  // mock 값으로 재개
  const mockUser = { id: '123', name: '홍길동' };
  expect(gen.next(mockUser).value).toEqual(put({ type: 'USER_LOADED', payload: mockUser }));
}
```

redux-saga의 `call`, `put`, `select`가 대수적 효과의 구현입니다. Generator가 효과를 yield하면 saga 미들웨어가 처리합니다.

## Effect.ts (Effect 라이브러리)

현재 TypeScript에서 대수적 효과에 가장 가까운 구현입니다.

```typescript
import { Effect, pipe } from 'effect';

// 효과 타입: Effect<RequiredServices, Error, Value>
const getUser = (id: string): Effect.Effect<Database, Error, User> =>
  Effect.flatMap(
    Effect.service(Database), // Database 서비스가 필요
    db => Effect.promise(() => db.find(id)),
  );

const processUser = (id: string): Effect.Effect<Database | Logger, Error, string> =>
  pipe(
    getUser(id),
    Effect.tap(user => Effect.log(`사용자 조회: ${user.name}`)),
    Effect.map(user => user.name.toUpperCase()),
  );

// 실행: 서비스를 제공
Effect.runPromise(
  pipe(
    processUser('123'),
    Effect.provide(DatabaseLive),  // 실제 DB 구현 주입
    Effect.provide(LoggerLive),    // 실제 Logger 주입
  ),
);

// 테스트: mock 서비스 주입
Effect.runPromise(
  pipe(
    processUser('123'),
    Effect.provide(DatabaseMock),  // Mock DB
    Effect.provide(LoggerSilent),  // 로그 없음
  ),
);
```

효과에 필요한 서비스가 타입에 명시됩니다. 컴파일러가 서비스 누락을 잡아줍니다.

### Effect로 에러 처리

```typescript
type AppError = { type: 'NotFound'; id: string } | { type: 'Unauthorized' };

const getUser = (id: string): Effect.Effect<Database, AppError, User> =>
  pipe(
    Effect.flatMap(Effect.service(Database), db => Effect.promise(() => db.find(id))),
    Effect.mapError(e => ({ type: 'NotFound' as const, id })),
  );

const requireAuth = <R, E, A>(
  effect: Effect.Effect<R, E, A>,
  token: string | null,
): Effect.Effect<R, E | AppError, A> =>
  token
    ? effect
    : Effect.fail({ type: 'Unauthorized' as const });

// 에러 타입이 정확히 표현됨 — Effect<Database, NotFound | Unauthorized, User>
const program = (token: string | null, id: string) =>
  requireAuth(getUser(id), token);
```

## React의 Suspense/Context가 대수적 효과

React의 Suspense는 대수적 효과의 실용적 구현입니다.

```tsx
// 컴포넌트가 Promise를 throw하면 (효과 수행)
function UserProfile({ id }: { id: string }) {
  const user = use(fetchUser(id)); // 내부적으로 throw Promise
  // Suspense 경계(핸들러)가 처리하고 데이터가 오면 재개
  return <div>{user.name}</div>;
}

// Suspense = 효과 핸들러
<Suspense fallback={<Loading />}>
  <UserProfile id="123" />
</Suspense>
```

React의 `use()` 훅이 대수적 효과 패턴입니다. 컴포넌트가 비동기 값을 "요청"하면 Suspense가 처리합니다.

## 대수적 효과 vs 모나드

| | 모나드 | 대수적 효과 |
|--|--------|-----------|
| 효과 처리 | 타입에 인코딩 (`IO<T>`, `Either<E,T>`) | 핸들러가 외부에서 처리 |
| 여러 효과 조합 | Monad transformer 필요 (복잡) | 자연스럽게 조합 |
| 코드 스타일 | `flatMap` 체인 | 직접 호출처럼 보임 |
| 재개 가능성 | 없음 (실행 흐름 단방향) | 있음 (yield 지점 재개) |

## 현재 상태

2026년 기준으로 JavaScript/TypeScript 언어 차원의 대수적 효과는 없습니다. 다양한 방식으로 에뮬레이션합니다.

- **Generator/yield**: redux-saga, 효과 에뮬레이션
- **Effect.ts**: 가장 완성도 높은 TypeScript FP 라이브러리
- **React Suspense**: 실용적인 부분 구현
- **언어 제안**: TC39에서 검토 중

## 정리

- **대수적 효과**: 효과를 선언하고 외부 핸들러가 처리 — 함수가 효과를 직접 실행하지 않음
- **재개 가능**: 핸들러 처리 후 함수가 중단 지점에서 재개
- **현재 실용**: redux-saga, Effect.ts, React Suspense에서 유사 패턴 사용

대수적 효과는 모나드의 구성 가능성과 직접 스타일 코드의 가독성을 모두 가집니다. 언어 지원이 추가되면 FP에서 모나드를 대체하는 핵심 개념이 될 것으로 예상됩니다.
