---
title: "Redis 영속화: RDB와 AOF"
date: 2026-04-12
tags: [redis, persistence, rdb, aof, durability]
---

## 왜 영속화가 필요한가

Redis는 인메모리 DB입니다. 재시작하면 데이터가 사라집니다.

```
영속화 없음: Redis 재시작 → 캐시 전체 소멸 → DB 폭격
영속화 있음: Redis 재시작 → 마지막 스냅샷/로그에서 복구
```

---

## RDB (Redis Database Snapshot)

특정 시점의 전체 데이터를 바이너리 파일로 저장합니다.

```bash
# redis.conf
save 900 1       # 900초 동안 1번 이상 변경 시 저장
save 300 10      # 300초 동안 10번 이상 변경 시 저장
save 60 10000    # 60초 동안 10000번 이상 변경 시 저장

dbfilename dump.rdb
dir /var/lib/redis
```

```bash
# 수동 저장
redis-cli BGSAVE    # 백그라운드 저장 (fork 사용, 블록 없음)
redis-cli SAVE      # 동기식 저장 (블록됨, 사용 지양)
redis-cli LASTSAVE  # 마지막 저장 시간 확인
```

**동작 방식:**
```
BGSAVE 호출 →
  fork() → 자식 프로세스 생성
  자식: 메모리 스냅샷을 .rdb 파일로 직렬화
  부모: 계속 클라이언트 요청 처리 (Copy-on-Write)
  자식 완료 → 기존 dump.rdb 교체
```

**장점:** 파일 하나, 빠른 복구, 컴팩트한 바이너리  
**단점:** 마지막 저장 이후 데이터 손실 가능 (수분~수시간)

---

## AOF (Append Only File)

모든 쓰기 명령어를 로그 파일에 순서대로 추가합니다.

```bash
# redis.conf
appendonly yes
appendfilename "appendonly.aof"

# fsync 주기 설정
appendfsync always    # 매 명령어마다 (안전, 느림)
appendfsync everysec  # 1초마다 (균형, 권장)
appendfsync no        # OS에 맡김 (빠름, 데이터 손실 가능)
```

**AOF 재작성 (Rewrite):**

```
AOF 파일이 계속 커짐 → 주기적으로 압축

예: SET x 1, SET x 2, SET x 3 → SET x 3 (최종값만)
```

```bash
# redis.conf
auto-aof-rewrite-percentage 100   # 파일 크기 2배 되면 재작성
auto-aof-rewrite-min-size 64mb    # 최소 64MB 이상일 때

# 수동 트리거
redis-cli BGREWRITEAOF
```

**장점:** 데이터 손실 최소화 (최대 1초)  
**단점:** 파일 크기 크고, 복구 시간 길고, I/O 부하 있음

---

## RDB vs AOF 비교

| | RDB | AOF |
|--|-----|-----|
| 데이터 손실 | 수분~수시간 | 최대 1초 |
| 파일 크기 | 작음 (바이너리) | 큼 (텍스트 명령어) |
| 복구 속도 | 빠름 | 느림 |
| I/O 부하 | 낮음 | 높음 |
| 적합 상황 | 백업, 캐시 | 중요 데이터 |

---

## 혼합 사용 (권장)

```bash
# redis.conf
save 900 1           # RDB 활성화
appendonly yes       # AOF 활성화
aof-use-rdb-preamble yes  # RDB+AOF 혼합 형식 (Redis 4.0+)
```

혼합 형식: RDB 스냅샷 + 이후 변경사항 AOF → 빠른 복구 + 최소 손실

---

## 캐시 용도에서의 선택

```
순수 캐시 (재시작 시 DB에서 재생성 가능):
  → 영속화 불필요 또는 RDB만 (성능 최우선)
  → save "" (RDB 비활성화)

중요 데이터 포함 (세션, 분산 락):
  → AOF + everysec
  → 또는 RDB + AOF 혼합
```

---

## 복구 시뮬레이션

```bash
# RDB에서 복구
cp dump.rdb /var/lib/redis/
redis-server  # 시작 시 자동으로 dump.rdb 로드

# AOF에서 복구
redis-server --appendonly yes
# 시작 시 appendonly.aof 재생

# 복구 확인
redis-cli DBSIZE  # 복구된 키 수
redis-cli INFO persistence  # 복구 상태 확인
```

---

## 핵심 요약

- **RDB**: 스냅샷, 빠른 복구, 최대 수분 손실, 캐시에 적합
- **AOF**: 모든 명령어 로그, 최대 1초 손실, 중요 데이터에 적합
- **혼합**: RDB+AOF → 빠른 복구 + 최소 손실 (권장)
- 순수 캐시: 영속화 없이 운영 가능 (DB에서 재생성)
- `appendfsync everysec`: AOF 성능/안전성 균형
