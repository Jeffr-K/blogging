---
title: "[DB Master] 데이터베이스 트랜잭션과 ACID: 무결성을 수호하는 물리적 구현체"
author: jeffrey
date: 2026-04-07
tags: ["db-internals", "transaction", "acid", "redo-log", "undo-log", "wal", "crash-recovery", "mvcc"]
---

## 트랜잭션(Transaction): ACID의 물리적 구현 체계와 정합성 매커니즘

데이터베이스 트랜잭션의 **ACID(Atomicity, Consistency, Isolation, Durability)**는 단순한 이론적 약속이 아닙니다. 이는 데이터베이스 엔진이 하드웨어의 물리적 한계(정전, 디스크 고장, 메모리 오염) 속에서도 데이터의 무결성을 보장하기 위해 설계한 거대한 아키텍처의 집합입니다.

기술전수자로서, InnoDB와 같은 현대적 스토리지 엔진이 **Redo/Undo 로그, WAL(Write Ahead Log), 그리고 MVCC**를 통해 ACID를 어떻게 물리적으로 완성하는지 그 깊은 내부를 전수합니다.

---

## 1. Atomicity(원자성): "All or Nothing"의 물리적 실체

원자성은 트랜잭션 내의 모든 연산이 완벽히 수행되거나, 하나라도 실패하면 전체를 취소(Rollback)하여 "흔적조차 남기지 않는" 성질입니다.

### 1.1 Undo Log: 과거로의 타임머신

DB 엔진은 변경 전의 데이터를 별도의 버퍼인 **Undo Segment**에 먼저 기록합니다.

- **Rollback 시**: 사용자가 취소를 요청하면 Undo 로그를 역순으로 실행하여 데이터를 원상 복구합니다.
- **Crash Recovery 시**: 전원이 꺼졌다가 복구될 때, 커밋되지 않은(Uncommitted) 트랜잭션들을 Undo 로그를 참조하여 모두 되돌림으로써 무결성을 보호합니다.

> **Master's Analysis**: 원자성의 핵심은 '성공'이 아니라 **'실패 시의 복구 담보'**에 있습니다. Undo 로그는 단순히 롤백을 위해서만 존재하는 것이 아니라, 뒤에 설명할 MVCC의 근간이 되어 "읽기와 쓰기의 비차단성"을 제공하는 핵심 자산입니다.

---

## 2. Consistency(일관성): 비즈니스 제약과 엔진의 협업

트랜잭션이 완료된 데이터베이스는 미리 정의된 모든 스키마 규칙(제약 조건)을 준수해야 합니다.

- **물리적 제약(Constraints)**: PK 중복 방지, FK 참조 무결성, NOT NULL 제약 등 엔진 레벨에서 강제하는 규칙.
- **논리적 제약(Application)**: "계좌 잔액은 0원 밑으로 내려갈 수 없다"와 같은 비즈니스 로직에 따른 정합성.

일관성은 DB 엔진의 책임(기능적 무결성)과 개발자의 책임(논리적 무결성)이 만나는 지점입니다.

---

## 3. Isolation(고립성): 동시성과 정합성의 가혹한 트레이드오프

수천 명의 사용자가 동시에 데이터를 수정해도, 각 트랜잭션은 자신이 유일하게 DB를 사용하고 있다고 느껴야 합니다. 현대 DB는 이를 위해 **Locking** 대신 **MVCC(Multi-Version Concurrency Control)**를 선택했습니다.

### 3.1 MVCC와 스냅샷 격리

- 데이터를 직접 잠그지 않고, 특정 시점의 데이터 **Snapshot(Undo Log에 저장된 이전 버전)**을 보여줍니다.
- **효과**: 읽기 작업이 쓰기 작업을 방해하지 않으며(Read/Write Non-blocking), 동시 처리량을 기하급수적으로 높입니다.

### 3.2 격리 수준(Isolation Levels)의 물리적 비용

1. **READ COMMITTED**: 매 쿼리 시점마다 새로운 Read View를 생성.
2. **REPEATABLE READ (InnoDB 기본)**: 트랜잭션 시작 시점의 Read View를 끝까지 유지하여 일관성 있는 조회를 보장.

---

## 4. Durability(지속성): "기록된 것은 영원히 남는다"

성공적으로 커밋된 데이터는 화재나 정전을 겪어도 다시 살아나야 합니다. 하지만 실제 테이블 파일(.ibd)에 바로 쓰는 것은 Random I/O 비용이 너무 큽니다.

### 4.1 WAL(Write Ahead Logging) 원칙

"실제 데이터 페이지를 디스크에 쓰기 전에, 반드시 로그부터 써라."

1. **Redo Log**: 변경 사항을 메모리 버퍼에 기록하자마자, 가벼운 순차 쓰기(Sequential I/O)인 **Redo Log** 파일에 먼저 기록합니다.
2. **fsync()**: 운영체제 캐시가 아닌 실제 물리 디스크 플래터에 데이터가 기록되었음을 OS 명령으로 확정합니다.

### 4.2 Crash Recovery 매커니즘

시스템이 재부팅되면 엔진은 Redo Log를 읽어 디스크에 미처 반영되지 못한(Dirty Page) 데이터들을 다시 실행(Replay)하여 메모리와 디스크의 상태를 일치시킵니다.

---

## 5. ACID의 설계적 완성도 요약

| ACID 속성 | 핵심 물리 구현체 | 역할 및 핵심 가치 |
| :--- | :--- | :--- |
| **Atomicity** | **Undo Log** | 실패 시 이전 상태로의 완벽한 복구 (롤백 가능성) |
| **Consistency** | **Schema & Trigger** | 데이터 모델의 구조적 무결성 강제 |
| **Isolation** | **MVCC / Lock** | 동시 실행 시 데이터 간섭과 부정 조회 방지 |
| **Durability** | **Redo Log / WAL** | 장애 후에도 커밋된 정보의 영속성 보장 (복구 담보) |

ACID는 독립적인 네 가지 성질이 아닙니다. **로그(Redo/Undo)**라는 하나의 거대한 인프라 위에서 유기적으로 결합하여 돌아가는 데이터베이스 엔진의 심장과 같습니다. 다음 아티클에서는 이러한 ACID가 깨지는 현상인 **트랜잭션 이상 현상(Anomalies)과 그 방어 전략**을 전수하겠습니다.
