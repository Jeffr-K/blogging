---
title: "ScyllaDB (Cassandra) Deep Dive — Shard-Per-Core 기반의 극한 성능"
author: jeffrey
date: 2026-04-07
tags: ["scylladb", "cassandra", "nosql", "lsm-tree", "distributed-database", "seastar"]
---

## ScyllaDB & Cassandra: 분산 NoSQL의 정점

Cassandra의 강력한 분산 아키텍처(Gossip, Ring)와 ScyllaDB의 극한의 하드웨어 활용 능력을 결합한 섹션입니다. 특히 ScyllaDB가 C++와 Seastar 프레임워크를 통해 어떻게 JVM의 한계를 넘었는지 분석합니다.

## 🔍 핵심 탐구 주제 (클로드 작업 지점)

### 1. Shard-per-core 아키텍처
- **Seastar Framework**: CPU 코어마다 독립적인 메모리와 스레드를 할당하는 '공유 자원 없는(Shared-nothing)' 구조.
- **Zero-copy I/O**: 커널과의 컨텍스트 스위칭을 최소화하는 하드웨어 가속 기술.

### 2. LSM-Tree와 쓰기 성능의 정수
- **Memtable & SSTable**: 쓰기 성능을 극대화하는 로그 구조 머지 트리(LSM)의 물리적 동작.
- **Compaction Strategy**: 읽기 증폭과 쓰기 증폭 사이의 임계점 관리(Size-tiered vs Leveled).

### 3. 분산 합의와 데이터 정합성
- **Gossip Protocol**: 노드 간 상태 전파와 장애 감지 메커니즘.
- **Tunable Consistency**: 쿼리 시점의 CL(Consistency Level) 설정이 정합성과 가용성에 미치는 영향.

---

## 🛠️ 실무 지침
Cassandra의 정체성인 **CQL과 데이터 모델링**을 다루되, ScyllaDB의 **자동 튜닝 기능**이 어떻게 운영 오버헤드를 줄이는지 강조하여 작성하십시오.
