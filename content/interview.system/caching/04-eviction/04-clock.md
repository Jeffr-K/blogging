---
title: "CLOCK (Second Chance): LRU의 하드웨어 친화적 근사"
date: 2026-04-12
tags: [cache, eviction, clock, second-chance]
---

## CLOCK 알고리즘이란

LRU는 모든 항목에 타임스탬프를 기록해야 해서 오버헤드가 있습니다. CLOCK은 **비트 하나(reference bit)만으로 LRU를 근사**합니다. OS의 페이지 교체 알고리즘으로도 유명합니다.

---

## 동작 원리

```
캐시 항목을 원형 리스트(시계)로 배치
각 항목에 reference bit (0 or 1)

접근 시: reference bit = 1로 설정

제거 시 (시계 바늘이 순서대로 순회):
  reference bit = 1 → 0으로 바꾸고 통과 (Second Chance)
  reference bit = 0 → 제거! (한 번도 사용 안 됨)
```

```
초기 상태:
  → [A(1)] → [B(0)] → [C(1)] → [D(0)] →
    ↑ 시계 바늘

새 항목 E 삽입 필요:
  A: bit=1 → 0으로 바꾸고 통과 → [A(0)]
  B: bit=0 → 제거! E로 교체
  결과: [A(0)] → [E(1)] → [C(1)] → [D(0)]
```

---

## Python 구현

```python
class ClockCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}            # key → value
        self.keys = [None] * capacity  # 원형 버퍼
        self.refs = [0] * capacity     # reference bits
        self.hand = 0                  # 시계 바늘

    def _evict(self) -> int:
        """제거할 슬롯 인덱스 반환"""
        while True:
            if self.refs[self.hand] == 0:
                slot = self.hand
                self.hand = (self.hand + 1) % self.capacity
                return slot
            # Second Chance: 1 → 0으로 바꾸고 통과
            self.refs[self.hand] = 0
            self.hand = (self.hand + 1) % self.capacity

    def get(self, key: str):
        if key not in self.cache:
            return None
        slot, value = self.cache[key]
        self.refs[slot] = 1  # 접근 시 reference bit 설정
        return value

    def put(self, key: str, value):
        if key in self.cache:
            slot, _ = self.cache[key]
            self.cache[key] = (slot, value)
            self.refs[slot] = 1
            return

        slot = self._evict()
        old_key = self.keys[slot]
        if old_key and old_key in self.cache:
            del self.cache[old_key]

        self.keys[slot] = key
        self.refs[slot] = 1
        self.cache[key] = (slot, value)
```

---

## LRU와의 차이점

| | LRU | CLOCK |
|--|-----|-------|
| 기준 | 정확한 최근 사용 시점 | Reference bit (최근 사용 여부만) |
| 메모리 | 타임스탬프 저장 | 비트 하나만 |
| 복잡도 | HashMap + DLL | 원형 배열 |
| 정확도 | 정확한 LRU | LRU 근사 |
| 사용처 | 소프트웨어 캐시 | OS 페이지 교체, 하드웨어 |

---

## 실무에서 CLOCK

직접 CLOCK을 구현할 일은 많지 않습니다. 하지만 OS 내부에서는 광범위하게 사용됩니다:

- **Linux/Windows 가상 메모리**: 페이지 교체 알고리즘
- **CPU L2/L3 캐시 제어기**: 하드웨어 구현
- **일부 DB Buffer Pool**: MySQL InnoDB의 LRU는 CLOCK 변형

Redis나 Memcached를 쓴다면 직접 CLOCK을 볼 일은 없지만, OS 면접이나 시스템 레벨 면접에서는 자주 나옵니다.

---

## 핵심 요약

- 원형 리스트 + reference bit으로 LRU 근사
- 접근 시 bit=1, 교체 시 bit=0으로 바꾸고 한번 더 기회(Second Chance)
- 메모리 효율적, 하드웨어 구현에 적합
- OS 페이지 교체 알고리즘의 핵심
