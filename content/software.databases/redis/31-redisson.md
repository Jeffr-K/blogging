---
title: "[Redis] 31. Redisson — 분산 자료구조와 고급 기능"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "redisson", "distributed-lock", "RLock", "RMap", "분산자료구조"]
---

# Redisson — 분산 자료구조와 고급 기능

Java/Kotlin용 Redis 클라이언트. 분산 자료구조와 고수준 추상화 제공.

## 의존성

```kotlin
// build.gradle.kts
implementation("org.redisson:redisson-spring-boot-starter:3.27.0")
// Spring Boot 자동 설정 포함
```

---

## 설정

```yaml
# application.yml
spring:
  redis:
    redisson:
      config: classpath:redisson.yml
```

```yaml
# redisson.yml — 단일 서버
singleServerConfig:
  address: "redis://localhost:6379"
  password: null
  database: 0
  connectionPoolSize: 64
  connectionMinimumIdleSize: 24
  idleConnectionTimeout: 10000
  connectTimeout: 10000
  timeout: 3000
  retryAttempts: 3
  retryInterval: 1500
```

```yaml
# redisson.yml — Sentinel
sentinelServersConfig:
  masterName: mymaster
  sentinelAddresses:
    - "redis://sentinel1:26379"
    - "redis://sentinel2:26379"
    - "redis://sentinel3:26379"
  readMode: SLAVE
  password: null
```

```yaml
# redisson.yml — Cluster
clusterServersConfig:
  nodeAddresses:
    - "redis://127.0.0.1:7001"
    - "redis://127.0.0.1:7002"
    - "redis://127.0.0.1:7003"
  readMode: SLAVE
  scanInterval: 2000
```

---

## RLock — 분산 락

```kotlin
@Service
class OrderService(private val redisson: RedissonClient) {

    // 기본 락
    fun processOrder(orderId: Long) {
        val lock = redisson.getLock("lock:order:$orderId")

        lock.lock()  // 무한 대기
        try {
            doProcess(orderId)
        } finally {
            lock.unlock()
        }
    }

    // 타임아웃 락
    fun processWithTimeout(orderId: Long): Boolean {
        val lock = redisson.getLock("lock:order:$orderId")

        // 최대 3초 대기, 10초 후 자동 해제
        if (!lock.tryLock(3, 10, TimeUnit.SECONDS)) {
            return false  // 락 획득 실패
        }
        try {
            doProcess(orderId)
            return true
        } finally {
            lock.unlock()
        }
    }

    // Kotlin DSL (withLock)
    fun processWithDsl(orderId: Long) {
        redisson.getLock("lock:order:$orderId").withLock {
            doProcess(orderId)
        }
    }

    // Watch Dog: leaseTime 없이 lock() 호출 시 자동 TTL 갱신
    // 기본 30초 TTL → 10초마다 자동 연장
    fun longRunningProcess(orderId: Long) {
        val lock = redisson.getLock("lock:order:$orderId")
        lock.lock()  // Watch Dog 활성화 (leaseTime 없음)
        try {
            Thread.sleep(60_000)  // 60초 작업도 락 유지
        } finally {
            lock.unlock()
        }
    }
}
```

---

## RReadWriteLock — 읽기/쓰기 락

```kotlin
@Service
class ConfigService(private val redisson: RedissonClient) {

    private val rwLock = redisson.getReadWriteLock("lock:config")

    // 여러 스레드 동시 읽기 가능
    fun getConfig(key: String): String? {
        val readLock = rwLock.readLock()
        readLock.lock()
        try {
            return loadFromRedis(key)
        } finally {
            readLock.unlock()
        }
    }

    // 쓰기는 단독 접근
    fun updateConfig(key: String, value: String) {
        val writeLock = rwLock.writeLock()
        writeLock.lock()
        try {
            saveToRedis(key, value)
        } finally {
            writeLock.unlock()
        }
    }
}
```

---

## RMap — 분산 Map

```kotlin
@Service
class UserCacheService(private val redisson: RedissonClient) {

    private val userCache = redisson.getMap<Long, User>("cache:users")

    fun get(userId: Long): User? = userCache[userId]

    fun put(user: User) {
        userCache[user.id] = user
    }

    // TTL per entry
    fun putWithTtl(user: User, ttl: Duration) {
        userCache.put(user.id, user, ttl.toMillis(), TimeUnit.MILLISECONDS)
    }

    // 원자적 연산
    fun putIfAbsent(user: User): User? {
        return userCache.putIfAbsent(user.id, user)
    }

    fun computeIfAbsent(userId: Long, loader: (Long) -> User): User {
        return userCache.computeIfAbsent(userId) { id -> loader(id) }
    }
}

// RMapCache — TTL + 최대 크기
val mapCache = redisson.getMapCache<Long, User>("cache:users")
mapCache.put(userId, user, 30, TimeUnit.MINUTES)
mapCache.setMaxSize(10_000)  // 최대 10,000개
```

---

## RList / RQueue / RDeque

```kotlin
@Service
class TaskQueueService(private val redisson: RedissonClient) {

    // 작업 큐
    private val queue = redisson.getQueue<Task>("queue:tasks")
    private val blockingQueue = redisson.getBlockingQueue<Task>("queue:tasks")

    fun enqueue(task: Task) = queue.add(task)

    fun dequeue(): Task? = queue.poll()

    // Blocking pop (타임아웃)
    fun blockingDequeue(timeout: Duration): Task? {
        return blockingQueue.poll(timeout.toSeconds(), TimeUnit.SECONDS)
    }

    // 우선순위 큐
    private val priorityQueue = redisson.getPriorityQueue<Task>("queue:priority")

    // Deque (양방향 큐)
    private val deque = redisson.getDeque<Task>("deque:tasks")
}
```

---

## RSet / RSortedSet

```kotlin
val set = redisson.getSet<String>("set:tags")
set.add("redis", "kotlin", "spring")
set.contains("redis")

// Sorted Set
val sortedSet = redisson.getScoredSortedSet<String>("zset:scores")
sortedSet.add(9500.0, "alice")
sortedSet.add(8800.0, "bob")

val rank = sortedSet.revRank("alice")          // 내림차순 순위
val score = sortedSet.getScore("alice")
val top10 = sortedSet.valueRangeReversed(0, 9) // 상위 10개
```

---

## RSemaphore — 세마포어

```kotlin
@Service
class DatabaseConnectionPool(private val redisson: RedissonClient) {

    // 최대 10개 동시 DB 연결 허용
    private val semaphore = redisson.getSemaphore("semaphore:db-pool")

    @PostConstruct
    fun init() {
        semaphore.trySetPermits(10)  // 최초 1회 설정
    }

    fun executeQuery(query: () -> Any): Any {
        semaphore.acquire()  // 허가 획득 (없으면 대기)
        try {
            return query()
        } finally {
            semaphore.release()  // 허가 반환
        }
    }

    fun tryExecuteQuery(query: () -> Any): Any? {
        if (!semaphore.tryAcquire(3, TimeUnit.SECONDS)) {
            throw TooManyRequestsException()
        }
        try {
            return query()
        } finally {
            semaphore.release()
        }
    }
}
```

---

## RRateLimiter — Rate Limiter

```kotlin
@Service
class ApiRateLimiter(private val redisson: RedissonClient) {

    fun getRateLimiter(clientId: String): RRateLimiter {
        val limiter = redisson.getRateLimiter("rate:$clientId")

        // 초당 10 요청 허용 (RateType.OVERALL = 클러스터 전체)
        limiter.trySetRate(
            RateType.OVERALL,
            10,               // 허용 요청 수
            1,                // 기간
            RateIntervalUnit.SECONDS
        )
        return limiter
    }

    fun checkLimit(clientId: String): Boolean {
        return getRateLimiter(clientId).tryAcquire()
    }

    fun checkLimitWithTokens(clientId: String, tokens: Long): Boolean {
        return getRateLimiter(clientId).tryAcquire(tokens)  // N개 토큰 소비
    }
}
```

---

## RBloomFilter — 블룸 필터

```kotlin
@Service
class EmailDeduplicator(private val redisson: RedissonClient) {

    private val bloomFilter = redisson.getBloomFilter<String>("bloom:emails")

    @PostConstruct
    fun init() {
        // 예상 원소 수 1,000,000 / 오탐율 1%
        bloomFilter.tryInit(1_000_000L, 0.01)
    }

    fun isAlreadySent(email: String): Boolean {
        return bloomFilter.contains(email)
    }

    fun markAsSent(email: String) {
        bloomFilter.add(email)
    }
}
```

---

## RAtomicLong / RAtomicDouble

```kotlin
val counter = redisson.getAtomicLong("counter:visits")
counter.incrementAndGet()
counter.addAndGet(10L)
counter.compareAndSet(100L, 0L)  // CAS

val doubleCounter = redisson.getAtomicDouble("stats:avg")
doubleCounter.addAndGet(1.5)
```

---

## RScheduledExecutorService — 분산 스케줄러

```kotlin
@Service
class DistributedScheduler(private val redisson: RedissonClient) {

    private val executor = redisson.getExecutorService("executor:tasks")

    // 즉시 실행 (클러스터의 임의 노드에서)
    fun submitTask(task: Callable<String>) {
        executor.submit(task)
    }

    // 지연 실행
    fun scheduleTask(task: Runnable, delay: Duration) {
        executor.schedule(task, delay.toMillis(), TimeUnit.MILLISECONDS)
    }

    // 주기적 실행
    fun scheduleAtFixedRate(task: Runnable, period: Duration) {
        executor.scheduleAtFixedRate(
            task,
            0L,
            period.toMillis(),
            TimeUnit.MILLISECONDS
        )
    }
}
```

---

## RTopic — Pub/Sub

```kotlin
@Service
class EventBus(private val redisson: RedissonClient) {

    // 발행
    fun publish(channel: String, message: Any) {
        val topic = redisson.getTopic(channel)
        topic.publish(message)
    }

    // 구독
    fun subscribe(channel: String, handler: (Any) -> Unit) {
        val topic = redisson.getTopic(channel)
        topic.addListener(Object::class.java) { _, message ->
            handler(message)
        }
    }

    // 패턴 구독
    fun subscribePattern(pattern: String, handler: (String, Any) -> Unit) {
        val topic = redisson.getPatternTopic(pattern)
        topic.addListener(Object::class.java) { pattern, channel, message ->
            handler(channel, message)
        }
    }
}
```

---

## Spring Cache 통합

```kotlin
@Configuration
@EnableCaching
class RedissonCacheConfig(private val redisson: RedissonClient) {

    @Bean
    fun cacheManager(): CacheManager {
        val config = mapOf(
            "users" to CacheConfig(Duration.ofMinutes(30).toMillis(), 10_000),
            "products" to CacheConfig(Duration.ofHours(2).toMillis(), 50_000),
        )
        return RedissonSpringCacheManager(redisson, config)
    }
}

// @Cacheable, @CacheEvict 그대로 사용
@Cacheable("users")
fun getUser(userId: Long): User { ... }
```

---

## 정리

| 기능 | 클래스 | 용도 |
|------|--------|------|
| 분산 락 | `RLock` | 단일 락, Watch Dog |
| R/W 락 | `RReadWriteLock` | 읽기 동시성 |
| Map | `RMap` / `RMapCache` | 분산 캐시 |
| 큐 | `RQueue` / `RBlockingQueue` | 작업 큐 |
| 세마포어 | `RSemaphore` | 동시 접근 제한 |
| Rate Limit | `RRateLimiter` | API 속도 제한 |
| 블룸 필터 | `RBloomFilter` | 중복 검사 |
| 스케줄러 | `RScheduledExecutorService` | 분산 스케줄링 |
| Pub/Sub | `RTopic` | 이벤트 브로드캐스트 |

- **Watch Dog**: leaseTime 없는 `lock()` 시 자동 TTL 갱신
- **Redlock**: `getMultiLock(lock1, lock2, lock3)`으로 다중 노드 락
