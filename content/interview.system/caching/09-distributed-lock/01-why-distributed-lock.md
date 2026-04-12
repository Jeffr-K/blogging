---
title: "분산 락이 필요한 이유"
date: 2026-04-12
tags: [distributed-lock, concurrency, race-condition, redis]
---

## 단일 서버에서의 락

```python
import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    with lock:  # 로컬 락으로 충분
        counter += 1
```

단일 프로세스에서는 OS의 뮤텍스/세마포어로 해결됩니다.

---

## 분산 환경에서의 문제

```
서버 3대가 같은 작업을 동시에 실행:

Server-1: 재고 확인 → 10개 있음 → 주문 처리 시작
Server-2: 재고 확인 → 10개 있음 → 주문 처리 시작  ← 동시에!
Server-3: 재고 확인 → 10개 있음 → 주문 처리 시작  ← 동시에!

결과: 재고 10개인데 30개 주문 처리 (oversell)
```

각 서버의 로컬 락은 다른 서버 프로세스에 영향을 줄 수 없습니다.

---

## 분산 락이 필요한 상황

```
1. 중복 실행 방지
   - 스케줄러 작업이 여러 서버에서 동시 실행되면 안 될 때
   - 쿠폰 발급, 포인트 적립 중복 방지

2. 공유 자원 접근 제어
   - 재고 감소 (oversell 방지)
   - 한정 수량 이벤트

3. 순서 보장
   - 순차적으로 처리해야 하는 작업
   - 상태 머신 전이
```

---

## 잘못된 해결책: DB 락

```sql
-- Pessimistic Lock
BEGIN;
SELECT * FROM products WHERE id = 1 FOR UPDATE;
UPDATE products SET stock = stock - 1 WHERE id = 1;
COMMIT;
```

**문제점:**
- DB 연결 수 = 동시 접근 가능한 스레드 수
- 락 대기 중 DB 연결을 점유 → DB 커넥션 풀 고갈
- 성능 병목

---

## Redis 분산 락의 장점

```
Redis:
  - 인메모리 → 락 획득/해제가 마이크로초 단위
  - SETNX (SET if Not eXists): 원자적 락 획득
  - TTL: 락 홀더가 죽어도 자동 만료 (데드락 방지)
  - 단일 스레드: 경쟁 조건 없음
```

---

## 분산 락의 세 가지 속성

```
1. 상호 배제 (Mutual Exclusion)
   동시에 하나의 클라이언트만 락 보유

2. 데드락 방지 (Deadlock Freedom)
   락 홀더가 죽어도 결국 락이 해제됨 (TTL)

3. 내결함성 (Fault Tolerance)
   일부 Redis 노드가 다운되어도 락 기능 유지
```

---

## 기본 구현 미리보기

```python
import uuid
import redis

r = redis.Redis()

def acquire_lock(key: str, ttl: int = 10) -> str | None:
    """락 획득. 성공 시 토큰 반환, 실패 시 None"""
    token = str(uuid.uuid4())
    acquired = r.set(key, token, nx=True, ex=ttl)
    return token if acquired else None

def release_lock(key: str, token: str) -> bool:
    """자신이 획득한 락만 해제 (Lua로 원자적 실행)"""
    script = """
    if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
    else
        return 0
    end
    """
    result = r.eval(script, 1, key, token)
    return result == 1
```

---

## 핵심 요약

- 단일 서버: OS 락으로 충분
- 분산 환경: 여러 서버 간 공유 자원 접근 → 분산 락 필요
- 대표 사례: 재고 감소, 중복 실행 방지, 한정 수량 이벤트
- DB Pessimistic Lock: 커넥션 고갈 위험
- Redis 분산 락: 빠른 속도, TTL로 데드락 방지
- 필수 속성: 상호 배제 + 데드락 방지 + 내결함성
