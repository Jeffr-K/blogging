---
title: "캐시 복제와 고가용성"
date: 2026-04-12
tags: [cache, replication, redis, sentinel, ha]
---

## 복제가 필요한 이유

```
단일 Redis 노드:
  → 다운 시 전체 캐시 소멸
  → 재시작 후 캐시 워밍 필요
  → 그동안 DB 과부하

복제 구성:
  → 마스터 다운 시 슬레이브가 승격
  → 캐시 데이터 보존
  → 무중단 서비스
```

---

## Redis 복제 동작 방식

```
마스터 → 슬레이브 동기화:
  1. 최초 연결: 마스터가 RDB 스냅샷 전송 (Full Sync)
  2. 이후: 마스터의 쓰기 명령을 실시간 스트림으로 전송 (Partial Sync)
  3. 슬레이브: 읽기 전용 (기본값)
```

```bash
# redis.conf (슬레이브)
replicaof 127.0.0.1 6379    # 마스터 주소
replica-read-only yes         # 슬레이브는 읽기 전용
```

---

## Redis Sentinel 구성

3개 이상의 Sentinel이 마스터를 감시합니다:

```
[App Server 1] → Sentinel 1
[App Server 2] → Sentinel 2     →  Master (6379)
[App Server 3] → Sentinel 3             ↓
                                  Slave 1 (6380)
                                  Slave 2 (6381)
```

```bash
# sentinel.conf
sentinel monitor mymaster 127.0.0.1 6379 2  # 과반수=2
sentinel down-after-milliseconds mymaster 5000   # 5초 응답 없으면 다운으로 판단
sentinel failover-timeout mymaster 10000
sentinel parallel-syncs mymaster 1
```

**Failover 과정:**
```
1. Sentinel들이 마스터 다운 감지
2. 과반수(quorum) 동의
3. Sentinel 중 하나가 리더로 선출
4. 가장 최신 슬레이브를 마스터로 승격
5. 나머지 슬레이브들이 새 마스터를 따름
6. 클라이언트에 새 마스터 주소 전달
```

---

## Python 클라이언트 (Sentinel 자동 연결)

```python
from redis.sentinel import Sentinel

sentinel = Sentinel([
    ("sentinel1.example.com", 26379),
    ("sentinel2.example.com", 26379),
    ("sentinel3.example.com", 26379),
], socket_timeout=0.5)

def get_master():
    return sentinel.master_for(
        "mymaster",
        socket_timeout=0.5,
        decode_responses=True
    )

def get_slave():
    return sentinel.slave_for(
        "mymaster",
        socket_timeout=0.5,
        decode_responses=True
    )

# 쓰기는 마스터
get_master().set("key", "value")

# 읽기는 슬레이브 (부하 분산)
get_slave().get("key")
```

---

## Redis Cluster 복제

Redis Cluster는 각 Primary 노드마다 Replica를 둡니다:

```
Primary-1 ←→ Replica-1  (슬롯 0~5460)
Primary-2 ←→ Replica-2  (슬롯 5461~10922)
Primary-3 ←→ Replica-3  (슬롯 10923~16383)
```

```bash
# 클러스터 생성 시 --cluster-replicas 1 옵션
redis-cli --cluster create \
  host1:7001 host2:7002 host3:7003 \
  host4:7004 host5:7005 host6:7006 \
  --cluster-replicas 1
```

```bash
# 클러스터 상태 확인
redis-cli cluster info
redis-cli cluster nodes
```

---

## 복제 지연 (Replication Lag)

마스터에 쓴 데이터가 슬레이브에 즉시 반영되지 않을 수 있습니다:

```python
# 쓰기 후 즉시 읽기 (Replication Lag 문제)
master.set("user:42", new_data)
slave.get("user:42")  # 구버전 데이터가 반환될 수 있음

# 해결: 쓰기 직후에는 마스터에서 읽기
def write_and_read(key, value):
    master.set(key, value)
    return master.get(key)  # 슬레이브 아닌 마스터에서

# 또는 WAIT 명령으로 복제 완료 대기 (성능 희생)
master.set("key", "value")
master.wait(numreplicas=1, timeout=1000)  # 1개 슬레이브에 복제 완료 대기
```

---

## Spring Data Redis Sentinel 설정

```yaml
# application.yml
spring:
  data:
    redis:
      sentinel:
        master: mymaster
        nodes:
          - sentinel1:26379
          - sentinel2:26379
          - sentinel3:26379
      password: your-password
```

```java
@Configuration
public class RedisConfig {
    @Bean
    public LettuceConnectionFactory redisConnectionFactory(
        RedisSentinelConfiguration sentinelConfig
    ) {
        // Lettuce가 자동으로 마스터/슬레이브 라우팅
        LettuceClientConfiguration clientConfig = LettuceClientConfiguration.builder()
            .readFrom(ReadFrom.REPLICA_PREFERRED)  // 읽기는 슬레이브 우선
            .build();
        return new LettuceConnectionFactory(sentinelConfig, clientConfig);
    }
}
```

---

## 핵심 요약

- 복제: 마스터 → 슬레이브 (최초 Full Sync, 이후 Partial Sync)
- **Redis Sentinel**: 자동 Failover, quorum 과반수 동의 필요
- **Redis Cluster**: 샤딩 + 복제 동시에 (Primary/Replica 쌍)
- Replication Lag: 쓰기 후 즉시 읽기 시 구버전 반환 가능
- 읽기 부하 분산: 슬레이브에서 읽기 (Lettuce `ReadFrom.REPLICA_PREFERRED`)
