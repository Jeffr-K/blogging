---
title: "랭킹과 실시간 순위 캐싱"
date: 2026-04-12
tags: [cache, ranking, leaderboard, redis, sorted-set]
---

## Redis Sorted Set으로 실시간 랭킹

Sorted Set은 score 기반으로 자동 정렬됩니다. 실시간 랭킹 구현에 최적입니다.

```python
import redis

r = redis.Redis()

# 점수 추가/갱신
def update_score(user_id: int, delta: int):
    """점수 증가"""
    r.zincrby("ranking:global", delta, f"user:{user_id}")

def set_score(user_id: int, score: int):
    """점수 설정"""
    r.zadd("ranking:global", {f"user:{user_id}": score})

# 랭킹 조회 (내림차순)
def get_top_n(n: int = 100) -> list[dict]:
    items = r.zrevrange("ranking:global", 0, n - 1, withscores=True)
    return [
        {"rank": i + 1, "user_id": key.decode().split(":")[1], "score": int(score)}
        for i, (key, score) in enumerate(items)
    ]

# 내 순위 조회
def get_my_rank(user_id: int) -> int | None:
    rank = r.zrevrank("ranking:global", f"user:{user_id}")
    return rank + 1 if rank is not None else None  # 0-indexed → 1-indexed

# 주변 순위 조회 (나 ± 5명)
def get_nearby_ranks(user_id: int, range_size: int = 5) -> list[dict]:
    my_rank = r.zrevrank("ranking:global", f"user:{user_id}")
    if my_rank is None:
        return []

    start = max(0, my_rank - range_size)
    end = my_rank + range_size

    items = r.zrevrange("ranking:global", start, end, withscores=True)
    return [
        {"rank": start + i + 1, "user_id": key.decode().split(":")[1], "score": int(score)}
        for i, (key, score) in enumerate(items)
    ]
```

---

## 기간별 랭킹

```python
from datetime import datetime, timedelta

def get_ranking_key(period: str) -> str:
    """기간별 랭킹 키 생성"""
    now = datetime.now()
    if period == "daily":
        return f"ranking:daily:{now.strftime('%Y-%m-%d')}"
    elif period == "weekly":
        week = now.isocalendar()[1]
        return f"ranking:weekly:{now.year}-W{week:02d}"
    elif period == "monthly":
        return f"ranking:monthly:{now.strftime('%Y-%m')}"
    return "ranking:alltime"

def add_score_all_periods(user_id: int, points: int):
    """모든 기간 랭킹에 점수 추가"""
    pipeline = r.pipeline()
    for period in ["daily", "weekly", "monthly", "alltime"]:
        key = get_ranking_key(period)
        pipeline.zincrby(key, points, f"user:{user_id}")
        # 일별: 2일, 주별: 8일, 월별: 35일 TTL
        ttl_map = {"daily": 172800, "weekly": 691200, "monthly": 3024000}
        if period in ttl_map:
            pipeline.expire(key, ttl_map[period])
    pipeline.execute()
```

---

## 대용량 랭킹: 분리 집계

실시간으로 Sorted Set에 업데이트하면 Write 부하가 집중됩니다:

```python
# 문제: 초당 10만 건의 점수 업데이트
# → Redis에 초당 10만 ZINCRBY → 병목

# 해결: Write-Behind (캐시에 모아두고 주기적으로 랭킹 갱신)

from collections import defaultdict
import threading

score_buffer = defaultdict(int)
buffer_lock = threading.Lock()

def add_score_buffered(user_id: int, points: int):
    """버퍼에 점수 누적"""
    with buffer_lock:
        score_buffer[user_id] += points

def flush_scores():
    """주기적으로 Redis 랭킹에 반영"""
    with buffer_lock:
        if not score_buffer:
            return
        to_flush = dict(score_buffer)
        score_buffer.clear()

    pipeline = r.pipeline()
    for user_id, points in to_flush.items():
        pipeline.zincrby("ranking:global", points, f"user:{user_id}")
    pipeline.execute()

# 1초마다 flush
import time
while True:
    time.sleep(1)
    flush_scores()
```

---

## 동점자 처리

같은 점수에서 순서를 어떻게 정할까요:

```python
# 방법 1: 먼저 달성한 사람 우선 (타임스탬프 활용)
import time

def update_score_with_tiebreak(user_id: int, score: int):
    # score를 정수 부분으로, 시간을 소수 부분으로 사용
    timestamp = time.time()
    composite_score = score - (timestamp / 10_000_000_000)  # 타임스탬프는 점수에서 아주 작은 값
    r.zadd("ranking", {f"user:{user_id}": composite_score}, gt=True)  # 더 큰 값으로만 갱신

# 방법 2: 별도 ZSet으로 달성 시각 추적
def set_score_with_time(user_id: int, score: int):
    current = r.zscore("ranking", f"user:{user_id}")
    if current is None or score > current:
        r.zadd("ranking", {f"user:{user_id}": score})
        r.zadd("ranking:time", {f"user:{user_id}": time.time()})
```

---

## 랭킹 캐싱 최적화

```python
# 상위 랭킹은 별도로 캐시 (매번 ZSet 조회 비용 절감)
TOP_100_KEY = "ranking:top100:cache"
TOP_100_TTL = 60  # 1분

def get_top_100():
    cached = r.get(TOP_100_KEY)
    if cached:
        return json.loads(cached)

    top100 = r.zrevrange("ranking:global", 0, 99, withscores=True)
    result = [{"rank": i+1, "user_id": k.decode().split(":")[1], "score": int(s)}
              for i, (k, s) in enumerate(top100)]

    r.setex(TOP_100_KEY, TOP_100_TTL, json.dumps(result))
    return result
```

---

## 핵심 요약

- Sorted Set: O(log N)으로 삽입/삭제/조회 → 실시간 랭킹에 최적
- `ZINCRBY`: 점수 증가, `ZREVRANK`: 내 순위, `ZREVRANGE`: 상위 N명
- 기간별 랭킹: 키에 날짜/주/월 포함 + TTL 설정
- 대용량: Write-Behind로 점수 버퍼링 후 일괄 갱신
- 상위 100명 별도 캐시 + 60초 TTL로 ZSet 조회 최소화
