---
title: "Bloom Filter: 확률적 존재 확인"
date: 2026-04-12
tags: [cache, bloom-filter, probabilistic, redis]
---

## Bloom Filter란

"이 데이터가 집합에 있는가?"를 메모리 효율적으로 확인하는 확률적 자료구조입니다.

```
특성:
  "없다" → 확실히 없음 (False Negative 없음)
  "있다" → 있을 가능성이 높음 (False Positive 가능)
```

1억 개의 문자열을 ~120MB로 표현 가능 (HashSet이면 수 GB 필요).

---

## 동작 원리

```
비트 배열 + k개의 해시 함수

삽입 "apple":
  hash1("apple") % m = 3 → bit[3] = 1
  hash2("apple") % m = 7 → bit[7] = 1
  hash3("apple") % m = 11 → bit[11] = 1

조회 "apple":
  bit[3]=1, bit[7]=1, bit[11]=1 → "있을 수 있음"

조회 "mango" (삽입 안 됨):
  hash1("mango") % m = 3 → bit[3]=1 (다른 키가 설정)
  hash2("mango") % m = 5 → bit[5]=0 → "확실히 없음"
```

False Positive: bit가 모두 1이지만 실제로 없는 경우 (다른 키들의 해시 충돌).

---

## 직접 구현

```python
import hashlib
import math

class BloomFilter:
    def __init__(self, capacity: int, error_rate: float = 0.01):
        """
        capacity: 예상 원소 수
        error_rate: False Positive 비율 (0.01 = 1%)
        """
        # 최적 비트 배열 크기: m = -n * ln(p) / (ln(2))^2
        self.m = int(-capacity * math.log(error_rate) / (math.log(2) ** 2))
        # 최적 해시 함수 수: k = (m/n) * ln(2)
        self.k = int((self.m / capacity) * math.log(2))

        self.bits = bytearray(self.m // 8 + 1)

    def _hash(self, item: str, seed: int) -> int:
        h = hashlib.md5(f"{seed}:{item}".encode()).hexdigest()
        return int(h, 16) % self.m

    def _get_bit(self, pos: int) -> bool:
        return bool(self.bits[pos // 8] & (1 << (pos % 8)))

    def _set_bit(self, pos: int):
        self.bits[pos // 8] |= (1 << (pos % 8))

    def add(self, item: str):
        for seed in range(self.k):
            pos = self._hash(item, seed)
            self._set_bit(pos)

    def might_contain(self, item: str) -> bool:
        """True: 있을 수 있음, False: 확실히 없음"""
        return all(self._get_bit(self._hash(item, seed)) for seed in range(self.k))


# 사용
bf = BloomFilter(capacity=1_000_000, error_rate=0.001)  # 1% 오류율
bf.add("user:1")
bf.add("user:2")

print(bf.might_contain("user:1"))   # True (있음)
print(bf.might_contain("user:999")) # False (확실히 없음)
```

---

## 메모리 계산

```
예상 원소: 1,000,000개
오류율: 0.1% (0.001)

비트 배열 크기 m = -1M * ln(0.001) / (ln2)^2
               = -1M * (-6.908) / 0.480
               ≈ 14,377,500 bit
               ≈ 1.7 MB

해시 함수 수 k = (14.4M / 1M) * ln2 ≈ 10개
```

| 원소 수 | 오류율 | 메모리 |
|---------|--------|--------|
| 100만 | 1% | 1.1 MB |
| 1억 | 0.1% | 170 MB |
| 10억 | 1% | 1.1 GB |

---

## Redis Bloom Filter

운영 환경에서는 Redis Stack의 내장 Bloom Filter를 사용합니다:

```bash
# Redis Stack 실행
docker run -d -p 6379:6379 redis/redis-stack
```

```python
import redis

r = redis.Redis(host='localhost', port=6379)

# Bloom Filter 생성 (오류율 0.1%, 최대 1M 원소)
r.execute_command("BF.RESERVE", "bf:users", 0.001, 1_000_000)

# 데이터 추가
r.execute_command("BF.ADD", "bf:users", "user:1")
r.execute_command("BF.MADD", "bf:users", "user:2", "user:3", "user:4")

# 확인
exists = r.execute_command("BF.EXISTS", "bf:users", "user:1")  # 1 (True)
exists = r.execute_command("BF.EXISTS", "bf:users", "user:999")  # 0 (False)

# 정보 조회
info = r.execute_command("BF.INFO", "bf:users")
```

---

## Cache Penetration 방어 적용

```python
# 서비스 시작 시 Bloom Filter 초기화
def init_bloom_filter():
    user_ids = db.execute("SELECT id FROM users")
    pipeline = redis.pipeline()
    for uid in user_ids:
        pipeline.execute_command("BF.ADD", "bf:users", uid)
    pipeline.execute()

# 조회
def get_user(user_id: int) -> dict | None:
    # Bloom Filter에 없으면 DB도 없음
    if not redis.execute_command("BF.EXISTS", "bf:users", user_id):
        return None  # DB 조회 없이 즉시 반환

    # 캐시 조회 → DB 조회 (일반 흐름)
    ...

# 유저 생성 시 Bloom Filter에 추가
def create_user(data: dict) -> dict:
    user = db.insert(data)
    redis.execute_command("BF.ADD", "bf:users", user["id"])
    return user
```

---

## Bloom Filter의 한계

```
1. 삭제 불가 (기본 구현)
   → Counting Bloom Filter로 해결 (비트 대신 카운터 사용)

2. 크기 고정
   → Scalable Bloom Filter로 해결 (자동 확장)

3. 재시작 시 초기화 필요
   → Redis에 저장하면 영속화 가능
```

---

## 언제 쓰나

```
✅ Cache Penetration 방어
✅ 이메일/사용자명 중복 확인 (사전 필터)
✅ 크롤러 방문 URL 추적
✅ 악성 IP 빠른 차단
✅ 추천 시스템에서 이미 본 콘텐츠 필터링

❌ False Positive가 절대 안 되는 경우 (금융 거래)
❌ 삭제가 자주 발생하는 경우
```

---

## 핵심 요약

- Bloom Filter: 비트 배열 + k개 해시 함수
- "없다"는 확실, "있다"는 확률적 (False Positive 가능)
- 1억 원소 ≈ 120~170 MB (HashSet 대비 수십분의 1)
- Redis Stack: `BF.RESERVE`, `BF.ADD`, `BF.EXISTS`
- Cache Penetration 방어의 핵심 도구
- 삭제 불가 → Counting Bloom Filter로 해결
