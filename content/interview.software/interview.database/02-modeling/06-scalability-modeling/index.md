# Section 06. 대규모 시스템을 위한 물리적 분할 (Scalability Planning)

데이터베이스 모델링의 최종 관문은 **확장성(Scalability)**입니다. 아무리 완벽한 논리 구조를 가졌더라도, 수억 건의 데이터와 초당 수만 건의 트래픽 앞에서는 물리적인 한계에 부딪힙니다. 이 섹션에서는 데이터를 물리적으로 분할하여 시스템의 한계를 지평선 너머로 넓히는 고급 설계 기법을 다룹니다.

## ✨ 왜(Why) 물리적 분할 설계가 중요한가요?

- **단일 서버의 한계 극복**: 물리적인 CPU, Memory, Disk I/O의 병목을 여러 장비로 분산하여 처리량을 극대화하기 위함입니다.
- **가용성(Availability) 확보**: 하나의 파티션이나 샤드가 고장 나더라도 나머지 시스템은 정상적으로 작동하는 '격리된 장애' 환경을 만들기 위함입니다.
- **비용 최적화**: 모든 데이터를 비싼 고성능 장비에 두는 대신, 빈도가 낮은 데이터를 저렴한 저장소로 옮기는 물리적 배치를 실현하기 위함입니다.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **Vertical vs Horizontal**: 테이블의 칼럼을 나누어 페이지 밀도를 높일 것인가, 행을 나누어 부하를 분산할 것인가.
- **Clustered Index PK**: MySQL과 같은 엔진에서 물리적 저장 순서를 결정짓는 PK 선정의 정교함.
- **Partitioning Overhead**: 파티셔닝이 주는 성능 이득과 그 이면에 숨겨진 관리적 오버헤드 분석.
- **Distributed Consistency**: 데이터가 여러 서버로 찢어질 때 포기해야 하는 ACID와 그 대안인 2PC, Saga 패턴.

## 🛠 어떻게(How) 탐구하나요?

- 100개가 넘는 칼럼을 가진 초대형 테이블을 '자주 쓰이는 칼럼'과 '가끔 쓰이는 칼럼'으로 수직 분할(Vertical Partitioning) 시도.
- 샤딩(Sharding) 도입 시 조인(Join)이 불가능해지는 지점을 찾고, 애플리케이션 레벨의 조인 로직 설계.
- 글로벌 서비스의 사용자 위치 기반 데이터 거점 분산(Data Sovereign) 모델링 실습.

---

## 📚 관련 아티클 목차

- [01. 수직적 분할(Vertical Partitioning)과 수평적 분할(Sharding)](./scalability-vertical-horizontal.md) (작성 예정)
- [02. 인덱스 친화적인 모델링: 클러스터드 인덱스를 고려한 PK 선정](./scalability-clustered-index-pk.md) (작성 예정)
- [03. 파티셔닝(Partitioning)의 물리적 오버헤드와 병렬 쿼리 최적화](./scalability-partitioning-overhead.md) (작성 예정)
- [04. 분산 데이터베이스 환경에서의 데이터 일관성: 2PC와 Saga 패턴](./distributed-db-consistency-2pc-saga.md) (작성 예정)
