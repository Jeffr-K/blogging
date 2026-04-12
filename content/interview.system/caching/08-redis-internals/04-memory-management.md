---
title: "Redis 메모리 관리"
date: 2026-04-12
tags: [redis, memory, maxmemory, eviction, fragmentation]
---

## 메모리 모니터링

```bash
redis-cli INFO memory
```

```
# Memory 주요 지표
used_memory: 1073741824        # 실제 사용 메모리 (1GB)
used_memory_rss: 1342177280    # OS가 보는 실제 점유 (RSS)
used_memory_peak: 1610612736   # 최대 사용 메모리
mem_fragmentation_ratio: 1.25  # RSS / used_memory (1.0이 이상적)

# 오버헤드
used_memory_overhead: 104857600  # Redis 내부 구조 오버헤드
used_memory_dataset: 968883224   # 실제 데이터
```

---

## maxmemory 설정

```bash
# redis.conf
maxmemory 4gb                  # 최대 메모리 4GB
maxmemory-policy allkeys-lru   # 메모리 초과 시 제거 정책
```

**제거 정책 옵션:**

```
noeviction:        제거 안 함, 에러 반환 (캐시 부적합)
allkeys-lru:       모든 키 중 LRU 제거 (일반 캐시에 권장)
allkeys-lfu:       모든 키 중 LFU 제거 (빈도 기반)
allkeys-random:    무작위 제거
volatile-lru:      TTL 있는 키 중 LRU
volatile-lfu:      TTL 있는 키 중 LFU
volatile-ttl:      TTL이 짧은 키 우선 제거
volatile-random:   TTL 있는 키 중 무작위
```

```python
# 운영 권장 설정
maxmemory 4gb
maxmemory-policy allkeys-lru    # 캐시 용도
# 또는
maxmemory-policy allkeys-lfu    # 빈도 기반이 더 효율적 (Redis 4.0+)
```

---

## 메모리 단편화 (Fragmentation)

```
mem_fragmentation_ratio = used_memory_rss / used_memory

1.0:    이상적
1.5:    보통 (50% 단편화)
2.0+:   심각 (메모리 낭비)
< 1.0:  메모리 스왑 발생 (매우 위험)
```

**단편화 발생 원인:**
- 크기가 다른 키를 자주 추가/삭제
- 키 삭제 후 메모리 홀이 즉시 반환되지 않음
- 메모리 할당자(jemalloc)의 버디 시스템

**해결:**

```bash
# Redis 4.0+: 활성 조각 모음
redis-cli CONFIG SET activedefrag yes
redis-cli CONFIG SET active-defrag-ignore-bytes 100mb  # 100mb 이상 단편화 시 시작
redis-cli CONFIG SET active-defrag-enabled yes
```

또는 재시작 (가장 확실):
```bash
# Redis 재시작 전 RDB 저장
redis-cli BGSAVE
# 재시작 → RDB에서 복구 → 단편화 해소
```

---

## 메모리 절약 설정

```bash
# redis.conf
# Hash: ziplist 임계값 (작을수록 메모리 절약)
hash-max-ziplist-entries 128
hash-max-ziplist-value 64

# List: quicklist 노드 크기
list-max-ziplist-size -2      # 8kb 이하 노드

# Set: intset 임계값
set-max-intset-entries 512

# ZSet: ziplist 임계값
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
```

---

## 메모리 사용량 분석

```bash
# 키별 메모리 확인
redis-cli MEMORY USAGE "user:42"      # bytes
redis-cli MEMORY USAGE "user:42" SAMPLES 5  # 중첩 구조는 샘플링

# 큰 키 찾기
redis-cli --bigkeys

# 특정 패턴의 키 메모리 합계 (주의: 느림)
redis-cli --scan --pattern "user:*" | xargs redis-cli MEMORY USAGE

# 데이터 타입별 메모리 분포
redis-cli --memkeys  # 자료구조별 메모리 분포
```

---

## 키 만료와 메모리 반환

```bash
# TTL 없는 키 확인 (메모리 누수 위험)
redis-cli --scan --pattern "*" | xargs -L 1 redis-cli TTL | grep "^-1" | wc -l

# 만료된 키 즉시 정리
# Redis는 lazy deletion + active expiration 혼합 사용
```

**Active Expiration (주기적 샘플링):**
```
100ms마다 20개의 키 랜덤 샘플링
만료된 키 제거
만료율 > 25%이면 반복
```

---

## 핵심 요약

- `used_memory` vs `used_memory_rss`: 차이가 단편화
- `maxmemory` + `allkeys-lru`: 캐시 기본 설정
- 단편화 비율 > 1.5: `activedefrag yes` 또는 재시작
- ziplist 임계값 조정으로 메모리 20~30% 절약 가능
- `--bigkeys`, `MEMORY USAGE`로 큰 키 찾기
