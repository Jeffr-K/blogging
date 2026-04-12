---
title: "Read-Through: 캐시가 DB 읽기를 대신한다"
date: 2026-04-12
tags: [cache, strategy, read-through]
---

## Read-Through란

**애플리케이션은 캐시만 바라보고, 캐시가 DB 조회를 대신**하는 패턴입니다.

```
Cache-Aside:    앱 → 캐시 확인 → MISS → 앱 → DB → 앱 → 캐시 저장
Read-Through:   앱 → 캐시    →  MISS → 캐시 → DB → 캐시 저장 → 앱
```

핵심 차이: **MISS 시 DB 조회 주체가 앱이냐 캐시 레이어냐**

---

## 구조

```
애플리케이션
    ↓ get("user:123")
캐시 레이어 (라이브러리/미들웨어)
    ├── HIT: 반환
    └── MISS: DB 조회 → 캐시 저장 → 반환
```

애플리케이션 코드에서 DB 조회 로직이 사라집니다.

---

## 코드 예시

### Java - Caffeine with Read-Through (CacheLoader)

```java
LoadingCache<String, User> cache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(5, TimeUnit.MINUTES)
    .build(key -> {
        // MISS 시 자동으로 호출되는 로더
        String userId = key.replace("user:", "");
        return userRepository.findById(userId);
    });

// 사용하는 쪽: DB 로직 없이 캐시만 호출
User user = cache.get("user:123"); // MISS면 자동으로 DB 조회
```

### Spring - @Cacheable (Read-Through 추상화)

```java
@Service
public class UserService {

    @Cacheable(value = "users", key = "#userId")
    public User getUser(String userId) {
        // @Cacheable이 캐시를 먼저 확인하고, MISS면 이 메서드를 실행
        return userRepository.findById(userId);
    }
}
```

Spring의 `@Cacheable`이 대표적인 Read-Through 구현입니다.

---

## Cache-Aside vs Read-Through 비교

| | Cache-Aside | Read-Through |
|--|------------|-------------|
| DB 조회 주체 | 애플리케이션 | 캐시 레이어 |
| 코드 위치 | 비즈니스 로직에 섞임 | 캐시 설정에 분리 |
| 유연성 | 높음 (직접 제어) | 낮음 (라이브러리 의존) |
| 첫 요청 | MISS → 느림 | MISS → 느림 (동일) |
| 캐시 다운 시 | 앱이 DB 직접 조회 | 캐시 의존적 |

---

## Read-Through의 특징

### 코드가 깔끔해진다

```java
// Cache-Aside: 캐시 로직이 서비스에 섞임
public User getUser(String userId) {
    String cached = redis.get("user:" + userId);
    if (cached != null) return User.fromJson(cached);
    User user = db.findUser(userId);
    redis.set("user:" + userId, user.toJson(), 300);
    return user;
}

// Read-Through: 서비스 코드가 순수해짐
@Cacheable("users")
public User getUser(String userId) {
    return db.findUser(userId);
}
```

### 캐시와 데이터 모델이 결합된다

Read-Through는 **캐시가 데이터 접근 레이어를 담당**합니다. 이는 캐시 라이브러리나 프레임워크가 그 규칙을 알아야 한다는 뜻입니다. 데이터 모델이 복잡하거나 DB마다 쿼리 방식이 다를수록 설정이 복잡해집니다.

---

## 언제 쓰나

```
✅ @Cacheable 같은 선언형 캐싱을 쓸 때
✅ 캐시 로직을 비즈니스 코드와 분리하고 싶을 때
✅ Caffeine 같은 로컬 캐시에서 LoadingCache 패턴
❌ 캐시 미스 시 세밀한 제어가 필요할 때
❌ 캐시 레이어를 직접 제어해야 할 때 (→ Cache-Aside)
```

---

## 핵심 요약

- MISS 시 DB 조회를 캐시 레이어가 대신 처리
- 비즈니스 코드가 캐시 로직을 모름 → 코드 분리
- Spring `@Cacheable`, Caffeine `LoadingCache`가 대표 구현
- 세밀한 제어가 필요하면 Cache-Aside가 더 적합
