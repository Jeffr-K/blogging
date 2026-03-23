---
title: "[Redis] 17. 복제 — Master/Replica"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "replication", "master", "replica", "복제", "고가용성"]
---

# 복제 — Master/Replica

## 복제 구조

```
Master (쓰기/읽기)
  ├── Replica 1 (읽기 전용)
  ├── Replica 2 (읽기 전용)
  └── Replica 3 (읽기 전용)
            ↓
        Replica 3-1 (Cascaded Replica)
```

- **Master**: 모든 쓰기 처리
- **Replica**: 마스터를 비동기 복제, 읽기 요청 처리 가능
- **Cascaded**: Replica → 또 다른 Replica

---

## Replica 설정

### 정적 설정

```conf
# replica server의 redis.conf
replicaof 192.168.1.100 6379

# 또는 (레거시)
slaveof 192.168.1.100 6379

# 마스터 인증
masterauth your-master-password

# Replica를 읽기 전용으로 (기본 yes)
replica-read-only yes

# 마스터 연결 실패 시 오래된 데이터 서빙
replica-serve-stale-data yes
```

### 런타임 설정

```bash
# Replica 설정 (실행 중)
REPLICAOF 192.168.1.100 6379

# Replica 해제 (독립 Master로)
REPLICAOF NO ONE
```

---

## 복제 동작 원리

### 최초 동기화 (Full Sync)

```
Replica → PSYNC replicationId offset → Master
  ↓
Master:
  1. BGSAVE → RDB 생성
  2. RDB 전송
  3. 전송 중 새로 들어온 명령 버퍼 전송

Replica:
  1. 기존 데이터 삭제
  2. RDB 로드
  3. 버퍼 명령 적용
  → 동기화 완료
```

### 부분 동기화 (Partial Sync)

```
Replica가 잠깐 연결 끊겼다가 재연결 시:
  Replica → PSYNC replicationId offset → Master

Master:
  replication backlog에 해당 offset 이후 명령이 있으면
  → 부분 동기화 (RDB 재전송 없음)
  없으면 → 전체 동기화

repl-backlog-size 1mb  # backlog 크기 (기본 1MB)
```

### 비동기 복제

```
Master → 쓰기 → 즉시 응답 (Replica 확인 안 함)
               → Replica에 비동기 전파

장점: 낮은 지연
단점: 마스터 장애 시 미복제 데이터 유실 가능
```

### 동기 복제 (WAIT 명령어)

```bash
# WAIT numreplicas timeout(ms)
WAIT 1 1000  # 1개 Replica에 복제될 때까지 최대 1000ms 대기
             # 반환: 실제로 동기화된 Replica 수

# 모든 Replica 동기화 확인
WAIT 0 0  # timeout=0 → 즉시 반환 (현재 동기화된 수만 반환)
```

---

## 복제 정보 확인

```bash
# Master 복제 정보
INFO replication

# 중요 필드:
# role: master
# connected_slaves: 2
# slave0: ip=...,port=6380,state=online,offset=...,lag=0
# master_replid: ...
# master_repl_offset: ...
# repl_backlog_size: 1048576
# repl_backlog_active: 1

# Replica 복제 정보
INFO replication
# role: slave
# master_host: 192.168.1.100
# master_port: 6379
# master_link_status: up (down = 연결 끊김)
# master_last_io_seconds_ago: 0
# master_sync_in_progress: 0
# slave_repl_offset: ...
# slave_priority: 100
# slave_read_only: 1
```

---

## 복제 지연 (Replication Lag)

```bash
# 현재 Replica lag 확인
INFO replication
# → slave0: ...,lag=0 (0이면 실시간 동기화)

# lag이 크면:
#   1. 네트워크 대역폭 부족
#   2. Replica 처리 속도 느림
#   3. 마스터 쓰기 부하 과다
```

---

## Replica를 활용한 읽기 분산

```kotlin
// Spring 설정 - 읽기는 Replica, 쓰기는 Master
@Bean
fun redisTemplate(): RedisTemplate<String, String> {
    return RedisTemplate<String, String>().apply {
        connectionFactory = LettuceConnectionFactory(
            RedisClusterConfiguration(listOf("master:6379")),
            LettuceClientConfiguration.builder()
                .readFrom(ReadFrom.REPLICA_PREFERRED)  // Replica 우선 읽기
                .build()
        )
    }
}

// ReadFrom 옵션:
// ReadFrom.MASTER          → 항상 마스터 (기본)
// ReadFrom.REPLICA         → 항상 Replica
// ReadFrom.REPLICA_PREFERRED → Replica 우선, 없으면 마스터
// ReadFrom.MASTER_PREFERRED → 마스터 우선, 없으면 Replica
// ReadFrom.ANY             → 아무 노드나 (마스터/Replica 상관없이)
// ReadFrom.NEAREST         → RTT 가장 낮은 노드
```

---

## 주요 설정

```conf
# 복제 타임아웃 (기본 60초)
repl-timeout 60

# backlog 크기 (Partial Sync 범위)
repl-backlog-size 1mb
repl-backlog-ttl 3600  # backlog 유지 시간

# Replica 우선순위 (Sentinel에서 마스터 선출 시 사용)
replica-priority 100   # 낮을수록 높은 우선순위 (0 = 마스터 불가)

# 최소 Replica 조건 (쓰기 제한)
min-replicas-to-write 1     # 최소 1개 연결된 Replica 필요
min-replicas-max-lag 10     # lag이 10초 이하인 Replica

# Diskless 복제 (메모리 → 네트워크 직접 전송)
repl-diskless-sync yes
repl-diskless-sync-delay 5  # 5초 대기 후 전송 (여러 Replica 동시 처리)
```

---

## 정리

- **복제**: Master → Replica 비동기 전파, 읽기 분산 가능
- **Full Sync**: 최초 연결 시 RDB 전송 + 버퍼 명령
- **Partial Sync**: 재연결 시 backlog 내 명령만 전송 (빠름)
- **WAIT**: 동기식 복제 보장 — 마스터 장애 시 데이터 유실 방지
- **ReadFrom.REPLICA_PREFERRED**: 읽기를 Replica로 분산 (마스터 부하 감소)
- **min-replicas-to-write**: Replica 없을 때 쓰기 거부 (데이터 안전성)
