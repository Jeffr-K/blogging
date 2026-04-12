---
title: "NestJS Deep Dive: CommandBus와 QueryBus의 내부 동작 원리"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "cqrs", "command-bus", "query-bus", "internals"]
---

## 메시지의 우체국: CommandBus와 QueryBus

CQRS 패턴에서 모든 요청은 **커맨드(Command)** 또는 **쿼리(Query)**라는 메시지 객체에 담겨 전달된다. 그리고 이를 적절한 처리기(Handler)에게 배달해 주는 우체국 역할이 바로 **`CommandBus`**와 **`QueryBus`**다.

이번 아티클에서는 이 버스들이 어떻게 수많은 핸들러 중에서 해당 메시지를 처리할 대상을 런타임에 찾아내고 실행하는지 그 내부 메커니즘을 딥다이브해 본다.

---

## 1. 핸들러 레지스트리 (Handler Registry)

`CommandBus`와 `QueryBus`는 내부적으로 **맵(`Map`)**을 관리한다. 이 맵의 키는 **커맨드 클래스의 메타데이터**이고, 값은 그 커맨드를 처리할 **핸들러 인스턴스**다.

- **등록 시점**: 애플리케이션 시작 시, `ExplorerService`가 모든 핸들러를 찾아 이 맵에 등록한다.
- **조회 시점**: `bus.execute(command)`가 호출되면, 전달된 `command` 객체의 생성자(Constructor)를 통해 매핑된 핸들러를 맵에서 찾는다.

---

## 2. 딥다이브: execute() 메서드의 일대기

`commandBus.execute(command)`를 호출하면 내부적으로 다음과 같은 일이 벌어진다.

1. **커맨드 식별**: `command.constructor`를 통해 이 커맨드가 어떤 클래스인지 확인한다.
2. **핸들러 조회**: 미리 등록된 맵에서 해당 클래스에 대응하는 핸들러를 가져온다.
3. **실행(Reflect.apply)**: 핸들러의 `execute()` 메서드를 호출하며 커맨드를 전달한다.
4. **결과 반환**: 핸들러의 반환값(Promise)을 사용자에게 돌려준다.

---

## 3. Observable을 통한 흐름 제어

`CqrsModule`의 특징 중 하나는 모든 메시지 흐름이 **RxJS Observable**을 통해 관리된다는 점이다.

- **Subject**: `CommandBus`와 `QueryBus`는 내부적으로 `Subject`를 가지고 있어, 어떤 커맨드가 발행되었는지 스트림으로 관찰할 수 있다.
- **Global Interceptors**: 이 스트림을 가로채어 모든 커맨드의 실행 시간이나 성공 여부를 로깅할 수 있는 강력한 확장이 가능하다.

---

## 4. 유의사항: 1 대 1 매핑 원칙

NestJS CQRS 엔진은 기본적으로 **하나의 커맨드에는 하나의 핸들러**만 대응하도록 설계되어 있다.

- 만약 같은 커맨드에 대해 두 개의 핸들러를 등록하려고 하면, 나중에 등록된 것이 이전 것을 덮어쓰거나(Override) 경고를 발생시킨다.
- 이는 쿼리 또한 마찬가지다. 데이터의 상태 변화(Command)나 조회(Query)는 명확한 단일 책임(Single Responsibility)을 가져야 하기 때문이다.

---

## 요약

`CommandBus`와 `QueryBus`는 **메타데이터 기반의 라우팅 맵**을 사용하여 메시지를 배달한다.

- 클래스 생성자를 키로 사용하는 정교한 핸들러 매핑
- RxJS `Subject`를 통한 메시지 스트림 가시성 확보
- 단일 책임 원칙에 기반한 1:1 핸들러 관계 유지

이 내부 원리를 이해하면, 대규모 애플리케이션에서도 각 도메인 로직이 어떻게 격리되고 실행되는지 명확한 멘탈 모델(Mental Model)을 가질 수 있게 된다.

다음 아티클에서는 이러한 핸들러들을 자동으로 찾아내는 똑똑한 스캐너, **`ExplorerService`의 내부 동작**을 파헤쳐 본다.
