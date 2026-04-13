---
title: "데이터베이스 파티셔닝 (Partitioning) 커리큘럼"
author: jeffrey
date: 2026-04-13
tags: ["partitioning", "table-management", "range-partition", "performance"]
---

## 데이터베이스 파티셔닝: 거대 테이블을 정복하는 기술

쇼핑몰의 주문 테이블이나 로그 테이블처럼 데이터가 수억 건씩 쌓이는 거대 테이블은 검색과 관리가 매우 힘듭니다. 파티셔닝은 하나의 물리적 테이블을 내부적으로 여러 개의 작은 조각으로 나누어, 성능과 관리 편의성을 동시에 잡는 기술입니다.

---

### 📚 학습 커리큘럼

#### [01. 파티셔닝 vs 샤딩: 무엇이 다른가?](./01-partitioning-vs-sharding.md)

- 물리 서버 분리(샤딩)와 테이블 논리적 분할(파티셔닝)의 차이 명확히 하기
- 언제 파티셔닝을 선택해야 하는가?

#### [02. 파티션 유형별 설계 전술](./02-partition-types.md)

- Range Partitioning: 시간/날짜 기반 데이터 관리에 최적
- List, Hash, Key Partitioning: 특정 범주나 균등 분포를 위한 선택
- 서브 파티셔닝(Sub-partitioning): 두 가지 기준을 섞는 심화 기술

#### [03. 파티션 프루닝(Partition Pruning)의 마법](./03-partition-pruning.md)

- 쿼리가 왜 수억 건 중 일부 파티션만 뒤지게 되는가?
- 옵티마이저가 올바른 파티션을 선택하도록 쿼리를 짜는 법

#### [04. 파티션 관리와 운영 효율화](./04-partition-maintenance.md)

- 매달 새로운 파티션을 추가하고 오래된 파티션을 DROP하는 작업 자동화
- Partition Exchange: 거대 데이터를 순식간에 넣고 빼는 기술

#### [05. 로컬 인덱스 vs 글로벌 인덱스](./05-local-global-index.md)

- 파티션별로 인덱스를 가질 것인가, 전체를 아우르는 인덱스를 가질 것인가?
- 각 방식에 따른 성능과 가용성 변화 분석

---

> [!NOTE]
> 파티셔닝은 성능 향상 효과도 있지만, 사실 **데이터 생명 주기(Lifecycle) 관리**의 편의성 측면에서 더 큰 위력을 발휘합니다.
