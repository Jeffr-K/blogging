---
title: "[Redis] 14. Pub/Sub — 실시간 메시징과 Keyspace 알림"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "pub-sub", "PUBLISH", "SUBSCRIBE", "keyspace", "실시간"]
---

# Pub/Sub — 실시간 메시징과 Keyspace 알림

## 개요

Redis Pub/Sub는 **발행-구독** 패턴. 발행자(Publisher)가 채널에 메시지를 보내면 구독자(Subscriber)가 실시간 수신. 메시지는 **보존되지 않음** (수신하지 못하면 유실).

```
Publisher                    Subscribers
  |                            |    |    |
  PUBLISH chat "안녕"  →  채널  → Sub1 Sub2 Sub3
                              (동시에 모두 수신)
```

---

## 기본 명령어

### 구독

```bash
# 채널 구독 (블로킹)
SUBSCRIBE channel1 channel2 channel3

# 패턴 구독 (glob 패턴)
PSUBSCRIBE chat:*              # chat: 으로 시작하는 모든 채널
PSUBSCRIBE news.*              # news. 으로 시작하는 모든 채널
PSUBSCRIBE h?llo               # hello, hallo, hxllo 등

# 구독 취소
UNSUBSCRIBE channel1
PUNSUBSCRIBE chat:*

# 구독 중인 채널 수 확인 (별도 연결에서)
SUBSCRIBE  → 수신: [subscribe, channel-name, subscription-count]
```

### 발행

```bash
# 채널에 메시지 발행 (수신자 수 반환)
PUBLISH channel "message"
PUBLISH chat:room-1 '{"userId":"1001","text":"안녕하세요"}'

# 반환값: 메시지를 수신한 구독자 수
# 0이면 구독자 없음 → 메시지 유실
```

### 채널 정보 (PUBSUB)

```bash
# 활성 채널 목록 (구독자 1명 이상)
PUBSUB CHANNELS             # 전체
PUBSUB CHANNELS "chat:*"    # 패턴 매칭

# 채널별 구독자 수
PUBSUB NUMSUB channel1 channel2

# 패턴 구독 수
PUBSUB NUMPAT

# Shard Pub/Sub 채널 정보 (Redis 7.0+)
PUBSUB SHARDCHANNELS
PUBSUB SHARDNUMSUB channel1
```

---

## Shard Pub/Sub (Redis 7.0+)

클러스터 환경에서 특정 샤드로 라우팅되는 Pub/Sub.

```bash
# 샤드 구독 (해당 슬롯의 브로커에서만 수신)
SSUBSCRIBE channel
SUNSUBSCRIBE channel

# 샤드 발행
SPUBLISH channel "message"
```

일반 Pub/Sub은 클러스터에서 모든 노드에 브로드캐스트 → 비효율.
Shard Pub/Sub은 해시 슬롯 기반으로 특정 샤드에만 전달.

---

## 활용 패턴

### 실시간 채팅

```kotlin
// 발행자 (메시지 전송)
fun sendMessage(roomId: String, userId: String, text: String) {
    val message = ChatMessage(userId, text, Instant.now())
    redis.publish("chat:room-$roomId", message.toJson())
}

// 구독자 (메시지 수신)
@Component
class ChatSubscriber(
    private val redisTemplate: RedisTemplate<String, String>,
    private val messagingTemplate: SimpMessagingTemplate,
) {
    @EventListener(ApplicationReadyEvent::class)
    fun subscribe() {
        val connection = redisTemplate.connectionFactory!!
            .connection
        connection.subscribe({ message, _ ->
            val chatMessage = message.toString().toChatMessage()
            // WebSocket으로 클라이언트에게 전달
            messagingTemplate.convertAndSend("/topic/chat", chatMessage)
        }, "chat:room-1".toByteArray())
    }
}
```

### 실시간 알림

```bash
# 서버가 특정 사용자에게 알림 발행
PUBLISH notifications:user-1001 '{"type":"order-shipped","orderId":"123"}'

# 사용자 연결된 서버가 구독 중
SUBSCRIBE notifications:user-1001
```

### 서비스 간 이벤트 브로드캐스트

```bash
# 설정 변경 이벤트 발행 (모든 서버에 동시 전파)
PUBLISH config:update '{"key":"max-upload-size","value":"20MB"}'

# 모든 서버 인스턴스가 구독 중
SUBSCRIBE config:update
# → 각 서버가 로컬 캐시 갱신
```

### 로그인 상태 브로드캐스트

```bash
PUBLISH user-status '{"userId":"1001","status":"online"}'
SUBSCRIBE user-status  # 모든 서버가 수신 → 온라인 맵 업데이트
```

---

## Keyspace Notification

Redis 자체 이벤트를 Pub/Sub으로 수신.

### 설정

```bash
# notify-keyspace-events 설정
# K: Keyspace 알림 활성화
# E: Keyevent 알림 활성화
# g: 일반 명령 (DEL, EXPIRE, RENAME 등)
# x: 만료 이벤트
# e: Eviction 이벤트
# $: String 명령
# l: List 명령
# s: Set 명령
# h: Hash 명령
# z: ZSet 명령

CONFIG SET notify-keyspace-events "KEgx"
# K + E + g (일반) + x (만료) 이벤트

# 또는 redis.conf
# notify-keyspace-events KEgx
```

### 채널 패턴

```
Keyspace 채널: __keyspace@<db>__:<key>
  → 특정 키에 대한 모든 이벤트

Keyevent 채널: __keyevent@<db>__:<event>
  → 특정 이벤트 타입에 대한 모든 키
```

```bash
# 만료 이벤트 구독 (DB 0)
SUBSCRIBE __keyevent@0__:expired
# → 키가 만료될 때마다 메시지 수신: 만료된 키 이름

# 특정 키의 모든 이벤트
SUBSCRIBE __keyspace@0__:user:1001
# → SET, DEL, EXPIRE, EXPIRED 등

# SET 명령 이벤트 구독
SUBSCRIBE __keyevent@0__:set
```

### 만료 이벤트 활용

```kotlin
@Component
class SessionExpirationHandler : MessageListener {
    override fun onMessage(message: Message, pattern: ByteArray?) {
        val expiredKey = String(message.body)

        if (expiredKey.startsWith("session:")) {
            val sessionId = expiredKey.removePrefix("session:")
            // 세션 만료 후처리
            userSessionService.handleSessionExpired(sessionId)
            logger.info("세션 만료: $sessionId")
        }
    }
}

// Bean 등록
@Bean
fun messageListenerContainer(): RedisMessageListenerContainer {
    return RedisMessageListenerContainer().apply {
        setConnectionFactory(connectionFactory)
        addMessageListener(
            sessionExpirationHandler,
            PatternTopic("__keyevent@0__:expired")
        )
    }
}
```

---

## Pub/Sub의 한계와 대안

```
Pub/Sub 한계:
  1. 메시지 보존 없음 — 연결 끊기면 유실
  2. Consumer Group 없음 — 각 구독자가 모든 메시지 수신
  3. 재처리 불가
  4. 클러스터에서 비효율 (Shard Pub/Sub으로 해결)

대안:
  신뢰성 필요  → Redis Streams (XADD/XREADGROUP)
  작업 큐      → List (BLPOP)
  브로드캐스트 → Pub/Sub (현재 연결된 구독자에게만)
  고처리량 스트리밍 → Kafka
```

---

## 정리

| 명령어 | 설명 |
|--------|------|
| SUBSCRIBE | 채널 구독 |
| PSUBSCRIBE | 패턴 구독 |
| UNSUBSCRIBE / PUNSUBSCRIBE | 구독 취소 |
| PUBLISH | 메시지 발행 |
| PUBSUB CHANNELS | 활성 채널 목록 |
| PUBSUB NUMSUB | 채널별 구독자 수 |
| SSUBSCRIBE / SPUBLISH | Shard Pub/Sub (클러스터) |

- **사용처**: 실시간 채팅, 알림, 서버 간 이벤트 전파, 캐시 무효화 브로드캐스트
- **Keyspace Notification**: 만료/삭제/변경 이벤트를 Pub/Sub으로 수신
- **주의**: 메시지 보존 없음 → 신뢰성 필요하면 Streams 사용
