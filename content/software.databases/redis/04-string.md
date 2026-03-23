---
title: "[Redis] 4. String — 명령어 전체와 활용 패턴"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "string", "SET", "GET", "INCR", "캐시", "분산락"]
---

# String — 명령어 전체와 활용 패턴

## 개요

Redis String은 가장 기본적인 타입. 텍스트, 정수, 직렬화된 JSON, 바이너리까지 저장 가능. 최대 512MB.

---

## 기본 명령어

### SET / GET

```bash
# 기본
SET key value
GET key

# 옵션
SET key value EX 3600           # 만료 시간 (초)
SET key value PX 3600000        # 만료 시간 (밀리초)
SET key value EXAT 1700000000   # 유닉스 타임스탬프로 만료
SET key value PXAT 1700000000000

# 조건부 SET
SET key value NX     # key가 없을 때만 (Not eXists)
SET key value XX     # key가 있을 때만 (eXists)

# SET과 동시에 이전 값 반환
SET key new-value GET  # 이전 값 반환 (Redis 6.2+)

# 결합 사용
SET lock:order-123 "process-1" NX EX 30  # 분산락

# GET과 동시에 만료 설정
GETEX key EX 3600        # GET + EXPIRE
GETEX key PERSIST        # GET + TTL 제거
GETEX key EXAT timestamp

# GET과 동시에 삭제
GETDEL key  # GET + DEL (Redis 6.2+)
```

### 다중 키

```bash
# 여러 키 동시에 SET (원자적)
MSET key1 val1 key2 val2 key3 val3

# NX 조건으로 다중 SET (모두 없을 때만)
MSETNX key1 val1 key2 val2  # 하나라도 있으면 전체 실패

# 여러 키 동시에 GET
MGET key1 key2 key3  # [val1, val2, nil]
```

### 문자열 조작

```bash
# 문자열 길이
STRLEN key

# 문자열 뒤에 추가
APPEND key " world"  # "hello world"

# 부분 문자열 읽기
GETRANGE key 0 4     # 인덱스 0~4 (inclusive)
GETRANGE key -5 -1   # 끝에서 5번째부터 끝까지

# 부분 문자열 쓰기 (오프셋부터 덮어쓰기)
SETRANGE key 6 "Redis"
```

---

## 숫자 연산 (원자적)

```bash
# 정수 증감
INCR key        # +1
DECR key        # -1
INCRBY key 10   # +10
DECRBY key 5    # -5

# 부동소수 증감
INCRBYFLOAT key 1.5
INCRBYFLOAT key -0.3

# 초기화 패턴 (키 없으면 0으로 시작)
INCR counter     # 0 → 1
INCR counter     # 1 → 2
```

---

## 비트 연산

```bash
# 비트 SET/GET
SETBIT key offset value  # offset 위치의 비트를 0/1로 설정
GETBIT key offset        # offset 위치의 비트 반환

# 비트 집계
BITCOUNT key             # 1인 비트 수
BITCOUNT key 0 0         # 첫 번째 바이트의 1 수
BITCOUNT key 0 10        # 0~10 바이트 범위의 1 수

# 비트 연산 (결과를 destkey에 저장)
BITOP AND destkey key1 key2  # AND
BITOP OR  destkey key1 key2  # OR
BITOP XOR destkey key1 key2  # XOR
BITOP NOT destkey key        # NOT

# 처음으로 0/1이 나오는 위치 탐색
BITPOS key 0   # 처음 0 위치
BITPOS key 1   # 처음 1 위치
BITPOS key 1 2 # 2번째 바이트부터 처음 1 위치
```

---

## 활용 패턴

### 캐시 (Cache-Aside)

```bash
# 캐시 저장 (TTL 1시간)
SET cache:user:1001 '{"id":1001,"name":"alice"}' EX 3600

# 캐시 조회
GET cache:user:1001

# 캐시 무효화
DEL cache:user:1001
```

```kotlin
// Kotlin 예시
fun getUser(userId: Long): User {
    val cacheKey = "cache:user:$userId"
    val cached = redis.get(cacheKey)

    if (cached != null) {
        return json.parse(cached)
    }

    val user = db.findUser(userId)
    redis.setex(cacheKey, 3600, json.stringify(user))
    return user
}
```

### 분산락

```bash
# 락 획득 (NX: 없을 때만, EX: 30초 자동 만료)
SET lock:order-123 "process-1" NX EX 30

# 락 해제 (Lua 스크립트로 원자적 확인 후 삭제)
EVAL "
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  else
    return 0
  end
" 1 lock:order-123 "process-1"
```

### 카운터

```bash
# 페이지 뷰 카운터
INCR pageview:article:123
GET pageview:article:123

# 일별 카운터 (자동 만료)
SET counter:login:20240101 0
INCR counter:login:20240101
EXPIRE counter:login:20240101 86400  # 24시간 후 만료

# Rate Limiting
INCR rate:user-123:1700000000  # 초 단위 슬롯
EXPIRE rate:user-123:1700000000 1
```

### 세션 저장

```bash
# 세션 저장 (2시간)
SET session:abc123xyz '{"userId":1001,"role":"admin"}' EX 7200

# 세션 조회 및 갱신 (GETEX로 TTL 연장)
GETEX session:abc123xyz EX 7200

# 세션 삭제 (로그아웃)
DEL session:abc123xyz
```

### Feature Flag

```bash
# 기능 활성화 여부
SET feature:dark-mode "true"
SET feature:beta-api "false"

GET feature:dark-mode  # "true"

# 동적 설정값
SET config:max-upload-size "10485760"  # 10MB
SET config:maintenance-mode "false"
```

### 토큰 저장 (이메일 인증, 비밀번호 재설정)

```bash
# 인증 토큰 저장 (10분 만료)
SET token:email-verify:token-uuid-xxx "user-1001" EX 600

# 토큰 검증 후 삭제 (GETDEL)
GETDEL token:email-verify:token-uuid-xxx  # "user-1001" 반환 후 삭제
```

---

## 정리

| 명령어 그룹 | 명령어 |
|------------|--------|
| 기본 읽기/쓰기 | SET, GET, MSET, MGET, GETDEL, GETEX |
| 조건부 SET | SET NX, SET XX, MSETNX |
| TTL 포함 SET | SET EX, SET PX, SETEX, PSETEX |
| 문자열 조작 | APPEND, STRLEN, GETRANGE, SETRANGE |
| 숫자 연산 | INCR, DECR, INCRBY, DECRBY, INCRBYFLOAT |
| 비트 연산 | SETBIT, GETBIT, BITCOUNT, BITOP, BITPOS |
