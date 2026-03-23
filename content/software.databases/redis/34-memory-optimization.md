---
title: "[Redis] 34. 메모리 최적화 — 인코딩, 압축, 분석"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "memory", "encoding", "optimization", "listpack", "ziplist"]
---

# 메모리 최적화 — 인코딩, 압축, 분석

## 내부 인코딩

Redis는 데이터 크기에 따라 자동으로 인코딩을 전환.

### String 인코딩

```bash
# int: 정수 (64bit)
SET counter 42
OBJECT ENCODING counter     # → "int"

# embstr: 짧은 문자열 (≤ 44바이트)
SET name "Alice"
OBJECT ENCODING name        # → "embstr"

# raw: 긴 문자열 (> 44바이트)
SET long-key "this is a very long string that exceeds the embstr limit..."
OBJECT ENCODING long-key    # → "raw"
```

### Hash 인코딩

```bash
# listpack (구 ziplist): 필드 수 ≤ 128, 값 크기 ≤ 64바이트
HSET small-hash f1 v1 f2 v2
OBJECT ENCODING small-hash  # → "listpack"

# hashtable: 임계값 초과 시 자동 전환
HSET big-hash f1 "..." f2 "..." ... (129개 이상)
OBJECT ENCODING big-hash    # → "hashtable"
```

### List 인코딩

```bash
# listpack: 요소 수 ≤ 128, 값 크기 ≤ 64바이트
RPUSH small-list a b c
OBJECT ENCODING small-list  # → "listpack"

# quicklist: 임계값 초과 (ziplist 체인)
OBJECT ENCODING big-list    # → "quicklist"
```

### Set 인코딩

```bash
# listpack: 정수만, ≤ 128개
SADD int-set 1 2 3 4 5
OBJECT ENCODING int-set     # → "listpack" (또는 "intset")

# intset: 정수만, ≤ 512개
# hashtable: 문자열 포함 또는 임계값 초과
```

### ZSet 인코딩

```bash
# listpack: 요소 수 ≤ 128, 값 크기 ≤ 64바이트
ZADD small-zset 1.0 a 2.0 b
OBJECT ENCODING small-zset  # → "listpack"

# skiplist: 임계값 초과
OBJECT ENCODING big-zset    # → "skiplist"
```

---

## 인코딩 임계값 설정 (redis.conf)

```bash
# Hash
hash-max-listpack-entries 128   # 필드 수 임계값
hash-max-listpack-value 64      # 값 크기 임계값 (바이트)

# List
list-max-listpack-size 128      # 요소 수
list-max-ziplist-size 8kb       # 노드 크기

# Set
set-max-intset-entries 512      # 정수 Set 임계값
set-max-listpack-entries 128    # 문자열 Set listpack 임계값
set-max-listpack-value 64

# ZSet
zset-max-listpack-entries 128
zset-max-listpack-value 64
```

### 메모리 절약을 위한 임계값 조정

```bash
# 소규모 해시를 listpack으로 유지 (최대 2-3배 절약)
hash-max-listpack-entries 256   # 늘릴수록 메모리 절약
hash-max-listpack-value 128

# 주의: 임계값을 너무 높이면 CPU 사용 증가 (선형 탐색)
# 권장: entries ≤ 500, value ≤ 128
```

---

## 해시로 메모리 절약 (Hash Trick)

대량의 소규모 객체를 해시로 묶어 저장.

```bash
# 비효율적: 키마다 String
SET user:1001:name "Alice"   # 약 80바이트
SET user:1001:age "30"
SET user:1001:email "alice@example.com"

# 효율적: Hash로 묶기
HSET user:1001 name "Alice" age "30" email "alice@example.com"
# 약 50바이트 (listpack 인코딩 유지 시)

# 더 효율적: 버킷 Hash (Hash Trick)
# 사용자 ID를 100으로 나눈 버킷으로 그룹화
HSET users:10 01 '{"name":"Alice","age":30}' 02 '{"name":"Bob","age":25}'
# bucket = userId / 100
# field = userId % 100
```

```kotlin
// Hash Trick 구현
@Service
class UserHashTrickService(private val redis: StringRedisTemplate) {

    private val bucketSize = 100L

    private fun bucketKey(userId: Long) = "users:${userId / bucketSize}"
    private fun fieldKey(userId: Long) = (userId % bucketSize).toString()

    fun save(user: User) {
        redis.opsForHash<String, String>().put(
            bucketKey(user.id),
            fieldKey(user.id),
            user.toJson()
        )
    }

    fun get(userId: Long): User? {
        val json = redis.opsForHash<String, String>().get(
            bucketKey(userId),
            fieldKey(userId)
        ) ?: return null
        return json.toUser()
    }
}
```

---

## 메모리 분석 명령어

```bash
# 전체 메모리 정보
INFO memory

# 중요 지표:
# used_memory: 실제 사용 메모리
# used_memory_rss: OS가 할당한 메모리 (단편화 포함)
# mem_fragmentation_ratio: RSS / used (1.5 이상이면 단편화 심각)
# maxmemory: 최대 메모리 한도
# used_memory_peak: 최대 사용량

# 특정 키 메모리 크기
MEMORY USAGE user:1001
MEMORY USAGE user:1001 SAMPLES 0  # 중첩 구조 전체

# 메모리 진단 보고서
MEMORY DOCTOR

# 메모리 통계
MEMORY STATS

# 큰 키 찾기
redis-cli --bigkeys

# 키 통계 샘플링
redis-cli --memkeys --memkeys-samples 100
```

---

## 단편화 해소

```bash
# 메모리 단편화 비율 확인
INFO memory | grep mem_fragmentation_ratio

# 능동적 단편화 해소 (Redis 4.0+)
CONFIG SET activedefrag yes
CONFIG SET active-defrag-ignore-bytes 100mb  # 최소 단편화 크기
CONFIG SET active-defrag-enabled yes
CONFIG SET active-defrag-threshold-lower 10  # 단편화 10% 이상 시 시작
CONFIG SET active-defrag-threshold-upper 100 # 단편화 100%면 최대 속도

# 수동 defrag (서비스 중단 없음)
MEMORY PURGE
```

---

## maxmemory & eviction 정책

```bash
# redis.conf
maxmemory 4gb
maxmemory-policy allkeys-lru    # 메모리 초과 시 LRU로 삭제

# eviction 정책:
# noeviction      : 에러 반환 (캐시가 아닌 경우)
# allkeys-lru     : 전체 키 LRU (일반 캐시)
# volatile-lru    : TTL 있는 키만 LRU
# allkeys-lfu     : 전체 키 LFU (접근 빈도 기반)
# volatile-lfu    : TTL 있는 키만 LFU
# allkeys-random  : 무작위 삭제
# volatile-random : TTL 있는 키 무작위
# volatile-ttl    : TTL 짧은 키 우선 삭제
```

---

## 직렬화 크기 비교

```bash
# 같은 데이터, 다른 직렬화
# Java Serialization: 약 300바이트
# JSON: 약 120바이트
# MessagePack: 약 80바이트
# 직접 Hash 필드: 약 50바이트 (listpack)

# 권장: 값이 단순하면 Hash 필드 분리
# 복잡한 객체는 JSON (GenericJackson2JsonRedisSerializer)
```

---

## 메모리 절약 팁

```bash
# 1. 짧은 키 이름 사용
# BAD:  user:profile:firstname
# GOOD: u:1001:fn

# 2. 불필요한 TTL 없는 키 제거
redis-cli --scan --pattern "temp:*" | xargs redis-cli del

# 3. 큰 값은 압축해서 저장 (애플리케이션 레벨)
# Snappy, LZ4, Gzip 등으로 압축 후 저장

# 4. OBJECT FREQ로 접근 빈도 확인 (LFU 정책 사용 시)
OBJECT FREQ user:1001

# 5. OBJECT IDLETIME으로 오래된 키 확인
OBJECT IDLETIME user:1001  # 마지막 접근 후 초

# 6. DEBUG JMAP — 힙 메모리 분석 (개발 환경)
DEBUG JMAP
```

---

## 정리

| 자료구조 | 컴팩트 인코딩 | 전환 조건 |
|---------|--------------|----------|
| String | int/embstr | > 44바이트 → raw |
| Hash | listpack | > 128 필드 or > 64바이트 값 → hashtable |
| List | listpack | > 128 요소 or > 64바이트 값 → quicklist |
| Set | intset/listpack | 문자열 포함 or > 128 → hashtable |
| ZSet | listpack | > 128 요소 or > 64바이트 → skiplist |

- **listpack**: 가장 메모리 효율적 (연속 메모리 블록)
- **Hash Trick**: 소규모 객체를 버킷 Hash로 묶어 2-3배 절약
- **단편화**: `activedefrag yes` 설정으로 자동 해소
- **bigkeys 분석**: `redis-cli --bigkeys`로 큰 키 탐지
