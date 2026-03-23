---
title: "[Redis] 32. 데이터 모델링 — 키 설계, 관계 표현, 역인덱스"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "data-modeling", "key-naming", "secondary-index", "관계형"]
---

# 데이터 모델링 — 키 설계, 관계 표현, 역인덱스

Redis는 스키마가 없으므로 키 네이밍과 자료구조 선택이 데이터 설계의 전부.

## 키 네이밍 규칙

```bash
# 패턴: {서비스}:{엔티티}:{id}:{필드}
user:1001
user:1001:profile
user:1001:sessions

# 복합 키
order:2024-03:user:1001     # 연월별 주문
session:abc123:data

# 기능 구분
cache:user:1001             # 캐시
lock:order:5001             # 분산 락
queue:email                 # 큐
rate:api:user:1001          # Rate Limit
stats:dau:2024-03-15        # 통계

# 권장 구분자: :(콜론) 사용
# 금지: 공백, 특수문자 (단 {}는 Hash Tag용)
```

---

## 엔티티 저장 패턴

### Hash — 단일 객체

```bash
# 사용자 저장
HSET user:1001 name "Alice" email "alice@example.com" age 30 role "ADMIN"

# 특정 필드만 조회
HGET user:1001 email
HMGET user:1001 name role

# 전체 조회
HGETALL user:1001

# 필드 증가
HINCRBY user:1001 loginCount 1
```

```kotlin
data class User(val id: Long, val name: String, val email: String, val role: String)

fun saveUser(user: User) {
    redis.opsForHash<String, String>().putAll(
        "user:${user.id}",
        mapOf(
            "name" to user.name,
            "email" to user.email,
            "role" to user.role,
        )
    )
    redis.expire("user:${user.id}", Duration.ofHours(24))
}

fun getUser(userId: Long): User? {
    val fields = redis.opsForHash<String, String>().entries("user:$userId")
    if (fields.isEmpty()) return null
    return User(
        id = userId,
        name = fields["name"] ?: return null,
        email = fields["email"] ?: return null,
        role = fields["role"] ?: "USER",
    )
}
```

---

## 관계 표현

### 1:N 관계 (사용자 → 주문)

```bash
# 사용자의 주문 목록 (Set)
SADD user:1001:orders 5001 5002 5003

# 최근 주문 (List — 순서 보장)
LPUSH user:1001:recent-orders 5003
LTRIM user:1001:recent-orders 0 99   # 최근 100개만 유지

# 주문 상세 (Hash)
HSET order:5001 userId 1001 amount 50000 status PAID createdAt "2024-03-15T10:00:00"
```

```kotlin
fun addOrder(userId: Long, orderId: Long) {
    // 주문 목록에 추가
    redis.opsForSet().add("user:$userId:orders", orderId.toString())

    // 최근 주문 목록에 추가 (최대 100개)
    redis.opsForList().leftPush("user:$userId:recent-orders", orderId.toString())
    redis.opsForList().trim("user:$userId:recent-orders", 0, 99)
}

fun getUserOrders(userId: Long): Set<String>? {
    return redis.opsForSet().members("user:$userId:orders")
}
```

### N:M 관계 (사용자 ↔ 태그)

```bash
# 사용자가 가진 태그
SADD user:1001:tags "kotlin" "redis" "spring"

# 태그별 사용자 (역인덱스)
SADD tag:kotlin:users 1001 1002 1003
SADD tag:redis:users 1001 1004

# 공통 태그를 가진 사용자 (교집합)
SINTER tag:kotlin:users tag:redis:users
# → {1001}

# 둘 중 하나 이상 가진 사용자 (합집합)
SUNION tag:kotlin:users tag:redis:users
```

---

## 역인덱스 (Secondary Index)

Redis는 기본 키 조회만 지원 → 필드 기반 조회는 역인덱스 직접 구현.

```bash
# 이메일로 사용자 조회
SET index:user:email:alice@example.com 1001
SET index:user:email:bob@example.com 1002

GET index:user:email:alice@example.com
# → "1001"
```

```kotlin
fun createUser(user: User) {
    // 본 데이터 저장
    redis.opsForHash<String, String>().putAll(
        "user:${user.id}",
        mapOf("name" to user.name, "email" to user.email)
    )

    // 역인덱스 등록
    redis.opsForValue().set("index:user:email:${user.email}", user.id.toString())
}

fun findByEmail(email: String): User? {
    val userId = redis.opsForValue().get("index:user:email:$email")?.toLong()
        ?: return null
    return getUser(userId)
}

fun updateEmail(userId: Long, oldEmail: String, newEmail: String) {
    // 역인덱스 교체
    redis.delete("index:user:email:$oldEmail")
    redis.opsForValue().set("index:user:email:$newEmail", userId.toString())

    // 본 데이터 업데이트
    redis.opsForHash<String, String>().put("user:$userId", "email", newEmail)
}
```

---

## 범위 인덱스 (Sorted Set)

```kotlin
// 가입일 기준 인덱스
fun indexUserByCreatedAt(userId: Long, createdAt: Instant) {
    redis.opsForZSet().add(
        "index:user:created",
        userId.toString(),
        createdAt.epochSecond.toDouble()
    )
}

// 특정 기간 가입자 조회
fun getUsersCreatedBetween(from: Instant, to: Instant): Set<String>? {
    return redis.opsForZSet().rangeByScore(
        "index:user:created",
        from.epochSecond.toDouble(),
        to.epochSecond.toDouble()
    )
}

// 나이순 정렬 인덱스
fun indexUserByAge(userId: Long, age: Int) {
    redis.opsForZSet().add("index:user:age", userId.toString(), age.toDouble())
}

// 20~30세 사용자
fun getUsersByAgeRange(minAge: Int, maxAge: Int): Set<String>? {
    return redis.opsForZSet().rangeByScore(
        "index:user:age",
        minAge.toDouble(),
        maxAge.toDouble()
    )
}
```

---

## 페이지네이션

### 커서 기반 (Sorted Set)

```kotlin
data class Page<T>(val items: List<T>, val nextCursor: String?)

fun getPostsPage(
    cursor: String?,   // 마지막으로 본 postId
    pageSize: Int = 20,
): Page<Post> {
    val maxScore = if (cursor != null) {
        // 커서의 score 조회 후 그보다 작은 항목 (exclusive)
        redis.opsForZSet().score("posts:timeline", cursor)?.minus(0.001) ?: Double.MAX_VALUE
    } else {
        Double.MAX_VALUE
    }

    val items = redis.opsForZSet().reverseRangeByScore(
        "posts:timeline",
        Double.NEGATIVE_INFINITY,
        maxScore,
        0,
        pageSize.toLong(),
    )?.mapNotNull { getPost(it.toLong()) } ?: emptyList()

    val nextCursor = if (items.size == pageSize) items.last().id.toString() else null
    return Page(items, nextCursor)
}
```

### 오프셋 기반

```kotlin
fun getPostsOffset(page: Int, pageSize: Int = 20): List<Post> {
    val start = (page * pageSize).toLong()
    val end = start + pageSize - 1

    return redis.opsForZSet()
        .reverseRange("posts:timeline", start, end)
        ?.mapNotNull { getPost(it.toLong()) }
        ?: emptyList()
}
```

---

## 카운터 집합

```kotlin
// 게시물 통계 (Hash로 한 번에 관리)
fun incrementPostStats(postId: Long, field: String) {
    redis.opsForHash<String, String>().increment("post:$postId:stats", field, 1L)
}

fun getPostStats(postId: Long): Map<String, String>? {
    return redis.opsForHash<String, String>().entries("post:$postId:stats")
    // → {views: 1024, likes: 58, comments: 12}
}

// 일별 통계 (자동 만료)
fun incrementDailyStat(metric: String, date: LocalDate = LocalDate.now()) {
    val key = "stats:$metric:${date}"
    redis.opsForValue().increment(key)
    redis.expireAt(key, date.plusDays(90).atStartOfDay().toInstant(ZoneOffset.UTC))
}
```

---

## 계층 구조 (트리)

```bash
# 카테고리 트리
SADD category:1:children 2 3 4      # 루트의 자식
SADD category:2:children 5 6         # category:2의 자식
SET category:5:parent 2              # 부모 참조

# 경로 저장 (materialized path)
SET category:5:path "1/2/5"
```

```kotlin
fun getCategoryPath(categoryId: Long): List<Long> {
    val path = redis.opsForValue().get("category:$categoryId:path") ?: return listOf(categoryId)
    return path.split("/").map { it.toLong() }
}

fun getSubCategories(categoryId: Long): Set<String>? {
    return redis.opsForSet().members("category:$categoryId:children")
}
```

---

## 정리

| 관계 | 자료구조 | 특징 |
|------|---------|------|
| 단일 객체 | Hash | 필드별 접근, 부분 업데이트 |
| 1:N 목록 | Set / List | Set=중복없음, List=순서있음 |
| N:M | Set + 역인덱스 | 교집합/합집합 쿼리 |
| 범위 조회 | Sorted Set | score 기반 범위 검색 |
| 동등 조회 | String (역인덱스) | 필드→ID 매핑 |
| 계층 구조 | Set(자식) + String(경로) | 트리 탐색 |

- **키 네이밍**: `{서비스}:{엔티티}:{id}` 패턴 통일
- **역인덱스**: 쓰기 시 동기화 필수
- **TTL**: 인덱스 키도 함께 만료 관리
