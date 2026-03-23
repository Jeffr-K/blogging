---
title: "[Redis] 12. TTL & 만료 정책 — EXPIRE, eviction"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "TTL", "expire", "eviction", "만료정책", "메모리관리"]
---

# TTL & 만료 정책 — EXPIRE, eviction

## TTL (Time To Live)

키에 만료 시간을 설정하면 자동으로 삭제.

### TTL 설정 명령어

```bash
# 초 단위
EXPIRE key 3600          # 3600초 후 만료
PEXPIRE key 3600000      # 3600000밀리초 후 만료

# 절대 타임스탬프
EXPIREAT key 1700000000  # 유닉스 타임스탬프(초)
PEXPIREAT key 1700000000000  # 유닉스 타임스탬프(ms)

# Redis 7.0+ 옵션
EXPIRE key 3600 NX   # TTL 없을 때만 설정
EXPIRE key 3600 XX   # TTL 있을 때만 설정
EXPIRE key 3600 GT   # 현재 TTL보다 클 때만 설정
EXPIRE key 3600 LT   # 현재 TTL보다 작을 때만 설정

# SET과 동시에 TTL 설정
SET key value EX 3600        # 초
SET key value PX 3600000     # 밀리초
SET key value EXAT 1700000000
SET key value PXAT 1700000000000
SETEX key 3600 value         # 레거시
PSETEX key 3600000 value     # 레거시
```

### TTL 조회

```bash
TTL key    # 남은 초, -1=영구, -2=키 없음
PTTL key   # 남은 밀리초

# -2 반환: 키가 없거나 만료됨
# -1 반환: TTL 없음 (영구)
```

### TTL 제거 (영구로 변경)

```bash
PERSIST key   # TTL 제거 → -1
```

---

## 만료 동작 원리

### Lazy Expiration (수동적 만료)

```
키 접근 시 → 만료 여부 체크 → 만료됐으면 삭제 후 nil 반환
```

메모리는 즉시 반환되지 않을 수 있음.

### Active Expiration (능동적 만료)

```
Redis 내부 타이머:
  100ms마다 만료 키를 무작위로 20개 샘플링
  → 5개 이상 만료됐으면 → 다시 샘플링 (빠른 순환)
  → 5개 미만이면 → 대기
```

대량의 키가 동시에 만료되면 CPU 스파이크 가능 → TTL을 분산시켜 설정.

---

## Keyspace Notification (만료 이벤트)

특정 이벤트 발생 시 Pub/Sub으로 알림.

```bash
# 설정 (redis.conf 또는 CONFIG SET)
CONFIG SET notify-keyspace-events "Ex"
# K: Keyspace 알림 (__keyspace@<db>__)
# E: Keyevent 알림 (__keyevent@<db>__)
# g: 일반 명령 (DEL, EXPIRE 등)
# $: String 명령
# l: List 명령
# s: Set 명령
# z: Sorted Set 명령
# h: Hash 명령
# x: 만료 이벤트
# d: Stream 명령
# t: Stream Consumer Group 명령
# e: Eviction 이벤트
# A: 모든 이벤트 (g$lszxedt의 별칭)

# 만료 이벤트 구독 예시
SUBSCRIBE __keyevent@0__:expired

# 키스페이스 알림 구독 (특정 키에 대한 모든 이벤트)
SUBSCRIBE __keyspace@0__:mykey
```

```kotlin
// Kotlin: 만료 이벤트 리스너
@Component
class KeyExpirationListener : MessageListener {
    override fun onMessage(message: Message, pattern: ByteArray?) {
        val expiredKey = message.body.toString(Charsets.UTF_8)
        logger.info("만료된 키: $expiredKey")
        // 만료된 키로 후처리 (예: 세션 정리, 알림 등)
    }
}

// RedisMessageListenerContainer 등록
container.addMessageListener(
    listener,
    PatternTopic("__keyevent@0__:expired")
)
```

---

## Eviction 정책

`maxmemory` 도달 시 Redis가 어떤 키를 제거할지 결정하는 정책.

```conf
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

### 정책 종류

| 정책 | 설명 |
|------|------|
| `noeviction` | 메모리 초과 시 쓰기 오류 반환 (기본) |
| `allkeys-lru` | 모든 키 중 LRU (가장 오래 사용 안 된 것) 제거 |
| `allkeys-lfu` | 모든 키 중 LFU (가장 적게 사용된 것) 제거 |
| `allkeys-random` | 모든 키 중 무작위 제거 |
| `volatile-lru` | TTL 있는 키 중 LRU 제거 |
| `volatile-lfu` | TTL 있는 키 중 LFU 제거 |
| `volatile-random` | TTL 있는 키 중 무작위 제거 |
| `volatile-ttl` | TTL 있는 키 중 TTL 가장 짧은 것 제거 |

### 정책 선택 가이드

```
캐시 용도 (모든 키가 재생성 가능):
  → allkeys-lru (가장 일반적)
  → allkeys-lfu (접근 빈도 기반, 핫스팟 데이터 보존)

세션 + 캐시 혼합:
  → volatile-lru (TTL 있는 캐시만 제거, 영구 데이터 보존)

삭제하면 안 되는 데이터가 있음:
  → noeviction (쓰기 오류로 명시적 알림)
```

### LRU vs LFU

```
LRU (Least Recently Used):
  최근에 사용되지 않은 것 먼저 제거
  단점: 한 번 많이 사용된 키가 이후 오래 남아있을 수 있음

LFU (Least Frequently Used):
  사용 횟수가 적은 것 먼저 제거
  장점: 진짜 인기 없는 데이터 제거
  설정: maxmemory-policy allkeys-lfu
        lfu-decay-time 1  # 분 단위 카운터 감소 주기
        lfu-log-factor 10 # 카운터 증가 속도
```

---

## 메모리 상태 확인

```bash
# 메모리 정보
INFO memory

# 중요 지표:
# used_memory: 사용 중인 메모리
# used_memory_peak: 최대 사용 메모리
# used_memory_rss: OS가 할당한 메모리
# mem_fragmentation_ratio: 메모리 단편화 비율 (1~1.5 정상)
# maxmemory: 최대 허용 메모리
# maxmemory_policy: 현재 정책
# evicted_keys: 제거된 키 수 (증가 중이면 메모리 부족)

# 특정 키의 메모리 사용량
MEMORY USAGE mykey
MEMORY USAGE mykey SAMPLES 5  # 중첩 자료구조 샘플링 수

# 메모리 진단
MEMORY DOCTOR

# 메모리 통계
MEMORY STATS
```

---

## 정리

- **EXPIRE/PEXPIRE**: 초/밀리초 단위 TTL 설정
- **TTL/PTTL**: 남은 시간 조회 (-1=영구, -2=없음)
- **PERSIST**: TTL 제거
- **Keyspace Notification**: 만료/변경 이벤트를 Pub/Sub으로 수신
- **maxmemory-policy**: 캐시 용도는 `allkeys-lru`, 혼합은 `volatile-lru`
- **eviction 모니터링**: `INFO memory`에서 `evicted_keys` 확인
