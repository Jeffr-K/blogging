---
title: "LFU (Least Frequently Used): 가장 적게 쓴 것을 버린다"
date: 2026-04-12
tags: [cache, eviction, lfu]
---

## LFU란

캐시가 가득 찼을 때, **접근 빈도(frequency)가 가장 낮은 항목을 제거**합니다.

```
접근 기록:
  A: 10회  B: 3회  C: 7회  D: 1회

캐시 가득 참 → D(1회) 제거
```

LRU가 "언제 썼냐"를 보는 반면, LFU는 "얼마나 썼냐"를 봅니다.

---

## LFU가 LRU보다 나은 경우

```
인기 상품: 하루 1만 번 조회 (frequency: 10000)
신규 상품: 방금 1번 조회   (frequency: 1)

LRU: 신규 상품이 가장 최근 → 인기 상품이 밀려날 수 있음
LFU: 신규 상품이 가장 낮은 빈도 → 신규 상품 제거 (더 합리적)
```

---

## O(1) LFU 구현

HashMap + HashMap + Doubly Linked List로 O(1) 구현이 가능합니다.

```python
from collections import defaultdict, OrderedDict

class LFUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.min_freq = 0
        self.key_val = {}                           # key → value
        self.key_freq = {}                          # key → frequency
        self.freq_keys = defaultdict(OrderedDict)   # freq → {key: None} (순서 유지)

    def _update_freq(self, key: str):
        freq = self.key_freq[key]
        self.key_freq[key] = freq + 1

        # 현재 빈도 버킷에서 제거
        del self.freq_keys[freq][key]
        if not self.freq_keys[freq]:
            del self.freq_keys[freq]
            if self.min_freq == freq:
                self.min_freq += 1

        # 새 빈도 버킷에 추가
        self.freq_keys[freq + 1][key] = None

    def get(self, key: str):
        if key not in self.key_val:
            return -1
        self._update_freq(key)
        return self.key_val[key]

    def put(self, key: str, value):
        if self.cap <= 0:
            return

        if key in self.key_val:
            self.key_val[key] = value
            self._update_freq(key)
            return

        # 용량 초과 시 LFU 항목 제거
        if len(self.key_val) >= self.cap:
            # min_freq 버킷에서 가장 오래된 항목 제거 (LRU 동점 처리)
            evict_key, _ = self.freq_keys[self.min_freq].popitem(last=False)
            del self.key_val[evict_key]
            del self.key_freq[evict_key]

        # 새 항목 삽입 (빈도=1)
        self.key_val[key] = value
        self.key_freq[key] = 1
        self.freq_keys[1][key] = None
        self.min_freq = 1
```

---

## LFU의 단점: 오래된 인기 데이터 문제

```
1월: 겨울 패딩 상품 → 100만 회 조회 (frequency: 1000000)
7월: 겨울 패딩 상품 → 아무도 안 봄 (frequency 여전히 1000000)

   → LFU는 겨울 패딩을 절대 제거하지 않음!
   → 정작 지금 인기 있는 여름 상품이 밀려남
```

이 문제를 **Frequency Aging** 이라고 합니다.

해결: 주기적으로 모든 카운터를 절반으로 감소 (Decay), 또는 **W-TinyLFU** 사용

---

## Redis LFU 설정

```bash
maxmemory-policy allkeys-lfu   # 모든 키 중 LFU
# maxmemory-policy volatile-lfu # TTL 있는 키만 LFU

# LFU 파라미터 튜닝
lfu-log-factor 10    # 히트 카운터 증가 확률 제어 (기본 10)
lfu-decay-time 1     # N분마다 카운터 감소 (Aging, 기본 1분)
```

Redis의 LFU는 카운터에 **확률적 증가** + **시간 기반 감소(Decay)** 를 결합해서 위의 단점을 완화합니다.

---

## LRU vs LFU 선택

| 상황 | 추천 |
|------|------|
| 인기도가 시간에 따라 변함 | LRU |
| 인기 항목이 오래 지속됨 | LFU |
| 일회성 대용량 스캔 있음 | LFU (캐시 오염 방지) |
| 일반적인 웹 서비스 | LRU (단순하고 충분히 효과적) |

---

## 핵심 요약

- 접근 빈도가 가장 낮은 항목 제거
- O(1) 구현: key_val, key_freq, freq_keys 세 가지 HashMap
- LRU보다 캐시 오염에 강함
- 단점: 오래된 인기 항목이 영구히 자리 차지 (Aging 문제)
- Redis: `lfu-decay-time`으로 Aging 완화
