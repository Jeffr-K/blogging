---
title: "캐시 Race Condition 시나리오"
date: 2026-04-12
tags: [cache, race-condition, consistency, concurrency]
---

## 시나리오 1: ABA 문제

```
T=1: Thread-A가 DB에서 "Alice" 읽음 (캐시 미스)
T=2: Thread-B가 DB 업데이트 → "Alice K"
T=3: Thread-B가 캐시 삭제
T=4: Thread-A가 캐시에 "Alice" 저장  ← 구버전!

결과: DB = "Alice K", 캐시 = "Alice" (불일치)
```

**해결:**
```python
# Double Delete: 쓰기 전후로 캐시 삭제
def update_user(user_id: int, data: dict):
    redis.delete(f"user:{user_id}")  # 1차 삭제
    db.update(user_id, data)
    time.sleep(0.05)  # 진행 중인 읽기-캐시저장 완료 대기
    redis.delete(f"user:{user_id}")  # 2차 삭제
```

---

## 시나리오 2: 캐시 저장 순서 역전

```
T=1: Request-A: DB 읽기 → "Alice"
T=2: Request-B: DB 업데이트 → "Alice K"
T=3: Request-B: 캐시 삭제
T=4: Request-B: 캐시에 "Alice K" 저장
T=5: Request-A: 캐시에 "Alice" 저장  ← B를 덮어씀!

결과: 캐시 = "Alice" (구버전)
```

**해결: 캐시 업데이트 대신 삭제만**
```python
# 쓰기 시 저장하지 않고 삭제만
def update_user(user_id: int, data: dict):
    db.update(user_id, data)
    redis.delete(f"user:{user_id}")
    # 다음 읽기 시 DB에서 최신값 로딩

# 읽기 시 캐시 저장은 안전 (항상 DB 값 기준)
def get_user(user_id: int):
    cached = redis.get(f"user:{user_id}")
    if cached:
        return deserialize(cached)
    user = db.find_user(user_id)
    redis.setex(f"user:{user_id}", 3600, serialize(user))
    return user
```

---

## 시나리오 3: 동시 캐시 채우기 (Stampede)

```
캐시 미스 상황에서 100개의 요청이 동시에 DB 쿼리
→ DB 과부하

T=0: 100개 요청이 캐시 미스
T=0: 100개 요청이 모두 DB 쿼리
T=1: 100개 응답 → 모두 캐시 저장 시도 (중복)
```

**해결: 분산 락 또는 Promise 패턴**
```python
_loading: dict = {}
_loading_lock = threading.Lock()

def get_user_safe(user_id: int):
    key = f"user:{user_id}"
    cached = redis.get(key)
    if cached:
        return deserialize(cached)

    with _loading_lock:
        if key in _loading:
            # 다른 스레드가 로딩 중 → 기다림
            future = _loading[key]
        else:
            future = threading.Event()
            _loading[key] = future
            need_load = True

    if need_load:
        try:
            user = db.find_user(user_id)
            redis.setex(key, 3600, serialize(user))
            return user
        finally:
            with _loading_lock:
                del _loading[key]
            future.set()
    else:
        future.wait(timeout=5)
        return deserialize(redis.get(key))
```

---

## 시나리오 4: 만료 체크와 삭제 사이

```
T=0: 캐시 TTL 1초 남음
T=1: Thread-A: 캐시 유효 확인 (아직 있음)
T=1: TTL 만료 → 캐시 자동 삭제
T=2: Thread-B: 캐시 미스 → DB 읽기 → 캐시 저장
T=2: Thread-A: 캐시 삭제 명령 실행 → 새 캐시 삭제!
```

**해결: Lua 스크립트로 원자적 처리**
```lua
-- 확인과 삭제를 원자적으로
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
```

---

## 시나리오 5: 캐시 만료 중 DB 쓰기

```
T=0: 캐시 미스
T=1: Thread-A: DB 읽기 시작
T=2: DB 업데이트 (새 값)
T=3: Thread-A: DB 읽기 완료 (구버전 읽음)
T=4: Thread-A: 구버전을 캐시에 저장 ← 문제!
```

**해결: 버전 확인 후 저장**
```python
def get_user_versioned(user_id: int):
    key = f"user:{user_id}"
    version_key = f"user:{user_id}:version"

    before_version = redis.get(version_key)
    user = db.find_user(user_id)
    after_version = redis.get(version_key)

    # 읽는 동안 버전이 바뀌지 않았을 때만 캐시 저장
    if before_version == after_version:
        redis.setex(key, 3600, serialize(user))

    return user
```

---

## 핵심 요약

- ABA: 읽기-업데이트 사이 구버전 캐시 저장 → Double Delete
- 순서 역전: 쓰기 시 캐시 저장 말고 삭제만 → 읽기 시 저장
- Stampede: 동시 캐시 미스 → 분산 락 또는 Promise 패턴
- 원자성: Lua로 체크-삭제 원자적 처리
- 버전: 읽기 중 업데이트 감지 후 조건부 캐시 저장
