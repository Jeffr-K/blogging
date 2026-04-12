---
title: "NestJS Deep Dive: 리액티브 컨트롤러와 비동기 데이터 파이프라인"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "rxjs", "reactive-controller", "async-data"]
---

## 컨트롤러의 진화: Observable 기반의 응답 설계

우리는 보통 NestJS 컨트롤러에서 `Promise<T>`나 일반 객체 `T`를 반환한다. 하지만 NestJS는 **`Observable<T>`**를 직접 반환하는 서비스 또한 완벽하게 지원한다.

비동기로 여러 데이터를 조합하거나, 일정 시간이 지난 후 응답을 보내야 하는 경우, 혹은 실시간 스트리밍 데이터를 가공하여 내보내야 하는 경우에 `Observable` 기반의 컨트롤러 설계는 `async/await`보다 훨씬 더 강력한 선언적 프로그래밍 경험을 제공한다. 이번 아티클에서는 **리액티브 컨트롤러(Reactive Controller)**를 구축하는 전략을 딥다이브해 본다.

---

## 1. 컨트롤러에서 Observable 반환하기

NestJS는 핸들러가 `Observable`을 반환하면 내부적으로 이를 구독(`subscribe`)하고, 그 결과가 나오면 클라이언트에게 응답을 보낸다.

```typescript
@Get()
findAll(): Observable<User[]> {
  // 서비스가 Observable을 반환한다면 별도의 변환 없이 그대로 내보낼 수 있다.
  return this.usersService.findAllStream();
}
```

---

## 2. 딥다이브: 비동기 데이터 파이프라인 구축

복잡한 비동기 로직을 `async/await`으로 짤 경우 가독성이 떨어지기 마련이다. `RxJS` 오퍼레이터는 이를 한 줄로 정리해 준다.

- **`zip()` / `forkJoin()`**: 여러 비동기 소스(API, DB)로부터 동시에 데이터를 받아와 하나로 합칠 때.
- **`switchMap()`**: 이전 비동기 작업의 결과물을 가지고 다음 비동기 작업을 연속적으로 실행할 때.
- **`from()`**: 이미 존재하는 `Promise`를 `Observable`로 변환하여 리액티브 생태계로 끌어올 때.

```typescript
// 실전 예시: 유저 정보 조회와 포인트 내역 조회를 병렬로 수행 후 결합
@Get(':id')
getUserWithPoints(@Param('id') id: string): Observable<UserFullProfile> {
  const user$ = from(this.usersService.findById(id));
  const points$ = from(this.pointsService.getHistory(id));

  return forkJoin({ user: user$, points: points$ }).pipe(
    map(({ user, points }) => ({ ...user, points }))
  );
}
```

---

## 3. 타임아웃과 재시도 (Resilience Patterns)

`Observable` 컨트롤러 설계의 꽃은 **회복 탄력성(Resilience)**이다.

- **`timeout(5000)`**: 5초 안에 응답이 오지 않으면 자동으로 타임아웃 예외를 발생시킨다.
- **`retry(3)`**: 네트워크 일시 오류 시 자동으로 3번까지 재시도한다.
- **`catchError()`**: 최종 실패 시 기본값(Default value)을 반환하거나 친절한 에러 메시지로 변환한다.

---

## 4. 스트리밍 데이터와 SSE (Server-Sent Events)

실시간 데이터 전송이 필요한 경우 `Observable`은 필수다.

- **`@Sse()` 데코레이터**: NestJS는 `Observable` 스트림을 클라이언트에게 이벤트를 지속적으로 쏘는 SSE(Server-Sent Events)로 자동 변환해 준다.
- **내부 원리**: 매번 `next()`로 밀어 넣어지는 데이터가 HTTP 응답 스트림의 한 프레임(Frame)이 되어 전송된다.

---

## 요약

리액티브 컨트롤러는 **"데이터를 기다리는 것"**이 아니라 **"데이터의 흐름을 정의하는 것"**에 집중한다.

- `Observable`을 직접 반환하여 불필요한 `lastValueFrom` 변환을 줄이자.
- 여러 비동기 소스를 조합할 때 `forkJoin`이나 `switchMap`을 적극 활용하자.
- `timeout`과 `retry` 오퍼레이터로 장애에 강한 API를 설계하자.

이 패러다임에 익숙해지면, 복잡한 비즈니스 요건이 늘어날수록 오히려 코드는 더 간결해지고 견고해지는 기적을 경험하게 된다.

다음 아티클에서는 이러한 비동기 작업 중 데이터의 전송 속도와 처리 속도의 불균형을 극복하는 **배압(Backpressure) 관리와 에러 전파 제어 전략**을 딥다이브해 본다.
