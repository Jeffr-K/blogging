---
title: "LRU를 O(1)로 구현하기"
date: 2026-04-12
tags: [cache, eviction, lru, implementation, algorithm]
---

## 왜 O(1)이 필요한가

LRU를 단순하게 구현하면:

```python
# 단순 리스트 구현: O(n)
class NaiveLRU:
    def get(self, key):
        if key in self.cache:
            self.cache.remove(key)   # O(n) 탐색
            self.cache.append(key)   # O(1)
```

캐시가 10만 개면 get/put마다 10만 번 순회. 실용적이지 않습니다.

**O(1)을 위한 핵심 아이디어:**
- **HashMap**: O(1) 키 조회
- **Doubly Linked List**: O(1) 노드 이동 (앞뒤 포인터로 바로 연결)

---

## 완전한 구현

```python
class Node:
    __slots__ = ('key', 'val', 'prev', 'next')

    def __init__(self, key=0, val=0):
        self.key = key
        self.val = val
        self.prev = None
        self.next = None


class LRUCache:
    """
    get(key): O(1)
    put(key, val): O(1)

    구조:
      map: {key → Node}
      DLL: head ↔ [LRU] ↔ ... ↔ [MRU] ↔ tail
           가장 오래됨 ←────────────→ 가장 최근
    """
    def __init__(self, capacity: int):
        self.cap = capacity
        self.map: dict[str, Node] = {}

        # 더미 sentinel 노드 (경계 처리 단순화)
        self.head = Node()  # ← 가장 오래된 쪽
        self.tail = Node()  # ← 가장 최근 쪽
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove(self, node: Node) -> None:
        """노드를 DLL에서 제거 (O(1))"""
        node.prev.next = node.next
        node.next.prev = node.prev

    def _insert_before_tail(self, node: Node) -> None:
        """노드를 tail 앞(MRU 위치)에 삽입 (O(1))"""
        prev = self.tail.prev
        prev.next = node
        node.prev = prev
        node.next = self.tail
        self.tail.prev = node

    def get(self, key: str) -> int:
        if key not in self.map:
            return -1
        node = self.map[key]
        self._remove(node)              # DLL에서 제거
        self._insert_before_tail(node)  # MRU 위치로 이동
        return node.val

    def put(self, key: str, val: int) -> None:
        if key in self.map:
            node = self.map[key]
            node.val = val
            self._remove(node)
            self._insert_before_tail(node)
            return

        node = Node(key, val)
        self.map[key] = node
        self._insert_before_tail(node)

        if len(self.map) > self.cap:
            # LRU = head 바로 다음 노드
            lru = self.head.next
            self._remove(lru)
            del self.map[lru.key]
```

---

## 상태 변화 시각화

```
초기 (capacity=3):
  head ↔ tail

put("A", 1):
  head ↔ [A] ↔ tail

put("B", 2):
  head ↔ [A] ↔ [B] ↔ tail

put("C", 3):
  head ↔ [A] ↔ [B] ↔ [C] ↔ tail

get("A"):  → A를 MRU로 이동
  head ↔ [B] ↔ [C] ↔ [A] ↔ tail

put("D", 4):  → 용량 초과, LRU(B) 제거
  head ↔ [C] ↔ [A] ↔ [D] ↔ tail
```

---

## 테스트

```python
cache = LRUCache(3)

cache.put("A", 1)
cache.put("B", 2)
cache.put("C", 3)
assert cache.get("A") == 1   # A 최근 사용
cache.put("D", 4)             # B가 LRU → B 제거
assert cache.get("B") == -1  # B는 제거됨
assert cache.get("C") == 3
assert cache.get("A") == 1
assert cache.get("D") == 4
print("OK")
```

---

## 시간/공간 복잡도

```
get(key): O(1) — HashMap 조회 + DLL 이동
put(key): O(1) — HashMap 삽입 + DLL 삽입/삭제

공간:     O(capacity) — HashMap + DLL 노드
```

---

## 실무 코드와의 연결

이 구현은 Python의 `OrderedDict`, Java의 `LinkedHashMap`이 내부적으로 하는 일과 동일합니다.

```java
// Java: LinkedHashMap으로 LRU 구현
class LRUCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;

    LRUCache(int capacity) {
        super(capacity, 0.75f, true);  // accessOrder=true
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }
}
```

---

## 핵심 요약

- O(1) LRU = HashMap(빠른 조회) + DLL(빠른 재배치)
- head 쪽 = LRU(가장 오래됨), tail 쪽 = MRU(가장 최근)
- 접근 시 해당 노드를 tail 앞으로 이동
- 용량 초과 시 head 바로 다음 노드(LRU) 제거
- Java의 `LinkedHashMap`, Python의 `OrderedDict`가 동일 원리
