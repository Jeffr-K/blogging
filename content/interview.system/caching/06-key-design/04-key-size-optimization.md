---
title: "키 크기 최적화"
date: 2026-04-12
tags: [cache, key-size, memory, redis-optimization]
---

## Redis 키의 메모리 구조

Redis는 키마다 추가 오버헤드가 있습니다:

```
키 하나의 메모리 사용:
  - 키 문자열: key_length bytes
  - Redis 내부 구조: ~50-60 bytes (dictEntry, redisObject, expiry 등)
  - 값: value_size bytes

총합: 50~60 + key_length + value_size bytes
```

```
비교:
  키 "u:42" (4 bytes)       → 총 ~54 bytes
  키 "user:42:profile" (15 bytes) → 총 ~65 bytes
  차이: 11 bytes / 54 bytes = 20%

키 1억 개라면:
  11 bytes × 1억 = 1.1 GB 차이
```

---

## 언제 최적화가 필요한가

```
키 1억 개 이상: 최적화 고려
키 1천만 개 미만: 가독성 우선
```

1억 개의 "user:42:profile" vs "u:42:p"
→ 절약: (15-5) × 1억 = 1 GB

---

## 방법 1: 접두사 약어

```python
# 원본 → 압축
"user-service:user:42:profile"       → "us:u:42:p"
"product-service:product:1001:price" → "ps:p:1001:pr"
"notification:unread:user:42"        → "n:ur:u:42"
```

팀 내 약어 사전 관리 필수:

```python
# constants.py
class CachePrefix:
    USER = "u"
    PRODUCT = "p"
    SESSION = "s"
    NOTIFICATION = "n"
    RANKING = "rk"
    FEED = "f"

class CacheField:
    PROFILE = "pr"
    PRICE = "px"
    UNREAD = "ur"
    FOLLOWERS = "fl"

# 사용
key = f"{CachePrefix.USER}:{user_id}:{CacheField.PROFILE}"
# "u:42:pr"
```

---

## 방법 2: 정수 ID 활용

문자열 ID 대신 정수 ID를 사용합니다:

```python
# UUID는 36 bytes
"session:550e8400-e29b-41d4-a716-446655440000"  # 44 bytes 키

# 정수 세션 ID로 변환
"session:7823456"  # 14 bytes → 68% 절약
```

---

## 방법 3: 값의 메모리 최적화

키보다 값이 더 큰 메모리를 차지합니다:

```python
# JSON 직렬화 (사람이 읽기 좋지만 크기 큼)
import json
data = {"user_id": 42, "name": "Alice", "email": "alice@example.com"}
json_bytes = json.dumps(data).encode()  # ~56 bytes

# MessagePack (바이너리 직렬화, 더 작음)
import msgpack
mp_bytes = msgpack.packb(data)  # ~38 bytes → 32% 절약

# 압축 (매우 큰 값에 효과적)
import gzip
compressed = gzip.compress(json_bytes)  # 큰 JSON일수록 효과적
```

---

## 방법 4: Hash 자료구조로 오버헤드 제거

여러 필드를 가진 객체를 별도 키로 나누지 말고 Hash로 묶습니다:

```python
# 나쁜 예: 키 3개 = 오버헤드 3배
redis.set("user:42:name", "Alice")
redis.set("user:42:email", "alice@example.com")
redis.set("user:42:age", "30")

# 좋은 예: Hash 하나 = 오버헤드 1번
redis.hset("user:42", mapping={
    "name": "Alice",
    "email": "alice@example.com",
    "age": "30"
})
redis.hget("user:42", "name")  # "Alice"
```

Redis Hash는 필드가 128개 이하, 각 값이 64 bytes 이하일 때 `ziplist`로 압축 저장합니다 (매우 메모리 효율적).

```bash
# Hash 인코딩 확인
redis-cli OBJECT ENCODING "user:42"
# "ziplist" (압축) or "hashtable" (일반)
```

---

## 방법 5: ziplist 임계값 조정

```bash
# redis.conf
hash-max-ziplist-entries 128  # 128개 이하면 ziplist
hash-max-ziplist-value 64     # 각 값 64 bytes 이하면 ziplist
```

Hash가 아니라도 List, Set, ZSet도 동일한 임계값이 있습니다.

---

## 메모리 분석 도구

```bash
# 전체 메모리 정보
redis-cli INFO memory

# 키별 메모리 사용량 (상위 10개)
redis-cli --bigkeys

# 특정 키 메모리 확인
redis-cli MEMORY USAGE "user:42"

# 샘플링으로 평균 키 크기 확인
redis-cli MEMORY DOCTOR
```

---

## 실전 결정 기준

```
총 키 수 < 100만:   최적화 불필요, 가독성 우선
총 키 수 < 1억:     Hash 자료구조 활용 정도
총 키 수 ≥ 1억:     접두사 약어 + MessagePack + Hash 조합
```

---

## 핵심 요약

- 키당 오버헤드 ~50 bytes: 키 길이보다 이게 더 큰 비중
- 1억 개 이상: 키 약어 + 값 직렬화(MessagePack) 고려
- Hash 자료구조: 관련 필드를 묶어 오버헤드 감소 + ziplist 압축
- `MEMORY USAGE`, `--bigkeys`로 실제 사용량 측정 후 최적화
- 최적화 전 측정, 측정 후 결정
