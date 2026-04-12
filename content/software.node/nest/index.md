# NestJS 완전 학습 인덱스

NestJS를 '깊이 있게 쓸 줄 안다는 것'은 단순히 CRUD API를 만들거나 문법을 아는 수준을 넘어, NestJS의 아키텍처 철학을 이해하고 확장성 있는 시스템을 설계할 수 있다는 의미입니다.

---

## 1. 개요 & 핵심 철학

- NestJS란? — Node.js 프레임워크의 진화
- 아키텍처 철학 — Angular의 영향과 객체지향 설계(OOP)
- TypeScript 중심의 개발 경험
- Express vs Fastify — 기본 플랫폼 전환 전략
- NestJS가 해결한 문제들 (아키텍처 부재, 일관성 없는 코드 구조)

## 2. 시작하기 & 프로젝트 구조

- Nest CLI 설치 및 라이브러리 구성
- 프로젝트 생성 및 초기 설정
- 표준 디렉터리 레이아웃 분석
- `main.ts` — 애플리케이션 진입점 및 컨텍스트 초기화
- 기본 모듈 구조와 컴포넌트 스캔 원리

## 3. 핵심 기본기 (Fundamental)

- **Module** — 애플리케이션 구조화의 단위
- **Controller** — 라우팅 및 계층별 요청 처리
- **Provider & Service** — 비즈니스 로직의 핵심
- 의존성 주입(DI)의 기본 원리와 사용법
- `@Injectable()`과 싱글톤 패턴

## 4. 요청 생명주기 (Request Lifecycle)

- NestJS 요청 파이프라인의 실행 순서
- **Middleware** — 요청 전처리 및 로깅
- **Guards** — 선언적 인증과 인가 처리
- **Interceptors** — 응답 변환, 로깅, 캐시 처리
- **Pipes** — 데이터 변환(Transformation) 및 유효성 검증(Validation)
- **Exception Filters** — 전역 및 커스텀 에러 핸들링

## 5. 의존성 주입 & Bean 관리 (Advanced DI)

- Inversion of Control (IoC) 컨테이너 기법
- **Custom Providers** — `useValue`, `useClass`, `useFactory`, `useExisting`
- `forwardRef`를 이용한 순환 의존성(Circular Dependency) 해결
- **Dynamic Modules** — 비동기 설정 주입 (`register`, `forRoot`, `forFeature`)
- 프로바이더 스코프 (Singleton, Request, Transient)

## 6. 설정 관리 & 환경 변수

- `@nestjs/config` 모듈 활용
- `.env` 파일 관리 및 커스텀 설정 서비스 구축
- 설정값 검증 (Joi, class-transformer)
- 비동기 모듈 초기화와 Config 연동

## 7. 데이터 액세스 (Database)

- TypeORM 통합 및 데이터 모델링
- Prisma 연동 및 스키마 관리
- MikroORM 및 데이터베이스 추상화 전략
- Repository 패턴과 QueryBuilder 활용
- 트랜잭션 관리 전략 (Transaction Managers, Decorators)

## 8. 유효성 검사 & 직렬화

- `class-validator`를 이용한 요청 데이터 검증
- `class-transformer`를 통한 응답 객체 변환 (Serialization)
- 전역 파이프 설정 및 커스텀 유효성 검사기

## 9. 보안 (Authentication & Security)

- Passport 통합 및 인증 전략 (Strategy)
- **JWT (Json Web Token)** — 액세스 토큰과 리프레시 토큰 관리
- RBAC (Role-Based Access Control) 및 ABAC 구현
- 세션 관리 및 보안 모범 사례 (Helmet, CORS, Rate Limiting)

## 10. RxJS & 리액티브 프로그래밍

- NestJS 내의 RxJS 활용 사례
- Observable 스트림 처리 및 연산자 활용
- 비동기 데이터 가공 및 파이프라인 구축
- 인터셉터에서의 스트림 제어

## 11. 비동기 작업 & 스케줄링

- **Task Scheduling** — Cron 작업 및 타임아웃 처리
- **BullMQ** — Redis 기반 분산 큐 시스템 구축
- 비동기 이벤트 처리 (`@nestjs/event-emitter`)

## 12. 테스트 자동화 (Testing)

- Jest 프레임워크 기반 단위 테스트 (`Unit Testing`)
- `Test.createTestingModule`을 이용한 모듈 격리 테스트
- E2E(End-to-End) 테스트 환경 구축 및 Supertest 활용
- Mocking 전략 — DB, 외부 API 서비스 모의 객체 생성

## 13. 마이크로서비스 (Microservices)

- NestJS 마이크로서비스 개념 (Transporters)
- **Redis / RabbitMQ / Kafka** 기반 메시징 시스템 연동
- gRPC를 이용한 고성능 서비스 간 통신
- Hybrid Application 구성 (HTTP + Microservice)

## 14. 실전 고급 패턴 (Advanced Architecture)

- **CQRS (Command Query Responsibility Segregation)** 패턴 도입
- **Domain Driven Design (DDD)**과 NestJS 모듈 설계
- **Terminus**를 이용한 헬스 체크 엔드포인트 구성
- 로그 구조화 및 중앙 집중식 로깅 (Winston, Pino)

## 15. 운영 & 성능 분석

- Docker 컨테이너라이제이션 및 멀티 스테이지 빌드
- CI/CD 파이프라인 구성 (GitHub Actions)
- 성능 모니터링 및 메모리 릭 분석
- 가상 스레드 환경 고찰 (Node.js의 경우 Worker Threads 및 최적화)

---

구체적으로 어떤 모듈부터 깊이 있게 학습하고 싶으신가요? 이 인덱스를 바탕으로 각 아티클을 순차적으로 작성해 나갈 예정입니다.
