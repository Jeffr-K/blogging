---
title: "Read-Your-Writes: 내가 쓴 것은 내가 읽는다"
date: 2026-04-12
tags: [cache, consistency, read-your-writes, session]
---

## 문제

```
시나리오:
  사용자가 프로필 이름을 "Alice" → "Alice K" 로 변경
  → DB 업데이트 + 캐시 삭제

  즉시 프로필 페이지로 이동
  → 캐시 미스 → DB 읽기 → 캐시 저장

정상처럼 보이지만:
  로드밸런서가 다른 서버로 요청 라우팅
  Server-2에는 아직 구버전 캐시 있음
  → "Alice" 표시 (방금 바꿨는데?)
```

사용자는 "내가 방금 바꿨는데 왜 구버전이 보여?"라고 느낍니다.

---

## 해결 1: 스티키 세션

같은 사용자의 요청을 항상 같은 서버로 라우팅합니다.

```nginx
upstream backend {
    ip_hash;  # 클라이언트 IP로 서버 고정
    server backend1:8080;
    server backend2:8080;
    server backend3:8080;
}
```

**단점:** 서버 장애 시 해당 사용자 세션 끊김

---

## 해결 2: 쓰기 후 캐시 직접 업데이트

```python
def update_profile(user_id: int, data: dict):
    db.update(user_id, data)

    # 삭제 대신 즉시 새 값으로 캐시 업데이트
    redis.setex(f"user:{user_id}", 3600, serialize(data))
    # 어느 서버에서 읽어도 새 값을 봄
```

**문제:** 순서 역전, Race Condition 위험 (앞 글에서 다룸)

---

## 해결 3: 버전 토큰

쓰기 후 버전을 세션에 저장하고, 읽기 시 버전 확인:

```python
def update_profile(user_id: int, data: dict, session: dict):
    db.update(user_id, data)
    redis.delete(f"user:{user_id}")

    # 버전 증가 + 세션에 저장
    new_version = redis.incr(f"user:{user_id}:version")
    session["user_version"] = new_version

def get_profile(user_id: int, session: dict):
    required_version = session.get("user_version", 0)
    current_version = int(redis.get(f"user:{user_id}:version") or 0)

    if current_version < required_version:
        # 아직 내가 쓴 버전이 캐시에 없음 → DB에서 직접
        return db.find_user(user_id)

    cached = redis.get(f"user:{user_id}")
    if cached:
        return deserialize(cached)

    user = db.find_user(user_id)
    redis.setex(f"user:{user_id}", 3600, serialize(user))
    return user
```

---

## 해결 4: 쓰기 후 짧은 시간 DB에서 읽기

가장 단순한 방법: 업데이트 직후 N초간 캐시 무시:

```python
def update_profile(user_id: int, data: dict, session: dict):
    db.update(user_id, data)
    redis.delete(f"user:{user_id}")

    # 세션에 "방금 업데이트했음" 표시 + 시각
    session["updated_at"] = time.time()
    session["updated_user_id"] = user_id

def get_profile(user_id: int, session: dict):
    # 방금 이 유저를 업데이트한 경우 → DB에서 직접 읽기
    updated_at = session.get("updated_at", 0)
    updated_user = session.get("updated_user_id")

    if updated_user == user_id and time.time() - updated_at < 5:
        # 5초간 DB에서 직접 (캐시 우회)
        return db.find_user(user_id)

    return get_from_cache_or_db(user_id)
```

---

## Read-Your-Writes가 중요한 케이스

```
중요:
  - 프로필 수정 후 즉시 확인
  - 게시글 작성 후 목록 조회
  - 결제 완료 후 주문 내역 조회

덜 중요:
  - 좋아요 수 (1~2초 뒤에 반영돼도 OK)
  - 다른 사람의 프로필 보기
  - 랭킹
```

---

## 핵심 요약

- Read-Your-Writes: 내가 쓴 것은 즉시 내가 읽을 수 있어야 함
- 원인: 다른 서버의 구버전 캐시, 복제 지연
- **스티키 세션**: 같은 서버로 고정 (서버 장애 취약)
- **즉시 캐시 업데이트**: Race Condition 주의
- **버전 토큰**: 내 버전 이상일 때만 캐시 사용
- **일시적 DB 직접 읽기**: 업데이트 후 N초간 캐시 우회
