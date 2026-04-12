---
title: "Lua 스크립팅과 트랜잭션"
date: 2026-04-12
tags: [redis, lua, transaction, multi, exec, atomicity]
---

## 원자적 복합 연산의 필요성

```python
# 문제: GET + SET은 원자적이지 않음
val = redis.get("count")      # 읽기
val = int(val) + 1            # 계산
redis.set("count", val)       # 쓰기

# 두 클라이언트가 동시에 실행하면 하나의 증가가 손실됨
# 해결: INCR (원자적 증가) 또는 Lua/트랜잭션
```

---

## MULTI/EXEC 트랜잭션

```bash
MULTI       # 트랜잭션 시작
SET key1 v1
INCR count
LPUSH list "item"
EXEC        # 일괄 실행
```

```python
# Python에서 트랜잭션
with redis.pipeline() as pipe:
    pipe.multi()
    pipe.set("key1", "value1")
    pipe.incr("count")
    pipe.lpush("list", "item")
    results = pipe.execute()  # [True, 1, 1]
```

**중요한 한계:**
```
MULTI/EXEC는 중간 결과를 읽을 수 없음!

❌ 불가능한 패턴:
  MULTI
  val = GET count        ← 큐에 쌓임, 값을 못 씀
  SET result (val + 1)   ← val이 없음
  EXEC
```

---

## WATCH: 낙관적 락

```python
def transfer(redis_client, from_key: str, to_key: str, amount: int):
    while True:
        try:
            redis_client.watch(from_key)  # 감시 시작

            balance = int(redis_client.get(from_key) or 0)
            if balance < amount:
                redis_client.unwatch()
                return False

            with redis_client.pipeline() as pipe:
                pipe.multi()
                pipe.decrby(from_key, amount)
                pipe.incrby(to_key, amount)
                pipe.execute()  # watch 중인 키가 변경되면 여기서 예외
            return True

        except redis.WatchError:
            # 다른 클라이언트가 from_key를 변경함 → 재시도
            continue
```

WATCH: EXEC 시점에 키가 변경되었으면 트랜잭션 취소(nil 반환).

---

## Lua 스크립팅

Lua 스크립트는 **원자적으로 실행**됩니다. 실행 중에는 다른 명령어가 끼어들 수 없습니다.

```lua
-- Redis에서 실행되는 Lua
-- KEYS[1]: 키, ARGV[1]: 증가량, ARGV[2]: 최대값

local current = redis.call('GET', KEYS[1])
current = tonumber(current) or 0

if current >= tonumber(ARGV[2]) then
    return 0  -- 한도 초과
end

redis.call('INCRBY', KEYS[1], ARGV[1])
return 1  -- 성공
```

```python
# Lua 스크립트 실행
script = """
local current = redis.call('GET', KEYS[1])
current = tonumber(current) or 0

if current >= tonumber(ARGV[2]) then
    return 0
end

redis.call('INCRBY', KEYS[1], ARGV[1])
return 1
"""

# EVALSHA로 스크립트 캐싱
sha = redis.script_load(script)
result = redis.evalsha(sha, 1, "rate:user:42", 1, 100)
# KEYS[1]="rate:user:42", ARGV[1]=1(증가량), ARGV[2]=100(한도)
```

---

## Lua로 구현하는 패턴들

### 1. Rate Limiter (슬라이딩 윈도우)

```python
rate_limit_script = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- 현재 윈도우 밖의 오래된 요청 제거
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

local count = redis.call('ZCARD', key)
if count >= limit then
    return 0  -- 제한 초과
end

redis.call('ZADD', key, now, now)
redis.call('EXPIRE', key, window)
return 1  -- 허용
"""

sha = redis.script_load(rate_limit_script)

def is_allowed(user_id: str, limit: int = 100, window: int = 60) -> bool:
    import time
    now = int(time.time() * 1000)  # milliseconds
    key = f"rate:{user_id}"
    result = redis.evalsha(sha, 1, key, limit, window * 1000, now)
    return result == 1
```

### 2. 재고 감소 (oversell 방지)

```python
deduct_stock_script = """
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[1])

if current < amount then
    return -1  -- 재고 부족
end

return redis.call('DECRBY', KEYS[1], amount)
"""

sha = redis.script_load(deduct_stock_script)

def deduct_stock(product_id: int, qty: int) -> int:
    result = redis.evalsha(sha, 1, f"stock:{product_id}", qty)
    if result == -1:
        raise InsufficientStockError()
    return result
```

---

## EVAL vs EVALSHA

```python
# EVAL: 스크립트를 매번 전송 (느림)
redis.eval(script, 1, "key", "arg1")

# EVALSHA: 스크립트를 사전 등록, SHA만 전송 (빠름)
sha = redis.script_load(script)  # 한 번만
redis.evalsha(sha, 1, "key", "arg1")  # 이후 SHA 사용
```

---

## Lua vs MULTI/EXEC 비교

| | MULTI/EXEC | Lua |
|--|-----------|-----|
| 중간 결과 읽기 | ❌ | ✅ |
| 조건부 실행 | ❌ | ✅ |
| 원자성 | ✅ | ✅ |
| 복잡도 | 낮음 | 중간 |
| 권장 상황 | 단순 배치 | 복잡한 로직 |

---

## 핵심 요약

- MULTI/EXEC: 명령어 배치 실행, 중간 결과 읽기 불가
- WATCH: 낙관적 락, 키 변경 시 트랜잭션 취소
- **Lua**: 원자적 복합 연산, 중간 결과 읽기 가능
- EVALSHA로 Lua 스크립트 캐싱 → 반복 전송 없음
- Rate Limiter, 재고 감소 등 Race Condition 방지에 필수
