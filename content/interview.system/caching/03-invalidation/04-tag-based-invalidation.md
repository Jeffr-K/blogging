---
title: "태그 기반 무효화: 관련 키를 그룹으로 묶어 일괄 삭제"
date: 2026-04-12
tags: [cache, invalidation, tag-based]
---

## 태그 기반 무효화란

캐시 키에 **태그**를 붙여두고, 무효화 시 태그에 묶인 **모든 키를 한번에 삭제**하는 방식입니다.

```
캐시 저장 시:
  "product:123" 캐시에 태그: ["product", "category:electronics", "brand:apple"]

무효화 시:
  "brand:apple" 태그가 붙은 모든 키 삭제
  → "product:123", "product:456", "product:789" 한번에 삭제
```

---

## Redis로 구현

Redis에는 태그 기능이 내장되어 있지 않으므로 직접 구현합니다.

```python
class TaggedCache:
    def __init__(self, redis):
        self.redis = redis

    def set(self, key: str, value: str, tags: list[str], ex: int):
        pipe = self.redis.pipeline()

        # 1. 실제 캐시 저장
        pipe.set(key, value, ex=ex)

        # 2. 각 태그 → 키 역인덱스 저장 (Set 자료구조)
        for tag in tags:
            tag_key = f"tag:{tag}"
            pipe.sadd(tag_key, key)         # 태그에 캐시 키 추가
            pipe.expire(tag_key, ex + 60)   # 태그도 만료 설정

        pipe.execute()

    def invalidate_by_tag(self, tag: str):
        tag_key = f"tag:{tag}"

        # 1. 해당 태그의 모든 캐시 키 조회
        keys = self.redis.smembers(tag_key)

        if keys:
            pipe = self.redis.pipeline()
            # 2. 모든 캐시 키 삭제
            for key in keys:
                pipe.delete(key)
            # 3. 태그 자체도 삭제
            pipe.delete(tag_key)
            pipe.execute()
```

```python
# 사용
cache = TaggedCache(redis)

# 저장: 상품 캐시에 태그 부여
cache.set(
    key="product:123",
    value=product_json,
    tags=["product", "category:electronics", "brand:apple"],
    ex=3600
)

# Apple 브랜드 관련 모든 캐시 삭제
cache.invalidate_by_tag("brand:apple")
```

---

## 실제 활용 사례

### 상품-카테고리 관계

```python
# 상품 캐시 저장
cache.set("product:123", ..., tags=["product:123", "category:5", "brand:10"])
cache.set("product:456", ..., tags=["product:456", "category:5", "brand:10"])
cache.set("product:789", ..., tags=["product:789", "category:5", "brand:20"])

# 카테고리 5 수정 → 해당 카테고리 상품 캐시 전체 무효화
cache.invalidate_by_tag("category:5")
# → product:123, product:456, product:789 모두 삭제
```

### 유저 관련 캐시 전체 무효화

```python
# 유저 관련 여러 캐시에 같은 태그
cache.set("user:123:profile", ..., tags=["user:123"])
cache.set("user:123:orders", ..., tags=["user:123"])
cache.set("user:123:cart", ..., tags=["user:123"])

# 유저 탈퇴 → 관련 캐시 전체 삭제
cache.invalidate_by_tag("user:123")
```

---

## 프레임워크 지원

**Symfony (PHP)**의 Cache Component가 태그 기반 무효화를 내장 지원합니다.

**Java - Spring Cache + Caffeine**: 직접 구현 필요

**FusionCache (.NET)**: 태그 기반 무효화 내장

---

## 태그 기반 vs 버전 기반 비교

| | 태그 기반 | 버전 기반 |
|--|---------|---------|
| 무효화 방식 | 관련 키 직접 삭제 | 버전 올려서 우회 |
| 메모리 | 즉시 해제 | 구버전이 TTL까지 남음 |
| 복잡도 | 태그 역인덱스 필요 | 버전 키 관리 필요 |
| 원자성 | Pipeline으로 근사 | incr 하나로 완전 원자적 |

---

## 주의사항

- 태그 역인덱스도 메모리를 씁니다
- 태그 삭제 후 캐시 키 삭제 전에 서버 다운되면 고아 키 발생 → TTL로 자연 정리
- Redis Cluster에서 태그와 캐시 키가 다른 슬롯에 있을 수 있음 → hash tag 사용

```python
# Redis Cluster에서 같은 슬롯 보장
# {user:123}을 hash tag로 사용
key = "{user:123}:profile"
tag_key = "{user:123}:tags"  # 같은 {} → 같은 슬롯
```

---

## 핵심 요약

- 태그로 관련 캐시를 그룹핑 → 한번에 무효화
- Redis Set으로 태그 → 키 역인덱스 구현
- 카테고리/브랜드 변경 시 관련 상품 캐시 전체 무효화에 유용
- 버전 기반보다 즉시 메모리 해제, 원자성은 버전 기반이 더 강함
