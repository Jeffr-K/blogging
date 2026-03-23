---
title: "[Redis] 9. Bitmap & HyperLogLog — 공간 효율적 카운팅"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "bitmap", "hyperloglog", "DAU", "출석", "중복제거"]
---

# Bitmap & HyperLogLog — 공간 효율적 카운팅

## Bitmap

### 개요

Bitmap은 String 타입 위에 구현된 비트 배열. 인덱스(offset)로 개별 비트를 조작.

```
offset: 0 1 2 3 4 5 6 7 | 8 9 10 ...
bits:   1 0 1 1 0 0 1 0 | ...

SETBIT key 0 1  → bit[0] = 1
SETBIT key 2 1  → bit[2] = 1
```

1억 명의 사용자 방문 여부 저장:
- 일반 Set: 수백 MB
- Bitmap: 12.5 MB (1억 비트 = 12.5 MB)

---

### Bitmap 명령어

```bash
# 비트 설정/조회
SETBIT key offset value  # offset 위치를 0/1로 설정, 이전 값 반환
GETBIT key offset        # offset 위치의 비트 반환

# 비트 수 집계
BITCOUNT key             # 1인 비트 총 수
BITCOUNT key 0 0         # 0번 바이트(byte 0)의 1 수
BITCOUNT key 0 9         # 0~9번 바이트의 1 수
BITCOUNT key 0 -1        # 전체 (기본)

# Redis 7.0+: BYTE vs BIT 인덱스
BITCOUNT key 0 9 BYTE    # 0~9번 바이트 (기본)
BITCOUNT key 0 9 BIT     # 0~9번 비트

# 비트 검색
BITPOS key 0             # 처음으로 0인 비트 위치
BITPOS key 1             # 처음으로 1인 비트 위치
BITPOS key 1 2           # 2번 바이트부터 처음으로 1인 위치
BITPOS key 1 2 5         # 2~5번 바이트 범위에서 처음으로 1인 위치

# 비트 연산 (결과를 destkey에 저장)
BITOP AND destkey key1 key2  # 교집합
BITOP OR  destkey key1 key2  # 합집합
BITOP XOR destkey key1 key2  # 배타적 합집합
BITOP NOT destkey key        # 반전 (NOT)
```

---

### Bitmap 활용 패턴

#### 출석 체크

```bash
# 1월 사용자 출석 (offset = 날짜-1, value = 출석 여부)
SETBIT attendance:user-1001:2024-01 0 1   # 1일 출석
SETBIT attendance:user-1001:2024-01 2 1   # 3일 출석
SETBIT attendance:user-1001:2024-01 4 1   # 5일 출석

# 3일 출석 여부 확인
GETBIT attendance:user-1001:2024-01 2     # 1

# 1월 총 출석 일수
BITCOUNT attendance:user-1001:2024-01     # 3

# 오늘 출석한 전체 사용자 수 (offset = userId)
SETBIT daily-login:2024-01-15 1001 1
SETBIT daily-login:2024-01-15 1002 1
SETBIT daily-login:2024-01-15 1003 1
BITCOUNT daily-login:2024-01-15           # 3 (오늘 로그인 수)

# 이번 주 매일 접속한 사용자 (7일 AND)
BITOP AND active-week \
  daily-login:2024-01-15 \
  daily-login:2024-01-16 \
  daily-login:2024-01-17 \
  daily-login:2024-01-18 \
  daily-login:2024-01-19 \
  daily-login:2024-01-20 \
  daily-login:2024-01-21
BITCOUNT active-week  # 7일 연속 접속자 수
```

#### 기능 플래그 (Feature Flag)

```bash
# 기능별로 활성화된 사용자 추적
SETBIT feature:dark-mode 1001 1   # 사용자 1001에게 dark-mode 활성화
SETBIT feature:dark-mode 1002 1
SETBIT feature:beta-api 1001 1

# 특정 사용자에게 기능 활성화 여부
GETBIT feature:dark-mode 1001     # 1

# dark-mode AND beta-api 모두 활성화된 사용자 수
BITOP AND feature:dark-mode+beta-api feature:dark-mode feature:beta-api
BITCOUNT feature:dark-mode+beta-api
```

#### 방문자 집합 연산

```bash
# 1월 방문자 (offset = userId)
SETBIT visitors:2024-01 1001 1
SETBIT visitors:2024-01 1002 1
SETBIT visitors:2024-02 1001 1
SETBIT visitors:2024-02 1003 1

# 1월에만 방문한 사용자
BITOP ANDNOT only-jan visitors:2024-01 visitors:2024-02
# (ANDNOT 없으므로 NOT + AND)
BITOP NOT not-feb visitors:2024-02
BITOP AND only-jan visitors:2024-01 not-feb

# 1월 또는 2월 방문한 사용자
BITOP OR visited-jan-or-feb visitors:2024-01 visitors:2024-02
BITCOUNT visited-jan-or-feb
```

---

## HyperLogLog

### 개요

HyperLogLog는 **확률적 알고리즘**으로 집합의 카디널리티(원소 수)를 추정. 정확한 값이 아닌 근사값 (오차율 0.81%).

```
정확한 방법:
  Set에 모든 사용자 ID 저장 → 정확하지만 원소 수에 비례한 메모리

HyperLogLog:
  PFADD → 어떤 데이터가 있었는지 기억하지 않음 → 최대 12KB
  PFCOUNT → 근사 카디널리티 반환
```

### HyperLogLog 명령어

```bash
# 원소 추가
PFADD visitors "user-1001" "user-1002" "user-1003"
PFADD visitors "user-1001"  # 이미 있으면 0 반환 (변화 없음)

# 카디널리티 조회
PFCOUNT visitors               # 약 3 (오차 0.81%)
PFCOUNT visitors1 visitors2    # 두 HLL 합집합 카디널리티

# 병합 (여러 HLL → 하나로)
PFMERGE destination hll1 hll2 hll3
PFCOUNT destination
```

### HyperLogLog 활용 패턴

#### DAU / MAU 측정

```bash
# 일별 접속자
PFADD dau:2024-01-15 "user-1001" "user-1002"
PFADD dau:2024-01-15 "user-1003"
PFCOUNT dau:2024-01-15   # 약 3

# MAU (월 접속자) = 일별 HLL 병합
PFMERGE mau:2024-01 \
  dau:2024-01-01 dau:2024-01-02 ... dau:2024-01-31
PFCOUNT mau:2024-01  # 1월 전체 유니크 방문자 (약)

# TTL 설정
EXPIRE dau:2024-01-15 86400  # 하루 후 삭제
```

#### 유니크 검색어

```bash
PFADD unique-queries:2024-01-15 "redis tutorial"
PFADD unique-queries:2024-01-15 "kafka vs rabbitmq"
PFADD unique-queries:2024-01-15 "redis tutorial"  # 중복

PFCOUNT unique-queries:2024-01-15  # 약 2
```

#### 페이지별 유니크 방문자

```bash
PFADD page-visitors:/home "user-A" "user-B" "user-C"
PFADD page-visitors:/products "user-A" "user-D"

# /home 유니크 방문자
PFCOUNT page-visitors:/home   # 약 3

# /home 또는 /products 방문자
PFCOUNT page-visitors:/home page-visitors:/products  # 약 4
```

---

## Bitmap vs HyperLogLog vs Set 비교

| | Bitmap | HyperLogLog | Set |
|--|--------|-------------|-----|
| 정확도 | 정확 | ~0.81% 오차 | 정확 |
| 메모리 | 사용자 수에 비례 (최대 512MB) | 최대 12KB | 원소 수에 비례 |
| 원소 복원 | 가능 (비트 위치로) | 불가 | 가능 |
| 집합 연산 | AND/OR/XOR (빠름) | 합집합만 (PFMERGE) | 교집합/합집합/차집합 |
| 사용처 | 출석, 기능플래그, 일별 방문자 | DAU/MAU 근사 | 정확한 중복 제거 |

---

## 정리

**Bitmap**:
- 정확한 비트 연산 필요 시 (출석, 기능 플래그)
- 사용자 ID가 정수이고 범위가 제한적일 때
- 집합 연산 (AND/OR/XOR)으로 복잡한 조건 처리

**HyperLogLog**:
- 수십억 개의 유니크 카운팅 (DAU, MAU)
- 메모리가 제한적이고 근사값으로 충분할 때
- 정확한 원소 목록이 필요 없을 때
