---
title: "NestJS Deep Dive: Scanner와 InstanceLoader의 내부 설계 분석"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "scanner", "instance-loader", "internals"]
---

## 의존성 주입(DI)의 핵심 엔진: Scanner와 InstanceLoader

지난 아티클에서 `NestFactory`의 부트스트래핑 과정을 개괄적으로 살펴보았다면, 이번에는 그 중에서도 NestJS의 지능(Intelligence)을 담당하는 두 핵심 클래스, **`DependenciesScanner`**와 **`InstanceLoader`**를 소스 코드 레벨에서 딥다이브해 본다.

이 두 클래스는 NestJS가 어떻게 우리의 코드를 분석하여 거대한 의존성 그래프를 그려내고, 싱글톤 패턴을 유지하며 인스턴스를 주입하는지 그 핵심 원리를 담고 있다.

---

## 1. DependenciesScanner: 설계도의 완성

`DependenciesScanner`는 애플리케이션의 정적 구조를 분석하는 탐험가와 같다. 루트 모듈(`AppModule`)에서 시작하여 모든 모듈의 관계를 훑는다.

### 핵심 역할: 모듈 등록과 의존성 매핑

1. **scanForModules**: `imports` 배열을 재귀적으로 탐색하여 모듈 리스트를 작성한다.
2. **scanModulesForDependencies**: 각 모듈의 `providers`, `controllers`, `exports`를 스캔한다.
3. **reflect-metadata 활용**: 클래스에 붙은 `@Module` 데코레이터에서 메타데이터를 추출하여 컨테이너에 저장한다.

### 소스 코드 레벨의 동작 추론

스캐너는 내부적으로 `Module` 클래스의 인스턴스를 생성하여 `NestContainer`에 담는다. 각 모듈 인스턴스는 다음과 같은 정보를 가진다.

- `id`: 모듈의 고유 식별자.
- `metatype`: 실제 클래스 정의.
- `providers`: 해당 모듈이 소유한 프로바이더 셋(Set).
- `relatedModules`: 이 모듈이 임포트한 다른 모듈 셋.

이 단계가 끝나면, NestJS는 "누가 누구를 필요로 하는지"에 대한 **정적 의존성 그래프**를 완성하게 된다.

---

## 2. InstanceLoader: 생명력의 불어넣기

설계도(Scanner의 결과물)가 준비되면, `InstanceLoader`가 등판하여 실제 메모리 상에 객체들을 생성하기 시작한다.

### 핵심 역할: 인스턴스화 전략

1. **loadPrototypes**: 각 프로라이더의 프로토타입(Prototype)을 컨테이너에 먼저 등록한다.
2. **loadInstances**: 실제 생성자(Constructor)를 호출하여 인스턴스를 만든다.
3. **재귀적 의존성 해결**: 특정 프로바이더를 만들 때 다른 프로바이더가 필요하면, 그 대상을 먼저 인스턴스화한다.

### 인스턴스화의 순서 (The Order of Creation)

`InstanceLoader`는 **상향식(Bottom-up)**으로 동작한다. 즉, 의존성이 없는 프로바이더를 먼저 만들고, 이를 주입받는 상위 프로바이더를 나중에 만든다.

---

## 3. 딥다이브: 왜 싱글톤(Singleton)인가?

NestJS의 기본 스코프는 싱글톤이다. 이는 `InstanceLoader`가 인스턴스를 생성할 때 **`NestContainer` 내의 캐시**를 확인하기 때문이다.

1. 특정 모듈에서 `UsersService`가 필요하다.
2. 컨테이너에 `UsersService`의 인스턴스가 이미 있는지 확인한다.
3. 있다면 기존 인스턴스를 반환하고, 없다면 새로 만들어 저장한다.

이 메커니즘 덕분에 모듈 시스템이 고도로 분리되어 있어도 같은 프로바이더를 여러 곳에서 공유할 수 있다. (단, `Request` 스코프일 경우 이 과정이 매 요청마다 일어나며 별도의 캐시 저장소를 사용한다.)

---

## 4. 메타데이터 스캐너 (MetadataScanner)

스캐너의 하위 도구인 `MetadataScanner`는 각 클래스의 메서드를 훑으며 `@Get()`, `@Post()`, `@Cron()` 등의 데코레이터를 찾아내는 역할을 한다.

이 도구는 나중에 **`DiscoveryService`**와 결합되어, 런타임에 특정 데코레이터가 붙은 모든 메서드를 찾아 로직을 실행하는 강력한 기능을 가능하게 한다.

---

## 요약

`DependenciesScanner`는 **"무엇이 있는가"**를 보고, `InstanceLoader`는 **"어떻게 만드는가"**를 결정한다.

이 두 엔진의 조화 덕분에 우리는 복잡한 클래스 간의 관계를 고민하지 않고도 `@Injectable()` 한 줄로 강력한 의존성 주입의 혜택을 누릴 수 있는 것이다.

다음 아티클에서는 이 우아한 그래프를 망가뜨리는 **순환 의존성(Circular Dependency)**이 왜 발생하며, `forwardRef`가 이를 어떻게 우회하는지 그 내부 동작 원리를 살펴본다.
