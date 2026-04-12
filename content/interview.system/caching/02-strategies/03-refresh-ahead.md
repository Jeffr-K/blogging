---
title: "Refresh-Ahead: 만료 전에 미리 갱신한다"
date: 2026-04-12
tags: [cache, strategy, refresh-ahead]
---

## Refresh-Ahead란

캐시가 **만료되기 전에 백그라운드에서 미리 갱신**하는 패턴입니다. 사용자는 항상 캐시에서 빠르게 응답받고, 갱신은 뒤에서 조용히 일어납니다.

```
일반 패턴:
  T=0:   캐시 저장 (TTL=10분)
  T=10분: 캐시 만료 → 다음 요청이 MISS → DB 조회 (느림!)

Refresh-Ahead:
  T=0:   캐시 저장 (TTL=10분)
  T=8분: 백그라운드에서 DB 조회 → 캐시 갱신
  T=10분: 캐시 만료 전에 이미 갱신 완료 → 항상 HIT
```

---

## 구현 방법

### 방법 1: Threshold 기반 (접근 시점에 갱신 트리거)

```python
def get_user(user_id: str) -> User:
    cache_key = f"user:{user_id}"
    ttl_key = f"user:{user_id}:ttl"

    cached = redis.get(cache_key)
    remaining_ttl = redis.ttl(cache_key)

    # 남은 TTL이 전체의 20% 이하면 백그라운드 갱신 트리거
    if cached and remaining_ttl < 60:  # TTL 300초 중 60초 미만 남음
        background_task.submit(refresh_user_cache, user_id)

    if cached:
        return User.from_json(cached)  # 일단 캐시 반환 (빠름)

    # Cold Miss: 캐시 없으면 동기 조회
    user = db.find_by_id(user_id)
    redis.set(cache_key, user.to_json(), ex=300)
    return user

def refresh_user_cache(user_id: str):
    """백그라운드에서 실행"""
    user = db.find_by_id(user_id)
    redis.set(f"user:{user_id}", user.to_json(), ex=300)
```

### 방법 2: Caffeine의 refreshAfterWrite

```java
LoadingCache<String, User> cache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(10, TimeUnit.MINUTES)
    .refreshAfterWrite(8, TimeUnit.MINUTES)  // 8분 후 백그라운드 갱신
    .build(userId -> userRepository.findById(userId));
```

`refreshAfterWrite`: 8분이 지나면 **다음 접근 시 백그라운드에서 갱신**하고 기존 캐시 즉시 반환합니다.

---

## 언제 효과적인가

```
✅ 데이터 변경이 예측 가능한 주기로 일어날 때
✅ 높은 읽기 트래픽, 캐시 만료 시 레이턴시 spike를 피해야 할 때
✅ 약간의 stale 데이터를 허용할 수 있을 때 (ex. 랭킹, 집계 데이터)

❌ 데이터가 실시간으로 정확해야 할 때 (주문, 재고)
❌ 읽기 트래픽이 낮아 만료 시 spike가 없을 때
```

---

## 주의할 점

### 갱신 주기 설정

너무 공격적으로 갱신하면 DB 부하가 올라갑니다.

```
전체 캐시 수:  100,000개
TTL:           10분
Refresh 시점:  8분 (만료 2분 전)

→ 2분 동안 100,000개의 캐시가 백그라운드 갱신 시도
→ DB에 100,000개의 쿼리 집중!
```

해결: 갱신을 분산시키거나 (TTL Jitter) 실제로 접근이 있을 때만 갱신

### stale 데이터 허용 여부 확인

Refresh-Ahead는 갱신 중에도 **이전 데이터를 반환**합니다. 잠깐의 불일치를 허용하는 데이터에만 써야 합니다.

---

## 핵심 요약

- 만료 전 백그라운드에서 미리 갱신 → 사용자는 항상 캐시 HIT
- Caffeine `refreshAfterWrite`가 대표적 구현
- 만료 시 레이턴시 spike를 없애는 게 핵심 목적
- 잠깐의 stale 데이터를 허용할 수 있을 때 적합 (랭킹, 집계 등)
