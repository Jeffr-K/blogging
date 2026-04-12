---
title: "LRU (Least Recently Used): 가장 오래 안 쓴 것을 버린다"
date: 2026-04-12
tags: [cache, eviction, lru]
---

## LRU란

캐시가 가득 찼을 때, **가장 오랫동안 사용되지 않은 항목을 제거**하는 알고리즘입니다.

```
접근 순서: A → B → C → A → D (캐시 용량: 3)

현재 상태:   [A, B, C] (A가 최근, C가 가장 오래됨)
D 삽입 시: C 제거 → [A, B, D]에서 D가 최근, B가 가장 오래됨 → [D, A, B]
```

---

## 왜 LRU가 좋은가

**시간 지역성(Temporal Locality)** 을 활용합니다.

```
최근에 접근한 데이터 = 가까운 미래에 또 접근할 가능성 높음
오래 안 쓴 데이터   = 앞으로도 안 쓸 가능성 높음
```

웹 서비스에서 인기 상품은 계속 조회되고, 오래된 상품은 거의 조회되지 않습니다. LRU는 이 패턴에 잘 맞습니다.

---

## O(1) LRU 구현: HashMap + Doubly Linked List

단순히 리스트로 구현하면 O(n)이지만, 두 자료구조를 결합하면 O(1)이 됩니다.

```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()  # 삽입 순서 유지

    def get(self, key: str):
        if key not in self.cache:
            return None
        # 최근 사용으로 표시 (맨 끝으로 이동)
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key: str, value):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            # 가장 오래된 항목(맨 앞) 제거
            self.cache.popitem(last=False)
```

```python
# 테스트
cache = LRUCache(3)
cache.put("A", 1)
cache.put("B", 2)
cache.put("C", 3)
cache.get("A")      # A 최근 사용으로 갱신
cache.put("D", 4)   # B가 가장 오래됨 → B 제거
print(list(cache.cache.keys()))  # ['C', 'A', 'D']
```

---

## 직접 구현: HashMap + DLL

```python
class Node:
    def __init__(self, key=None, val=None):
        self.key = key
        self.val = val
        self.prev = None
        self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.map = {}               # key → Node
        # 더미 헤드/테일 (가장 오래됨 ← head ↔ tail → 가장 최근)
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove(self, node: Node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def _insert_tail(self, node: Node):
        prev = self.tail.prev
        prev.next = node
        node.prev = prev
        node.next = self.tail
        self.tail.prev = node

    def get(self, key: str):
        if key not in self.map:
            return -1
        node = self.map[key]
        self._remove(node)
        self._insert_tail(node)     # 최근 사용으로 이동
        return node.val

    def put(self, key: str, val):
        if key in self.map:
            self._remove(self.map[key])
        node = Node(key, val)
        self.map[key] = node
        self._insert_tail(node)
        if len(self.map) > self.cap:
            lru = self.head.next    # 가장 오래된 노드
            self._remove(lru)
            del self.map[lru.key]
```

---

## Redis의 LRU

```bash
# maxmemory 설정 후 eviction 정책
maxmemory 1gb
maxmemory-policy allkeys-lru    # 모든 키 중 LRU
# maxmemory-policy volatile-lru  # TTL 있는 키만 LRU
```

Redis는 **근사 LRU**를 씁니다. 전체 키를 정렬하지 않고 랜덤으로 N개 샘플링 후 가장 오래된 것을 제거합니다. (`maxmemory-samples` 설정으로 샘플 수 조정)

---

## LRU의 약점

**Cache Pollution (캐시 오염):** 일회성으로 큰 데이터를 읽으면 자주 쓰던 데이터들이 밀려남

```
평소: [인기A, 인기B, 인기C]  (히트율 99%)
대용량 배치 실행: 1만 개 데이터 순차 읽기
→ [배치N, 배치N-1, ..., 배치1]  (인기 데이터 전부 밀려남!)
다음 요청: 히트율 급감
```

해결: **LFU**(사용 빈도 기반)나 **W-TinyLFU** 사용

---

## 핵심 요약

- 가장 오래 안 쓴 항목 제거
- 시간 지역성을 활용 → 대부분의 워크로드에 효과적
- O(1) 구현: HashMap + Doubly Linked List
- Redis: 근사 LRU 사용 (`maxmemory-policy allkeys-lru`)
- 약점: 일회성 대용량 읽기 시 캐시 오염
