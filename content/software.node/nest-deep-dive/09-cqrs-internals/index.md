# CQRS Internals (CqrsModule 심층 분석)

비즈니스 로직의 복잡성을 해결하기 위한 CQRS(Command Query Responsibility Segregation) 패턴이 NestJS 내부에서 어떻게 구현되어 있는지 파헤칩니다.

## ✨ 왜(Why) 들여다봐야 하나요?

- 커맨드(Command)와 쿼리(Query)가 어떻게 적절한 핸들러를 찾아가는지 그 라우팅 메커니즘을 이해하기 위해.
- `ExplorerService`가 어떻게 우리 프로젝트의 수많은 핸들러를 자동으로 스캔하고 등록하는지 알기 위해.
- `Saga` — 여러 이벤트의 흐름을 하나의 시퀀스로 묶어주는 리액티브 오케스트레이션의 원리를 이해하기 위해.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **CommandBus & QueryBus**: 메시지를 받고 핸들러를 실행하는 중앙 허브.
- **ExplorerService**: 메타데이터를 스캔하여 핸들러를 찾아내는 스캐너 엔진.
- **EventPublisher**: 도개인 엔티티의 이벤트를 수집하고 배포하는 게시자.
- **Sagas**: 복잡한 비즈니스 워크플로우를 RxJS 스트림으로 관리하는 로직.

## 🛠 어떻게(How) 탐구하나요?

- `@nestjs/cqrs` 패키지의 `command-bus.js`, `explorer.service.js` 소스 코드 분석.
- 브라우저나 터미널에서 커맨드를 발행하고, 핸들러가 호출되는 스택 트레이스를 추적.
- `EventPublisher`를 상속받거나 가로채어 도메인 이벤트가 어떻게 누적되는지 확인.

---

## 📚 관련 아티클 목차

- [01. CqrsModule: CommandBus와 QueryBus의 내부 동작 원리](./bus-internals.md) (작성 예정)
- [02. ExplorerService: 핸들러를 자동으로 찾아 등록하는 메타데이터 스캔](./explorer-service.md) (작성 예정)
- [03. Sagas: 복잡한 이벤트 워크플로우와 상태 전이의 오케스트레이션](./sagas-internals.md) (작성 예정)
- [04. 실전: CQRS 아키텍처에서의 에러 핸들링과 트랜잭션 관리](./cqrs-patterns.md) (작성 예정)
