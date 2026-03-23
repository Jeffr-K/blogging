---
title: "[Kafka] 8. Kafka Streams — KStream, KTable, Windowing"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "kafka-streams", "kstream", "ktable", "windowing", "스트림처리"]
---

# Kafka Streams — KStream, KTable, Windowing

## Kafka Streams란?

Kafka 위에서 동작하는 **경량 스트림 처리 라이브러리**.

```
Kafka Topic (입력)
  ↓
Kafka Streams 처리 (변환, 집계, 조인)
  ↓
Kafka Topic (출력)
```

특징:
- 별도 클러스터 불필요 — 일반 Java/Kotlin 애플리케이션
- Kafka에 데이터가 있는 한 자체적으로 상태 관리
- 정확히 한 번(EOS) 처리 지원
- 수평 확장 — 인스턴스 추가만으로 병렬 처리

---

## KStream vs KTable

### KStream — 이벤트 스트림

```
이벤트 로그: 모든 이벤트를 독립적으로 처리

시간 → [클릭] [클릭] [클릭] [클릭] ...

같은 키라도 각각 별개의 이벤트
예: 클릭 이벤트, 주문 생성, 로그
```

### KTable — 변경 로그 (상태 테이블)

```
같은 키의 최신 값만 유지 (upsert 의미론)

key=user-1, value={"name": "Alice"}
key=user-1, value={"name": "Alice Kim"}  ← 이전 값 대체

DB 테이블처럼 동작
예: 사용자 프로필, 재고 현황, 설정
```

```
KStream:
  key=A, v1
  key=A, v2
  key=A, v3  → 세 이벤트 모두 처리

KTable:
  key=A → v3  (최신값만 유지)
```

---

## 기본 스트림 처리

```kotlin
val props = Properties().apply {
    put(StreamsConfig.APPLICATION_ID_CONFIG, "order-processor")
    put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092")
    put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String()::class.java)
    put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, Serdes.String()::class.java)
}

val builder = StreamsBuilder()

// KStream 생성
val orders: KStream<String, String> = builder.stream("orders")

// 변환 체인
orders
    .filter { key, value -> value.contains("\"status\":\"PAID\"") }
    .mapValues { value -> parseOrder(value).toShippingEvent().toJson() }
    .to("shipping-events")

val topology = builder.build()
val streams = KafkaStreams(topology, props)
streams.start()

// 종료 시
Runtime.getRuntime().addShutdownHook(Thread { streams.close() })
```

---

## 스트림 연산자

### Stateless 연산

```kotlin
val stream: KStream<String, Order> = builder.stream("orders")

// filter — 조건에 맞는 것만
val paid = stream.filter { _, order -> order.status == "PAID" }

// map — 키+값 변환
val events = stream.map { key, order ->
    KeyValue("${order.userId}", order.toEvent())
}

// mapValues — 값만 변환
val summaries = stream.mapValues { order -> order.toSummary() }

// flatMap — 하나의 레코드 → 여러 레코드
val items = stream.flatMap { _, order ->
    order.items.map { item -> KeyValue(item.productId, item) }
}

// selectKey — 키 변경
val rekeyed = stream.selectKey { _, order -> order.userId }

// peek — 디버깅용 (사이드 이펙트)
stream.peek { key, value -> logger.debug("Processing: $key") }
```

### Stateful 연산

```kotlin
// groupByKey + count
val orderCount: KTable<String, Long> = stream
    .groupByKey()
    .count(Materialized.as("order-count-store"))

// groupBy + aggregate
val totalByUser: KTable<String, Long> = stream
    .groupBy { _, order -> order.userId }
    .aggregate(
        { 0L },  // 초기값
        { _, order, total -> total + order.amount },  // 집계
        Materialized.`as`<String, Long>("user-totals-store")
            .withValueSerde(Serdes.Long())
    )

// reduce
val maxByUser: KTable<String, Order> = stream
    .groupByKey()
    .reduce { order1, order2 ->
        if (order1.amount > order2.amount) order1 else order2
    }
```

---

## Windowing

시간 범위를 기준으로 이벤트를 그룹화.

### Tumbling Window (고정 시간 슬라이딩 없음)

```
|---1분---|---1분---|---1분---|
  [A][B]     [C]       [D][E]

겹치지 않는 고정 크기 윈도우
```

```kotlin
stream
    .groupByKey()
    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(1)))
    .count()
    .toStream()
    .map { windowedKey, count ->
        KeyValue(
            "${windowedKey.key()}_${windowedKey.window().start()}",
            count
        )
    }
    .to("order-count-per-minute")
```

### Hopping Window (겹치는 슬라이딩)

```
크기 5분, 간격 1분:
|-----5분-----|
  |-----5분-----|
    |-----5분-----|
      ...
```

```kotlin
stream
    .groupByKey()
    .windowedBy(
        TimeWindows.ofSizeAndGrace(Duration.ofMinutes(5), Duration.ofSeconds(30))
            .advanceBy(Duration.ofMinutes(1))
    )
    .count()
```

### Session Window (비활성 기간 기준)

```
같은 키의 이벤트들 사이에 비활성 시간이 임계값 초과 시 세션 분리

[A] [A] [A]    gap    [A] [A]
|--session1--|  |--session2--|
```

```kotlin
stream
    .groupByKey()
    .windowedBy(SessionWindows.ofInactivityGapWithNoGrace(Duration.ofMinutes(5)))
    .count()
```

### Grace Period

```
늦게 도착한 이벤트 처리:
  grace(Duration.ofSeconds(30))
  → 윈도우 종료 후 30초간 늦은 이벤트 허용
```

---

## KStream-KTable 조인

```kotlin
val orders: KStream<String, Order> = builder.stream("orders")
val users: KTable<String, User> = builder.table("users")

// Stream-Table 조인 (orders의 key = userId)
val enriched: KStream<String, EnrichedOrder> = orders
    .join(users) { order, user ->
        EnrichedOrder(
            orderId = order.id,
            userId = order.userId,
            userName = user.name,
            amount = order.amount
        )
    }

enriched.to("enriched-orders")
```

### 조인 종류

| 조인 | 설명 |
|------|------|
| `stream.join(table)` | 테이블에 키가 있을 때만 조인 (inner join) |
| `stream.leftJoin(table)` | 테이블에 없으면 null (left join) |
| `stream.join(stream)` | 두 스트림을 시간 윈도우 기준으로 조인 |
| `table.join(table)` | 두 테이블 조인 |

---

## State Store

집계, 조인에 필요한 상태를 로컬 RocksDB에 저장.

```kotlin
// 인터랙티브 쿼리 — 외부에서 상태 직접 조회 가능
val store = streams.store(
    StoreQueryParameters.fromNameAndType(
        "order-count-store",
        QueryableStoreTypes.keyValueStore<String, Long>()
    )
)

val count = store.get("user-123")
println("user-123의 주문 수: $count")

// 윈도우 스토어 조회
val windowStore = streams.store(
    StoreQueryParameters.fromNameAndType(
        "windowed-counts",
        QueryableStoreTypes.windowStore<String, Long>()
    )
)
```

State Store는 Kafka 토픽에 백업 (`__streams-changelog` 토픽)되어 장애 복구 가능.

---

## Processor API (저수준)

```kotlin
class OrderProcessor : Processor<String, Order, String, String> {
    private lateinit var context: ProcessorContext<String, String>
    private lateinit var store: KeyValueStore<String, Long>

    override fun init(context: ProcessorContext<String, String>) {
        this.context = context
        this.store = context.getStateStore("order-counts")

        // 30초마다 스케줄링
        context.schedule(Duration.ofSeconds(30), PunctuationType.WALL_CLOCK_TIME) { timestamp ->
            store.all().forEach { entry ->
                if (entry.value > 100) {
                    context.forward(Record(entry.key, "HIGH_VOLUME", timestamp))
                }
            }
        }
    }

    override fun process(record: Record<String, Order>) {
        val current = store.get(record.key()) ?: 0L
        store.put(record.key(), current + 1)
    }
}
```

---

## 정리

- **KStream**: 이벤트 스트림 — 각 이벤트 독립 처리
- **KTable**: 상태 테이블 — 같은 키의 최신 값 유지
- **Windowing**: 시간 범위로 집계 — Tumbling(겹침 없음), Hopping(겹침), Session(비활성 기준)
- **State Store**: RocksDB 기반 로컬 상태, Changelog 토픽으로 백업
- **조인**: KStream-KTable, KStream-KStream(윈도우), KTable-KTable
- **장점**: 별도 클러스터 없이 Kafka 위에서 실시간 처리, EOS 지원
