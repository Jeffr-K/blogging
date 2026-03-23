---
title: "[Redis] 6. Set — 명령어 전체와 활용 패턴"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "set", "SADD", "집합연산", "태그", "팔로워"]
---

# Set — 명령어 전체와 활용 패턴

## 개요

Redis Set은 중복 없는 무순서 집합. 합집합, 교집합, 차집합 O(N) 연산 지원. 최대 2^32 - 1개 요소.

---

## 기본 명령어

### 추가 / 제거

```bash
# 추가
SADD set member1 member2 member3  # 추가된 수 반환

# 제거
SREM set member1 member3          # 제거된 수 반환

# 무작위 제거 및 반환
SPOP set            # 1개 무작위 제거 후 반환
SPOP set 3          # 3개 무작위 제거 후 반환

# 한 Set에서 다른 Set으로 이동 (원자적)
SMOVE source destination member
```

### 조회

```bash
# 모든 멤버
SMEMBERS set

# 멤버 수
SCARD set

# 멤버 존재 여부
SISMEMBER set member          # 0 또는 1

# 여러 멤버 동시 확인 (Redis 6.2+)
SMISMEMBER set member1 member2 member3  # [0/1, 0/1, 0/1]

# 무작위 조회 (제거 없음)
SRANDMEMBER set         # 1개 무작위 반환
SRANDMEMBER set 3       # 3개 무작위 (중복 없음)
SRANDMEMBER set -3      # 3개 무작위 (중복 허용)
```

### 순회

```bash
SSCAN set 0 MATCH "user:*" COUNT 100
```

---

## 집합 연산

```bash
# 합집합 (두 집합의 모든 원소)
SUNION set1 set2 set3
SUNIONSTORE destination set1 set2   # 결과를 destination에 저장

# 교집합 (공통 원소)
SINTER set1 set2
SINTERSTORE destination set1 set2

# 교집합 크기만 (Redis 7.0+, 데이터 전송 없이 빠름)
SINTERCARD 2 set1 set2
SINTERCARD 2 set1 set2 LIMIT 100    # 최대 100개까지만 계산

# 차집합 (set1에 있고 set2에 없는 원소)
SDIFF set1 set2
SDIFFSTORE destination set1 set2
```

---

## 활용 패턴

### 태그 시스템

```bash
# 게시글에 태그 추가
SADD post:123:tags "redis" "nosql" "database"
SADD post:456:tags "redis" "performance" "tuning"

# 태그로 게시글 역인덱스
SADD tag:redis post:123 post:456
SADD tag:nosql post:123
SADD tag:performance post:456

# "redis" 태그 게시글 조회
SMEMBERS tag:redis  # {post:123, post:456}

# "redis" AND "nosql" 태그 게시글 (교집합)
SINTER tag:redis tag:nosql  # {post:123}

# "redis" OR "nosql" 태그 게시글 (합집합)
SUNION tag:redis tag:nosql  # {post:123, post:456}
```

### 팔로워 / 팔로잉

```bash
# 팔로우
SADD following:user-A "user-B" "user-C" "user-D"
SADD followers:user-B "user-A"
SADD followers:user-C "user-A"

# 맞팔 확인 (교집합)
SINTER following:user-A followers:user-A

# 함께 아는 사람 (user-A, user-B 모두 팔로우하는 사람)
SINTER following:user-A following:user-B

# user-B를 팔로우하지 않는 user-A의 팔로잉
SDIFF following:user-A followers:user-B
```

### 중복 방문 제거

```bash
# 오늘 방문한 사용자 추가
SADD visitors:2024-01-01 "user-1001" "user-1002"
SADD visitors:2024-01-01 "user-1001"  # 중복 → 무시

# 오늘 유니크 방문자 수
SCARD visitors:2024-01-01

# TTL 설정 (다음 날 자정 삭제)
EXPIRE visitors:2024-01-01 86400
```

### 온라인 사용자

```bash
# 사용자 접속 시
SADD online-users "user-1001"

# 사용자 접속 종료 시
SREM online-users "user-1001"

# 현재 온라인 수
SCARD online-users

# 특정 사용자 온라인 여부
SISMEMBER online-users "user-1001"

# 온라인 사용자 샘플 조회 (전체 전송 없이)
SRANDMEMBER online-users 10
```

### 권한 / 역할 관리

```bash
# 역할에 권한 부여
SADD role:admin "read" "write" "delete" "manage-users"
SADD role:editor "read" "write"
SADD role:viewer "read"

# 사용자에 역할 부여
SADD user:1001:roles "admin"
SADD user:1002:roles "editor" "viewer"

# 특정 권한 보유 여부 (교집합)
SINTER role:admin "delete"  # 직접 이렇게 사용하지는 않음

# 두 역할의 합산 권한
SUNION role:editor role:viewer  # {"read", "write"}
```

### 블랙리스트 / 화이트리스트

```bash
# IP 블랙리스트
SADD blacklist:ip "1.2.3.4" "5.6.7.8"

# 접근 차단 확인
SISMEMBER blacklist:ip "1.2.3.4"  # 1 → 차단

# 이메일 블랙리스트
SADD blacklist:email "spam@example.com"
```

### 복권 / 무작위 추첨

```bash
# 응모자 등록
SADD lottery:event-2024 "user-1001" "user-1002" "user-1003" "user-1004"

# 당첨자 3명 무작위 선택 (제거)
SPOP lottery:event-2024 3

# 당첨자 3명 선택 (유지)
SRANDMEMBER lottery:event-2024 3
```

---

## 정리

| 명령어 | 설명 |
|--------|------|
| SADD | 멤버 추가 |
| SREM | 멤버 제거 |
| SMEMBERS | 전체 조회 |
| SCARD | 원소 수 |
| SISMEMBER | 멤버 존재 여부 |
| SMISMEMBER | 여러 멤버 존재 여부 |
| SPOP | 무작위 제거 |
| SRANDMEMBER | 무작위 조회 |
| SUNION | 합집합 |
| SINTER | 교집합 |
| SDIFF | 차집합 |
| SMOVE | 다른 Set으로 이동 |
| SSCAN | 순회 |
