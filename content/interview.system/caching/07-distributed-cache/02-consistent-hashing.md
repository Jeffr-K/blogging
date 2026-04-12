---
title: "Consistent Hashing: 노드 변경의 영향 최소화"
date: 2026-04-12
tags: [cache, consistent-hashing, distributed, sharding]
---

## 일반 해싱의 문제

노드 3개 → 4개로 확장할 때:

```
기존: hash(key) % 3
  key1 → 1번 노드
  key2 → 0번 노드

확장 후: hash(key) % 4
  key1 → 3번 노드  ← 다른 노드!
  key2 → 2번 노드  ← 다른 노드!
```

**노드 수가 바뀌면 거의 모든 키가 다른 노드로 이동 → 캐시 전체 miss.**

---

## Consistent Hashing 아이디어

해시 공간(0 ~ 2^32-1)을 원형으로 배치합니다:

```
        0
    /       \
  N3          N1
    \       /
        N2

키를 원형에 배치 후, 시계 방향으로 가장 먼저 만나는 노드에 저장
```

```
노드 추가 전:
  key-A → N1 (시계 방향으로 첫 번째 노드)
  key-B → N2
  key-C → N3

N4 추가 후 (N1과 N2 사이에 배치):
  key-A → N4 (N4가 더 가깝게 됨)  ← 영향받음
  key-B → N2  ← 변화 없음
  key-C → N3  ← 변화 없음
```

**노드 1개 추가 시, 전체 키의 1/N만 재배치.**

---

## 구현

```python
import hashlib
import bisect

class ConsistentHashRing:
    def __init__(self, nodes: list[str] = None, virtual_nodes: int = 100):
        self.virtual_nodes = virtual_nodes
        self.ring: dict[int, str] = {}  # hash_position → node
        self.sorted_keys: list[int] = []

        for node in (nodes or []):
            self.add_node(node)

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest(), 16)

    def add_node(self, node: str):
        """노드 추가: virtual_nodes개의 가상 노드를 링에 배치"""
        for i in range(self.virtual_nodes):
            virtual_key = f"{node}:vn{i}"
            pos = self._hash(virtual_key)
            self.ring[pos] = node
            bisect.insort(self.sorted_keys, pos)

    def remove_node(self, node: str):
        """노드 제거"""
        for i in range(self.virtual_nodes):
            virtual_key = f"{node}:vn{i}"
            pos = self._hash(virtual_key)
            del self.ring[pos]
            self.sorted_keys.remove(pos)

    def get_node(self, key: str) -> str:
        """키를 담당하는 노드 반환"""
        if not self.ring:
            raise Exception("Ring is empty")

        pos = self._hash(key)
        # 시계 방향으로 가장 가까운 노드 찾기
        idx = bisect.bisect(self.sorted_keys, pos)
        if idx == len(self.sorted_keys):
            idx = 0  # 원형: 끝에 도달하면 처음으로
        return self.ring[self.sorted_keys[idx]]


# 사용
ring = ConsistentHashRing(["node1:6379", "node2:6379", "node3:6379"], virtual_nodes=100)

print(ring.get_node("user:1"))    # node2:6379
print(ring.get_node("user:2"))    # node1:6379
print(ring.get_node("product:1")) # node3:6379

# 노드 추가 (영향받는 키 최소화)
ring.add_node("node4:6379")
print(ring.get_node("user:1"))    # node4:6379 (일부만 변경)
print(ring.get_node("user:2"))    # node1:6379 (변화 없음)
```

---

## 노드 추가/제거 시 영향

```
노드 3개 → 4개: 전체 키의 약 1/4만 재배치
노드 3개 → 2개: 전체 키의 약 1/3만 재배치

일반 해싱: 거의 전체 키 재배치
Consistent Hashing: O(K/N) 재배치 (K=키 수, N=노드 수)
```

---

## 분산 캐시에 적용

```python
class ConsistentHashCache:
    def __init__(self, nodes: list[str]):
        self.ring = ConsistentHashRing(nodes, virtual_nodes=150)
        self.clients = {
            node: redis.Redis.from_url(f"redis://{node}")
            for node in nodes
        }

    def get(self, key: str):
        node = self.ring.get_node(key)
        return self.clients[node].get(key)

    def set(self, key: str, value, ttl: int = None):
        node = self.ring.get_node(key)
        client = self.clients[node]
        if ttl:
            client.setex(key, ttl, value)
        else:
            client.set(key, value)

    def add_node(self, node: str):
        self.ring.add_node(node)
        self.clients[node] = redis.Redis.from_url(f"redis://{node}")
```

---

## 실무에서 직접 구현할 일은?

Redis Cluster가 내부적으로 일관된 해싱(CRC16 + 슬롯)을 사용합니다. Memcached 클라이언트(libmemcached)도 Consistent Hashing을 기본 지원합니다.

**직접 구현이 필요한 경우:**
- Redis Cluster가 아닌 일반 Redis 여러 대를 묶을 때
- Memcached 직접 샤딩 시
- 커스텀 분산 캐시 구현 시

---

## 핵심 요약

- 일반 해싱: 노드 수 변경 시 대부분 키 재배치 → 캐시 전체 miss
- Consistent Hashing: 원형 해시 공간 → 노드 변경 시 O(K/N)만 재배치
- 가상 노드(Virtual Nodes): 균등한 분산 보장
- Redis Cluster는 내부적으로 Consistent Hashing 사용 (CRC16 + 16384 슬롯)
