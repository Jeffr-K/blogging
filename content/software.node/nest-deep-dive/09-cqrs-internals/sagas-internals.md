---
title: "NestJS Deep Dive: Sagas 내부 메커니즘과 비즈니스 워크플로우 분석"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "cqrs", "sagas", "rxjs", "internals"]
---

## 이벤트의 지휘자: Sagas

CQRS 환경에서는 모든 동작이 이벤트를 남긴다. 그런데 "사용자 가입 이벤트(`UserCreatedEvent`)가 발생하면, 환영 이메일을 보내고(`SendEmailCommand`), 동시에 무료 포인트 충전(`ChargePointCommand`)을 실행하라"는 복잡한 비즈니스 시퀀스는 도대체 어디서 관리해야 할까?

이 **이벤트 스트림의 흐름(Flow)**을 관찰하고 적절한 후속 커맨드를 발행하는 지휘자 역할을 수행하는 것이 바로 **`Sagas`**다. 이번 아티클에서는 `Sagas`가 RxJS `Observable`을 기반으로 어떻게 이벤트를 실시간 모니터링하고 가공하는지 그 내부를 딥다이브해 본다.

---

## 1. Sagas란 무엇인가?

`Saga`는 하나의 메서드다. 이 메서드는 **이벤트 스트림(`Observable<Event>`)**을 인자로 받고, **커맨드 스트림(`Observable<Command>`)**을 반환한다.

```typescript
@Saga()
userCreated = (events$: Observable<any>): Observable<ICommand> => {
  return events$.pipe(
    ofType(UserCreatedEvent), // 1. 특정 이벤트를 필터링한다.
    map((event) => new SendEmailCommand(event.userId)), // 2. 새로운 커맨드로 매핑한다.
  );
}
```

---

## 2. 딥다이브: ExplorerService와 Sagas의 만남

어떻게 `@Saga()` 데코레이터가 붙은 메서드가 자동으로 작동하기 시작할까?

1. **Scanner**: `ExplorerService`가 모든 프로젝트 내의 `@Saga()`를 찾아낸다.
2. **Event Stream 관찰**: 각 사가 메서드를 실행하여 반환된 `Observable`을 가져온다.
3. **CommandBus에 연결**: 사가가 뱉어내는 커맨드들을 자동으로 구독(`subscribe`)하여 `CommandBus.execute()`로 전달한다.

이것이 **이벤트가 발생하면 사가가 반응하고, 사가가 커맨드를 내보내면 버스가 이를 실행하는** 선순환 구조의 내부 원리다.

---

## 3. RxJS의 강력한 기능 활용

사가의 진정한 힘은 RxJS 오퍼레이터를 사용해 복잡한 비즈니스 요건을 한 줄로 표현할 때 나타난다.

- **`delay()`**: 특정 이벤트 발생 1시간 후에 후속 작업 실행.
- **`mergeMap()` / `switchMap()`**: 여러 비동기 작업을 병렬 또는 최신 상태 위주로 처리.
- **`bufferTime()`**: 이벤트들을 모았다가 배치(Batch) 커맨드로 한 번에 발행.

이 모든 것이 `Observable` 기반의 사가 시스템 덕분에 가능하다.

---

## 4. 분산 트랜잭션의 대안: 보상 트랜잭션 (Compensating Transactions)

사가 패턴의 핵심 용도 중 하나는 분산 시스템의 데이터 일관성이다.

1. `Step A` 실행 성공
2. `Step B` 실행 실패!
3. 사가가 이를 감지하고 `Cancel Step A` 커맨드를 발행하여 원복(Rollback) 수행.

이 **'상태 전이(State Transition)'**를 하나의 코드 흐름으로 관리할 수 있다는 점이 사가가 주는 가장 큰 아키텍처적 가치다.

---

## 요약

`Sagas`는 **RxJS의 스트림 처리 능력**과 **NestJS CQRS 엔진**을 완벽하게 결합한 정교한 도구다.

- 무상태(Stateless)인 이벤트와 상태 변화(Command)를 이어주는 연결고리
- ExplorerService를 통한 자동 구독 및 버스 연동 메커니즘
- 복잡한 비즈니스 워크플로우를 선언적으로 표현하는 능력

사가의 내부를 이해하면, 단순히 기능을 붙이는 것을 넘어 시스템 전체의 **'데이터 흐름(Data Flow)'**을 설계하고 제어할 수 있는 시야를 갖게 된다.

다음 아티클에서는 이러한 모든 CQRS 구성 요소를 실전에 적용할 때 반드시 고려해야 할 **에러 핸들링과 트랜잭션 관리 전략**을 딥다이브하며 이 테마를 마무리한다.
