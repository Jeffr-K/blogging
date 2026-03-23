---
title: "[Redis] 15. Pipeline & 배치 — 성능 최적화"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "pipeline", "batch", "성능최적화", "MSET", "MGET"]
---

# Pipeline & 배치 — 성능 최적화

## 네트워크 왕복 비용

```
일반 명령 실행 (N개):
  Client → [SET key1]  → Server (처리) → Client (응답)
  Client → [SET key2]  → Server (처리) → Client (응답)
  Client → [SET key3]  → Server (처리) → Client (응답)
  ...
  총 N번의 네트워크 왕복 (RTT × N)

Pipeline:
  Client → [SET key1, SET key2, SET key3, ...] → Server (처리) → Client (N개 응답)
  총 1번의 네트워크 왕복
```

로컬: 0.1ms RTT × 1000개 = 100ms
Pipeline: 1번 왕복 ≈ 0.1ms

---

## Pipeline

### CLI에서 Pipeline

```bash
# 파이프를 통한 배치 입력
echo -e "SET key1 val1\nSET key2 val2\nSET key3 val3" | redis-cli --pipe

# 파일로 배치
cat commands.txt | redis-cli --pipe

# 결과 확인
cat commands.txt | redis-cli --pipe --pipe-mode
```

### Lettuce (Kotlin)

```kotlin
// Pipelining — 응답 없이 명령어만 전송
val connection = redisClient.connect()
val async = connection.async()

// 파이프라인 시작
async.setAutoFlushCommands(false)

val futures = mutableListOf<RedisFuture<*>>()
for (i in 1..1000) {
    futures.add(async.set("key$i", "value$i"))
}

// 한 번에 전송
async.flushCommands()

// 결과 대기
LettuceFutures.awaitAll(5, TimeUnit.SECONDS, *futures.toTypedArray())

async.setAutoFlushCommands(true)
connection.close()
```

### Spring RedisTemplate

```kotlin
// executePipelined — Pipeline 실행
val results = redisTemplate.executePipelined { connection ->
    for (i in 1..1000) {
        connection.set("key$i".toByteArray(), "value$i".toByteArray())
    }
    null  // 반환값 없음
}

// 결과는 List<Any?> 형태
results.forEach { result ->
    println(result)  // OK
}
```

### Jedis (비교용)

```java
// Jedis Pipeline
Pipeline pipeline = jedis.pipelined();
for (int i = 0; i < 1000; i++) {
    pipeline.set("key" + i, "value" + i);
}
List<Object> results = pipeline.syncAndReturnAll();
```

---

## 다중 키 명령어 (Pipeline 대안)

### String

```bash
# 여러 키 동시 SET/GET
MSET key1 val1 key2 val2 key3 val3
MGET key1 key2 key3          # [val1, val2, val3]
MSETNX key1 val1 key2 val2   # 모두 없을 때만

# DEL 여러 키
DEL key1 key2 key3
```

### Hash

```bash
# 여러 필드 동시 SET/GET
HSET hash field1 val1 field2 val2 field3 val3
HMGET hash field1 field2 field3

# 전체 Hash 읽기
HGETALL hash
```

### ZSet

```bash
# 여러 멤버 동시 추가
ZADD leaderboard 9500 "alice" 8800 "bob" 9200 "charlie"

# 여러 score 동시 조회 (Redis 3.2+)
ZMSCORE leaderboard alice bob charlie
```

---

## 트랜잭션 vs Pipeline

```
Pipeline:
  명령어를 한 번에 전송 → 네트워크 왕복 감소
  서버에서는 여전히 각각 순서대로 실행
  원자성 없음 (중간에 다른 클라이언트 끼어들 수 있음)

MULTI/EXEC (트랜잭션):
  원자성 있음 (다른 클라이언트 끼어들기 없음)
  네트워크는 2번 왕복 (MULTI+명령어, EXEC)

Pipeline + MULTI/EXEC:
  MULTI → ... → EXEC를 Pipeline으로 전송
  → 원자성 + 1번 왕복
```

```kotlin
// Pipeline + Transaction
val results = redisTemplate.executePipelined { connection ->
    connection.multi()
    connection.set("key1".toByteArray(), "val1".toByteArray())
    connection.set("key2".toByteArray(), "val2".toByteArray())
    connection.exec()
    null
}
```

---

## 배치 처리 패턴

### 대량 데이터 로드

```kotlin
// 1000개씩 나눠 Pipeline으로 로드
fun bulkLoad(data: List<Pair<String, String>>) {
    data.chunked(1000).forEach { chunk ->
        redisTemplate.executePipelined { connection ->
            chunk.forEach { (key, value) ->
                connection.set(key.toByteArray(), value.toByteArray())
            }
            null
        }
    }
}
```

### 캐시 Warm-up

```kotlin
// 배치로 캐시 미리 채우기
fun warmupCache(userIds: List<Long>) {
    val users = userRepository.findAllById(userIds)

    redisTemplate.executePipelined { connection ->
        users.forEach { user ->
            val key = "cache:user:${user.id}".toByteArray()
            val value = user.toJson().toByteArray()
            connection.set(key, value)
            connection.expire(key, 3600)  // 1시간 TTL
        }
        null
    }
}
```

### 다중 키 조회 후 미싱 처리

```kotlin
fun getUsers(userIds: List<Long>): Map<Long, User> {
    val keys = userIds.map { "cache:user:$it" }
    val cached = redisTemplate.opsForValue().multiGet(keys)

    val result = mutableMapOf<Long, User>()
    val missingIds = mutableListOf<Long>()

    userIds.forEachIndexed { idx, userId ->
        val value = cached?.get(idx)
        if (value != null) {
            result[userId] = value.toUser()
        } else {
            missingIds.add(userId)
        }
    }

    // DB에서 미싱 조회
    if (missingIds.isNotEmpty()) {
        val dbUsers = userRepository.findAllById(missingIds)
        // 캐시에 저장
        redisTemplate.executePipelined { connection ->
            dbUsers.forEach { user ->
                val key = "cache:user:${user.id}".toByteArray()
                connection.set(key, user.toJson().toByteArray())
                connection.expire(key, 3600)
            }
            null
        }
        dbUsers.forEach { result[it.id] = it }
    }

    return result
}
```

---

## 성능 비교

```
테스트: 10,000개 SET 명령 (로컬 Redis)

순차 실행:
  10,000 × 0.1ms = 1,000ms (1초)

MSET:
  MSET key1 val1 ... key10000 val10000 = ~5ms (1번 명령)

Pipeline (1000개씩):
  10번 × ~1ms = ~10ms

Pipeline (한 번에):
  ~5ms (1번 왕복)
```

---

## 정리

- **Pipeline**: 여러 명령을 한 번에 전송 → 네트워크 왕복 감소 (원자성 없음)
- **MSET/MGET**: String 다중 키 조작 (단일 명령)
- **executePipelined**: Spring RedisTemplate Pipeline API
- **Pipeline + MULTI/EXEC**: 원자성 + 최적화 동시에
- **청크 처리**: 너무 큰 배치는 메모리 이슈 → 1000~5000개씩 분할 권장
