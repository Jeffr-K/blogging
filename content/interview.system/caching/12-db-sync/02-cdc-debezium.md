---
title: "CDC와 Debezium: DB 변경을 캐시에 반영"
date: 2026-04-12
tags: [cdc, debezium, kafka, cache-invalidation, db-sync]
---

## CDC란

**Change Data Capture**: DB의 변경사항(INSERT/UPDATE/DELETE)을 실시간으로 캡처해 다른 시스템에 전파합니다.

```
기존 방식 (Dual Write):
  애플리케이션 → DB 업데이트
  애플리케이션 → 캐시 업데이트 (코드에서 직접)
  → 부분 실패, 누락 위험

CDC 방식:
  애플리케이션 → DB 업데이트만
  CDC → DB 변경 감지 → Kafka → 캐시 무효화
  → DB가 진실의 원천, 캐시는 파생
```

---

## Debezium 아키텍처

```
MySQL binlog / PostgreSQL WAL
       ↓
   Debezium (Kafka Connect)
       ↓
   Kafka Topic (db.users)
       ↓
   Consumer → Redis 캐시 무효화
              → Elasticsearch 인덱스 갱신
              → 알림 서비스
```

---

## Debezium 설정 (MySQL)

```json
// Kafka Connect에 Connector 등록
POST /connectors
{
  "name": "users-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "mysql",
    "database.port": "3306",
    "database.user": "debezium",
    "database.password": "password",
    "database.server.name": "myapp",
    "database.include.list": "myapp",
    "table.include.list": "myapp.users",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState"
  }
}
```

**Kafka Topic 생성:** `myapp.myapp.users`

---

## 변경 이벤트 메시지 형식

```json
{
  "before": {
    "id": 42,
    "name": "Alice",
    "email": "alice@example.com"
  },
  "after": {
    "id": 42,
    "name": "Alice Kim",
    "email": "alice@example.com"
  },
  "op": "u",      // c=create, u=update, d=delete
  "ts_ms": 1712882400000
}
```

---

## 캐시 무효화 컨슈머

```python
from kafka import KafkaConsumer
import json
import redis

r = redis.Redis()

consumer = KafkaConsumer(
    "myapp.myapp.users",
    bootstrap_servers=["kafka:9092"],
    value_deserializer=lambda m: json.loads(m.decode()),
    group_id="cache-invalidator",
    auto_offset_reset="earliest"
)

def handle_user_change(event: dict):
    op = event.get("op")
    after = event.get("after")
    before = event.get("before")

    user_id = (after or before)["id"]
    cache_key = f"user:{user_id}"

    if op == "d":  # DELETE
        r.delete(cache_key)
        print(f"캐시 삭제: {cache_key}")

    elif op in ("u", "c"):  # UPDATE or CREATE
        r.delete(cache_key)  # 삭제 후 다음 조회 시 재생성
        print(f"캐시 무효화: {cache_key}")

for message in consumer:
    handle_user_change(message.value)
```

---

## Spring + Kafka 컨슈머

```java
@Component
public class UserCacheInvalidator {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @KafkaListener(topics = "myapp.myapp.users", groupId = "cache-invalidator")
    public void handleUserChange(@Payload String message) {
        UserChangeEvent event = objectMapper.readValue(message, UserChangeEvent.class);

        String cacheKey = "user:" + event.getUserId();

        switch (event.getOp()) {
            case "d" -> redisTemplate.delete(cacheKey);
            case "u", "c" -> redisTemplate.delete(cacheKey);
        }
    }
}
```

---

## CDC vs 직접 무효화 비교

| | 직접 무효화 | CDC (Debezium) |
|--|-----------|--------------|
| 구현 위치 | 애플리케이션 코드 | 인프라 레이어 |
| 누락 위험 | 코드 빠뜨리면 누락 | DB binlog 기반, 누락 없음 |
| 복잡도 | 낮음 | 높음 (Kafka 필요) |
| 지연시간 | 즉시 | 수ms~수초 |
| 다중 서비스 | 각 서비스에서 중복 | Kafka로 fan-out |

**CDC 권장 상황:**
- 여러 서비스가 같은 DB 변경에 반응해야 할 때
- 애플리케이션 코드 누락을 허용할 수 없을 때
- 이미 Kafka 인프라가 있을 때

---

## 핵심 요약

- CDC: DB 변경 → Kafka → 캐시 무효화 (코드에서 직접 처리 불필요)
- **Debezium**: MySQL binlog/PostgreSQL WAL 캡처 → Kafka 전송
- 누락 없음: 코드가 아닌 DB 레이어에서 캡처
- 지연시간: 수ms~수초 (최종 일관성)
- Kafka 인프라가 있는 환경에서 강력한 패턴
