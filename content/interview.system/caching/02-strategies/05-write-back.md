---
title: "Write-Back (Write-Behind): 캐시에 먼저 쓰고 DB는 나중에"
date: 2026-04-12
tags: [cache, strategy, write-back, write-behind]
---

## Write-Back이란

**캐시에만 먼저 쓰고, DB 쓰기는 나중에 비동기로** 처리하는 패턴입니다.

```
쓰기 흐름:
  1. 캐시에만 씀 → 즉시 응답
  2. (백그라운드) 캐시 → DB 배치 플러시

읽기 흐름:
  캐시 조회 → HIT (최신 데이터 있음)
```

Write-Through보다 훨씬 빠릅니다. DB I/O가 사용자 응답 경로에서 빠지기 때문입니다.

---

## 구조

```
앱 → 캐시 (즉시 응답)
         ↓ (비동기, 배치)
         DB
```

---

## 코드 개념

```python
# 쓰기: 캐시에만 저장 (dirty flag 설정)
def update_user(user_id: str, data: dict):
    cache_key = f"user:{user_id}"
    dirty_key = f"dirty:user:{user_id}"

    redis.set(cache_key, json.dumps(data), ex=600)
    redis.set(dirty_key, "1", ex=600)  # "이 데이터는 DB에 아직 안 씀"

    return data  # 즉시 응답

# 백그라운드 플러시 (스케줄러가 주기적으로 실행)
def flush_to_db():
    dirty_keys = redis.scan_match("dirty:user:*")
    for dirty_key in dirty_keys:
        user_id = dirty_key.replace("dirty:user:", "")
        data = redis.get(f"user:{user_id}")
        if data:
            db.update_user(user_id, json.loads(data))
            redis.delete(dirty_key)
```

실제로는 Redis의 `List`나 `Stream`을 큐처럼 써서 구현하는 경우가 많습니다.

---

## 실제 사례

### 좋아요 수, 조회수

```
좋아요 버튼 클릭 → Redis INCR likes:post:123 (즉시, 빠름)
백그라운드로 주기적으로 DB UPDATE posts SET likes = ? WHERE id = 123
```

- 실시간 응답성 필요
- 가끔 손실되어도 큰 문제 없음 (좋아요 1개 손실은 치명적이지 않음)

### 게임 스코어

```
점수 업데이트 → Redis ZADD leaderboard score userId
배치로 DB 저장
```

---

## 치명적 단점: 데이터 유실

```
시나리오:
  1. 앱 → 캐시에 씀 ("좋아요 1,000개")
  2. 캐시(Redis) 장애 or 재시작
  3. DB에는 아직 "좋아요 800개" 상태
  → 200개 유실!
```

Redis는 기본적으로 메모리 기반이라 재시작하면 데이터가 사라집니다. (AOF/RDB 설정으로 완화 가능, Ch.8 참고)

---

## 장단점

**장점:**
- 쓰기 성능이 극적으로 향상 (캐시만 쓰므로 ~1ms)
- DB 부하 감소 (여러 쓰기를 배치로 처리)
- Write-Heavy 서비스에 적합

**단점:**
- 데이터 유실 가능 (캐시 장애 시)
- 구현 복잡도 높음 (dirty tracking, 플러시 로직)
- 일관성이 가장 낮음

---

## 언제 쓰나

```
✅ 조회수, 좋아요처럼 약간의 데이터 유실이 허용되는 경우
✅ Write-Heavy 서비스에서 DB가 병목일 때
✅ 실시간 응답이 필요하고 배치 플러시가 가능할 때

❌ 주문, 결제, 재고 같은 데이터 유실이 치명적인 경우
❌ 강한 일관성이 필요할 때
```

---

## 핵심 요약

- 캐시에 먼저 쓰고 DB는 비동기 배치로 → 쓰기 극속 빠름
- 대신 캐시 장애 시 데이터 유실 가능
- 조회수, 좋아요처럼 약간의 유실이 허용되는 데이터에 적합
- 결제, 재고에는 절대 사용 금지
