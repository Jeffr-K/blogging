---
title: "NestJS Deep Dive: 인터셉터와 RxJS의 응답 조작 메커니즘"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "rxjs", "interceptors", "internals"]
---

## 인터셉터의 정수: Observable의 가로채기

NestJS 인터셉터(Interceptor)가 `ExecutionContext`와 함께 받는 `CallHandler`는 딱 하나의 메서드를 가지고 있다: `handle()`. 그리고 이 메서드는 **`Observable`**을 반환한다.

왜 NestJS는 단순한 `Promise`가 아닌 `Observable`을 선택했을까? 그 이유는 `Observable`이 요청과 응답 사이의 **데이터 스트림을 런타임에 마음껏 가공**할 수 있는 강력한 연산자(Operators)들을 제공하기 때문이다. 이번 아티클에서는 인터셉터와 RxJS가 결합하여 어떻게 응답 데이터를 변환하고 관리하는지 딥다이브해 본다.

---

## 1. CallHandler.handle()의 정체

`handle()`이 호출되는 순간은 실제 라우터 핸들러(Controller 메서드)가 호출되는 지점이다. 하지만 인터셉터는 핸들러의 실행 결과가 나오기 전과 후에 모두 개입할 수 있다.

```typescript
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  console.log('Before...'); // 1. 핸들러 실행 전 (Pre-handler)

  return next.handle().pipe(
    tap(() => console.log('After...')), // 2. 핸들러 실행 후 (Post-handler)
  );
}
```

---

## 2. 응답 데이터의 변환: map() 오퍼레이터

모든 API 응답을 일관된 포맷(`{ data: Result }`)으로 감싸고 싶을 때 `map()`을 사용한다.

- **내부 원리**: 핸들러가 반환한 값은 `Observable` 스트림의 단일 아이템으로 흐른다. `map()` 오퍼레이터는 이 아이템을 가로채어 우리가 정의한 새로운 객체로 변환하여 다음 스트림으로 흘려보낸다.

---

## 3. 부수 효과 처리: tap()과 catchError()

- **tap()**: 스트림의 데이터 자체는 건드리지 않으면서, 로깅이나 외부 캐시 갱신 같은 부수 효과(Side-effect)를 실행할 때 최적이다.
- **catchError()**: 핸들러에서 에러가 발생했을 때 이를 가로채어 다른 값으로 대체하거나, 커스텀 예외를 새로 던질 수 있게 해준다. (단, 실제 에러 전파는 예외 필터에서 담당하는 경우가 많다.)

---

## 4. 스트림의 생명주기: Cold vs Hot 스캔

NestJS 인터셉터가 받는 `Observable`은 기본적으로 **Cold Observable**이다. 즉, 누군가 구독(`subscribe`)하기 전까지는 실제 핸들러가 실행되지 않는다.

- NestJS 프레임워크 내부 엔진이 파이프라인의 마지막 단계에서 이 스트림을 `subscribe()` 하거나 `Promise`로 변환(`lastValueFrom`)하는 순간에 비로소 컨트롤러의 비즈니스 로직이 가동된다.
- 이 지연 실행(Lazy Execution) 덕분에 인터셉터는 핸들러 실행 자체를 취소하거나, 일정 시간 후 재시도하는 고차원적인 제어가 가능해진다.

---

## 요약

인터셉터에서 RxJS를 사용한다는 것은 **"응답이라는 결과물"**이 아니라 **"응답으로 가는 과정"**을 통제한다는 의미다.

- `handle()`이 반환하는 스트림의 지연 실행 특성을 이해하자.
- `map`, `tap`, `catchError` 등 핵심 오퍼레이터를 통해 선언적으로 응답을 가공하자.
- 일관된 응답 구조를 코드 한 줄로 강제할 수 있는 인터셉터 아키텍처를 구축하자.

이 지식을 바탕으로, 단순히 데이터를 돌려주는 서버를 넘어 시스템의 모든 응답 흐름을 정교하게 제어하는 리액티브 백엔드를 설계할 수 있게 된다.

다음 아티클에서는 컨트롤러 자체를 RxJS 스트림으로 설계하여 복잡한 비동기 로직을 단순화하는 **리액티브 컨트롤러 설계 전략**을 탐구해 본다.
