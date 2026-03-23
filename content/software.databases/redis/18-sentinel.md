---
title: "[Redis] 18. Redis Sentinel — 자동 장애조치"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "sentinel", "장애조치", "failover", "고가용성", "모니터링"]
---

# Redis Sentinel — 자동 장애조치

## 개요

Redis Sentinel은 Redis의 고가용성(HA) 솔루션.

```
┌──────────────────────────────────────────────────────┐
│                  Sentinel 클러스터                    │
│   Sentinel 1    Sentinel 2    Sentinel 3             │
│       ↓              ↓              ↓               │
│   ┌────────────────────────────────────────────┐    │
│   │  Redis: Master + Replicas                   │   │
│   │  Master  →  Replica 1  →  Replica 2        │   │
│   └────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Sentinel의 역할**:
1. **모니터링**: Master/Replica 상태 지속 감시
2. **알림**: 장애 발생 시 알림
3. **자동 장애조치**: Master 장애 시 Replica를 새 Master로 승격
4. **서비스 디스커버리**: 클라이언트가 현재 Master 주소를 Sentinel에 물어봄

---

## Sentinel 설정

### sentinel.conf

```conf
# 포트 (기본 26379)
port 26379

# 모니터링할 Master (quorum = 과반수 Sentinel 동의 필요)
sentinel monitor mymaster 192.168.1.100 6379 2
# sentinel monitor <name> <host> <port> <quorum>

# Master 비밀번호
sentinel auth-pass mymaster your-master-password

# Master 장애 판단 시간 (기본 30초)
sentinel down-after-milliseconds mymaster 30000

# 장애조치 타임아웃 (기본 3분)
sentinel failover-timeout mymaster 180000

# 동시에 설정 변경 가능한 Replica 수
# 1 = 하나씩 순서대로 (가용성 최대)
sentinel parallel-syncs mymaster 1

# Daemonize
daemonize yes
logfile /var/log/redis/sentinel.log
```

### 실행

```bash
redis-sentinel /etc/redis/sentinel.conf
# 또는
redis-server /etc/redis/sentinel.conf --sentinel
```

---

## 장애조치 동작

### Subjective Down (SDOWN)

```
단일 Sentinel이 Master와 down-after-milliseconds 동안 통신 실패
→ 해당 Sentinel: "Master가 SDOWN 상태"
```

### Objective Down (ODOWN)

```
quorum 개수 이상의 Sentinel이 SDOWN 동의
→ Master가 ODOWN 상태 → 장애조치 시작
```

### 장애조치 과정

```
1. 리더 Sentinel 선출 (Raft 유사)
2. 리더가 최적의 Replica 선택:
   - replica-priority 낮은 것 우선 (0 = 제외)
   - 복제 offset이 마스터와 가장 가까운 것
   - Run ID 사전순
3. 선택된 Replica → REPLICAOF NO ONE (새 Master)
4. 나머지 Replica → 새 Master를 복제하도록 REPLICAOF 변경
5. 모든 클라이언트에 새 Master 주소 알림
6. 구 Master 복구 시 → Replica로 재합류
```

---

## Sentinel 명령어 (sentinel CLI)

```bash
# Sentinel에 접속
redis-cli -p 26379

# 모니터링 중인 Master 정보
SENTINEL masters
SENTINEL master mymaster

# Replica 목록
SENTINEL replicas mymaster
SENTINEL slaves mymaster  # 레거시

# Sentinel 목록
SENTINEL sentinels mymaster

# 현재 Master 주소
SENTINEL get-master-addr-by-name mymaster
# → ["192.168.1.100", "6379"]

# 수동 장애조치 트리거
SENTINEL failover mymaster

# Sentinel 설정 확인
SENTINEL ckquorum mymaster
# → OK 3 usable Sentinels. Quorum and failover authorization can be reached

# 모니터링 추가/제거
SENTINEL monitor newmaster 192.168.1.200 6379 2
SENTINEL remove mymaster

# 설정 변경
SENTINEL set mymaster down-after-milliseconds 15000
SENTINEL set mymaster failover-timeout 120000

# 초기화
SENTINEL reset mymaster  # 상태 초기화 (복구 후 재동기화)
```

---

## 클라이언트 연동 (Spring + Lettuce)

```kotlin
// application.yml
spring:
  data:
    redis:
      sentinel:
        master: mymaster
        nodes:
          - 192.168.1.101:26379
          - 192.168.1.102:26379
          - 192.168.1.103:26379
        password: sentinel-password  # Sentinel 비밀번호 (필요시)
      password: redis-password       # Redis 비밀번호
```

```kotlin
// Java Config
@Bean
fun redisSentinelConfig(): RedisSentinelConfiguration {
    return RedisSentinelConfiguration("mymaster", setOf(
        "192.168.1.101:26379",
        "192.168.1.102:26379",
        "192.168.1.103:26379",
    )).apply {
        setPassword("redis-password")
        sentinelPassword = RedisPassword.of("sentinel-password")
    }
}

@Bean
fun connectionFactory(config: RedisSentinelConfiguration): LettuceConnectionFactory {
    val clientConfig = LettuceClientConfiguration.builder()
        .readFrom(ReadFrom.REPLICA_PREFERRED)
        .build()
    return LettuceConnectionFactory(config, clientConfig)
}
```

---

## Sentinel 고가용성 구성

```
최소 구성:
  Sentinel 3개 (quorum=2)
  Redis 1 Master + 2 Replica

이유:
  quorum=2 → 2개 Sentinel이 동의해야 장애조치
  Sentinel 1개 다운 → 나머지 2개로 quorum 충족 가능

주의:
  Sentinel과 Redis를 같은 서버에 배치 → 서버 다운 시 둘 다 죽음
  가능하면 서로 다른 물리 서버에 배치
  다른 AZ에 배치 → AZ 장애 내성
```

---

## 정리

- **Sentinel**: Redis HA 솔루션 — 모니터링 + 자동 장애조치 + 서비스 디스커버리
- **SDOWN → ODOWN**: 단일 감지 → quorum 동의 → 장애조치
- **quorum**: 장애조치 시작에 필요한 최소 Sentinel 동의 수 (보통 n/2+1)
- **Failover 우선순위**: replica-priority 낮을수록 우선 (0=마스터 후보 제외)
- **클라이언트**: Sentinel 주소 목록 설정 → Spring이 자동으로 현재 Master 추적
