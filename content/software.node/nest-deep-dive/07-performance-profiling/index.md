# Performance & Profiling (성능과 프로파일링: 런타임의 최적화)

NestJS는 고도로 추상화된 프레임워크입니다. 이 섹션은 이 추상화 레이어가 실제로 런타임에서 어떤 성능 비용을 발생시키는지, 우리가 어떻게 이를 측정하고 최적화할 수 있는지 다룹니다.

## ✨ 왜(Why) 들여다봐야 하나요?

- 사용자가 늘어나면서 발생하는 성능 병목 지점을 정확히 찾아내고 해결하기 위해.
- 데코레이터와 DI 컨테이너가 런타임 메모리에 미치는 영향을 이해하기 위해.
- Fastify 등 다른 어댑터로 전환할 때의 성능 이점과 부작용을 명확히 판단하기 위해.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **Request Lifecycle Overhead**: 가드, 인터셉터, 파이프 매 단계가 미치는 응답 시간(Latency).
- **Memory Consumption**: 싱글톤 vs 리퀘스트 스코프 인스턴스 생성 전략과 가비지 컬렉션 영향.
- **Fastify vs Express**: 두 어댑터 모델의 내부 차이와 최적화된 런타임 환경 구성.
- **Node.js Profiling**: 힙 덤프, CPU 프로파일링을 통한 NestJS 프로젝트 분석.

## 🛠 어떻게(How) 탐구하나요?

- `Clinic.js`, `Datadog`, `New Relic` 등 전문 프로파일링 도구를 사용해 NestJS 벤치마킹.
- 대용량 요청을 처리하며 발생하는 메모리 누수와 루프 지연(Event Loop Lag) 측정.
- NestJS 내부의 프로바이더 로딩 시간을 실시간으로 모니터링하는 로직 구현.

---

## 📚 관련 아티클 목차

- [01. NestJS 성능 벤치마킹: 데코레이터와 DI의 성능 비용](./nest-benchmarking.md) (작성 예정)
- [02. 가비지 컬렉션(GC)과 NestJS 프로바이더 스코프 관리 전략](./gc-and-provider-scopes.md) (작성 예정)
- [03. Fastify 어댑터 전환 시의 내부 동작 원리와 성능 최적화 포인트](./fastify-vs-express.md) (작성 예정)
- [04. 실전: 힙 덤프(Heap Dump) 분석을 통한 NestJS 메모리 릭 해결하기](./memory-leak-profiling.md) (작성 예정)
