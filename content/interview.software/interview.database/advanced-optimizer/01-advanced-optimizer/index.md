---
title: "[Series] Advanced Optimizer: 비용 기반 최적화의 심연"
author: jeffrey
date: 2026-04-07
tags: ["db-internals", "optimizer", "cbo", "execution-plan", "query-tuning", "index-hints"]
---

## Advanced Optimizer: 쿼리 실행의 물리적 결정론

사용자가 작성한 SQL은 선언적입니다. 하지만 이를 실행하는 것은 **비용 기반 옵티마이저(CBO)**의 물리적 선택입니다. 옵티마이저가 왜 특정 실행 계획을 선택했는지, 그리고 그 선택이 잘못되었을 때 어떻게 물리적 정석으로 유도할 것인지가 튜닝의 핵심입니다.

이 시리즈에서는 통계 정보의 함정부터 옵티마이저 힌트의 치명적인 활용법까지, 쿼리 엔진의 뇌를 분석합니다.

---

## 📚 심화 연구 주제

### 1. 비용 기반 최적화(CBO)의 내부 공식

- **Selectivity & Cardinality**: 옵티마이저가 데이터를 예상하는 수학적 모델.
- **Histogram**: 데이터 분포의 왜곡을 엔진이 어떻게 인지하는가.
- **Cost-Model**: CPU 연산 비용과 I/O 비용의 가중치 계산법.

### 2. 물리적 성능 가속 기술 (Scan & Seek)

- **ICP (Index Condition Pushdown)**: 스토리지 엔진 레벨에서 필터링을 끝내는 효율성.
- **MRR (Multi-Range Read)**: 랜덤 I/O를 순차 I/O로 치환하여 디스크 헤더의 움직임을 줄이는 기술.
- **Covering Index & Key Lookups**: 본 테이블 조회를 물리적으로 차단하는 임계점.

### 3. Optimizer Hints & Force Control

- **Join Order Optimization**: 드라이빙/드리븐 테이블을 강제로 제어하는 `STRAIGHT_JOIN` 전략.
- **Index Hints**: `USE/FORCE/IGNORE INDEX`의 정석적인 사용 시점과 위험성.
- **Execution Plan(EXPLAIN)의 정밀 해석**: `Extra` 칼럼의 숨겨진 의미 분석 (`Using filesort`, `Using temporary` 등).

### 4. 고급 조인 연산의 제어

- **Nested Loop vs Hash Join**: 옵티마이저가 인덱스 유무와 메모리 상황에 따라 조인 방식을 결정하는 임계점 분석.
- **Block Nested Loop(BNL)**: 조인 버퍼의 크기가 전체 성능에 미치는 물리적 영향.

이 시리즈를 통해 쿼리 하나가 시스템 전체의 성능을 결정하는 대용량 환경에서, 엔진의 선택을 완벽하게 예측하고 통제하는 능력을 배양합니다.
