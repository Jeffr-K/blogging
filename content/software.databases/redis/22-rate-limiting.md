---
title: "[Redis] 22. Rate Limiting — 고정 윈도우, 슬라이딩 윈도우, 토큰 버킷"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "rate-limiting", "throttling", "sliding-window", "token-bucket"]
---

# Rate Limiting — 고정 윈도우, 슬라이딩 윈도우, 토큰 버킷

## 고정 윈도우 (Fixed Window)

```
시간을 고정 크기 윈도우로 분할:
  12:00:00 ~ 12:00:59  → 윈도우 1 (최대 100 요청)
  12:01:00 ~ 12:01:59  → 윈도우 2 (최대 100 요청)
```

```kotlin
fun isAllowed(userId: String, limit: Int): Boolean {
    val window = Instant.now().epochSecond / 60  // 분 단위 슬롯
    val key = "rate:fixed:$userId:$window"

    val count = redis.opsForValue().increment(key)!!
    if (count == 1L) {
        redis.expire(key, 60, TimeUnit.SECONDS)
    }

    return count <= limit
}
```

**단점**: 윈도우 경계에서 2배 버스트 가능
```
11:59:50 ~ 11:59:59: 100 요청 (윈도우 1의 마지막 10초)
12:00:00 ~ 12:00:10: 100 요청 (윈도우 2의 첫 10초)
→ 20초 내 200 요청!
```

---

## 슬라이딩 윈도우 (Sliding Window)

### 카운터 방식 (분 단위)

```
현재 시각을 기준으로 이전 1분간의 요청 수를 계산.
분 단위 슬롯 2개를 가중치로 합산.
```

```kotlin
fun isAllowed(userId: String, limit: Int): Boolean {
    val now = Instant.now()
    val currentMinute = now.epochSecond / 60
    val previousMinute = currentMinute - 1
    val elapsedSeconds = now.epochSecond % 60

    val currentKey = "rate:sliding:$userId:$currentMinute"
    val previousKey = "rate:sliding:$userId:$previousMinute"

    val currentCount = redis.opsForValue().get(currentKey)?.toLong() ?: 0L
    val previousCount = redis.opsForValue().get(previousKey)?.toLong() ?: 0L

    // 이전 분의 가중치: 지난 시간에 비례
    val windowFraction = 1.0 - (elapsedSeconds / 60.0)
    val estimatedCount = (previousCount * windowFraction + currentCount).toLong()

    if (estimatedCount >= limit) return false

    redis.opsForValue().increment(currentKey)
    redis.expire(currentKey, 120, TimeUnit.SECONDS)
    return true
}
```

### ZSet 방식 (정확한 슬라이딩)

```kotlin
fun isAllowed(userId: String, limit: Int, windowSeconds: Long = 60): Boolean {
    val key = "rate:zset:$userId"
    val now = System.currentTimeMillis()
    val windowStart = now - windowSeconds * 1000

    return redis.execute(object : SessionCallback<Boolean> {
        override fun <K, V> execute(ops: RedisOperations<K, V>): Boolean {
            @Suppress("UNCHECKED_CAST")
            val zsetOps = (ops as RedisOperations<String, String>)
                .opsForZSet()

            // 윈도우 밖 항목 제거
            zsetOps.removeRangeByScore(key, Double.NEGATIVE_INFINITY, windowStart.toDouble())

            // 현재 카운트
            val count = zsetOps.zCard(key) ?: 0L

            if (count >= limit) return false

            // 새 요청 추가
            zsetOps.add(key, UUID.randomUUID().toString(), now.toDouble())
            ops.expire(key, windowSeconds + 1, TimeUnit.SECONDS)

            return true
        }
    })
}
```

**Lua 스크립트 버전 (원자적)**:

```lua
-- sliding_window_rate_limit.lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])  -- 밀리초
local now = tonumber(ARGV[3])
local req_id = ARGV[4]

-- 오래된 항목 제거
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

-- 현재 카운트
local count = redis.call('ZCARD', key)

if count >= limit then
    return {0, count}
end

-- 추가
redis.call('ZADD', key, now, req_id)
redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)

return {1, count + 1}
```

```kotlin
val result = redis.execute(
    RedisScript.of(luaScript, List::class.java),
    listOf(key),
    limit.toString(),
    windowMs.toString(),
    System.currentTimeMillis().toString(),
    UUID.randomUUID().toString(),
) as List<*>

val allowed = (result[0] as Long) == 1L
val currentCount = result[1] as Long
```

---

## 토큰 버킷 (Token Bucket)

일정 속도로 토큰이 채워지고, 요청마다 토큰 소비.

```
버킷 용량: 100 토큰
채우기 속도: 1토큰/초

요청 → 토큰 1개 소비 → 처리
토큰 없음 → 거부
```

```lua
-- token_bucket.lua
local key = KEYS[1]
local capacity = tonumber(ARGV[1])     -- 버킷 최대 용량
local refill_rate = tonumber(ARGV[2])  -- 초당 채우는 토큰 수
local requested = tonumber(ARGV[3])    -- 소비할 토큰 수
local now = tonumber(ARGV[4])          -- 현재 시각 (초)

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
    tokens = capacity
    last_refill = now
end

-- 토큰 보충
local elapsed = now - last_refill
local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

if new_tokens < requested then
    -- 거부 — 현재 토큰 수와 다음 가능한 시각 반환
    local wait_time = math.ceil((requested - new_tokens) / refill_rate)
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 1)
    return {0, math.floor(new_tokens), wait_time}
end

-- 허용
new_tokens = new_tokens - requested
redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 1)
return {1, math.floor(new_tokens), 0}
```

---

## Spring Boot + Rate Limiting

### 인터셉터

```kotlin
@Component
class RateLimitInterceptor(
    private val rateLimiter: RateLimiter,
) : HandlerInterceptor {

    override fun preHandle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any,
    ): Boolean {
        val userId = request.getAttribute("userId") as? String
            ?: request.remoteAddr

        val annotation = (handler as? HandlerMethod)
            ?.getMethodAnnotation(RateLimit::class.java)

        val limit = annotation?.limit ?: 100
        val window = annotation?.windowSeconds ?: 60L

        val result = rateLimiter.isAllowed(userId, limit, window)

        if (!result.allowed) {
            response.status = 429  // Too Many Requests
            response.setHeader("X-RateLimit-Limit", limit.toString())
            response.setHeader("X-RateLimit-Remaining", "0")
            response.setHeader("X-RateLimit-Reset", result.resetAt.toString())
            response.setHeader("Retry-After", result.retryAfter.toString())
            response.writer.write("""{"error":"Too many requests"}""")
            return false
        }

        response.setHeader("X-RateLimit-Limit", limit.toString())
        response.setHeader("X-RateLimit-Remaining", result.remaining.toString())
        return true
    }
}

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class RateLimit(
    val limit: Int = 100,
    val windowSeconds: Long = 60,
)
```

### 사용

```kotlin
@RestController
class ApiController {

    @RateLimit(limit = 10, windowSeconds = 60)
    @PostMapping("/api/send-email")
    fun sendEmail(@RequestBody request: EmailRequest): ResponseEntity<*> {
        // 분당 10회 제한
        return ResponseEntity.ok(emailService.send(request))
    }
}
```

---

## 다양한 단위 Rate Limit

```kotlin
// 계층적 Rate Limit
fun isAllowedMultiLevel(userId: String): Boolean {
    return listOf(
        Triple("per-second", 10L, 1L),    // 초당 10회
        Triple("per-minute", 100L, 60L),   // 분당 100회
        Triple("per-hour", 1000L, 3600L),  // 시간당 1000회
        Triple("per-day", 10000L, 86400L), // 일당 10000회
    ).all { (level, limit, window) ->
        val key = "rate:$level:$userId"
        isWindowAllowed(key, limit, window)
    }
}
```

---

## 정리

| 알고리즘 | 정확도 | 메모리 | 버스트 허용 | 구현 복잡도 |
|----------|--------|--------|------------|------------|
| 고정 윈도우 | 낮음 | 낮음 | 경계에서 2배 | 낮음 |
| 슬라이딩 윈도우 (카운터) | 중간 | 낮음 | 없음 | 중간 |
| 슬라이딩 윈도우 (ZSet) | 높음 | 높음 | 없음 | 중간 |
| 토큰 버킷 | 높음 | 낮음 | 허용 (버킷 용량) | 높음 |

- **간단한 API 제한**: 고정 윈도우 (초당/분당)
- **정확한 슬라이딩**: ZSet 기반 (메모리 주의)
- **버스트 허용 API**: 토큰 버킷
- **응답 헤더**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`
