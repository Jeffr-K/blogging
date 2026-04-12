---
title: "SCAN과 Keyspace Notification"
date: 2026-04-12
tags: [redis, scan, keyspace-notification, pubsub]
---

## KEYS vs SCAN

```bash
# KEYS: 절대 운영에서 사용 금지
KEYS *           # O(n), 전체 블록
KEYS "user:*"    # O(n)

# SCAN: 반복 커서 기반, 블록하지 않음
SCAN 0 MATCH "user:*" COUNT 100
```

**SCAN 동작:**
```
SCAN cursor [MATCH pattern] [COUNT count] [TYPE type]

반환: [다음 커서, 키 목록]
cursor=0이 반환되면 완전히 순회 완료
COUNT는 "대략 이 정도"의 힌트 (정확한 보장 아님)
```

---

## SCAN 사용법

```python
def scan_all_keys(redis_client, pattern: str = "*") -> list[str]:
    """모든 키를 블록 없이 순회"""
    keys = []
    cursor = 0
    while True:
        cursor, batch = redis_client.scan(
            cursor=cursor,
            match=pattern,
            count=100    # 한 번에 약 100개씩
        )
        keys.extend(batch)
        if cursor == 0:
            break
    return keys

# 사용
all_user_keys = scan_all_keys(redis, "user:*")
```

```python
# 생성기로 메모리 효율적 처리
def scan_keys_gen(redis_client, pattern: str = "*"):
    cursor = 0
    while True:
        cursor, batch = redis_client.scan(cursor, match=pattern, count=100)
        yield from batch
        if cursor == 0:
            break

# 키를 즉시 처리 (전체 로딩 없음)
for key in scan_keys_gen(redis, "session:*"):
    ttl = redis.ttl(key)
    if ttl == -1:  # TTL 없는 세션 발견
        redis.expire(key, 86400)  # 24시간 설정
```

---

## 자료구조별 SCAN

```bash
# Hash 필드 스캔
HSCAN user:42 0 MATCH "addr*" COUNT 10

# Set 멤버 스캔
SSCAN followers:42 0 COUNT 100

# ZSet 멤버 스캔
ZSCAN ranking 0 MATCH "user:*" COUNT 100
```

```python
# 큰 Hash에서 특정 필드만 가져오기
cursor = 0
while True:
    cursor, items = redis.hscan("big:hash", cursor, match="field:*", count=100)
    for field, value in zip(items[::2], items[1::2]):
        process(field, value)
    if cursor == 0:
        break
```

---

## Keyspace Notification

Redis에서 이벤트 발생 시 Pub/Sub 채널로 알림을 받습니다.

```bash
# redis.conf 또는 CONFIG SET
notify-keyspace-events "KEA"
# K: keyspace 이벤트
# E: keyevent 이벤트
# A: 모든 이벤트 (g$lszxe의 alias)
# x: 만료 이벤트만
# d: 삭제 이벤트
```

**이벤트 유형:**
```
g   일반 명령어 (DEL, EXPIRE 등)
$   String 명령어
l   List 명령어
s   Set 명령어
z   ZSet 명령어
x   만료 이벤트
d   모듈 이벤트
```

---

## Keyspace Notification 구독

```python
import redis
import threading

r = redis.Redis()
pubsub = r.pubsub()

# 채널 구독 방식 1: keyevent (이벤트 타입별)
# expired: 키가 만료될 때
pubsub.subscribe("__keyevent@0__:expired")

# 채널 구독 방식 2: keyspace (키별)
# 특정 키에 대한 모든 이벤트
pubsub.subscribe("__keyspace@0__:user:42")

def listen_events():
    for message in pubsub.listen():
        if message["type"] == "message":
            channel = message["channel"].decode()
            data = message["data"].decode()
            print(f"이벤트: {channel} → {data}")

thread = threading.Thread(target=listen_events, daemon=True)
thread.start()
```

---

## 실용 패턴: 만료 시 후처리

```python
# 세션 만료 시 후처리
r.config_set("notify-keyspace-events", "Kx")  # 만료 이벤트 활성화

pubsub = r.pubsub()
pubsub.psubscribe("__keyevent@0__:expired")

def handle_expiry(message):
    if message["type"] != "pmessage":
        return
    expired_key = message["data"].decode()

    if expired_key.startswith("session:"):
        session_id = expired_key[len("session:"):]
        # 세션 만료 처리 (DB에 로그아웃 기록)
        db.record_logout(session_id)

    elif expired_key.startswith("lock:"):
        lock_key = expired_key[len("lock:"):]
        # 락 만료 알림 (Watchdog 패턴)
        alert_lock_expired(lock_key)

for message in pubsub.listen():
    handle_expiry(message)
```

---

## 주의사항

```
1. 성능 영향
   notify-keyspace-events 활성화 시 CPU 사용 증가 (~10%)
   필요한 이벤트만 활성화 (KEA 대신 Kx 등)

2. 신뢰성
   Redis Pub/Sub는 at-most-once (유실 가능)
   중요한 이벤트는 Stream 사용 권장

3. 만료 정확도
   키가 실제로 만료되어 접근될 때 알림
   EXPIRE 시간 정각이 아닐 수 있음 (lazy deletion)
```

---

## 핵심 요약

- **KEYS**: O(n) 전체 블록, 운영에서 절대 금지
- **SCAN**: 커서 기반 반복, 블록 없음, 대신 사용
- HSCAN/SSCAN/ZSCAN: 자료구조 내부 반복
- **Keyspace Notification**: 키 만료/변경 이벤트를 Pub/Sub으로 수신
- `notify-keyspace-events "Kx"`: 만료 이벤트만 활성화 (성능 균형)
