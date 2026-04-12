---
title: "Outbox 패턴: 트랜잭션 보장 이벤트 발행"
date: 2026-04-12
tags: [outbox-pattern, transactional-outbox, kafka, cache-invalidation]
---

## 문제: DB와 이벤트 발행의 원자성

```
기존 방식:
  1. DB 업데이트
  2. Kafka 이벤트 발행

문제:
  - DB 성공 + Kafka 실패 → 캐시 무효화 누락
  - DB 실패 + Kafka 성공 → 없는 데이터의 캐시 무효화
```

**DB 트랜잭션과 메시지 발행을 원자적으로 처리할 수 없습니다.**

---

## Outbox 패턴

DB 트랜잭션 안에 이벤트를 같이 저장하고, 별도 프로세스가 이벤트를 꺼내 발행합니다.

```
1. DB 트랜잭션:
   - users 테이블 업데이트
   - outbox 테이블에 이벤트 저장
   (둘 다 같은 트랜잭션 → 원자적)

2. Outbox Relay (별도 프로세스):
   - outbox 테이블에서 미발행 이벤트 조회
   - Kafka에 발행
   - 발행 완료 표시
```

---

## 구현

```sql
-- outbox 테이블
CREATE TABLE outbox_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    aggregate_type VARCHAR(50) NOT NULL,    -- 'user', 'product'
    aggregate_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,        -- 'user.updated', 'user.deleted'
    payload JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP NULL,            -- NULL이면 미발행
    INDEX idx_published (published_at)
);
```

```python
def update_user_with_outbox(user_id: int, data: dict):
    with db.transaction() as conn:
        # 1. 실제 업데이트
        conn.execute(
            "UPDATE users SET name = %s WHERE id = %s",
            (data["name"], user_id)
        )

        # 2. Outbox에 이벤트 저장 (같은 트랜잭션)
        conn.execute(
            """INSERT INTO outbox_events
               (aggregate_type, aggregate_id, event_type, payload)
               VALUES (%s, %s, %s, %s)""",
            ("user", user_id, "user.updated", json.dumps({
                "user_id": user_id,
                "changes": data
            }))
        )
    # 트랜잭션 커밋 → 둘 다 성공하거나 둘 다 실패
```

---

## Outbox Relay (발행 프로세스)

```python
import time

def outbox_relay():
    """미발행 이벤트를 Kafka로 발행"""
    while True:
        events = db.execute("""
            SELECT * FROM outbox_events
            WHERE published_at IS NULL
            ORDER BY id
            LIMIT 100
            FOR UPDATE SKIP LOCKED   -- 다른 릴레이 프로세스와 경쟁 방지
        """)

        for event in events:
            try:
                kafka_producer.send(
                    topic=f"events.{event['aggregate_type']}",
                    key=str(event["aggregate_id"]).encode(),
                    value=json.dumps({
                        "event_type": event["event_type"],
                        "payload": event["payload"]
                    }).encode()
                )
                kafka_producer.flush()

                # 발행 완료 표시
                db.execute(
                    "UPDATE outbox_events SET published_at = NOW() WHERE id = %s",
                    (event["id"],)
                )

            except Exception as e:
                logger.error(f"발행 실패: {event['id']}, {e}")
                # 재시도 (다음 루프에서 다시 처리)

        time.sleep(0.1)  # 100ms 폴링
```

---

## Debezium으로 Outbox Relay 대체

Debezium이 outbox 테이블 변경을 캡처해 Kafka로 전달합니다:

```json
{
  "name": "outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "table.include.list": "myapp.outbox_events",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.table.field.event.key": "aggregate_id",
    "transforms.outbox.table.field.event.type": "event_type",
    "transforms.outbox.route.topic.replacement": "events.${routedByValue}"
  }
}
```

**Debezium + Outbox = 폴링 없이 신뢰성 있는 이벤트 발행**

---

## Spring Transactional Outbox

```java
@Service
@Transactional
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OutboxEventRepository outboxRepository;

    public void updateUser(Long userId, UserUpdateRequest request) {
        User user = userRepository.findById(userId).orElseThrow();
        user.update(request);
        userRepository.save(user);

        // 같은 트랜잭션에 이벤트 저장
        outboxRepository.save(OutboxEvent.builder()
            .aggregateType("user")
            .aggregateId(userId)
            .eventType("user.updated")
            .payload(objectMapper.writeValueAsString(user))
            .build());
    }
}
```

---

## Outbox 패턴 장단점

```
장점:
  - DB 업데이트 + 이벤트 발행 원자적 보장
  - 이벤트 유실 없음 (DB에 영속화)
  - 서비스 재시작 후에도 미발행 이벤트 처리

단점:
  - outbox 테이블 추가 관리
  - 발행 지연 (폴링 주기 또는 CDC 지연)
  - 오래된 이벤트 정리 필요 (published_at 기준 삭제)
```

---

## 핵심 요약

- 문제: DB 업데이트 + Kafka 발행은 원자적 불가
- **Outbox 패턴**: 같은 DB 트랜잭션에 이벤트 저장 → 별도 Relay가 Kafka 발행
- 이벤트 유실 없음, DB가 이벤트 버퍼 역할
- Debezium + Outbox: 폴링 없이 CDC가 자동 전달
- 캐시 무효화 외에도 마이크로서비스 간 이벤트 전파에 범용 사용
