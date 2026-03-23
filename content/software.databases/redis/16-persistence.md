---
title: "[Redis] 16. 영속성 — RDB & AOF"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "persistence", "RDB", "AOF", "영속성", "백업"]
---

# 영속성 — RDB & AOF

## 영속성 전략 비교

| | RDB | AOF |
|--|-----|-----|
| 방식 | 특정 시점 스냅샷 | 모든 쓰기 명령 로그 |
| 파일 형식 | 바이너리 `.rdb` | 텍스트 `.aof` |
| 파일 크기 | 작음 | 큼 (rewrite로 줄임) |
| 재시작 속도 | 빠름 | 느림 (명령 재실행) |
| 데이터 유실 | 마지막 스냅샷 이후 | 최대 1초 (fsync=everysec) |
| 복구 신뢰성 | 중간 | 높음 |

---

## RDB (Redis Database Backup)

### 개념

```
특정 시점의 메모리 전체를 스냅샷으로 저장
fork() → 자식 프로세스가 dump.rdb 작성 → 부모는 계속 서비스
```

### 설정

```conf
# redis.conf

# 자동 저장 조건 (900초 내 1번 이상 변경 시)
save 900 1
save 300 10
save 60 10000

# 모든 자동 저장 비활성화
save ""

# RDB 파일 경로
dir /var/lib/redis
dbfilename dump.rdb

# RDB 실패 시 쓰기 중단 (기본 yes)
stop-writes-on-bgsave-error yes

# 압축 (기본 yes)
rdbcompression yes

# 체크섬 (기본 yes, 약간 느려짐)
rdbchecksum yes
```

### 수동 저장 명령어

```bash
# 백그라운드 저장 (비동기, 권장)
BGSAVE

# 저장 진행 상태
BGSAVE SCHEDULE  # 다음 BGSAVE 예약

# 동기 저장 (블로킹, 프로덕션 주의!)
SAVE

# 마지막 저장 시각
LASTSAVE         # 유닉스 타임스탬프 반환

# 저장 디버그 정보
DEBUG RELOAD     # 현재 데이터를 RDB로 저장 후 다시 로드
```

### RDB 특성

```
장점:
  단일 파일 → 백업/복구 간단
  부모 프로세스 성능 영향 최소
  빠른 재시작 (큰 데이터셋도 빠름)

단점:
  스냅샷 간격 동안 데이터 유실 가능
  fork() → 메모리 사용량 순간 2배 (CoW로 완화)
  큰 RDB 저장 중 레이턴시 스파이크 가능
```

---

## AOF (Append Only File)

### 개념

```
모든 쓰기 명령을 파일에 순차적으로 기록
재시작 시 AOF 파일의 모든 명령을 재실행 → 상태 복원
```

### 설정

```conf
# AOF 활성화
appendonly yes

# AOF 파일 이름
appendfilename "appendonly.aof"

# fsync 정책
appendfsync always    # 모든 쓰기마다 fsync → 가장 안전, 가장 느림
appendfsync everysec  # 초당 1회 fsync → 균형 (기본값, 권장)
appendfsync no        # OS에 맡김 → 빠름, 위험

# BGREWRITE 중 fsync 비활성화
no-appendfsync-on-rewrite yes  # 재작성 중 지연 방지

# 자동 AOF 재작성 조건
auto-aof-rewrite-percentage 100   # 마지막 재작성 대비 100% 증가 시
auto-aof-rewrite-min-size 64mb    # 최소 64MB 이상일 때
```

### AOF 재작성 (Rewrite)

시간이 지나면 AOF 파일이 커짐. Rewrite로 최소화.

```bash
# AOF 재작성 트리거 (백그라운드)
BGREWRITEAOF

# 재작성 상태
INFO persistence
# → aof_rewrite_in_progress: 0/1
# → aof_current_size: 현재 크기
# → aof_base_size: 마지막 재작성 크기
```

```
AOF 재작성 동작:
  fork() → 자식이 현재 메모리 상태를 최소한의 명령어로 작성
  (예: INCR key를 100번 하면 → SET key 100으로 압축)
  부모는 계속 기존 AOF + 새 버퍼에 기록
  재작성 완료 → 버퍼를 새 AOF에 추가 → 교체
```

### Multi-Part AOF (Redis 7.0+)

```
기존: 단일 appendonly.aof 파일
Redis 7.0+: 기본(base) AOF + 증분(incremental) AOF 분리

/var/lib/redis/appendonlydir/
  appendonly.aof.1.base.rdb   ← RDB 형식 기본 스냅샷
  appendonly.aof.1.incr.aof   ← 이후 변경 명령
  appendonly.aof.manifest     ← 매니페스트 파일

장점:
  재작성이 더 빠름 (기존 base를 그대로 사용)
  파일 손상 위험 감소
```

---

## RDB + AOF 복합 사용 (권장)

```conf
# 두 방식 동시 활성화
save 900 1
save 300 10
appendonly yes
appendfsync everysec
```

```
재시작 시 우선순위:
  AOF가 있으면 AOF 사용 (더 최신 데이터)
  AOF 없으면 RDB 사용

전략:
  RDB: 빠른 재시작 + 백업 포인트
  AOF: 최대 1초 데이터 유실 보장
```

---

## 영속성 없음 (캐시 전용)

```conf
# redis.conf
save ""          # RDB 비활성화
appendonly no    # AOF 비활성화
```

완전한 캐시 용도로만 사용할 때. 재시작 시 데이터 전부 유실.

---

## 복구 절차

### RDB 복구

```bash
# 1. Redis 중지
systemctl stop redis

# 2. 백업 파일 복사
cp /backup/dump.rdb /var/lib/redis/dump.rdb

# 3. Redis 시작
systemctl start redis

# 4. 데이터 확인
redis-cli DBSIZE
```

### AOF 복구 (손상된 경우)

```bash
# AOF 파일 복구 유틸리티
redis-check-aof --fix /var/lib/redis/appendonly.aof

# RDB 파일 검증
redis-check-rdb /var/lib/redis/dump.rdb
```

---

## 정리

- **RDB**: 스냅샷 백업, 빠른 재시작, 일부 데이터 유실 허용 가능한 경우
- **AOF**: 최소 데이터 유실 (everysec: 최대 1초), 파일 크기 크지만 신뢰성 높음
- **복합 (권장)**: RDB + AOF 동시 사용 — 빠른 재시작 + 최소 유실
- **캐시 전용**: 영속성 비활성화 — 재시작 시 DB에서 재로드
- **BGSAVE / BGREWRITEAOF**: 수동 스냅샷/재작성 트리거
