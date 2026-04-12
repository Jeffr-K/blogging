---
title: "W-TinyLFU: Caffeine과 Redis가 쓰는 최신 알고리즘"
date: 2026-04-12
tags: [cache, eviction, w-tinylfu, caffeine]
---

## W-TinyLFU란

**Window TinyLFU**의 약자. LRU의 최근성과 LFU의 빈도를 결합한 현대적 알고리즘으로, **Caffeine(Java)**과 **Redis 4.0+의 LFU 정책**에서 사용합니다.

---

## 기존 알고리즘들의 한계

```
LRU 문제: 일회성 대용량 스캔 → 캐시 오염
LFU 문제: 오래된 인기 데이터가 영구히 자리 차지 (Frequency Aging)
```

W-TinyLFU는 두 문제를 모두 해결합니다.

---

## 구조

```
                 ┌─────────────┐
새 항목 →        │  Window LRU │ (1% 용량)
                 │  (최신 항목) │
                 └──────┬──────┘
                        │ 넘치면
                 ┌──────▼──────┐      ┌──────────────┐
                 │  TinyLFU    │ 비교 │  Main Cache  │
                 │  (빈도 필터) │ ───→ │  (99% 용량)  │
                 └─────────────┘      │ 80% Protected│
                                      │ 20% Probation│
                                      └──────────────┘
```

### Window LRU (1% 크기)

새로 들어오는 모든 항목을 받아들이는 작은 LRU 영역. "모든 항목에게 한 번의 기회"를 줍니다.

### Main Cache (99% 크기)

- **Protected** (80%): 자주 접근하는 안정적인 항목
- **Probation** (20%): 새로 올라온 항목, 더 검증 필요

### TinyLFU 빈도 필터

항목을 Main Cache에 올릴 때, **새 항목의 빈도가 퇴출 대상보다 높아야 교체**합니다.

```
새 항목 빈도 > 퇴출 대상 빈도 → 교체 OK
새 항목 빈도 ≤ 퇴출 대상 빈도 → 교체 거부 (기존 유지)
```

---

## Count-Min Sketch: 메모리 효율적 빈도 추적

모든 항목의 정확한 빈도를 저장하면 메모리가 너무 많이 필요합니다. W-TinyLFU는 **Count-Min Sketch**를 사용해 근사적으로 빈도를 추적합니다.

```python
class CountMinSketch:
    def __init__(self, width=1000, depth=4):
        self.width = width
        self.depth = depth
        self.table = [[0] * width for _ in range(depth)]
        self.hash_seeds = [random.randint(0, 2**32) for _ in range(depth)]

    def increment(self, key: str):
        for i in range(self.depth):
            j = hash(key + str(self.hash_seeds[i])) % self.width
            self.table[i][j] += 1

    def estimate(self, key: str) -> int:
        return min(
            self.table[i][hash(key + str(self.hash_seeds[i])) % self.width]
            for i in range(self.depth)
        )
```

항목당 몇 비트만으로 빈도 근사 가능 → 수백만 항목도 수 MB로 처리

---

## Aging (주기적 감소)

카운터가 너무 커지면 최근 트렌드를 반영 못합니다. 주기적으로 **모든 카운터를 절반으로 나눔**:

```python
def reset(sketch):
    for i in range(sketch.depth):
        for j in range(sketch.width):
            sketch.table[i][j] //= 2  # 주기적으로 halving
```

이렇게 하면 오래된 인기 항목의 카운터가 점진적으로 줄어들어 LFU의 Aging 문제를 해결합니다.

---

## Caffeine 성능

Java 벤치마크 (Zipf 분포 워크로드):

```
캐시 크기: 1000개, 요청: 100만 개

히트율:
  LRU:         63.5%
  LFU:         70.1%
  W-TinyLFU:   77.9%   ← 가장 높음
```

---

## 실무에서

```java
// Caffeine 사용 (자동으로 W-TinyLFU)
Cache<String, User> cache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(5, TimeUnit.MINUTES)
    .build();

// Spring Boot + Caffeine
spring.cache.caffeine.spec=maximumSize=10000,expireAfterWrite=5m
```

```bash
# Redis LFU (내부적으로 W-TinyLFU 근사)
maxmemory-policy allkeys-lfu
lfu-log-factor 10
lfu-decay-time 1
```

---

## 핵심 요약

- LRU(최근성) + LFU(빈도)의 결합
- Window(1%) + Main(99%) 구조로 새 항목에 기회를 주면서도 빈도 기반 교체
- Count-Min Sketch로 메모리 효율적 빈도 추적
- Caffeine, Redis LFU에서 사용
- 일반적인 워크로드에서 LRU보다 10~20% 히트율 향상
