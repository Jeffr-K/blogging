---
title: "전략 선택 가이드: 어떤 캐시 전략을 써야 하나"
date: 2026-04-12
tags: [cache, strategy, guide]
---

## 한 장 요약

```
읽기 전략
  ├── 캐시 로직을 직접 제어하고 싶다         → Cache-Aside
  ├── 선언형으로 깔끔하게 쓰고 싶다          → Read-Through (@Cacheable)
  └── 만료 시 레이턴시 spike가 걱정된다      → Refresh-Ahead

쓰기 전략
  ├── 가장 단순하게                          → Cache-Aside (쓰기 후 캐시 삭제)
  ├── 읽기 성능이 매우 중요하다              → Write-Through
  ├── 쓰기 성능이 매우 중요하다              → Write-Back (유실 허용 시)
  └── 쓰고 잘 안 읽히는 데이터다            → Write-Around
```

---

## 결정 트리

```
데이터 특성이 뭔가?
  │
  ├── 주문/결제/재고 (유실 절대 안 됨)
  │     → Write-Through + Cache-Aside (읽기)
  │
  ├── 조회수/좋아요 (약간 유실 허용)
  │     → Write-Back
  │
  ├── 로그/아카이브 (쓰고 잘 안 읽힘)
  │     → Write-Around
  │
  └── 일반 CRUD (프로필, 상품 등)
        │
        ├── 읽기 훨씬 많음 (Read-Heavy)
        │     → Cache-Aside or Read-Through
        │
        └── 쓰기도 꽤 많음 (Write-Heavy)
              → Cache-Aside + 짧은 TTL
```

---

## 실무 조합 패턴

실제 서비스에서는 하나만 쓰지 않습니다. 데이터 특성에 따라 섞어서 씁니다.

### 이커머스 상품 서비스

```python
# 상품 조회: Cache-Aside (Read-Heavy)
@Cacheable("products")
def get_product(product_id): ...

# 상품 수정: Write-Through (쓰고 바로 읽힘)
@CachePut("products")
def update_product(product_id, data): ...

# 조회수: Write-Back (유실 허용)
def increment_view_count(product_id):
    redis.incr(f"views:{product_id}")
    # 백그라운드 플러시

# 상품 로그: Write-Around (잘 안 읽힘)
def log_product_event(product_id, event): ...
```

### SNS 피드 서비스

```python
# 피드 읽기: Cache-Aside + Refresh-Ahead
# 좋아요: Write-Back
# 게시글 작성: Write-Around (다른 사람 피드가 각자 캐시됨)
```

---

## 트레이드오프 매트릭스

| 전략 | 읽기 성능 | 쓰기 성능 | 일관성 | 복잡도 | 유실 위험 |
|------|---------|---------|-------|-------|---------|
| Cache-Aside | 보통 | 빠름 | 보통 | 낮음 | 없음 |
| Read-Through | 보통 | - | 보통 | 낮음 | 없음 |
| Refresh-Ahead | 높음 | - | 보통 | 중간 | 없음 |
| Write-Through | 높음 | 느림 | 높음 | 낮음 | 없음 |
| Write-Back | 높음 | 빠름 | 낮음 | 높음 | **있음** |
| Write-Around | 낮음 | 빠름 | 높음 | 낮음 | 없음 |

---

## 실무 권장 기본값

**모르겠으면 Cache-Aside (읽기) + 캐시 삭제 (쓰기)**

이유:
- 구현이 가장 단순
- 어떤 DB, 어떤 캐시에도 적용 가능
- 장애 시 안전 (캐시 없어도 DB fallback)
- 데이터 유실 없음

---

## 핵심 요약

- 정답인 전략은 없다. 데이터 특성에 따라 선택
- 유실 허용 여부가 가장 중요한 분기점
- 모르겠으면 Cache-Aside가 가장 안전
- 실제 서비스는 여러 전략을 데이터마다 다르게 적용
