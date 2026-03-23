---
title: "[Redis] 36. 모니터링 — INFO, Redis Exporter, Grafana"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "monitoring", "prometheus", "grafana", "INFO", "redis-exporter"]
---

# 모니터링 — INFO, Redis Exporter, Grafana

## INFO 명령어

```bash
# 전체 정보
INFO all
INFO everything   # 숨겨진 정보 포함

# 섹션별 조회
INFO server       # 버전, OS, 실행 시간
INFO clients      # 연결 수, 블로킹 클라이언트
INFO memory       # 메모리 사용량, 단편화
INFO stats        # 명령어 수, 히트율
INFO replication  # 마스터/레플리카 상태
INFO cpu          # CPU 사용량
INFO keyspace     # DB별 키 수, TTL 정보
INFO persistence  # RDB/AOF 상태
INFO latencystats # 명령어별 latency 통계 (6.0+)
INFO commandstats # 명령어별 호출 수/시간
```

### 주요 지표 해석

```bash
INFO memory
# used_memory: 4294967296           → 4GB (실제 데이터)
# used_memory_rss: 5368709120       → 5GB (OS 할당)
# mem_fragmentation_ratio: 1.25     → 25% 단편화 (1.5+ 심각)
# used_memory_peak: 5000000000      → 최대 사용량 5GB
# maxmemory: 8589934592             → 한도 8GB

INFO stats
# total_connections_received: 15234 → 전체 연결 수
# instantaneous_ops_per_sec: 45000  → 현재 초당 명령어
# keyspace_hits: 9823456            → 캐시 히트
# keyspace_misses: 45678            → 캐시 미스
# expired_keys: 123456              → 만료된 키 수
# evicted_keys: 0                   → eviction으로 삭제된 키 (0이 좋음)
# rejected_connections: 0           → 거부된 연결 (0이어야 함)

INFO replication
# role: master
# connected_slaves: 2
# slave0: ip=10.0.0.2,port=6379,state=online,offset=123456,lag=0
# master_repl_offset: 123456
# repl_backlog_size: 1048576
```

---

## MONITOR — 실시간 명령어 감시

```bash
# 모든 명령어 실시간 출력 (프로덕션 주의!)
MONITOR

# redis-cli로
redis-cli MONITOR

# 필터링 (grep으로)
redis-cli MONITOR | grep "SET\|GET"
```

---

## CLIENT 명령어

```bash
# 현재 연결 목록
CLIENT LIST

# 클라이언트 이름 설정
CLIENT SETNAME "worker-1"

# 특정 클라이언트 연결 해제
CLIENT KILL ID <client-id>
CLIENT KILL ADDR 10.0.0.1:54321

# 클라이언트 일시 중지 (점검 시)
CLIENT PAUSE 10000   # 10초간 명령어 처리 중지

# 클라이언트 통계 (7.0+)
CLIENT NO-EVICT ON
CLIENT INFO
```

---

## Redis Exporter + Prometheus

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  redis-exporter:
    image: oliver006/redis_exporter:latest
    ports:
      - "9121:9121"
    environment:
      REDIS_ADDR: "redis:6379"
      REDIS_PASSWORD: ""
    depends_on:
      - redis

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
```

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

---

## 핵심 Prometheus 메트릭

```bash
# 메모리
redis_memory_used_bytes
redis_memory_max_bytes
redis_memory_fragmentation_ratio

# 연결
redis_connected_clients
redis_rejected_connections_total
redis_blocked_clients

# 명령어 throughput
redis_commands_processed_total
rate(redis_commands_processed_total[1m])  # 초당 명령어

# 캐시 히트율
redis_keyspace_hits_total
redis_keyspace_misses_total
rate(redis_keyspace_hits_total[5m]) /
  (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))
# → 히트율 (0.9 이상 권장)

# 복제 지연
redis_replication_lag

# eviction
redis_evicted_keys_total
rate(redis_evicted_keys_total[5m])  # 0이 이상적

# 만료
redis_expired_keys_total

# 키 수
redis_db_keys{db="db0"}

# latency
redis_latency_percentiles_usec
```

---

## Grafana 대시보드

```bash
# 공식 대시보드 ID: 11835 (Redis Overview by Percona)
# 또는 ID: 763 (Redis Dashboard)

# Grafana에서 Import → Dashboard ID 입력
```

### 핵심 패널 구성

```
1. Overview
   - Used Memory / Max Memory (%)
   - Connected Clients
   - Ops/sec (현재 초당 명령어)
   - Hit Rate (히트율)

2. Commands
   - Commands/sec by type (GET/SET/ZADD 등)
   - Slowlog entries/min

3. Memory
   - Used Memory 추이
   - Memory Fragmentation
   - Evictions/min

4. Replication
   - Replication Lag (마스터/레플리카 오프셋 차이)
   - Connected Slaves

5. Keyspace
   - Total Keys
   - Expired Keys/min
   - Evicted Keys/min
```

---

## 알림 규칙 (Prometheus Alerting)

```yaml
# alerts.yml
groups:
  - name: redis
    rules:
      # 메모리 80% 이상
      - alert: RedisHighMemory
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis 메모리 사용량 높음 ({{ $value | humanizePercentage }})"

      # 히트율 90% 미만
      - alert: RedisCacheHitRateLow
        expr: |
          rate(redis_keyspace_hits_total[5m]) /
          (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) < 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis 캐시 히트율 낮음 ({{ $value | humanizePercentage }})"

      # 복제 지연 30초 이상
      - alert: RedisReplicationLag
        expr: redis_replication_lag > 30
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis 복제 지연 {{ $value }}초"

      # 연결 거부 발생
      - alert: RedisRejectedConnections
        expr: rate(redis_rejected_connections_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis 연결 거부 발생"

      # eviction 발생
      - alert: RedisEvictions
        expr: rate(redis_evicted_keys_total[5m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis eviction 발생 중 ({{ $value }}/s)"
```

---

## redis-cli 유용한 명령어

```bash
# 실시간 INFO 통계 (1초 간격)
redis-cli --stat

# 키 타입별 통계
redis-cli --hotkeys           # 핫 키 (LFU 정책 필요)
redis-cli --bigkeys           # 큰 키 탐지

# 연속 명령어 실행
redis-cli --no-auth-warning -a password \
  --eval script.lua key , arg

# 파이프 모드 (대량 삽입)
cat commands.txt | redis-cli --pipe

# 클러스터 정보
redis-cli --cluster info localhost:7001
redis-cli --cluster check localhost:7001
```

---

## 정리

| 도구 | 용도 |
|------|------|
| `INFO` | 서버 전반 상태 스냅샷 |
| `MONITOR` | 실시간 명령어 트레이싱 (주의) |
| `SLOWLOG` | 느린 명령어 추적 |
| `CLIENT LIST` | 연결 클라이언트 조회 |
| `redis-cli --stat` | 실시간 통계 |
| `redis-cli --bigkeys` | 큰 키 탐지 |
| Redis Exporter | Prometheus 메트릭 수집 |
| Grafana | 시각화 대시보드 |

- **히트율 목표**: 90% 이상
- **단편화**: 1.5 이상이면 activedefrag 활성화
- **eviction**: 0 유지 (발생 시 maxmemory 증설 또는 TTL 조정)
- **복제 지연**: 1초 이하 유지
