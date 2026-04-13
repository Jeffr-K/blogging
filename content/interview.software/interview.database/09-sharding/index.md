---
title: "데이터베이스 샤딩 (Sharding) 커리큘럼"
author: jeffrey
date: 2026-04-13
tags: ["sharding", "scalability", "distributed-database", "sharding-key"]
---

## 데이터베이스 샤딩: 무한한 성장을 지탱하는 물리적 분할

단일 서버의 사양을 높이는 '수직 확장(Scale-up)'만으로는 한계가 오는 시점이 반드시 옵니다. 수억 명의 유저, 초당 수십만 건의 트랜잭션을 감당하기 위해 데이터를 여러 서버로 쪼개어 담는 기술, 샤딩의 정점을 배웁니다.

---

### 📚 학습 커리큘럼

#### [01. 샤딩의 본질과 필요성](./01-sharding-concepts.md)

- 수평 확장(Scale-out)이 필요한 임계점은 언제인가?
- 샤딩 도입 전 반드시 체크해야 할 체크리스트

#### [02. 샤딩 키(Sharding Key) 선정 전략](./02-sharding-key-design.md)

- Range, Hash, List 기반 분산의 장단점
- Hotspot(특정 서버 쏠림) 현상을 피하는 수학적 설계
- 한 번 결정하면 바꾸기 힘든 키 선정의 치명적인 함정들

#### [03. 샤딩 아키텍처 모델링](./03-sharding-architecture.md)

- Client-side Sharding vs Proxy-based Sharding (Vitess, Citus 등)
- 데이터 소스(Data Source) 동적 라우팅 구현 원리

#### [04. 분산 환경의 난제: 분산 트랜잭션](./04-distributed-transactions.md)

- 서로 다른 물리 서버 간의 정합성 보장법
- 2PC(Two-Phase Commit)의 한계와 Saga/TCC 패턴의 등장
- 분산 환경에서의 글로벌 식별자(Snowflake ID 등) 생성 전략

#### [05. 리샤딩(Resharding)과 무중단 마이그레이션](./05-resharding-strategy.md)

- 데이터가 가득 차서 서버를 한 대 더 추가해야 할 때
- 서비스 중단 없이 데이터를 재배치하는 물리적 기술

---

> [!CAUTION]
> 샤딩은 데이터베이스의 최후의 보루입니다. 시스템 복잡도가 비약적으로 높아지므로, 인덱싱과 쿼리 튜닝으로 더 이상 버틸 수 없을 때 최후에 선택해야 합니다.
