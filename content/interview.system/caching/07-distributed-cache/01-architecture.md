---
title: "분산 캐시 아키텍처"
date: 2026-04-12
tags: [cache, distributed, redis, architecture]
---

## 왜 분산 캐시가 필요한가

단일 캐시 노드의 한계:

```
단일 Redis:
  메모리: 수십 GB (서버 한 대)
  처리량: 초당 ~100,000 ops
  단일 장애점: Redis 다운 → 전체 캐시 소멸

분산 캐시:
  메모리: 노드 수 × 노드 메모리 (수백 GB ~ TB)
  처리량: 노드 수 × 노드 처리량
  고가용성: 노드 하나 다운 → 나머지 서비스 유지
```

---

## 패턴 1: Client-Side Sharding

클라이언트가 어느 노드에 저장할지 결정합니다:

```python
import hashlib

class ShardedCache:
    def __init__(self, nodes: list[str]):
        self.nodes = nodes  # ["redis1:6379", "redis2:6379", "redis3:6379"]
        self.clients = {node: redis.Redis.from_url(f"redis://{node}") for node in nodes}

    def _get_node(self, key: str) -> redis.Redis:
        """키 해시값으로 노드 선택"""
        hash_val = int(hashlib.md5(key.encode()).hexdigest(), 16)
        node = self.nodes[hash_val % len(self.nodes)]
        return self.clients[node]

    def get(self, key: str):
        return self._get_node(key).get(key)

    def set(self, key: str, value, ttl: int = None):
        client = self._get_node(key)
        if ttl:
            client.setex(key, ttl, value)
        else:
            client.set(key, value)
```

**단점:** 노드 추가/제거 시 대부분의 키가 다른 노드로 재배치됩니다 (캐시 전체 miss).

---

## 패턴 2: Redis Cluster

Redis 내장 분산 기능. 16384개 슬롯을 노드에 분배합니다:

```
슬롯 분배 예시 (노드 3개):
  node-1: 슬롯 0~5460
  node-2: 슬롯 5461~10922
  node-3: 슬롯 10923~16383

키 → 슬롯: CRC16(key) % 16384
```

```bash
# Redis Cluster 구성
redis-cli --cluster create \
  127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003 \
  127.0.0.1:7004 127.0.0.1:7005 127.0.0.1:7006 \
  --cluster-replicas 1  # 노드당 복제본 1개
```

```python
from redis.cluster import RedisCluster

cluster = RedisCluster(
    startup_nodes=[{"host": "127.0.0.1", "port": 7001}],
    decode_responses=True
)

cluster.set("user:42", "Alice")
cluster.get("user:42")
```

---

## 패턴 3: Redis Sentinel (고가용성)

단일 마스터 + 복수 슬레이브 + 감시자(Sentinel):

```
구성:
  Master: 읽기/쓰기
  Slave 1, 2: 읽기 전용 복제본
  Sentinel 1, 2, 3: 마스터 상태 모니터링

마스터 다운 시:
  Sentinel 과반수가 감지 → 슬레이브 중 하나를 마스터로 승격
  클라이언트에 새 마스터 주소 전달
```

```python
from redis.sentinel import Sentinel

sentinel = Sentinel([
    ("sentinel1", 26379),
    ("sentinel2", 26379),
    ("sentinel3", 26379),
], socket_timeout=0.1)

# 항상 현재 마스터에 쓰기
master = sentinel.master_for("mymaster", socket_timeout=0.1)
master.set("key", "value")

# 슬레이브에서 읽기 (부하 분산)
slave = sentinel.slave_for("mymaster", socket_timeout=0.1)
slave.get("key")
```

---

## 패턴 4: Twemproxy / Redis Proxy

프록시 레이어가 샤딩을 처리합니다:

```
Client → [Twemproxy] → [Redis-1, Redis-2, Redis-3]
```

클라이언트는 단일 Redis처럼 사용, 프록시가 분산 처리.

---

## 아키텍처 선택 기준

| 패턴 | 규모 | 고가용성 | 복잡도 | 권장 상황 |
|------|------|---------|--------|----------|
| 단일 Redis | 소형 | ❌ | 낮음 | 개발/소규모 |
| Redis Sentinel | 중형 | ✅ | 중간 | 읽기 부하 큰 서비스 |
| Redis Cluster | 대형 | ✅ | 높음 | 대용량 데이터 |
| Client Sharding | 중형 | ❌ | 낮음 | 레거시/직접 제어 |

---

## 핵심 요약

- 분산 캐시: 메모리 확장 + 고가용성
- **Client-Side Sharding**: 단순하지만 노드 변경 시 캐시 무효화
- **Redis Cluster**: 내장 분산, 16384 슬롯 기반
- **Redis Sentinel**: 마스터 자동 failover, 읽기 부하 분산
- 노드 추가/제거 시 Consistent Hashing으로 영향 최소화 (다음 글)
