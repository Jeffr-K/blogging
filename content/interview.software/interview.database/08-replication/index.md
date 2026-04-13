---
title: "데이터베이스 복제 (Replication) 커리큘럼"
author: jeffrey
date: 2026-04-13
tags: ["replication", "high-availability", "master-slave", "consistency"]
---

## 데이터베이스 복제: 멈추지 않는 서비스를 위한 기술

단 한 대의 DB 서버만 운영하는 것은 전쟁터에서 방패 없이 싸우는 것과 같습니다. 복제(Replication)는 데이터의 사본을 실시간으로 만들어 부하를 분산하고, 주 서버가 죽었을 때 즉시 대체하기 위한 핵심 기술입니다.

---

### 📚 학습 커리큘럼

#### [01. 복제 원리와 Binlog 매커니즘](./01-replication-basics.md)

- 바이너리 로그(Binary Log)와 릴레이 로그(Relay Log)의 흐름
- Row-based vs Statement-based vs Mixed 복제 방식 비교

#### [02. 동기 방식에 따른 복제 전략](./02-sync-strategies.md)

- 비동기(Asynchronous): 성능은 좋지만 데이터 소실 위험이 있다?
- 반동기(Semi-synchronous): 데이터 안정성을 챙기는 중용의 방식
- 완전 동기(Group Replication): 강력한 일관성을 위한 선택

#### [03. 복제 지연(Replication Lag) 해결하기](./03-replication-lag.md)

- 왜 사본 DB의 입고가 늦어지는가?
- 멀티 스레드 복제(Multi-threaded Slave) 설정과 최적화
- 데이터 일관성 위배 상황에서의 애플리케이션 대응 전략

#### [04. 고가용성(HA)과 페일오버(Failover)](./04-ha-and-failover.md)

- 자동화된 주 서버 전환 방식 분석
- MHA(Master High Availability), Orchestrator 등 도구 활용법
- 가상 IP(VIP)와 DNS 기반 전환의 장단점

#### [05. 멀티 소스 및 체인형 복제 아키텍처](./05-advanced-topology.md)

- 여러 마스터를 하나의 슬레이브로 묶는 법
- 대규모 서비스를 위한 계층형 복제(Tree Topology) 구성

---

> [!IMPORTANT]
> 복제는 단순히 복사본을 만드는 것이 아니라, **"얼마나 신선한 데이터를 얼마나 안전하게 유지할 것인가"**에 대한 끊임없는 트레이드오프의 연속입니다.
