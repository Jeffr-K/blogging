---
title: "[Kafka] 5. 복제 — ISR, 리더 선출, 장애 복구"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "replication", "ISR", "리더선출", "장애복구", "고가용성"]
---

# 복제 — ISR, 리더 선출, 장애 복구

## 복제 구조

```
Topic: orders, Partition 0, Replication Factor = 3

Broker 1: [P0 Leader]   ← 모든 읽기/쓰기
Broker 2: [P0 Follower] ← 리더에서 복제
Broker 3: [P0 Follower] ← 리더에서 복제

프로듀서 → 리더에 쓰기 → 팔로워가 pull로 복제
```

복제 팩터(Replication Factor):
- 각 파티션이 몇 개의 복제본을 가질지
- RF=1: 복제 없음 (단일 장애점)
- RF=3: 브로커 1대 장애 허용 (프로덕션 표준)
- RF=5: 브로커 2대 장애 허용 (금융 등 고신뢰 환경)

---

## ISR (In-Sync Replicas)

**ISR** = 리더와 동기화된 복제본들의 집합.

```
ISR = {Broker1(Leader), Broker2, Broker3}

Broker3이 느려져서 리더를 따라오지 못하면:
ISR = {Broker1(Leader), Broker2}  ← Broker3 ISR에서 제거
OSR = {Broker3}  ← Out-of-Sync Replica
```

### ISR 유지 조건

```
replica.lag.time.max.ms = 30000 (기본 30초)

팔로워가 30초 내에 리더의 모든 메시지를 복제하면 ISR 유지
30초 초과 → ISR에서 제거 → OSR로 이동

복구 후 리더를 따라잡으면 ISR 재합류
```

### ISR과 acks=all의 관계

```
acks=all + min.insync.replicas=2

ISR = {Leader, Follower1, Follower2}
→ Leader + 최소 1개 팔로워가 복제해야 커밋

ISR = {Leader}  (팔로워 모두 지연)
→ min.insync.replicas=2 미충족
→ NotEnoughReplicasException 발생
→ 쓰기 거부 (가용성 < 일관성)
```

---

## High Watermark (HW)

```
Offset:  0    1    2    3    4
Leader: [A]  [B]  [C]  [D]  [E]   ← Log End Offset = 5
                              ↑
Follower1: [A] [B] [C] [D]         ← Offset 3까지 복제
Follower2: [A] [B] [C]             ← Offset 2까지 복제

High Watermark = 3 (모든 ISR이 복제한 최신 오프셋)

소비자는 HW 이하의 메시지만 읽을 수 있음
→ [D], [E]는 아직 소비자에게 노출되지 않음
```

**HW의 역할**:
- 리더 장애 후 팔로워가 리더 승격 시 일관된 데이터 보장
- HW 이전 데이터만 커밋된 것으로 간주

---

## 리더 선출

### 리더 장애 감지

```
Broker1 (리더) 장애 발생
  ↓
Controller 브로커가 감지 (ZooKeeper/KRaft)
  ↓
ISR 중 하나를 새 리더로 선출
  ↓
모든 브로커에 메타데이터 업데이트
  ↓
프로듀서/소비자가 새 리더로 연결
```

### 선출 기준

```
ISR = {Broker2, Broker3}
Controller → Broker2를 새 리더로 선출 (ISR 첫 번째)

ISR이 비어있다면?
→ unclean.leader.election.enable 설정에 따라 결정
```

### Unclean Leader Election

```
unclean.leader.election.enable = false (기본)
  → ISR이 없으면 해당 파티션을 서비스 불가 상태로 유지
  → 데이터 일관성 우선 (금융, 결제 등)

unclean.leader.election.enable = true
  → ISR 밖의 팔로워도 리더로 선출 가능
  → 서비스 가용성 우선, 데이터 유실 가능
  → 로그 수집 등 손실 허용 환경
```

---

## 장애 시나리오

### 시나리오 1: 팔로워 장애

```
Before:
  Broker1: Leader
  Broker2: Follower (ISR)
  Broker3: Follower (ISR) ← 장애 발생

After:
  ISR = {Broker1, Broker2}
  Broker3 ISR에서 제거
  계속 정상 운영 (RF=3, 브로커 1대 손실)

Broker3 복구:
  Broker3가 리더에서 HW까지 복제
  ISR 재합류
```

### 시나리오 2: 리더 장애

```
Before:
  Broker1: Leader (ISR)
  Broker2: Follower (ISR, HW=100까지 복제)
  Broker3: Follower (ISR, HW=98까지 복제)

Broker1 장애:
  Controller → ISR 중 Broker2 리더 선출
  Broker3는 Broker2에서 복제 재개

데이터 상황:
  Broker1이 가진 offset 101, 102는?
  → HW=100까지만 커밋된 것으로 간주
  → 프로듀서에게 ack 못 보낸 메시지는 유실 (재전송 대상)
```

### 시나리오 3: Controller 장애

```
ZooKeeper 모드:
  ZooKeeper가 Controller 재선출

KRaft 모드:
  Raft 합의로 새 Controller 선출 (더 빠름)
```

---

## 복제 팩터와 파티션 배치

### 균등 분산

```
Topic: orders, 6 partitions, RF=3, 3 brokers

이상적 배치:
  Partition 0: Leader=Broker1, Follower=Broker2, Follower=Broker3
  Partition 1: Leader=Broker2, Follower=Broker3, Follower=Broker1
  Partition 2: Leader=Broker3, Follower=Broker1, Follower=Broker2
  Partition 3: Leader=Broker1, ...
  ...

→ 각 브로커가 2개 파티션의 리더 (균등 부하)
```

### Rack Awareness

```
multi-AZ 환경에서 복제본을 다른 랙/AZ에 배치

broker.rack=az1  (Broker1, Broker2)
broker.rack=az2  (Broker3, Broker4)

Partition 0: Leader=Broker1(az1), Follower=Broker3(az2), Follower=Broker2(az1)
→ AZ 전체 장애 시에도 데이터 보존
```

---

## 복제 관련 설정 요약

| 설정 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `replication.factor` | Topic | 1 | 파티션 복제본 수 |
| `min.insync.replicas` | Broker/Topic | 1 | acks=all 시 최소 ISR 수 |
| `replica.lag.time.max.ms` | Broker | 30000 | ISR 제거 기준 지연 시간 |
| `unclean.leader.election.enable` | Broker | false | 비ISR 리더 선출 허용 여부 |
| `auto.leader.rebalance.enable` | Broker | true | Preferred Leader 자동 복원 |
| `leader.imbalance.check.interval.seconds` | Broker | 300 | 리더 불균형 체크 주기 |

---

## 운영 명령어

```bash
# 파티션 복제 상태 확인
kafka-topics.sh --bootstrap-server localhost:9092 \
  --describe --topic orders

# 출력:
# Topic: orders  Partition: 0  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3
# Topic: orders  Partition: 1  Leader: 2  Replicas: 2,3,1  Isr: 2,3,1

# 리더 재균형
kafka-leader-election.sh --bootstrap-server localhost:9092 \
  --election-type preferred --all-topic-partitions

# 파티션 재할당 (브로커 추가/제거 시)
kafka-reassign-partitions.sh --bootstrap-server localhost:9092 \
  --reassignment-json-file reassignment.json \
  --execute
```

---

## 정리

- **ISR**: 리더와 동기화된 복제본 집합, `acks=all` 쓰기의 기준
- **High Watermark**: 모든 ISR이 복제 완료한 최신 오프셋, 소비자 읽기 상한
- **리더 선출**: 컨트롤러가 ISR 중 하나를 선출, `unclean.leader.election`으로 가용성 vs 일관성 트레이드오프
- **RF=3, min.insync.replicas=2**: 브로커 1대 장애 허용하면서 데이터 유실 방지 (프로덕션 표준)
- **Rack Awareness**: 복제본을 다른 AZ에 배치 → AZ 장애 내성
