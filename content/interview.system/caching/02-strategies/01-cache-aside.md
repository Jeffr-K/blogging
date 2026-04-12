---
title: "Cache-Aside (Lazy Loading): 가장 흔한 캐싱 패턴"
date: 2026-04-12
tags: [cache, strategy, cache-aside]
---

## Cache-Aside란

**애플리케이션이 직접 캐시를 관리**하는 패턴입니다. "Lazy Loading"이라고도 불리는데, 실제로 요청이 올 때까지 캐시에 올리지 않아서입니다.

```
읽기 흐름:
  1. 캐시 확인
  2. HIT → 반환
  3. MISS → DB 조회 → 캐시에 저장 → 반환
```

Redis를 직접 쓸 때 우리가 보통 짜는 코드가 바로 Cache-Aside입니다.

---

## 코드

```python
def get_user(user_id: str) -> User:
    cache_key = f"user:{user_id}"

    # 1. 캐시 먼저
    cached = redis.get(cache_key)
    if cached:
        return User.from_json(cached)   # HIT

    # 2. DB 조회
    user = db.find_by_id(user_id)
    if not user:
        return None

    # 3. 캐시에 저장 (TTL 5분)
    redis.set(cache_key, user.to_json(), ex=300)

    return user  # MISS
```

```typescript
// NestJS + Interceptor로 선언적으로
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const key = this.buildKey(context);
    const cached = await this.redis.get(key);

    if (cached) return of(JSON.parse(cached));

    return next.handle().pipe(
      tap(data => this.redis.set(key, JSON.stringify(data), 'EX', 300))
    );
  }
}
```

---

## 쓰기 흐름 (Cache-Aside + Delete)

Cache-Aside에서 데이터 변경 시 캐시를 어떻게 처리하는지가 핵심입니다.

**권장: DB 쓰기 후 캐시 삭제 (Cache Invalidation)**

```python
def update_user(user_id: str, data: dict):
    # 1. DB 업데이트
    db.update_user(user_id, data)

    # 2. 캐시 삭제 (업데이트 X, 삭제 O)
    redis.delete(f"user:{user_id}")
    # → 다음 읽기 요청 시 DB에서 최신 데이터 가져와서 캐시 재생성
```

**왜 업데이트가 아니라 삭제인가?**

```
업데이트 방식의 문제:
  스레드 A: DB 업데이트 완료
  스레드 B: DB 업데이트 완료 (A보다 늦게)
  스레드 B: 캐시 업데이트
  스레드 A: 캐시 업데이트 (B를 덮어씀!)
  → 더 오래된 데이터가 캐시에 남음 (Race Condition)

삭제 방식:
  어떤 순서로 삭제해도 결과는 같음 (멱등성)
  다음 읽기 요청이 최신 데이터를 DB에서 가져옴
```

---

## 장단점

**장점:**
- 실제 요청된 데이터만 캐시에 올라감 → 메모리 효율적
- 캐시가 다운돼도 DB로 fallback 가능 → 장애 허용성
- 구현이 단순, 어떤 DB에도 적용 가능

**단점:**
- Cold Miss: 처음 요청은 항상 느림 (DB 조회 + 캐시 저장)
- Cache Stampede: 캐시 만료 시 동시 요청이 DB 폭격 가능
- 데이터 불일치: DB 변경 후 캐시 삭제 전까지 오래된 데이터 노출

---

## 언제 쓰나

```
✅ 읽기 비율이 높은 서비스 (읽기 80%, 쓰기 20%)
✅ 데이터가 모두 캐시되지 않아도 되는 경우
✅ 캐시 장애에 tolerant해야 하는 경우
✅ 대부분의 일반적인 웹 서비스
```

실무에서 **가장 많이 쓰이는 패턴**입니다. 모르겠으면 Cache-Aside부터 시작하면 됩니다.

---

## 핵심 요약

- 읽기: 캐시 먼저 → MISS면 DB → 캐시에 저장
- 쓰기: DB 업데이트 → 캐시 **삭제** (업데이트 X)
- 삭제하는 이유: Race Condition 방지, 멱등성 보장
- 가장 흔하고 안전한 패턴
