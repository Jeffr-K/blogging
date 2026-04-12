---
title: "캐시를 쓰지 말아야 할 때"
date: 2026-04-12
tags: [cache, anti-patterns, when-not-to-cache]
---

## 캐시는 공짜가 아니다

```
캐시를 추가하면:
  + 성능 향상
  - 복잡도 증가 (무효화, 일관성)
  - 인프라 비용 (Redis 서버)
  - 디버깅 어려움 (언제 구버전 보이나?)
  - 운영 부담 (모니터링, 장애 대응)
```

**트레이드오프를 명확히 이해하고 써야 합니다.**

---

## 캐시가 역효과인 경우

### 1. 히트율이 낮은 경우

```python
# 나쁜 예: 사용자 검색 결과 캐싱
search_results = cache.get(f"search:{user_id}:{unique_query}")
# 각 사용자가 다른 쿼리 → 히트율 < 5%
# 캐시 저장/조회 오버헤드만 있고 이점이 없음

# 측정 먼저:
# "이 키가 N번 이상 반복 조회되는가?"
# 반복이 없으면 캐시 의미 없음
```

### 2. 데이터가 너무 자주 변경되는 경우

```
초당 100번 변경되는 주식 가격
→ TTL=1초로 캐시
→ 이미 구버전, 무효화 비용만 증가
→ 그냥 실시간 DB/WebSocket이 나음
```

### 3. 강한 일관성이 필요한 경우

```
잔액 조회:
  Redis: 100원
  DB: 50원 (방금 출금됨)
→ 50원짜리를 100원이라고 보여주면 안 됨
→ 캐시 없이 DB에서 직접 읽어야 함

재고:
  마지막 1개 재고가 남은 한정판
  → 캐시가 "1개 있음"을 반환하면 oversell
→ 분산 락 + DB 조회
```

### 4. 비용 대비 효과가 없는 경우

```
DB 쿼리 1ms → Redis 조회 1ms
→ 총 응답시간 차이 없음
→ 복잡도만 증가

"DB가 이미 충분히 빠른가?"를 먼저 확인
DB 쿼리 < 5ms이면 캐시 효과 미미
DB 쿼리 > 50ms이면 캐시 효과 큼
```

---

## 안티패턴 모음

### 안티패턴 1: 캐시 첫 번째 방어선

```python
# 나쁨: 모든 것에 캐시
@cacheable(ttl=60)
def get_user_count():  # DB에서 즉시 조회 가능한데 캐시?
    return db.count("SELECT COUNT(*) FROM users")

# 먼저 DB 튜닝:
# - 인덱스 추가
# - 쿼리 최적화
# - 읽기 레플리카
# 그래도 느리면 캐시 추가
```

### 안티패턴 2: 캐시 스탬핑에 대한 준비 없음

```python
# 나쁨: 동시에 만료되면 DB 과부하
redis.setex(f"product:{id}", 3600, data)  # 모두 같은 TTL

# 좋음: Jitter로 분산
ttl = 3600 + random.randint(-360, 360)
redis.setex(f"product:{id}", ttl, data)
```

### 안티패턴 3: 무효화 안 함

```python
# 나쁨: 업데이트 후 캐시 방치
def update_product(id, data):
    db.update(id, data)
    # 캐시 삭제 잊음 → 구버전 계속 반환

# 좋음:
def update_product(id, data):
    db.update(id, data)
    redis.delete(f"product:{id}")
```

### 안티패턴 4: 캐시에 민감한 데이터

```python
# 나쁨: 비밀번호 해시, 개인정보를 Redis에
redis.set(f"user:{id}", json.dumps({
    "name": "Alice",
    "password_hash": "...",  # 절대 안 됨!
    "ssn": "...",            # 절대 안 됨!
}))

# 좋음: 필요한 필드만
redis.set(f"user:{id}", json.dumps({
    "name": "Alice",
    "email": "alice@example.com"
}))
```

---

## 결정 프레임워크

```
캐시를 도입하기 전 체크리스트:

□ DB 쿼리가 실제로 느린가? (>50ms?)
□ 같은 쿼리가 반복 실행되는가? (히트율 측정 가능한가?)
□ 데이터 변경 빈도가 TTL보다 낮은가?
□ 일시적 구버전 반환을 허용할 수 있는가?
□ 캐시 무효화 로직을 구현할 수 있는가?
□ 모니터링/알람을 설정할 수 있는가?

모두 Yes → 캐시 도입 가치 있음
하나라도 No → 신중히 재검토
```

---

## 핵심 요약

- 캐시는 복잡도 증가의 대가로 성능을 얻는 것
- **히트율 < 30%**: 캐시 오버헤드만 있고 효과 없음
- **자주 변경**: 무효화 비용이 이득을 초과
- **강한 일관성 필요**: 캐시 없이 DB 직접
- **DB가 이미 빠름**: 캐시 효과 미미
- 측정 먼저, 도입 나중 (Measure first, Cache later)
