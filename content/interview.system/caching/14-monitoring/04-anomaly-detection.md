---
title: "캐시 이상 감지와 알람 설정"
date: 2026-04-12
tags: [cache, monitoring, alerting, anomaly-detection, prometheus]
---

## 핵심 알람 항목

### 히트율 급감

```yaml
# Prometheus AlertManager
- alert: CacheHitRateLow
  expr: |
    rate(cache_hits_total[5m]) /
    (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) < 0.6
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "캐시 히트율 60% 이하"
    description: "현재 히트율: {{ $value | humanizePercentage }}"
```

### 메모리 사용률

```yaml
- alert: RedisMemoryHigh
  expr: redis_memory_used_bytes / redis_config_maxmemory > 0.85
  for: 2m
  labels:
    severity: warning

- alert: RedisMemoryCritical
  expr: redis_memory_used_bytes / redis_config_maxmemory > 0.95
  for: 1m
  labels:
    severity: critical
```

### 응답 시간

```yaml
- alert: CacheLatencyHigh
  expr: histogram_quantile(0.99, rate(cache_operation_duration_seconds_bucket[5m])) > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "캐시 p99 응답시간 50ms 초과"
```

---

## Prometheus + Redis Exporter 설정

```bash
# redis_exporter 실행
docker run -d \
  -p 9121:9121 \
  oliver006/redis_exporter \
  --redis.addr redis://redis:6379
```

```yaml
# prometheus.yml
scrape_configs:
  - job_name: redis
    static_configs:
      - targets: ["redis-exporter:9121"]
```

**제공되는 주요 메트릭:**
```
redis_connected_clients
redis_memory_used_bytes
redis_keyspace_hits_total
redis_keyspace_misses_total
redis_evicted_keys_total
redis_commands_processed_total
```

---

## Spring Boot Actuator + Micrometer

```java
@Configuration
public class CacheMetricsConfig {

    @Bean
    public MeterRegistryCustomizer<MeterRegistry> cacheMetrics(
        CacheManager cacheManager
    ) {
        return registry -> {
            if (cacheManager instanceof CaffeineCacheManager caffeineMgr) {
                caffeineMgr.getCacheNames().forEach(name -> {
                    Cache cache = caffeineMgr.getCache(name);
                    if (cache instanceof CaffeineCache caffeineCache) {
                        CacheMetrics.monitor(registry, caffeineCache.getNativeCache(), name);
                    }
                });
            }
        };
    }
}
```

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
  metrics:
    tags:
      application: ${spring.application.name}
```

**노출 메트릭 예시:**
```
cache.gets{cache="users", result="hit"}
cache.gets{cache="users", result="miss"}
cache.evictions{cache="users"}
cache.size{cache="users"}
```

---

## 이상 감지 패턴

### 히트율 급변 감지

```python
import statistics

class HitRateAnomalyDetector:
    def __init__(self, window: int = 60):
        self.history = []
        self.window = window

    def record(self, hit_rate: float):
        self.history.append(hit_rate)
        if len(self.history) > self.window:
            self.history.pop(0)

    def is_anomaly(self, current: float) -> bool:
        if len(self.history) < 10:
            return False

        mean = statistics.mean(self.history)
        std = statistics.stdev(self.history)

        # 평균에서 3 시그마 이상 벗어나면 이상
        return abs(current - mean) > 3 * std

detector = HitRateAnomalyDetector()

def check_hit_rate():
    hits = redis.info("stats")["keyspace_hits"]
    misses = redis.info("stats")["keyspace_misses"]
    hit_rate = hits / (hits + misses) if (hits + misses) > 0 else 1.0

    if detector.is_anomaly(hit_rate):
        alert(f"히트율 이상 감지: {hit_rate:.1%} (평소와 다른 패턴)")

    detector.record(hit_rate)
```

---

## 장애 패턴별 알람

```python
class CacheHealthChecker:

    def check_stampede(self):
        """Cache Stampede 감지: 짧은 시간 내 미스 급증"""
        recent_misses = get_miss_rate_last_minute()
        if recent_misses > self.baseline_miss_rate * 5:
            alert("Cache Stampede 의심: 미스율 5배 급증")

    def check_avalanche(self):
        """Avalanche 감지: 전체 캐시 미스"""
        miss_rate = get_current_miss_rate()
        if miss_rate > 0.9:  # 90% 이상 미스
            alert("Cache Avalanche 의심: 전체 캐시 미스")

    def check_penetration(self):
        """Penetration 감지: DB 응답 없는 요청 급증"""
        null_responses = get_null_response_rate()
        if null_responses > 0.3:  # 30% 이상 null
            alert("Cache Penetration 의심: DB null 응답 급증")

    def check_memory(self):
        info = redis.info("memory")
        usage = info["used_memory"] / info["maxmemory"]
        if usage > 0.95:
            alert(f"Redis 메모리 위험: {usage:.1%}")
```

---

## 핵심 요약

- 히트율 < 60%: 즉시 경보, 캐시 전략 재검토
- 메모리 > 85%: 경고, > 95%: 위험 (제거 시작)
- p99 응답 > 50ms: 성능 이슈
- Prometheus + redis_exporter: Redis 메트릭 자동 수집
- Spring: Micrometer + `@Cacheable` 자동 메트릭
- 3 시그마 이탈 감지로 이상 패턴 조기 발견
