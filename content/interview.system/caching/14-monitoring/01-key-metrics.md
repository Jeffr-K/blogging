---
title: "캐시 핵심 지표"
date: 2026-04-12
tags: [cache, monitoring, metrics, hit-rate, redis]
---

## 반드시 추적해야 할 지표

### 1. 히트율 (Hit Rate)

```
히트율 = 캐시 히트 수 / 전체 요청 수

목표: 80% 이상 (서비스에 따라 다름)
경고: 60% 이하 → 캐시 전략 재검토
```

```bash
# Redis 히트율 확인
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# keyspace_hits:1000000
# keyspace_misses:50000
# 히트율 = 1000000 / (1000000 + 50000) = 95.2%
```

```python
# 애플리케이션 레벨 히트율 수집
from prometheus_client import Counter, Gauge

cache_hits = Counter("cache_hits_total", "Cache hit count", ["cache_name"])
cache_misses = Counter("cache_misses_total", "Cache miss count", ["cache_name"])

def get_with_metrics(cache, key: str, cache_name: str):
    val = cache.get(key)
    if val:
        cache_hits.labels(cache_name=cache_name).inc()
    else:
        cache_misses.labels(cache_name=cache_name).inc()
    return val
```

---

### 2. 메모리 사용률

```bash
redis-cli INFO memory | grep -E "used_memory:|maxmemory:|mem_fragmentation_ratio"

# used_memory: 3221225472          → 3 GB 사용
# maxmemory: 4294967296            → 최대 4 GB
# mem_fragmentation_ratio: 1.25    → 25% 단편화
```

**경보 기준:**
```
used_memory / maxmemory > 0.85 → 경고 (85%)
used_memory / maxmemory > 0.95 → 위험 (95%)
mem_fragmentation_ratio > 1.5  → 단편화 경고
```

---

### 3. 응답 시간 (Latency)

```bash
# 실시간 지연시간 히스토그램
redis-cli --latency
redis-cli --latency-history  # 15초마다 갱신

# 느린 명령어 로그
redis-cli SLOWLOG GET 10
redis-cli CONFIG GET slowlog-log-slower-than
```

```python
import time

def measure_cache_latency(cache, key: str):
    start = time.perf_counter()
    val = cache.get(key)
    latency_ms = (time.perf_counter() - start) * 1000

    cache_latency.labels(operation="get").observe(latency_ms)
    return val
```

**정상 범위:**
```
Redis (로컬): < 1ms
Redis (네트워크): < 5ms
경고: > 10ms
위험: > 50ms
```

---

### 4. 연결 수

```bash
redis-cli INFO clients | grep connected_clients

# connected_clients: 150  → 현재 연결 수
# maxclients: 10000       → 최대 허용
```

**경보:** `connected_clients / maxclients > 0.8`

---

### 5. 제거율 (Eviction Rate)

```bash
redis-cli INFO stats | grep evicted_keys

# evicted_keys: 1000  → 메모리 부족으로 제거된 키 수
```

evicted_keys가 증가한다 = 메모리가 부족해 데이터가 강제 제거됨 → 히트율 하락

---

### 6. 명령어 처리량 (OPS)

```bash
redis-cli INFO stats | grep instantaneous_ops_per_sec

# instantaneous_ops_per_sec: 50000  → 초당 50,000 명령어
```

```bash
# 실시간 모니터링
redis-cli --stat
# interval  calls  reqs/s  errors/s  net_in   net_out   net_in
#    1      5000   5000/s  0/s       500K/s   1M/s
```

---

## 대시보드 예시 (Grafana)

```
패널 1: 히트율 (목표선 80% 표시)
패널 2: 메모리 사용률 (경고선 85% 표시)
패널 3: 응답 시간 p50/p95/p99
패널 4: 초당 요청 수 (hit/miss 분리)
패널 5: 제거된 키 수 (0이 이상적)
패널 6: 연결 수 추이
```

---

## 핵심 요약

| 지표 | 정상 | 경고 |
|------|------|------|
| 히트율 | > 80% | < 60% |
| 메모리 | < 85% | > 95% |
| 응답시간(p99) | < 5ms | > 50ms |
| 단편화 비율 | < 1.3 | > 1.5 |
| 제거 수 | 0 or 낮음 | 증가 추세 |
