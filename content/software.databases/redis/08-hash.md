---
title: "[Redis] 8. Hash — 명령어 전체와 활용 패턴"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "hash", "HSET", "HGET", "객체저장", "프로필"]
---

# Hash — 명령어 전체와 활용 패턴

## 개요

Redis Hash는 필드-값 쌍의 맵. 단일 키에 여러 필드 저장. 객체를 자연스럽게 표현. 내부적으로 소규모는 listpack, 128개 초과 시 hashtable.

---

## 기본 명령어

### 쓰기

```bash
# 단일 필드 설정
HSET user:1001 name "alice"        # 추가된 필드 수 반환
HSET user:1001 age 30 email "alice@example.com"  # 여러 필드

# 키 없을 때만 설정
HSETNX user:1001 name "alice"   # 0 또는 1 반환

# 숫자 증감
HINCRBY user:1001 age 1         # 정수 증가
HINCRBYFLOAT user:1001 score 1.5  # 부동소수 증가
```

### 읽기

```bash
# 단일 필드
HGET user:1001 name

# 여러 필드 동시
HMGET user:1001 name age email     # 순서대로 반환, 없는 필드는 nil

# 전체 필드-값
HGETALL user:1001                  # [field1, val1, field2, val2, ...]

# 전체 필드 이름만
HKEYS user:1001

# 전체 값만
HVALS user:1001

# 필드 수
HLEN user:1001

# 필드 존재 여부
HEXISTS user:1001 name             # 0 또는 1

# 필드 문자열 길이 (Redis 3.2+)
HSTRLEN user:1001 name
```

### 삭제

```bash
# 특정 필드 삭제
HDEL user:1001 email phone         # 삭제된 수 반환
```

### 순회

```bash
HSCAN user:1001 0 MATCH "addr:*" COUNT 100
```

---

## 활용 패턴

### 사용자 프로필

```bash
# 프로필 저장
HSET user:1001 \
  name "alice" \
  email "alice@example.com" \
  age 30 \
  role "admin" \
  created_at "2024-01-01T00:00:00Z" \
  last_login "2024-03-23T09:00:00Z"

# 특정 필드만 업데이트
HSET user:1001 last_login "2024-03-23T10:00:00Z"

# 특정 필드만 읽기
HMGET user:1001 name email role

# TTL (키 단위 — 전체 삭제)
EXPIRE user:1001 86400
```

### Hash vs String-JSON 비교

```bash
# String-JSON 방식:
SET user:1001 '{"name":"alice","age":30,"email":"alice@..."}'
# → age만 업데이트하려면 전체 읽고 수정 후 다시 저장 (네트워크 왕복 2배)

# Hash 방식:
HSET user:1001 age 31
# → 필드만 업데이트 (1번의 명령)
HINCRBY user:1001 age 1
# → 원자적으로 증가

# Hash 장점: 부분 읽기/쓰기, 원자적 숫자 연산
# String-JSON 장점: 단일 명령으로 전체 조회, 중첩 구조 표현
```

### 쇼핑 카트

```bash
# 상품 추가 (field=productId, value=수량)
HSET cart:user-1001 product:123 2
HSET cart:user-1001 product:456 1

# 수량 변경
HSET cart:user-1001 product:123 3
HINCRBY cart:user-1001 product:123 1  # 수량 +1

# 상품 제거
HDEL cart:user-1001 product:456

# 전체 카트 조회
HGETALL cart:user-1001
# 상품 수
HLEN cart:user-1001

# 세션과 함께 TTL
EXPIRE cart:user-1001 3600
```

### 카운터 집합

```bash
# 다양한 통계를 하나의 Hash에
HSET stats:article:123 \
  views 0 \
  likes 0 \
  comments 0 \
  shares 0

# 원자적 카운터 증가
HINCRBY stats:article:123 views 1
HINCRBY stats:article:123 likes 1

# 전체 통계 조회
HGETALL stats:article:123
```

### 설정 / 메타데이터

```bash
# 서비스 설정
HSET config:feature-flags \
  dark-mode "true" \
  beta-api "false" \
  new-checkout "true"

# 특정 플래그 조회
HGET config:feature-flags dark-mode

# 플래그 업데이트
HSET config:feature-flags dark-mode "false"
```

### 인벤토리 / 재고

```bash
# 상품 재고 (field=productId, value=재고 수)
HSET inventory:warehouse-1 product:123 100
HSET inventory:warehouse-1 product:456 50
HSET inventory:warehouse-1 product:789 0

# 재고 차감 (원자적)
HINCRBY inventory:warehouse-1 product:123 -5

# 재고 확인
HGET inventory:warehouse-1 product:123

# 모든 재고 조회
HGETALL inventory:warehouse-1
```

### 해시를 이용한 중복 방지

```bash
# 처리된 이벤트 ID 추적 (멱등성)
HSETNX processed-events event-uuid-xxx "1"
# 이미 처리됐으면 0 반환 → 중복 처리 방지

EXPIRE processed-events 86400  # 24시간 후 자동 만료
```

---

## 메모리 최적화

```
Hash가 listpack 인코딩 유지 조건:
  hash-max-listpack-entries <= 128 (기본)
  hash-max-listpack-value   <= 64  (기본)

→ listpack: 매우 메모리 효율적 (연속 메모리)
→ hashtable: 빠르지만 메모리 더 사용

수백만 개의 소규모 Hash를 저장할 때:
  하나의 Hash에 여러 객체를 묶어 저장하면 메모리 절약

예시:
  user:1001, user:1002, ..., user:1100  → 각각 String-JSON
  vs.
  user:bucket:10  → HSET user:bucket:10 1001 '{"name":"alice",...}'
                       HSET user:bucket:10 1002 '...'
                       (100개씩 묶으면 listpack 유지)
```

---

## 정리

| 명령어 | 설명 |
|--------|------|
| HSET | 필드 설정 (여러 개 동시) |
| HSETNX | 필드 없을 때만 설정 |
| HGET | 단일 필드 조회 |
| HMGET | 여러 필드 조회 |
| HGETALL | 전체 필드-값 조회 |
| HKEYS / HVALS | 키만/값만 조회 |
| HDEL | 필드 삭제 |
| HEXISTS | 필드 존재 여부 |
| HLEN | 필드 수 |
| HINCRBY / HINCRBYFLOAT | 숫자 증감 |
| HSCAN | 순회 |
