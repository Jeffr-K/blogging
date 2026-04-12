---
title: "LFU를 O(1)로 구현하기"
date: 2026-04-12
tags: [cache, eviction, lfu, implementation, algorithm]
---

## 핵심 아이디어

LFU를 O(1)로 구현하려면 세 가지를 빠르게 처리해야 합니다:

1. **키 → 값 조회**: O(1) → HashMap
2. **키 → 빈도 관리**: O(1) → HashMap
3. **빈도 → 해당 빈도의 키 목록**: O(1) → HashMap of OrderedDict
4. **최소 빈도 추적**: 정수 변수 하나

---

## 완전한 구현

```python
from collections import defaultdict, OrderedDict

class LFUCache:
    """
    get(key): O(1)
    put(key, val): O(1)

    자료구조:
      key_val:   {key → value}
      key_freq:  {key → frequency}
      freq_keys: {freq → OrderedDict{key: None}}  ← freq 버킷별 LRU
      min_freq:  현재 최소 빈도
    """
    def __init__(self, capacity: int):
        self.cap = capacity
        self.min_freq = 0
        self.key_val: dict = {}
        self.key_freq: dict = {}
        self.freq_keys: dict = defaultdict(OrderedDict)

    def _increment_freq(self, key: str) -> None:
        """key의 빈도를 1 올리고 버킷 갱신"""
        freq = self.key_freq[key]
        new_freq = freq + 1
        self.key_freq[key] = new_freq

        # 현재 빈도 버킷에서 제거
        del self.freq_keys[freq][key]
        if not self.freq_keys[freq]:
            del self.freq_keys[freq]
            if self.min_freq == freq:
                self.min_freq = new_freq  # min_freq도 갱신

        # 새 빈도 버킷에 추가 (가장 최근 = 맨 뒤)
        self.freq_keys[new_freq][key] = None

    def get(self, key: str) -> int:
        if key not in self.key_val:
            return -1
        self._increment_freq(key)
        return self.key_val[key]

    def put(self, key: str, val: int) -> None:
        if self.cap <= 0:
            return

        if key in self.key_val:
            self.key_val[key] = val
            self._increment_freq(key)
            return

        # 용량 초과 시 min_freq 버킷의 LRU 항목 제거
        if len(self.key_val) >= self.cap:
            # freq_keys[min_freq]의 맨 앞 = 가장 오래된 LFU 항목
            evict_key, _ = self.freq_keys[self.min_freq].popitem(last=False)
            del self.key_val[evict_key]
            del self.key_freq[evict_key]

        # 새 항목 삽입 (freq=1)
        self.key_val[key] = val
        self.key_freq[key] = 1
        self.freq_keys[1][key] = None
        self.min_freq = 1  # 새 항목이 항상 최소 빈도
```

---

## 상태 변화 시각화

```
초기 (capacity=3):
  key_val:  {}
  key_freq: {}
  freq_keys: {}

put("A", 1):
  key_val:  {A:1}
  key_freq: {A:1}
  freq_keys: {1: [A]}
  min_freq: 1

put("B", 2), put("C", 3):
  key_val:  {A:1, B:2, C:3}
  key_freq: {A:1, B:1, C:1}
  freq_keys: {1: [A, B, C]}
  min_freq: 1

get("A"):
  key_freq: {A:2, B:1, C:1}
  freq_keys: {1: [B, C], 2: [A]}
  min_freq: 1 (변화 없음, 1 버킷에 B,C 남음)

get("A"):
  key_freq: {A:3, B:1, C:1}
  freq_keys: {1: [B, C], 3: [A]}
  min_freq: 1

put("D", 4):  → 용량 초과, min_freq=1의 LRU인 B 제거
  key_val:  {A:1, C:3, D:4}
  key_freq: {A:3, C:1, D:1}
  freq_keys: {1: [C, D], 3: [A]}
  min_freq: 1
```

---

## 동점 처리: LRU로

같은 빈도에서 누구를 제거할지: **그 빈도 중에서 가장 오래된(LRU) 항목**

OrderedDict가 삽입 순서를 유지하므로 `popitem(last=False)`로 가장 오래된 항목 O(1) 제거.

---

## 테스트

```python
cache = LFUCache(2)

cache.put("A", 1)
cache.put("B", 2)
cache.get("A")        # A freq: 2, B freq: 1
cache.put("C", 3)     # B 제거 (min_freq=1에서 LRU)
assert cache.get("B") == -1   # B 없음
assert cache.get("A") == 1    # A 있음
assert cache.get("C") == 3    # C 있음
print("OK")
```

---

## 복잡도

```
get(key): O(1)
put(key): O(1)
공간:     O(capacity)
```

---

## 핵심 요약

- 세 개의 HashMap으로 O(1) LFU 구현
- freq_keys: 빈도별 키 목록 (OrderedDict = LRU 동점 처리)
- min_freq: 가장 낮은 빈도 추적
- 새 항목 삽입 시 min_freq = 1로 초기화
- 동점 시 LRU 기준으로 제거 (OrderedDict의 popitem(last=False))
