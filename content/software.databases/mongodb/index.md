---
title: "MongoDB Deep Dive — 유연한 문서 모델과 분산 아키텍처"
author: jeffrey
date: 2026-04-07
tags: ["mongodb", "nosql", "document-store", "bson", "replication", "sharding"]
---

## MongoDB: 비정형 데이터의 유연성과 분산 처리의 조화

MongoDB는 JSON과 유사한 BSON 형식을 사용하여 복잡한 데이터 구조를 스키마의 제약 없이 저장할 수 있는 선도적인 문서형 NoSQL 데이터베이스입니다. WiredTiger 스토리지 엔진의 성능 특성을 이해하는 것이 대규모 워크로드 관리의 핵심입니다.

## 🔍 핵심 탐구 주제 (클로드 작업 지점)

### 1. WiredTiger 스토리지 엔진과 물리적 저장
- **BSON 저장 구조**: JSON의 장점과 바이너리 포맷의 효율성 분석.
- **Document-level Locking**: 동시성을 극대화하는 잠금 메커니즘과 쓰기 성능 최적화.

### 2. 가용성과 확장 전략 (Replica Set & Sharding)
- **Replica Set**: Raft 기반의 고속 선거(Election)와 데이터 가용성 보장.
- **Sharding Internals**: Chunk 분할과 밸런싱(Balancing) 과정의 물리적 리소스 소모.

### 3. 쿼리 최적화와 인덱싱 전략
- **Compound Index & Multikey Index**: 배열 및 다중 필드 인덱싱의 오버헤드와 최적의 키 순서.
- **Aggregation Framework**: 파이프라인(Pipeline) 연산의 메모리 사용량 최적화.

---

## 🛠️ 실무 지침
"Schema-less는 Schema-free가 아니다"라는 관점에서 **데이터 모델링(Embedding vs Referencing)**과 **정합성 요건**을 구체적으로 다루십시오.
