# NestJS Deep Dive: 프레임워크의 심장부로

NestJS를 단순히 '사용'하는 단계를 넘어 **'딥다이브(Deep Dive)'**한다는 것은, 프레임워크가 제공하는 추상화 레이어 아래에서 실제로 어떤 일이 벌어지는지 이해하고, 그 메커니즘을 제어할 수 있는 수준에 도달하는 것을 의미합니다.

---

## 1. [제어의 역전(IoC)과 의존성 주입의 내부](./01-ioc-internals/index.md)

- `NestFactory`의 부트스트래핑 과정 분석
- `@Module` 데코레이터 메타데이터 처리 방식
- `InstanceLoader`와 `Scanner`의 모듈 그래프 생성 원리

## 2. [메타데이터와 리플렉션 (Metadata & Reflection)](./02-metadata-reflection/index.md)

- `reflect-metadata` 라이브러리의 역할과 동작 방식
- 커스텀 데코레이터 제작 및 메타데이터 주입
- `Reflector`와 `DiscoveryService` 활용 전략

## 3. [요청 생명주기(Request Lifecycle)의 정밀 분석](./03-request-lifecycle/index.md)

- `ExecutionContext`와 `ArgumentsHost` 추상화 이해
- 가드, 인터셉터, 파이프의 내부 동작 순서와 스택 처리
- [Pipe 시스템의 내부 구조와 동작 원리](./03-request-lifecycle/internal-of-pipe-system.md)

## 4. [마이크로서비스 내부 (Microservices Internals)](./04-microservices/index.md)

- 마이크로서비스 엔진의 추상화 인터페이스 (`CustomTransportStrategy`)
- 요청-응답 vs 이벤트 기반 통신의 패킷 구조 분석
- 커스텀 트랜스포터 직접 구현 및 연동

## 5. [RxJS와 비동기 데이터 스트림](./05-rxjs-streams/index.md)

- NestJS 내부의 리액티브 데이터 흐름 처리 원리
- 인터셉터에서의 복잡한 스트림 조작 (Timeout, Retry, Cache)
- 배압(Backpressure) 관리와 에러 전파 제어

## 6. [스키마틱스(Schematics)와 CLI 확장](./06-schematics-cli/index.md)

- `nest-cli` 커스텀 스키마틱스 제작 및 자동화
- AST(Abstract Syntax Tree) 조작을 통한 코드 주입 기법
- 프로젝트 템플릿 코드 생성기 구축

## 7. [성능 최적화와 메모리 프로파일링](./07-performance-profiling/index.md)

- 데코레이터와 DI 컨테이너의 런타임 성능 오버헤드 측정
- 싱글톤 vs 리퀘스트 스코프의 메모리 및 GC 영향 분석
- `Fastify` 어댑터 전환 및 최적화 포인트

## 8. [내부 테스팅 전략 (Testing Internals)](./08-testing-internals/index.md)

- `TestingModule`의 내부 모킹 및 프로바이더 교체 메커니즘
- `NestContainer` 수동 제어와 테스트 환경 구축
- 외부 의존성 격리 및 통합 테스트 최적화 패턴

## 9. [CQRS Internals (CqrsModule 심층 분석)](./09-cqrs-internals/index.md)

- `CommandBus`, `QueryBus`, `EventBus`의 메시지 라우팅 원리
- `ExplorerService`의 핸들러 자동 등록 메커니즘
- `Sagas`를 이용한 복잡한 이벤트 스트림 오케스트레이션

---

딥다이브는 **"프레임워크가 마법처럼 처리해주던 일들을 명확한 엔지니어링 지식으로 전환하는 과정"**입니다. 이 과정을 거치면 예기치 못한 에러에 직면했을 때 프레임워크의 소스 코드를 읽으며 해결책을 찾을 수 있는 능력을 갖추게 됩니다.
