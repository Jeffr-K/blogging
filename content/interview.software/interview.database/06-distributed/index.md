---
title: "Advanced Distributed Database System — 분산 합의와 데이터 일관성의 물리적 한계"
author: jeffrey
date: 2026-04-07
tags: ["distributed-systems", "cap-theorem", "pacelc", "consensus", "consistency", "availability"]
---

## 분산 데이터베이스: 물리적 공간의 한계를 넘는 데이터 관리

단일 서버의 물리적 성능 임계치를 넘어서기 위해 데이터를 여러 노드에 분산하는 순간, 우리는 네트워크 지연(Network Partition)과 데이터 정합성(Consistency)이라는 거대한 기술적 난관에 봉착합니다. 

본 섹션에서는 분산 시스템의 이론적 토대인 CAP와 PACELC를 넘어, 현대적인 분산 DB(Spanner, CockroachDB, TiDB 등)들이 이를 어떻게 물리적으로 해결하고 있는지 분석합니다.

---

## 🔍 핵심 탐구 주제

- **분산 합의 알고리즘(Consensus)**: Raft와 Paxos의 동작 원리와 리더 선출 메커니즘.
- **데이터 분산 전략**: Consistent Hashing과 범위 분할(Range Partitioning)의 물리적 차이.
- **분산 트랜잭션과 원자성**: 2PC(Two-Phase Commit)의 성능 제약과 Saga 패턴을 통한 최종 일관성 확보.
- **PACELC 이론**: 네트워크 분리가 없을 때 발생하는 지연 시간(Latency)과 일관성 사이의 트레이드오프.

---

## 📚 아티클 리스트

1. [분산 시스템의 물리적 헌법: CAP vs PACELC 실무적 해석](./cap-pacelc-internals.md)
2. [분산 합의의 정수: Raft 알고리즘의 리더 선출과 로그 복제 로직](./raft-consensus-internals.md)
3. [분산 트랜잭션의 난제: 2PC의 한계와 분산 락(Distributed Lock) 설계](./distributed-transaction-2pc.md)
4. [글로벌 서비스의 데이터 배치: Consistent Hashing과 데이터 쏠림 방지 기술](./consistent-hashing-strategy.md)
