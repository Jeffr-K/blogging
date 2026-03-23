---
title: "[Kafka] 2. 핵심 아키텍처 — Broker, Topic, Partition"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "broker", "topic", "partition", "offset", "아키텍처"]
---

# 핵심 아키텍처 — Broker, Topic, Partition

## 전체 구조

```
┌──────────────────────────────────────────────────────────┐
│                      Kafka Cluster                        │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Broker 1   │  │  Broker 2   │  │  Broker 3   │       │
│  │  (Leader)   │  │  (Follower) │  │  (Follower) │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                           │
└──────────────────────────────────────────────────────────┘
         ↑                                    ↑
   Producer                             Consumer Group
```

---

## Broker

**브로커(Broker)** = Kafka 서버 한 대.

- 디스크에 로그(메시지)를 저장
- 프로듀서의 쓰기, 소비자의 읽기 요청 처리
- 파티션의 리더 또는 팔로워 역할 담당
- 클러스터는 보통 3개 이상 브로커로 구성

### Controller 브로커

클러스터에는 **Controller** 브로커가 하나 존재.

- 파티션 리더 선출 담당
- 브로커 장애 감지 → 팔로워 중 새 리더 선출
- KRaft 모드: Controller가 Raft 합의로 선출됨
- ZooKeeper 모드: ZooKeeper가 Controller 선출 담당

---

## Topic

**토픽(Topic)** = 메시지를 분류하는 논리적 채널.

```
orders          → 주문 이벤트
payments        → 결제 이벤트
user-events     → 사용자 행동 이벤트
inventory       → 재고 변경 이벤트
```

- 프로듀서는 특정 토픽에 메시지를 씀
- 소비자는 특정 토픽에서 메시지를 읽음
- 토픽 이름은 클러스터 내 유일

### 토픽 생성

```bash
# 토픽 생성
kafka-topics.sh --bootstrap-server localhost:9092 \
  --create \
  --topic orders \
  --partitions 6 \
  --replication-factor 3

# 토픽 목록
kafka-topics.sh --bootstrap-server localhost:9092 --list

# 토픽 상세
kafka-topics.sh --bootstrap-server localhost:9092 \
  --describe --topic orders
```

---

## Partition

**파티션(Partition)** = 토픽을 나눈 물리적 단위.

```
Topic: orders (6개 파티션)

Partition 0: [msg0] [msg3] [msg6] ...  → Broker 1
Partition 1: [msg1] [msg4] [msg7] ...  → Broker 2
Partition 2: [msg2] [msg5] [msg8] ...  → Broker 3
Partition 3: [msg9] ...                → Broker 1
Partition 4: [msg10] ...               → Broker 2
Partition 5: [msg11] ...               → Broker 3
```

- 파티션이 수평 확장의 핵심 단위
- 각 파티션은 독립적인 Append-only 로그
- 파티션 내 메시지 순서 보장 (파티션 간 순서는 보장 안 됨)
- 복제 단위: 파티션마다 리더 1개 + 팔로워 N개

### 파티션 수 설계

| 고려사항 | 설명 |
|---|---|
| 처리량 | 파티션 수 = 병렬 처리 상한선 |
| 소비자 수 | 파티션 수 이상 소비자는 놀게 됨 |
| 브로커 수 | 균등 분배 위해 브로커 수의 배수 권장 |
| 순서 요구 | 전체 순서 필요 시 파티션 1개 (처리량 제약) |

```
파티션 6개, 소비자 그룹 1개, 소비자 6개
→ 소비자 1명당 파티션 1개 담당 (최대 병렬)

파티션 6개, 소비자 4개
→ 소비자 일부가 파티션 2개 담당

파티션 6개, 소비자 8개
→ 소비자 2명은 아무것도 안 함 (대기)
```

---

## Offset

**오프셋(Offset)** = 파티션 내 메시지의 순서 번호 (0부터 시작, 단조 증가).

```
Partition 0:
  Offset: 0     1     2     3     4     5
         [A]   [B]   [C]   [D]   [E]   [F]
                                       ↑
                             Log End Offset (다음 쓸 위치)

Consumer A: 현재 오프셋 = 3 (D까지 읽음)
Consumer B: 현재 오프셋 = 5 (F까지 읽음)
```

### 오프셋 종류

| 오프셋 | 설명 |
|---|---|
| **Log Start Offset** | 보존 중인 가장 오래된 메시지 위치 |
| **Log End Offset** | 다음 메시지가 쓰일 위치 (현재 최신 + 1) |
| **Current Offset** | 소비자가 다음에 읽을 위치 |
| **Committed Offset** | 처리 완료 후 커밋된 위치 |
| **High Watermark** | ISR 전체가 복제 완료한 최신 오프셋 |

### 오프셋의 중요성

```
Consumer Lag = Log End Offset - Committed Offset

Lag = 0    → 실시간 처리 중
Lag = 1000 → 1000개 메시지 밀림 → 지연 발생
Lag 급증   → 소비자 장애 또는 처리 속도 저하 신호
```

---

## 파티션 키와 메시지 분배

### 키 없음 — 라운드 로빈

```
Producer.send("orders", value=msg1)  → Partition 0
Producer.send("orders", value=msg2)  → Partition 1
Producer.send("orders", value=msg3)  → Partition 2
...
```

### 키 있음 — 해시 기반 고정 파티션

```
Producer.send("orders", key="user-123", value=msg)
→ hash("user-123") % 파티션수 = 항상 같은 파티션

같은 키 → 같은 파티션 → 순서 보장
```

**파티션 키 설계 원칙**:

- **순서가 중요한 단위**를 키로 사용 (주문 ID, 사용자 ID, 장치 ID)
- 키의 카디널리티가 낮으면 특정 파티션에 쏠림 현상 발생
- null 키 → sticky partition (배치 내에서 하나의 파티션에 모음, 2.4+)

```kotlin
// Kotlin Producer 예시
val record = ProducerRecord(
    "orders",          // topic
    "user-${userId}",  // key → 같은 유저의 주문은 같은 파티션
    orderJson          // value
)
producer.send(record)
```

---

## 리더와 팔로워

```
Topic: orders, Partition 0
Replication Factor: 3

Broker 1: Partition 0 [Leader]   ← 프로듀서/소비자가 직접 통신
Broker 2: Partition 0 [Follower] ← 리더에서 복제
Broker 3: Partition 0 [Follower] ← 리더에서 복제
```

- **리더(Leader)**: 읽기/쓰기 모두 처리
- **팔로워(Follower)**: 리더에서 데이터를 복제, 대기
- 리더 브로커 장애 → 팔로워 중 하나가 자동으로 리더 승격
- 팔로워가 리더를 따라잡고 있는 집합 = **ISR (In-Sync Replicas)**

### Preferred Leader

- 파티션 생성 시 최초 리더 = Preferred Leader
- 브로커 재시작 후 리더가 한 브로커에 쏠릴 수 있음
- `auto.leader.rebalance.enable=true` → 주기적으로 Preferred Leader로 복원

---

## Segment

파티션은 물리적으로 여러 **세그먼트(Segment)** 파일로 구성.

```
/var/kafka/data/orders-0/
  00000000000000000000.log   ← 실제 메시지 데이터
  00000000000000000000.index ← 오프셋 → 파일 위치 인덱스
  00000000000000000000.timeindex ← 타임스탬프 → 오프셋 인덱스
  00000000000001234567.log   ← 새 세그먼트 (오프셋 1234567부터)
  00000000000001234567.index
  ...
```

- **Active Segment**: 현재 쓰이는 세그먼트 (마지막 파일)
- **Closed Segment**: 가득 찬 세그먼트 → 보존 정책 대상
- 세그먼트 롤링: `log.segment.bytes` (기본 1GB) 또는 `log.roll.ms` 초과 시

---

## 정리

- **Broker**: Kafka 서버, 파티션의 리더/팔로워 담당
- **Topic**: 메시지 분류 채널, 여러 파티션으로 분산
- **Partition**: 수평 확장과 병렬 처리의 핵심 단위, 내부 순서 보장
- **Offset**: 파티션 내 메시지 위치, 소비자 위치 추적에 사용
- **Partition Key**: 동일 키 → 동일 파티션 → 순서 보장
- **Leader/Follower**: 리더가 읽기/쓰기 처리, 팔로워가 복제
