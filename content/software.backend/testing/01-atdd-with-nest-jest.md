---
title: "비즈니스 요건을 코드로 증명하다: NestJS + Jest 기반 ATDD 실전"
author: jeffrey
date: 2026-04-13
tags: ["atdd", "nestjs", "jest", "acceptance-test", "backend-testing"]
---

## ATDD: 기획부터 구현까지 '함께' 걷는 테스팅 전략

**ATDD(Acceptance Test-Driven Development)**는 단순한 개발 기법이 아닌, 협력을 위한 도구입니다. 개발자, 기획자, QA가 모여 무엇을 만들지 '인수 조건(Acceptance Criteria)'을 먼저 합의하고, 이 조건을 만족하는 자동화된 **인수 테스트(Acceptance Test)**를 먼저 작성한 뒤 기능을 구현합니다.

이 방식의 핵심은 **"기획의 오해를 개발 시작 전 단계에서 0으로 만드는 것"**에 있습니다.

---

### 1. 시나리오: 사용자 회원가입 기능 구축

우선 기획서상의 인수 조건을 정의해 봅시다.

- **인수 조건**:
  - 사용자는 이메일과 비밀번호로 회원가입을 할 수 있다.
  - 이메일 형식이 유효하지 않으면 가입이 실패해야 한다.
  - 이미 가입된 이메일로 중복 가입을 시도하면 실패해야 한다.

### 2. NestJS + Jest로 인수 테스트 먼저 작성하기

TDD가 내부 구현의 단위를 검증한다면, ATDD는 **'외부에서 본 시스템의 동작'**을 검증합니다. 따라서 주로 E2E(End-to-End) 테스트 환경에서 작성됩니다.

```typescript
// test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('회원가입 API (ATDD)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('사용자는 이메일과 비밀번호로 회원가입을 할 수 있다.', () => {
    it('성공 시 201 Created를 반환하며 가입된 사용자 정보를 응답한다.', async () => {
      const signUpRequest = {
        email: 'test@example.com',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(signUpRequest)
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(signUpRequest.email);
    });
  });

  describe('이미 가입된 이메일로 중복 가입을 시도하면 실패해야 한다.', () => {
    it('중복 가입 시 409 Conflict 에러를 반환해야 한다.', async () => {
      const signUpRequest = {
        email: 'test@example.com',
        password: 'password123',
      };

      // 첫 번째 가입 (성공)
      await request(app.getHttpServer()).post('/auth/signup').send(signUpRequest);

      // 두 번째 가입 시도 (실패)
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(signUpRequest)
        .expect(HttpStatus.CONFLICT);
    });
  });
});
```

### 3. 인수 조건을 만족하는 비즈니스 로직 구현

이제 위 테스트가 통과되도록 NestJS 서비스를 구현합니다.

```typescript
// src/auth/auth.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class AuthService {
  constructor(private usersRepository: UsersRepository) {}

  async signUp(email: string, password: string) {
    // 1. 중복 체크 (인수 조건 검증)
    const existingUser = await this.usersRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    // 2. 가입 처리
    return this.usersRepository.create(email, password);
  }
}
```

---

### 4. ATDD의 실전 가치

위 과정을 통해 우리가 얻은 것은 단순한 코드가 아닙니다.

- **작업의 경계 명확화**: "어디까지 개발해야 하지?"라는 질문에 테스트 코드가 명확하게 답해줍니다.
- **문서화**: 테스트 코드가 곧 살아있는 기획서이자 기술 명세서가 됩니다.
- **리팩토링의 공포 해소**: 내부 코드를 아무리 고쳐도, 처음에 작성한 인수 테스트(E2E)가 깨지지 않는다면 비즈니스 가치는 안전하게 보호되고 있는 것입니다.

---

> [!TIP]
> **ATDD는 기획자와 대화하는 언어입니다.** "코드가 왜 이래요?"라는 질문 대신 "우리가 합의한 이 인수 테스트 시나리오가 보장되고 있습니다"라고 당당하게 말하는 것. 그것이 실전형 엔지니어의 테스팅 자세입니다.
