---
title: "가상 노드(Virtual Nodes)와 부하 균등 분산"
date: 2026-04-12
tags: [cache, virtual-nodes, consistent-hashing, load-balancing]
---

## 가상 노드가 필요한 이유

Consistent Hashing에서 물리 노드만 링에 배치하면 불균등 분산이 발생합니다:

```
물리 노드 3개를 링에 배치:
  Node-A: 위치 100
  Node-B: 위치 350
  Node-C: 위치 700

링 크기 1000 기준:
  Node-A 담당: 350~100 → 750 구간의 키 (75%)
  Node-B 담당: 100~350 → 250 구간의 키 (25%)
  Node-C 담당: 350~700 → 350 구간의 키 (35%)

→ 불균등! Node-A에 3배 더 많은 키
```

---

## 가상 노드로 균등 분산

각 물리 노드를 여러 위치(가상 노드)에 배치합니다:

```
Node-A의 가상 노드: 위치 100, 320, 580, 820, ...
Node-B의 가상 노드: 위치 50, 200, 450, 700, ...
Node-C의 가상 노드: 위치 150, 380, 620, 900, ...

→ 링 전체에 균등하게 분포
→ 어느 키도 비슷한 비율로 분산
```

가상 노드 수가 많을수록 더 균등해집니다 (보통 100~200개).

---

## 구현 (이전 글 확장)

```python
import hashlib
import bisect
from collections import defaultdict

class VirtualNodeRing:
    def __init__(self, virtual_nodes: int = 150):
        self.virtual_nodes = virtual_nodes
        self.ring: dict[int, str] = {}
        self.sorted_positions: list[int] = []
        self._node_load: dict[str, int] = defaultdict(int)  # 부하 추적

    def _hash(self, key: str) -> int:
        return int(hashlib.sha256(key.encode()).hexdigest(), 16)

    def add_node(self, node: str):
        for i in range(self.virtual_nodes):
            pos = self._hash(f"{node}#vn{i}")
            self.ring[pos] = node
            bisect.insort(self.sorted_positions, pos)

    def remove_node(self, node: str):
        for i in range(self.virtual_nodes):
            pos = self._hash(f"{node}#vn{i}")
            if pos in self.ring:
                del self.ring[pos]
                self.sorted_positions.remove(pos)

    def get_node(self, key: str) -> str:
        pos = self._hash(key)
        idx = bisect.bisect(self.sorted_positions, pos)
        if idx == len(self.sorted_positions):
            idx = 0
        node = self.ring[self.sorted_positions[idx]]
        self._node_load[node] += 1
        return node

    def load_distribution(self) -> dict[str, float]:
        """노드별 부하 비율"""
        total = sum(self._node_load.values())
        if total == 0:
            return {}
        return {node: count / total for node, count in self._node_load.items()}


# 테스트: 분산 균등성 확인
ring = VirtualNodeRing(virtual_nodes=150)
ring.add_node("node-a")
ring.add_node("node-b")
ring.add_node("node-c")

for i in range(100_000):
    ring.get_node(f"key:{i}")

dist = ring.load_distribution()
for node, ratio in sorted(dist.items()):
    bar = "█" * int(ratio * 100)
    print(f"{node}: {ratio:.1%} {bar}")

# 출력 예시 (100개 가상 노드):
# node-a: 33.2% █████████████████████████████████
# node-b: 33.5% █████████████████████████████████
# node-c: 33.3% █████████████████████████████████
```

---

## 가상 노드 수와 균등도

```
가상 노드 수    표준편차 (낮을수록 균등)
    1           높음 (매우 불균등)
   10           중간
  100           낮음 (실용적)
  150           매우 낮음 (권장)
  300           거의 완벽
```

---

## 이종 노드 처리 (가중치)

메모리가 다른 노드들을 다룰 때:

```python
class WeightedVirtualNodeRing(VirtualNodeRing):
    def add_node(self, node: str, weight: int = 1):
        """weight: 가상 노드 수 배율"""
        actual_vnodes = self.virtual_nodes * weight
        for i in range(actual_vnodes):
            pos = self._hash(f"{node}#vn{i}")
            self.ring[pos] = node
            bisect.insort(self.sorted_positions, pos)

# 사용: 고사양 노드에 더 많은 키 배정
ring = WeightedVirtualNodeRing(virtual_nodes=100)
ring.add_node("node-a-small", weight=1)   # 8GB RAM
ring.add_node("node-b-large", weight=2)   # 16GB RAM → 2배 키 담당
ring.add_node("node-c-large", weight=2)   # 16GB RAM
```

---

## Redis Cluster의 슬롯 방식

Redis Cluster는 가상 노드 대신 **16384개의 고정 슬롯**을 사용합니다:

```
CRC16(key) % 16384 → 슬롯 번호
슬롯 → 노드 (설정 가능)

장점:
  - 슬롯 단위로 마이그레이션 가능
  - 정확한 부하 제어

예: 노드 추가 시 일부 슬롯만 이전 노드에서 새 노드로 이동
```

```bash
# 슬롯 재배치
redis-cli --cluster rebalance cluster-host:7001

# 특정 슬롯 이동
redis-cli --cluster reshard cluster-host:7001
```

---

## 핵심 요약

- 물리 노드만 쓰면 해시 링에서 불균등 분산 발생
- 가상 노드: 각 물리 노드를 N개 위치에 배치 → 균등 분산
- 가상 노드 150개: 실용적인 균등도 (편차 ~1%)
- 가중치 가상 노드: 이종 용량 노드를 비율에 맞게 활용
- Redis Cluster는 16384 고정 슬롯으로 동일 목적 달성
