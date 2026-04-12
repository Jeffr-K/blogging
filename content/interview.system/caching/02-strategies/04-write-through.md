---
title: "Write-Through: 캐시와 DB를 동시에 쓴다"
date: 2026-04-12
tags: [cache, strategy, write-through]
---

## Write-Through란

데이터를 쓸 때 **캐시와 DB를 동시에(혹은 순차적으로) 업데이트**하는 패턴입니다.

```
쓰기 흐름:
  1. 캐시에 씀
  2. DB에 씀 (혹은 캐시가 DB에 씀)
  3. 완료

읽기 흐름:
  캐시 조회 → HIT (항상 최신 데이터)
```

Cache-Aside에서는 쓰기 시 캐시를 삭제했지만, Write-Through에서는 **캐시도 같이 업데이트**합니다.

---

## 구현

```python
def update_user(user_id: str, data: dict):
    # 1. DB 업데이트
    user = db.update_user(user_id, data)

    # 2. 캐시도 동시에 업데이트 (삭제가 아닌 업데이트)
    redis.set(f"user:{user_id}", user.to_json(), ex=300)
    # → 다음 읽기는 캐시에서 바로 최신 데이터 반환
```

Spring에서는 `@CachePut`이 Write-Through:

```java
@CachePut(value = "users", key = "#userId")
public User updateUser(String userId, UpdateUserDto dto) {
    return userRepository.save(dto.toEntity(userId));
    // 반환값이 자동으로 캐시에 저장됨
}
```

---

## 장단점

**장점:**
- 캐시에 항상 최신 데이터 → 읽기 시 DB 조회 불필요
- 데이터 일관성이 높음 (Cache-Aside보다)
- 읽기 성능이 좋음

**단점:**

1. **쓰기 레이턴시 증가**: 캐시 + DB 두 곳에 써야 하므로 쓰기가 느려짐
2. **쓰고 읽지 않는 데이터도 캐시에 올라감**: 메모리 낭비
   ```
   1,000개 상품 업데이트 → 1,000개 캐시 생성
   그중 실제 조회되는 건 50개뿐 → 950개가 TTL 만료까지 메모리 차지
   ```
3. **두 곳 쓰기 도중 실패 처리**: 캐시 성공 + DB 실패, 혹은 반대

---

## 실패 처리

쓰기 도중 하나가 실패하면 불일치 발생:

```python
def update_user_safe(user_id: str, data: dict):
    try:
        # DB를 먼저 → 성공하면 캐시 업데이트
        user = db.update_user(user_id, data)
        redis.set(f"user:{user_id}", user.to_json(), ex=300)
    except DBException:
        # DB 실패 → 캐시 건드리지 않음 (기존 데이터 유지)
        raise
    except RedisException:
        # 캐시 실패 → DB는 업데이트됨
        # 캐시 삭제해서 다음 읽기가 DB에서 최신 데이터 가져오게
        redis.delete(f"user:{user_id}")
        # 로그 남기고 계속 진행 (캐시는 best-effort)
```

---

## Cache-Aside vs Write-Through

| | Cache-Aside | Write-Through |
|--|------------|--------------|
| 읽기 시 캐시 미스 | 가능 | 거의 없음 |
| 쓰기 속도 | 빠름 (캐시 삭제만) | 느림 (캐시+DB) |
| 데이터 일관성 | 짧은 불일치 가능 | 높음 |
| 메모리 효율 | 좋음 (읽힌 것만 캐시) | 낮음 (쓴 것도 캐시) |

---

## 언제 쓰나

```
✅ 쓴 후 곧바로 읽는 패턴 (쓰고 바로 프로필 확인 등)
✅ 읽기 성능이 쓰기 성능보다 중요할 때
✅ 캐시 미스를 최소화해야 할 때

❌ Write-Heavy 서비스 (쓰기 레이턴시 감당 어려움)
❌ 쓰고 읽지 않는 데이터가 많을 때 (메모리 낭비)
```

---

## 핵심 요약

- 쓰기 시 DB + 캐시 동시 업데이트
- 읽기 히트율이 높아짐, 일관성이 높아짐
- 대신 쓰기가 느려지고 메모리를 더 씀
- 쓰고 바로 읽는 패턴에 적합
