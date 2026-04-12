---
title: "이벤트 기반 무효화: DB 변경 시 캐시를 즉시 날린다"
date: 2026-04-12
tags: [cache, invalidation, event-driven]
---

## 이벤트 기반 무효화란

TTL을 기다리지 않고, **DB 데이터가 변경되는 순간 관련 캐시를 삭제**하는 방식입니다.

```
TTL 기반: 변경 발생 → 최대 TTL 시간만큼 stale 데이터 노출
이벤트 기반: 변경 발생 → 즉시 캐시 삭제 → 다음 읽기에서 최신 데이터
```

---

## 가장 단순한 구현: 서비스 레이어에서 직접 삭제

```python
class UserService:
    def update_user(self, user_id: str, data: dict):
        # 1. DB 업데이트
        user = self.user_repo.update(user_id, data)

        # 2. 관련 캐시 즉시 삭제
        self.redis.delete(f"user:{user_id}")
        self.redis.delete(f"user:profile:{user_id}")  # 연관 캐시도
        self.redis.delete(f"user:summary:{user_id}")

        return user
```

```java
// Spring @CacheEvict
@CacheEvict(value = "users", key = "#userId")
public User updateUser(String userId, UpdateUserDto dto) {
    return userRepository.save(dto.toEntity(userId));
    // 메서드 실행 후 "users" 캐시에서 userId 키 삭제
}
```

---

## 여러 캐시를 한번에 무효화

데이터 하나가 여러 캐시에 영향을 줄 수 있습니다.

```python
class ProductService:
    def update_product(self, product_id: str, data: dict):
        product = self.product_repo.update(product_id, data)

        # 상품 자체 캐시
        self.redis.delete(f"product:{product_id}")

        # 상품이 속한 카테고리 목록 캐시
        self.redis.delete(f"category:{product.category_id}:products")

        # 상품이 포함된 검색 결과 캐시 (키를 알 수 없으면 패턴으로)
        # 주의: KEYS 명령어는 운영 환경에서 위험 (Ch.8 참고)
        # 대신 태그 기반 무효화 사용 (Ch.3/04 참고)

        return product
```

---

## 이벤트 발행 방식 (더 나은 분리)

서비스 코드에 캐시 삭제 로직이 섞이면 관심사가 분리되지 않습니다. 이벤트를 발행하고 별도 핸들러에서 캐시를 무효화하는 방식이 더 깔끔합니다.

```python
# 도메인 이벤트 발행
class UserService:
    def update_user(self, user_id: str, data: dict):
        user = self.user_repo.update(user_id, data)
        self.event_bus.publish(UserUpdatedEvent(user_id=user_id))
        return user

# 캐시 무효화 핸들러 (별도)
class UserCacheInvalidator:
    def on_user_updated(self, event: UserUpdatedEvent):
        self.redis.delete(f"user:{event.user_id}")
        self.redis.delete(f"user:profile:{event.user_id}")
```

NestJS에서는 EventEmitter, Spring에서는 ApplicationEvent로 구현합니다.

---

## 트랜잭션과 캐시 삭제 순서

```
문제 시나리오:
  1. DB 업데이트 (트랜잭션 내)
  2. 캐시 삭제
  3. DB 트랜잭션 롤백!
  → 캐시는 삭제됐는데, DB는 이전 값 → 다음 읽기에서 DB의 이전 값이 캐시에 저장
```

**권장: DB 커밋 완료 후 캐시 삭제**

```python
def update_user(self, user_id: str, data: dict):
    with db.transaction():
        user = self.user_repo.update(user_id, data)
        # 트랜잭션 내에서는 캐시 건드리지 않음

    # 커밋 완료 후 캐시 삭제
    self.redis.delete(f"user:{user_id}")
    return user
```

Spring의 `@TransactionalEventListener`가 이 패턴의 표준 구현입니다:

```java
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void handleUserUpdated(UserUpdatedEvent event) {
    redis.delete("user:" + event.getUserId());
    // 트랜잭션 커밋 이후에만 실행
}
```

---

## 한계

- **삭제 실패 시 처리**: Redis 삭제가 실패하면 stale 캐시가 남음
  - 해결: TTL도 함께 사용 (fallback 역할)
- **분산 환경**: 여러 서비스가 같은 캐시를 수정하면 무효화가 누락될 수 있음
  - 해결: CDC + 중앙 집중 무효화 (Ch.12 참고)

---

## 핵심 요약

- DB 변경 즉시 관련 캐시 삭제 → stale 데이터 최소화
- `@CacheEvict`, Redis DELETE가 기본 구현
- DB 커밋 이후 캐시 삭제 (`@TransactionalEventListener`)
- 이벤트 기반으로 캐시 로직과 비즈니스 로직 분리
- Redis 삭제 실패 대비 TTL은 항상 설정 (마지막 방어선)
