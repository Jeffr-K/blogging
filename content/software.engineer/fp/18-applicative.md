---
title: "[FP 시리즈] 18. 애플리케이티브 펑터 (Applicative Functor)"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "애플리케이티브", "펑터", "applicative", "FP"]
---

# 애플리케이티브 펑터 (Applicative Functor)

펑터(`map`)와 모나드(`flatMap`) 사이에 있는 추상화입니다. **컨테이너 안의 함수를 컨테이너 안의 값에 적용**하거나, **독립적인 효과들을 병렬로 합치는** 데 사용합니다.

## 펑터의 한계

펑터의 `map`은 인자가 하나인 함수에 잘 동작합니다.

```typescript
Maybe.of(5).map(x => x * 2); // Maybe(10)
```

그런데 **두 개의 Maybe 값을 더하려면** 어떻게 할까요?

```typescript
const a = Maybe.of(3);
const b = Maybe.of(5);

// map만으로는 어색함
a.map(x => b.map(y => x + y)); // Maybe<Maybe<number>>
```

`flatMap`으로 해결할 수 있지만, 더 근본적으로 "두 독립적인 컨테이너 값을 합치는" 패턴이 필요합니다.

## Applicative

두 가지 연산을 추가합니다.

```typescript
interface Applicative<F> extends Functor<F> {
  // 순수 값을 컨테이너에 올리기
  of<A>(a: A): F<A>;

  // 컨테이너 안의 함수를 컨테이너 안의 값에 적용
  ap<A, B>(fab: F<(a: A) => B>, fa: F<A>): F<B>;
}
```

### Maybe Applicative

```typescript
class Maybe<T> {
  // ... 이전 코드

  static of<T>(value: T): Maybe<T> {
    return new Maybe(value);
  }

  // ap: Maybe 안의 함수를 Maybe 안의 값에 적용
  ap<U>(maybeFn: Maybe<(value: T) => U>): Maybe<U> {
    if (maybeFn.value === null || this.value === null) return Maybe.of<U>(null);
    return Maybe.of(maybeFn.value(this.value));
  }
}

// 두 Maybe 값을 합치기
const a = Maybe.of(3);
const b = Maybe.of(5);

const add = (x: number) => (y: number) => x + y;

Maybe.of(add)  // Maybe<(x: number) => (y: number) => number>
  .ap(a)       // Maybe<(y: number) => number> — 첫 번째 인자 적용
  // 잠깐, ap 순서가 반대 — 관례에 따라 아래처럼
;

// 더 자연스러운 방향
a.map(add).ap(b); // Maybe(8) — add(3)을 Maybe에 올려서 b에 적용
```

## liftA2: 두 컨테이너 값을 합치는 유틸리티

```typescript
function liftA2<A, B, C>(
  fn: (a: A) => (b: B) => C,
  fa: Maybe<A>,
  fb: Maybe<B>,
): Maybe<C> {
  return fa.map(fn).ap(fb);
}

// 사용
liftA2(
  (x: number) => (y: number) => x + y,
  Maybe.of(3),
  Maybe.of(5),
); // Maybe(8)

liftA2(
  (x: number) => (y: number) => x + y,
  Maybe.of(3),
  Maybe.of(null), // 하나라도 null이면 null
); // Maybe(null)
```

## 모나드와의 차이: 독립성

모나드의 `flatMap`은 **순차적**: 이전 결과에 따라 다음 연산이 달라집니다.

Applicative의 `ap`는 **독립적**: 두 컨테이너가 서로 의존하지 않습니다.

```typescript
// 모나드 — 순차적, 첫 번째 결과에 따라 두 번째 연산 결정
const result = getUserId(token)
  .flatMap(id => fetchUser(id)); // id에 의존

// 애플리케이티브 — 독립적, 병렬 실행 가능
const combined = liftA2(
  (user: User) => (posts: Post[]) => ({ user, posts }),
  fetchUser(userId),   // 독립적으로 실행
  fetchPosts(userId),  // 독립적으로 실행
);
```

## 실용 예시: 유효성 검사 누적

모나드(`flatMap`)로 검증하면 첫 번째 에러에서 멈춥니다. Applicative를 사용하면 **모든 에러를 수집**할 수 있습니다.

```typescript
type Validation<E, A> =
  | { type: 'Success'; value: A }
  | { type: 'Failure'; errors: E[] };

const success = <A>(value: A): Validation<never, A> => ({ type: 'Success', value });
const failure = <E>(errors: E[]): Validation<E, never> => ({ type: 'Failure', errors });

// ap: 에러를 누적
function apValidation<E, A, B>(
  vfab: Validation<E, (a: A) => B>,
  va: Validation<E, A>,
): Validation<E, B> {
  if (vfab.type === 'Failure' && va.type === 'Failure') {
    return failure([...vfab.errors, ...va.errors]); // 에러 누적
  }
  if (vfab.type === 'Failure') return vfab;
  if (va.type === 'Failure') return va;
  return success(vfab.value(va.value));
}

// 검증 함수들
const validateName = (name: string): Validation<string, string> =>
  name.length >= 2 ? success(name) : failure(['이름은 2자 이상이어야 합니다']);

const validateAge = (age: number): Validation<string, number> =>
  age >= 0 && age <= 150 ? success(age) : failure(['나이는 0~150 사이여야 합니다']);

const validateEmail = (email: string): Validation<string, string> =>
  email.includes('@') ? success(email) : failure(['유효하지 않은 이메일']);

// 모든 검증을 독립적으로 실행, 에러 누적
function validateUser(input: {
  name: string; age: number; email: string;
}): Validation<string, { name: string; age: number; email: string }> {
  const nameResult = validateName(input.name);
  const ageResult = validateAge(input.age);
  const emailResult = validateEmail(input.email);

  // 커링된 생성 함수
  const createUser = (name: string) => (age: number) => (email: string) =>
    ({ name, age, email });

  return apValidation(
    apValidation(
      apValidation(success(createUser), nameResult),
      ageResult,
    ),
    emailResult,
  );
}

const result = validateUser({ name: 'a', age: -1, email: 'invalid' });
// { type: 'Failure', errors: ['이름은 2자 이상이어야 합니다', '나이는 0~150 사이여야 합니다', '유효하지 않은 이메일'] }
// 세 오류 모두 수집됨
```

이것이 `flatMap`(모나드)과의 핵심 차이입니다. `flatMap`은 첫 번째 에러에서 멈추지만, `ap`(애플리케이티브)는 모든 에러를 모읍니다.

## Promise.all이 Applicative

사실 `Promise.all`도 애플리케이티브 패턴입니다.

```typescript
// 순차적 (모나드)
const user = await fetchUser(id);
const posts = await fetchPosts(id); // user가 완료된 후 실행

// 병렬 (애플리케이티브)
const [user, posts] = await Promise.all([
  fetchUser(id),   // 독립적으로 실행
  fetchPosts(id),  // 독립적으로 실행
]);
```

독립적인 비동기 작업을 병렬로 실행하는 것이 Applicative의 정신입니다.

## 정리

- **Applicative**: 컨테이너 안의 함수를 컨테이너 안의 값에 적용 (`ap`)
- **모나드 vs Applicative**: 순차적 의존 → 모나드, 독립적 병렬 → Applicative
- **에러 누적**: Applicative로 검증하면 모든 에러를 수집 가능

Applicative는 "독립적인 효과들을 합칠 때" 사용합니다. `Promise.all`, 여러 필드의 동시 검증, 독립적인 옵션 값 합산 등이 대표적인 사용 사례입니다.
