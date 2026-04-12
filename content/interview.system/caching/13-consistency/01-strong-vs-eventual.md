---
title: "강한 일관성 vs 최종 일관성"
date: 2026-04-12
tags: [cache, consistency, strong-consistency, eventual-consistency]
---

## 일관성이란

데이터를 쓴 후 읽을 때 어떤 값을 볼 수 있는가의 문제입니다.

---

## 강한 일관성 (Strong Consistency)

쓰기 후 모든 읽기는 즉시 최신 값을 반환합니다.

```
T=0: Writer가 name = "Alice K" 로 업데이트
T=1: Reader A가 읽음 → "Alice K" (최신 값)
T=1: Reader B가 읽음 → "Alice K" (최신 값)
```

```python
# 강한 일관성 구현: 캐시 업데이트 동기 처리
def update_user_strong(user_id: int, data: dict):
    with distributed_lock(f"user:{user_id}"):
        db.update(user_id, data)
        redis.setex(f"user:{user_id}", 3600, serialize(data))
        # 이 함수가 반환되는 순간 모든 읽기가 새 값 봄
```

**비용:** 쓰기 시 락 + 동기 캐시 업데이트 → 지연시간 증가

---

## 최종 일관성 (Eventual Consistency)

쓰기 후 잠시 구버전이 보일 수 있지만, 결국엔 모든 노드가 최신 값으로 수렴합니다.

```
T=0: Writer가 name = "Alice K" 로 업데이트
T=1: Reader A가 읽음 → "Alice" (아직 구버전, 캐시 TTL 남음)
T=2: Reader B가 읽음 → "Alice K" (캐시 무효화 후 DB에서 읽음)
T=61: TTL 만료 후 → 모든 읽기가 "Alice K"
```

```python
# 최종 일관성: 캐시 삭제 후 다음 읽기 시 갱신
def update_user_eventual(user_id: int, data: dict):
    db.update(user_id, data)
    redis.delete(f"user:{user_id}")
    # 삭제와 다음 Cache-Aside 읽기 사이에 구버전 캐시 없음
    # 하지만 삭제 전에 다른 서버에서 읽고 있는 중이면 구버전 반환
```

**비용:** 일시적 불일치 허용 → 쓰기 빠름

---

## 어느 수준이 필요한가

```
강한 일관성이 필요한 경우:
  - 금융 잔액 (잔액이 틀리면 안 됨)
  - 재고 (oversell 방지)
  - 인증 토큰 (로그아웃 즉시 무효화)

최종 일관성으로 충분한 경우:
  - 사용자 프로필 (1분 구버전 허용)
  - 상품 설명 (잠깐 구버전 OK)
  - 뉴스 피드
  - 랭킹 (1~5초 지연 OK)
  - 조회수, 좋아요 수
```

---

## 캐시에서의 일관성 수준

```
TTL 기반 (가장 약한):
  write → 기존 캐시 그대로, TTL 만료 시 자동 갱신
  불일치 시간 = TTL (최대 수십분)

캐시 삭제 (보통):
  write → delete(key) → 다음 읽기 시 DB에서 갱신
  불일치 시간 = write-to-delete 사이 (~ms~수초)

Write-Through (강한):
  write → DB + 캐시 동시 업데이트
  불일치 시간 = 거의 없음 (순서 역전 위험 있음)

분산 락 + Write-Through (가장 강한):
  write → 락 획득 → DB + 캐시 → 락 해제
  불일치 없음, 대신 쓰기 지연 증가
```

---

## 실무 조언

```
99%의 경우 최종 일관성으로 충분합니다.
  → TTL + 캐시 삭제 조합

1%: 강한 일관성 필요
  → 캐시 없이 DB에서 직접 읽기
  또는 → 분산 락 + Write-Through

"캐시를 쓰는 순간 일관성을 포기한 것"
  → 어느 정도의 지연을 허용할지 명시적으로 결정
```

---

## 핵심 요약

- 강한 일관성: 쓰기 후 즉시 모든 읽기가 최신 값 (비용 높음)
- 최종 일관성: 결국 수렴하지만 일시적 불일치 허용 (빠름)
- 캐시 = 기본적으로 최종 일관성
- 강한 일관성 필요 → 캐시를 쓰지 말거나 분산 락 + 동기 업데이트
- 대부분의 캐시 시나리오: 최종 일관성으로 충분
