# IoC & DI Internals (제어의 역전과 의존성 주입의 심장부)

NestJS의 가장 강력한 기능인 의존성 주입(DI)이 실제로 어떻게 동작하는지, 프레임워크 런타임이 어떻게 클래스를 찾아내고 인스턴스를 관리하는지 깊이 있게 탐구합니다.

## ✨ 왜(Why) 들여다봐야 하나요?

- "왜 내 서비스가 주입되지 않지?"라는 질문에 '그냥' 대신 '메커니즘'으로 대답하기 위해.
- 순환 의존성(Circular Dependency)이 발생하는 근본 원인과 `forwardRef`의 동작 원리를 이해하기 위해.
- 커스텀 프로바이더(`useFactory`, `useValue`)를 통해 프레임워크를 제어하기 위해.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **Bootstrapping**: `NestFactory.create()`에서 시작하여 모든 모듈을 스캔하는 과정.
- **InstanceLoader**: 프로바이더 인스턴스를 하나씩 생성하고 주입하는 엔진.
- **Dependency Graph**: 모듈 간의 관계를 트리 구조로 관리하는 내부 알고리즘.
- **Provider Scopes**: `Singleton`, `Request`, `Transient`에 따른 인스턴스 생명주기 관리.

## 🛠 어떻게(How) 탐구하나요?

- `node_modules/@nestjs/core` 내의 `scanner.js`, `instance-loader.js` 소스 코드 분석.
- `--debug` 모드에서 NestJS 전역 로깅을 통해 인스턴스화 순서 추적.
- `NestContainer`를 직접 수동으로 조작하는 실험적 코드 작성.

---

## 📚 관련 아티클 목차

- [01. NestFactory의 프로젝트 부트스트래핑 과정 분석](./bootstrapping-process.md) (작성 예정)
- [02. Scanner와 InstanceLoader: 모듈 그래프를 그리는 원리](./scanner-and-loader.md) (작성 예정)
- [03. forwardRef는 어떻게 순환 참조를 끊어내는가?](./forward-ref-internals.md) (작성 예정)
- [04. Custom Providers의 고급 패턴과 정적/동적 주입의 차이](./custom-providers.md) (작성 예정)
