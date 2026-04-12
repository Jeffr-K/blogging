---
title: "TTL 설계: 신선도 vs 히트율 트레이드오프"
date: 2026-04-12
tags: [cache, invalidation, ttl]
---

## TTL(Time To Live)이란

캐시 데이터의 **만료 시간**입니다. TTL이 지나면 해당 데이터는 자동으로 캐시에서 삭제됩니다.

```python
redis.set("user:123", user_json, ex=300)  # 300초(5분) 후 자동 삭제
```

---

## TTL과 히트율의 관계

```
TTL 길다 → 데이터 오래 캐시 → 히트율 높음 → DB 부하 낮음
           단점: 변경된 데이터가 오래 캐시에 남음 (stale)

TTL 짧다 → 데이터 자주 만료 → 히트율 낮음 → DB 부하 높음
           장점: 데이터가 비교적 최신
```

TTL을 정하는 건 **"얼마나 오래된 데이터까지 허용할 것인가"**를 결정하는 것입니다.

---

## 데이터 유형별 TTL 가이드

```
매우 짧음 (1~60초):
  실시간 재고 수량, 현재 접속자 수
  → 1분만 오래된 데이터도 문제가 될 수 있음

짧음 (1~10분):
  장바구니, 세션 관련 임시 데이터
  → 몇 분 단위 변경이 일어날 수 있음

중간 (10분~1시간):
  상품 상세, 유저 프로필
  → 수시로 변경되지는 않지만 변경될 수 있음

길음 (1시간~1일):
  카테고리 목록, 공지사항, 설정 정보
  → 자주 변경되지 않는 준정적 데이터

매우 길음 (1일~영구):
  국가 코드, 통화 목록
  → 거의 변경되지 않는 정적 데이터
```

---

## TTL 설정 시 고려사항

### 1. 데이터 변경 빈도

```
변경 빈도 높음 → TTL 짧게 or 이벤트 기반 무효화 사용
변경 빈도 낮음 → TTL 길게
```

### 2. 비즈니스 허용 범위

```
"상품 가격이 변경되면 몇 분 안에 반영되어야 하나?"
"유저 권한 변경은 즉시 반영되어야 하나?"

→ 이걸 PM/기획자와 먼저 논의해야 함
```

### 3. 트래픽 패턴

```
피크 타임: 오후 7~9시
→ 피크 전 캐시가 만료되지 않도록 TTL 조정
→ 또는 Refresh-Ahead로 미리 갱신
```

---

## 고정 TTL vs 슬라이딩 TTL

### 고정 TTL (Fixed TTL)

저장 시점으로부터 N초 후 만료. Redis 기본 동작.

```python
redis.set(key, value, ex=300)  # 저장 후 300초
```

### 슬라이딩 TTL (Sliding TTL)

**마지막 접근 시점**으로부터 N초. 접근할 때마다 TTL이 연장됩니다.

```python
def get_with_sliding_ttl(key: str, ttl: int):
    value = redis.get(key)
    if value:
        redis.expire(key, ttl)  # 접근 시마다 TTL 재설정
    return value
```

```
사용 사례: 세션 (마지막 활동 기준으로 만료)
  로그인 후 30분 이내에 활동이 없으면 로그아웃
  → 활동할 때마다 30분 연장
```

---

## TTL 없이 캐싱하면?

```
redis.set(key, value)  # TTL 없음 → 영구 저장
```

- 데이터가 삭제되지 않음 → 메모리 계속 증가
- Eviction 정책에 의해서만 삭제 (용량 부족 시)
- 오래된 데이터가 영원히 남을 수 있음

**TTL 없는 캐싱은 특별한 이유가 없으면 지양.** 이벤트 기반으로 명시적 삭제를 철저히 할 수 있을 때만 사용.

---

## TTL Jitter (랜덤 편차)

같은 시간에 다수의 캐시가 만료되면 DB에 순간적으로 폭발적인 요청이 몰립니다. (Cache Avalanche, Ch.5 참고)

```python
import random

BASE_TTL = 300  # 5분

def set_with_jitter(key, value, base_ttl=BASE_TTL):
    # ±20% 랜덤 편차
    jitter = random.randint(-base_ttl // 5, base_ttl // 5)
    ttl = base_ttl + jitter  # 240~360초 사이
    redis.set(key, value, ex=ttl)
```

---

## 핵심 요약

- TTL = 신선도 vs 히트율 트레이드오프
- 데이터 변경 빈도와 비즈니스 허용 범위로 결정
- 고정 TTL: 저장 시점 기준 / 슬라이딩 TTL: 접근 시점 기준
- TTL 없는 영구 캐싱은 신중하게
- 동시 만료 방지를 위해 TTL Jitter 추가
