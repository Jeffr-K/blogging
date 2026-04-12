---
title: "[Kafka] 3. Producer — acks, 배치, 멱등성, 트랜잭션"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "producer", "acks", "idempotent", "transaction", "배치"]
---

# Producer — acks, 배치, 멱등성, 트랜잭션

## Producer 흐름

```
Producer
  ↓
send(ProducerRecord)
  ↓
Serializer (key/value → bytes)
  ↓
Partitioner (어느 파티션?)
  ↓
RecordAccumulator (배치 버퍼)
  ↓
Sender Thread (배치 전송)
  ↓
Kafka Broker
  ↓
acks 응답
```

---

## ProducerRecord

```kotlin
data class ProducerRecord<K, V>(
    val topic: String,
    val partition: Int? = null,   // 직접 지정 (선택)
    val key: K? = null,           // 파티션 결정에 사용
    val value: V,
    val timestamp: Long? = null,  // null이면 현재 시각
    val headers: Headers = RecordHeaders()
)
```

```kotlin
// 예시
val record = ProducerRecord(
    "orders",
    "user-${userId}",  // key
    OrderCreatedEvent(orderId, userId, amount).toJson()
)
producer.send(record) { metadata, exception ->
    if (exception != null) {
        logger.error("전송 실패", exception)
    } else {
        logger.info("전송 성공: partition=${metadata.partition()}, offset=${metadata.offset()}")
    }
}
```

---

## acks — 신뢰성 설정

`acks` 설정은 프로듀서가 전송 성공을 판단하는 기준.

### acks=0 — Fire and Forget

```
Producer → Broker (응답 안 기다림)
```

- 브로커 응답 없이 다음 메시지 즉시 전송
- 가장 빠름, 가장 위험
- 브로커 장애 시 메시지 유실 가능
- 사용: 로그 수집, 손실 허용 가능한 메트릭

### acks=1 — 리더 확인

```
Producer → Leader (리더만 저장하면 OK)
         ← ack
```

- 리더 브로커가 저장하면 성공 응답
- 리더 저장 직후 팔로워 복제 전 크래시 → 메시지 유실 가능
- 기본값 (Kafka 3.0 이전)
- 균형 있는 성능/신뢰성

### acks=all (또는 -1) — ISR 전체 확인

```
Producer → Leader → Follower 1
                  → Follower 2
         ← ack (모든 ISR 복제 완료 후)
```

- ISR 전체가 복제 완료해야 성공 응답
- 가장 안전, 가장 느림
- `min.insync.replicas`와 함께 사용
- 기본값 (Kafka 3.0+)

### min.insync.replicas

```
acks=all + min.insync.replicas=2

ISR에 최소 2개 복제본이 있어야 쓰기 허용
ISR < 2이면 NotEnoughReplicasException 발생
```

```
Replication Factor=3, min.insync.replicas=2 → 브로커 1대 장애 허용
Replication Factor=3, min.insync.replicas=3 → 브로커 0대 장애 허용 (너무 엄격)
```

---

## 배치와 압축

### RecordAccumulator (배치 버퍼)

프로듀서는 메시지를 즉시 보내지 않고 배치에 모았다가 전송.

```
buffer.memory = 32MB (기본)
  ↓
파티션별 배치 큐
  Partition 0: [msg1][msg2][msg3]... → 16KB 차거나 linger.ms 경과 시 전송
  Partition 1: [msg4][msg5]...
  Partition 2: [msg6]...
```

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `batch.size` | 16384 (16KB) | 배치 최대 크기 |
| `linger.ms` | 0 | 배치 대기 시간 (0=즉시 전송) |
| `buffer.memory` | 33554432 (32MB) | 전체 버퍼 크기 |
| `max.block.ms` | 60000 | 버퍼 꽉 찼을 때 블로킹 시간 |

```
linger.ms=5 설정 시:
- 5ms 동안 메시지를 모아서 한 번에 전송
- 처리량 증가, 지연 약간 증가
- 대부분의 프로덕션 환경에서 권장
```

### 압축

```kotlin
props["compression.type"] = "lz4"  // none, gzip, snappy, lz4, zstd
```

| 알고리즘 | 압축률 | CPU | 권장 |
|---|---|---|---|
| none | - | - | 개발 환경 |
| gzip | 높음 | 높음 | 대역폭 제약 환경 |
| snappy | 중간 | 낮음 | 범용 |
| lz4 | 중간 | 매우 낮음 | **프로덕션 권장** |
| zstd | 높음 | 중간 | 높은 압축률 필요 시 |

---

## 재시도와 순서

### 재시도 설정

```kotlin
props["retries"] = Int.MAX_VALUE        // 재시도 횟수 (기본 MAX_VALUE)
props["retry.backoff.ms"] = 100         // 재시도 간격
props["delivery.timeout.ms"] = 120000   // 전체 전송 타임아웃 (2분)
props["request.timeout.ms"] = 30000     // 단일 요청 타임아웃
```

### 재시도와 순서 문제

```
max.in.flight.requests.per.connection=5 (기본)

요청 1 → 전송 실패, 재시도 중
요청 2 → 전송 성공
요청 1 재시도 → 성공

결과: 요청 2가 먼저 커밋됨 → 순서 역전!
```

**해결책**:
```kotlin
// 옵션 1: 멱등성 활성화 (자동으로 순서 보장)
props["enable.idempotence"] = true

// 옵션 2: 수동 설정 (멱등성 없이 순서만 보장)
props["max.in.flight.requests.per.connection"] = 1  // 처리량 감소
```

---

## 멱등성 프로듀서 (Idempotent Producer)

### 문제: 중복 메시지

```
Producer → Broker (메시지 저장 성공)
         ← 네트워크 끊김 (ack 미수신)
Producer → Broker (재시도, 동일 메시지 재전송)
         ← 성공

결과: 브로커에 동일 메시지 2개 저장 → 중복!
```

### 해결: Producer ID + Sequence Number

```kotlin
props["enable.idempotence"] = true
// 자동으로 설정:
// acks=all
// retries=MAX_VALUE
// max.in.flight.requests.per.connection=5
```

```
Producer가 시작 시 고유 PID(Producer ID) 발급

메시지 전송:
  PID=42, Seq=0: msg1
  PID=42, Seq=1: msg2
  PID=42, Seq=2: msg3

브로커가 PID+Seq 추적:
  Seq=2 재전송 → 이미 받은 것 확인 → 중복 무시
  Seq=4 수신 (Seq=3 건너뜀) → 순서 오류 감지
```

**멱등성 범위**:
- 단일 파티션, 단일 세션(브로커 재시작 전까지) 내 중복 방지
- 여러 파티션에 걸친 원자성은 **트랜잭션** 필요

---

## 트랜잭션 프로듀서 (Transactional Producer)

### 목적

여러 파티션 / 여러 토픽에 원자적으로 쓰기.

```
주문 생성 시:
  orders 토픽에 OrderCreated 이벤트 쓰기
  inventory 토픽에 StockReserved 이벤트 쓰기

→ 둘 다 성공하거나 둘 다 실패해야 함
```

### 설정

```kotlin
props["enable.idempotence"] = true
props["transactional.id"] = "order-service-producer-1"  // 고유 ID
```

### 트랜잭션 흐름

```kotlin
producer.initTransactions()  // 초기화 (한 번만)

try {
    producer.beginTransaction()

    producer.send(ProducerRecord("orders", key, orderEvent))
    producer.send(ProducerRecord("inventory", key, stockEvent))

    producer.commitTransaction()  // 원자적 커밋
} catch (e: Exception) {
    producer.abortTransaction()   // 전체 롤백
}
```

### EOS (Exactly-Once Semantics)

```
트랜잭션 프로듀서 + isolation.level=read_committed (소비자)

소비자는 커밋된 트랜잭션의 메시지만 읽음
진행 중이거나 중단된 트랜잭션의 메시지는 보이지 않음
```

---

## Partitioner

### 기본 동작 (DefaultPartitioner)

```
key 없음  → StickyPartitioner (배치 단위로 하나의 파티션)
key 있음  → murmur2(key) % numPartitions
직접 지정 → 지정된 파티션
```

### 커스텀 Partitioner

```kotlin
class RegionPartitioner : Partitioner {
    override fun partition(
        topic: String,
        key: Any?,
        keyBytes: ByteArray?,
        value: Any?,
        valueBytes: ByteArray?,
        cluster: Cluster,
    ): Int {
        val partitions = cluster.partitionsForTopic(topic)
        val region = (key as? String)?.substringBefore("-") ?: "unknown"
        return when (region) {
            "kr" -> 0
            "us" -> 1
            "eu" -> 2
            else -> partitions.size - 1
        }
    }

    override fun close() {}
    override fun configure(configs: Map<String, *>) {}
}

// 설정
props["partitioner.class"] = RegionPartitioner::class.java.name
```

---

## Producer 설정 요약

### 고처리량 최적화

```kotlin
props["batch.size"] = 65536         // 64KB
props["linger.ms"] = 10             // 10ms 대기
props["compression.type"] = "lz4"
props["buffer.memory"] = 67108864   // 64MB
```

### 고신뢰성 설정

```kotlin
props["acks"] = "all"
props["enable.idempotence"] = true
props["retries"] = Int.MAX_VALUE
props["delivery.timeout.ms"] = 300000  // 5분
props["max.in.flight.requests.per.connection"] = 5
```

### 저지연 설정

```kotlin
props["linger.ms"] = 0        // 즉시 전송
props["batch.size"] = 1       // 배치 없음 (극단적)
props["acks"] = "1"           // 리더만 확인
props["compression.type"] = "none"
```

---

## 정리

- **acks**: `0`(빠름/위험) → `1`(기본) → `all`(안전/느림)
- **배치**: `linger.ms` + `batch.size`로 처리량 조절, `lz4` 압축 권장
- **멱등성**: `enable.idempotence=true` → PID+Seq로 중복 방지, 순서 보장
- **트랜잭션**: `transactional.id` 설정 → 여러 파티션 원자적 쓰기 (EOS)
- **파티셔너**: key 기반 해시(기본) 또는 커스텀 파티셔너로 라우팅 제어
