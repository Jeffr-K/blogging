# Request Lifecycle Deep Dive (요청 생명주기: 요청부터 응답까지의 여정)

NestJS는 요청이 들어온 순간부터 응답이 나갈 때까지 아주 정교한 단계별 파이프라인을 거칩니다. 이 섹션은 이 과정에서 각 단계가 언제, 어떻게, 그리고 어떤 가시성을 가지고 실행되는지 파헤칩니다.

## ✨ 왜(Why) 들여다봐야 하나요?

- "왜 내 가드가 다른 인터셉터보다 먼저 실행될까?" 라는 질문을 명확하게 해결하기 위해.
- 파이프, 인터셉터, 필터가 서로 어떤 데이터를 공유하고, 어떤 계층에서 동작하는지 이해하기 위해.
- 성능 최적화: 어떤 작업을 어느 단계에서 처리하는 것이 가장 효율적인지 판단하기 위해.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **Execution Order**: Middleware → Guard → Interceptor → Pipe → Handler → Interceptor → Filter.
- **ExecutionContext & ArgumentsHost**: 요청 컨텍스트를 프로토콜에 무관하게 추상화하는 그릇들.
- **Context Creator**: NestJS가 각 단계의 콘텍스트를 어떻게 미리 생성하고 캐싱하는지.
- **PipesConsumer**: 실제 파이프가 런타임에 인토 데이터 정보를 받아 주입하는 과정.

## 🛠 어떻게(How) 탐구하나요?

- `PipesContextCreator`, `GuardsContextCreator` 등의 내부 클래스 소스 코드 리뷰.
- 모든 단계에 로깅을 추가하여 실제 로그가 찍히는 순서를 HTTP/Microservice 프로토콜별로 비교.
- 전역 설정과 메서드 레벨 설정이 런타임에 병합(merge)되는 우선순위 알고리즘 추론.

---

## 📚 관련 아티클 목차

- [01. NestJS 요청 파이프라인의 핵심: ExecutionContext와 ArgumentsHost](./execution-context.md) (작성 예정)
- [02. Pipe 시스템의 내부 구조와 동작 원리 (Internal of Pipe System)](./internal-of-pipe-system.md) (이전 포스트 마이그레이션)
- [03. Guard와 Interceptor의 실행 순서와 우선순위는 어떻게 결정되는가?](./guards-interceptors-order.md) (작성 예정)
- [04. Exception Filter의 전역 및 커스텀 에러 핸들링 메커니즘 분석](./exception-filters-internals.md) (작성 예정)
