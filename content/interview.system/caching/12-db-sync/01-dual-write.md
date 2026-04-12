---
title: "Dual Write: DB와 캐시 동시 쓰기의 문제"
date: 2026-04-12
tags: [cache, dual-write, consistency, db-sync]
---

## Dual Write란

DB와 캐시에 동시에 쓰는 패턴입니다.

```python
def update_user(user_id: int, data: dict):
    db.update(user_id, data)          # DB 업데이트
    redis.setex(f"user:{user_id}", 3600, serialize(data))  # 캐시 업데이트
```

단순해 보이지만 여러 문제가 있습니다.

---

## 문제 1: 부분 실패

```
DB 업데이트 성공 → 캐시 업데이트 실패
→ DB: 신버전, 캐시: 구버전 → 불일치
→ TTL 만료까지 구버전 제공
```

```python
def update_user_unsafe(user_id: int, data: dict):
    db.update(user_id, data)  # 성공

    # 네트워크 오류, Redis 다운 등
    redis.setex(f"user:{user_id}", 3600, serialize(data))  # 실패!
    # → DB와 캐시 불일치 상태
```

---

## 문제 2: 순서 역전

```
두 요청이 동시에 실행:
  Request-A: name = "Alice"
  Request-B: name = "Alice K"

DB 순서:  A → B (최종: "Alice K") ✅
캐시 순서: B → A (최종: "Alice") ❌  ← 순서 역전
```

---

## 해결 1: 캐시 삭제 (업데이트 대신)

```python
def update_user_safe(user_id: int, data: dict):
    db.update(user_id, data)
    redis.delete(f"user:{user_id}")  # 업데이트 대신 삭제
    # 다음 조회 시 DB에서 최신 데이터 읽어서 캐시 재생성
```

**왜 삭제가 더 안전한가:**
- 순서 역전 문제 없음 (덮어쓰기가 없으므로)
- 부분 실패해도 다음 조회 시 DB에서 최신 데이터 로딩
- 단, 캐시 미스 증가 (일시적 DB 부하)

---

## 해결 2: 트랜잭션 + 보상

```python
from contextlib import contextmanager

@contextmanager
def db_transaction():
    conn = db.begin()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise

def update_user_with_compensation(user_id: int, data: dict):
    old_data = redis.get(f"user:{user_id}")  # 롤백용 백업

    with db_transaction():
        db.update(user_id, data)

    # DB 성공 후 캐시 업데이트
    try:
        redis.delete(f"user:{user_id}")
    except redis.RedisError:
        # 캐시 실패는 무시 (DB가 진실의 원천)
        # 다음 조회 시 DB에서 다시 로딩
        pass
```

---

## 해결 3: Write-Through (캐시가 DB 대신 쓰기)

```python
class WriteThroughCache:
    def set(self, key: str, value, ttl: int):
        # DB 먼저
        db_key = self._parse_db_key(key)
        db.upsert(db_key, value)

        # DB 성공 후 캐시
        redis.setex(key, ttl, serialize(value))
```

Write-Through는 DB와 캐시를 항상 동기화하지만, 쓰기 지연이 2배입니다.

---

## 문제 3: 분산 환경에서의 경쟁

```
Server-1: DB 업데이트(A) → 캐시 삭제
Server-2: 캐시 미스 → DB 읽기(A) → 캐시 저장(A)
Server-1: 캐시 삭제 완료
Server-3: DB 업데이트(B) → 캐시 삭제
Server-2: 캐시 저장(A) 완료  ← B가 덮어써져야 하는데 A가 저장됨!
```

**Double Delete 패턴으로 해결:**
```python
def update_with_double_delete(user_id: int, data: dict):
    redis.delete(f"user:{user_id}")   # 1차 삭제
    db.update(user_id, data)
    redis.delete(f"user:{user_id}")   # 2차 삭제 (DB 완료 후)
    # 또는 짧은 딜레이 후 삭제
```

---

## 실무 권장 패턴

```
1. 단순 케이스:
   DB 업데이트 → 캐시 DELETE (업데이트 아닌 삭제)

2. 일관성 중요:
   DB 업데이트 → 이벤트 발행 → 비동기 캐시 무효화
   (다음 글의 CDC/Outbox 패턴)

3. 쓰기 성능 중요:
   Write-Back (캐시 먼저, 비동기 DB 반영)
   → 데이터 손실 위험 있음
```

---

## 핵심 요약

- Dual Write: DB + 캐시 동시 쓰기 → 부분 실패, 순서 역전 위험
- **캐시 삭제**: 업데이트보다 안전 (순서 역전 없음)
- 캐시 실패는 무시해도 됨 (DB가 진실의 원천)
- Double Delete: 경쟁 조건 최소화
- 높은 일관성 필요 시 CDC/Outbox 패턴 사용
