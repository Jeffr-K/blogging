---
title: "NestJS Deep Dive: NestFactory의 부트스트래핑 과정 분석"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "bootstrapping", "nest-factory"]
---

## 애플리케이션 시작의 시작: NestFactory.create()

모든 NestJS 애플리케이션은 `main.ts` 파일의 단 한 줄, `NestFactory.create(AppModule)`에서 시작된다. 겉보기에는 단순히 애플리케이션 인스턴스를 하나 만드는 것처럼 보이지만, 이 코드 아래에서는 프레임워크의 모든 정수가 담긴 **부트스트래핑(Bootstrapping)** 과정이 격렬하게 일어난다.

이 아티클에서는 `NestFactory`가 실행된 후 애플리케이션이 요청을 받을 준비가 될 때까지, 내부 플랫폼에서 어떤 일들이 벌어지는지 소스 코드 레벨에서 추적해 본다.

---

## 1. 초기화 단계: NestApplicationContext와 NestContainer

`NestFactory.create()`가 호출되면 가장 먼저 일어나는 일은 **`NestContainer`**의 생성이다.

### NestContainer: 모든 정보의 저장소

`NestContainer`는 애플리케이션 전체에서 단 하나만 존재하는 싱글톤 객체로, 모든 모듈, 프로바이더, 컨트롤러의 메타데이터와 실제 인스턴스들을 관리하는 **중앙 레지스트리**다.

```typescript
// NestFactory 클래스 내부 추론 코드
public static async create(module: any, options?: any) {
  const container = new NestContainer(); // 1. 컨테이너 생성
  const application = new NestApplication(container, options); // 2. 애플리케이션 래퍼 생성
  
  await this.initialize(module, container, application); // 3. 부트스트래핑 시작
  return application;
}
```

이 단계에서 NestJS는 우리가 넘겨준 `AppModule`을 루트(Root)로 설정하고, 본격적인 프로젝트 스캔을 준비한다.

---

## 2. 스캔 단계 (Dependencies Scanning)

루트 모듈이 정해지면 `DependenciesScanner`가 등판한다. 이 클래스는 재귀적으로 모든 모듈을 훑으며 그래프를 그린다.

1. **모듈 스캔**: `AppModule`에서 시작해 `imports` 배열에 담긴 모든 모듈을 찾는다.
2. **컴포넌트 스캔**: 각 모듈 내의 `providers`, `controllers`, `injectables`를 찾아 `NestContainer`에 등록한다.
3. **메타데이터 추출**: 이때 `reflect-metadata`를 사용하여 우리가 클래스에 붙인 `@Injectable()`, `@Controller()` 등의 정보를 읽어온다.

이 과정이 끝나면 `NestContainer` 안에는 아직 인스턴스화되지 않은 **'설계도(Definition)'**들이 가득 차게 된다.

---

## 3. 로드 단계 (Instance Loading)

설계도가 완성되었으니 이제 실제 객체를 만들 차례다. 이 역할은 **`InstanceLoader`**가 담당한다.

1. **프로토타입 생성**: 각 프로바이더의 생성자(Constructor)와 의존성 정보를 파악한다.
2. **의존성 해결 (Dependency Resolution)**: 주입받아야 할 다른 프로바이더가 이미 인스턴스화되어 있는지 확인한다.
3. **인스턴스 생성**: 만약 주입받을 대상이 아직 없다면, 그 대상부터 먼저 생성한다(재귀적 호출).

이 단계에서 **순환 의존성(Circular Dependency)**이 발견되면 에러가 발생한다. `InstanceLoader`가 A를 만들려고 보니 B가 필요하고, B를 만들려고 하니 다시 A가 필요한 상황을 감지하기 때문이다. (`forwardRef`는 이 시점에서 주입을 지연시켜 에러를 회피한다.)

---

## 4. 라이프사이클 훅 실행 (Lifecycle Hooks)

모든 인스턴스가 생성되고 의존성 주입이 완료되면, NestJS는 등록된 모든 컴포넌트의 라이프사이클 훅을 호출한다.

- **OnModuleInit**: 각 모듈의 초기화 로직을 수행한다.
- **OnApplicationBootstrap**: 애플리케이션이 완전히 준비되어 요청을 받기 직전에 호출된다.

이 훅들은 `Promise`를 반환할 수 있으며, 모든 훅이 완료될 때까지 애플리케이션 시작은 대기 상태가 된다.

---

## 5. 플랫폼 어댑터 연결 (HTTP/Microservices)

마지막으로 NestJS는 선택된 플랫폼 어댑터(Express 또는 Fastify)를 초기화하고 HTTP 서버를 구동한다.

- `NestApplication` 클래스는 내부적으로 `httpServer`를 관리하며, 요청이 들어오면 `RoutesResolver`를 통해 적절한 컨트롤러로 라우팅을 시작한다.
- 이 시점부터 비로소 우리는 `app.listen(3000)`과 같은 코드로 실제 서비스를 시작할 수 있다.

---

## 요약

NestJS의 부트스트래핑은 단순히 객체를 만드는 과정이 아니라, **컨테이너화(Containerization) -> 스캔(Scanning) -> 의존성 해결(Resolution) -> 인스턴스화(Instantiation)**라는 고도로 구조화된 단계를 거친다.

이 과정을 이해하면 "왜 내 코드가 다른 코드보다 늦게 실행되는지", "왜 특정 모듈은 전역적으로 접근 가능한지"에 대한 명확한 기술적 근거를 가질 수 있다.

이어지는 아티클에서는 이 과정의 핵심 엔진인 **Scanner**와 **InstanceLoader**의 내부 소스 코드를 더 자세히 분석해 본다.
