---
title: "NestJS Deep Dive: Custom Providers의 고급 패턴과 주입 전략"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "custom-providers", "di", "internals"]
---

## 단순한 주입을 넘어: Custom Providers

NestJS의 의존성 주입(DI)이 얼마나 유연한지 보여주는 가장 강력한 도구가 바로 **Custom Provider**다.

단순히 클래스 이름만 등록하는 `@Injectable()` 방식을 넘어, `useValue`, `useClass`, `useFactory`, `useExisting` 등 4가지 전략을 통해 우리는 라이브러리 연동, 비동기 초기화, 테스트 모킹 등 다양한 시나리오를 완벽하게 제어할 수 있다.

이번 아티클에서는 각 전략이 NestJS 컨테이너 내부에서 어떻게 다르게 관리되는지 그 핵심을 딥다이브해 본다.

---

## 1. 4가지 주입 전략의 내부적 차이

### useValue (값 주입)

가장 단순한 형태다. 컨테이너는 이 값을 **이미 존재하는 결과물**로 취급한다.

- **내부**: `NestContainer`는 이 프로바이더를 위해 새로운 클래스 인스턴스를 만들지 않고, 그저 맵(`Map`)에 키와 값을 매핑해 둔다.
- **용도**: 외부 라이브러리(Axios, Redis Client 등)나 설정 값 객체 주입.

### useClass (클래스 주입)

클래스의 **지연된(Lazy) 인스턴스화**를 가능케 한다.

- **내부**: `InstanceLoader`가 이 클래스의 생성자를 호출하여 인스턴스를 만든다.
- **용도**: 환경(Production vs Dev)에 따라 다른 구현체를 주입할 때 유용하다. (인터페이스 기반 설계의 핵심)

### useFactory (팩토리 주입)

가장 유연하고 강력한 전략이다. **함수 실행 결과**를 컨테이너에 등록한다.

- **내부**: `instance-loader`는 이 함수를 실행하고 그 반환값을 비로소 '인스턴스'로 등록한다.
- **비동기 지원**: 함수의 반환값이 `Promise`라면, NestJS는 이 `Promise`가 해결(Resolve)될 때까지 애플리케이션 시작을 대기시킨다. 이것이 **Asynchronous Providers**의 핵심이다.

### useExisting (별칭 주입)

이미 등록된 다른 프로바이더의 **별칭(Alias)**을 만든다.

- **내부**: 새로운 인스턴스를 만들지 않고, 이미 존재하는 인스턴스에 대한 참조(Reference)만 연결한다.
- **용도**: 순환 의존성 우회 또는 리팩토링 시의 호환성 유지.

---

## 2. 딥다이브: 정적 주입 vs 동적 주입

### 정적 주입 (Static Injection)

일반적인 `@Injectable()` 클래스 주입이다. 애플리케이션 시작 시점에 `Scanner`가 모든 메타데이터를 이미 고정해 둔 상태에서 일어난다.

### 동적 주입 (Dynamic Injection)

`useFactory`와 같이 **실행 시점에 결정**되는 주입이다.

- 팩토리 함수 내에서 다른 프로바이더를 주입받을 수 있다 (`inject` 배열 활용).
- 비동기 팩토리를 통해 DB 커넥션이 완료된 후에야 서비스를 주입 가능하게 할 수 있다.

---

## 3. 컨테이너 내부의 프로바이더 타입 (Provider Types)

NestJS 소스 코드 내부에서는 프로바이더가 크게 3가지 타입으로 관리된다.

1. **ClassProvider**: `useClass`
2. **ValueProvider**: `useValue`
3. **FactoryProvider**: `useFactory`

`InstanceLoader`는 루프를 돌며 각 타입에 맞는 생성 로직을 수행한다. `ValueProvider`라면 즉시 반환하고, `FactoryProvider`라면 인자로 전달된 다른 프로바이더들을 먼저 찾아 `inject`에 채워 넣은 뒤 함수를 실행하는 정교한 순서 제어가 일어난다.

---

## 4. 유의사항: 프로바이더 스코프와 성능

커스텀 프로바이더를 정의할 때 `scope` 속성을 정의할 수 있다.

- **DEFAULT (Singleton)**: 컨테이너 전체에서 단 하나. (권장)
- **REQUEST**: 매 요청마다 새로 생성. (성능 주의)
- **TRANSIENT**: 주입되는 곳마다 새로 생성.

특히 `useFactory`를 `REQUEST` 스코프로 만들면, 요청이 들어올 때마다 함수가 실행되므로 무거운 연산은 피해야 한다.

---

## 요약

Custom Providers는 NestJS가 단순한 웹 프레임워크를 넘어 **강력한 의존성 관리 도구**임을 증명한다.

네 가지 전략의 내부 동작 원리를 이해하면, 외부 라이브러리를 우아하게 통합하고 비동기 초기화 문제를 해결하며, 테스트하기 쉬운 견고한 시스템을 설계할 수 있는 진정한 전문가의 길로 들어서게 된다.

지금까지 NestJS의 심장부인 **IoC & DI** 테마를 4개의 아티클을 통해 완벽하게 정복했다. 다음 딥다이브 테마는 데코레이터와 타입 마법의 원천인 **Metadata & Reflection**이다.
