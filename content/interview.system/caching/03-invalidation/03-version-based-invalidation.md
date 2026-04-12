---
title: "버전 기반 무효화: 키에 버전을 박는다"
date: 2026-04-12
tags: [cache, invalidation, versioning]
---

## 버전 기반 무효화란

캐시 키에 **버전 번호를 포함**시켜서, 무효화 시 기존 키를 삭제하는 대신 **버전을 올려서 새 키를 사용**하는 방식입니다.

```
기존: user:123          → 삭제해야 무효화
버전: user:123:v3       → 버전 올리면 자동으로 다른 키
```

---

## 동작 원리

```python
# 현재 버전을 Redis에 저장
redis.set("version:user:123", "3")  # 현재 버전은 3

def get_cache_key(user_id: str) -> str:
    version = redis.get(f"version:user:{user_id}") or "1"
    return f"user:{user_id}:v{version}"

def get_user(user_id: str):
    key = get_cache_key(user_id)          # "user:123:v3"
    cached = redis.get(key)
    if cached:
        return User.from_json(cached)

    user = db.find_by_id(user_id)
    redis.set(key, user.to_json(), ex=3600)
    return user

def invalidate_user(user_id: str):
    # 삭제하지 않고, 버전만 올림
    redis.incr(f"version:user:{user_id}")
    # 이제 캐시 키가 "user:123:v4"로 바뀜
    # 기존 "user:123:v3"는 TTL 만료 시 자동 삭제
```

---

## 그룹 무효화 (Namespace Versioning)

개별 항목이 아닌 **카테고리 전체**를 무효화할 때 강력합니다.

```python
# 상품 목록 캐시 (카테고리별)
def get_products_key(category_id: str) -> str:
    version = redis.get(f"version:products:{category_id}") or "1"
    return f"products:{category_id}:v{version}"

def invalidate_all_products_in_category(category_id: str):
    # 키 하나 올리면 해당 카테고리의 모든 상품 캐시 무효화
    redis.incr(f"version:products:{category_id}")
    # 기존 캐시는 TTL 만료 시 자동 정리
```

```
상품 1000개가 있는 카테고리 "전자제품":
  - 각 상품 캐시 1000개를 DELETE하지 않아도 됨
  - version:products:electronics 하나만 올리면 전체 무효화
```

---

## 전역 버전 (Global Cache Bust)

배포 시 전체 캐시를 날리고 싶을 때:

```python
APP_VERSION = os.getenv("APP_VERSION", "1")  # 배포 시 환경변수

def build_key(base_key: str) -> str:
    return f"{APP_VERSION}:{base_key}"

# 배포 전: APP_VERSION=v2.1.0
# 배포 후: APP_VERSION=v2.2.0
# → 모든 캐시 키가 자동으로 달라짐
```

---

## 장단점

**장점:**
- 무효화가 **원자적**: 버전 번호 하나만 바꾸면 됨
- 그룹 무효화가 O(1): 수천 개의 키를 개별로 삭제하지 않아도 됨
- 분산 환경에서 안전: 여러 서버가 동시에 무효화해도 최종 버전만 유효

**단점:**
- 구버전 캐시가 TTL까지 메모리에 남음 → 일시적 메모리 증가
- 버전 키 관리가 추가됨 (version:* 키들)
- 복잡한 경우 버전 관리 로직이 번거로움

---

## 언제 쓰나

```
✅ 그룹 단위 무효화가 필요할 때 (카테고리 전체, 사용자 관련 전체)
✅ 배포 시 전체 캐시 리셋
✅ 원자적 무효화가 중요할 때
✅ 무효화 실패 가능성이 걱정될 때 (삭제 실패 없음)

❌ 메모리가 매우 타이트한 경우 (구버전 캐시가 잠시 남음)
```

---

## 핵심 요약

- 키에 버전 포함 → 버전 올리면 자동으로 다른 키 사용
- 기존 캐시를 삭제하지 않고 무효화 (TTL 만료 시 자연 정리)
- 그룹 무효화를 O(1)로 처리 가능
- 배포 시 전역 캐시 무효화에 활용
