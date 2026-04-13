---
title: "실행 계획과 옵티마이저 (Explain & Optimizer)"
author: jeffrey
date: 2026-04-07
tags: ["db-optimization", "optimizer", "explain", "execution-plan", "query-tuning"]
---

## 실행 계획: 옵티마이저의 의사 결정 분석

데이터베이스 성능 튜닝의 핵심은 **실행 계획(Execution Plan)** 분석에 있습니다. 엔진 내부의 옵티마이저가 쿼리를 어떻게 해석하고 경로를 결정하는지 파악하는 능력은 대규모 시스템 운영의 필수 역량입니다.

---

## 1. 실행 계획 분석의 가치

- **옵티마이저의 선택 추정**: 인덱스 설계와 별개로, 옵티마이저가 데이터 분포나 비용 계산에 따라 인덱스 스캔 대신 풀 테이블 스캔을 선택하는 논리적 근거를 파악합니다.
- **물리적 병목 탐지**: 단순 응답 속도를 넘어, CPU 부하를 유발하는 정렬(`Using filesort`)이나 메모리 사용량이 큰 임시 테이블(`Using temporary`) 생성을 사전에 감지합니다.
- **성능 예측**: 데이터 규모가 증가했을 때 서비스 안정성을 유지할 수 있을지 판별하는 물리적 근거를 제공합니다.

---

## 2. 주요 분석 지표

- **type 필드**: `const`, `eq_ref`, `ref`, `range`, `index`, `ALL` 등 조인 및 스캔 방식의 계층적 우선순위 분석.
- **Extra 필드**: 엔진이 쿼리 최적화를 위해 수행하는 내부 부가 작업(`Using index`, `Using filesort`, `Using temporary`)의 의미.
- **rows & filtered**: 예상 행 수와 필터링 성공률의 정교함이 실행 계획 전체 비용에 미치는 영향.

---

## 3. 관련 아티클

- [01. EXPLAIN 분석법: 옵티마이저의 의사 결정 메커니즘](./explain-analysis.md)
- [02. Using Filesort와 Using Temporary: 정렬 비용과 임시 테이블의 물리적 실체](./filesort-temporary.md)
- [03. Index Condition Pushdown (ICP)과 인덱스 힌트 활용 전략](./icp-and-index-hints.md)
- [04. 쿼리 성능을 좌우하는 데이터베이스 통계 정보(Statistics)의 한계](./query-statistics.md)
