# 인덱스 최적화의 정석 (Index Strategy)

인덱스는 데이터베이스의 '목차' 그 이상입니다. 인덱스는 디스크 I/O라는 가장 비싼 비용을 최소화하기 위한 정교한 자료구조와 알고리즘의 결합체입니다. 이 섹션에서는 인덱스의 물리적 원리부터 복합 인덱스 설계의 정규 분포적 사고까지 분석합니다.

---

## 1. 인덱스의 핵심 가치

- **쿼리 성능의 핵심**: 90% 이상의 성능 이슈는 잘못된 인덱스 설계에서 기인합니다.
- **디스크 I/O 비용**: 무분별한 풀 테이블 스캔(Full Table Scan)은 시스템 전체의 I/O 병목을 유발합니다.
- **쓰기 성능과의 트레이드오프**: 인덱스 추가는 조회 속도를 높이지만, 삽입/수정 시 인덱리 트리 재구성을 위한 비용을 초래합니다.

---

## 2. 주요 연구 주제

- **B+Tree 구조**: 실제 데이터가 Leaf Node에서 어떻게 연결되고 리연결(Linked List)되는지 분석.
- **커버링 인덱스**: 테이블 데이터에 접근하지 않고 인덱스만으로 쿼리를 해결하는 물리적 최적화.
- **인덱스 스캔 범위**: 범위 조건(Range)과 동등 조건(Equal)에 따른 복합 인덱스 활용 원리.
- **MySQL vs PostgreSQL**: 클러스터드(Clustered) 인덱스와 힙(Heap) 테이블 구조의 성능적 차이.

---

## 3. 관련 아티클

- [01. B-Tree와 B+Tree: 인덱스가 데이터를 찾는 물리적 여정](./indexing-physical-journey.md)
- [02. 커버링 인덱스(Covering Index)로 디스크 I/O 절벽 넘기](./covering-index-internals.md)
- [03. 복합 인덱스(Composite Index)와 컬럼 순서의 미학](./composite-index-ordering.md)
- [04. Clustered Index(MySQL) vs Heap Table(Postgres): 아키텍처의 차이](./clustered-vs-heap.md)
