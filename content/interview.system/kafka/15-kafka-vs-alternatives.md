---
title: "[Kafka] 15. Kafka vs 대안 — RabbitMQ, SQS, Pulsar, Redis Streams"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "rabbitmq", "SQS", "pulsar", "redis-streams", "비교", "메시지큐"]
---

# Kafka vs 대안 — RabbitMQ, SQS, Pulsar, Redis Streams

## 한눈에 비교

| | Kafka | RabbitMQ | AWS SQS | Apache Pulsar | Redis Streams |
|--|-------|----------|---------|---------------|---------------|
| **모델** | 이벤트 스트리밍 | 메시지 큐 / Pub-Sub | 메시지 큐 | 이벤트 스트리밍 | 이벤트 스트리밍 |
| **메시지 보존** | 설정 기간 유지 | 소비 후 삭제 | 소비 후 삭제 | 설정 기간 유지 | 설정 길이 유지 |
| **재소비** | 오프셋으로 가능 | 기본 불가 | 불가 | 커서로 가능 | 가능 |
| **처리량** | 매우 높음 | 중간 | 중간 | 매우 높음 | 높음 |
| **지연** | 수 밀리초 | 수 밀리초 | 수십 밀리초 | 수 밀리초 | 수 밀리초 |
| **순서 보장** | 파티션 내 | 큐 단위 | 표준: 없음, FIFO: 있음 | 파티션 내 | 스트림 내 |
| **스트림 처리** | Kafka Streams 내장 | 없음 | 없음 | Pulsar Functions | 없음 |
| **운영 복잡도** | 높음 | 중간 | 낮음 (관리형) | 높음 | 낮음 |
| **멀티테넌시** | 제한적 | 제한적 | 격리됨 | 내장 지원 | - |
| **주 사용처** | 대용량 스트리밍, MSA | 작업 큐, RPC | AWS 생태계, 간단한 큐 | Kafka 대안, 클라우드 네이티브 | 경량 스트리밍 |

---

## Kafka vs RabbitMQ

### Kafka가 더 나은 경우

```
✓ 초당 수십만 ~ 수백만 메시지
✓ 메시지를 여러 서비스가 독립적으로 소비
✓ 과거 메시지 재소비 필요 (이벤트 소싱, 감사로그)
✓ 실시간 스트림 처리 (Kafka Streams)
✓ CDC (Debezium 연동)
✓ 이벤트 기반 마이크로서비스
```

### RabbitMQ가 더 나은 경우

```
✓ 복잡한 라우팅 (Exchange 타입: Topic, Headers, Fanout)
✓ 작업 큐 (Task Queue) — 메시지 소비 후 즉시 삭제
✓ 요청-응답 패턴 (RPC over AMQP)
✓ 우선순위 큐
✓ 메시지 TTL 개별 설정
✓ 소규모 ~ 중규모, 간단한 설정
✓ 지연 메시지 (delayed message exchange 플러그인)
```

### 핵심 차이

```
RabbitMQ (스마트 브로커):
  브로커가 소비자 상태 추적
  소비자에게 Push
  메시지 소비 후 삭제

Kafka (멍청한 브로커, 스마트 소비자):
  소비자가 오프셋 직접 관리
  소비자가 Pull
  메시지 기간동안 보존
  재소비 가능
```

---

## Kafka vs AWS SQS/SNS

### SQS 특성

```
SQS Standard:
  - At-Least-Once 보장
  - 순서 보장 없음
  - 거의 무한 처리량
  - 최대 메시지 크기: 256KB

SQS FIFO:
  - Exactly-Once 보장
  - 순서 보장
  - 초당 최대 3000 메시지 (배치) / 300 (개별)
```

### SQS가 더 나은 경우

```
✓ AWS 생태계 완전 관리형 (서버리스)
✓ Lambda 트리거로 간단한 이벤트 처리
✓ 낮은 운영 부담
✓ 소규모 처리량으로 충분한 경우
✓ AWS 서비스 간 연동 (S3, Lambda, EC2)
```

### Kafka가 더 나은 경우

```
✓ 멀티 컨슈머 그룹 (SNS+SQS 팬아웃 없이)
✓ 재소비 (SQS는 한 번 소비하면 삭제)
✓ 매우 높은 처리량
✓ 스트림 처리
✓ 벤더 록인 없음
```

### SNS vs Kafka Topic

```
SNS (Push 방식):
  발행 → SNS → SQS 구독자 1
              → SQS 구독자 2
              → HTTP 엔드포인트
  단점: 재소비 불가, 순서 보장 없음

Kafka Topic (Pull 방식):
  발행 → 토픽 (보존) → Consumer Group 1 (독립 오프셋)
                     → Consumer Group 2 (독립 오프셋)
  장점: 재소비 가능, 파티션 내 순서 보장
```

---

## Kafka vs Apache Pulsar

### Pulsar 특성

```
Pulsar = Kafka의 강력한 대안

Apache BookKeeper (저장) + Pulsar Broker (서빙) 분리
  → 저장과 서빙 독립적 확장

멀티테넌시 내장:
  tenant/namespace/topic 계층 구조

지원 모델:
  - Exclusive: 소비자 1명만
  - Shared: 여러 소비자 (라운드로빈)
  - Failover: 기본은 1명, 장애 시 다른 소비자로
  - Key_Shared: 키 기반 고정 소비자
```

### Pulsar이 더 나은 경우

```
✓ 멀티테넌트 환경 (B2B SaaS)
✓ 저장 레이어 독립 확장 필요
✓ 다양한 구독 모드 필요
✓ 지리적 복제 (Geo-Replication) 내장
✓ Kafka + RabbitMQ 기능 모두 필요
```

### Kafka가 더 나은 경우

```
✓ 성숙한 생태계 (Connect, Streams, Schema Registry)
✓ 더 넓은 커뮤니티와 지원
✓ 검증된 프로덕션 레퍼런스
✓ 단순한 운영 (Pulsar는 BookKeeper 추가 운영)
```

---

## Kafka vs Redis Streams

### Redis Streams 특성

```
Redis 5.0+에 추가된 스트리밍 자료구조

XADD stream key value  → 메시지 추가
XREAD stream           → 메시지 읽기
XGROUP                 → Consumer Group 지원
```

### Redis Streams가 더 나은 경우

```
✓ 이미 Redis를 사용 중인 경우
✓ 소규모 처리량 (초당 수만)
✓ 단순한 스트리밍 요구사항
✓ 낮은 지연 필요 (Redis의 인메모리 장점)
✓ Kafka 설치 없이 간단하게
```

### Kafka가 더 나은 경우

```
✓ 대용량 처리 (초당 수백만)
✓ 장기 메시지 보존 (Redis는 메모리 기반)
✓ 스트림 처리 (Kafka Streams)
✓ 완전한 생태계 (Connect, Schema Registry)
```

---

## 의사결정 가이드

```
메시지 재소비 필요?
  YES → Kafka, Pulsar, Redis Streams
  NO  → RabbitMQ, SQS

초당 100만+ 메시지?
  YES → Kafka, Pulsar
  NO  → 모두 가능

복잡한 라우팅 (Exchange 타입)?
  YES → RabbitMQ
  NO  → Kafka

AWS 관리형, 낮은 운영 부담?
  YES → SQS/SNS
  NO  → Kafka (온프레미스/자체 관리)

멀티테넌시, 지리적 복제 내장?
  YES → Pulsar
  NO  → Kafka

이미 Redis 사용 중, 소규모?
  YES → Redis Streams
  NO  → Kafka
```

---

## 조합 패턴

실제 프로덕션에서는 혼합 사용도 일반적.

```
Kafka + RabbitMQ:
  Kafka: 이벤트 스트리밍, 고처리량 파이프라인
  RabbitMQ: 내부 작업 큐, 우선순위 처리

Kafka + SQS:
  Kafka: 내부 MSA 이벤트 버스
  SQS: 외부 파트너 시스템과의 비동기 통신, Lambda 트리거

Kafka + Redis:
  Kafka: 영속성 있는 이벤트 스트리밍
  Redis: 캐시 계층 + 간단한 pub/sub
```

---

## 정리

| 선택 기준 | 권장 |
|-----------|------|
| 고처리량 스트리밍, 재소비, MSA 이벤트 버스 | **Kafka** |
| 복잡한 라우팅, 작업 큐, 소규모 | **RabbitMQ** |
| AWS 관리형, 서버리스, 간단한 큐 | **SQS/SNS** |
| 멀티테넌시, Kafka+RabbitMQ 기능 모두 | **Pulsar** |
| 이미 Redis 사용 중, 경량 스트리밍 | **Redis Streams** |
