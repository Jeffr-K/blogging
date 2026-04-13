---
title: "[Series] Advanced Distributed: 분산 시스템의 정합성과 합의 알고리즘"
author: jeffrey
date: 2026-04-07
tags: ["distributed-systems", "cap-theorem", "transaction", "2pc", "saga", "consensus", "paxos", "raft"]
---

## Advanced Distributed: 분산 환경에서의 데이터 일관성

물리적으로 떨어진 여러 데이터베이스에 걸쳐 트랜잭션을 수행하는 것은 현대 아키텍처의 최대 난제입니다. 네트워크는 언제든 끊길 수 있고, 메시지는 지연되거나 소실됩니다. **Advanced Distributed** 시리즈는 이러한 불확실성 속에서 데이터 정합성(Consistency)을 어떻게 보장할 것인가를 논합니다.

---

## 📚 심화 연구 주제

### 1. 분산 컴퓨팅의 철학 (CAP/PACELC)
- **CAP Theorem**: 일관성(C), 가용성(A), 파티션 용인(P) 중 무엇을 포기할 것인가.
- **Eventual Consistency**: 실시간이 아닌 '언젠가는 맞을' 정합성을 다루는 기술.
- **PACELC Theorem**: 지연 시간(Latency)과 정합성(Consistency)의 트레이드오프 분석.

### 2. 분산 트랜잭션 제어 (Atomic Commit Protocols)
- **2PC (Two-Phase Commit)**: 강력한 정합성을 위한 봉쇄형 프로토콜의 한계와 임팩트.
- **3PC (Three-Phase Commit)**: 대기 현상을 완화하기 위한 타임아웃 도입의 물리적 원리.
- **Transactional Outbox 패턴**: 비즈니스 로직과 외부 이벤트(Message Queue) 발행의 원자성 확보.

### 3. Saga 패턴과 보상 트랜잭션 (Event-Driven System)
- **Choreography-based Saga**: 브로커를 통한 비중앙화된 트랜잭션 흐름 제어.
- **Orchestration-based Saga**: 중앙 관제자를 통한 복잡한 트랜잭션의 상태 관리.
- **Compensation (보상 트랜잭션)**: 분산 환경에서 롤백을 구현하는 논리적/물리적 방법.

### 4. 합의 알고리즘 (Consensus Algorithms)
- **Paxos & Raft**: 데이터베이스 클러스터 내에서 다수가 동일한 결과를 합의하는 매커니즘.
- **Quorum Read/Write**: 분산 노드 중 몇 개 이상의 응답을 받아야 성공으로 간주할 것인가.
- **Conflict Resolution**: 동일한 데이터에 동시 수정이 발생했을 때의 충돌 해결 전략 (LWW 등).

이 시리즈를 통해 멀티 리전(Multi-region), 멀티 데이터베이스 환경에서도 비즈니스의 무결성을 완벽하게 사수하는 분산 시스템 설계의 정수를 완성합니다.
