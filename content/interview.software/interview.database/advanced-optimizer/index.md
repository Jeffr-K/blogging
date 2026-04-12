# Database Optimization: 성능의 끝판왕 (MySQL & PostgreSQL)

데이터베이스 최적화는 단순히 쿼리를 빠르게 하는 것을 넘어, 데이터베이스 엔진의 내부 메커니즘을 이해하고 리소스를 가장 효율적으로 사용하는 아트를 지향합니다. 본 섹션에서는 MySQL(InnoDB)과 PostgreSQL의 실제 엔진 동작 원리를 바탕으로 실전 최적화 전략을 탐구합니다.

---

## 1. [인덱스 최적화의 정석 (Index Strategy)](./01-indexing-strategy/index.md)

- B-Tree와 B+Tree 구조의 Deep Dive: 데이터가 디스크에서 찾아지는 여정
- 커버링 인덱스(Covering Index)로 디스크 I/O 절벽 넘기
- 복합 인덱스(Composite Index)의 순서 결정 논리와 스캔 범위 최적화
- MySQL의 Clustered Index vs PostgreSQL의 Heap Table 구조 차이

## 2. [실행 계획과 옵티마이저 (Explain & Optimizer)](./02-execution-plan/index.md)

- `EXPLAIN` 분석법: 필터링(Filtering), 정렬(Sorting), 임시 테이블의 비용 계산
- 옵티마이저의 편견: 인덱스 풀 스캔 vs 테이블 풀 스캔의 선택 기준
- 인덱스 힌트(Index Hint)와 통계 정보(Statistics)의 중요성

## 3. [물리적 조인 메커니즘 (Join Internals)](./03-join-mechanisms/index.md)

- Nested Loop Join: 인덱스가 주도하는 조인의 정밀함
- Hash Join & Merge Join: 대용량 데이터 조인을 위한 엔진의 선택 (MySQL 8.0+ vs PG)
- 서브쿼리(Subquery) vs 조인: 옵티마이저의 재작성(Rewrite) 비밀

## 4. [동시성 제어와 MVCC (Concurrency & Lock)](./04-concurrency-control/index.md)

- MVCC(Multi-Version Concurrency Control)의 내부 동작: Dirty Read 방지의 원리
- MySQL의 Gap Lock과 Next-Key Lock: 팬텀 리드(Phantom Read) 방지 전략
- PostgreSQL의 Vacuum: 데이터 파편화(Fragmentation)와 가시성 관리의 대가

## 5. [물리적 아키텍처와 튜닝 (Physical & Memory Tuning)](./05-physical-tuning/index.md)

- MySQL Buffer Pool vs PostgreSQL Shared Buffers: 메모리 매니지먼트의 차이
- 파티셔닝(Partitioning)과 샤딩(Sharding): 물리적 한계를 지평선 너머로
- 정적 데이터 타입과 페이지 분할(Page Split) 방지 최적화

## 6. [실전 성능 분석과 장애 대응 (Monitoring & Tools)](./06-monitoring-and-profiling/index.md)

- 슬로우 쿼리(Slow Query) 로그 분석과 프로파일링 기법
- 데드락(Deadlock) 탐지와 트랜잭션 수명 관리
- 성능 모니터링 툴(Performance Schema, pg_stat_statements) 활용 가이드

---

### ✨ 최적화의 골든 룰 (The Optimization Manifesto)

1. **측정하지 않은 성능은 개선할 수 없다. 반드시 `EXPLAIN`으로 시작하라.**
2. **최고의 쿼리는 아예 날리지 않는 쿼리다. 캐시와 모델링을 먼저 점검하라.**
3. **인덱스는 양날의 검이다. 읽기 성능을 위해 쓰기 성능을 어디까지 포기할지 결정하라.**

엔진의 내부를 들여다보는 통찰력을 길러, 수억 건의 데이터도 나노초 단위로 처리하는 고성능 백엔드 엔지니어의 길로 나아가 봅시다.
