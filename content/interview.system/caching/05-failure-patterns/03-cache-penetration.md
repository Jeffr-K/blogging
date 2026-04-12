---
title: "Cache Penetration: 존재하지 않는 키 공격"
date: 2026-04-12
tags: [cache, penetration, bloom-filter, null-cache]
---

## 문제: 없는 데이터를 계속 조회하면?

**Cache Penetration**은 캐시에도 없고 DB에도 없는 데이터를 요청할 때 발생합니다.

```
일반 캐시 흐름:
  요청 → 캐시 미스 → DB 조회 → 결과 캐시 저장 → 응답

Cache Penetration:
  요청(없는 id=-1) → 캐시 미스 → DB 조회 → 결과 없음(null) → 캐시 저장 안 함
  → 다음 요청(id=-1) → 또 캐시 미스 → 또 DB 조회 → ...
```

악의적으로 존재하지 않는 id를 대량 요청하면 DB가 모든 요청을 처리해야 합니다.

---

## 해결 1: Null 캐싱 (가장 단순)

DB에 없는 결과도 캐시에 저장합니다:

```python
CACHE_NULL = "__NULL__"  # null을 나타내는 특수 값

def get_user(user_id: int):
    cached = redis.get(f"user:{user_id}")

    if cached == CACHE_NULL:
        return None  # DB에 없음을 캐시가 알고 있음

    if cached is not None:
        return deserialize(cached)

    # DB 조회
    user = db.query(f"SELECT * FROM users WHERE id = {user_id}")

    if user is None:
        # 없는 데이터도 캐시 (단, 짧은 TTL)
        redis.setex(f"user:{user_id}", 60, CACHE_NULL)  # 60초만
        return None

    redis.setex(f"user:{user_id}", 3600, serialize(user))
    return user
```

**단점:** 공격자가 서로 다른 없는 id를 계속 시도하면 null 캐시가 메모리를 채웁니다.

---

## 해결 2: Bloom Filter (메모리 효율적 존재 확인)

DB에 있을 가능성이 없는 키는 아예 DB 조회를 하지 않습니다:

```python
from pybloom_live import BloomFilter

# 초기화: DB의 모든 유효한 user_id를 Bloom Filter에 추가
bloom = BloomFilter(capacity=10_000_000, error_rate=0.001)

def initialize_bloom_filter():
    for user_id in db.query("SELECT id FROM users"):
        bloom.add(str(user_id))

def get_user(user_id: int):
    # Bloom Filter에 없으면 DB에도 없음 (확실)
    if str(user_id) not in bloom:
        return None  # DB 조회 없이 즉시 반환

    # Bloom Filter에 있으면 DB에 있을 가능성이 높음 (False Positive 가능)
    cached = redis.get(f"user:{user_id}")
    if cached:
        return deserialize(cached)

    user = db.query(f"SELECT * FROM users WHERE id = {user_id}")
    if user:
        redis.setex(f"user:{user_id}", 3600, serialize(user))
    return user
```

**Bloom Filter 원리:**
```
해시 함수 k개로 비트 배열에 표시
조회: 모든 k개 위치에 비트가 켜져 있으면 "있을 수 있음"
       하나라도 꺼져 있으면 "확실히 없음"

False Positive: 없는데 있다고 할 수 있음 (DB 조회 1번 낭비)
False Negative: 절대 없음 (있는데 없다고 하지 않음)
```

---

## 해결 3: Redis Bloom Filter (운영 환경)

직접 구현 대신 RedisBloom 모듈 사용:

```bash
# Redis Stack 또는 RedisBloom 모듈 필요
# Docker로 실행
docker run -p 6379:6379 redis/redis-stack
```

```python
import redis

r = redis.Redis()

# Bloom Filter 생성
r.execute_command("BF.RESERVE", "user_ids", "0.001", "10000000")

# 초기 데이터 로드
for user_id in db.query("SELECT id FROM users"):
    r.execute_command("BF.ADD", "user_ids", user_id)

def get_user(user_id: int):
    # Redis Bloom Filter 확인
    exists = r.execute_command("BF.EXISTS", "user_ids", user_id)
    if not exists:
        return None

    # 이하 일반 캐시 로직
    ...

# 새 유저 생성 시 Bloom Filter에도 추가
def create_user(user_data):
    user = db.insert(user_data)
    r.execute_command("BF.ADD", "user_ids", user.id)
    return user
```

---

## Null 캐싱 vs Bloom Filter

| | Null 캐싱 | Bloom Filter |
|--|-----------|-------------|
| 구현 복잡도 | 낮음 | 중간 |
| 메모리 사용 | 공격 시 많아짐 | 고정 (1억 키 ≈ 120MB) |
| 정확도 | 정확 | False Positive 가능 |
| 새 데이터 반영 | 즉시 | 추가 필요 |
| 권장 상황 | 없는 키가 적을 때 | 대규모 공격 대비 |

---

## 실전 조합

```python
def get_user_safe(user_id: int):
    # 1. 기본 유효성 검사 (범위 밖은 즉시 거부)
    if user_id <= 0 or user_id > 10_000_000:
        return None

    # 2. Bloom Filter 확인
    if not bloom.check(str(user_id)):
        return None

    # 3. 캐시 확인
    cached = redis.get(f"user:{user_id}")
    if cached == "__NULL__":
        return None
    if cached:
        return deserialize(cached)

    # 4. DB 조회 + Null 캐싱
    user = db.find(user_id)
    if not user:
        redis.setex(f"user:{user_id}", 60, "__NULL__")
        return None

    redis.setex(f"user:{user_id}", 3600, serialize(user))
    return user
```

---

## 핵심 요약

- Cache Penetration: DB에 없는 키를 계속 조회 → 캐시 무효화 공격
- **Null 캐싱**: 없는 결과도 단기 TTL로 저장 (단순, 메모리 주의)
- **Bloom Filter**: 확실히 없는 키는 DB 조회 없이 차단 (메모리 효율적)
- False Negative 없음: Bloom Filter는 있는 키를 없다고 하지 않음
- 실무: 유효성 검사 + Bloom Filter + Null 캐싱 조합
