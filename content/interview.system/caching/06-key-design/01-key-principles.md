---
title: "캐시 키 설계 원칙"
date: 2026-04-12
tags: [cache, key-design, redis, naming]
---

## 왜 키 설계가 중요한가

키 이름은 한번 굳어지면 바꾸기 어렵습니다. 수백만 개의 키를 가진 Redis에서:

```
나쁜 키: "u1", "p2", "x_y_z_123"
  → 뭘 캐싱하는지 알 수 없음
  → 패턴 검색 불가 (SCAN "u*" → 의미 없음)
  → 충돌 가능성

좋은 키: "user:1:profile", "product:2:price", "order:123:status"
  → 가독성 높음
  → 패턴으로 관련 키 일괄 삭제 가능
  → 충돌 없음
```

---

## 기본 명명 규칙

### 계층 구조: 콜론(:) 구분자

```
{서비스}:{엔티티}:{id}:{필드}

예시:
  user:42:profile       → 유저 42의 프로필
  user:42:friends       → 유저 42의 친구 목록
  product:1001:price    → 상품 1001의 가격
  session:abc123        → 세션 데이터
  ranking:daily:2026-04-12  → 날짜별 랭킹
```

### 소문자 + 영문

```
❌ User:42:Profile      → 대소문자 혼용 (실수 유발)
❌ 유저:42:프로필       → 멀티바이트 키 (내부 처리 복잡)
✅ user:42:profile
```

### 버전 포함 (선택적)

```
v2:user:42:profile    → 스키마 변경 시 구버전과 공존
```

---

## 키 길이 vs 가독성

Redis 키는 바이트 배열이므로 길이 제한은 없지만, 메모리 사용량에 영향을 줍니다.

```
키 자체도 메모리를 사용합니다:
  "u:42" (4 bytes) vs "user:42:profile" (15 bytes)

Redis overhead: 키당 ~50 bytes의 고정 오버헤드가 있으므로
  짧은 키 절약 효과: 11 bytes / (50 + 4) = 20% 절약
  → 수백만 키가 아니면 가독성 우선
```

**결론: 키가 수천만 개 미만이면 가독성 우선. 그 이상이면 압축 고려.**

```python
# 수억 개 키를 가진 서비스에서 압축 예시
# "notification:user:42:unread" → "notif:u:42:ur"
# 단, 팀 내 문서화 필수
```

---

## 금지 사항

```
1. 공백 포함
   ❌ "user 42 profile"  → Redis CLI에서 따옴표 처리 필요, 실수 유발

2. 특수문자 남발
   ❌ "user@42#profile"  → 패턴 검색 시 이스케이프 필요

3. 너무 긴 키
   ❌ "user:42:friends:list:sorted:by:created_at:desc:page:1"
   → 매번 생성 비용 + 메모리 낭비

4. 숫자만
   ❌ "42", "1001"  → 충돌, 의미 불명확

5. 동적 값을 구분자 없이 연결
   ❌ "user42profile"  → 42와 user+2와 구분 불가
```

---

## 키 생성 함수

```python
def cache_key(*parts: str) -> str:
    """일관된 키 생성"""
    return ":".join(str(p) for p in parts)

# 사용
user_key = cache_key("user", user_id, "profile")        # "user:42:profile"
ranking_key = cache_key("ranking", "daily", date_str)    # "ranking:daily:2026-04-12"
session_key = cache_key("session", session_id)           # "session:abc123"
```

```java
// Java
public class CacheKey {
    public static String of(String... parts) {
        return String.join(":", parts);
    }
}

// 사용
String key = CacheKey.of("user", userId.toString(), "profile");
```

---

## SCAN 패턴 활용

일관된 키 설계는 관련 키를 패턴으로 관리할 수 있게 합니다:

```python
# 유저 42의 모든 캐시 삭제
def invalidate_user_cache(user_id: int):
    pattern = f"user:{user_id}:*"
    cursor = 0
    while True:
        cursor, keys = redis.scan(cursor, match=pattern, count=100)
        if keys:
            redis.delete(*keys)
        if cursor == 0:
            break
```

```bash
# CLI에서 확인
redis-cli SCAN 0 MATCH "user:42:*" COUNT 100
redis-cli SCAN 0 MATCH "ranking:daily:*" COUNT 100
```

---

## 핵심 요약

- 키 형식: `{서비스}:{엔티티}:{id}:{필드}` (콜론 구분)
- 소문자 영문, 공백/특수문자 금지
- 수천만 개 미만이면 가독성 우선
- 키 생성 함수로 일관성 보장
- 일관된 패턴 → SCAN으로 관련 키 일괄 관리
