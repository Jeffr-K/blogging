---
title: "[Kafka] 14. 고급 패턴 — Event Sourcing, CQRS, Saga, Outbox, DLQ"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "event-sourcing", "CQRS", "saga", "outbox", "DLQ", "마이크로서비스"]
---

# 고급 패턴 — Event Sourcing, CQRS, Saga, Outbox, DLQ

## Event Sourcing

### 개념

상태를 저장하는 대신 **상태 변경 이벤트를 순서대로 저장**.

```
전통적 방식:
  orders 테이블
  id=1, status=SHIPPED, amount=50000  ← 현재 상태만 저장

Event Sourcing:
  order-events 토픽 (또는 이벤트 스토어)
  key=order-1  → OrderCreated  {amount: 50000}
  key=order-1  → OrderPaid     {paymentId: "P123"}
  key=order-1  → OrderShipped  {trackingNo: "T456"}

  현재 상태 = 이벤트 순차 재생으로 복원
```

### Kafka로 구현

```kotlin
// 이벤트 발행 (Log Compaction 토픽)
sealed class OrderEvent {
    data class OrderCreated(
        val orderId: String,
        val userId: String,
        val amount: Long,
        val items: List<OrderItem>,
        val timestamp: Instant,
    ) : OrderEvent()

    data class OrderPaid(
        val orderId: String,
        val paymentId: String,
        val timestamp: Instant,
    ) : OrderEvent()

    data class OrderShipped(
        val orderId: String,
        val trackingNumber: String,
        val timestamp: Instant,
    ) : OrderEvent()

    data class OrderCancelled(
        val orderId: String,
        val reason: String,
        val timestamp: Instant,
    ) : OrderEvent()
}

// 상태 복원 (Projection)
fun replayOrderState(events: List<OrderEvent>): OrderState {
    return events.fold(OrderState.Empty) { state, event ->
        when (event) {
            is OrderEvent.OrderCreated -> state.apply(event)
            is OrderEvent.OrderPaid    -> state.apply(event)
            is OrderEvent.OrderShipped -> state.apply(event)
            is OrderEvent.OrderCancelled -> state.apply(event)
        }
    }
}
```

### 이벤트 소싱 토픽 설정

```bash
# Log Compaction으로 설정 (최신 상태 보존)
kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic order-events \
  --partitions 12 \
  --replication-factor 3 \
  --config cleanup.policy=compact \
  --config retention.ms=-1  # 영구 보존
```

---

## CQRS (Command Query Responsibility Segregation)

### 개념

**쓰기(Command)**와 **읽기(Query)** 모델을 분리.

```
Command Side:                    Query Side:
  OrderService          →  Kafka  →  OrderProjectionService
  (이벤트 발행)                        (다양한 읽기 모델 생성)
  EventStore                           Elasticsearch (검색)
                                       Redis (캐시)
                                       PostgreSQL (통계)
```

### Kafka Streams로 Projection 생성

```kotlin
val builder = StreamsBuilder()

// 주문 이벤트 스트림에서 다양한 읽기 모델 생성

// 1. 사용자별 주문 집계 (KTable)
val ordersByUser: KTable<String, UserOrderSummary> = builder
    .stream<String, OrderEvent>("order-events")
    .filter { _, event -> event is OrderEvent.OrderCreated }
    .groupBy { _, event -> (event as OrderEvent.OrderCreated).userId }
    .aggregate(
        { UserOrderSummary() },
        { userId, event, summary ->
            summary.addOrder((event as OrderEvent.OrderCreated))
        },
        Materialized.`as`("user-order-summaries")
    )

// 2. 일별 매출 (Windowed)
val dailySales: KTable<Windowed<String>, Long> = builder
    .stream<String, OrderEvent>("order-events")
    .filter { _, event -> event is OrderEvent.OrderPaid }
    .mapValues { event -> (event as OrderEvent.OrderPaid) }
    .groupBy { _, _ -> "global" }
    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofDays(1)))
    .aggregate(
        { 0L },
        { _, event, total -> total + lookupOrderAmount(event.orderId) },
        Materialized.`as`("daily-sales")
    )
```

---

## Saga 패턴

### 문제: 분산 트랜잭션

```
주문 생성 시나리오:
  1. Order Service: 주문 생성
  2. Payment Service: 결제 처리
  3. Inventory Service: 재고 차감
  4. Shipping Service: 배송 준비

→ 2번 성공, 3번 실패 시?
→ 전통적 2PC는 Kafka에서 비실용적
→ Saga 패턴으로 해결
```

### Choreography Saga (안무 방식)

각 서비스가 이벤트를 듣고 다음 단계를 트리거. 중앙 조정자 없음.

```
Order Service
  → order.created 발행

Payment Service (order.created 구독)
  → 결제 성공: payment.completed 발행
  → 결제 실패: payment.failed 발행

Inventory Service (payment.completed 구독)
  → 재고 차감 성공: inventory.reserved 발행
  → 재고 부족: inventory.failed 발행

Order Service (inventory.failed 구독)
  → 주문 취소 처리, order.cancelled 발행

Payment Service (order.cancelled 구독)
  → 결제 환불 (보상 트랜잭션)
```

```kotlin
// Order Service
@EventHandler("payment.failed", "inventory.failed")
fun handleFailure(event: FailureEvent) {
    orderService.cancel(event.orderId, event.reason)
    producer.send(ProducerRecord("order.cancelled", event.orderId,
        OrderCancelled(event.orderId, event.reason)))
}
```

### Orchestration Saga (오케스트레이션 방식)

중앙 Saga Orchestrator가 각 서비스에 직접 명령.

```kotlin
class OrderSagaOrchestrator(
    private val producer: KafkaProducer<String, String>,
) {
    fun execute(orderId: String) {
        val saga = OrderSagaState(orderId)

        // 1단계: 결제 요청
        producer.send(ProducerRecord(
            "payment.commands",
            orderId,
            ProcessPaymentCommand(orderId).toJson()
        ))
        saga.currentStep = SagaStep.PAYMENT_PROCESSING
    }

    @EventHandler("payment.result")
    fun onPaymentResult(event: PaymentResult) {
        if (event.success) {
            // 2단계: 재고 차감
            producer.send(ProducerRecord(
                "inventory.commands",
                event.orderId,
                ReserveInventoryCommand(event.orderId).toJson()
            ))
        } else {
            // 보상: 주문 취소
            compensate(event.orderId)
        }
    }

    private fun compensate(orderId: String) {
        producer.send(ProducerRecord(
            "order.commands", orderId,
            CancelOrderCommand(orderId).toJson()
        ))
    }
}
```

---

## Transactional Outbox 패턴

### 문제: 이중 쓰기

```
// 위험한 코드
db.save(order)          // DB 저장 성공
kafka.send(orderEvent)  // Kafka 전송 실패 → 불일치!

또는:
kafka.send(orderEvent)  // Kafka 전송 성공
db.save(order)          // DB 저장 실패 → 이벤트만 발행됨!
```

### 해결: Outbox 테이블

```
1. DB 트랜잭션 안에서:
   - orders 테이블에 주문 저장
   - outbox 테이블에 이벤트 저장

   두 작업이 하나의 DB 트랜잭션 → 원자적

2. 별도 프로세스 (Outbox Publisher 또는 Debezium):
   outbox 테이블의 미발행 이벤트 → Kafka 발행
   발행 성공 → outbox 레코드 삭제/마킹
```

```kotlin
// outbox 테이블
data class OutboxEvent(
    val id: UUID = UUID.randomUUID(),
    val aggregateType: String,   // "Order"
    val aggregateId: String,     // orderId
    val eventType: String,       // "OrderCreated"
    val payload: String,         // JSON
    val createdAt: Instant = Instant.now(),
    val publishedAt: Instant? = null,
)

// 서비스 코드
@Transactional
fun createOrder(request: CreateOrderRequest): Order {
    val order = orderRepository.save(Order.from(request))

    outboxRepository.save(OutboxEvent(
        aggregateType = "Order",
        aggregateId = order.id,
        eventType = "OrderCreated",
        payload = OrderCreated(order.id, order.userId, order.amount).toJson(),
    ))

    return order
    // 트랜잭션 커밋 시 orders + outbox 동시에 저장
}
```

### Debezium으로 Outbox 발행

```json
{
  "name": "outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.route.by.field": "aggregate_type",
    "transforms.outbox.route.topic.replacement": "${routedByValue}.events",
    "transforms.outbox.table.fields.additional.placement": "type:header:eventType"
  }
}
```

---

## Dead Letter Queue (DLQ)

처리 실패 메시지를 별도 토픽으로 보내 나중에 재처리.

### DLQ 패턴

```
orders 토픽 → Consumer → 처리 성공 → 커밋
                        → 처리 실패 → orders.DLQ 토픽으로 이동

orders.DLQ → DLQ Consumer → 원인 분석 → 수동 재처리 또는 폐기
```

### 구현

```kotlin
class OrderConsumerWithDLQ(
    private val consumer: KafkaConsumer<String, String>,
    private val dlqProducer: KafkaProducer<String, String>,
) {
    private val maxRetries = 3
    private val retryCount = mutableMapOf<TopicPartition, MutableMap<Long, Int>>()

    fun run() {
        consumer.subscribe(listOf("orders"))
        while (true) {
            val records = consumer.poll(Duration.ofMillis(100))

            for (record in records) {
                val tp = TopicPartition(record.topic(), record.partition())
                val retries = retryCount.getOrPut(tp) { mutableMapOf() }
                    .getOrDefault(record.offset(), 0)

                try {
                    processOrder(record.value())
                    retries.remove(record.offset())
                } catch (e: Exception) {
                    if (retries < maxRetries) {
                        retries[record.offset()] = retries + 1
                        logger.warn("재시도 ${retries + 1}/$maxRetries: ${record.offset()}", e)
                        // 이 레코드부터 다시 읽기
                        consumer.seek(tp, record.offset())
                        break
                    } else {
                        // DLQ로 이동
                        sendToDLQ(record, e)
                        retries.remove(record.offset())
                    }
                }
            }

            consumer.commitSync()
        }
    }

    private fun sendToDLQ(record: ConsumerRecord<String, String>, error: Exception) {
        val dlqRecord = ProducerRecord(
            "orders.DLQ",
            record.key(),
            record.value(),
        ).apply {
            headers().add("original-topic", record.topic().toByteArray())
            headers().add("original-partition", record.partition().toString().toByteArray())
            headers().add("original-offset", record.offset().toString().toByteArray())
            headers().add("error-message", (error.message ?: "unknown").toByteArray())
            headers().add("error-class", error::class.java.name.toByteArray())
            headers().add("failed-at", Instant.now().toString().toByteArray())
        }
        dlqProducer.send(dlqRecord)
        logger.error("DLQ로 이동: topic=${record.topic()}, offset=${record.offset()}", error)
    }
}
```

### DLQ 재처리

```bash
# DLQ 메시지 확인
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic orders.DLQ \
  --from-beginning \
  --property print.headers=true

# DLQ → 원본 토픽으로 재전송 (수정 후)
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic orders.DLQ \
  --from-beginning | \
kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic orders
```

---

## 정리

- **Event Sourcing**: 상태 대신 이벤트 저장 → 이벤트 재생으로 상태 복원, Log Compaction 토픽 활용
- **CQRS**: Kafka Streams로 이벤트 스트림을 다양한 읽기 모델로 변환
- **Saga**: 분산 트랜잭션 대안 — Choreography(이벤트 기반), Orchestration(중앙 조정)
- **Outbox**: DB 트랜잭션과 Kafka 발행의 원자성 보장 — Debezium CDC 활용 권장
- **DLQ**: 처리 실패 메시지를 분리하여 나중에 재처리 — 헤더에 원본 정보 포함
