---
title: "[Redis] 20. 캐싱 패턴 — Cache-Aside, Write-Through, Cache Stampede"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "caching", "cache-aside", "write-through", "stampede", "캐싱패턴"]
---

# 캐싱 패턴 — Cache-Aside, Write-Through, Cache Stampede

## 캐싱 기본 개념

```
캐시 히트율(Hit Rate) = 캐시에서 처리된 요청 / 전체 요청

히트율 90%: DB 요청 90% 감소
히트율 99%: DB 요청 99% 감소

캐시 크기 결정: 파레토 법칙 (80:20)
  상위 20% 인기 데이터가 80% 요청 처리
  → 전체 데이터의 20% 캐시에 저장하면 80% 히트율 가능
```

---

## Cache-Aside (Lazy Loading)

가장 일반적인 패턴. 필요할 때 캐시에 저장.

```
읽기:
  1. 캐시 조회
  2. 캐시 미스 → DB 조회
  3. DB 결과 → 캐시 저장 (TTL 설정)
  4. 반환

쓰기:
  1. DB 업데이트
  2. 캐시 무효화 (DEL)
```

```kotlin
fun getUser(userId: Long): User {
    val cacheKey = "user:$userId"

    // 캐시 조회
    val cached = redisTemplate.opsForValue().get(cacheKey)
    if (cached != null) {
        return cached.toUser()  // 캐시 히트
    }

    // DB 조회
    val user = userRepository.findById(userId)
        ?: throw NotFoundException("User $userId")

    // 캐시 저장 (1시간 TTL)
    redisTemplate.opsForValue().set(cacheKey, user.toJson(), 1, TimeUnit.HOURS)

    return user
}

fun updateUser(userId: Long, request: UpdateUserRequest): User {
    val user = userRepository.update(userId, request)
    // 캐시 무효화
    redisTemplate.delete("user:$userId")
    return user
}
```

**장점**:
- 실제로 사용되는 데이터만 캐시됨
- 캐시 서버 장애 시 DB로 폴백 가능

**단점**:
- Cold Start 시 캐시 미스 폭발 (Cache Stampede)
- DB 업데이트 후 캐시 삭제 전까지 stale 데이터 서빙 가능

---

## Write-Through

쓰기 시 DB + 캐시 동시에 업데이트.

```
쓰기:
  1. DB 업데이트
  2. 캐시도 즉시 업데이트

읽기:
  캐시에 항상 최신 데이터 → 캐시 미스 거의 없음
```

```kotlin
fun updateUser(userId: Long, request: UpdateUserRequest): User {
    // DB 업데이트
    val user = userRepository.update(userId, request)

    // 캐시도 즉시 업데이트
    redisTemplate.opsForValue().set(
        "user:$userId",
        user.toJson(),
        1, TimeUnit.HOURS
    )

    return user
}
```

**장점**:
- 캐시 항상 최신 상태
- 읽기 시 캐시 미스 없음

**단점**:
- 쓰기 지연 증가 (DB + 캐시 두 번 쓰기)
- 한 번도 읽히지 않는 데이터도 캐시됨 (낭비)

---

## Write-Behind (Write-Back)

캐시에 쓰고, 나중에 비동기로 DB에 반영.

```
쓰기:
  1. 캐시에만 즉시 쓰기
  2. 비동기 큐에 DB 쓰기 작업 추가
  3. 워커가 일괄 처리

읽기:
  캐시에서 읽기
```

**장점**: 매우 빠른 쓰기

**단점**:
- DB와 캐시 불일치 기간 존재
- 캐시 장애 시 데이터 유실 가능
- 구현 복잡

---

## Read-Through

캐시 미스 시 캐시 계층이 직접 DB 조회 후 저장.

```
클라이언트 → 캐시 조회
  캐시 미스 → 캐시가 DB에서 직접 로드 → 클라이언트에 반환
```

Cache-Aside와 유사하나 캐시 계층(라이브러리)이 자동 처리.

Spring Cache (`@Cacheable`)이 이 방식에 가까움.

---

## Cache Stampede (Thundering Herd)

### 문제

```
인기 캐시 키 만료 → 동시에 수천 개 요청이 DB 직접 조회
→ DB 과부하 → 장애 연쇄
```

### 해결 방법 1: Mutex Lock

```kotlin
fun getPopularData(key: String): Data {
    val cached = redis.get(key)
    if (cached != null) return cached.toData()

    // 락 획득 (NX=없을 때만, EX=5초)
    val lockKey = "lock:$key"
    val lockValue = UUID.randomUUID().toString()
    val acquired = redis.set(lockKey, lockValue, SetArgs().nx().ex(5))

    if (acquired == "OK") {
        try {
            // DB 조회 후 캐시 저장
            val data = db.find(key)
            redis.setex(key, 3600, data.toJson())
            return data
        } finally {
            // 락 해제
            releaseLock(lockKey, lockValue)
        }
    } else {
        // 다른 스레드가 DB 조회 중 → 짧게 대기 후 재시도
        Thread.sleep(50)
        return redis.get(key)?.toData() ?: getPopularData(key)
    }
}
```

### 해결 방법 2: Probabilistic Early Expiration

```kotlin
// TTL이 남아있어도 확률적으로 미리 갱신
fun getProbabilisticData(key: String, beta: Double = 1.0): Data {
    val (value, ttl) = redis.getWithTtl(key)

    if (value != null) {
        val remainingTtl = ttl
        val delta = measureTimeMillis { /* DB 조회 예상 시간 */ }
        val recomputeProb = -delta * beta * ln(Random.nextDouble())

        // 남은 TTL이 recomputeProb보다 작으면 미리 갱신
        if (remainingTtl > recomputeProb) {
            return value.toData()
        }
    }

    // 갱신
    val data = db.find(key)
    redis.setex(key, 3600, data.toJson())
    return data
}
```

### 해결 방법 3: TTL 분산

```kotlin
// 동시 만료를 막기 위해 TTL에 랜덤 지터 추가
fun setWithJitter(key: String, value: String, baseTtl: Long) {
    val jitter = Random.nextLong(0, baseTtl / 10)  // 10% 랜덤
    redis.setex(key, baseTtl + jitter, value)
}
```

### 해결 방법 4: 기존 값 반환 + 백그라운드 갱신

```kotlin
@Scheduled(fixedDelay = 60_000)
fun refreshPopularCache() {
    popularKeys.forEach { key ->
        val newData = db.find(key)
        redis.setex(key, 3600, newData.toJson())
    }
    // 캐시는 절대 만료되지 않고 항상 최신으로 유지
}
```

---

## Cache Invalidation (캐시 무효화)

### 이벤트 기반 무효화

```kotlin
// DB 변경 시 이벤트 발행
@TransactionalEventListener
fun onUserUpdated(event: UserUpdatedEvent) {
    redisTemplate.delete("user:${event.userId}")
    // 관련 캐시 전체 삭제
    redisTemplate.delete("user:${event.userId}:orders")
    redisTemplate.delete("user:${event.userId}:profile")
}
```

### 태그 기반 무효화

```kotlin
// 관련 캐시를 태그로 그룹화
fun cacheWithTag(key: String, value: String, tag: String, ttl: Long) {
    redis.setex(key, ttl, value)
    redis.sadd("cache-tag:$tag", key)
    redis.expire("cache-tag:$tag", ttl)
}

// 태그로 전체 무효화
fun invalidateByTag(tag: String) {
    val keys = redis.smembers("cache-tag:$tag") ?: return
    if (keys.isNotEmpty()) {
        redis.delete(keys)
    }
    redis.delete("cache-tag:$tag")
}

// 사용
cacheWithTag("product:123:detail", productJson, "category:electronics", 3600)
// 카테고리 변경 시 관련 캐시 전체 삭제
invalidateByTag("category:electronics")
```

---

## 정리

| 패턴 | 읽기 | 쓰기 | 적합한 경우 |
|------|------|------|-------------|
| Cache-Aside | 캐시 미스 시 DB | DB 후 캐시 삭제 | 읽기 중심, 일반적 |
| Write-Through | 항상 캐시 히트 | DB + 캐시 동시 | 읽기 많고 일관성 중요 |
| Write-Behind | 항상 캐시 히트 | 캐시 → 비동기 DB | 쓰기 매우 많음 |

- **Cache Stampede**: Mutex Lock, TTL 분산, 백그라운드 갱신으로 방지
- **캐시 무효화**: 이벤트 기반 삭제 또는 태그 기반 그룹 삭제
