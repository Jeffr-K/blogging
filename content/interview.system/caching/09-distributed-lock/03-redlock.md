---
title: "Redlock: 분산 환경의 강력한 락"
date: 2026-04-12
tags: [distributed-lock, redlock, redis, fault-tolerance]
---

## 단일 Redis의 문제

```
시나리오: Redis Sentinel 환경

1. Client-A가 Master에 락 획득
2. Master 다운 (락 데이터 Slave에 복제 안 됨)
3. Sentinel이 Slave를 Master로 승격
4. Client-B가 새 Master에 락 획득 성공
5. Client-A와 Client-B 모두 락 보유 → 상호 배제 위반!
```

Redis 복제는 **비동기**이므로 Failover 시 데이터 손실이 발생할 수 있습니다.

---

## Redlock 알고리즘

Martin Kleppmann이 개발, Redis 공식 문서에 포함된 분산 락 알고리즘.

**핵심 아이디어:** N개(홀수, 권장 5개)의 독립적인 Redis 인스턴스에 락을 획득합니다.

```
알고리즘:
1. 현재 시간 기록 (T1)
2. N개 Redis 인스턴스에 순서대로 SET key token NX PX ttl_ms
3. 과반수(N/2 + 1)에서 성공하면 락 획득
4. 실제 락 유효 시간 = TTL - (T2 - T1) - clock_drift
5. 유효 시간이 양수면 락 성공, 음수면 모든 인스턴스에서 해제

실패 시: 모든 인스턴스에서 즉시 해제 → 다음 시도
```

---

## 구현

```python
import time
import uuid
import redis

class Redlock:
    DRIFT_FACTOR = 0.01
    RETRY_DELAY_MS = 200

    def __init__(self, nodes: list[str], retry_count: int = 3):
        self.nodes = [redis.Redis.from_url(url) for url in nodes]
        self.quorum = len(nodes) // 2 + 1
        self.retry_count = retry_count

        self._release_script = """
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end
        """

    def _acquire_on_node(self, node: redis.Redis, key: str, token: str, ttl_ms: int) -> bool:
        try:
            return node.set(key, token, nx=True, px=ttl_ms) == True
        except redis.RedisError:
            return False

    def _release_on_node(self, node: redis.Redis, key: str, token: str):
        try:
            node.eval(self._release_script, 1, key, token)
        except redis.RedisError:
            pass

    def acquire(self, key: str, ttl_ms: int) -> dict | None:
        token = str(uuid.uuid4())

        for _ in range(self.retry_count):
            start_ms = int(time.time() * 1000)
            acquired_count = 0

            for node in self.nodes:
                if self._acquire_on_node(node, key, token, ttl_ms):
                    acquired_count += 1

            elapsed_ms = int(time.time() * 1000) - start_ms
            drift_ms = int(ttl_ms * self.DRIFT_FACTOR) + 2
            validity_ms = ttl_ms - elapsed_ms - drift_ms

            if acquired_count >= self.quorum and validity_ms > 0:
                return {"key": key, "token": token, "validity_ms": validity_ms}

            # 실패: 모든 인스턴스에서 해제
            for node in self.nodes:
                self._release_on_node(node, key, token)

            # 재시도 전 랜덤 대기
            time.sleep(self.RETRY_DELAY_MS / 1000 * (0.5 + 0.5 * random.random()))

        return None

    def release(self, lock: dict):
        for node in self.nodes:
            self._release_on_node(node, lock["key"], lock["token"])


# 사용
redlock = Redlock(
    nodes=[
        "redis://redis1:6379",
        "redis://redis2:6379",
        "redis://redis3:6379",
        "redis://redis4:6379",
        "redis://redis5:6379",
    ]
)

lock = redlock.acquire("lock:critical-section", ttl_ms=10000)
if lock:
    try:
        critical_section()
    finally:
        redlock.release(lock)
else:
    raise LockAcquireError()
```

---

## 라이브러리 사용 (권장)

직접 구현보다 검증된 라이브러리 사용:

```bash
pip install pottery   # Python Redlock
```

```python
from pottery import Redlock

redlock = Redlock(
    key="lock:my-resource",
    masters=[
        redis.Redis(host="redis1"),
        redis.Redis(host="redis2"),
        redis.Redis(host="redis3"),
    ],
    auto_release_time=10.0  # 10초 TTL
)

with redlock:
    critical_section()
```

---

## Redlock 논란

Martin Kleppmann vs Antirez (Redis 창시자) 논쟁:

```
Kleppmann 비판:
  - GC pause, 네트워크 지연으로 유효 시간 내에도 락 중복 가능
  - 진정한 강한 보장을 위해서는 fencing token 필요

Antirez 반론:
  - Redlock은 효율성(performance) 목적이지 정확성 보장 아님
  - 대부분의 실용적 사례에서 충분함

실무 결론:
  - 데이터 정합성이 절대적으로 중요하면: ZooKeeper 또는 etcd
  - 성능 중심 분산 락: Redis + Redlock이 충분
```

---

## 단일 Redis vs Redlock 선택

```
단일 Redis 락:
  ✅ 구현 간단
  ✅ 성능 높음
  ❌ 단일 장애점 (Sentinel Failover 시 중복 가능)
  권장: 높은 일관성이 불필요한 경우

Redlock (5노드):
  ✅ 노드 2개 다운해도 동작
  ✅ Failover 문제 없음
  ❌ 5배 네트워크 비용
  ❌ 노드 관리 복잡
  권장: 재고, 결제 등 정합성 중요한 경우
```

---

## 핵심 요약

- 단일 Redis + Sentinel: Failover 시 락 중복 가능
- **Redlock**: N개(5개) 독립 인스턴스, 과반수 획득 시 성공
- 실제 유효 시간 = TTL - 네트워크 지연 - 클록 드리프트
- 논란 있음: 100% 정합성 필요 시 ZooKeeper/etcd 권장
- 실무: pottery/redlock 라이브러리 사용 (직접 구현 비권장)
