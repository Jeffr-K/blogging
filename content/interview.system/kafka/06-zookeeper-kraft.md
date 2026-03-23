---
title: "[Kafka] 6. ZooKeeper vs KRaft — 메타데이터 관리"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "zookeeper", "kraft", "raft", "메타데이터", "컨트롤러"]
---

# ZooKeeper vs KRaft — 메타데이터 관리

## Kafka가 메타데이터를 관리하는 이유

Kafka 클러스터는 다음 메타데이터를 항상 관리해야 함:

- 어떤 브로커가 살아있는가
- 어떤 파티션의 리더가 누구인가
- 각 토픽의 파티션 수, 복제 팩터
- ISR 목록
- 컨트롤러가 누구인가

이 메타데이터를 어디에 저장하고 어떻게 동기화하느냐가 ZooKeeper vs KRaft의 핵심.

---

## ZooKeeper 모드 (레거시)

### 아키텍처

```
┌─────────────────────────────────────────────┐
│              ZooKeeper Ensemble              │
│     ZK1      ZK2      ZK3                   │
│  (Leader)  (Follower) (Follower)             │
└──────────────────────┬──────────────────────┘
                       │ 메타데이터 저장
          ┌────────────▼────────────────────┐
          │         Kafka Cluster            │
          │  Broker1(Controller) Broker2 Broker3 │
          └──────────────────────────────────┘
```

### ZooKeeper 역할

```
/kafka
  /brokers
    /ids/1       ← 브로커 1 등록 (ephemeral node)
    /ids/2
    /topics
      /orders
        /partitions/0/state  ← 파티션 0의 리더, ISR
  /controller    ← 현재 Controller 브로커 ID
  /isr_change_notification
```

- 브로커 시작 시 ZooKeeper에 ephemeral 노드 등록
- 브로커 장애 시 ZooKeeper가 노드 삭제 → Controller에 알림
- Controller가 새 리더 선출 → ZooKeeper에 기록

### ZooKeeper 모드의 문제점

**1. 외부 시스템 의존**
```
Kafka 운영 = Kafka 클러스터 + ZooKeeper 앙상블 별도 운영
  → 설치/모니터링/업그레이드 부담 2배
```

**2. 메타데이터 전파 지연**
```
파티션 변경 → ZooKeeper 업데이트 → Controller 감지 → 모든 브로커에 전파

브로커 수, 파티션 수 증가 → 전파 시간 증가
수십만 파티션 환경에서 Controller 재시작 수 분 소요
```

**3. Controller 장애 복구 비용**
```
Controller 재시작 시:
  ZooKeeper에서 전체 메타데이터 로드
  → 파티션 수에 비례한 시작 시간
```

---

## KRaft 모드 (Kafka 3.3+ 정식)

### KRaft = Kafka + Raft

ZooKeeper를 제거하고 Kafka 자체적으로 Raft 합의 알고리즘으로 메타데이터를 관리.

### 아키텍처

```
┌─────────────────────────────────────────────────┐
│                  Kafka Cluster                   │
│                                                  │
│  Controller Quorum (KRaft)                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │Controller 1│ │Controller 2│ │Controller 3│   │
│  │  (Leader)  │ │ (Follower) │ │ (Follower) │   │
│  └────────────┘ └────────────┘ └────────────┘   │
│         ↑ 메타데이터 로그                         │
│  ┌──────┴───────────────────────────────────┐   │
│  │  Broker 1   Broker 2   Broker 3          │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**노드 역할**:
- `process.roles=controller` — Controller 전용 노드
- `process.roles=broker` — Broker 전용 노드
- `process.roles=broker,controller` — 소규모 클러스터 (역할 겸임)

### KRaft의 메타데이터 관리

```
메타데이터 = 이벤트 로그로 저장 (__cluster_metadata 토픽)

이벤트 예시:
  TopicRecord: topic=orders, partitions=6
  PartitionRecord: topic=orders, partition=0, leader=1, ISR=[1,2,3]
  BrokerRecord: brokerId=2, epoch=5
  ...

Controller Leader가 로그에 이벤트 추가
Follower와 Broker가 로그를 구독하여 메타데이터 업데이트
```

### Raft 리더 선출

```
초기 상태: 모든 Controller 노드 = Follower

선거 시작:
  타임아웃 발생한 노드가 Candidate 됨
  자신에게 투표 + 다른 노드에 투표 요청

투표 규칙:
  아직 투표 안 했고 + 요청자의 로그가 자신만큼 최신이면 → 투표
  과반수(n/2+1) 획득 → Leader 됨

Leader:
  클라이언트 요청 처리
  로그 엔트리를 Follower에 복제
  과반수 복제 확인 후 커밋
```

---

## ZooKeeper vs KRaft 비교

| 항목 | ZooKeeper 모드 | KRaft 모드 |
|------|---------------|-----------|
| 외부 의존성 | ZooKeeper 앙상블 필요 | 없음 |
| 운영 복잡도 | 높음 (두 시스템 운영) | 낮음 |
| Controller 재시작 | 수 분 (ZK에서 메타데이터 로드) | 수 초 (로그 재생) |
| 파티션 스케일 | 수십만 파티션 한계 | 수백만 파티션 지원 |
| 메타데이터 전파 | ZK → Controller → Broker (다단계) | 직접 로그 구독 (단순) |
| 정식 지원 | Kafka 3.x에서 Deprecated | Kafka 3.3+ 정식 (4.0 ZK 제거) |

---

## KRaft 설정

```properties
# kraft/server.properties

# 이 노드의 고유 ID
node.id=1

# 노드 역할
process.roles=broker,controller

# Controller 쿼럼 설정
controller.quorum.voters=1@kafka1:9093,2@kafka2:9093,3@kafka3:9093

# Broker 통신 포트
listeners=PLAINTEXT://kafka1:9092,CONTROLLER://kafka1:9093
inter.broker.listener.name=PLAINTEXT
controller.listener.names=CONTROLLER

# 로그 디렉터리
log.dirs=/var/kafka/data
```

```bash
# KRaft 클러스터 초기화 (최초 1회)
kafka-storage.sh random-uuid  # 클러스터 UUID 생성

kafka-storage.sh format \
  --config server.properties \
  --cluster-id <uuid>

# 시작
kafka-server-start.sh server.properties
```

---

## 마이그레이션 (ZooKeeper → KRaft)

Kafka 3.x에서 단계적 마이그레이션 지원:

```
Phase 1: ZooKeeper 모드에서 KRaft Controller로 마이그레이션
Phase 2: 브로커를 KRaft 브리지 모드로 전환
Phase 3: ZooKeeper 완전 제거

Kafka 4.0: ZooKeeper 모드 완전 제거
```

---

## 정리

- **ZooKeeper 모드**: 외부 분산 코디네이터에 메타데이터 저장, 운영 복잡도 높음, Kafka 4.0에서 제거
- **KRaft 모드**: Raft 합의로 자체 메타데이터 관리, 운영 단순화, 더 빠른 복구, 더 큰 스케일
- **Raft**: Leader 선출 + 로그 복제 기반 합의 알고리즘, 과반수 노드 살아있으면 동작
- **프로덕션 신규 구축**: KRaft 모드 사용 권장 (Kafka 3.3+)
