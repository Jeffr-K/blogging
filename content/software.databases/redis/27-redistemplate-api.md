---
title: "[Redis] 27. RedisTemplate API 전체 — ValueOps, ListOps, SetOps, ZSetOps, HashOps"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "RedisTemplate", "ValueOperations", "ListOperations", "ZSetOperations"]
---

# RedisTemplate API 전체

## ValueOperations (String)

```kotlin
val ops = redis.opsForValue()

// SET
ops.set("key", "value")
ops.set("key", "value", Duration.ofHours(1))
ops.set("key", "value", 3600, TimeUnit.SECONDS)

// SET NX/XX
ops.setIfAbsent("key", "value")                          // NX
ops.setIfAbsent("key", "value", Duration.ofSeconds(30))  // NX + EX
ops.setIfPresent("key", "value")                          // XX
ops.setIfPresent("key", "value", Duration.ofSeconds(30))  // XX + EX

// GET
ops.get("key")

// GET + SET (getAndSet)
ops.getAndSet("key", "new-value")  // 이전 값 반환 후 새 값 설정

// GET + TTL 연장 (getAndExpire) — Spring Data Redis 3.x+
ops.getAndExpire("key", Duration.ofHours(1))

// MSET/MGET
ops.multiSet(mapOf("key1" to "val1", "key2" to "val2"))
ops.multiSetIfAbsent(mapOf("key1" to "val1", "key2" to "val2"))
ops.multiGet(listOf("key1", "key2", "key3"))

// INCR/DECR
ops.increment("counter")          // +1
ops.increment("counter", 5L)      // +5
ops.decrement("counter")          // -1
ops.decrement("counter", 3L)      // -3
ops.increment("price", 1.5)       // float

// APPEND
ops.append("key", " world")       // 문자열 뒤에 추가

// STRLEN
ops.size("key")

// GETRANGE/SETRANGE
ops.get("key", 0, 4)              // getrange (0~4)
// setrange는 RedisCallback으로
```

---

## ListOperations

```kotlin
val ops = redis.opsForList()

// PUSH
ops.leftPush("list", "value")
ops.leftPushAll("list", "a", "b", "c")
ops.leftPushAll("list", listOf("a", "b", "c"))
ops.leftPushIfPresent("list", "value")  // LPUSHX
ops.rightPush("list", "value")
ops.rightPushAll("list", "a", "b", "c")
ops.rightPushIfPresent("list", "value")  // RPUSHX

// POP
ops.leftPop("list")
ops.leftPop("list", 3)                          // 3개
ops.leftPop("list", Duration.ofSeconds(30))     // blocking
ops.rightPop("list")
ops.rightPop("list", 3)
ops.rightPop("list", Duration.ofSeconds(30))    // blocking

// RPOPLPUSH / LMOVE
ops.rightPopAndLeftPush("source", "dest")
ops.rightPopAndLeftPush("source", "dest", Duration.ofSeconds(5))
ops.move(ListOperations.MoveFrom.fromTail("src"),
         ListOperations.MoveTo.toHead("dst"))
ops.move(ListOperations.MoveFrom.fromTail("src"),
         ListOperations.MoveTo.toHead("dst"),
         Duration.ofSeconds(5))

// LRANGE
ops.range("list", 0, -1)    // 전체
ops.range("list", 0, 9)     // 처음 10개

// LINDEX
ops.index("list", 0)        // 첫 번째
ops.index("list", -1)       // 마지막

// LSET
ops.set("list", 2, "new-value")

// LINSERT
ops.leftPush("list", "pivot", "value")  // pivot 앞에 삽입
// LINSERT BEFORE는 별도 RedisCallback 필요

// LREM
ops.remove("list", 1, "value")   // count=1, 앞에서 1개 삭제
ops.remove("list", 0, "value")   // count=0, 전체 삭제
ops.remove("list", -1, "value")  // count=-1, 뒤에서 1개

// LTRIM
ops.trim("list", 0, 99)   // 처음 100개만 유지

// LLEN
ops.size("list")

// LPOS (Spring Data Redis 2.6+)
ops.indexOf("list", "value")    // 처음 발견 위치
ops.lastIndexOf("list", "value") // 마지막 발견 위치
```

---

## SetOperations

```kotlin
val ops = redis.opsForSet()

// SADD / SREM
ops.add("set", "a", "b", "c")
ops.remove("set", "a", "b")

// SMEMBERS / SCARD
ops.members("set")
ops.size("set")

// SISMEMBER / SMISMEMBER
ops.isMember("set", "a")
ops.isMember("set", setOf("a", "b", "c"))

// SPOP / SRANDMEMBER
ops.pop("set")          // 1개 무작위 제거
ops.pop("set", 3)       // 3개 무작위 제거
ops.randomMember("set")          // 1개 무작위 (제거 없음)
ops.randomMembers("set", 3)      // 3개 무작위 (중복 가능)
ops.distinctRandomMembers("set", 3)  // 3개 무작위 (중복 없음)

// SMOVE
ops.move("source", "member", "dest")

// 집합 연산
ops.union("set1", "set2")          // 합집합
ops.union("set1", listOf("set2", "set3"))
ops.unionAndStore("set1", "set2", "dest")  // 결과 저장

ops.intersect("set1", "set2")      // 교집합
ops.intersect("set1", listOf("set2", "set3"))
ops.intersectAndStore("set1", "set2", "dest")

ops.difference("set1", "set2")     // 차집합
ops.difference("set1", listOf("set2", "set3"))
ops.differenceAndStore("set1", "set2", "dest")

// SSCAN
ops.scan("set", ScanOptions.scanOptions().match("*").count(100).build())
    .use { cursor ->
        cursor.forEach { member -> println(member) }
    }
```

---

## ZSetOperations (Sorted Set)

```kotlin
val ops = redis.opsForZSet()

// ZADD
ops.add("zset", "alice", 9500.0)
ops.addIfAbsent("zset", "alice", 9500.0)  // NX
ops.add("zset", setOf(
    ZSetOperations.TypedTuple.of("alice", 9500.0),
    ZSetOperations.TypedTuple.of("bob", 8800.0),
))

// ZINCRBY
ops.incrementScore("zset", "alice", 100.0)

// ZREM
ops.remove("zset", "alice", "bob")

// ZRANGE (오름차순)
ops.range("zset", 0, -1)
ops.rangeWithScores("zset", 0, -1)  // score 포함
ops.rangeByScore("zset", 8000.0, 9000.0)
ops.rangeByScoreWithScores("zset", 8000.0, 9000.0)
ops.rangeByScore("zset", 8000.0, 9000.0, 0, 10)  // LIMIT

// ZREVRANGE (내림차순)
ops.reverseRange("zset", 0, -1)
ops.reverseRangeWithScores("zset", 0, -1)
ops.reverseRangeByScore("zset", 8000.0, 9000.0)
ops.reverseRangeByScoreWithScores("zset", 8000.0, 9000.0)

// ZRANK / ZREVRANK
ops.rank("zset", "alice")         // 오름차순 순위 (0-based)
ops.reverseRank("zset", "alice")  // 내림차순 순위 (0-based)

// ZSCORE / ZMSCORE
ops.score("zset", "alice")
ops.score("zset", listOf("alice", "bob"))  // 여러 개

// ZCARD / ZCOUNT
ops.size("zset")
ops.count("zset", 8000.0, 9000.0)

// ZPOPMIN / ZPOPMAX
ops.popMin("zset")          // 1개
ops.popMin("zset", 3)       // 3개
ops.popMax("zset")
ops.popMax("zset", 3)

// 집합 연산 (결과 저장)
ops.unionAndStore("z1", "z2", "dest")
ops.unionAndStore("z1", listOf("z2", "z3"), "dest")
ops.intersectAndStore("z1", "z2", "dest")
ops.differenceAndStore("z1", "z2", "dest")

// ZRANGEBYLEX
ops.rangeByLex("zset", RedisZSetCommands.Range.range().gte("a").lte("z"))
ops.rangeByLex("zset", RedisZSetCommands.Range.range().gte("a").lte("z"),
    RedisZSetCommands.Limit.limit().offset(0).count(10))

// ZREMRANGEBYSCORE / ZREMRANGEBYRANK
ops.removeRangeByScore("zset", 0.0, 5000.0)
ops.removeRange("zset", 0, 9)

// ZSCAN
ops.scan("zset", ScanOptions.scanOptions().match("*").count(100).build())
    .use { cursor ->
        cursor.forEach { entry ->
            println("${entry.value}: ${entry.score}")
        }
    }
```

---

## HashOperations

```kotlin
val ops = redis.opsForHash<String, String>()

// HSET
ops.put("hash", "name", "alice")
ops.putAll("hash", mapOf("name" to "alice", "age" to "30"))
ops.putIfAbsent("hash", "name", "alice")  // HSETNX

// HGET
ops.get("hash", "name")
ops.multiGet("hash", listOf("name", "age", "email"))

// HGETALL / HKEYS / HVALS
ops.entries("hash")      // Map<HK, HV>
ops.keys("hash")         // Set<HK>
ops.values("hash")       // List<HV>

// HDEL
ops.delete("hash", "name", "age")

// HEXISTS / HLEN
ops.hasKey("hash", "name")
ops.size("hash")

// HINCRBY / HINCRBYFLOAT
ops.increment("hash", "age", 1L)
ops.increment("hash", "score", 1.5)

// HSCAN
ops.scan("hash", ScanOptions.scanOptions().match("field:*").count(100).build())
    .use { cursor ->
        cursor.forEach { entry ->
            println("${entry.key}: ${entry.value}")
        }
    }
```

---

## StreamOperations

```kotlin
val ops = redis.opsForStream<String, String>()

// XADD
ops.add("stream", mapOf("field1" to "value1"))
ops.add(StreamRecords.newRecord().`in`("stream").ofMap(mapOf("k" to "v")))

// XREAD
ops.read(StreamOffset.create("stream", ReadOffset.from("0")))
ops.read(StreamReadOptions.empty().count(10),
         StreamOffset.create("stream", ReadOffset.from("0")))

// XRANGE
ops.range("stream", Range.unbounded())
ops.range("stream", Range.open("id1", "id2"))
ops.range("stream", Range.unbounded(), Limit.limit().count(10))

// XLEN
ops.size("stream")

// XDEL
ops.delete("stream", "message-id")

// XTRIM
ops.trim("stream", 1000)

// Consumer Group
ops.createGroup("stream", ReadOffset.latest(), "mygroup")
ops.read(Consumer.from("mygroup", "consumer1"),
         StreamOffset.create("stream", ReadOffset.lastConsumed()))
ops.acknowledge("stream", "mygroup", "message-id")
ops.pending("stream", "mygroup", Range.unbounded(), 100)
```

---

## GeoOperations

```kotlin
val ops = redis.opsForGeo()

// GEOADD
ops.add("stores", RedisGeoCommands.GeoLocation(
    "gangnam", Point(127.0276, 37.4979)
))
ops.add("stores", mapOf(
    "gangnam" to Point(127.0276, 37.4979),
    "jongno" to Point(126.9780, 37.5665),
))

// GEOPOS
ops.position("stores", "gangnam", "jongno")

// GEODIST
ops.distance("stores", "gangnam", "jongno")
ops.distance("stores", "gangnam", "jongno", Metrics.KILOMETERS)

// GEOHASH
ops.hash("stores", "gangnam")

// GEOSEARCH
ops.search("stores",
    GeoReference.fromMember("gangnam"),
    new Distance(5, Metrics.KILOMETERS),
    RedisGeoCommands.GeoSearchCommandArgs.newGeoSearchArgs()
        .includeDistance()
        .includeCoordinates()
        .sortAscending()
        .limit(10)
)
ops.searchAndStore("stores", "nearby",
    GeoReference.fromCoordinate(127.0, 37.5),
    new Distance(5, Metrics.KILOMETERS),
    RedisGeoCommands.GeoSearchStoreCommandArgs.newGeoSearchStoreArgs()
        .sortAscending()
)
```

---

## HyperLogLogOperations

```kotlin
val ops = redis.opsForHyperLogLog()

// PFADD
ops.add("visitors", "user-1001", "user-1002", "user-1003")

// PFCOUNT
ops.size("visitors")                   // 단일 HLL
ops.size("visitors:desktop", "visitors:mobile")  // 합집합 크기

// PFMERGE
ops.union("total", "visitors:desktop", "visitors:mobile")
```

---

## 정리

Spring Data Redis Operations 요약:

| 타입 | Method |
|------|--------|
| String | `opsForValue()` |
| List | `opsForList()` |
| Set | `opsForSet()` |
| ZSet | `opsForZSet()` |
| Hash | `opsForHash()` |
| Stream | `opsForStream()` |
| Geo | `opsForGeo()` |
| HyperLogLog | `opsForHyperLogLog()` |

각 Operations는 해당 Redis 명령어를 메서드로 래핑한 형태.
