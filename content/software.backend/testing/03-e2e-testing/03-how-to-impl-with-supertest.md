---
title: "Supertest와 NestJS를 이용한 API 기반 E2E 구현"
author: jeffrey
date: 2026-04-13
tags: ["supertest", "nestjs", "how-to", "e2e-testing", "api-testing"]
---

## Supertest와 NestJS를 이용한 API 기반 E2E 구현

NestJS 프로젝트를 생성하면 기본으로 포함되어 있는 **Supertest**는 HTTP 서버 테스트를 위한 가장 강력한 도구입니다. 실제 구동 중인 서버에 요청을 보내거나, 테스트 코드 상에서 메모리에 서버를 띄워 호출할 수 있죠. NestJS의 의존성 주입(DI) 시스템과 결합하여 완벽한 **'가짜 운영 환경'**을 구축하는 법을 알아봅니다.

---

### 1. 인메모리 테스트 서버 구축

 NestJS에서는 `Test.createTestingModule`을 통해 실제 애플리케이션과 거의 동일한 환경을 메모리에 생성합니다.

```typescript
// test/app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init(); // 인프라 및 미들웨어 초기화
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### 2. Supertest를 이용한 요청과 검증 (AAA 패턴)

Supertest의 체이닝 문법을 통해 가독성 높은 테스트를 작성할 수 있습니다.

```typescript
it('/products (GET) - 상품 목록 조회 성공 시나리오', () => {
  return request(app.getHttpServer()) // 1. 실행할 서버 지정
    .get('/products')                 // 2. 메서드 및 경로
    .expect(200)                      // 3. 기대하는 상태 코드 (Assert)
    .expect((res) => {                // 4. 상세 응답 바디 검증
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
});
```

### 3. 인증이 포함된 요청 처리

대부분의 실제 시나리오는 로그인 상태를 요구합니다. 테스트 코드에서 JWT 토큰을 획득하여 헤더에 실어 보내는 법입니다.

```typescript
it('/orders (POST) - 인증된 사용자의 주문 생성', async () => {
  // 1. [Arrange] 로그인을 통해 토큰 획득
  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: 'test@test.com', password: 'password' });
  const token = loginRes.body.accessToken;

  // 2. [Act & Assert] 토큰을 Authorization 헤더에 담아 요청
  return request(app.getHttpServer())
    .post('/orders')
    .set('Authorization', `Bearer ${token}`) // 헤더 설정
    .send({ productId: 1, quantity: 2 })
    .expect(201);
});
```

---

### 4. 시니어의 팁: "글로벌 파이프라인과 필터를 잊지 마라"

많은 개발자가 놓치는 실수 중 하나는 실제 `main.ts`에서 설정한 **ValidationPipe**나 **ExceptionFilter**를 E2E 테스트 환경에 적용하지 않는 것입니다. 

- **문제점**: `main.ts`엔 파이프라인이 있는데 테스트엔 없다면, 유효하지 않은 데이터가 테스트에선 통과되고 실제론 거절되는 불일치가 발생합니다. 
- **해결책**: `app.init()` 호출 전, 실제 애플리케이션과 **동일한 글로벌 설정**을 반드시 복사하여 적용하십시오. 

E2E 테스팅은 실전과 똑같아야 의미가 있습니다. "어설픈 가짜"가 아닌 "완벽한 복제"를 지향하십시오.
 Jennifer 정 (Master Tech Lead)
