# Spring Data JPA 완전 학습 인덱스

---

## 1. 개요 & 배경

### JPA란?
- ORM(Object-Relational Mapping)이 필요한 이유
- JDBC → MyBatis → JPA 발전 흐름
- JPA(스펙) vs Hibernate(구현체) vs Spring Data JPA(편의 계층) 관계
- JPA가 해결하는 것 / 해결하지 못하는 것

### 핵심 개념 미리보기
- 영속성 컨텍스트 (Persistence Context)
- 엔티티(Entity) — 테이블과 매핑되는 객체
- JPQL — 객체 지향 쿼리 언어
- Repository 패턴

---

## 2. 환경 설정

### 의존성
- `spring-boot-starter-data-jpa`
- `spring-boot-starter-jdbc` (내부 포함 관계)
- DB 드라이버 (`mysql-connector-j`, `postgresql` 등)
- H2 인메모리 DB (개발/테스트용)

### application.yml 핵심 설정
- `spring.datasource.*` — URL, username, password, driver
- `spring.jpa.hibernate.ddl-auto` — none / validate / update / create / create-drop
  - 운영 환경에서는 반드시 `none` 또는 `validate`
- `spring.jpa.show-sql` — 실행 SQL 출력
- `spring.jpa.properties.hibernate.format_sql` — SQL 포맷팅
- `spring.jpa.open-in-view` — OSIV 설정 (성능에 중요, 뒤에서 자세히)

---

## 3. 엔티티 매핑

### 기본 매핑
- `@Entity` — 클래스를 엔티티로 선언
- `@Table(name = "...")` — 테이블명 지정
- `@Column` — 컬럼명, 길이, nullable, unique 제약
- `@Id` — 기본 키
- `@GeneratedValue` — 기본 키 생성 전략
  - `IDENTITY` — DB Auto Increment (MySQL, PostgreSQL)
  - `SEQUENCE` — DB 시퀀스 (Oracle, PostgreSQL)
  - `TABLE` — 키 생성 전용 테이블 (잘 안 씀)
  - `UUID` — UUID 기본 키 (Hibernate 6+)
- `@Transient` — 매핑 제외 필드

### 상속 매핑
- 단일 테이블 전략 (`@Inheritance(strategy = SINGLE_TABLE)`)
- 조인 전략 (`JOINED`)
- 구현 클래스마다 테이블 전략 (`TABLE_PER_CLASS`)
- `@DiscriminatorColumn` / `@DiscriminatorValue`
- 각 전략의 장단점과 선택 기준

### 임베디드 타입
- `@Embeddable` / `@Embedded` — 값 객체를 엔티티에 포함
- `@AttributeOverride` — 컬럼명 재정의
- 활용 예: `Address`, `Money`, `Period`

### 기타 매핑
- `@Enumerated` — Enum 매핑 (`STRING` 권장, `ORDINAL` 위험성)
- `@Lob` — CLOB / BLOB
- `@Convert` — `AttributeConverter` 커스텀 변환 (암호화, JSON 등)
- `@CreationTimestamp` / `@UpdateTimestamp` (Hibernate)

---

## 4. 연관관계 매핑

### 연관관계의 핵심 개념
- **방향성** — 단방향 vs 양방향
- **다중성** — `@OneToOne`, `@OneToMany`, `@ManyToOne`, `@ManyToMany`
- **연관관계의 주인 (Owner)** — 외래 키를 실제로 관리하는 쪽
  - `@JoinColumn` — 주인 쪽에 설정
  - `mappedBy` — 주인이 아닌 쪽에 설정
  - 주인이 아닌 쪽에 데이터를 넣어도 DB에 반영 안 됨 (흔한 실수!)

### @ManyToOne (다대일)
- 가장 많이 사용하는 연관관계
- 단방향 매핑 예제 (`Order → Member`)
- 양방향 매핑 시 주인 설정
- `@JoinColumn(name = "member_id")`

### @OneToMany (일대다)
- 양방향: `mappedBy`로 주인 지정 (`List<Order>` in Member)
- 단방향 `@OneToMany` — 추가 UPDATE 쿼리 발생, 권장하지 않음
- `cascade` — 연쇄 영속화/삭제
  - `CascadeType.PERSIST` — 같이 저장
  - `CascadeType.REMOVE` — 같이 삭제
  - `CascadeType.ALL` — 모두 적용 (주의해서 사용)
- `orphanRemoval = true` — 고아 객체 자동 삭제

### @OneToOne (일대일)
- 외래 키 어느 쪽에 둘지 선택
- 양방향 시 주인 설정
- Lazy 로딩이 잘 안 되는 이슈 (선택적 관계일 때)

### @ManyToMany (다대다)
- `@JoinTable` — 중간 테이블 설정
- **실무에서는 거의 사용 금지** — 중간 테이블에 컬럼 추가 불가
- 중간 엔티티로 분해하는 패턴 (`@ManyToOne` + `@ManyToOne`)

---

## 5. 영속성 컨텍스트 (Persistence Context)

### 영속성 컨텍스트란?
- "엔티티를 영구 저장하는 환경" — 1차 캐시
- `EntityManager`와의 관계
- 트랜잭션과 영속성 컨텍스트의 생명주기

### 엔티티의 4가지 상태
- **비영속 (Transient)** — `new`로 생성, JPA와 무관
- **영속 (Managed)** — `em.persist()` 또는 조회 후, 1차 캐시에 존재
- **준영속 (Detached)** — `em.detach()`, 영속성 컨텍스트에서 분리
- **삭제 (Removed)** — `em.remove()`, 삭제 예약

### 핵심 기능
- **1차 캐시** — 같은 트랜잭션 내 동일 엔티티 재조회 시 DB 안 감
- **동일성 보장** — 같은 PK로 조회한 엔티티는 `==` 비교 true
- **쓰기 지연 (Write-behind)** — `flush()` 전까지 INSERT/UPDATE 모음
- **변경 감지 (Dirty Checking)** — 엔티티 필드 수정 시 자동 UPDATE 생성
  - `update()` 메서드가 없는 이유!
- **지연 로딩 (Lazy Loading)** — 프록시 객체로 실제 쿼리를 나중에

### flush()와 commit()
- `flush()` — 영속성 컨텍스트 → DB 동기화 (트랜잭션은 유지)
- `commit()` — 트랜잭션 완료 (flush 포함)
- FlushMode — AUTO(기본) / COMMIT

---

## 6. N+1 문제 (매우 중요!)

### N+1 문제란?
- **정의**: 1번의 쿼리로 N개의 결과를 가져왔는데, 각 결과에 대해 추가로 N번의 쿼리가 더 실행되는 현상
- **예시**: 주문 목록 10개를 조회(`1번`)했는데, 각 주문의 회원 정보를 가져오기 위해 추가 쿼리가 10번(`N번`) 실행됨 → 총 11번 쿼리
- EAGER 로딩도, LAZY 로딩도 모두 N+1 발생 가능
- 데이터가 많아질수록 성능이 급격히 저하됨

### 왜 발생하는가?
- EAGER 로딩 시: 연관 엔티티를 즉시 조회하는데, JPQL은 연관관계를 무시하고 쿼리를 따로 날림
- LAZY 로딩 시: 연관 엔티티에 접근하는 순간 프록시가 쿼리를 날림 (반복문 안에서 접근하면 N번 발생)

### 해결 방법 1 — Fetch Join (가장 많이 사용)
- JPQL에서 `JOIN FETCH` 키워드 사용
- 연관된 엔티티를 한 번의 쿼리로 함께 조회
- 컬렉션 Fetch Join 시 `DISTINCT` 필요 (중복 결과 제거)
- **한계**: 컬렉션 Fetch Join은 페이징 불가 (Hibernate 경고 + 메모리 페이징으로 위험!)

### 해결 방법 2 — @EntityGraph
- `@EntityGraph(attributePaths = {"member"})` — 메서드 레벨 Fetch Join
- JPQL 없이 선언적으로 패치 조인 적용
- `@NamedEntityGraph` — 엔티티 레벨 정의

### 해결 방법 3 — Batch Size
- `@BatchSize(size = 100)` — 연관 엔티티를 IN 쿼리로 한꺼번에 조회
- `spring.jpa.properties.hibernate.default_batch_fetch_size=100` — 전역 설정
- 컬렉션 페이징 + N+1 동시 해결에 효과적
- 1+1 쿼리로 줄어드는 효과

### 해결 방법 4 — DTO 직접 조회
- JPQL `new` 문법으로 DTO에 직접 프로젝션
- 필요한 컬럼만 SELECT → 성능 최적화
- 엔티티가 아니므로 영속성 컨텍스트 관리 안 됨
- 리포지터리 재사용성 낮아짐

### 언제 어떤 방법을 쓰는가?
- 기본값: `LAZY` 로딩 + `Batch Size` 전역 설정
- 특정 쿼리 최적화: `Fetch Join` 또는 `@EntityGraph`
- 복잡한 조회 성능 극한까지: `DTO 직접 조회`
- 컬렉션 페이징: `Batch Size` (Fetch Join은 절대 사용 금지!)

---

## 7. Fetch 전략 (LAZY vs EAGER)

### LAZY (지연 로딩) — 기본 권장
- 연관 엔티티를 프록시로 대체, 실제 접근 시 쿼리 실행
- `@ManyToOne`, `@OneToOne` 기본값은 EAGER → 반드시 LAZY로 변경 권장
- `@OneToMany`, `@ManyToMany` 기본값은 LAZY

### EAGER (즉시 로딩) — 거의 사용 금지
- 연관 엔티티를 항상 같이 조회
- 예상치 못한 쿼리 발생, N+1 문제 유발
- 실무에서는 모든 연관관계를 LAZY로 설정하는 것이 기본 원칙

### 프록시 객체 이해
- `em.getReference()` — 프록시 반환
- 프록시 초기화 — 실제 DB 조회 발생 시점
- `LazyInitializationException` — 트랜잭션 밖에서 LAZY 접근 시 예외
  - OSIV(Open Session in View)가 이 문제를 숨겨주지만, 성능 이슈 유발

---

## 8. OSIV (Open Session In View)

### OSIV란?
- 영속성 컨텍스트의 생명주기를 HTTP 요청 전체로 늘리는 설정
- `spring.jpa.open-in-view=true` (Spring Boot 기본값 — 경고!)

### OSIV ON의 장단점
- 장점: 뷰/컨트롤러에서 LAZY 로딩 가능 (`LazyInitializationException` 없음)
- 단점: DB 커넥션을 요청 전체 동안 점유 → 커넥션 부족 문제 (트래픽 많은 서비스에서 심각)

### OSIV OFF 권장 이유
- 커넥션 풀 효율적 사용
- 서비스 레이어에서 모든 조회 완료 강제 → 명확한 구조
- `LazyInitializationException`을 통해 설계 문제 조기 발견

### OSIV OFF 시 패턴
- 서비스에서 DTO로 변환 후 반환
- `@Transactional` 경계 내에서 모든 LAZY 로딩 완료
- Query Service / Command Service 분리 패턴

---

## 9. Spring Data JPA Repository

### 기본 Repository 계층
- `Repository<T, ID>` — 마커 인터페이스
- `CrudRepository<T, ID>` — CRUD 기본 메서드
- `PagingAndSortingRepository<T, ID>` — 페이징/정렬
- `JpaRepository<T, ID>` — JPA 특화 + 일괄 처리

### 쿼리 메서드 네이밍 규칙
- `findBy`, `readBy`, `getBy` — 조회
- `countBy` — 개수
- `existsBy` — 존재 여부
- `deleteBy`, `removeBy` — 삭제
- 조건 키워드: `And`, `Or`, `Between`, `LessThan`, `GreaterThan`, `Like`, `In`, `IsNull`, `OrderBy`
- 예: `findByNameAndAgeGreaterThan(String name, int age)`

### @Query
- JPQL 직접 작성 (`@Query("SELECT o FROM Order o WHERE ...")`
- 네이티브 SQL (`nativeQuery = true`)
- DTO Projection (`SELECT new com.example.dto.OrderDto(o.id, m.name) FROM ...`)
- `@Modifying` — UPDATE / DELETE 쿼리 (`clearAutomatically = true` 주의)

### 페이징 & 정렬
- `Pageable` 파라미터 — `PageRequest.of(page, size, Sort.by(...))`
- `Page<T>` — 전체 개수 포함 (COUNT 쿼리 추가 발생)
- `Slice<T>` — 다음 페이지 존재 여부만 (COUNT 없음, 무한 스크롤에 적합)
- `List<T>` + `Pageable` — COUNT 없이 데이터만
- Querydsl 페이징 최적화 (COUNT 쿼리 별도 분리)

### 커스텀 Repository 구현
- `OrderRepositoryCustom` 인터페이스 정의
- `OrderRepositoryCustomImpl` 구현 (Querydsl 등)
- `OrderRepository extends JpaRepository, OrderRepositoryCustom`

---

## 10. JPQL & 네이티브 쿼리

### JPQL 기초
- 테이블이 아닌 **엔티티와 필드**를 대상으로 쿼리
- `SELECT`, `FROM`, `WHERE`, `JOIN`, `GROUP BY`, `HAVING`, `ORDER BY`
- 파라미터 바인딩 — 위치 기반(`?1`) vs 이름 기반(`:name`) → 이름 기반 권장

### JPQL JOIN
- 내부 조인: `JOIN`
- 외부 조인: `LEFT JOIN`
- 세타 조인: `FROM Order o, Member m WHERE o.member = m`
- **패치 조인**: `JOIN FETCH` — N+1 해결의 핵심

### 프로젝션 (Projection)
- 엔티티 프로젝션: `SELECT o FROM Order o`
- 임베디드 타입 프로젝션: `SELECT o.address FROM Order o`
- 스칼라 타입 프로젝션: `SELECT o.id, o.name FROM Order o` → `Object[]` 반환
- DTO 프로젝션: `SELECT new OrderDto(o.id, o.name) FROM Order o`

### 벌크 연산
- 여러 건을 한 번에 UPDATE / DELETE
- `@Modifying` + `@Query`
- **주의**: 벌크 연산은 영속성 컨텍스트를 무시하고 직접 DB에 적용
- 벌크 연산 후 반드시 `clearAutomatically = true` 또는 수동 `em.clear()`

---

## 11. Querydsl

### Querydsl 설정
- 의존성 및 APT(Annotation Processor) 설정 (Maven / Gradle)
- `QClass` 자동 생성 원리
- `JPAQueryFactory` Bean 등록

### 기본 쿼리
- `selectFrom()`, `where()`, `orderBy()`, `limit()`, `offset()`
- `BooleanExpression` — 조건 조합 (`and()`, `or()`)
- `BooleanBuilder` — 동적 조건 구성

### 동적 쿼리 (핵심 장점!)
- `BooleanExpression` 반환 메서드로 조건 분리
- null 반환 시 조건 무시 — 깔끔한 동적 쿼리
- 검색 조건 조합 패턴

### 조인 & 패치 조인
- `join()`, `leftJoin()`, `fetchJoin()`
- `on()` — 조인 조건 추가
- 연관관계 없는 엔티티 세타 조인

### 프로젝션 & DTO 조회
- `Projections.constructor()` — 생성자 기반
- `Projections.fields()` — 필드 직접 접근
- `Projections.bean()` — Setter 기반
- `@QueryProjection` — DTO 컴파일 타임 안전성

### 페이징 & 카운트 쿼리 분리
- `fetchResults()` — Deprecated (분리 권장)
- 데이터 쿼리 + count 쿼리 별도 작성 → count 쿼리 최적화

### 서브쿼리
- `JPAExpressions.select()`
- WHERE 절 서브쿼리
- FROM 절 서브쿼리 — JPQL 미지원, 네이티브 쿼리 또는 애플리케이션 조합 필요

---

## 12. 트랜잭션 관리

### @Transactional 동작 원리
- AOP 프록시를 통한 트랜잭션 경계 설정
- `PlatformTransactionManager` (JPA: `JpaTransactionManager`)
- 트랜잭션 커밋 시 flush() → dirty checking → SQL 실행

### 전파 (Propagation)
- `REQUIRED` (기본) — 기존 트랜잭션 참여, 없으면 새로 생성
- `REQUIRES_NEW` — 기존 트랜잭션 중단, 새 트랜잭션 생성
- `NESTED` — 중첩 트랜잭션 (savepoint)
- `SUPPORTS` — 있으면 참여, 없으면 트랜잭션 없이 실행
- `NOT_SUPPORTED` — 트랜잭션 없이 실행
- `MANDATORY` — 반드시 기존 트랜잭션 필요, 없으면 예외
- `NEVER` — 트랜잭션 있으면 예외

### 격리 수준 (Isolation)
- `READ_UNCOMMITTED` — 커밋 안 된 데이터 읽기 (Dirty Read 발생)
- `READ_COMMITTED` — 커밋된 데이터만 읽기 (대부분의 DB 기본값)
- `REPEATABLE_READ` — 같은 트랜잭션 내 동일 결과 보장 (MySQL InnoDB 기본값)
- `SERIALIZABLE` — 완전 직렬화 (가장 안전, 가장 느림)

### readOnly = true
- 최적화: flush 생략, Dirty Checking 생략
- 읽기 전용 트랜잭션 명시적 표현
- Read/Write DB 분리 시 라우팅 힌트

### 자기 호출(Self-Invocation) 문제
- 같은 클래스 내 메서드 호출 시 AOP 프록시 우회 → 트랜잭션 미적용
- 해결: 구조 분리 (별도 클래스)
- `@Transactional` 메서드를 public으로 선언해야 하는 이유

### 롤백 규칙
- 기본: `RuntimeException`, `Error` 발생 시 롤백
- Checked Exception은 기본 롤백 안 됨
- `rollbackFor = Exception.class` — 모든 예외 롤백
- `noRollbackFor` — 특정 예외 롤백 제외

---

## 13. 락 (Lock)

### 낙관적 락 (Optimistic Lock)
- 충돌이 드물다고 가정 — 수정 시점에 충돌 감지
- `@Version` 필드 — 버전 불일치 시 `OptimisticLockException`
- `LockModeType.OPTIMISTIC` / `OPTIMISTIC_FORCE_INCREMENT`
- 재시도 로직 구현 패턴

### 비관적 락 (Pessimistic Lock)
- 충돌이 잦다고 가정 — 조회 시점에 DB 락 획득
- `LockModeType.PESSIMISTIC_WRITE` — SELECT FOR UPDATE
- `LockModeType.PESSIMISTIC_READ` — SELECT FOR SHARE
- 데드락 주의사항, 타임아웃 설정

### 어떤 락을 선택하는가?
- 충돌 빈도 낮음 + 성능 중요 → 낙관적 락
- 충돌 빈도 높음 + 정합성 중요 → 비관적 락

---

## 14. 감사 (Auditing)

### Spring Data JPA Auditing
- `@EnableJpaAuditing`
- `@CreatedDate` — 생성 시간 자동 입력
- `@LastModifiedDate` — 수정 시간 자동 입력
- `@CreatedBy` / `@LastModifiedBy` — 생성자/수정자
- `AuditorAware<T>` 구현 — 현재 로그인 사용자 제공
- `@EntityListeners(AuditingEntityListener.class)`

### BaseEntity 패턴
- 공통 필드(`createdAt`, `updatedAt`, `createdBy`, `modifiedBy`)를 `@MappedSuperclass`로 추출
- 모든 엔티티에서 상속
- `@MappedSuperclass` — 테이블 미생성, 필드만 상속

---

## 15. 성능 최적화 심화

### 조회 최적화 전략 (우선순위)
1. 엔티티 조회 + Batch Size → 코드 단순, 재사용 가능
2. Fetch Join / `@EntityGraph` → 특정 쿼리 최적화
3. DTO 직접 조회 → 성능 극한 최적화 (재사용성 낮음)
4. 네이티브 SQL / JdbcTemplate → 정말 복잡한 쿼리

### 쓰기 최적화
- `saveAll()` — 반복 `save()` 대신 일괄 처리
- `JDBC Batch Insert` — Hibernate 배치 설정
  - `hibernate.jdbc.batch_size`
  - `IDENTITY` 전략은 배치 INSERT 불가 (이유 포함)
- `@Modifying` 벌크 UPDATE/DELETE

### 커넥션 풀 최적화
- HikariCP `maximumPoolSize` 계산법
- 적절한 풀 사이즈 공식 (CPU 코어 * 2 + 유효 디스크 수)
- 풀 사이즈가 너무 크면 오히려 성능 저하

### 2차 캐시
- 1차 캐시(영속성 컨텍스트) vs 2차 캐시(애플리케이션 전체)
- Ehcache / Caffeine 연동
- 실무 주의사항 (잘못된 캐시로 데이터 불일치)

---

## 16. 테스트

### `@DataJpaTest`
- JPA 관련 Bean만 로드 (컨트롤러, 서비스 미포함)
- 기본적으로 H2 인메모리 DB 사용
- 트랜잭션 + 자동 롤백
- `@AutoConfigureTestDatabase(replace = NONE)` — 실제 DB로 테스트

### Testcontainers + JPA
- `@ServiceConnection` (Spring Boot 3.1+) — 컨테이너 자동 연결
- MySQL / PostgreSQL 컨테이너로 실제 DB 동작 검증
- `@DynamicPropertySource` — 컨테이너 URL을 설정에 주입

### Repository 테스트 패턴
- `save()` → `flush()` → `clear()` → 재조회 패턴
- 1차 캐시 영향 제거 후 DB 조회 검증
- N+1 쿼리 수 검증 (쿼리 카운터 활용)

---

## 17. 실무 패턴 & 안티패턴

### 권장 패턴
- 모든 연관관계 `LAZY` 로딩 기본 설정
- `@ManyToOne`, `@OneToOne` 필드에 `fetch = FetchType.LAZY` 명시
- DTO 반환을 서비스 레이어 책임으로
- OSIV OFF + 서비스에서 트랜잭션 완료
- 전역 `default_batch_fetch_size` 설정 (100~1000)
- `@Transactional(readOnly = true)` — 조회 전용 서비스에 적용

### 안티패턴
- `@ManyToMany` 직접 사용 — 중간 테이블 컬럼 추가 불가
- EAGER 로딩 남용 — 예상 못한 쿼리, N+1 유발
- 엔티티를 API 응답으로 직접 반환 — 순환 참조, 과도한 데이터 노출, 스펙 변경 취약
- 트랜잭션 없는 LAZY 로딩 — `LazyInitializationException`
- ID만 있을 때 `findById()` 사용 — `getReferenceById()`로 프록시 사용
- 무분별한 `CascadeType.ALL` + `orphanRemoval` — 의도치 않은 대량 삭제

### 엔티티 설계 원칙
- 양방향 연관관계 필요성 재고 — 단방향으로 충분한지 먼저 검토
- `toString()` 오버라이드 주의 — 연관 엔티티 포함 시 무한 루프
- `equals()` / `hashCode()` — PK 기반 구현, Lombok `@EqualsAndHashCode` 주의

---

## 18. 버전별 주요 변경사항

### Hibernate 6.x (Spring Boot 3.x)
- Jakarta EE 10 전환 (`javax.persistence` → `jakarta.persistence`)
- 개선된 타입 매핑 시스템
- `@JdbcTypeCode(SqlTypes.JSON)` — JSON 컬럼 직접 지원
- UUID 기본 키 네이티브 지원
- 향상된 배치 처리
- `fetchResults()` / `fetchCount()` Deprecated

### Spring Data JPA 3.x
- `getReferenceById()` — `getOne()` 대체
- Pagination API 개선
- `List<T>` 반환 `deleteAllById()` 최적화
