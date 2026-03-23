---
title: "[Redis] 35. 성능 튜닝 — SLOWLOG, 커넥션 풀, 벤치마크"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "performance", "slowlog", "benchmark", "tuning", "latency"]
---

# 성능 튜닝 — SLOWLOG, 커넥션 풀, 벤치마크

## SLOWLOG — 느린 명령어 추적

```bash
# 설정 (redis.conf 또는 런타임)
slowlog-log-slower-than 10000   # 10ms 이상 명령어 기록 (마이크로초)
slowlog-max-len 128              # 최대 128개 저장

# 런타임 설정
CONFIG SET slowlog-log-slower-than 10000
CONFIG SET slowlog-max-len 256

# SLOWLOG 조회
SLOWLOG GET         # 최근 10개
SLOWLOG GET 25      # 최근 25개
SLOWLOG LEN         # 전체 개수
SLOWLOG RESET       # 초기화

# 출력 형식:
# 1) 1) (integer) 14          → 로그 ID
#    2) (integer) 1616239817  → 타임스탬프
#    3) (integer) 13987       → 소요 시간 (마이크로초)
#    4) 1) "KEYS"             → 명령어
#       2) "user:*"
#    5) "127.0.0.1:54321"     → 클라이언트
#    6) "myapp"               → 클라이언트 이름
```

---

## latency 모니터링

```bash
# Latency 모니터링 활성화
CONFIG SET latency-monitor-threshold 1   # 1ms 이상 이벤트 기록

# Latency 히스토리 조회
LATENCY HISTORY event

# 이벤트 목록
LATENCY LATEST

# Latency 초기화
LATENCY RESET

# Latency 그래프 (ASCII)
LATENCY GRAPH event

# 실시간 latency 측정 (redis-cli)
redis-cli --latency               # 지속 측정
redis-cli --latency-history -i 1  # 1초 간격 히스토리
redis-cli --latency-dist          # 분포 히스토그램
```

---

## 벤치마크 (redis-benchmark)

```bash
# 기본 벤치마크 (모든 명령어)
redis-benchmark

# 특정 명령어만
redis-benchmark -t set,get,incr,lpush,rpush,lrange

# 파이프라인 벤치마크
redis-benchmark -t set,get -P 16   # 파이프라인 16개

# 데이터 크기 변경
redis-benchmark -t set -d 1024    # 1KB 값

# 클라이언트 수 / 요청 수
redis-benchmark -c 50 -n 100000   # 50 클라이언트, 10만 요청

# 랜덤 키 사용 (캐시 히트율 현실화)
redis-benchmark -t get -r 100000  # 100,000개 랜덤 키

# 결과 해석:
# 100000 requests completed in 0.85 seconds
# 117,647 requests per second   ← TPS
# latency percentiles: p50=0.3ms, p99=0.7ms
```

---

## 커넥션 풀 최적화

```yaml
# application.yml — Lettuce 커넥션 풀
spring:
  data:
    redis:
      lettuce:
        pool:
          enabled: true
          max-active: 32      # CPU 코어 수 × 2 ~ 4 권장
          max-idle: 16
          min-idle: 4
          max-wait: 2000ms
```

```bash
# 커넥션 수 확인
INFO clients

# 중요 지표:
# connected_clients: 현재 연결 수
# blocked_clients: BLPOP 등으로 블로킹된 클라이언트
# rejected_connections: 거부된 연결 (maxclients 초과)

# 최대 클라이언트 수 설정
CONFIG SET maxclients 10000
```

---

## 파이프라인으로 throughput 향상

```kotlin
@Service
class PipelineService(private val redis: StringRedisTemplate) {

    // 파이프라인 없이: N번 왕복 (느림)
    fun setBatch_slow(data: Map<String, String>) {
        data.forEach { (k, v) -> redis.opsForValue().set(k, v) }
    }

    // 파이프라인: 1번 왕복 (빠름)
    fun setBatch_fast(data: Map<String, String>) {
        redis.executePipelined {
            data.forEach { (k, v) ->
                it.opsForValue().set(k, v)
            }
            null
        }
    }

    // 파이프라인 + TTL
    fun setBatchWithTtl(data: Map<String, String>, ttl: Duration) {
        redis.executePipelined {
            data.forEach { (k, v) ->
                it.opsForValue().set(k, v, ttl)
            }
            null
        }
    }
}
```

---

## KEYS vs SCAN

```bash
# KEYS * — 절대 프로덕션에서 사용 금지 (블로킹)
# 전체 키 공간 스캔 → 서비스 중단 가능

# SCAN — 커서 기반 비블로킹 반복
SCAN 0 MATCH "user:*" COUNT 100

# COUNT는 힌트일 뿐 (보장 아님)
# 반환된 커서가 0이면 전체 스캔 완료
```

```kotlin
// Spring: scan 사용
fun deleteByPattern(pattern: String) {
    redis.scan(
        ScanOptions.scanOptions()
            .match(pattern)
            .count(200)
            .build()
    ).use { cursor ->
        val keysToDelete = mutableListOf<String>()
        cursor.forEach { key ->
            keysToDelete.add(key)
            if (keysToDelete.size >= 200) {
                redis.delete(keysToDelete)
                keysToDelete.clear()
            }
        }
        if (keysToDelete.isNotEmpty()) {
            redis.delete(keysToDelete)
        }
    }
}
```

---

## OS 레벨 튜닝

```bash
# 1. TCP 백로그
sysctl net.core.somaxconn=65535
sysctl net.ipv4.tcp_max_syn_backlog=65535
# redis.conf: tcp-backlog 511

# 2. THP (Transparent Huge Pages) 비활성화
echo never > /sys/kernel/mm/transparent_hugepage/enabled
# Redis fork() 지연 원인

# 3. vm.overcommit_memory
sysctl vm.overcommit_memory=1
# BGSAVE fork 실패 방지

# 4. 파일 디스크립터 한도
ulimit -n 65535

# 5. TCP keepalive
redis.conf: tcp-keepalive 300
```

---

## redis.conf 성능 설정

```bash
# 스레드 수 (I/O 스레드, Redis 6.0+)
io-threads 4              # CPU 코어 수 - 1 권장
io-threads-do-reads yes   # 읽기도 멀티스레드

# 동시 클라이언트
maxclients 10000

# TCP 설정
tcp-backlog 511
tcp-keepalive 300

# 소켓 버퍼 (대용량 파이프라인)
# sysctl net.core.rmem_max=16777216
# sysctl net.core.wmem_max=16777216

# 비활성 클라이언트 타임아웃
timeout 0   # 0=비활성화 (권장), 또는 300초

# 프로토콜 최적화
no-appendfsync-on-rewrite yes  # AOF 재작성 중 fsync 비활성화
```

---

## 명령어별 시간복잡도

```bash
# O(1) — 빠름
GET, SET, HGET, HSET, SADD, ZADD (단일)
LPUSH, RPUSH, LPOP, RPOP
INCR, DECR

# O(log N) — 빠름
ZADD, ZRANK, ZSCORE
ZINCRBY

# O(N) — 주의 (N이 크면 느림)
KEYS pattern     # 전체 키 스캔 — 사용 금지
HGETALL key      # N=필드 수
SMEMBERS key     # N=멤버 수
LRANGE key 0 -1  # N=리스트 크기
SINTER/SUNION    # N=멤버 수의 합

# O(N+M log M) — 느림
SORT key

# 주의가 필요한 명령어
# KEYS, FLUSHDB, FLUSHALL, DEBUG SLEEP
```

---

## 모니터링 지표

```bash
INFO all | grep -E "ops_per_sec|used_memory|connected_clients|rejected|hit|miss"

# 핵심 지표:
# instantaneous_ops_per_sec: 초당 명령어 수
# keyspace_hits: 캐시 히트 수
# keyspace_misses: 캐시 미스 수
# 히트율 = hits / (hits + misses) × 100

# 히트율 계산
redis-cli INFO stats | grep -E "keyspace_(hits|misses)"
```

---

## 정리

| 문제 | 원인 | 해결 |
|------|------|------|
| 응답 느림 | 큰 값/O(N) 명령어 | SLOWLOG 분석, SCAN 사용 |
| 높은 latency | 네트워크 왕복 | Pipeline, 배치 처리 |
| 메모리 부족 | 큰 값/단편화 | maxmemory + eviction, defrag |
| 연결 부족 | 풀 고갈 | max-active 증가, 커넥션 재사용 |
| CPU 높음 | KEYS/SORT 남용 | SCAN으로 교체, 정렬 캐싱 |

- **SLOWLOG**: `slowlog-log-slower-than 10000` → 느린 명령어 찾기
- **Pipeline**: 배치 작업 시 반드시 사용
- **SCAN**: KEYS 대신 항상 SCAN
- **io-threads**: Redis 6.0+ 멀티스레드 I/O 활성화
