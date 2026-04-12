---
title: "Redis 자료구조 완전 정리"
date: 2026-04-12
tags: [redis, data-structures, string, hash, list, set, zset]
---

## Redis 자료구조 개요

```
String   → 가장 기본, 바이트 배열
Hash     → 필드-값 맵
List     → 양방향 연결 리스트 (큐/스택)
Set      → 중복 없는 집합
ZSet     → 점수(score)로 정렬된 집합
Bitmap   → 비트 단위 조작
HyperLogLog → 근사 카디널리티
Stream   → 메시지 스트림 (Kafka 유사)
```

---

## String

```bash
SET key value [EX seconds] [NX] [XX]
GET key
INCR key        # 정수 원자적 증가
INCRBY key 5
APPEND key " suffix"
STRLEN key

# 멀티키
MSET k1 v1 k2 v2
MGET k1 k2
```

```python
# 내부 인코딩
# 정수: int (8 bytes 절약)
redis.set("count", 42)          # encoding: int

# 44 bytes 이하 문자열: embstr (연속 메모리)
redis.set("name", "Alice")      # encoding: embstr

# 44 bytes 초과: raw
redis.set("long", "A" * 100)   # encoding: raw
```

**사용 사례:** 세션 저장, 카운터, 캐시 기본값, 분산 락

---

## Hash

```bash
HSET user:42 name "Alice" age 30 email "alice@example.com"
HGET user:42 name
HMGET user:42 name age
HGETALL user:42
HINCRBY user:42 age 1
HDEL user:42 email
HEXISTS user:42 name
HLEN user:42
```

```python
# 실용 패턴: 객체 저장
redis.hset("user:42", mapping={
    "name": "Alice",
    "age": 30,
    "login_count": 0
})

# 특정 필드만 업데이트 (직렬화 불필요)
redis.hincrby("user:42", "login_count", 1)
redis.hset("user:42", "last_login", "2026-04-12")
```

**내부 인코딩:**
- 필드 ≤128, 값 ≤64 bytes → `ziplist` (압축)
- 초과 → `hashtable`

**사용 사례:** 사용자 프로필, 설정값, 객체 부분 업데이트

---

## List

```bash
RPUSH queue "job1" "job2"   # 오른쪽 추가
LPUSH stack "item"          # 왼쪽 추가
RPOP queue                   # 오른쪽 제거
LPOP stack                   # 왼쪽 제거
LRANGE list 0 -1            # 전체 조회
LLEN list
BRPOP queue 10              # 블로킹 팝 (10초 대기)
```

```python
# 큐 패턴
redis.rpush("task:queue", "task1")
task = redis.blpop("task:queue", timeout=5)  # 워커가 대기

# 최근 N개 유지
redis.lpush("recent:views", item_id)
redis.ltrim("recent:views", 0, 99)  # 최대 100개 유지
```

**사용 사례:** 작업 큐, 최근 활동 피드, 스택

---

## Set

```bash
SADD tags "python" "redis" "cache"
SMEMBERS tags
SISMEMBER tags "python"    # O(1)
SCARD tags                  # 원소 수
SREM tags "cache"

# 집합 연산
SUNION tags1 tags2         # 합집합
SINTER tags1 tags2         # 교집합
SDIFF tags1 tags2          # 차집합
```

```python
# 사용 사례: 팔로워/팔로잉
redis.sadd(f"followers:{user_id}", follower_id)
redis.smembers(f"followers:{user_id}")

# 공통 팔로워 (교집합)
common = redis.sinter(f"followers:{user1}", f"followers:{user2}")

# 태그 필터링
redis.sunionstore("result", "tag:python", "tag:redis")
```

**사용 사례:** 태그, 팔로워, 중복 제거, 무작위 선택(SRANDMEMBER)

---

## Sorted Set (ZSet)

```bash
ZADD leaderboard 1500 "Alice" 1200 "Bob" 1800 "Charlie"
ZRANGE leaderboard 0 -1 WITHSCORES     # 오름차순
ZREVRANGE leaderboard 0 2 WITHSCORES   # 내림차순 상위 3
ZSCORE leaderboard "Alice"
ZINCRBY leaderboard 100 "Alice"        # 점수 증가
ZRANK leaderboard "Alice"              # 순위 (0부터)
ZREVRANK leaderboard "Alice"           # 역순 순위
ZRANGEBYSCORE leaderboard 1000 2000    # 점수 범위 조회
```

```python
# 실시간 랭킹
redis.zadd("ranking:daily", {"user:42": 1500})
redis.zincrby("ranking:daily", 10, "user:42")  # 점수 10 증가

# 상위 10명
top10 = redis.zrevrange("ranking:daily", 0, 9, withscores=True)

# 내 순위
rank = redis.zrevrank("ranking:daily", "user:42")
```

**내부 인코딩:**
- 원소 ≤128, 값 ≤64 bytes → `ziplist`
- 초과 → `skiplist` + `hashtable`

**사용 사례:** 랭킹, 우선순위 큐, 시간 기반 이벤트, 범위 쿼리

---

## Bitmap

```bash
SETBIT user:active:2026-04-12 42 1   # 유저 42가 오늘 접속
GETBIT user:active:2026-04-12 42     # 접속 여부
BITCOUNT user:active:2026-04-12      # 오늘 접속자 수
BITOP AND result key1 key2           # 비트 연산
```

```python
# 일별 접속 통계 (1억 유저 = 12.5MB)
date_str = "2026-04-12"
redis.setbit(f"active:{date_str}", user_id, 1)

# 오늘 접속자 수 (매우 빠름)
count = redis.bitcount(f"active:{date_str}")

# 7일 연속 접속 유저
for day in days:
    redis.setbit(f"active:{day}", user_id, 1)
redis.bitop("AND", "consecutive:7days", *[f"active:{d}" for d in days])
redis.bitcount("consecutive:7days")
```

**사용 사례:** DAU/MAU, 기능 플래그, 출석 체크

---

## HyperLogLog

```bash
PFADD hll "user:1" "user:2" "user:3"
PFCOUNT hll           # 근사 카디널리티 (0.81% 오차)
PFMERGE dest hll1 hll2
```

```python
# 페이지별 UV (Unique Visitor) 추적
# 정확한 Set: 사용자 1명당 8~40 bytes
# HyperLogLog: 12 KB 고정 → 수억 명도 12 KB!
redis.pfadd(f"uv:page:home:{date}", user_id)
uv = redis.pfcount(f"uv:page:home:{date}")
```

**오차율:** 0.81%로 고정. 정확한 카운팅이 필요 없을 때 사용.

**사용 사례:** UV 카운팅, 검색어 중복 제거, 대략적인 집합 크기

---

## Stream

```bash
XADD events * user_id 42 action "login"  # 이벤트 추가 (* = 자동 ID)
XLEN events
XRANGE events - + COUNT 10    # 최근 10개
XREAD COUNT 10 STREAMS events 0  # 처음부터 읽기

# 소비자 그룹
XGROUP CREATE events mygroup $ MKSTREAM  # 그룹 생성
XREADGROUP GROUP mygroup worker1 COUNT 10 STREAMS events >
XACK events mygroup message-id           # 처리 완료
```

**Kafka와의 비교:**
```
Redis Stream: 단일 서버, 간단한 큐, 소비자 그룹 지원
Kafka:        분산, 높은 처리량, 오래된 메시지 보관

Redis Stream은 Kafka보다 단순하고 빠르지만, 
대규모 이벤트 처리에는 Kafka가 적합
```

**사용 사례:** 실시간 로그, 이벤트 소싱, 간단한 메시지 큐

---

## 핵심 요약

| 자료구조 | 내부 구조 | 주요 사용처 |
|---------|----------|------------|
| String | int/embstr/raw | 세션, 카운터, 기본 캐시 |
| Hash | ziplist/hashtable | 객체 필드, 설정 |
| List | quicklist | 큐, 최근 피드 |
| Set | intset/hashtable | 태그, 팔로워 |
| ZSet | ziplist/skiplist | 랭킹, 정렬 |
| Bitmap | 비트 배열 | DAU, 플래그 |
| HyperLogLog | 12KB 고정 | 근사 UV |
| Stream | radix tree | 이벤트 스트림 |
