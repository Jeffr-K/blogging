---
title: "DB Modeling: 상태 머신 — 질서 있는 상태 전이"
author: jeffrey
date: 2026-04-06
tags: ["db-modeling", "state-machine", "status-transition", "fsm", "consistency", "business-logic"]
---

## 데이터의 생로병사: 상태 머신 (State Machine)

데이터는 변한다. 하지만 '아무렇게나' 변해서는 안 된다.

`주문 대기`에서 `배송 완료`로 갑자기 건너뛰거나, 이미 `취소`된 주문이 `결제 완료`로 되살아나서는 안 된다. 이처럼 비즈니스의 정해진 규칙에 따라 데이터의 상태가 질서 있게 이동하도록 설계하는 것이 **상태 머신(State Machine)** 모델링이다. 이번 아티클에서는 코드가 아닌 데이터베이스 차원에서 상태 전이의 무결성을 보장하는 실무 기법을 딥다이브해 본다.

---

## 1. 딥다이브: 유한 상태 기계 (FSM) 스키마 설계

단순히 `status` 칼럼 하나를 두는 것보다 강력한 것은 **상태 전이 테이블 (Transition Table)**을 따로 관리하는 것이다.

- **상태 정의 테이블**: `ORDER_PLACED`, `PAYMENT_PENDING`, `PAYMENT_COMPLETED` 등 모든 상태의 목록.
- **전이 규칙 테이블**: `from_status` -> `to_status` 관계를 정의한다. (예: `ORDER_PLACED` -> `PAYMENT_PENDING` 은 허용되지만, `ORDER_PLACED` -> `SHIPPED` 는 등록되어 있지 않다.)

---

## 2. 무결성 보장: 쿼리 레벨의 검증

상태를 업데이트할 때, 단순히 `SET status = 'SHIPPED'`라고 하지 않는다.

```sql
UPDATE orders
SET status = 'SHIPPED', updated_at = NOW()
WHERE id = 123
  AND status IN (SELECT from_status FROM transition_rules WHERE to_status = 'SHIPPED');
```

- **효과**: 잘못된 상태 전이 시도가 오면 `WHERE` 절에서 걸러져서 아무 데이터도 전제되지 않는다. (애플리케이션의 버그로부터 데이터를 완벽하게 보호한다.)

---

## 3. 딥다이브: 상태 이력 (State History) 연계

상태가 변할 때마다 "누구에 의해, 언제, 어떤 사유로" 변했는지 기록하는 테이블을 함께 운영한다.

- **이력 저장**: `order_status_history` 테이블에 이전 상태와 현재 상태를 기록한다.
- **현재 상태**: 마스터(orders) 테이블의 현재 상태는 항상 이력 테이블의 가장 최신 값과 동기화되어 있어야 한다.

---

## 4. 실전 가이드: 동시성 제어 (Optimistic Locking)

상태 머신을 다룰 때 가장 큰 적은 **경쟁 상태(Race Condition)**다.

- **낙관적 잠금 (Optimistic Locking)**: 모든 상태 변동 시 `version` 칼럼을 함께 체크한다. `UPDATE orders SET status = '...', version = version + 1 WHERE id = ... AND version = 5`
- **효과**: 동시에 두 명이 상태를 고치려 할 때, 한 명만 성공하고 나머지 한 명은 실패하게 하여 정합성을 유지한다.

---

## 요약

상태 머신 모델링은 **"데이터의 운명을 비즈니스 규칙에 가두는 설계"**다.

- 유효한 상태 전이 경로를 테이블로 명시화하자.
- `UPDATE` 쿼리 자체에 상태 전이 규칙을 녹여 무결성을 지키자.
- `version` 칼럼을 통해 동시성 충돌을 사전에 방지하자.

질서 있는 상태 전이 기법을 마쳤다면, 이제 모든 행위를 투명하게 기록하는 **감사 로그(Audit Log)와 통계용 이력 테이블의 분리 전략**을 딥다이브하며 본 테마를 마무리한다!
