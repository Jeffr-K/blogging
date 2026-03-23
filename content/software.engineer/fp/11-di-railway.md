---
title: "[FP 시리즈] 11. 커링으로 의존성 주입하기와 철도 지향 프로그래밍"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "의존성주입", "철도지향프로그래밍", "railway", "currying", "FP"]
---

# 커링으로 의존성 주입하기와 철도 지향 프로그래밍

## 커링으로 의존성 주입하기

객체지향에서 의존성 주입(DI)은 보통 생성자나 인터페이스로 처리합니다. 함수형에서는 **커링**을 이용해 같은 문제를 해결합니다.

### 문제: 하드코딩된 의존성

```typescript
// 의존성이 함수 안에 박혀있음
async function getUser(id: string): Promise<User | null> {
  const res = await fetch(`/api/users/${id}`); // fetch가 하드코딩
  return res.json();
}

// 테스트하기 어려움 — 실제 네트워크가 필요
```

### 커링으로 의존성 외부에서 주입

```typescript
// 의존성을 첫 번째 인자로 받는 커링된 함수
const getUser =
  (httpClient: HttpClient) =>
  async (id: string): Promise<User | null> => {
    const res = await httpClient.get(`/api/users/${id}`);
    return res.json();
  };

// 프로덕션 - 실제 http 클라이언트 주입
const prodGetUser = getUser(realHttpClient);

// 테스트 - mock 주입
const testGetUser = getUser(mockHttpClient);
```

의존성을 먼저 받고, 실제 파라미터를 나중에 받는 구조입니다. 이렇게 하면:
- 의존성이 타입에 명시됩니다
- 테스트 시 mock을 쉽게 주입할 수 있습니다
- 함수를 특정 환경에 맞게 미리 설정할 수 있습니다

### 더 복잡한 예시

```typescript
type Dependencies = {
  db: Database;
  emailService: EmailService;
  logger: Logger;
};

// 의존성을 받아 서비스 함수를 반환
const createUserService = (deps: Dependencies) => ({
  register: async (data: RegisterData) => {
    deps.logger.info('사용자 등록 시작');
    const user = await deps.db.create('users', data);
    await deps.emailService.send(user.email, '가입을 환영합니다!');
    deps.logger.info('사용자 등록 완료', { userId: user.id });
    return user;
  },

  delete: async (id: string) => {
    deps.logger.info('사용자 삭제 시작', { id });
    await deps.db.delete('users', id);
  },
});

// 사용
const userService = createUserService({ db, emailService, logger });
await userService.register({ name: '홍길동', email: 'hong@example.com' });

// 테스트
const testUserService = createUserService({
  db: mockDb,
  emailService: mockEmailService,
  logger: noopLogger,
});
```

## 철도 지향 프로그래밍 (Railway Oriented Programming)

Scott Wlaschin이 제안한 패턴입니다. **에러 처리를 파이프라인에 자연스럽게 통합**합니다.

### 비유

기차가 두 개의 선로를 달린다고 상상하세요.
- **성공 선로**: 정상 처리
- **실패 선로**: 에러 처리

한 번 실패 선로로 빠지면 이후 처리 단계는 건너뛰고 끝까지 실패 선로를 달립니다.

```
입력
  │
  ▼
[검증] ──실패──▶ 실패 선로 ──▶ ──▶ ──▶ 에러 결과
  │
성공
  │
  ▼
[처리] ──실패──▶ 실패 선로 ──▶ ──▶ 에러 결과
  │
성공
  │
  ▼
[저장] ──실패──▶ 실패 선로 ──▶ 에러 결과
  │
성공
  │
  ▼
성공 결과
```

### Result 타입으로 구현

```typescript
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// andThen: 성공이면 다음 단계 실행, 실패면 에러 전달
function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}
```

### 실용 예시: 사용자 등록

```typescript
type User = { id: string; email: string; name: string; age: number };
type RegisterInput = { email: string; name: string; age: string };

// 각 단계는 Result를 반환하는 순수 함수
function validateEmail(input: RegisterInput): Result<RegisterInput, string> {
  if (!input.email.includes('@')) return err('유효하지 않은 이메일입니다');
  return ok(input);
}

function validateAge(input: RegisterInput): Result<RegisterInput & { parsedAge: number }, string> {
  const age = parseInt(input.age);
  if (isNaN(age) || age < 0 || age > 150) return err('유효하지 않은 나이입니다');
  return ok({ ...input, parsedAge: age });
}

function validateName(input: RegisterInput & { parsedAge: number }): Result<typeof input, string> {
  if (input.name.trim().length < 2) return err('이름은 2자 이상이어야 합니다');
  return ok(input);
}

function createUser(
  input: RegisterInput & { parsedAge: number },
): Result<User, string> {
  return ok({
    id: crypto.randomUUID(),
    email: input.email.toLowerCase(),
    name: input.name.trim(),
    age: input.parsedAge,
  });
}

// 파이프라인 — 각 단계는 성공해야 다음으로 진행
function registerUser(input: RegisterInput): Result<User, string> {
  return andThen(
    andThen(
      andThen(validateEmail(input), validateAge),
      validateName,
    ),
    createUser,
  );
}

// 또는 더 읽기 쉽게 pipe 사용
function registerUser2(input: RegisterInput): Result<User, string> {
  let result: Result<any, string> = ok(input);
  for (const step of [validateEmail, validateAge, validateName, createUser]) {
    if (!result.ok) break;
    result = step(result.value);
  }
  return result;
}
```

### 비동기 버전

```typescript
// AsyncResult: 비동기 + 실패 처리
type AsyncResult<T, E = string> = Promise<Result<T, E>>;

async function checkEmailExists(user: User): AsyncResult<User, string> {
  const existing = await db.findByEmail(user.email);
  if (existing) return err('이미 사용 중인 이메일입니다');
  return ok(user);
}

async function saveUser(user: User): AsyncResult<User, string> {
  try {
    await db.create('users', user);
    return ok(user);
  } catch (e) {
    return err('사용자 저장에 실패했습니다');
  }
}

async function sendWelcomeEmail(user: User): AsyncResult<User, string> {
  try {
    await emailService.send(user.email, '가입을 환영합니다!');
    return ok(user);
  } catch (e) {
    // 이메일 실패는 치명적이지 않음 — 성공으로 처리
    console.error('환영 이메일 발송 실패', e);
    return ok(user);
  }
}

// 비동기 파이프라인
async function processRegistration(input: RegisterInput): AsyncResult<User, string> {
  const validated = registerUser(input); // 동기 검증
  if (!validated.ok) return validated;

  // 비동기 단계들을 체인
  const checkedEmail = await checkEmailExists(validated.value);
  if (!checkedEmail.ok) return checkedEmail;

  const saved = await saveUser(checkedEmail.value);
  if (!saved.ok) return saved;

  return await sendWelcomeEmail(saved.value);
}

// 사용
const result = await processRegistration({
  email: 'hong@example.com',
  name: '홍길동',
  age: '25',
});

if (result.ok) {
  console.log('가입 완료:', result.value);
} else {
  console.log('가입 실패:', result.error);
}
```

### neverthrow 라이브러리

직접 구현하지 않고 `neverthrow`를 쓰면 더 편합니다.

```typescript
import { ok, err, Result, ResultAsync } from 'neverthrow';

const validateEmail = (input: RegisterInput): Result<RegisterInput, string> =>
  input.email.includes('@') ? ok(input) : err('유효하지 않은 이메일');

const checkEmail = (input: RegisterInput): ResultAsync<RegisterInput, string> =>
  ResultAsync.fromPromise(
    db.findByEmail(input.email).then(existing => {
      if (existing) throw new Error('이미 사용 중인 이메일');
      return input;
    }),
    e => (e as Error).message,
  );

// 체이닝
const result = await validateEmail(input)
  .asyncAndThen(checkEmail)
  .map(input => createUser(input));
```

## 정리

- **커링 DI**: 의존성을 첫 번째 인자로 받아 함수를 특수화 — 테스트와 재사용이 쉬워짐
- **철도 지향 프로그래밍**: 실패 가능한 단계들을 Result 체인으로 연결 — 에러 처리가 파이프라인에 자연스럽게 녹아듦

두 패턴 모두 **복잡한 비즈니스 로직을 작고 테스트 가능한 단계들로 분해**하는 데 효과적입니다.
