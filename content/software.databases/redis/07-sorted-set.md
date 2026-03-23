---
title: "[Redis] 7. Sorted Set — 명령어 전체와 활용 패턴"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "sorted-set", "ZADD", "ZRANGE", "리더보드", "랭킹"]
---

# Sorted Set — 명령어 전체와 활용 패턴

## 개요

Redis Sorted Set(ZSet)은 각 멤버에 **score(float)** 를 부여하여 항상 정렬 상태를 유지. 중복 멤버 불가, score는 중복 가능. 내부적으로 skiplist + hashtable.

```
ZADD leaderboard 9500 "alice"
ZADD leaderboard 8800 "bob"
ZADD leaderboard 9200 "charlie"

→ 정렬된 상태:
   bob(8800) < charlie(9200) < alice(9500)
```

---

## 추가 / 제거

```bash
# 기본 추가
ZADD key score member
ZADD key score1 member1 score2 member2  # 여러 개 동시 추가

# 옵션
ZADD key NX score member  # 멤버가 없을 때만 추가
ZADD key XX score member  # 멤버가 있을 때만 업데이트
ZADD key GT score member  # 현재 score보다 클 때만 업데이트
ZADD key LT score member  # 현재 score보다 작을 때만 업데이트
ZADD key CH score member  # 변경된 수 반환 (추가+업데이트)
ZADD key INCR score member  # score 증가 (ZINCRBY와 동일)

# score 증가
ZINCRBY key increment member

# 제거
ZREM key member1 member2

# 범위로 제거
ZREMRANGEBYRANK key start stop      # 순위 범위 (0-based)
ZREMRANGEBYSCORE key min max        # score 범위
ZREMRANGEBYLEX key "[a" "[z"        # 사전순 범위 (score 동일 시)
```

---

## 조회 명령어

### 범위 조회 (Redis 6.2+ ZRANGE 통합)

```bash
# ZRANGE key min max [BYSCORE | BYLEX] [REV] [LIMIT offset count] [WITHSCORES]

# 순위 기반 (기본)
ZRANGE leaderboard 0 -1             # 전체 오름차순
ZRANGE leaderboard 0 2              # 상위 3개 오름차순
ZRANGE leaderboard 0 -1 REV        # 내림차순 (높은 score 먼저)
ZRANGE leaderboard 0 2 REV         # 내림차순 상위 3개
ZRANGE leaderboard 0 -1 WITHSCORES # score 포함

# score 기반
ZRANGE leaderboard 8000 9000 BYSCORE            # 8000~9000 사이
ZRANGE leaderboard 9000 8000 BYSCORE REV        # 내림차순
ZRANGE leaderboard "(8000" "+inf" BYSCORE       # 8000 초과
ZRANGE leaderboard "-inf" "+inf" BYSCORE        # 전체
ZRANGE leaderboard 0 9000 BYSCORE LIMIT 0 10    # 페이지네이션

# 사전순 (score 동일 시)
ZRANGE myset "[a" "[z" BYLEX                    # a~z 사이
ZRANGE myset "-" "+"  BYLEX                     # 전체
```

### 레거시 범위 명령어 (6.2 이전)

```bash
ZREVRANGE key 0 -1          # 내림차순 (6.2+ → ZRANGE REV)
ZRANGEBYSCORE key min max   # score 범위 (6.2+ → ZRANGE BYSCORE)
ZREVRANGEBYSCORE key max min
ZRANGEBYLEX key min max
ZREVRANGEBYLEX key max min
```

### 랭킹 조회

```bash
# 순위 (0-based, 오름차순)
ZRANK leaderboard "alice"

# 순위 (0-based, 내림차순) — 높은 score가 0위
ZREVRANK leaderboard "alice"

# 순위 + score 동시 반환 (Redis 7.2+)
ZRANK leaderboard "alice" WITHSCORE
ZREVRANK leaderboard "alice" WITHSCORE
```

### score 조회

```bash
ZSCORE leaderboard "alice"          # 단일 score
ZMSCORE leaderboard alice bob charlie  # 여러 score 동시 조회
```

### 집계 조회

```bash
# 전체 멤버 수
ZCARD leaderboard

# score 범위 내 멤버 수
ZCOUNT leaderboard 8000 9000
ZCOUNT leaderboard "-inf" "+inf"    # 전체
ZCOUNT leaderboard "(8000" "+inf"   # 8000 초과

# 사전순 범위 멤버 수
ZLEXCOUNT myset "[a" "[z"
ZLEXCOUNT myset "-" "+"
```

---

## 팝 명령어

```bash
# 가장 낮은 score의 멤버 제거+반환
ZPOPMIN key
ZPOPMIN key 3           # 3개

# 가장 높은 score의 멤버 제거+반환
ZPOPMAX key
ZPOPMAX key 3

# Blocking 버전 (Redis 5.0+)
BZPOPMIN key1 key2 timeout
BZPOPMAX key1 key2 timeout

# 여러 ZSet에서 최솟값 pop (Redis 7.0+)
ZMPOP 2 key1 key2 MIN
ZMPOP 2 key1 key2 MIN COUNT 5
BZMPOP timeout 2 key1 key2 MIN
```

---

## 집합 연산

```bash
# 합집합 (결과를 destination에 저장)
ZUNIONSTORE destination 2 key1 key2
ZUNIONSTORE destination 2 key1 key2 WEIGHTS 1 2        # 가중치
ZUNIONSTORE destination 2 key1 key2 AGGREGATE MIN      # MIN/MAX/SUM

# 교집합
ZINTERSTORE destination 2 key1 key2

# 차집합 (Redis 6.2+)
ZDIFFSTORE destination 2 key1 key2

# 저장 없이 결과만 반환 (Redis 6.2+)
ZUNION 2 key1 key2 WITHSCORES
ZINTER 2 key1 key2
ZDIFF 2 key1 key2

# 교집합 크기만 (Redis 7.0+)
ZINTERCARD 2 key1 key2
ZINTERCARD 2 key1 key2 LIMIT 100
```

---

## 순회

```bash
ZSCAN key 0 MATCH "user:*" COUNT 100
```

---

## 활용 패턴

### 리더보드 (실시간 랭킹)

```bash
# 점수 업데이트
ZADD leaderboard 9500 "alice"
ZADD leaderboard GT 9600 "alice"  # 9600이 더 크면 업데이트
ZINCRBY leaderboard 100 "alice"   # 점수 추가

# 상위 10위
ZREVRANGE leaderboard 0 9 WITHSCORES

# 특정 유저 순위 (1-based)
ZREVRANK leaderboard "alice"  # → 0 (0-based이므로 +1 해서 표시)

# 특정 순위 범위 (내 주변 순위)
ZREVRANK leaderboard "alice"  # → rank (예: 5)
ZRANGE leaderboard (rank-3) (rank+3) REV WITHSCORES  # 주변 7명
```

```kotlin
fun getLeaderboard(page: Int, size: Int): List<RankEntry> {
    val start = (page - 1) * size.toLong()
    val end = start + size - 1
    return redis.zrevrangeWithScores("leaderboard", start, end)
        .mapIndexed { idx, (member, score) ->
            RankEntry(rank = start + idx + 1, userId = member, score = score.toLong())
        }
}
```

### 우선순위 큐

```bash
# 작업 추가 (낮은 priority 숫자 = 높은 우선순위)
ZADD job-queue 1 "urgent-job-A"
ZADD job-queue 2 "normal-job-B"
ZADD job-queue 3 "low-job-C"

# 가장 높은 우선순위 작업 처리
ZPOPMIN job-queue  # urgent-job-A

# Blocking 버전
BZPOPMIN job-queue 30
```

### 시간 기반 이벤트 (score = timestamp)

```bash
# 예약 작업 (score = 실행 타임스탬프)
ZADD scheduled-jobs 1700000000 "send-email:user-1001"
ZADD scheduled-jobs 1700003600 "cleanup:session"

# 지금 실행할 작업 조회 (score <= 현재 시각)
ZRANGEBYSCORE scheduled-jobs -inf 1700001000

# 지금 실행할 작업 원자적 pop (Lua)
EVAL "
  local jobs = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, 10)
  if #jobs > 0 then
    redis.call('ZREM', KEYS[1], unpack(jobs))
  end
  return jobs
" 1 scheduled-jobs 1700001000
```

### 슬라이딩 윈도우 Rate Limit

```bash
# score = timestamp(ms), member = unique ID
ZADD rate:user-1001 1700000000000 "req-uuid-1"
ZADD rate:user-1001 1700000001000 "req-uuid-2"

# 1분 이전 데이터 제거
ZREMRANGEBYSCORE rate:user-1001 -inf 1699999940000  # now - 60000

# 현재 윈도우 내 요청 수
ZCARD rate:user-1001
```

### 자동완성

```bash
# 검색어 등록 (score=0, 사전순 정렬)
ZADD autocomplete 0 "redis"
ZADD autocomplete 0 "redis cluster"
ZADD autocomplete 0 "redis sentinel"
ZADD autocomplete 0 "rabbitmq"

# "red"로 시작하는 것 조회
ZRANGEBYLEX autocomplete "[red" "[red\xff"
```

---

## 정리

| 명령어 | 설명 |
|--------|------|
| ZADD [NX\|XX\|GT\|LT] | 추가/업데이트 |
| ZINCRBY | score 증가 |
| ZREM | 제거 |
| ZRANGE [BYSCORE\|BYLEX\|REV] | 범위 조회 (통합 명령) |
| ZRANK / ZREVRANK | 순위 조회 |
| ZSCORE / ZMSCORE | score 조회 |
| ZCARD / ZCOUNT | 개수 조회 |
| ZPOPMIN / ZPOPMAX | 최솟값/최댓값 pop |
| BZPOPMIN / BZPOPMAX | Blocking pop |
| ZUNIONSTORE / ZINTERSTORE | 집합 연산 후 저장 |
