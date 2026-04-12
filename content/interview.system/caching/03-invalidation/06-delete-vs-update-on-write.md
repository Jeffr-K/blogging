---
title: "Delete on Write vs Update on Write: 왜 삭제가 더 안전한가"
date: 2026-04-12
tags: [cache, invalidation, delete, update]
---

## 핵심 질문

DB 데이터를 변경할 때 캐시를 어떻게 처리할까?

```
Option A: 캐시를 새 값으로 업데이트
Option B: 캐시를 삭제 (다음 읽기에서 DB에서 가져옴)
```

**권장: Option B (삭제)**

왜 삭제가 더 안전한지 알아봅니다.

---

## 업데이트 방식의 Race Condition

```
상황: 두 스레드가 동시에 같은 유저를 업데이트

스레드 A: user.name = "김철수"로 업데이트
스레드 B: user.name = "박지성"로 업데이트 (A보다 늦게 시작)

정상적인 예상:
  DB: "박지성" (나중 값)
  캐시: "박지성" (나중 값)

실제 발생 가능한 상황:
T1: A — DB 업데이트 ("김철수")
T2: B — DB 업데이트 ("박지성")
T3: B — 캐시 업데이트 ("박지성")
T4: A — 캐시 업데이트 ("김철수")  ← 늦게 도착한 A가 B를 덮어씀!

결과: DB="박지성", 캐시="김철수" → 불일치!
```

---

## 삭제 방식은 왜 안전한가

```
T1: A — DB 업데이트 ("김철수")
T2: B — DB 업데이트 ("박지성")
T3: B — 캐시 삭제
T4: A — 캐시 삭제 (이미 없어도 OK)

결과: DB="박지성", 캐시=없음
다음 읽기: DB에서 "박지성" 가져와서 캐시 저장 → 일치!
```

삭제는 **멱등(Idempotent)** 합니다. 몇 번을 삭제해도 결과가 같습니다.

```python
# 여러 번 삭제해도 문제 없음
redis.delete("user:123")  # OK
redis.delete("user:123")  # OK (없어도 에러 아님)
```

업데이트는 순서에 따라 다른 결과가 나오는 **비멱등** 연산입니다.

---

## 예외: 업데이트가 나은 경우

**쓰고 바로 읽는 패턴(Write-Through)에서는 업데이트가 더 효율적입니다.**

```python
def update_user_profile(user_id, data):
    user = db.update(user_id, data)

    # 삭제하면 다음 읽기에서 Cold Miss 발생
    # → 사용자 경험: 수정 후 프로필 로드가 느림

    # 업데이트하면 즉시 캐시 HIT
    redis.set(f"user:{user_id}", user.to_json(), ex=300)
```

단, 이 경우에도 **Race Condition 가능성을 인지**해야 합니다. 동시 수정이 없는 단순한 경우에만 적용합니다.

---

## 실무 판단 기준

```
동시 수정 가능성이 있다        → 무조건 삭제
단일 작업 쓰기 (동시성 없음)  → 업데이트 가능
Write-Back 패턴               → 캐시에만 씀 (DB 나중에)
Write-Through 패턴            → 업데이트 (빠른 읽기 위해)
```

---

## 코드로 정리

```python
# ❌ 업데이트 방식 (Race Condition 위험)
def update_user(user_id, data):
    db.update(user_id, data)
    user = db.find(user_id)
    redis.set(f"user:{user_id}", user.to_json(), ex=300)  # 위험

# ✅ 삭제 방식 (안전)
def update_user(user_id, data):
    db.update(user_id, data)
    redis.delete(f"user:{user_id}")  # 다음 읽기가 DB에서 가져옴

# ✅ 업데이트 방식 (단순한 경우, 성능 우선)
@CachePut("users")  # Spring이 원자적으로 처리
def update_user(user_id, data):
    return userRepo.save(data)  # 반환값이 자동으로 캐시에 저장
```

---

## 핵심 요약

- 업데이트 방식: 순서 역전 시 Race Condition → stale 데이터
- 삭제 방식: 멱등 → 순서 무관하게 안전
- 기본값은 삭제, 단순한 단일 작업에서만 업데이트 고려
- Facebook, Twitter 등 대형 서비스 대부분이 삭제 방식 사용
