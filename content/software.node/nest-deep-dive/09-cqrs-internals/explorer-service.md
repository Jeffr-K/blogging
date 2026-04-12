---
title: "NestJS Deep Dive: ExplorerService를 이용한 핸들러 자동 스캔 전략"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "cqrs", "explorer-service", "metadata", "internals"]
---

## 핸들러들의 탐정: ExplorerService

우리가 만든 `@CommandHandler(MyCommand)` 데코레이터가 붙은 클래스들은 어떻게 자동으로 `CommandBus`에 등록될까? 일일이 서비스를 소스 코드에서 연결하는 보일러플레이트를 줄여주는 마법의 주인공이 바로 **`ExplorerService`**다.

이번 아티클에서는 `ExplorerService`가 애플리케이션 시작 시점에 어떻게 모든 모듈을 훑으며 우리가 선언한 CQRS 구성 요소들을 찾아내는지 그 내부 스캔 전략을 딥다이브해 본다.

---

## 1. ExplorerService란 무엇인가?

`ExplorerService`는 `@nestjs/cqrs` 모듈이 초기화될 때 함께 생성되는 내부 도구다.

- **역할**: NestJS의 전역 컨테이너(`NestContainer`)를 훑으면서 특정 데코레이터 메타데이터가 붙은 프로바이더를 수집한다.
- **언제?**: 모듈의 `onModuleInit` 단계에서 모든 스캔을 완료한다.

---

## 2. 딥다이브: 스캔 알고리즘

`ExplorerService`의 동작은 크게 세 단계로 나뉜다.

1. **getModules()**: `NestContainer`로부터 현재 로드된 모든 모듈 목록을 가져온다.
2. **filterProviders()**: 각 모듈 내의 프로바이더들 중 **타입 스캐너(TypeScanner)**를 활용하여 특정 데코레이터가 붙었는지 검사한다.
    - `@CommandHandler`
    - `@QueryHandler`
    - `@EventHandler`
    - `@Saga`
3. **registerHanders()**: 발견된 핸들러들을 각 버스(`CommandBus`, `QueryBus`, `EventBus`)에 등록한다.

### 메타데이터의 활용

데코레이터 `@CommandHandler(MyCommand)`는 내부적으로 **`COMMAND_HANDLER_METADATA`** 키 아래에 `MyCommand` 클래스 정보를 저장해 둔다. `ExplorerService`는 이 키를 런타임에 찾아서 "아, 이 핸들러는 `MyCommand`를 처리하는 녀석이구나!"라고 판단하게 된다.

---

## 3. 실전 활용: 커스텀 스캐너 제작 영감

`ExplorerService`의 소스 코드를 보면, 우리가 이전에 배운 **`DiscoveryService`**와 **`MetadataScanner`**를 어떻게 조화롭게 사용하여 고수준의 도구를 만드는지 그 정석을 볼 수 있다.

이 방식을 응용하면, 우리 회사 프로젝트만의 커스텀 데코레이터를 만들고 이를 자동으로 찾아 로직을 실행하는 **'자체 탐색 엔진'**을 모듈마다 구축할 수 있는 시각이 생긴다.

---

## 요약

`ExplorerService`는 **리플렉션(Reflection)**과 **메타데이터(Metadata)**를 활용하여 명시적인 코드 연결 없이도 시스템을 유연하게 결합(Loose Coupling)시키는 핵심 도구다.

- 컨테이너 전수 조사를 통한 핸들러 자동 감지
- 데코레이터에 숨겨진 메타데이터를 기반으로 한 지능형 라우팅 매핑
- 선언적 프로그래밍의 정수 실현

이 지식을 바탕으로 대규모 프로젝트에서 핸들러가 수백 개로 늘어나더라도, 프레임워크가 이를 어떻게 효율적으로 관리하는지 신뢰할 수 있게 된다.

다음 아티클에서는 이러한 메시지 흐름을 복잡한 비즈니스 시나리오로 연결해 주는 강력한 오케스트레이터, **`Sagas`의 내부 메커니즘**을 파헤쳐 본다.
