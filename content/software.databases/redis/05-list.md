---
title: "[Redis] 5. List — 명령어 전체와 활용 패턴"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "list", "LPUSH", "RPUSH", "BLPOP", "큐", "스택"]
---

# List — 명령어 전체와 활용 패턴

## 개요

Redis List는 순서 있는 연결 리스트. 양 끝에서 O(1) push/pop. 최대 2^32 - 1개 요소.

```
head ← [A] ← [B] ← [C] ← [D] → tail
       LPUSH                RPUSH
       LPOP                 RPOP
```

---

## Push 명령어

```bash
# 오른쪽(tail)에 추가
RPUSH list a b c       # list: [a, b, c]
RPUSH list d           # list: [a, b, c, d]

# 왼쪽(head)에 추가
LPUSH list x y z       # list: [z, y, x, a, b, c, d]

# 키가 있을 때만 push
RPUSHX list value      # 키 없으면 무시
LPUSHX list value

# 삽입 (특정 요소 앞/뒤에)
LINSERT list BEFORE "b" "before-b"
LINSERT list AFTER  "b" "after-b"
```

---

## Pop 명령어

```bash
# 왼쪽에서 pop
LPOP list          # 첫 번째 요소 제거 후 반환
LPOP list 3        # 왼쪽에서 3개 제거 후 반환 (Redis 6.2+)

# 오른쪽에서 pop
RPOP list          # 마지막 요소 제거 후 반환
RPOP list 3        # 오른쪽에서 3개 (Redis 6.2+)

# Blocking pop (큐에서 필수!)
BLPOP list1 list2 timeout  # 왼쪽에서 blocking pop, timeout 초 대기
BRPOP list1 list2 timeout  # 오른쪽에서 blocking pop

# 예시: 30초 대기
BLPOP tasks 30             # 메시지 올 때까지 최대 30초 대기
                           # 반환: [key, value]

# 오른쪽에서 pop하여 다른 리스트 왼쪽에 push (원자적)
RPOPLPUSH source destination
BRPOPLPUSH source destination timeout  # blocking 버전
LMOVE source destination LEFT  RIGHT  # Redis 6.2+
BLMOVE source destination LEFT  RIGHT timeout
```

---

## 읽기 명령어

```bash
# 범위 조회 (인덱스 기반)
LRANGE list 0 -1    # 전체
LRANGE list 0 9     # 처음 10개
LRANGE list -10 -1  # 마지막 10개

# 특정 인덱스 조회
LINDEX list 0       # 첫 번째
LINDEX list -1      # 마지막
LINDEX list 5       # 6번째

# 리스트 길이
LLEN list

# 값으로 검색 (Redis 6.0.6+)
LPOS list "target"          # 처음 발견 위치 (인덱스)
LPOS list "target" RANK 2   # 두 번째 발견 위치
LPOS list "target" COUNT 0  # 모든 위치
LPOS list "target" MAXLEN 100  # 처음 100개 내에서만 탐색
```

---

## 수정 / 삭제 명령어

```bash
# 특정 인덱스 값 변경
LSET list 2 "new-value"

# 값으로 삭제
LREM list count value
# count > 0: head → tail 방향으로 count개 삭제
# count < 0: tail → head 방향으로 |count|개 삭제
# count = 0: 모두 삭제

LREM list 1 "duplicate"   # 앞에서 첫 번째 "duplicate" 삭제
LREM list -1 "duplicate"  # 뒤에서 첫 번째 "duplicate" 삭제
LREM list 0 "duplicate"   # "duplicate" 전부 삭제

# 범위 밖 요소 삭제 (trim)
LTRIM list 0 99    # 처음 100개만 유지, 나머지 삭제
LTRIM list -100 -1 # 마지막 100개만 유지
```

---

## 다중 리스트 pop

```bash
# 여러 리스트 중 하나에서 pop (Redis 7.0+)
LMPOP 2 list1 list2 LEFT         # list1, list2 중 처음 있는 것에서
LMPOP 2 list1 list2 LEFT COUNT 5 # 최대 5개
BLMPOP timeout 2 list1 list2 LEFT # blocking 버전
```

---

## 활용 패턴

### 작업 큐 (Task Queue)

```bash
# Producer: 작업 추가
RPUSH queue:email "{'to':'alice@...','subject':'...'}"
RPUSH queue:email "{'to':'bob@...','subject':'...'}"

# Consumer: 작업 처리 (Blocking)
BLPOP queue:email 0  # 0 = 무한 대기

# 우선순위 큐 (여러 큐 감시)
BLPOP queue:urgent queue:normal queue:low 30
# urgent에 있으면 먼저 처리
```

```kotlin
// Kotlin Consumer
fun startWorker() {
    while (true) {
        val result = redis.blpop(30, "queue:email") ?: continue
        val (key, task) = result
        processTask(task)
    }
}
```

### 안전한 큐 (Reliable Queue)

```bash
# RPOPLPUSH로 처리 중 큐에 보존
# Pop: processing 큐로 이동
RPOPLPUSH queue:tasks queue:processing

# 처리 완료 시 processing에서 제거
LREM queue:processing 1 "task-value"

# 서버 재시작 시 processing 큐의 미처리 항목 복구
LRANGE queue:processing 0 -1  # 미처리 항목 확인
RPOPLPUSH queue:processing queue:tasks  # 복구
```

### 최근 N개 이력

```bash
# 최근 검색어 (최대 10개 유지)
LPUSH recent-searches:user-1001 "redis tutorial"
LTRIM recent-searches:user-1001 0 9   # 10개 초과 제거

LRANGE recent-searches:user-1001 0 -1  # 전체 조회
```

### 타임라인 / 피드

```bash
# 새 게시글 타임라인에 추가
LPUSH timeline:user-1001 "post-id-789"
LTRIM timeline:user-1001 0 999  # 최근 1000개 유지

# 타임라인 페이지네이션
LRANGE timeline:user-1001 0 19   # 첫 페이지 (20개)
LRANGE timeline:user-1001 20 39  # 두 번째 페이지
```

### 스택 (LIFO)

```bash
LPUSH stack item1 item2 item3  # stack: [item3, item2, item1]
LPOP stack                     # item3 (LIFO)
```

### 메시지 브로드캐스트 (팬아웃)

```bash
# 팔로워에게 게시글 배포
LPUSH feed:follower-101 "post-id-789"
LPUSH feed:follower-102 "post-id-789"
LPUSH feed:follower-103 "post-id-789"

# 각 팔로워가 자신의 피드 읽기
LRANGE feed:follower-101 0 19
```

---

## 정리

| 명령어 | 설명 |
|--------|------|
| RPUSH/LPUSH | 오른쪽/왼쪽에 추가 |
| RPOP/LPOP | 오른쪽/왼쪽에서 제거 |
| BLPOP/BRPOP | Blocking pop (큐 패턴 필수) |
| LRANGE | 범위 조회 |
| LLEN | 길이 |
| LTRIM | 범위 밖 삭제 (최근 N개 유지) |
| LINSERT | 특정 요소 앞/뒤에 삽입 |
| LPOS | 값으로 인덱스 탐색 |
| RPOPLPUSH/LMOVE | 다른 리스트로 원자적 이동 |

- **큐**: RPUSH + BLPOP (신뢰성: RPOPLPUSH 사용)
- **스택**: LPUSH + LPOP
- **최근 N개**: LPUSH + LTRIM
