---
title: "[Redis] 3. 데이터 타입 개요"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "데이터타입", "자료구조", "인코딩"]
---

# 데이터 타입 개요

## Redis의 키-값 구조

```
Redis Database (선택된 DB)
  ↓
key (String) → value (여러 타입 중 하나)

모든 키는 문자열
값의 타입이 다양
```

### 키 규칙

```
- 최대 512MB (실용적으로 수십 바이트 권장)
- 바이너리 세이프 (모든 바이트 허용)
- 빈 문자열 "" 도 가능

권장 키 네이밍:
  object-type:id:field
  user:1001:profile
  session:abc123
  cache:api:/users/list
  lock:order:9999
```

---

## 타입별 개요

### String

가장 기본적인 타입. 문자열, 정수, 부동소수, 바이너리 저장.

```bash
SET name "alice"
GET name          # "alice"

SET counter 0
INCR counter      # 1
INCRBY counter 5  # 6

SET expires-key "value" EX 3600  # 1시간 TTL

# 최대 512MB
# 내부 인코딩: int, embstr (44바이트 이하), raw
```

**사용처**: 세션, 카운터, 캐시, 설정값, 분산락

### List

순서 있는 연결 리스트. 양방향 push/pop.

```bash
RPUSH tasks "task1" "task2" "task3"
LRANGE tasks 0 -1   # ["task1", "task2", "task3"]
LPOP tasks          # "task1"
RPOP tasks          # "task3"

BLPOP tasks 30  # 최대 30초 대기 후 pop (blocking)

# 최대 2^32 - 1개 요소
# 내부 인코딩: listpack (소규모), quicklist (대규모)
```

**사용처**: 작업 큐, 최근 N개 이력, 스택, 타임라인

### Set

중복 없는 무순서 집합. 집합 연산 지원.

```bash
SADD tags "python" "redis" "backend"
SMEMBERS tags           # {"python", "redis", "backend"}
SISMEMBER tags "redis"  # 1 (있음)
SCARD tags              # 3 (원소 수)

SUNION tags1 tags2      # 합집합
SINTER tags1 tags2      # 교집합
SDIFF tags1 tags2       # 차집합

# 내부 인코딩: listpack (소규모), hashtable (대규모)
```

**사용처**: 태그, 팔로워/팔로잉, 중복 제거, 권한 관리

### Sorted Set (ZSet)

점수(score)로 정렬된 집합.

```bash
ZADD leaderboard 9500 "alice"
ZADD leaderboard 8800 "bob"
ZADD leaderboard 9200 "charlie"

ZRANGE leaderboard 0 -1 WITHSCORES   # 오름차순 전체
ZREVRANGE leaderboard 0 2             # 내림차순 top 3
ZRANK leaderboard "bob"               # 순위 (0-based)
ZSCORE leaderboard "alice"            # 9500.0

# 내부 인코딩: listpack (소규모), skiplist (대규모)
```

**사용처**: 리더보드, 우선순위 큐, 시간순 이벤트, 범위 쿼리

### Hash

필드-값 쌍의 맵. 객체 저장에 적합.

```bash
HSET user:1001 name "alice" age 30 email "alice@example.com"
HGET user:1001 name         # "alice"
HMGET user:1001 name age    # ["alice", "30"]
HGETALL user:1001           # 전체 필드-값
HINCRBY user:1001 age 1     # 나이 +1

# 내부 인코딩: listpack (소규모), hashtable (대규모)
```

**사용처**: 사용자 프로필, 설정 객체, 카운터 집합

### Bitmap

비트 배열. 공간 효율적인 불리언 저장.

```bash
# 사용자 1001의 출석 체크 (day 1)
SETBIT attendance:2024-01 1001 1
GETBIT attendance:2024-01 1001   # 1
BITCOUNT attendance:2024-01       # 총 출석 수

# 내부: String으로 저장, 비트 연산 API 제공
# 오프셋 최대 2^32 (약 512MB)
```

**사용처**: 출석 체크, 기능 플래그, 방문자 추적

### HyperLogLog

확률적 카디널리티 추정. 최대 12KB로 수십억 개 중복 제거.

```bash
PFADD visitors "user-1" "user-2" "user-3"
PFCOUNT visitors   # 약 3 (오차율 0.81%)

PFMERGE total visitors:desktop visitors:mobile
PFCOUNT total
```

**사용처**: DAU/MAU, 유니크 방문자, 대규모 중복 제거

### Geospatial

위경도 기반 위치 인덱스.

```bash
GEOADD stores 127.0276 37.4979 "gangnam"
GEOADD stores 126.9780 37.5665 "jongno"

GEODIST stores gangnam jongno km   # 거리(km)
GEORADIUS stores 127.0 37.5 5 km   # 반경 5km 내 매장
GEOPOS stores gangnam              # 위경도 반환
```

**사용처**: 근처 매장, 배달 서비스, 지도 서비스

### Stream

Kafka와 유사한 메시지 스트림.

```bash
XADD events * action "login" userId "1001"
XREAD COUNT 10 STREAMS events 0

# Consumer Group
XGROUP CREATE events mygroup $ MKSTREAM
XREADGROUP GROUP mygroup consumer1 COUNT 10 STREAMS events >
XACK events mygroup <message-id>
```

**사용처**: 이벤트 로그, 메시지 큐, 감사 로그, 실시간 피드

---

## 내부 인코딩

Redis는 자료구조 크기에 따라 내부 인코딩을 자동으로 최적화.

| 타입 | 소규모 인코딩 | 대규모 인코딩 | 전환 기준 |
|------|--------------|--------------|-----------|
| String | int / embstr | raw | 44바이트 초과 |
| List | listpack | quicklist | 128개 초과 또는 64바이트 초과 |
| Set | listpack | hashtable | 128개 초과 또는 64바이트 초과 |
| ZSet | listpack | skiplist | 128개 초과 또는 64바이트 초과 |
| Hash | listpack | hashtable | 128개 초과 또는 64바이트 초과 |

```bash
# 인코딩 확인
OBJECT ENCODING mykey

# 인코딩 전환 임계값 조정
CONFIG SET hash-max-listpack-entries 64
CONFIG SET hash-max-listpack-value 32
CONFIG SET zset-max-listpack-entries 64
CONFIG SET set-max-intset-entries 512
```

---

## 메모리 사용량 예시

```
String "hello":       ~56 bytes
Hash (5 fields):      ~300 bytes
List (10 items):      ~400 bytes
Set (10 strings):     ~500 bytes

vs.

HyperLogLog (1억 unique):  ~12,000 bytes
Bitmap (1억 사용자 플래그): ~12,500,000 bytes (~12MB)
```

---

## 정리

| 타입 | 핵심 특징 | 대표 사용처 |
|------|-----------|-------------|
| String | 단순, 빠름, 원자 카운터 | 캐시, 세션, 카운터 |
| List | 순서 보장, blocking pop | 큐, 최근 이력 |
| Set | 중복 제거, 집합 연산 | 태그, 팔로워 |
| Sorted Set | 점수 정렬, 범위 쿼리 | 리더보드, 우선순위 |
| Hash | 객체 모델, 부분 업데이트 | 프로필, 설정 |
| Bitmap | 비트 효율, 집합 연산 | 출석, 기능 플래그 |
| HyperLogLog | 극소 메모리, 근사 카운팅 | DAU, 유니크 방문자 |
| Geospatial | 위치 인덱스, 거리 계산 | 근처 검색 |
| Stream | 영속 메시지, Consumer Group | 이벤트 스트리밍 |
