---
title: "NestJS Deep Dive: 통합 테스트와 E2E 테스트 환경 분석"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "testing", "e2e-testing", "integration", "internals"]
---

## 실전의 검증: 통합 테스트와 E2E 테스트

단위 테스트가 개별 부품의 건강을 체크한다면, **통합 테스트(Integration Test)**와 **E2E 테스트(End-to-End Test)**는 부품들이 맞물려 돌아가는 실제 시스템의 시퀀스를 검증한다.

NestJS는 `Supertest`라는 라이브러리와 긴밀하게 연동되어, 실제 HTTP 서버를 띄우지 않고도 메모리 내에서 실제 요청을 처리하는 고도의 테스트 환경을 제공한다. 이번 아티클에서는 NestJS의 통합 및 E2E 테스트 엔진이 어떤 내부 여정을 거치는지 딥다이브해 본다.

---

## 1. E2E 테스트의 시작: NestApplicationContext 로드

E2E 테스트는 단순히 서비스 하나만 불러오는 것이 아니라, 전체 `AppModule`을 로드한다.

```typescript
const moduleFixture: TestingModule = await Test.createTestingModule({
  imports: [AppModule],
}).compile();

const app = moduleFixture.createNestApplication();
await app.init();
```

- **init()**: 이 시점에서 실제 데이터베이스 연결, 미들웨어 설정, 라우팅 테이블 구성이 일어난다.
- **실전**: `@nestjs/config`에서 로드하는 환경 변수 파일(`.env.test`)을 명확히 분리하여, 테스트 데이터가 프로덕션에 영향을 주지 않도록 설계하는 것이 기본이다.

---

## 2. 딥다이브: supertest와의 연동 원리

우리는 보통 `request(app.getHttpServer()).get('/users')` 형식으로 테스트를 짠다.

- **getHttpServer()**: NestJS 애플리케이션 내의 실제 `httpServer` 인스턴스를 반환한다. (Express 또는 Fastify 인스턴스)
- **메모리 내 통신**: `Supertest`는 실제 네트워크 포트(3000번 등)를 열지 않고, Node.js의 `request` 객체를 메모리 상에서 직접 서버 핸들러로 전달한다. 이 설계 덕분에 E2E 테스트는 네트워크 오버헤드 없이 고속으로 실행될 수 있다.

---

## 3. 테스트 데이터베이스 격리 (Database Isolation)

통합 테스트의 가장 큰 적은 **'지저분한 테스트 데이터'**다.

- **각 테스트 전(Before Each)**: 데이터베이스를 초기화하거나 스키마를 새로 미는(Truncate) 로직을 `OnModuleInit` 훅 또는 테스트 환경 파일에 구축해야 한다.
- **Transactional E2E**: 가능하면 테스트 전체를 하나의 DB 트랜잭션으로 묶고, 테스트가 끝나면 **롤백(Rollback)** 시키는 전략을 사용하면 데이터베이스가 오염되지 않는다.

---

## 4. 실전 활용: 외부 API 모킹 (External API Mocking)

E2E 테스트 도중 외부 소셜 로그인(Kakao, Google) 서버에 직접 요청을 보낼 수는 없다.

- **Nock (추천)**: 외부 HTTP 요청을 가로채서(Interception) 사전에 정의된 응답을 주는 라이브러리다.
- **내부 동작**: Node.js의 `http` 모듈 자체를 가로채서, 특정 도메인으로 나가는 모든 트래픽을 가상 서버로 돌린다. 이 과정을 통해 외부 의존성이 있는 전체 시퀀스도 완벽하게 테스트 가능하다.

---

## 요약

통합 및 E2E 테스트는 **"현실의 데이터와 가상의 흐름"** 사이의 조율이다.

- `app.init()` 과정을 이해하고, 테스트 환경 데이터베이스를 분리하자.
- `Supertest`를 통한 메모리 기반 고속 HTTP 테스트 환경을 활용하자.
- 외부 API 통신은 `Nock`과 같은 도구로 완벽하게 가로채어 안정적인 결과를 보장하자.

이 테스팅 아키텍처를 견고하게 갖춘 팀은 두려움 없이 소스 코드를 리팩토링할 수 있는 강력한 확신을 가지게 된다.

다음 아티클에서는 이러한 모든 테스트 지식을 바탕으로 성능과 병렬 실행을 극대화하는 **테스트 컨테이너 최적화 전략**을 딥다이브하며 본 테마를 마무리한다.
