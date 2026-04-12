# Effect-TS: 타입 안전한 함수형 프로그래밍의 정수

Effect-TS는 TypeScript 생태계에서 가장 진화된 함수형 프로그래밍 라이브러리입니다. 단순히 함수형 도구를 제공하는 것을 넘어, 에러 핸들링, 의존성 주입, 동시성을 하나의 통합된 인터페이스로 다룰 수 있게 해줍니다.

---

## 1. 개요 & 핵심 철학

- Effect란 무엇인가? — 데이터 타입으로서의 프로그램
- 왜 Effect-TS인가? — 안정성, 가독성, 조합성(Composability)
- Three-channel 타입 시스템: `Effect<Success, Error, Requirements>` 이해하기
- 기존 Promise/Async-Await과의 패러다임 차이

## 2. 기초 (The Basics)

- `Effect.succeed`, `Effect.fail`, `Effect.promise` — 이펙트 생성
- `Effect.map`, `Effect.flatMap` — 풍부한 데이터 가공
- `Effect.runSync`, `Effect.runPromise` — 이펙트 실행
- 파이프라인 연산자(`pipe`)와 유효 범위(Scope)

## 3. 에러 핸들링 (Error Management)

- 타입 안전한 에러 처리 전략
- `Effect.catchAll`, `Effect.catchTag` — 구체적 에러 포획
- `Effect.retry` — 지능형 재시도 전략
- `Effect.tapError` — 부수 효과 로깅

## 4. 의존성 주입 (Layer & Context)

- `Layer` 개념 이해: 의존성 그래프의 조립과 추상화
- `Tag`를 이용한 서비스 정의 및 주입
- `Effect.provide`, `Effect.provideService`
- 환경 설정(Config) 관리와 타입 안전 주입

## 5. 리소스 관리 (Resource Management & Scope)

- `Scope` 타입 이해: 리소스의 생명주기 관리
- `Effect.acquireRelease` — 자원 누수 없는 안전한 확보와 해제
- `Effect.addFinalizer` — 파이널라이저를 통한 정리 로직
- 데이터베이스 커넥션, 파일 핸들링에서의 실전 사례

## 6. 병렬성과 동시성 (Concurrency)

- `Fiber` — 경량 스레드 모델의 심층 분석
- `Effect.zip`, `Effect.all` — 병렬 실행과 순차 실행
- `Effect.fork`, `Effect.await` — 비동기 작업 제어
- `Ref`와 `Deferred` — 코루틴 간 상태 공유 및 신호 제어

## 7. 스트림 (Stream)

- `Stream` — 무한한 데이터 시퀀스 처리
- `Stream.map`, `Stream.filter`, `Stream.zip`
- `Stream.fromIterable`, `Stream.fromEffect`
- 대용량 데이터 처리와 백엔드 파이프라인 구축

## 8. 실전 패턴 & 아키텍처

- Effect와 NestJS 통합 전략 (svc-feedback 등 실전 적용)
- DDD(Domain Driven Design)와 Effect 모듈 설계
- 테스트 자동화 (`Effect.provide`를 이용한 모킹)
- 성능 모니터링 및 메트릭 수집

---

어떤 섹션부터 깊이 있게 파헤쳐 볼까요? 각 섹션별로 상세 폴더와 `index.md` 가이드를 구성할 예정입니다.
