---
title: "[Redis] 19. Redis Cluster — 샤딩과 수평 확장"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "cluster", "샤딩", "hash-slot", "수평확장", "파티셔닝"]
---

# Redis Cluster — 샤딩과 수평 확장

## 개요

Redis Cluster는 데이터를 여러 노드에 자동으로 분산(샤딩).

```
┌──────────────────────────────────────────────────────┐
│                  Redis Cluster                        │
│                                                       │
│  Node 1 (Master)     Node 2 (Master)     Node 3 (M)  │
│  Slot 0~5460         Slot 5461~10922     Slot 10923~  │
│       ↓                    ↓                  ↓      │
│  Node 1 (Replica)   Node 2 (Replica)   Node 3 (R)   │
└──────────────────────────────────────────────────────┘
```

**특징**:
- 총 16384개 해시 슬롯 → N개 마스터에 분배
- 마스터 1개 + Replica N개 (고가용성)
- 마스터 장애 시 Replica 자동 승격
- 선형 확장: 노드 추가 → 슬롯 재분배

---

## 해시 슬롯

```
키 → CRC16(키) % 16384 → 슬롯 번호 → 해당 슬롯의 노드

예:
  CRC16("user:1001") % 16384 = 1234  → Node 1 (슬롯 0~5460)
  CRC16("order:99") % 16384 = 8000   → Node 2 (슬롯 5461~10922)
```

### Hash Tags — 같은 노드에 배치

```bash
# {태그}로 같은 노드 강제
{user:1001}.profile  → CRC16("user:1001") 슬롯
{user:1001}.cart     → CRC16("user:1001") 슬롯 (같은 노드!)
{user:1001}.orders   → CRC16("user:1001") 슬롯 (같은 노드!)

# 이유: 클러스터에서 다중 키 명령(MGET, MSET 등)은
#       같은 슬롯의 키만 가능
#       Hash Tag로 관련 키들을 같은 노드에 배치
```

---

## 클러스터 설정

```conf
# redis.conf (각 노드)
cluster-enabled yes
cluster-config-file nodes.conf      # 자동 생성
cluster-node-timeout 15000          # 장애 판단 시간 (ms)
cluster-announce-ip 192.168.1.101   # 외부 공개 IP (컨테이너 환경)
cluster-announce-port 7001
cluster-announce-bus-port 17001     # 노드 간 통신 포트 (기본: port+10000)
```

### 클러스터 생성

```bash
# 6개 노드: 3 Master + 3 Replica
redis-cli --cluster create \
  192.168.1.101:7001 \
  192.168.1.102:7002 \
  192.168.1.103:7003 \
  192.168.1.104:7004 \
  192.168.1.105:7005 \
  192.168.1.106:7006 \
  --cluster-replicas 1    # 마스터 1개당 Replica 1개
```

---

## 클러스터 명령어

### 클러스터 정보

```bash
# 클러스터 상태
CLUSTER INFO

# 중요 필드:
# cluster_enabled: 1
# cluster_state: ok (fail이면 일부 슬롯 서비스 불가)
# cluster_slots_assigned: 16384 (전부 할당됨)
# cluster_known_nodes: 6
# cluster_size: 3 (마스터 수)

# 노드 목록
CLUSTER NODES
# <id> <host:port@bus-port> <flags> <master-id> <ping-sent> <pong-recv>
#      <epoch> <link-state> <slots>

# 슬롯 → 노드 매핑
CLUSTER SLOTS    # 레거시
CLUSTER SHARDS   # Redis 7.0+, 더 상세

# 특정 키의 슬롯
CLUSTER KEYSLOT mykey

# 특정 슬롯의 키 목록
CLUSTER GETKEYSINSLOT 0 10  # 슬롯 0에서 10개
CLUSTER COUNTKEYSINSLOT 0   # 슬롯 0의 키 수
```

### 노드 관리

```bash
# 노드 추가 (마스터)
redis-cli --cluster add-node \
  192.168.1.107:7007 \       # 새 노드
  192.168.1.101:7001         # 기존 노드 (연결 포인트)

# 노드 추가 (Replica)
redis-cli --cluster add-node \
  192.168.1.108:7008 \
  192.168.1.101:7001 \
  --cluster-slave \
  --cluster-master-id <master-node-id>

# 슬롯 재분배
redis-cli --cluster reshard 192.168.1.101:7001
# 대화식으로:
#   이동할 슬롯 수 입력
#   받을 노드 ID 입력
#   from 노드 ID 입력 (all = 균등 분배)

# 노드 제거 (슬롯 없어야 함)
redis-cli --cluster del-node \
  192.168.1.101:7001 \
  <node-id>

# 균형 재조정
redis-cli --cluster rebalance 192.168.1.101:7001
redis-cli --cluster rebalance --cluster-use-empty-masters 192.168.1.101:7001

# 클러스터 상태 확인
redis-cli --cluster check 192.168.1.101:7001

# 클러스터 수정 (문제 있을 때)
redis-cli --cluster fix 192.168.1.101:7001
```

---

## 클러스터 접속 (Spring + Lettuce)

```kotlin
// application.yml
spring:
  data:
    redis:
      cluster:
        nodes:
          - 192.168.1.101:7001
          - 192.168.1.102:7002
          - 192.168.1.103:7003
        max-redirects: 3   # MOVED 리다이렉트 최대 횟수
      password: your-password
```

```kotlin
// Java Config
@Bean
fun redisClusterConfig(): RedisClusterConfiguration {
    return RedisClusterConfiguration(listOf(
        "192.168.1.101:7001",
        "192.168.1.102:7002",
        "192.168.1.103:7003",
    )).apply {
        setPassword("your-password")
        maxRedirects = 3
    }
}

@Bean
fun connectionFactory(config: RedisClusterConfiguration): LettuceConnectionFactory {
    val clientConfig = LettuceClientConfiguration.builder()
        .readFrom(ReadFrom.REPLICA_PREFERRED)
        .build()
    return LettuceConnectionFactory(config, clientConfig)
}
```

### MOVED / ASK 리다이렉트

```
MOVED: 키가 다른 슬롯에 있음 (영구적)
  → 클라이언트가 해당 노드로 직접 재요청

ASK: 슬롯 이동 중 (임시적)
  → 클라이언트가 ASKING 명령 후 새 노드에 요청
```

Lettuce/Jedis는 MOVED/ASK를 자동으로 처리.

---

## 클러스터 제약사항

```
다중 키 명령 제한:
  MSET, MGET, DEL 등: 모두 같은 슬롯의 키만 가능
  → Hash Tag 사용하거나 Pipeline으로 개별 처리

트랜잭션 제한:
  MULTI/EXEC: 같은 슬롯의 키만 가능

Lua 스크립트:
  접근하는 모든 키가 같은 슬롯이어야 함

Pub/Sub:
  SUBSCRIBE는 어느 노드에나 가능
  PUBLISH는 모든 노드에 전파 (비효율)
  → Shard Pub/Sub (Redis 7.0+) 권장
```

---

## Sentinel vs Cluster

| | Sentinel | Cluster |
|--|----------|---------|
| 목적 | 고가용성 (HA) | 수평 확장 (Sharding) |
| 데이터 분산 | 없음 (단일 노드) | 16384 슬롯으로 분산 |
| 최대 메모리 | 단일 노드 한계 | 노드 수 × 노드 메모리 |
| 운영 복잡도 | 낮음 | 높음 |
| 다중 키 명령 | 제한 없음 | 같은 슬롯만 |
| 트랜잭션 | 제한 없음 | 같은 슬롯만 |
| 적합한 경우 | 단일 Redis 고가용성 | 수 GB 이상, 수평 확장 필요 |

---

## 정리

- **Hash Slot**: 16384개 슬롯을 마스터에 분배, CRC16 해시로 키→슬롯 매핑
- **Hash Tag**: `{tag}key` 형식으로 관련 키를 같은 노드에 배치
- **MOVED/ASK**: 슬롯 이동/재조정 중 클라이언트 리다이렉트
- **add-node + reshard**: 노드 추가 후 슬롯 재분배
- **cluster state: ok**: 16384 슬롯 전부 할당, 마스터 전원 정상
