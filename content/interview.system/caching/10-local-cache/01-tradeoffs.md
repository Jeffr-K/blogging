---
title: "로컬 캐시 vs 분산 캐시"
date: 2026-04-12
tags: [cache, local-cache, distributed-cache, tradeoffs]
---

## 로컬 캐시란

각 애플리케이션 서버의 메모리 내에 저장되는 캐시입니다.

```
분산 캐시:
  [Server 1] → Redis → DB
  [Server 2] → Redis → DB
  [Server 3] → Redis → DB
  모든 서버가 같은 Redis 공유

로컬 캐시:
  [Server 1: 자체 캐시]
  [Server 2: 자체 캐시]  ← 각자 독립적 캐시
  [Server 3: 자체 캐시]
```

---

## 성능 비교

```
L1 캐시 (CPU): ~1ns
로컬 캐시 (Caffeine/메모리): ~100ns~1μs
Redis (localhost): ~100μs~1ms
Redis (네트워크): ~1~5ms
DB 쿼리: ~1~100ms
```

로컬 캐시는 Redis보다 **10~100배 빠릅니다.**

---

## 장단점 비교

| | 로컬 캐시 | 분산 캐시 (Redis) |
|--|-----------|-----------------|
| 속도 | 매우 빠름 (μs) | 빠름 (ms) |
| 네트워크 비용 | 없음 | 있음 |
| 메모리 | 서버당 독립 | 중앙 공유 |
| 일관성 | ❌ (서버마다 다를 수 있음) | ✅ (중앙화) |
| 용량 | 제한적 (서버 RAM) | 대용량 |
| 캐시 무효화 | 복잡 (L1 무효화) | 단순 |
| 서버 재시작 | 캐시 소멸 | 유지 |

---

## 언제 로컬 캐시를 쓰나

```
✅ 좋은 케이스:
  - 읽기 전용 설정 데이터 (feature flags, 코드표)
  - 변경이 드문 참조 데이터 (국가 코드, 카테고리)
  - Hot Key 문제 완화 (Redis 부하 분산)
  - 초저지연이 필요한 경우

❌ 나쁜 케이스:
  - 실시간 데이터 (재고, 포인트)
  - 여러 서버 간 일관성이 중요한 데이터
  - 데이터가 자주 변경되는 경우
  - 많은 메모리 필요 (서버 RAM 한계)
```

---

## 일관성 문제

```
Server-1의 로컬 캐시: user:42 = {name: "Alice"}
Server-2의 로컬 캐시: user:42 = {name: "Alice"}

DB: UPDATE users SET name = "Alice K" WHERE id = 42

Server-1: user:42 갱신됨 → {name: "Alice K"}
Server-2: 로컬 캐시 그대로 → {name: "Alice"}  ← 불일치!

→ 같은 유저의 요청이 어느 서버로 가느냐에 따라 다른 응답
```

**해결책:** 짧은 TTL + Redis 무효화 메시지 (L1 Cache Invalidation, 15장)

---

## 핵심 요약

- 로컬 캐시: 각 서버 메모리 → 네트워크 없음 → 마이크로초
- Redis보다 10~100배 빠르지만 서버간 불일치 위험
- 변경 없는 설정 데이터, Hot Key 완화에 최적
- 자주 변경되는 데이터에는 부적합 (TTL을 매우 짧게)
