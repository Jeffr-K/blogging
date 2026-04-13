---
title: "실무 가이드: 데이터베이스 연동 테스트와 격리 전략"
author: jeffrey
date: 2026-04-13
tags: ["database-testing", "nestjs", "testcontainers", "docker", "integration-testing"]
---

## 실무 가이드: 데이터베이스 연동 테스트와 격리 전략

백엔드 통합 테스트의 주인공은 바로 **데이터베이스(DB)**입니다. 하지만 "내 로컬 DB에서만 잘 돌아가는 테스트"는 팀 전체에 해악을 끼칩니다. 모든 개발자의 환경과 CI 파이프라인에서 동일하게 동작하는 **'재현 가능한 통합 테스트'** 환경을 구축하는 노하우를 공개합니다.

---

### 1. 테스트 환경의 정석: Testcontainers

2026년 현재 보편화된 기술은 **Testcontainers**입니다. 테스트 코드가 실행될 때 고립된 Docker 컨테이너(예: PostgreSQL)를 즉시 띄우고, 테스트가 끝나면 자동으로 파괴합니다.

#### 1.1 NestJS 통합 테스트 설정 (TypeORM 예시)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

describe('UserRepository - Integration Test', () => {
  let container: PostgreSqlContainer;
  let module: TestingModule;

  beforeAll(async () => {
    // 1. [Arrange] 테스트 시작 전 실제 DB 컨테이너 기동
    container = await new PostgreSqlContainer().start();
    
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          autoLoadEntities: true,
          synchronize: true, // 테스트에서는 스키마 자동 생성을 활용
        }),
        TypeOrmModule.forFeature([User]),
      ],
      providers: [UserRepository],
    }).compile();
  });

  afterAll(async () => {
    await module.close();
    await container.stop(); // 테스트 종료 후 컨테이너 파괴
  });
});
```

### 2. 데이터 격리 전략 (Test Data Isolation)

통합 테스트가 실패하는 가장 큰 이유는 이전 테스트가 남긴 '쓰레기 데이터' 때문입니다.

1. **Transaction Rollback**: 테스트가 끝나면 명시적으로 트랜잭션을 롤백 시킵니다. 가장 빠르지만, 실제 커밋 시에만 발생하는 제약 조건 오류를 놓칠 수 있습니다.
2. **Database Cleansing**: 테스트 시작 전 모든 테이블을 `TRUNCATE` 합니다. 데이터 정합성 확인이 가장 확실하며, 시니어 레벨에서 가장 추천하는 방식입니다.

```typescript
// 유틸리티 함수: 모든 테이블 비우기
async function clearDatabase(connection: Connection) {
  const entities = connection.entityMetadatas;
  for (const entity of entities) {
    const repository = connection.getRepository(entity.name);
    await repository.query(`TRUNCATE "${entity.tableName}" CASCADE;`);
  }
}
```

### 3. 왜 인메모리 DB(H2, SQLite)를 피해야 하는가?

많은 개발자가 속도를 위해 PostgreSQL 대신 H2나 SQLite를 사용합니다. 하지만 이는 **'거짓 양성'**의 온상입니다.

- PostgreSQL에만 있는 고유한 함수나 연산자(JSONB, Full-text search 등)를 테스트할 수 없습니다.
- 인메모리 DB에서 성공해도 실제 상용 DB의 제약 조건(Unique Index, Lock 등)에서 터질 수 있습니다.
- **결론**: 환경 구축 비용이 조금 들더라도, **반드시 실제 사용하는 DBMS와 동일한 종류의 컨테이너**에서 테스트하십시오.

---

### 시니어의 팁: "통합 테스트는 자는 동안에도 돌아가야 한다"

통합 테스트는 느립니다. 따라서 모든 테스트를 매번 로컬에서 돌리기보다는, **'주요 도메인 경로'**에 집중하여 작성하십시오. 정교하게 세팅된 통합 테스트 시나리오 하나가 수백 개의 무의미한 단위 테스트보다 배포 시의 두려움을 더 크게 덜어줄 것입니다.
 Jennifer 정 (Senior Infrastructure Engineer)
