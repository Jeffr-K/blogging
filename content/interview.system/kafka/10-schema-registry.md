---
title: "[Kafka] 10. Schema Registry — Avro, 스키마 진화, 호환성 정책"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "schema-registry", "avro", "protobuf", "스키마진화", "호환성"]
---

# Schema Registry — Avro, 스키마 진화, 호환성 정책

## 왜 Schema Registry가 필요한가?

```
프로듀서 (Java)                     소비자 (Python)
OrderCreated {                       JSON 파싱:
  orderId: Long,      →  Kafka  →     orderId: int ← Long을 int로 읽음!
  userId: Long,                        userId: ...
  amount: Long,                        totalAmount: ??? ← 필드 이름이 다름!
  createdAt: String
}
```

문제:
- 스키마 변경 시 프로듀서/소비자 간 불일치
- JSON: 타입 정보 없음, 스키마 없음
- 메시지마다 스키마를 포함하면 용량 낭비

---

## Schema Registry 동작 원리

```
┌──────────────┐    ①스키마 등록    ┌────────────────┐
│   Producer   │ ──────────────→  │ Schema Registry│
│              │ ←─────────────── │                │
│              │    ②schema ID    │  스키마 저장    │
└──────┬───────┘                  └────────────────┘
       │ ③[magic byte(1)][schema ID(4)][serialized data]
       ↓
    Kafka Topic
       ↓
┌──────────────┐    ④schema ID로 스키마 조회
│   Consumer   │ ──────────────→ Schema Registry
│              │ ←─────────────── 스키마 반환
└──────────────┘    ⑤역직렬화
```

메시지 헤더 (5바이트):
- `0x00`: Magic byte (Confluent 포맷 식별자)
- `4 bytes`: Schema ID (int)
- 나머지: Avro/Protobuf로 직렬화된 데이터

---

## Avro

Apache Avro — JSON 기반 스키마, 바이너리 직렬화.

### 스키마 정의

```json
{
  "type": "record",
  "name": "OrderCreated",
  "namespace": "com.example.events",
  "fields": [
    { "name": "orderId", "type": "long" },
    { "name": "userId", "type": "long" },
    { "name": "amount", "type": "long" },
    { "name": "currency", "type": "string", "default": "KRW" },
    { "name": "createdAt", "type": "string" },
    {
      "name": "items",
      "type": {
        "type": "array",
        "items": {
          "type": "record",
          "name": "OrderItem",
          "fields": [
            { "name": "productId", "type": "string" },
            { "name": "quantity", "type": "int" },
            { "name": "price", "type": "long" }
          ]
        }
      }
    }
  ]
}
```

### Avro 타입 시스템

| Avro 타입 | Java 타입 |
|-----------|-----------|
| null | null |
| boolean | Boolean |
| int | Integer |
| long | Long |
| float | Float |
| double | Double |
| bytes | ByteBuffer |
| string | String |
| record | 생성된 클래스 또는 GenericRecord |
| array | List |
| map | Map |
| union | 여러 타입 중 하나 |

### Nullable 필드

```json
{
  "name": "couponCode",
  "type": ["null", "string"],
  "default": null
}
```

---

## Kotlin + Avro + Schema Registry

```kotlin
// Gradle 의존성
// implementation("io.confluent:kafka-avro-serializer:7.6.0")
// implementation("org.apache.avro:avro:1.11.3")

// Producer 설정
val props = Properties().apply {
    put("bootstrap.servers", "localhost:9092")
    put("key.serializer", StringSerializer::class.java.name)
    put("value.serializer", KafkaAvroSerializer::class.java.name)
    put("schema.registry.url", "http://schema-registry:8081")
}

// GenericRecord 사용
val schema = Schema.Parser().parse(File("order-created.avsc"))
val record = GenericData.Record(schema).apply {
    put("orderId", 12345L)
    put("userId", 67890L)
    put("amount", 50000L)
    put("currency", "KRW")
    put("createdAt", Instant.now().toString())
}

producer.send(ProducerRecord("orders", "order-12345", record))
```

```kotlin
// Consumer 설정
val props = Properties().apply {
    put("bootstrap.servers", "localhost:9092")
    put("group.id", "order-processor")
    put("key.deserializer", StringDeserializer::class.java.name)
    put("value.deserializer", KafkaAvroDeserializer::class.java.name)
    put("schema.registry.url", "http://schema-registry:8081")
    put("specific.avro.reader", "true")  // 생성된 클래스 사용 시
}
```

---

## 스키마 진화 (Schema Evolution)

### 스키마 변경 종류

```
하위 호환 (Backward Compatible):
  - 필드 삭제 (기존 소비자는 해당 필드 무시)
  - default가 있는 선택 필드 추가 (기존 소비자가 없는 필드는 default 사용)

상위 호환 (Forward Compatible):
  - 필드 추가 (새 소비자가 모르는 필드 무시)
  - default가 있는 필드 삭제 (새 소비자가 없는 필드는 default 사용)

완전 호환 (Full Compatible):
  하위 + 상위 모두 만족
  → default가 있는 필드만 추가/삭제 가능
```

### 호환되지 않는 변경

```
- 필드 이름 변경 (기존 필드 삭제 + 새 필드 추가로 봄)
- 타입 변경 (int → string)
- default 없는 필수 필드 추가
```

---

## 호환성 정책 (Compatibility Policy)

Schema Registry에서 스키마 변경 시 호환성 검사.

| 정책 | 설명 | 적용 방향 |
|------|------|-----------|
| `BACKWARD` | 새 스키마로 이전 데이터 읽기 가능 | 소비자 먼저 업그레이드 |
| `FORWARD` | 이전 스키마로 새 데이터 읽기 가능 | 프로듀서 먼저 업그레이드 |
| `FULL` | 양방향 호환 | 업그레이드 순서 자유 |
| `BACKWARD_TRANSITIVE` | 모든 이전 버전과 하위 호환 | |
| `FORWARD_TRANSITIVE` | 모든 이전 버전과 상위 호환 | |
| `FULL_TRANSITIVE` | 모든 버전과 완전 호환 | **엄격한 운영 환경 권장** |
| `NONE` | 호환성 검사 없음 | 개발 환경 |

```bash
# 전역 호환성 정책 설정
curl -X PUT http://schema-registry:8081/config \
  -H "Content-Type: application/json" \
  -d '{"compatibility": "BACKWARD"}'

# 특정 서브젝트의 정책 설정
curl -X PUT http://schema-registry:8081/config/orders-value \
  -H "Content-Type: application/json" \
  -d '{"compatibility": "FULL_TRANSITIVE"}'
```

---

## Schema Registry REST API

```bash
# 서브젝트 목록 (토픽명-key, 토픽명-value)
curl http://schema-registry:8081/subjects

# 서브젝트의 스키마 목록
curl http://schema-registry:8081/subjects/orders-value/versions

# 특정 버전 스키마 조회
curl http://schema-registry:8081/subjects/orders-value/versions/1

# 최신 스키마 조회
curl http://schema-registry:8081/subjects/orders-value/versions/latest

# 스키마 등록
curl -X POST http://schema-registry:8081/subjects/orders-value/versions \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema": "{\"type\":\"record\",\"name\":\"Order\",...}"}'

# 호환성 테스트 (실제 등록 전 확인)
curl -X POST http://schema-registry:8081/compatibility/subjects/orders-value/versions/latest \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema": "..."}'
```

---

## Protobuf vs Avro vs JSON Schema

| | Avro | Protobuf | JSON Schema |
|--|------|----------|-------------|
| 직렬화 크기 | 작음 | 가장 작음 | 큼 |
| 스키마 진화 | 좋음 | 매우 좋음 | 좋음 |
| 다국어 지원 | 좋음 | 매우 좋음 | 좋음 |
| 가독성 | 중간 | 낮음 (바이너리) | 높음 |
| Confluent 지원 | 완전 | 완전 | 완전 |
| 선택 기준 | 범용, Kafka 친화적 | 높은 성능 필요 | JSON 기반 유지 |

---

## 정리

- **Schema Registry**: 스키마 중앙 저장, ID 기반 참조로 메시지 크기 절감
- **Avro**: 바이너리 직렬화 + JSON 스키마 정의, 스키마 진화 지원
- **호환성 정책**: `BACKWARD`(소비자 먼저 업그레이드), `FORWARD`(프로듀서 먼저), `FULL`(양방향)
- **스키마 진화**: default 있는 필드 추가/삭제가 가장 안전
- **FULL_TRANSITIVE**: 프로덕션 권장 — 모든 이전 버전과 호환 보장
