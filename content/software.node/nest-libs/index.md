# NestJS Libraries: 생태계의 정수와 라이브러리 가이드

NestJS는 강력한 코어 프레임워크와 함께 수많은 공식/비공식 라이브러리들의 생태계로 이루어져 있습니다. 각 라이브러리의 깊은 곳(Internals)을 이해하여 더 정교한 시스템을 구축합니다.

---

## 1. @nestjs/config — 설정 관리의 모든 것

- `ConfigModule`의 비동기 초기화와 `register` 패턴 분석
- `ConfigService` 런타임 값 주입 및 타입 안전성 (Joi, class-validator)
- 멀티 환경 설정(`.env.dev`, `.env.prod`) 로드 순서와 우선순위
- 커스텀 설정 서비스 구축과 전역 주입

## 2. @nestjs/event-emitter — 이벤트 기반 아키텍처

- `EventEmitter2` — NestJS 내부의 이벤트 버스 동작 원리
- `@OnEvent()`와 비동기 이벤트 리스너 (`async: true`)
- 이벤트 전파 제어와 와일드카드(`#`, `*`) 수신 패턴
- 타입 안전 이벤트를 위한 스키마 정의 전략

## 3. @nestjs/cqrs — 커맨드와 쿼리의 분리

- `CqrsModule` — CommandBus, QueryBus, EventBus 내부 구조
- `Command`, `Handler`, `Saga` — 각 단계의 실행 순서와 트랜잭션 관리
- 복잡한 도메인 로직을 단순화하는 비대칭 아키텍처 설계
- `Saga`를 이용한 분산 트랜잭션과 비즈니스 워크플로우 제어

## 4. @nestjs/schedule — 정교한 태스크 스케줄링

- `Cron` 작업의 실행 메커니즘과 Node.js 타이머 통합
- 동적인 Cron 작업 등록 및 소멸 (`SchedulerRegistry`)
- 분산 서버 환경에서 중복 스케줄 실행 방지 전략
- 작업 큐(BullMQ)와의 유기적 연동 및 우선순위 관리

## 5. @nestjs/terminus — 시스템 헬스 체크

- `HealthCheckService` — 시스템 가동 상태(Liveness/Readiness) 모니터링
- 데이터베이스, Redis, 외부 API 응답 시간 체크 (`HealthIndicator`)
- Kubernetes Probe와 Terminus 통합 사례
- 커스텀 헬스 인디케이터 제작 가이드

## 6. @nestjs/websockets — 실전 실시간 통신

- `Socket.io`와 `WsAdapter` — 웹소켓 프로토콜 추상화
- 게이트웨이(`Gateway`)에서의 인증(Auth)과 가드 적용
- 브로드캐스트(Broadcast)와 룸(Room) 기반 메시지 전송
- 고성능 실시간 알림 시스템 아키텍처 설계

---

이 인덱스를 통해 NestJS 생태계가 제공하는 정교한 도구들을 마스터하고, 대규모 시스템의 복잡도를 제어하는 능력을 키웁니다.
