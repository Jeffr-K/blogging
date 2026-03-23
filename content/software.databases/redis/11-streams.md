---
title: "[Redis] 11. Streams — 메시지 스트리밍과 Consumer Group"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "streams", "XADD", "XREAD", "consumer-group", "메시지큐"]
---

# Streams — 메시지 스트리밍과 Consumer Group

## 개요

Redis Streams는 Kafka와 유사한 **append-only 로그** 자료구조. 메시지 ID, 보존, Consumer Group 지원.

```
Stream: events
  1700000001000-0: {action: "login", userId: "1001"}
  1700000002000-0: {action: "purchase", userId: "1002", amount: "50000"}
  1700000003000-0: {action: "logout", userId: "1001"}
          ↑
  타임스탬프(ms)-시퀀스
```

---

## 메시지 추가

```bash
# XADD key [MAXLEN [= | ~] count] [MINID [= | ~] id] *|id field value [field value ...]

# * → 자동 ID (타임스탬프-시퀀스)
XADD events * action login userId 1001
# → "1700000001000-0"

# 최대 길이 제한 (approximate, 성능 최적화)
XADD events MAXLEN ~ 1000 * action login userId 1001

# 정확한 최대 길이
XADD events MAXLEN = 1000 * action login userId 1001

# 최소 ID (오래된 메시지 자동 삭제)
XADD events MINID ~ 1699000000000 * action login userId 1001

# 수동 ID (직접 지정)
XADD events 1700000001000-1 action login userId 1001

# 부분 자동 ID
XADD events 1700000001000-* action login userId 1001  # 타임스탬프는 고정, 시퀀스 자동
```

---

## 메시지 읽기

### XREAD

```bash
# XREAD [COUNT count] [BLOCK milliseconds] STREAMS key [key ...] id [id ...]

# 특정 ID 이후 메시지 읽기
XREAD COUNT 10 STREAMS events 0             # ID 0 이후 (전체)
XREAD COUNT 10 STREAMS events 1700000001000-0  # 특정 ID 이후

# 새 메시지 실시간 대기 (blocking)
XREAD BLOCK 0 STREAMS events $       # $ = 현재 최신 ID, 무한 대기
XREAD BLOCK 5000 STREAMS events $    # 5초 대기

# 여러 스트림 동시 구독
XREAD BLOCK 0 STREAMS events alerts notifications $ $ $
```

### 범위 조회

```bash
# XRANGE key start end [COUNT count]
XRANGE events - +              # 전체 메시지
XRANGE events - + COUNT 10     # 처음 10개
XRANGE events 1700000001000 1700000002000  # 시간 범위
XRANGE events (1700000001000-0 +  # 특정 ID 이후 (exclusive)

# 역방향 (최신 순)
XREVRANGE events + -          # 전체 (최신 순)
XREVRANGE events + - COUNT 10 # 최근 10개
```

---

## 스트림 정보

```bash
# 메시지 수
XLEN events

# 스트림 정보
XINFO STREAM events
XINFO STREAM events FULL        # 상세 정보 (Consumer Group 포함)
XINFO STREAM events FULL COUNT 5

# 첫 번째 / 마지막 메시지 ID
XINFO STREAM events  # first-entry, last-entry 포함
```

---

## 삭제 / 정리

```bash
# 특정 메시지 삭제
XDEL events 1700000001000-0

# 길이 제한 (오래된 메시지 삭제)
XTRIM events MAXLEN = 1000     # 정확히 1000개 유지
XTRIM events MAXLEN ~ 1000     # 약 1000개 유지 (빠름)
XTRIM events MINID ~ 1699000000000  # 특정 ID 이전 삭제
```

---

## Consumer Group

여러 소비자가 협력하여 스트림을 처리.

### 그룹 생성

```bash
# XGROUP CREATE key groupname id [MKSTREAM] [ENTRIESREAD count]

# $ = 그룹 생성 이후 새 메시지만
XGROUP CREATE events mygroup $

# 0 = 처음부터 읽기
XGROUP CREATE events mygroup 0

# 스트림 없으면 자동 생성
XGROUP CREATE events mygroup $ MKSTREAM

# 그룹 목록
XINFO GROUPS events

# 그룹 삭제
XGROUP DESTROY events mygroup
```

### 메시지 읽기 (Consumer Group)

```bash
# XREADGROUP GROUP group consumer [COUNT count] [BLOCK milliseconds]
#   [NOACK] STREAMS key [key ...] id [id ...]

# > = 아직 할당되지 않은 새 메시지
XREADGROUP GROUP mygroup consumer1 COUNT 10 STREAMS events >

# 특정 ID 이후 (재처리용 — 이미 할당된 메시지)
XREADGROUP GROUP mygroup consumer1 STREAMS events 0

# Blocking
XREADGROUP GROUP mygroup consumer1 BLOCK 5000 COUNT 10 STREAMS events >
```

### 메시지 확인 (ACK)

```bash
# 처리 완료 확인
XACK events mygroup 1700000001000-0
XACK events mygroup id1 id2 id3  # 여러 개 동시

# Pending 메시지 조회 (ACK 안 된 메시지)
XPENDING events mygroup                   # 요약
XPENDING events mygroup - + 10            # 상세 (최대 10개)
XPENDING events mygroup - + 10 consumer1  # 특정 소비자 것만

# Pending 목록에서 다른 소비자에게 재할당
XCLAIM events mygroup consumer2 60000 1700000001000-0
# 60000ms(60초) 이상 idle인 메시지를 consumer2에게 재할당

# 자동 claim (Redis 7.0+)
XAUTOCLAIM events mygroup consumer2 60000 0
# 0-0 이후 60초 이상 idle인 메시지를 consumer2에게 재할당
```

### Consumer 관리

```bash
# 소비자 목록
XINFO CONSUMERS events mygroup

# 소비자 추가 (XREADGROUP에서 처음 사용할 때 자동 생성)
XGROUP CREATECONSUMER events mygroup consumer1

# 소비자 삭제
XGROUP DELCONSUMER events mygroup consumer1

# 그룹의 마지막 읽은 ID 변경
XGROUP SETID events mygroup 1700000001000-0
```

---

## 전체 흐름 예시 (Kotlin)

```kotlin
// Producer
fun publishEvent(action: String, userId: String) {
    redis.xAdd(
        "events",
        mapOf("action" to action, "userId" to userId)
    )
}

// Consumer (Consumer Group)
fun startConsumer(groupName: String, consumerName: String) {
    // 그룹 생성 (없으면)
    try {
        redis.xGroupCreate("events", groupName, ReadOffset.latest(), true)
    } catch (e: RedisBusyException) {
        // 이미 존재
    }

    while (true) {
        // 새 메시지 읽기
        val results = redis.xReadGroup(
            Consumer.from(groupName, consumerName),
            XReadArgs.StreamOffset.create("events", ReadOffset.lastConsumed()),
        )

        for (result in results) {
            for (message in result.value) {
                try {
                    processMessage(message.body)
                    // ACK
                    redis.xAck("events", groupName, message.id)
                } catch (e: Exception) {
                    logger.error("처리 실패: ${message.id}", e)
                    // ACK하지 않으면 Pending 상태로 남음
                }
            }
        }

        // Pending 메시지 재처리 (이전에 처리 못한 것)
        val pending = redis.xReadGroup(
            Consumer.from(groupName, consumerName),
            XReadArgs.StreamOffset.create("events", ReadOffset.from("0")),
        )
        // 재처리 로직...
    }
}
```

---

## Streams vs List vs Pub/Sub

| | Streams | List | Pub/Sub |
|--|---------|------|---------|
| 메시지 보존 | 유지 (MAXLEN까지) | 소비 후 삭제 | 없음 |
| Consumer Group | 지원 | 미지원 | 미지원 |
| 재처리 | 가능 (Pending) | 어려움 | 불가 |
| 브로드캐스트 | 불가 (그룹 내 분산) | 불가 | 가능 |
| 메시지 ID | 자동 타임스탬프 | 없음 | 없음 |
| 선택 기준 | 신뢰성 있는 큐, 이벤트 로그 | 간단한 큐 | 실시간 브로드캐스트 |

---

## 정리

| 명령어 | 설명 |
|--------|------|
| XADD | 메시지 추가 |
| XREAD | 메시지 읽기 |
| XRANGE / XREVRANGE | 범위 조회 |
| XLEN | 메시지 수 |
| XDEL / XTRIM | 삭제/정리 |
| XGROUP CREATE | Consumer Group 생성 |
| XREADGROUP | Consumer Group으로 읽기 |
| XACK | 처리 완료 확인 |
| XPENDING | 미확인 메시지 조회 |
| XCLAIM / XAUTOCLAIM | 메시지 재할당 |
