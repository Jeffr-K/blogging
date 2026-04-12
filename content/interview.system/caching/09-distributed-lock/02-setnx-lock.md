---
title: "SETNX로 분산 락 구현"
date: 2026-04-12
tags: [distributed-lock, setnx, redis, atomic]
---

## SETNX 기본

**SETNX** = SET if Not eXists: 키가 없을 때만 설정합니다.

```bash
SETNX lock:resource "owner1"  # 성공: 1, 실패: 0 (이미 있음)
```

---

## 안전한 락 구현

### 잘못된 구현 1: SETNX + EXPIRE 분리

```python
# 위험! 두 명령어 사이에 크래시 발생 시 락 영원히 남음
redis.setnx("lock:resource", "owner")
redis.expire("lock:resource", 10)  ← 이 사이에 서버 죽으면?
```

### 잘못된 구현 2: 값 없이 락

```python
# 위험! 내가 획득한 락인지 확인 불가
redis.setnx("lock:resource", 1)
# ... 작업 ...
redis.delete("lock:resource")  ← 남의 락을 삭제할 수 있음
```

---

## 올바른 구현

```python
import uuid
import time
import redis

r = redis.Redis()

class DistributedLock:
    def __init__(self, redis_client, key: str, ttl: int = 10):
        self.redis = redis_client
        self.key = key
        self.ttl = ttl
        self.token = None

        # Lua 스크립트: 원자적 해제
        self._release_script = self.redis.register_script("""
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('DEL', KEYS[1])
            else
                return 0
            end
        """)

    def acquire(self, retry: int = 3, retry_delay: float = 0.1) -> bool:
        """락 획득 시도"""
        self.token = str(uuid.uuid4())

        for attempt in range(retry):
            # SET key token NX EX ttl (원자적)
            result = self.redis.set(
                self.key,
                self.token,
                nx=True,    # Not eXists: 없을 때만
                ex=self.ttl # EXpiry: TTL 동시 설정
            )
            if result:
                return True

            if attempt < retry - 1:
                time.sleep(retry_delay)

        return False

    def release(self) -> bool:
        """락 해제 (내 토큰일 때만)"""
        if self.token is None:
            return False
        result = self._release_script(keys=[self.key], args=[self.token])
        self.token = None
        return bool(result)

    def __enter__(self):
        if not self.acquire():
            raise LockAcquireError(f"락 획득 실패: {self.key}")
        return self

    def __exit__(self, *args):
        self.release()


class LockAcquireError(Exception):
    pass


# 사용
def process_order(order_id: int, product_id: int, qty: int):
    lock = DistributedLock(r, f"lock:stock:{product_id}", ttl=30)

    with lock:
        # 재고 확인 및 감소 (원자적으로 처리)
        stock = int(r.get(f"stock:{product_id}") or 0)
        if stock < qty:
            raise InsufficientStockError()
        r.decrby(f"stock:{product_id}", qty)
        db.create_order(order_id, product_id, qty)
```

---

## 핵심: 왜 Lua로 해제하나

```python
# 잘못된 해제
if redis.get("lock:resource") == my_token:  # 1. GET
    redis.delete("lock:resource")            # 2. DEL

# 문제:
# 1과 2 사이에 TTL이 만료될 수 있음
# → 다른 클라이언트가 락 획득
# → 내가 남의 락을 DEL
```

```lua
-- Lua로 원자적 해제 (중간에 끼어들 수 없음)
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
else
    return 0
end
```

---

## TTL 설계

```python
# TTL은 작업 예상 시간보다 충분히 길게
# 단, 너무 길면 장애 시 복구가 늦음

# 일반 DB 조회: 1~5초
lock_ttl = 10  # 10초 (여유 있게)

# 긴 작업 (이미지 처리): 30~60초
lock_ttl = 120  # 2분

# Watchdog 패턴으로 자동 연장도 가능 (다음 글)
```

---

## 락 대기 전략

```python
import random

def acquire_with_backoff(redis_client, key: str, ttl: int, max_retries: int = 10):
    token = str(uuid.uuid4())
    base_delay = 0.01  # 10ms

    for i in range(max_retries):
        if redis_client.set(key, token, nx=True, ex=ttl):
            return token

        # Exponential backoff + jitter
        delay = base_delay * (2 ** i) + random.uniform(0, 0.01)
        time.sleep(min(delay, 1.0))  # 최대 1초

    return None  # 획득 실패
```

---

## 핵심 요약

- `SET key token NX EX ttl`: 원자적 락 획득 (SETNX + EXPIRE 분리 금지)
- UUID 토큰: 내가 획득한 락인지 식별
- Lua 스크립트로 원자적 해제: GET + DEL 사이 경쟁 방지
- TTL: 작업 시간보다 충분히 길게 설정
- 재시도: Exponential backoff + jitter
