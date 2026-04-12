# NestJS + MikroORM: 고성능 데이터베이스 아키텍처의 혁신

MikroORM은 Node.js 생태계에서 가장 진화된 데이터 매퍼(Data Mapper) 방식의 ORM입니다. NestJS와 MikroORM의 결합은 객체지향 도메인 모델링과 성능, 타입 안전성을 모두 만족시키는 강력한 기반이 됩니다.

---

## 1. MikroORM 개요 & 핵심 철학

- MikroORM이란? — 왜 TypeORM이나 Sequelize가 아닌가?
- 유닛 오브 워크(Unit of Work) — 변경 감지(Dirty Checking)와 성능 최적화
- 아이덴티티 맵(Identity Map) — 영속성 컨텍스트를 통한 데이터 일관성
- 데이터 매퍼(Data Mapper) vs 액티브 레코드(Active Record)

## 2. @mikro-orm/nestjs — NestJS 모듈 통합

- `MikroOrmModule.forRoot()` — 전역 설정과 데이터소스 비동기 초기화
- `MikroOrmModule.forFeature()` — 모듈별 엔티티 등록과 리포지토리 주입
- `scoped-orm` — 요청 스코프 영속성 컨텍스트 관리 원리
- `RequestContext` 미들웨어를 통한 자동 영속 컨텍스트 분리

## 3. 엔티티 모델링 & 관계 설계

- `@Entity()`, `@Property()` — 선언적 데이터 모델링
- 연관관계 매핑: `@OneToOne`, `@OneToMany`, `@ManyToOne`, `@ManyToMany`
- 컬렉션(`Collection<T>`)과 레퍼런스(`Reference<T>`) — 지연 로딩(Lazy Loading)
- 상속 전략(STI, JTI)과 엔티티 추상화

## 4. 고급 조회 & 쿼리 최적화

- `EntityRepository` — 커스텀 리포지토리 제작과 비즈니스 로직 분리
- `populate` — N+1 문제 해결을 위한 패치 조인(Fetch Join) 전략
- `QueryBuilder` — 복잡한 동적 쿼리 제작과 SQL 핸들링
- 프로젝션(Projection)과 원시 쿼리(Native Query) 사용법

## 5. 트랜잭션 관리 전략 (Transaction Management)

- 선언적 트랜잭션: `@Transactional()` 데코레이터와 런타임 가드
- 프로그래밍 방식 트랜잭션: `em.transactional()`과 유닛 오브 워크 연동
- 예외 상황에서의 롤백 동작 원리와 안정적인 데이터 처리
- 분산 데이터베이스 환경에서의 트랜잭션 고찰

## 6. 마이그레이션 & 스키마 관리

- MikroORM Migrations — 코드 레벨의 데이터베이스 버전 관리
- `mikro-orm.config.ts` — 설정 분리와 프로덕션 환경 최적화
- `EntityGenerator` — 기존 DB에서 엔티티 자동 추출 기법
- 시더(Seeder)와 팩토리(Factory)를 이용한 테스트 데이터 구축

## 7. 성능 튜닝 & 모니터링

- 데이터베이스 로깅과 쿼리 가시성 확보
- 쿼리 캐싱(Caching) 전략 — 로컬 캐시와 Redis 연동
- 배치 업데이트(Batch Update)를 통한 성능 극대화
- `flush`와 `persist`의 동작 주기에 따른 최적의 시점 선택

---

이 인덱스를 통해 MikroORM의 강력한 기능을 마스터하고, 복잡한 비즈니스 애플리케이션의 데이터 계층을 견고하게 구축합니다.
