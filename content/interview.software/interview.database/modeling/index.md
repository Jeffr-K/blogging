# Database Modeling A to Z: 설계의 미학

데이터베이스 모델링은 단순히 데이터를 저장할 장소를 만드는 것이 아닙니다. 그것은 비즈니스의 복잡한 도메인을 **가장 효율적이고 확장 가능한 구조로 조작(Mapping)**하는 고도의 아키텍처 작업입니다. 본 섹션에서는 모델링의 기초부터 면접에서 단골로 등장하는 심화 패턴까지 완벽하게 정복합니다.

---

## 1. [모델링의 3단계: 개념에서 물리까지](./01-three-levels-of-modeling/index.md)

- 개념적 모델링(Conceptual): ERD와 엔티티 추출의 본질
- 논리적 모델링(Logical): 속성과 관계의 정의, 매핑 룰
- 물리적 모델링(Physical): 스토리지 엔진, 데이터 타입, 성능 최적화

## 2. [관계 설계와 무결성 (Relationship & Integrity)](./02-relationships-and-integrity/index.md)

- 1:1, 1:N, M:N 관계의 해소와 매핑 테이블(Intersection Table)
- 식별 관계(Identifying) vs 비식별 관계(Non-identifying)의 선택 기준
- 참조 무결성(Referential Integrity)과 Cascade 정책의 내부 동작

## 3. [정규화의 심연 (Normalization Deep Dive)](./03-normalization-deep-dive/index.md)

- 제1정규형(1NF)부터 BCNF까지: 이상 현상(Anomaly) 해결의 수학적 근거
- 고차 정규화(4NF, 5NF): 다치 종속(Multi-valued)과 조인 종속의 이해
- 정규화의 비용: 조인 오버헤드와 반정규화(Denormalization)의 결정 시점

## 4. [특수 구조 및 계층 모델링 (Hierarchy & Structures)](./04-hierarchical-modeling/index.md)

- 인접 리스트(Adjacency List) vs 경로 열거(Path Enumeration)
- 중첩 집합(Nested Sets) 모델의 조회 성능 극대화
- 클로저 테이블(Closure Table): 확장성과 성능을 모두 잡는 계층 구조의 정석

## 5. [이력 및 상태 데이터 관리 (History & State Pattern)](./05-history-and-state-management/index.md)

- 스냅샷(Snapshot) 데이터와 트랜잭션 이력의 분리 설계
- 유효 시작일/종료일을 이용한 기간 기반 이력 관리(Slowly Changing Dimension)
- 상태 머신(State Machine) 모델링: 상태 전이의 무결성 보장

## 6. [대규모 시스템을 위한 물리적 분할 (Scalability Planning)](./06-scalability-modeling/index.md)

- 수직적 분할(Vertical Partitioning)과 수평적 분할(Sharding)
- 인덱스 친화적인 모델링: 클러스터드 인덱스(Clustered Index)를 고려한 PK 선정
- 파티셔닝(Partitioning)의 물리적 오버헤드와 병렬 쿼리 최적화

## 7. [NoSQL 데이터 아키텍처 (NoSQL Modeling Strategy)](./07-nosql-modeling/index.md)

- Document Store(MongoDB)에서의 데이터 중복 vs 참조 결정
- Key-Value(Redis)와 Wide Column(Cassandra)의 접근 패턴 중심 설계
- 폴리글랏 퍼시스턴스(Polyglot Persistence): RDBMS와 NoSQL의 유기적 결합

## 8. [모델링 안티패턴과 실무 사례 (Anti-patterns & Case Study)](./08-anti-patterns/index.md)

- Polymorphic Association(다형성 관계)의 함정과 해결책
- EAV(Entity-Attribute-Value) 모델: 언제 쓰고 언제 피해야 하는가?
- 대규모 서비스의 실제 모델링 변천사 분석 (SNS, 커머스 등)

---

### ✨ 모델링 딥다이브 원칙 (The Modeling Manifesto)

1. **중복은 최소화하되, 성능을 위해 타협할 지점을 안다.**
2. **데이터의 무결성은 애플리케이션이 아닌 스키마 레벨에서 우선 방어한다.**
3. **현재의 기획이 아닌, 미래의 데이터 증가량을 보고 물리 구조를 결정한다.**

데이터 모델링의 마스터가 되어, 어떤 거대한 비즈니스 요구사항도 우아한 스키마로 풀어낼 수 있는 역량을 갖춰 봅시다.
