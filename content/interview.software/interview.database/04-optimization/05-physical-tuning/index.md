---
title: "물리적 아키텍처와 튜닝 (Physical & Memory Tuning)"
author: jeffrey
date: 2026-04-07
tags: ["db-optimization", "physical-tuning", "buffer-pool", "partitioning", "sharding", "memory-management"]
---

## 물리적 튜닝: 하드웨어 리소스 최적화의 기술

데이터베이스 성능의 최종 도달점은 물리적 자원(CPU, Memory, Disk)의 효율적인 관리입니다. 쿼리 최적화가 논리적 경로의 효율화라면, 물리적 튜닝은 데이터를 담는 메모리 구조와 디스크 배치 전략을 통해 하드웨어의 한계를 극복하는 과정입니다.

---

## 1. 물리적 자원 관리의 핵심 가치

- **디스크 I/O 최소화**: 가장 느린 지점인 디스크 접근을 억제하고, 메모리(Cache) 내에서 쿼리 연산이 완결되도록 유도합니다.
- **데이터 규모의 수평적 확장**: 단일 테이블 수억 건 이상의 임계치 도달 시 발생하는 검색 성능 저하를 방지하기 위해 파티셔닝과 샤딩을 적용합니다.
- **자원 할당 최적화**: 운영체제(OS)와 데이터베이스 사이의 메모리 점유 균형을 맞추어 전체 시스템의 안정성을 확보합니다.

---

## 2. 주요 탐구 주제

- **Buffer Pool & Shared Buffers**: MySQL과 PostgreSQL 엔진별 메모리 캐싱 아키텍처의 물리적 차이 분석.
- **Partitioning**: 논리적으로는 하나의 테이블이나 디스크 레벨에서 데이터를 분산 저장하는 물리적 분할 기술.
- **Sharding**: 다수의 데이터베이스 서버 노드로 데이터를 수평 분산하여 처리량을 확장하는 전략.
- **Page Split & Fragmentation**: 부적절한 데이터 타입 선정으로 인해 발생하는 디스크 단편화 및 쓰기 성능 저하 방지 기법.

---

## 3. 관련 아티클

- [01. Buffer Pool & Shared Buffers: 데이터베이스 메모리 매니지먼트의 원리](./buffer-pool-shared-buffers.md)
- [02. 테이블 파티셔닝(Partitioning): 대용량 데이터의 수직적 분할과 가지치기](./table-partitioning.md)
- [03. 샤딩(Sharding) 설계 전략: 데이터 분산 저장과 수평적 확장의 정수](./sharding-strategy.md)
- [04. 효율적 데이터 타입 선정과 페이지 분할(Page Split) 방지 기술](./data-types-page-splits.md)
