---
title: "동시성 제어와 MVCC (Concurrency & Lock)"
author: jeffrey
date: 2026-04-07
tags: ["db-optimization", "concurrency", "lock", "mvcc", "transaction", "isolation-level"]
---

## 동시성 제어: 멀티 세션 환경의 정합성 사수

데이터베이스의 성능은 단순 조회 속도에 국한되지 않습니다. 수만 명의 사용자가 동시에 데이터를 수정할 때 충돌을 최소화하고 정합성을 유지하는 **동시성(Concurrency)** 처리가 진정한 엔진의 성능 척도입니다. 

이 섹션에서는 잠금(Lock) 메커니즘과 다중 버전 동시성 제어(MVCC)의 물리적 동작 원리를 분석합니다.

---

## 1. 동시성 제어 기술의 핵심 가치

- **데이터 정합성 보장**: 동시 커밋 상황에서 데이터 덮어쓰기(Lost Update)나 사라짐 현상을 물리적으로 방어합니다.
- **교착 상태(Deadlock) 관리**: 자원 경합으로 인한 시스템 중단을 진단하고 예방하는 메커니즘을 탐구합니다.
- **비차단 조회(Non-blocking Read)**: "읽는 세션은 쓰는 세션을 막지 않는다"는 MVCC 원칙을 통해 조회 성능을 극대화합니다.

---

## 2. 주요 탐구 기술

- **MVCC (Multi-Version Concurrency Control)**: 언두 로그(Undo Log)와 데이터 스냅샷(Snapshot)을 활용한 시점 관리 기술.
- **MySQL Gap Lock**: 인덱스 레코드 사이의 빈 공간을 잠가 팬텀 리드(Phantom Read)를 물리적으로 차단하는 기법.
- **PostgreSQL Vacuum**: MVCC 수행 결과로 발생한 데드 튜플(Dead Tuple)을 정리하고 트랜잭션 ID 가시성을 관리하는 시스템 프로세스.
- **트랜잭션 격리 수준**: 일관성(Consistency)과 동시성(Concurrency) 사이의 물리적 트레이드오프 분석.

---

## 3. 관련 아티클

- [01. MVCC(Multi-Version Concurrency Control): 동시성 제어의 내부 구현](./mvcc-internals.md)
- [02. MySQL의 Gap Lock과 Next-Key Lock: 팬텀 리드 차단의 원리](./mysql-locks-phantom-read.md)
- [03. PostgreSQL의 Vacuum: 데이터 파편화와 가시성 제어 메커니즘](./postgres-vacuum.md)
- [04. Deadlock 탐지와 트랜잭션 격리 수준별 성능 임팩트 분석](./deadlock-and-isolation.md)
