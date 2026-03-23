---
title: "[Redis] 13. 트랜잭션 & Lua — MULTI/EXEC, WATCH, 스크립트"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "transaction", "MULTI", "EXEC", "WATCH", "lua", "원자성"]
---

# 트랜잭션 & Lua — MULTI/EXEC, WATCH, 스크립트

## MULTI / EXEC — 트랜잭션

### 기본 개념

Redis 트랜잭션은 명령어 묶음을 원자적으로 실행. 단, 실행 중 다른 클라이언트 끼어들기 없음.

```bash
MULTI           # 트랜잭션 시작
SET foo "bar"   # 큐에 추가 (즉시 실행 아님)
INCR counter    # 큐에 추가
SET key "val"   # 큐에 추가
EXEC            # 모든 명령 순서대로 실행

# 반환: [OK, (integer) 1, OK]
```

### DISCARD — 트랜잭션 취소

```bash
MULTI
SET foo "bar"
INCR counter
DISCARD         # 큐 비우고 트랜잭션 종료
```

### 오류 처리

```bash
# 1. 큐에 추가 시 문법 오류 → 전체 EXEC 실패
MULTI
SET foo "bar"
INVALID COMMAND  # 오류
EXEC             # → 오류 반환 (명령 하나도 실행 안 됨)

# 2. 실행 시 오류 → 해당 명령만 실패, 나머지 실행
MULTI
SET foo "bar"
INCR foo         # foo는 문자열 → 실행 시 오류
SET bar "baz"
EXEC             # → [OK, (error) WRONGTYPE, OK]
                 # SET foo와 SET bar는 성공!
```

**Redis 트랜잭션은 롤백이 없다**. 실행 중 오류가 나도 나머지 명령은 계속 실행됨.

---

## WATCH — Optimistic Locking

EXEC 전에 다른 클라이언트가 특정 키를 변경하면 트랜잭션 취소.

```bash
WATCH balance:user-1001      # 감시 시작

# 현재 잔액 읽기
GET balance:user-1001        # 1000

# 트랜잭션 시작
MULTI
SET balance:user-1001 900    # 100원 차감
EXEC
# → 다른 클라이언트가 balance:user-1001을 변경했으면 nil 반환 (트랜잭션 취소)
# → 변경 없었으면 정상 실행

# WATCH 해제
UNWATCH
```

### WATCH를 활용한 낙관적 락 패턴

```kotlin
fun deductBalance(userId: Long, amount: Long): Boolean {
    return redis.execute { connection ->
        val key = "balance:$userId"

        repeat(3) {  // 최대 3번 재시도
            connection.watch(key.toByteArray())

            val balance = (connection.get(key.toByteArray())
                ?.toString(Charsets.UTF_8)?.toLong()) ?: 0L

            if (balance < amount) {
                connection.unwatch()
                return@execute false
            }

            connection.multi()
            connection.set(key.toByteArray(), (balance - amount).toString().toByteArray())
            val result = connection.exec()

            if (result != null) {
                return@execute true  // 성공
            }
            // null = WATCH 조건 실패 → 재시도
        }
        false  // 재시도 초과
    }
}
```

---

## Lua 스크립트

### 왜 Lua인가?

```
문제:
  WATCH + MULTI + EXEC는 CAS(Compare-And-Swap)로만 가능
  복잡한 조건부 로직은 여러 번 왕복 필요

Lua 스크립트:
  서버에서 원자적으로 실행
  여러 Redis 명령 + 조건 로직을 한 번에
  네트워크 왕복 1회로 복잡한 연산 처리
```

### EVAL 기본

```bash
# EVAL script numkeys [key [key ...]] [arg [arg ...]]

# 단순 예시
EVAL "return 1" 0

# Redis 명령 실행
EVAL "return redis.call('SET', KEYS[1], ARGV[1])" 1 mykey "hello"

# 여러 명령
EVAL "
  redis.call('SET', KEYS[1], ARGV[1])
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return redis.call('GET', KEYS[1])
" 1 mykey "hello" "3600"
```

### Lua API

```lua
-- Redis 명령 호출
redis.call('SET', KEYS[1], ARGV[1])   -- 오류 시 예외
redis.pcall('SET', KEYS[1], ARGV[1])  -- 오류 시 오류 반환

-- 반환 타입
return 1                   -- 정수
return "hello"             -- 벌크 문자열
return {1, 2, 3}           -- 배열
return {ok = "OK"}         -- 상태
return {err = "ERR ..."}   -- 오류
return false               -- nil
return true                -- 1
```

---

## 실용적인 Lua 스크립트 패턴

### 분산락 해제 (원자적)

```lua
-- lock:release.lua
-- 락 소유자 확인 후 삭제 (Check-and-Delete)
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
else
    return 0
end
```

```bash
EVAL "
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  else
    return 0
  end
" 1 "lock:order-123" "process-1"
```

### 재고 차감 (원자적)

```lua
-- 재고 확인 후 차감
local current = tonumber(redis.call('GET', KEYS[1]))
if current == nil then
    return {err = "KEY_NOT_FOUND"}
end
if current < tonumber(ARGV[1]) then
    return {err = "INSUFFICIENT_STOCK"}
end
redis.call('DECRBY', KEYS[1], ARGV[1])
return current - tonumber(ARGV[1])
```

```bash
EVAL "
  local current = tonumber(redis.call('GET', KEYS[1]))
  if current == nil then return redis.error_reply('KEY_NOT_FOUND') end
  if current < tonumber(ARGV[1]) then return redis.error_reply('INSUFFICIENT_STOCK') end
  return redis.call('DECRBY', KEYS[1], ARGV[1])
" 1 "stock:product-123" "5"
```

### 슬라이딩 윈도우 Rate Limit

```lua
local key = KEYS[1]
local now = tonumber(ARGV[1])        -- 현재 시각 (ms)
local window = tonumber(ARGV[2])     -- 윈도우 크기 (ms)
local limit = tonumber(ARGV[3])      -- 최대 요청 수
local req_id = ARGV[4]               -- 고유 요청 ID

-- 윈도우 밖 항목 제거
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

-- 현재 요청 수
local count = redis.call('ZCARD', key)

if count >= limit then
    return 0  -- 거부
end

-- 요청 추가
redis.call('ZADD', key, now, req_id)
redis.call('EXPIRE', key, math.ceil(window / 1000))
return 1  -- 허용
```

### 캐시 SET with 조건

```lua
-- 캐시 값이 없거나 다를 때만 업데이트 + TTL 설정
local current = redis.call('GET', KEYS[1])
if current == ARGV[1] then
    -- 값이 같으면 TTL만 갱신
    redis.call('EXPIRE', KEYS[1], ARGV[2])
    return 0
else
    redis.call('SET', KEYS[1], ARGV[1])
    redis.call('EXPIRE', KEYS[1], ARGV[2])
    return 1
end
```

---

## EVALSHA — 스크립트 캐싱

```bash
# 스크립트를 서버에 미리 로드 (SHA1 반환)
SCRIPT LOAD "return redis.call('GET', KEYS[1])"
# → "e0e1f9fabfa9d353e29a2f6f4e1f6e6a5e5a1b9d"

# SHA1로 실행 (스크립트 전송 없이)
EVALSHA e0e1f9fabfa9d353e29a2f6f4e1f6e6a5e5a1b9d 1 mykey

# 캐시된 스크립트 목록 확인
SCRIPT EXISTS sha1 sha2

# 캐시 비우기
SCRIPT FLUSH
SCRIPT FLUSH ASYNC
```

---

## Redis Functions (Redis 7.0+)

EVALSHA의 발전형. 서버에 영속적으로 저장되는 함수.

```bash
# 함수 라이브러리 등록
FUNCTION LOAD "#!lua name=mylib\n
  local function my_get(keys, args)
    return redis.call('GET', keys[1])
  end
  redis.register_function('my_get', my_get)
"

# 함수 호출
FCALL my_get 1 mykey

# 함수 목록
FUNCTION LIST
FUNCTION STATS
FUNCTION DELETE mylib
```

---

## 정리

| 기능 | 명령어 | 특징 |
|------|--------|------|
| 트랜잭션 | MULTI/EXEC | 원자적 실행, 롤백 없음 |
| 취소 | DISCARD | 큐 비우기 |
| 낙관적 락 | WATCH | 키 변경 시 트랜잭션 취소 |
| Lua 스크립트 | EVAL | 서버 측 원자적 실행, 복잡한 로직 |
| 스크립트 캐싱 | EVALSHA | SHA1로 스크립트 재사용 |
| 영속 함수 | FCALL | Redis 7.0+, 서버에 저장 |

- 간단한 원자성: MULTI/EXEC
- 조건부 원자성: WATCH + MULTI/EXEC
- 복잡한 원자성: Lua (EVAL/EVALSHA)
