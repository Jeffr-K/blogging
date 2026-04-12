---
title: "분산 환경에서 무효화 전파 문제"
date: 2026-04-12
tags: [cache, invalidation, distributed, race-condition]
---

## 분산 환경의 무효화 문제

단일 서버에서는 간단한 캐시 무효화가, 여러 서버와 여러 서비스가 얽히면 복잡한 문제가 됩니다.

---

## Race Condition 시나리오

가장 흔하게 발생하는 문제입니다.

```
시나리오: Cache-Aside + 캐시 삭제 방식

T1: 스레드 A — DB에서 User(name="김철수") 읽음 (캐시 미스)
T2: 스레드 B — DB에서 User(name="김영희")로 업데이트
T3: 스레드 B — 캐시에서 user:123 삭제
T4: 스레드 A — 캐시에 User(name="김철수") 저장  ← 이미 삭제된 자리에 구 데이터 저장!

결과: 캐시에 "김철수"가 저장됨 (실제 DB는 "김영희")
     TTL 만료 전까지 틀린 데이터 노출
```

---

## 해결책 1: DB 먼저, 캐시 삭제는 나중에

```python
# 나쁜 순서:
def update_user(user_id, data):
    redis.delete(f"user:{user_id}")  # 먼저 삭제
    db.update(user_id, data)         # 그 다음 DB (Race Condition 발생 가능)

# 좋은 순서:
def update_user(user_id, data):
    db.update(user_id, data)         # DB 먼저
    redis.delete(f"user:{user_id}")  # 그 다음 캐시 삭제
```

---

## 해결책 2: 쓰기 후 지연 삭제 (Double Delete)

Race Condition을 완전히 없애기는 어렵지만 확률을 줄이는 방법:

```python
def update_user(user_id, data):
    db.update(user_id, data)
    redis.delete(f"user:{user_id}")      # 1차 삭제

    # 짧은 지연 후 한번 더 삭제 (진행 중인 읽기 요청의 캐시 쓰기 덮기)
    time.sleep(0.1)
    redis.delete(f"user:{user_id}")      # 2차 삭제 (Double Delete)
```

완벽하지는 않지만 Race Condition 시간 창을 크게 좁힙니다.

---

## 해결책 3: 낙관적 잠금 (Optimistic Locking with Version)

```python
def get_user(user_id):
    cached = redis.hgetall(f"user:{user_id}")
    if cached:
        return cached  # {"data": "...", "version": "5"}

def set_user_if_version_matches(user_id, data, expected_version):
    with redis.pipeline() as pipe:
        pipe.watch(f"user:{user_id}")
        current = pipe.hget(f"user:{user_id}", "version")

        if current and int(current) != expected_version:
            return False  # 버전 불일치 → 저장 포기

        pipe.multi()
        pipe.hset(f"user:{user_id}", mapping={
            "data": data,
            "version": expected_version + 1
        })
        pipe.execute()
        return True
```

---

## 해결책 4: CDC (Change Data Capture)

DB의 변경 로그를 직접 읽어서 캐시를 무효화하는 방식입니다. 가장 신뢰성이 높습니다.

```
DB (binlog/WAL)
    ↓
Debezium (CDC 도구)
    ↓
Kafka 메시지
    ↓
캐시 무효화 서비스
    ↓
Redis DELETE
```

- 애플리케이션 코드와 완전히 분리
- DB 변경이 반드시 캐시 무효화로 이어짐
- 단, 인프라 복잡도가 크게 올라감 (Ch.12 참고)

---

## 여러 서비스가 같은 캐시를 쓸 때

MSA 환경에서 User Service와 Order Service가 모두 `user:123` 캐시를 읽는다면:

```
User Service: user:123 업데이트 → 캐시 삭제
Order Service: user:123 캐시가 없는 줄 모르고 DB 조회 → 캐시 생성
User Service: 또 업데이트 → 캐시 삭제
→ Order Service가 만든 캐시가 반복적으로 stale 상태 발생
```

해결: **캐시 무효화를 이벤트로 발행**하고, 각 서비스가 구독해서 자신의 캐시를 정리

```python
# User Service
def update_user(user_id, data):
    db.update(user_id, data)
    kafka.publish("user.updated", {"user_id": user_id})

# Order Service (구독)
def on_user_updated(event):
    redis.delete(f"user:{event['user_id']}")
    redis.delete(f"order:user:{event['user_id']}:summary")
```

---

## 핵심 요약

- Race Condition: 캐시 삭제 후 구 데이터 재저장 문제
- DB 업데이트 → 캐시 삭제 순서가 맞아야 함
- Double Delete로 Race Condition 확률 감소
- 완전한 해결책은 CDC + 이벤트 기반 무효화
- MSA에서는 캐시 무효화를 이벤트로 발행해서 서비스 간 전파
