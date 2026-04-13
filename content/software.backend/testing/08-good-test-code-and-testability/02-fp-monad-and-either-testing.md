---
title: "펑터와 모나드를 이용한 오류 처리 테스팅: fp-ts, Effect.ts, 그리고 Pure TS"
author: jeffrey
date: 2026-04-13
tags: ["monad", "either", "fp-ts", "effect-ts", "error-handling", "testability"]
---

## 펑터와 모나드를 이용한 오류 처리 테스팅: fp-ts, Effect.ts, 그리고 Pure TS

전통적인 명령형 프로그래밍에서는 에러 핸들링을 위해 `try-catch`와 `throw`를 사용합니다. 하지만 테스트 관점에서 `throw`는 비결정적이며, 코드의 흐름을 갑자기 끊어버립니다. 함수형 프로그래밍(FP)은 에러를 **'값(Either, Option)'**으로 다루어, 성공과 실패의 모든 경우의 수를 풍부하게 테스팅할 수 있는 환경을 제공합니다.

---

### 1. 왜 에러를 값으로 다루어야 할까? (테스팅 임팩트)

- **명령형의 한계**: `try-catch` 블록은 테스트 코드도 비대하게 만들며, 특정 에러가 발생하는지 확인하기 위해 `toThrow()`를 사방에 배치해야 합니다.
- **함수형의 강점**: 성공(Right)과 실패(Left)를 모두 데이터 구조 안에 담으므로, 단순히 결과 값이 무엇인지만 확인하면 됩니다. (Result-oriented testing)

### 2. 세 가지 방식의 전개: 사용자 조회 및 포인트 지급 시나리오

"사용자가 존재하지 않으면 실패(404), 존재하면 포인트가 가산된 유저 객체 반환"이라는 로직을 세 가지 방식으로 구현하고 테스트를 비교합니다.

#### 방식 A: Pure TypeScript (모나드 없이 수동 패턴 매칭)

```typescript
// Pure TS: Union Type 활용
type Result<T, E> = { success: true; data: T } | { success: false; error: E };

const findUser = (id: number): Result<User, string> => {
  if (id === 0) return { success: false, error: 'User not found' };
  return { success: true, data: { id, points: 100 } };
};

// [Testing]: 단순 값 비교 (Try-catch 불필요)
it('사용자가 없으면 에러 객체를 반환해야 한다 (Pure TS)', () => {
    const result = findUser(0);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('User not found');
});
```

#### 방식 B: fp-ts (전통적인 FP 라이브러리)

```typescript
import * as E from 'fp-ts/Either';

const findUserFp = (id: number): E.Either<string, User> => {
  return id === 0 ? E.left('User not found') : E.right({ id, points: 100 });
};

// [Testing]: Either 모나드 검증
it('성공 시 포인트를 가산한 Right를 반환해야 한다 (fp-ts)', () => {
    const pipeResult = findUserFp(1);
    expect(E.isRight(pipeResult)).toBe(true);
    // E.isRight() 이후 타입 가드 자동 적용
});
```

#### 방식 C: Effect.ts (현대적인 Effect System)

현대적인 고성능 Effect 라이브러리를 사용하여 오류를 명시적으로 다룹니다.

```typescript
import { Effect } from "effect";

const findUserEffect = (id: number) => {
  return id === 0 
    ? Effect.fail("User not found") 
    : Effect.succeed({ id, points: 100 });
};

// [Testing]: Effect.runPromise를 통한 비동기/동기 에러 테스트
it('Effect 시스템에서 에러가 전파되는지 확인한다', async () => {
  const program = findUserEffect(0);
  const result = await Effect.runPromiseExit(program);
  
  expect(result._tag).toBe('Failure');
});
```

---

### 3. 모나드가 주는 테스트 가용성의 정점

1. **에러 경로 시뮬레이션**: 복잡한 비즈니스 로직(Pipe) 중간에 특정 조건에서만 에러가 발생하는 상황을 Mocking 없이 값(Left) 주입만으로 테스트할 수 있습니다.
2. **합성성 (Composability)**: 여러 비즈니스 함수를 합성할 때, 어느 한 곳이라도 실패(Either.left)하면 전체 흐름이 안전하게 실패 경로로 수렴됨을 단 하나의 테스트 케이스로 증명 가능합니다.
3. **비동기 정복 (Task/Either)**: 비동기 호출(API 등)의 성공과 실패 사례를 동일한 데이터 구조로 다루므로, 비동기 테스트 특유의 레이스 컨디션을 억제하고 안정적인 검증 환경을 구축할 수 있습니다.

### 4. 시니어의 통찰: "실패를 일등 시민으로 대우하라"

대부분의 버그는 **'행복한 경로(Happy Path)'**가 아닌 **'에러 경로(Error Path)'**에서 발생합니다. 펑터와 모나드는 이 에러 경로를 코드 상에서 명시적인 **'데이터'**로 끌어올립니다. 

테스트 코드에서 `try-catch`를 걷어내십시오. 에러가 더 이상 예외(Exception)가 아닌 예상 가능한 **'결과값(Result)'**이 되었을 때, 여러분의 시스템은 비로소 완벽한 테스트 가능성을 갖추게 됩니다.
