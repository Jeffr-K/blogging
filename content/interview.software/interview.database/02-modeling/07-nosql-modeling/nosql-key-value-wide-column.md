---
title: "DB Modeling: Redis와 Cassandra — 접근 패턴 중심 설계"
author: jeffrey
date: 2026-04-06
tags: ["db-modeling", "nosql", "redis", "key-value", "cassandra", "wide-column", "lsm-tree", "ranking-system", "access-pattern"]
---

## 데이터보다 사용 패턴: NoSQL의 접근 중심 설계

관계형(RDBMS)에서는 "데이터가 무엇인가"를 먼저 고민하고 테이블을 정규화한다. 하지만 **Key-Value(Redis)**와 **Wide Column(Cassandra)**의 세계에서는 정반대로 **"어떻게 조회할 것인가(Access Pattern)"**를 먼저 결정해야만 모델링을 시작할 수 있다.

이 초고속 저장소들은 조회 방식에 맞춰 데이터를 물리적으로 배치하기 때문이다. 이번 아티클에서는 Redis의 고성능 자료구조와 Cassandra의 쓰기에 최적화된 설계를 딥다이브해 본다.

---

## 1. 딥다이브: Redis (Key-Value) — 인메모리 속도의 마법

Redis는 단순한 키-값이 아니다. 데이터의 성격에 맞는 **고급 자료구조(Data Structures)**를 선택하는 것이 모델링의 핵심이다.

- **Sorted Set (ZSET)**: 실시간 랭킹 시스템의 정석. 가중치(Score)를 기반으로 데이터를 자동 정렬하여, 수천만 명 중 상위 10명을 나노초 만에 뽑아낸다.
- **Hash**: 객체 지향의 데이터를 저장할 때 칼럼별로 수정이 용이하고 메모리 효율이 좋다.
- **Bits/HyperLogLog**: 수백만 명의 일일 방문자 수를 단 몇 킬로바이트(KB)로 계산하는 마법 같은 확률적 자료구조.

---

## 2. 딥다이브: Cassandra (Wide Column) — 쓰기에 최적화된 괴물

카산드라는 모든 데이터를 **로그 스트럭처 머지 트리(LSM Tree)** 방식으로 디스크에 순차 쓰기(Sequential Write)한다.

- **Query-first Design**: 조인(Join)이 전혀 불가능하므로, 우리 서비스에서 필요한 조회 화면 개수만큼 테이블을 각각 따로 만들어 중복 저장한다. (데이터가 10배 늘어나도 읽기/쓰기 성능은 선형적으로 확장된다.)
- **Partition Key & Clustering Key**: 데이터를 어떤 서버에 저장할지(Partition), 그리고 그 서버 안에서 어떤 순서로 정렬할지(Clustering)를 정교하게 설계해야 범위 검색(Range Scan)이 작동한다.

---

## 3. 실전 가이드: TTL (Time to Live)과 캐싱 전략

NoSQL의 강력한 무기는 데이터의 수명을 정하는 **TTL**이다.

- **세션 및 토큰 관리**: Redis의 TTL을 사용하여 인증 정보를 자동 만료시키자.
- **임시 통계**: 카산드라의 쓰기 성능과 TTL을 결합하여, 거대한 로그 데이터를 수집하고 일정 기간 뒤에 자동으로 삭제되는 시스템을 구축하자.

---

## 요약

Redis와 Cassandra 브랜드의 모델링은 **"원하는 결과를 얻기 위해 데이터의 형태를 미리 휘어놓는 작업"**이다.

- Redis의 자료구조를 비즈니스 도메인(랭킹, 세션, 알림)에 맞춰 정밀하게 대조하자.
- Cassandra는 쿼리 화면 하나당 테이블 하나를 만드는 대담한 비정규화를 두려워하지 말자.
- 정적인 데이터가 아닌, **흐르는 데이터(Streaming Data)**를 초고속으로 처리하기 위한 최적의 수단으로 삼자.

이 초고속 저장소의 세계를 마쳤다면, 이제 단순한 값을 넘어 거대한 연결(Relation)을 직접 저장하는 **Graph DB와 AI 시대의 필수품 Vector DB**를 딥다이브할 준비가 된 것이다! 🚀
