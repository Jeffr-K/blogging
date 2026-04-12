---
title: "NestJS Deep Dive: RxJS 기반의 고급 로깅 및 캐시 패턴"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "rxjs", "logging", "caching", "design-patterns"]
---

## 데이터의 흔적: RxJS와 인프라의 결합

NestJS 프로젝트에서 로깅과 캐시는 필연적이다. 하지만 이 로직들이 비즈니스 코드 곳곳에 산재해 있다면 어떨까? 코드는 지저분해지고 유지보수는 어려워진다.

RxJS의 진정한 힘은 **비즈니스 로직을 전혀 건드리지 않고도** 그 양옆에 로깅과 캐싱이라는 부수적 기능을 **선언적으로 덧붙일 수 있다는 것**이다. 이번 아티클에서는 `RxJS` 오퍼레이터들을 조합하여 세련된 인프라 스트럭처를 구축하는 고급 설계 패턴을 딥다이브하며 스트림 테마의 대미를 장식해 본다.

---

## 1. 선언적 로깅: tap()의 활용

비즈니스 코드를 건드리지 않고, 모든 단계에서 로그를 남기는 인터셉터 사례다.

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    
    return next.handle().pipe(
      tap({
        next: (value) => console.log(`Response: ${JSON.stringify(value)}`),
        error: (err) => console.error(`Error: ${err.message}`),
        complete: () => console.log(`Success in ${Date.now() - now}ms`),
      }),
    );
  }
}
```

- **장점**: 비즈니스 로직은 `next.handle()`에만 집중하면 된다. 로깅은 그 주변을 감싸는 **횡단 관심사(Cross-cutting Concern)**가 된다.

---

## 2. 딥다이브: 스마트 캐싱 전략 (shareReplay)

한 번 실행된 비동기 비즈니스 스트림을 일정 시간 동안 캐싱하고 싶을 때, 무거운 Redis나 DB를 쓰지 않고도 `shareReplay` 오퍼레이터 하나로 메모리 캐시를 구현할 수 있다.

```typescript
// 서비스 단의 가상 코드
private readonly cache$ = this.heavyTask$().pipe(
  shareReplay({ bufferSize: 1, refCount: false, windowTime: 60000 }) // 1분간 결과 공유 및 유지
);
```

- **shareReplay**: 첫 번째 요청이 들어오면 비즈니스 로직을 실행하고 결과를 저장해 둔다. 그 후 1분 이내의 다음 요청들은 저장된 결과를 즉시 반환한다. (메모리 내 초고속 캐시)

---

## 3. 중복 요청 제거: share()와 ConnectableObservable

동시에 100명이 같은 API를 호출한다면? DB 쿼리를 100번 날리는 대신, 단 한 번의 실행 결과를 100명에게 동시에 쏴주는(Multicasting) 전략이다.

- **`share()`**: 소스 스트림을 멀티캐스팅으로 전환하여 불필요한 중복 실행을 막는다. (Request Collapsing의 정수)
- **`switchMap()`**: 새로운 요청이 들어오면 이전의 취소 가능한 요청(예: 현재 진행 중인 API 호출)을 자동으로 취소하고 새 요청을 우선시할 수도 있다.

---

## 4. 스트림 기반의 캐시 갱신 (Cache Invalidation)

- **`merge(refreshEvent$, sourceData$)`**: 외부 이벤트(예: 유저 정보 수정 이벤트)가 발생했을 때만 캐시를 폐기하고 원본 데이터를 다시 가져오는 파이프라인을 구축할 수 있다.

---

## 요약

RxJS를 이용한 전문적인 설계는 시스템의 **가시성(Visibility)**과 **효율성(Efficiency)**을 동시에 달성한다.

- `tap`으로 비즈니스 로직과 로깅을 완벽하게 격리하자.
- `shareReplay`와 `share`로 메모리 자원과 실행 비용을 획기적으로 아끼자.
- 모든 인프라 기능을 스트림 오퍼레이터의 조합으로 해결하는 선언적 프로그래밍의 정수를 누리자.

이로써 RxJS와 비동기 데이터 스트림 테마의 모든 장정을 마쳤다. 다음 테마는 코드 생성을 자동화하고 엔지니어링 효율을 극대화하는 **스키마틱스(Schematics)와 CLI 확장**입니다.
