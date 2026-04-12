---
title: "FIFO / Random: 단순하지만 쓰이는 곳이 있다"
date: 2026-04-12
tags: [cache, eviction, fifo, random]
---

## FIFO (First In, First Out)

**가장 먼저 들어온 데이터를 가장 먼저 제거**합니다. 큐(Queue) 구조입니다.

```
삽입 순서: A → B → C → D (캐시 용량: 3)
현재: [A, B, C]
D 삽입 → A 제거 (가장 먼저 들어옴) → [B, C, D]
```

### 특징

```
장점:
  - 구현이 매우 단순 (Queue만 있으면 됨)
  - 예측 가능한 동작

단점:
  - 접근 빈도나 최근성을 전혀 고려하지 않음
  - 오래됐지만 자주 쓰이는 데이터가 제거될 수 있음

예시 문제:
  A: 처음에 넣음, 지금도 매초 100번 접근
  D: 방금 넣음, 아직 한 번도 안 씀
  → FIFO는 A를 제거! (명백히 나쁜 선택)
```

### 언제 쓰나

```
✅ HTTP 요청 큐 (선착순 처리)
✅ 메시지 큐 시스템 (순서 보장이 중요)
✅ 데이터가 모두 동일한 중요도일 때
❌ 일반적인 캐시 용도 (LRU/LFU가 훨씬 나음)
```

---

## Random Eviction

**무작위로 항목을 선택해 제거**합니다.

```python
import random

class RandomCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.cache = {}

    def put(self, key, value):
        if len(self.cache) >= self.capacity:
            # 랜덤으로 하나 골라서 제거
            evict_key = random.choice(list(self.cache.keys()))
            del self.cache[evict_key]
        self.cache[key] = value
```

### 특징

```
장점:
  - 구현 매우 단순
  - 오버헤드 거의 없음
  - 예측 불가능성이 오히려 특정 패턴의 공격을 막을 수 있음

단점:
  - 중요한 데이터도 운 나쁘면 제거됨
  - 평균적으로 LRU보다 성능 낮음
```

### Redis의 Random

```bash
maxmemory-policy allkeys-random  # 모든 키 중 랜덤 제거
```

실제로 Redis에 있는 정책이지만 일반적으로는 추천되지 않습니다.

---

## Memcached의 Slab Allocator + LRU

Memcached는 순수 LRU가 아닙니다. 메모리를 고정 크기 슬랩(Slab)으로 나누고, 각 슬랩 내에서 LRU를 적용합니다.

```
Slab 1: 64바이트 이하 항목 → 자체 LRU
Slab 2: 128바이트 이하 항목 → 자체 LRU
Slab 3: 256바이트 이하 항목 → 자체 LRU
...
```

슬랩 간 메모리 공유가 안 돼서 **특정 크기의 데이터가 많으면 해당 슬랩만 꽉 찰 수 있는** 문제가 있습니다.

---

## 정리: Eviction 정책 비교

| 정책 | 기준 | 구현 복잡도 | 실무 사용 |
|------|------|------------|---------|
| FIFO | 삽입 순서 | 매우 낮음 | 드묾 |
| Random | 무작위 | 매우 낮음 | 드묾 |
| LRU | 최근 사용 시점 | 중간 | 많음 |
| LFU | 사용 빈도 | 높음 | 중간 |
| W-TinyLFU | 빈도+최근성 | 매우 높음 | Caffeine/Redis |

---

## 핵심 요약

- FIFO: 삽입 순서 기반, 단순하지만 캐시 용도에는 부적합
- Random: 무작위, 오버헤드 없지만 비효율적
- 일반 캐시에는 LRU 이상을 써야 합니다
- FIFO는 메시지 큐 등 순서가 중요한 시스템에 적합
