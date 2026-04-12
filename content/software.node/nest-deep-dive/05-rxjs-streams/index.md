# RxJS & Streams (RxJS와 리액티브: 스트림의 세계)

NestJS는 내부적으로 데이터 흐름을 처리할 때 RxJS를 광범위하게 사용합니다. 이 섹션은 이 옵저버블(Observable)들이 NestJS 내부에서 어떻게 활용되고, 우리가 어떻게 이를 효과적으로 제어할 수 있는지 다룹니다.

## ✨ 왜(Why) 들여다봐야 하나요?

- NestJS가 인터셉터 등에서 왜 Promise 대신 Observable을 반환하는지 알기 위해.
- 다수의 비동기 요청을 병렬로 처리하거나, 에러 발생 시 재시도(Retry)하는 강력한 파이프라인을 구축하기 위해.
- 실시간 데이터 스트리밍 처리에서 메모리 누수를 방지하고 배압(Backpressure)을 관리하기 위해.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **Interceptors**: RxJS 오퍼레이터를 사용해 런타임에 응답 데이터를 가공하는 내부 원리.
- **Microservices**: 메시지 처리 엔진이 비동기 흐름을 Observable로 관리하는 방식.
- **Schedulers**: 시간 기반 작업을 RxJS 스케줄러를 통해 정밀하게 제어하는 기법.
- **Cold vs Hot Streams**: NestJS 내부에서 각 스트림이 언제 시작되고 종료되는지.

## 🛠 어떻게(How) 탐구하나요?

- `rxjs` 패키지의 소스 코드 일부와 NestJS 내부 `observable-handling.util.ts` 등을 교차 분석.
- 복잡한 RxJS 파이프라인(Map, Filter, SwitchMap, CatchError 등)을 실제 인터셉터에 적용하고 디버깅.
- 커스텀 연산자를 제작하여 NestJS 프로젝트 전반에 재사용되는 반응형 로직 구축.

---

## 📚 관련 아티클 목차

- [01. NestJS 인터셉터와 RxJS: 런타임 응답 조작의 정석](./interceptors-and-rxjs.md) (작성 예정)
- [02. 리액티브 컨트롤러 설계: 비동기 데이터 파이프라인 구축](./reactive-controller-design.md) (작성 예정)
- [03. 비동기 작업의 배압(Backpressure) 관리와 에러 전파 제어 전략](./backpressure-and-error-handling.md) (작성 예정)
- [04. RxJS 오퍼레이터를 활용한 고급 로깅 및 캐시 시스템 디자인](./advanced-rxjs-patterns.md) (작성 예정)
