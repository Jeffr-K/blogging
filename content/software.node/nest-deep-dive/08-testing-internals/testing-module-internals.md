---
title: "NestJS Deep Dive: TestingModule의 내부 모킹 메커니즘 분석"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "testing", "testing-module", "mocking", "internals"]
---

## 가상 세계의 창조: TestingModule

유닛 테스트와 통합 테스트는 가짜 환경(Mocking Environment)에서 안정적으로 돌아가야 한다. 이를 위해 NestJS는 실제 애플리케이션의 컨테이너를 완벽하게 흉내 내는 **`TestingModule`**이라는 강력한 도구를 제공한다.

단순히 `new UsersService(mockRepo)`로 수동 생성하는 것과 `Test.createTestingModule()`을 사용하는 것은 어떤 내부적인 차이가 있을까? 이번 아티클에서는 `TestingModule`이 어떻게 의존성을 모킹하고 메타데이터를 재정의하는지 그 내부 로직을 딥다이브해 본다.

---

## 1. Test 클래스: 컨테이너의 복제본

`Test.createTestingModule()`을 호출하면 `NestContainer`의 새로운 인스턴스가 생성된다.

- **Isolation (격리)**: 실제 애플리케이션과는 완전히 별개의 컨테이너 메모리 공간을 소유한다.
- **Metadata Copy**: 우리가 넘겨준 모듈의 메타데이터를 복제하여, 테스트 전용 `Scanner`가 이를 다시 훑어 정적 설계를 완료한다.

---

## 2. 딥다이브: 컴파일(compile) 단계의 의미

테스트 설정 후에 부르는 `await module.compile()` 메서드는 사실상 `NestFactory.create()`의 부트스트래핑 과정과 동일하다.

- **InstanceLoading**: 모킹되지 않은 실제 프로바이더들을 인스턴스화한다.
- **Dependency Resolution**: 이 과정에서 주입에 필요한 모든 의존성이 채워졌는지 검증한다.
- **Lifecycle Initiation**: `OnModuleInit` 훅을 실행할 준비를 마친다. (단, 실제 실행은 `module.init()`을 별도로 호출해야 함)

---

## 3. 리소스 최적화: 팩토리 프로바이더의 모킹

`TestingModule`은 내부적으로 모든 프로바이더를 **`useFactory`** 형태의 커스텀 프로바이더로 변환하여 관리할 수 있는 유연성을 가진다.

- **캐싱(Caching)**: 한 번 컴파일된 `TestingModule`은 메모리에 캐싱되지만, 각 테스트(`it`, `test`)마다 초기화된 상태를 유지하고 싶다면 `createTestingModule`을 반복적으로 호출해야 한다.

---

## 4. 실전 가이드: NestLogger와 테스팅

테스트 실행 시 콘솔에 쏟아지는 지저분한 로그를 끄고 싶다면?

- **`setLogger(new NoOpLogger())`**: `TestingModule`은 실제 애플리케이션과 마찬가지로 전역 로거를 교체할 수 있는 인터페이스를 제공한다. 내부적으로 `NestApplicationContext`의 로거 속성을 덮어씌움으로써 테스트 결과를 깔끔하게 유지할 수 있다.

---

## 요약

`TestingModule`은 **"테스트를 위한 소우주"**와 같다.

- 실제 컨테이너의 모든 로직(DI, 가드, 인터셉터)을 그대로 사용하면서
- 특정 부품(Provider)만 마음껏 교체(Mocking)할 수 있는 완벽한 상위 집합이다.
- `compile()` 단계를 이해함으로써 테스트 부팅 오버헤드를 제어하자.

이 내부 구조를 이해하면, 단순히 코드가 돌아가게 만드는 테스트가 아니라, 프로덕션 환경의 복잡한 의존성 관계를 완벽하게 모사하는 고품질 테스트 코드를 작성할 수 있게 된다.

다음 아티클에서는 이러한 `TestingModule`의 가장 강력한 기능인 **`overrideProvider`가 의존성을 가로채는 정교한 훅 전략**을 딥다이브해 본다.
