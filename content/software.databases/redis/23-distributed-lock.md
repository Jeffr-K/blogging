---
title: "[Redis] 23. 분산 락 — SETNX, Redlock, Redisson"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "distributed-lock", "SETNX", "Redlock", "Redisson", "분산락"]
---

# 분산 락 — SETNX, Redlock, Redisson

## 분산 락이 필요한 이유

```
여러 서버 인스턴스가 동시에 같은 작업 처리:
  서버 1: 주문 재고 차감 (재고 100개)
  서버 2: 동시에 같은 주문 재고 차감

결과: 재고가 중복으로 차감됨 (레이스 컨디션)

분산 락: 한 번에 하나의 서버만 작업 처리
```

---

## SETNX 기반 간단한 락

```bash
# 락 획득 (원자적: NX=없을 때만, EX=자동 만료)
SET lock:order-123 "process-1" NX EX 30

# OK → 락 획득 성공
# nil → 이미 다른 프로세스가 락 보유
```

```kotlin
class SimpleRedisLock(private val redis: StringRedisTemplate) {

    fun tryLock(lockKey: String, owner: String, ttlSeconds: Long): Boolean {
        val result = redis.opsForValue().setIfAbsent(
            lockKey, owner, Duration.ofSeconds(ttlSeconds)
        )
        return result == true
    }

    fun unlock(lockKey: String, owner: String): Boolean {
        // 내가 가진 락인지 확인 후 삭제 (원자적 Lua)
        val script = """
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('DEL', KEYS[1])
            else
                return 0
            end
        """.trimIndent()

        val result = redis.execute(
            RedisScript.of(script, Long::class.java),
            listOf(lockKey),
            owner,
        )
        return result == 1L
    }
}
```

### 락 연장 (Watch Dog)

```kotlin
class ExtendableLock(private val redis: StringRedisTemplate) {

    private val watchdogExecutor = Executors.newScheduledThreadPool(1)

    fun acquireWithWatchdog(
        lockKey: String,
        owner: String,
        ttlSeconds: Long,
    ): ScheduledFuture<*>? {
        val acquired = tryLock(lockKey, owner, ttlSeconds)
        if (!acquired) return null

        // 만료 전에 자동 갱신 (TTL의 1/3 간격)
        return watchdogExecutor.scheduleAtFixedRate({
            extendLock(lockKey, owner, ttlSeconds)
        }, ttlSeconds / 3, ttlSeconds / 3, TimeUnit.SECONDS)
    }

    private fun extendLock(lockKey: String, owner: String, ttlSeconds: Long) {
        val script = """
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('EXPIRE', KEYS[1], ARGV[2])
            else
                return 0
            end
        """.trimIndent()

        redis.execute(
            RedisScript.of(script, Long::class.java),
            listOf(lockKey),
            owner, ttlSeconds.toString(),
        )
    }
}
```

---

## Redlock 알고리즘

단일 Redis 노드의 한계: Redis 장애 시 락 유실.

Redlock = 여러 독립 Redis 노드에 과반수 락 획득.

```
Redis 노드 5개 (독립적, 복제 없음):
  Node 1, Node 2, Node 3, Node 4, Node 5

락 획득:
  동시에 5개 노드에 SET NX 시도
  3개(과반수) 이상 성공 → 락 획득
  3개 미만 성공 → 락 실패 → 획득한 노드들 모두 해제

락 유효 시간:
  설정 TTL - (획득 소요 시간) - 드리프트
```

---

## Redisson — 프로덕션 권장

Redisson은 Redis 기반의 분산 자료구조와 락을 제공하는 라이브러리.

### 의존성

```kotlin
implementation("org.redisson:redisson-spring-boot-starter:3.27.0")
```

### 설정

```kotlin
@Bean
fun redissonClient(): RedissonClient {
    val config = Config()
    config.useSingleServer()
        .setAddress("redis://localhost:6379")
        .setPassword("your-password")
        .setConnectionPoolSize(10)
        .setConnectionMinimumIdleSize(5)
    return Redisson.create(config)
}

// Sentinel 설정
@Bean
fun redissonClientSentinel(): RedissonClient {
    val config = Config()
    config.useSentinelServers()
        .setMasterName("mymaster")
        .addSentinelAddress(
            "redis://sentinel1:26379",
            "redis://sentinel2:26379",
            "redis://sentinel3:26379",
        )
    return Redisson.create(config)
}

// Cluster 설정
@Bean
fun redissonClientCluster(): RedissonClient {
    val config = Config()
    config.useClusterServers()
        .addNodeAddress(
            "redis://node1:7001",
            "redis://node2:7002",
            "redis://node3:7003",
        )
    return Redisson.create(config)
}
```

### RLock — 분산 락

```kotlin
@Service
class OrderService(private val redisson: RedissonClient) {

    fun processOrder(orderId: Long) {
        val lock = redisson.getLock("lock:order:$orderId")

        // 락 획득 시도 (10초 대기, 30초 TTL)
        val acquired = lock.tryLock(10, 30, TimeUnit.SECONDS)
        if (!acquired) {
            throw LockAcquisitionException("락 획득 실패: order-$orderId")
        }

        try {
            // 임계 영역
            processOrderInternal(orderId)
        } finally {
            if (lock.isHeldByCurrentThread) {
                lock.unlock()
            }
        }
    }
}
```

### Kotlin with 블록으로 깔끔하게

```kotlin
inline fun <T> RLock.withLock(
    waitTime: Long = 10,
    leaseTime: Long = 30,
    unit: TimeUnit = TimeUnit.SECONDS,
    block: () -> T,
): T {
    val acquired = tryLock(waitTime, leaseTime, unit)
    if (!acquired) throw LockAcquisitionException("Failed to acquire lock: $name")
    try {
        return block()
    } finally {
        if (isHeldByCurrentThread) unlock()
    }
}

// 사용
val lock = redisson.getLock("lock:order:$orderId")
lock.withLock {
    processOrderInternal(orderId)
}
```

### Watch Dog (자동 갱신)

```kotlin
// leaseTime = -1 → Watch Dog 활성화 (기본 30초마다 자동 갱신)
val lock = redisson.getLock("lock:order:$orderId")
lock.lock()  // leaseTime -1 = Watch Dog 모드
try {
    // Watch Dog이 락이 해제될 때까지 자동으로 TTL 갱신
    longRunningProcess()
} finally {
    lock.unlock()
}
```

---

## Redisson 분산 자료구조

```kotlin
// RMap — 분산 Map
val map: RMap<String, User> = redisson.getMap("users")
map["user:1001"] = user
val user = map["user:1001"]

// RSet — 분산 Set
val set: RSet<String> = redisson.getSet("online-users")
set.add("user-1001")
set.contains("user-1001")

// RList — 분산 List
val list: RList<String> = redisson.getList("notifications:user-1001")
list.add("새 메시지가 있습니다")

// RSortedSet — 분산 Sorted Set
val sortedSet: RSortedSet<String> = redisson.getSortedSet("leaderboard")

// RScoredSortedSet — score 포함
val scoredSet: RScoredSortedSet<String> = redisson.getScoredSortedSet("leaderboard")
scoredSet.add(9500.0, "alice")
scoredSet.addScore("alice", 100.0)  // score 증가

// RQueue — 분산 큐
val queue: RQueue<String> = redisson.getQueue("task-queue")
queue.offer("task-1")
queue.poll()  // 꺼내기

// RBlockingQueue — Blocking Queue
val blockingQueue: RBlockingQueue<String> = redisson.getBlockingQueue("tasks")
blockingQueue.put("task-1")
val task = blockingQueue.take()  // blocking

// RDeque — 분산 Deque
val deque: RDeque<String> = redisson.getDeque("deque")
```

---

## Redisson 고급 기능

### RReadWriteLock — 읽기/쓰기 락

```kotlin
val rwLock = redisson.getReadWriteLock("rwLock:config")

// 여러 스레드가 동시에 읽기 락 획득 가능
fun readConfig(): Config {
    val readLock = rwLock.readLock()
    readLock.lock()
    try {
        return loadConfig()
    } finally {
        readLock.unlock()
    }
}

// 쓰기 락 - 배타적
fun updateConfig(config: Config) {
    val writeLock = rwLock.writeLock()
    writeLock.lock()
    try {
        saveConfig(config)
    } finally {
        writeLock.unlock()
    }
}
```

### RSemaphore — 분산 세마포어

```kotlin
// 동시 처리 스레드 수 제한
val semaphore = redisson.getSemaphore("semaphore:api-calls")
semaphore.trySetPermits(10)  // 최대 10개 동시 처리

fun processRequest() {
    if (!semaphore.tryAcquire(5, TimeUnit.SECONDS)) {
        throw TooManyRequestsException("서버 과부하")
    }
    try {
        doProcess()
    } finally {
        semaphore.release()
    }
}
```

### RRateLimiter — 분산 Rate Limiter

```kotlin
val rateLimiter = redisson.getRateLimiter("rate-limiter:api")
// 초당 10회 제한
rateLimiter.trySetRate(RateType.OVERALL, 10, 1, RateIntervalUnit.SECONDS)

fun callApi(): Boolean {
    return rateLimiter.tryAcquire()  // 허용이면 true
}
```

### RScheduledExecutorService — 분산 스케줄러

```kotlin
val executor = redisson.getExecutorService("distributed-scheduler")

// 한 번만 실행 (클러스터에서 하나의 노드만 실행)
executor.scheduleAtFixedRate(
    MyTask(),  // Serializable + Callable
    0, 1, TimeUnit.MINUTES
)
```

---

## 정리

- **SETNX + EX**: 간단한 분산 락 (단일 Redis 노드)
- **Lua 스크립트**: 확인 후 삭제 원자적 실행
- **Watch Dog**: 작업 중 락 만료 방지 자동 갱신
- **Redlock**: 여러 독립 노드에 과반수 락 (높은 신뢰성)
- **Redisson**: 프로덕션 권장 — Watch Dog, RReadWriteLock, RSemaphore, RRateLimiter 제공
