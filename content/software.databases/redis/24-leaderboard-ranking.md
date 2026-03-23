---
title: "[Redis] 24. 리더보드 & 랭킹 — 실시간 순위 시스템"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "leaderboard", "ranking", "sorted-set", "실시간순위"]
---

# 리더보드 & 랭킹 — 실시간 순위 시스템

## 기본 리더보드

```bash
# 점수 등록/업데이트
ZADD leaderboard 9500 "alice"
ZADD leaderboard 8800 "bob"
ZADD leaderboard 9200 "charlie"
ZADD leaderboard 7600 "dave"

# 점수 추가 (기존 + 추가)
ZINCRBY leaderboard 300 "bob"  # 8800 → 9100

# 전체 순위 (내림차순, 0-based)
ZREVRANGE leaderboard 0 -1 WITHSCORES

# 상위 10명
ZREVRANGE leaderboard 0 9 WITHSCORES

# 특정 유저 순위 (0-based)
ZREVRANK leaderboard "alice"  # 0 (1위)
ZREVRANK leaderboard "bob"    # 2 (3위)

# 특정 유저 점수
ZSCORE leaderboard "alice"   # 9500

# 전체 참가자 수
ZCARD leaderboard
```

---

## 실시간 리더보드 구현

```kotlin
@Service
class LeaderboardService(private val redis: StringRedisTemplate) {

    private val leaderboardKey = "leaderboard:game"

    // 점수 업데이트 (누적)
    fun addScore(userId: String, score: Long): Double {
        return redis.opsForZSet().incrementScore(
            leaderboardKey, userId, score.toDouble()
        ) ?: 0.0
    }

    // 점수 설정 (절대값)
    fun setScore(userId: String, score: Long) {
        redis.opsForZSet().add(leaderboardKey, userId, score.toDouble())
    }

    // 특정 유저 순위 (1-based)
    fun getRank(userId: String): Long? {
        val rank = redis.opsForZSet().reverseRank(leaderboardKey, userId)
        return rank?.plus(1)  // 0-based → 1-based
    }

    // 특정 유저 점수
    fun getScore(userId: String): Long? {
        return redis.opsForZSet().score(leaderboardKey, userId)?.toLong()
    }

    // 상위 N명
    fun getTopN(n: Long): List<RankEntry> {
        val entries = redis.opsForZSet()
            .reverseRangeWithScores(leaderboardKey, 0, n - 1) ?: return emptyList()

        return entries.mapIndexed { idx, entry ->
            RankEntry(
                rank = idx + 1,
                userId = entry.value!!,
                score = entry.score!!.toLong(),
            )
        }
    }

    // 페이지네이션
    fun getPage(page: Int, size: Int): List<RankEntry> {
        val start = ((page - 1) * size).toLong()
        val end = start + size - 1

        val entries = redis.opsForZSet()
            .reverseRangeWithScores(leaderboardKey, start, end) ?: return emptyList()

        return entries.mapIndexed { idx, entry ->
            RankEntry(
                rank = start + idx + 1,
                userId = entry.value!!,
                score = entry.score!!.toLong(),
            )
        }
    }

    // 내 주변 순위 (±3명)
    fun getAroundMe(userId: String, range: Int = 3): List<RankEntry> {
        val myRank = redis.opsForZSet()
            .reverseRank(leaderboardKey, userId) ?: return emptyList()

        val start = maxOf(0, myRank - range)
        val end = myRank + range

        val entries = redis.opsForZSet()
            .reverseRangeWithScores(leaderboardKey, start, end) ?: return emptyList()

        return entries.mapIndexed { idx, entry ->
            RankEntry(
                rank = start + idx + 1,
                userId = entry.value!!,
                score = entry.score!!.toLong(),
                isMe = entry.value == userId,
            )
        }
    }
}

data class RankEntry(
    val rank: Long,
    val userId: String,
    val score: Long,
    val isMe: Boolean = false,
)
```

---

## 주간/월간 리더보드

```kotlin
@Service
class PeriodLeaderboardService(private val redis: StringRedisTemplate) {

    // 주간 리더보드 키 (ISO 주 번호)
    private fun weeklyKey(): String {
        val week = LocalDate.now().get(WeekFields.ISO.weekOfWeekBasedYear())
        val year = LocalDate.now().year
        return "leaderboard:weekly:$year-W$week"
    }

    // 월간 리더보드 키
    private fun monthlyKey(): String {
        val month = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"))
        return "leaderboard:monthly:$month"
    }

    // 전체 기간 키
    private val allTimeKey = "leaderboard:all-time"

    // 점수 추가 (여러 리더보드 동시 업데이트)
    fun addScore(userId: String, score: Long) {
        redis.executePipelined { connection ->
            listOf(weeklyKey(), monthlyKey(), allTimeKey).forEach { key ->
                connection.zSetCommands().zIncrBy(
                    key.toByteArray(),
                    score.toDouble(),
                    userId.toByteArray()
                )
            }
            null
        }
    }

    // 주간 리더보드 자동 만료 설정 (8일 후)
    fun setWeeklyExpiry() {
        redis.expire(weeklyKey(), 8, TimeUnit.DAYS)
    }
}
```

---

## 게임 시즌 리더보드

```kotlin
@Service
class SeasonLeaderboardService(private val redis: StringRedisTemplate) {

    // 시즌 종료 시 스냅샷 저장
    fun endSeason(seasonId: String) {
        val currentKey = "leaderboard:current"
        val archiveKey = "leaderboard:season:$seasonId"

        // 현재 리더보드 복사 (스냅샷)
        redis.execute { connection ->
            connection.keyCommands().copy(
                currentKey.toByteArray(),
                archiveKey.toByteArray(),
                true  // replace
            )
        }

        // 현재 리더보드 초기화
        redis.delete(currentKey)

        // 아카이브는 1년 보존
        redis.expire(archiveKey, 365, TimeUnit.DAYS)
    }

    // 시즌 리더보드 조회
    fun getSeasonTopN(seasonId: String, n: Long): List<RankEntry> {
        val key = "leaderboard:season:$seasonId"
        val entries = redis.opsForZSet()
            .reverseRangeWithScores(key, 0, n - 1) ?: return emptyList()

        return entries.mapIndexed { idx, entry ->
            RankEntry(rank = idx + 1L, userId = entry.value!!, score = entry.score!!.toLong())
        }
    }
}
```

---

## 다중 조건 랭킹

점수가 같을 때 등록 시각이 빠른 사람이 앞서는 경우:

```kotlin
// Score = 실제점수 * 10^12 + (Long.MAX_VALUE - timestamp)
// → 점수가 높을수록, 같은 점수면 먼저 등록한 사람이 앞

fun addScoreWithTiebreaker(userId: String, score: Long) {
    val timestamp = System.currentTimeMillis()
    val compositeScore = score * 1_000_000_000_000L + (Long.MAX_VALUE - timestamp)
    redis.opsForZSet().add("leaderboard", userId, compositeScore.toDouble())
}
```

---

## 지역별 / 계층별 리더보드

```kotlin
// 지역별 리더보드
fun addToRegionalLeaderboard(userId: String, region: String, score: Long) {
    redis.opsForZSet().add("leaderboard:region:$region", userId, score.toDouble())
}

// 글로벌 + 지역 동시 업데이트
fun addScore(userId: String, region: String, score: Long) {
    redis.executePipelined { connection ->
        connection.zSetCommands().zIncrBy(
            "leaderboard:global".toByteArray(), score.toDouble(), userId.toByteArray()
        )
        connection.zSetCommands().zIncrBy(
            "leaderboard:region:$region".toByteArray(), score.toDouble(), userId.toByteArray()
        )
        null
    }
}

// 내 친구들 중 순위
fun getFriendsLeaderboard(userId: String, friendIds: List<String>): List<RankEntry> {
    val tempKey = "temp:friends-leaderboard:$userId"

    // 임시 키에 친구들 점수 복사
    redis.opsForZSet().unionAndStore(
        "leaderboard:global",
        emptySet(),  // 빈 set
        tempKey,
    )

    // 나 + 친구만 필터링 (교집합)
    val allIds = friendIds + userId
    // ... ZSet intersection by member 방식

    redis.expire(tempKey, 10, TimeUnit.SECONDS)

    return emptyList() // 실제 구현 필요
}
```

---

## 정리

- **ZADD / ZINCRBY**: 점수 설정 / 누적 추가
- **ZREVRANGE 0 9 WITHSCORES**: 상위 10위 내림차순
- **ZREVRANK**: 특정 유저 순위 (0-based, +1 해서 표시)
- **주간/월간**: 날짜 기반 키 네이밍 + TTL 자동 만료
- **타이브레이커**: composite score = 점수 * 큰수 + (MAX - timestamp)
- **페이지네이션**: `ZREVRANGE start end` (LIMIT 없이 offset/limit으로)
