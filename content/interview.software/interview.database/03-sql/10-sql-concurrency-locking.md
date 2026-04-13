---
title: "[DB Master] 10. Concurrency Control SQL: 락(Lock) 대기 없는 고성능 큐(Queue) 설계"
author: jeffrey
date: 2026-04-07
tags: ["sql", "concurrency-control", "for-update", "skip-locked", "nowait", "locking-strategy", "worker-queue"]
---

## Concurrency Control SQL: 병목 없는 데이터 처리

대량의 트래픽이 몰리는 환경에서 데이터베이스 성능의 최대 장벽은 **'락 대기(Lock Wait)'**입니다. 수배 개의 서버가 동시에 선착순 쿠폰이나 미처리 작업을 가져가려 할 때, 엔진은 정합성을 지키기 위해 특정 세션을 대기시킵니다. 대기 줄이 길어지면 시스템은 응답 불능 상태에 도달합니다.

**`FOR UPDATE SKIP LOCKED`**와 **`NOWAIT`**은 이 대기 줄을 최소화하거나 제거하는 도구입니다. 데이터베이스를 고성능 비침입형 작업 큐(Queue) 엔진으로 운영하는 전략을 분석합니다.

---

## 1. 비차단 락(Non-blocking Lock)의 물리적 메커니즘

전통적인 `SELECT ... FOR UPDATE`는 배타적 잠금(Exclusive Lock)을 시도하며, 이미 락이 걸린 행을 만나면 해제될 때까지 대기합니다.

### 1.1 NOWAIT (즉시 실패)

락을 즉시 획득할 수 없는 경우 대기 없이 즉시 에러(`Resource busy`)를 반환합니다. 빠른 실패(Fail-fast)를 통해 사용자에게 즉각적인 피드백을 전달해야 할 때 유용합니다.

### 1.2 SKIP LOCKED (건너뛰기)

락이 걸린 행을 만나면 대기하거나 에러를 내지 않고, 해당 행만 결과셋에서 제외한 뒤 다음 가능한 행을 탐색합니다. 여러 워커가 작업을 중복 없이 공평하게 나눠 가져가야 하는 시스템의 핵심 기술입니다.

---

## 2. 실전: `SKIP LOCKED`를 이용한 고성능 작업 큐 설계

수만 건의 작업을 처리해야 하는 분산 워커 환경에서의 설계 예시입니다.

### 2.1 대기 시간 0의 고성능 쿼리

워커 A가 1번 행을 잡으면, 워커 B는 1번을 건너뛰고 2번을 즉시 낚아챕니다.

```sql
SELECT id, task_data
FROM job_queue 
WHERE status = 'PENDING'
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

> **핵심 원리**: `SKIP LOCKED`는 엔진이 인덱스 스캔 중 이미 락이 걸린 노드를 만나면 지체 없이 다음 노드로 이동하게 만듭니다. 이를 통해 워커 수에 비례한 선형적인 처리량 확장이 가능해집니다.

---

## 3. MVCC와 비정합성 조회 방지

`SKIP LOCKED`는 현재 실시간 락 상태를 반영합니다. `FOR UPDATE` 계열 쿼리는 격리 수준에 상관없이 항상 최신 커밋 데이터(Current Read)를 읽으므로, 무결성이 보장된 최신 락 현황을 기반으로 동작합니다.

---

## 4. DB 큐 vs 인메모리 큐(Redis) 선택 기준

Redis는 성능 면에서 유리하지만, 비즈니스 로직과 원자성(Atomicity)을 보장해야 하는 트랜잭션이 핵심이라면 DB 큐가 압도적인 우위를 가집니다. `SKIP LOCKED`를 사용하면 DB 큐의 고질적 약점인 락 경합을 극복할 수 있습니다.

---

## 5. 동시성 제어 SQL 최적화 수칙

1. 인덱스 활용 필달: `ORDER BY`와 `WHERE` 조건에 인덱스가 없다면 한 행을 찾기 위해 테이블 전체에 락을 시도하려 하며, 이는 `SKIP LOCKED`의 효율을 무력화합니다.
2. 짧은 트랜잭션 유지: 락을 획득했다면 최대한 빠르게 업데이트 후 커밋하십시오. 락 점유 시간이 길수록 다른 워커의 스킵 비용이 누적됩니다.
3. 결과셋 최소 유지: `LIMIT`를 최소화하여 불필요하게 많은 행을 잠그지 않도록 설계합니다.
