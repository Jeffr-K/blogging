---
title: "데이터베이스 아키텍처 (Database Architecture) 커리큘럼"
author: jeffrey
date: 2026-04-13
tags: ["architecture", "db-internals", "buffer-pool", "engine"]
---

## 데이터베이스 아키텍처: 엔진의 심장부를 이해하다

데이터베이스가 단순히 데이터를 저장하는 통이라고 생각하신다면 오산입니다. 수만 개의 동시 접속을 처리하면서도 단 한 글자의 데이터도 잃지 않기 위한 공학적 설계가 응집된 결정체입니다. 이 섹션에서는 서비스의 근간이 되는 DB 엔진의 내부 구조를 배웁니다.

---

### 📚 학습 커리큘럼

#### [01. Shared-Everything vs Shared-Nothing](./01-shared-architecture.md)

- 중앙 집중형과 분산형 아키텍처의 물리적 차이 분석
- 현대 클라우드 네이티브 DB(Aurora 등)가 택한 길

#### [02. MySQL InnoDB 엔진의 물리 구조](./02-innodb-architecture.md)

- Buffer Pool: 메모리에서 데이터가 머무는 원리
- Log Buffer와 Redo/Undo 로그의 역할
- 체인지 버퍼(Change Buffer)와 더블라이트 버퍼(Doublewrite Buffer)

#### [03. WAL(Write Ahead Logging) 매커니즘](./03-wal-mechanism.md)

- "왜 디스크에 쓰기 전에 로그부터 쓰는가?"
- 트랜잭션의 영속성(Durability)을 보장하는 물리적 흐름
- 체크포인트(Checkpoint)와 크래시 복구 과정

#### [04. 디스크 I/O와 페이지 관리](./04-disk-io-pages.md)

- 16KB 페이지 단위 관리의 이유
- 랜덤 I/O를 순차 I/O로 바꾸는 옵티마이저의 마법
- SSD vs HDD 환경에 따른 설정 최적화

#### [05. DB 성능 지표와 모니터링 아키텍처](./05-db-monitoring.md)

- CPU, Memory, Disk, Network 4대 지표 분석법
- 슬로우 쿼리(Slow Query)가 시스템 아키텍처에 주는 타격

---

> [!TIP]
> 아키텍처를 이해하는 것은 자동차의 보닛을 열고 엔진 구조를 보는 것과 같습니다. 내부를 알면 쿼리가 왜 느린지 본능적으로 직감하게 됩니다.
