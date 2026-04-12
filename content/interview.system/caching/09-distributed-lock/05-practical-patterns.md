---
title: "분산 락 실전 패턴"
date: 2026-04-12
tags: [distributed-lock, redis, patterns, idempotency]
---

## 패턴 1: 멱등성 키 (중복 처리 방지)

```python
def process_payment(payment_id: str, amount: int):
    idempotency_key = f"payment:processed:{payment_id}"

    # 이미 처리됐으면 스킵
    if redis.get(idempotency_key):
        return {"status": "already_processed"}

    # 락 획득
    lock_key = f"lock:payment:{payment_id}"
    lock = DistributedLock(redis, lock_key, ttl=30)

    with lock:
        # 락 안에서 다시 확인 (double-check)
        if redis.get(idempotency_key):
            return {"status": "already_processed"}

        # 실제 결제 처리
        result = payment_gateway.charge(payment_id, amount)
        db.save_payment(payment_id, result)

        # 처리 완료 표시 (24시간 유지)
        redis.setex(idempotency_key, 86400, "1")

    return {"status": "success"}
```

---

## 패턴 2: 스케줄러 중복 실행 방지

```python
from datetime import datetime

def scheduled_job():
    job_id = f"job:daily-report:{datetime.now().strftime('%Y-%m-%d')}"

    # 오늘 이미 실행됐으면 스킵
    lock = DistributedLock(redis, job_id, ttl=3600)  # 1시간 락
    if not lock.acquire(retry=1):
        print(f"이미 실행 중 또는 완료됨: {job_id}")
        return

    try:
        generate_daily_report()
    finally:
        lock.release()
```

---

## 패턴 3: 재고 감소 (Lua로 더 효율적으로)

```python
# 락보다 Lua가 더 나은 경우
deduct_stock_script = """
local stock = tonumber(redis.call('GET', KEYS[1]) or '0')
local qty = tonumber(ARGV[1])

if stock < qty then
    return {0, stock}  -- 실패, 현재 재고
end

local new_stock = stock - qty
redis.call('SET', KEYS[1], new_stock)
return {1, new_stock}  -- 성공, 새 재고
"""

sha = redis.script_load(deduct_stock_script)

def deduct_stock(product_id: int, qty: int) -> tuple[bool, int]:
    result = redis.evalsha(sha, 1, f"stock:{product_id}", qty)
    success, remaining = result[0], result[1]
    return bool(success), remaining

# 재고 감소 + DB 업데이트는 락으로
def purchase(user_id: int, product_id: int, qty: int):
    success, remaining = deduct_stock(product_id, qty)
    if not success:
        raise InsufficientStockError(f"재고 부족 (현재: {remaining})")

    # DB 업데이트는 비동기로 (또는 보상 트랜잭션으로)
    db.create_order(user_id, product_id, qty)
```

---

## 패턴 4: 선착순 이벤트

```python
import redis

COUPON_LIMIT = 1000

def issue_coupon(user_id: int, event_id: str) -> bool:
    """선착순 1000명에게 쿠폰 발급"""
    counter_key = f"coupon:count:{event_id}"
    issued_key = f"coupon:issued:{event_id}"

    # 이미 발급받았으면 스킵
    if redis.sismember(issued_key, user_id):
        return False

    # 원자적 카운터 증가 + 한도 확인
    lua_script = """
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local user = ARGV[2]
    local issued_key = KEYS[2]

    -- 이미 발급받았으면 실패
    if redis.call('SISMEMBER', issued_key, user) == 1 then
        return 0
    end

    local count = tonumber(redis.call('GET', key) or '0')
    if count >= limit then
        return 0  -- 한도 초과
    end

    redis.call('INCR', key)
    redis.call('SADD', issued_key, user)
    return 1  -- 성공
    """

    result = redis.eval(lua_script, 2,
        counter_key, issued_key,
        COUPON_LIMIT, str(user_id)
    )

    if result == 1:
        db.save_coupon(user_id, event_id)
        return True
    return False
```

---

## 패턴 5: 분산 세마포어 (N개 동시 허용)

```python
class DistributedSemaphore:
    """최대 N개의 동시 접근 허용"""

    def __init__(self, redis_client, key: str, limit: int, ttl: int = 30):
        self.redis = redis_client
        self.key = key
        self.limit = limit
        self.ttl = ttl
        self.token = None

        self._acquire_script = self.redis.register_script("""
            local key = KEYS[1]
            local limit = tonumber(ARGV[1])
            local token = ARGV[2]
            local ttl_ms = tonumber(ARGV[3])
            local now = tonumber(ARGV[4])

            -- 만료된 토큰 정리
            redis.call('ZREMRANGEBYSCORE', key, 0, now - ttl_ms)

            local count = redis.call('ZCARD', key)
            if count >= limit then
                return 0
            end

            redis.call('ZADD', key, now, token)
            return 1
        """)

    def acquire(self) -> bool:
        import time
        self.token = str(uuid.uuid4())
        now_ms = int(time.time() * 1000)
        result = self._acquire_script(
            keys=[self.key],
            args=[self.limit, self.token, self.ttl * 1000, now_ms]
        )
        return bool(result)

    def release(self):
        if self.token:
            self.redis.zrem(self.key, self.token)

    def __enter__(self):
        if not self.acquire():
            raise LockAcquireError("세마포어 획득 실패")
        return self

    def __exit__(self, *args):
        self.release()


# 사용: 외부 API 동시 호출 3개 제한
semaphore = DistributedSemaphore(redis, "sem:external-api", limit=3)

with semaphore:
    result = external_api.call()
```

---

## 핵심 요약

- **멱등성 키**: 중복 처리 방지, 24시간 TTL로 보존
- **스케줄러 락**: 날짜별 job ID로 중복 실행 방지
- **재고 감소**: 단순 감소는 Lua가 락보다 효율적
- **선착순 이벤트**: Lua + ZSet으로 원자적 처리
- **세마포어**: N개 동시 허용, ZSet + 만료 토큰
