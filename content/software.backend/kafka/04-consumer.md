---
title: "[Kafka] 4. Consumer — Consumer Group, Rebalancing, 오프셋 관리"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "consumer", "consumer-group", "rebalancing", "offset", "소비자"]
---

# Consumer — Consumer Group, Rebalancing, 오프셋 관리

## Consumer Group

**컨슈머 그룹(Consumer Group)** = 동일 토픽을 함께 소비하는 소비자들의 집합.

```
Topic: orders (6개 파티션)

Consumer Group "order-processor"
  Consumer 1  → Partition 0, 1
  Consumer 2  → Partition 2, 3
  Consumer 3  → Partition 4, 5

Consumer Group "analytics"
  Consumer A  → Partition 0, 1, 2
  Consumer B  → Partition 3, 4, 5
```

핵심 규칙:
- **같은 그룹** 내에서 하나의 파티션 = 정확히 하나의 소비자
- **다른 그룹**은 독립적으로 동일 파티션 소비 가능
- 그룹 ID: `group.id` 설정으로 지정

---

## 기본 Consumer 코드

```kotlin
val props = Properties().apply {
    put("bootstrap.servers", "localhost:9092")
    put("group.id", "order-processor")
    put("key.deserializer", StringDeserializer::class.java.name)
    put("value.deserializer", StringDeserializer::class.java.name)
    put("auto.offset.reset", "earliest")   // 처음부터 읽기
    put("enable.auto.commit", false)       // 수동 커밋 권장
}

KafkaConsumer<String, String>(props).use { consumer ->
    consumer.subscribe(listOf("orders"))

    while (true) {
        val records = consumer.poll(Duration.ofMillis(100))

        for (record in records) {
            println(
                "partition=${record.partition()}, " +
                "offset=${record.offset()}, " +
                "key=${record.key()}, " +
                "value=${record.value()}"
            )
            processOrder(record.value())
        }

        consumer.commitSync()  // 처리 후 커밋
    }
}
```

---

## auto.offset.reset

소비자 그룹이 처음 시작하거나 오프셋이 없을 때 어디서 시작할지.

| 값 | 설명 |
|---|---|
| `earliest` | 파티션의 가장 오래된 메시지부터 |
| `latest` | 새로 들어오는 메시지만 (기존 무시) |
| `none` | 오프셋 없으면 예외 발생 |

```kotlin
// 개발/재처리: earliest
props["auto.offset.reset"] = "earliest"

// 프로덕션 신규 서비스: latest
props["auto.offset.reset"] = "latest"
```

---

## 오프셋 관리

### 자동 커밋 (enable.auto.commit=true)

```
기본 설정:
  enable.auto.commit=true
  auto.commit.interval.ms=5000 (5초마다 자동 커밋)

문제:
  poll() → 메시지 처리 중 → 5초 경과 → 자동 커밋 → 처리 실패
  → 커밋은 됐지만 처리 실패 → 메시지 유실!
```

### 수동 커밋 (enable.auto.commit=false)

```kotlin
// commitSync — 동기 커밋 (처리 완료 보장)
for (record in records) {
    process(record)
}
consumer.commitSync()

// commitAsync — 비동기 커밋 (처리량 우선)
consumer.commitAsync { offsets, exception ->
    if (exception != null) {
        logger.error("커밋 실패: $offsets", exception)
    }
}

// 특정 오프셋 커밋
val offsets = mapOf(
    TopicPartition("orders", 0) to OffsetAndMetadata(lastOffset + 1)
)
consumer.commitSync(offsets)
```

### __consumer_offsets 토픽

```
Kafka 내부 토픽에 오프셋 저장

group.id + topic + partition → committed offset

Consumer Group "order-processor", orders, Partition 0 → offset 1234
Consumer Group "order-processor", orders, Partition 1 → offset 5678
...
```

---

## 소비 의미론 (Delivery Semantics)

### At Most Once (최대 한 번)

```
poll() → 오프셋 커밋 → 메시지 처리

처리 실패 시 → 이미 커밋됨 → 재시도 불가 → 메시지 유실
```

### At Least Once (최소 한 번) — 기본 목표

```
poll() → 메시지 처리 → 오프셋 커밋

처리 실패 → 재시작 → 미커밋 오프셋부터 재처리
단점: 처리 성공 후 커밋 전 크래시 → 중복 처리 가능
```

```kotlin
// At Least Once 패턴
while (true) {
    val records = consumer.poll(Duration.ofMillis(100))
    for (record in records) {
        process(record)            // 처리
    }
    consumer.commitSync()          // 처리 완료 후 커밋
}
```

### Exactly Once (정확히 한 번)

```
트랜잭션 프로듀서 + isolation.level=read_committed 소비자
또는
멱등성 처리 (처리 전 중복 확인)
```

```kotlin
// 멱등성 처리 예시 (DB unique constraint 활용)
for (record in records) {
    try {
        db.insertIfNotExists(record.offset(), process(record))
    } catch (e: DuplicateKeyException) {
        // 이미 처리됨 — 무시
    }
}
```

---

## Rebalancing

소비자 그룹의 **파티션 재할당** 이벤트.

### 트리거 조건

- 소비자 추가 (스케일 아웃)
- 소비자 제거 (정상 종료 또는 장애)
- 소비자가 `session.timeout.ms` 내 heartbeat 미전송
- 토픽 파티션 수 변경

### Rebalancing 문제점

```
Rebalancing 중:
  모든 소비자 → 파티션 해제 (Stop-the-World!)
  새 파티션 할당 완료까지 처리 중단

비용:
  - 처리 중단 (수 초 ~ 수십 초)
  - 미처리 메시지 재처리 (Lag 발생 가능)
  - 대규모 클러스터에서 심각한 성능 저하
```

### Heartbeat와 타임아웃

```kotlin
props["session.timeout.ms"] = 45000     // 45초 내 heartbeat 없으면 죽은 것으로 간주
props["heartbeat.interval.ms"] = 3000   // 3초마다 heartbeat 전송
props["max.poll.interval.ms"] = 300000  // poll() 호출 간격 최대 5분
```

`max.poll.interval.ms` 초과 → 소비자가 살아있어도 그룹에서 제외됨 (처리 시간이 너무 긴 경우).

### Incremental Cooperative Rebalancing (Kafka 2.4+)

```
기존 (Eager Rebalancing):
  모든 소비자 → 모든 파티션 해제 → 재할당 (전체 중단)

Cooperative Rebalancing:
  이동이 필요한 파티션만 해제 → 나머지는 계속 처리
  처리 중단 최소화
```

```kotlin
props["partition.assignment.strategy"] =
    "org.apache.kafka.clients.consumer.CooperativeStickyAssignor"
```

### ConsumerRebalanceListener

```kotlin
consumer.subscribe(
    listOf("orders"),
    object : ConsumerRebalanceListener {
        override fun onPartitionsRevoked(partitions: Collection<TopicPartition>) {
            // 파티션 해제 전: 미처리 메시지 커밋
            consumer.commitSync(currentOffsets)
            logger.info("파티션 해제: $partitions")
        }

        override fun onPartitionsAssigned(partitions: Collection<TopicPartition>) {
            // 새 파티션 할당 후: 상태 초기화
            logger.info("파티션 할당: $partitions")
        }
    }
)
```

---

## 오프셋 제어

### 특정 오프셋부터 읽기

```kotlin
// 파티션 직접 할당 (Consumer Group 없이)
val partitions = listOf(
    TopicPartition("orders", 0),
    TopicPartition("orders", 1),
)
consumer.assign(partitions)

// 특정 오프셋부터
consumer.seek(TopicPartition("orders", 0), 1000L)

// 처음부터
consumer.seekToBeginning(partitions)

// 끝에서부터
consumer.seekToEnd(partitions)
```

### 타임스탬프 기반 오프셋 조회

```kotlin
// 특정 시각 이후의 메시지부터 읽기
val timestampToSearch = Instant.parse("2024-01-01T00:00:00Z").toEpochMilli()
val topicPartitions = consumer.assignment()

val timestampsToSearch = topicPartitions.associateWith { timestampToSearch }
val offsets = consumer.offsetsForTimes(timestampsToSearch)

offsets.forEach { (tp, offsetAndTimestamp) ->
    if (offsetAndTimestamp != null) {
        consumer.seek(tp, offsetAndTimestamp.offset())
    }
}
```

---

## 성능 최적화

### Fetch 설정

```kotlin
props["fetch.min.bytes"] = 1024        // 최소 1KB 모일 때까지 대기
props["fetch.max.wait.ms"] = 500       // 최대 500ms 대기
props["max.partition.fetch.bytes"] = 1048576  // 파티션당 최대 1MB
props["max.poll.records"] = 500        // poll()당 최대 레코드 수
```

### 처리 패턴

```kotlin
// 느린 처리는 비동기로 (주의: 오프셋 관리 복잡해짐)
val futures = mutableListOf<CompletableFuture<Void>>()

for (record in records) {
    futures.add(
        CompletableFuture.runAsync { processAsync(record) }
    )
}

CompletableFuture.allOf(*futures.toTypedArray()).join()
consumer.commitSync()
```

---

## Consumer Lag 모니터링

```bash
# Consumer Group 상태 확인
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group order-processor

# 출력:
# GROUP           TOPIC  PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# order-processor orders 0          1000            1050            50
# order-processor orders 1          2000            2000            0
```

```
Lag = LOG-END-OFFSET - CURRENT-OFFSET

Lag = 0     → 정상 (실시간 처리 중)
Lag 증가    → 처리 속도 < 생산 속도 → 소비자 증설 또는 처리 최적화 필요
Lag = -     → 소비자 오프라인
```

---

## 정리

- **Consumer Group**: 파티션을 나눠 병렬 소비, 그룹마다 독립적 오프셋
- **오프셋 커밋**: 수동 커밋(`enable.auto.commit=false`) + `commitSync()` 권장
- **소비 의미론**: At Least Once 기본, 멱등성 처리로 Exactly Once 달성
- **Rebalancing**: 소비자 추가/제거 시 파티션 재할당, Cooperative 방식 권장
- **Consumer Lag**: `LOG-END-OFFSET - CURRENT-OFFSET`, 지속 모니터링 필요
