---
title: "[FP 시리즈] 9. Option/Maybe와 Either/Result"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "Maybe", "Option", "Either", "Result", "FP"]
---

# Option/Maybe와 Either/Result

FP에서 가장 실용적인 두 가지 모나드입니다. `null`과 예외 던지기를 타입으로 대체해서 **실패 가능성을 명시적으로 표현**합니다.

## Option / Maybe

"있을 수도 없을 수도 있는 값"을 표현합니다. `null`이나 `undefined`의 타입 안전한 대안입니다.

```typescript
type Option<T> =
  | { _tag: 'Some'; value: T }
  | { _tag: 'None' };

const Some = <T>(value: T): Option<T> => ({ _tag: 'Some', value });
const None: Option<never> = { _tag: 'None' };

// 유틸리티
function isSome<T>(opt: Option<T>): opt is { _tag: 'Some'; value: T } {
  return opt._tag === 'Some';
}
```

### null 대신 Option 쓰기

```typescript
function findUser(id: string): Option<User> {
  const user = users.find(u => u.id === id);
  return user ? Some(user) : None;
}

// 기존 방식 — null 체크를 잊을 수 있음
const user = findUser('123');
console.log(user.name); // 런타임 에러 가능

// Option 방식 — 체크를 강제
const result = findUser('123');
if (isSome(result)) {
  console.log(result.value.name); // 안전
}
```

### Option에 map, flatMap

```typescript
class OptionClass<T> {
  private constructor(private readonly value: T | null) {}

  static some<T>(value: T): OptionClass<T> {
    return new OptionClass(value);
  }

  static none<T>(): OptionClass<T> {
    return new OptionClass<T>(null);
  }

  static from<T>(value: T | null | undefined): OptionClass<T> {
    return value != null ? OptionClass.some(value) : OptionClass.none();
  }

  map<U>(fn: (value: T) => U): OptionClass<U> {
    return this.value !== null ? OptionClass.some(fn(this.value)) : OptionClass.none<U>();
  }

  flatMap<U>(fn: (value: T) => OptionClass<U>): OptionClass<U> {
    return this.value !== null ? fn(this.value) : OptionClass.none<U>();
  }

  getOrElse(fallback: T): T {
    return this.value ?? fallback;
  }
}

// 체이닝으로 null 안전하게 탐색
const cityName = OptionClass.from(getUser(userId))
  .flatMap(user => OptionClass.from(user.address))
  .flatMap(addr => OptionClass.from(addr.city))
  .map(city => city.name)
  .getOrElse('도시 정보 없음');

// 중간에 null이 나오면 이후는 자동으로 건너뜀
// optional chaining(?.)과 유사하지만 map/flatMap을 체이닝할 수 있음
```

## Either / Result

"성공 또는 실패"를 표현합니다. 예외를 던지는 대신 실패를 **반환값**으로 표현합니다.

```typescript
type Either<L, R> =
  | { _tag: 'Left'; value: L }   // 실패 (관례적으로 Left = 에러)
  | { _tag: 'Right'; value: R }; // 성공 (Right = 올바른 값)

const Left = <L>(value: L): Either<L, never> => ({ _tag: 'Left', value });
const Right = <R>(value: R): Either<never, R> => ({ _tag: 'Right', value });
```

실무에서는 의미를 더 명확히 하는 `Result` 이름을 선호합니다.

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

### 예외 대신 Result 쓰기

```typescript
// 예외 방식 — 에러를 던질 수 있다는 게 타입에 안 보임
function parseJSON(raw: string): unknown {
  return JSON.parse(raw); // SyntaxError를 던질 수 있음
}

// Result 방식 — 실패 가능성이 타입에 표현됨
function parseJSON(raw: string): Result<unknown, SyntaxError> {
  try {
    return ok(JSON.parse(raw));
  } catch (e) {
    return err(e as SyntaxError);
  }
}

const result = parseJSON('{ invalid }');
if (!result.ok) {
  console.log('파싱 실패:', result.error.message);
} else {
  console.log('파싱 성공:', result.value);
}
```

### Result에 map, flatMap

```typescript
class ResultClass<T, E> {
  private constructor(
    private readonly _ok: boolean,
    private readonly _value: T | undefined,
    private readonly _error: E | undefined,
  ) {}

  static ok<T, E>(value: T): ResultClass<T, E> {
    return new ResultClass<T, E>(true, value, undefined);
  }

  static err<T, E>(error: E): ResultClass<T, E> {
    return new ResultClass<T, E>(false, undefined, error);
  }

  map<U>(fn: (value: T) => U): ResultClass<U, E> {
    if (!this._ok) return ResultClass.err<U, E>(this._error!);
    return ResultClass.ok(fn(this._value!));
  }

  flatMap<U>(fn: (value: T) => ResultClass<U, E>): ResultClass<U, E> {
    if (!this._ok) return ResultClass.err<U, E>(this._error!);
    return fn(this._value!);
  }

  fold<U>(onErr: (e: E) => U, onOk: (v: T) => U): U {
    return this._ok ? onOk(this._value!) : onErr(this._error!);
  }
}
```

### 실용 예시: 검증 파이프라인

```typescript
type ValidationError = { field: string; message: string };

const parseEmail = (raw: string): Result<string, ValidationError> =>
  raw.includes('@')
    ? ok(raw.trim().toLowerCase())
    : err({ field: 'email', message: '유효하지 않은 이메일' });

const parseAge = (raw: string): Result<number, ValidationError> => {
  const n = parseInt(raw);
  if (isNaN(n)) return err({ field: 'age', message: '숫자를 입력하세요' });
  if (n < 0 || n > 150) return err({ field: 'age', message: '0~150 사이의 값을 입력하세요' });
  return ok(n);
};

const validatePassword = (pw: string): Result<string, ValidationError> =>
  pw.length >= 8
    ? ok(pw)
    : err({ field: 'password', message: '비밀번호는 8자 이상이어야 합니다' });

// 검증을 순서대로 실행 — 하나라도 실패하면 멈춤
function validateRegistration(input: {
  email: string;
  age: string;
  password: string;
}): Result<{ email: string; age: number; password: string }, ValidationError> {
  const emailResult = parseEmail(input.email);
  if (!emailResult.ok) return emailResult;

  const ageResult = parseAge(input.age);
  if (!ageResult.ok) return ageResult;

  const passwordResult = validatePassword(input.password);
  if (!passwordResult.ok) return passwordResult;

  return ok({
    email: emailResult.value,
    age: ageResult.value,
    password: passwordResult.value,
  });
}

const result = validateRegistration({
  email: 'user@example.com',
  age: '25',
  password: 'secure123',
});

result.ok
  ? console.log('가입 처리:', result.value)
  : console.log('검증 실패:', result.error);
```

## Option vs Either

| | Option/Maybe | Either/Result |
|--|-------------|--------------|
| 표현하는 것 | 없을 수도 있는 값 | 성공 또는 실패 |
| 실패 정보 | 없음 (단순히 "없음") | 에러 정보 포함 |
| 사용 예 | DB에서 조회, 옵션 설정 | 파싱, 검증, API 호출 |

"왜 실패했는지가 중요하면" Either/Result, "있냐 없냐만 중요하면" Option/Maybe를 씁니다.

## 실무에서

직접 구현하기보다는 라이브러리를 사용합니다.

```typescript
// fp-ts 사용 예시
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';

const result = pipe(
  O.fromNullable(getUser(id)),
  O.map(user => user.email),
  O.getOrElse(() => 'unknown@example.com'),
);

// neverthrow 사용 예시 (더 가볍고 실용적)
import { ok, err, Result } from 'neverthrow';

async function fetchUser(id: string): Promise<Result<User, string>> {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) return err(`HTTP ${res.status}`);
    return ok(await res.json());
  } catch (e) {
    return err('네트워크 오류');
  }
}
```

## 정리

- **Option/Maybe**: 없을 수도 있는 값을 타입으로 — null 대신 사용
- **Either/Result**: 성공/실패를 타입으로 — 예외 대신 사용

두 패턴 모두 **실패 가능성을 함수 시그니처에 드러내는** 것이 목적입니다. `null`을 반환하거나 예외를 던지면 호출하는 쪽이 이를 처리할 책임이 있다는 것을 잊기 쉽습니다. 타입으로 표현하면 처리를 강제할 수 있습니다.
