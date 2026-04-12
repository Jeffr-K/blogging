---
title: "[Kafka] 11. 성능 튜닝 — 프로듀서/소비자/브로커 최적화"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "performance", "tuning", "처리량", "지연", "최적화"]
---

# 성능 튜닝 — 프로듀서/소비자/브로커 최적화

## 성능 목표 설정

튜닝 전 목표를 명확히 정의:

| 목표 | 관련 설정 | 트레이드오프 |
|------|-----------|-------------|
| **처리량 최대화** | 배치 크기, 압축, 파티션 수 | 지연 증가 |
| **지연 최소화** | linger.ms=0, acks=1 | 처리량 감소, 신뢰성 저하 |
| **신뢰성 최대화** | acks=all, 멱등성, ISR | 지연 증가, 처리량 감소 |

---

## 프로듀서 튜닝

### 처리량 중심

```properties
# 배치 설정
batch.size=65536               # 64KB (기본 16KB에서 증가)
linger.ms=20                   # 20ms 대기 (배치 채울 시간)
buffer.memory=134217728        # 128MB 버퍼

# 압축 (lz4 권장 — 낮은 CPU, 좋은 압축률)
compression.type=lz4

# 동시 전송
max.in.flight.requests.per.connection=5  # 기본값 유지
```

### 지연 중심

```properties
linger.ms=0          # 즉시 전송
batch.size=1         # 배치 없음 (극단적)
acks=1               # 리더 확인만
compression.type=none
```

### 신뢰성 중심

```properties
acks=all
enable.idempotence=true
retries=2147483647              # MAX_VALUE
delivery.timeout.ms=300000     # 5분
max.in.flight.requests.per.connection=5  # 멱등성이면 5까지 OK
min.insync.replicas=2           # 브로커 설정과 맞출 것
```

### 프로듀서 성능 지표

```bash
# 프로듀서 성능 테스트
kafka-producer-perf-test.sh \
  --topic benchmark \
  --num-records 1000000 \
  --record-size 1024 \
  --throughput -1 \
  --producer-props bootstrap.servers=localhost:9092 batch.size=65536 linger.ms=5

# 출력:
# 1000000 records sent, 150000.00 records/sec (146.48 MB/sec),
# 5.23 ms avg latency, 89.00 ms max latency
```

---

## 소비자 튜닝

### 처리량 중심

```properties
# Fetch 설정
fetch.min.bytes=1048576        # 1MB 모일 때까지 대기
fetch.max.wait.ms=500          # 최대 500ms 대기
max.partition.fetch.bytes=10485760  # 파티션당 10MB

# 폴 설정
max.poll.records=2000          # 한 번에 2000개 처리
```

### 처리 병렬화

```kotlin
// 파티션 수만큼 소비자 인스턴스 실행
// 각 인스턴스가 독립적으로 poll() 루프

// 또는 멀티스레드 처리
val executor = Executors.newFixedThreadPool(8)

while (true) {
    val records = consumer.poll(Duration.ofMillis(100))

    val futures = records.map { record ->
        CompletableFuture.runAsync(
            { processRecord(record) },
            executor
        )
    }

    CompletableFuture.allOf(*futures.toTypedArray()).join()
    consumer.commitSync()
}
```

### 소비자 성능 지표

```bash
# 소비자 성능 테스트
kafka-consumer-perf-test.sh \
  --bootstrap-server localhost:9092 \
  --topic benchmark \
  --messages 1000000 \
  --group perf-test

# 출력:
# start.time, end.time, data.consumed.in.MB, MB.sec, data.consumed.in.nMsg, nMsg.sec
```

---

## 브로커 튜닝

### 시스템 수준

```bash
# 파일 디스크립터 제한 증가
echo "kafka    hard    nofile    100000" >> /etc/security/limits.conf
echo "kafka    soft    nofile    100000" >> /etc/security/limits.conf

# 소켓 버퍼
sysctl -w net.core.wmem_max=16777216
sysctl -w net.core.rmem_max=16777216
sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216"
sysctl -w net.ipv4.tcp_rmem="4096 65536 16777216"

# 가상 메모리 설정
sysctl -w vm.swappiness=1          # 스왑 최소화
sysctl -w vm.dirty_ratio=80        # OS 페이지 캐시 활용
sysctl -w vm.dirty_background_ratio=5
```

### JVM 설정

```bash
# kafka-server-start.sh
export KAFKA_HEAP_OPTS="-Xmx6g -Xms6g"
export KAFKA_JVM_PERFORMANCE_OPTS="-server \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=20 \
  -XX:InitiatingHeapOccupancyPercent=35 \
  -XX:+ExplicitGCInvokesConcurrent \
  -Djava.awt.headless=true"
```

주의: Kafka는 OS 페이지 캐시에 크게 의존 → JVM 힙을 너무 크게 설정하면 역효과.
권장: 총 RAM의 50% 이하로 힙 설정, 나머지는 OS 캐시용.

### 브로커 핵심 설정

```properties
# 네트워크
num.network.threads=8          # 네트워크 스레드 (CPU 코어 수)
num.io.threads=16              # I/O 스레드 (디스크 수 × 2)
socket.send.buffer.bytes=102400
socket.receive.buffer.bytes=102400
socket.request.max.bytes=104857600  # 최대 요청 크기 100MB

# 로그
log.dirs=/data1/kafka,/data2/kafka  # 여러 디스크
num.recovery.threads.per.data.dir=4  # 복구 스레드

# 복제
num.replica.fetchers=4         # 팔로워가 리더에서 복제하는 스레드 수
replica.fetch.max.bytes=10485760  # 복제 배치 크기

# 배치
message.max.bytes=10485760     # 최대 메시지 크기 (10MB)
```

---

## 파티션 수 튜닝

### 처리량 계산

```
목표 처리량: 500MB/s
단일 파티션 처리량: ~50MB/s (일반적)

필요 파티션 수 ≈ 500 / 50 = 10개

안전 마진 포함: 20~30개 권장
```

### 파티션 수와 소비자 수 관계

```
파티션 수 = 최대 소비자 병렬성

파티션 6개, 소비자 6개 → 최대 병렬
파티션 6개, 소비자 8개 → 2개 소비자 대기 상태
```

### 파티션 수 늘리기

```bash
kafka-topics.sh --bootstrap-server localhost:9092 \
  --alter --topic orders \
  --partitions 12

주의:
  - 파티션 수는 늘릴 수만 있고 줄일 수 없음
  - 파티션 추가 시 기존 키 기반 파티셔닝 변경됨
  - 순서 보장이 필요하면 주의
```

---

## 주요 성능 지표

### 브로커 지표 (JMX)

```
kafka.server:type=BrokerTopicMetrics,name=MessagesInPerSec
kafka.server:type=BrokerTopicMetrics,name=BytesInPerSec
kafka.server:type=BrokerTopicMetrics,name=BytesOutPerSec
kafka.network:type=RequestMetrics,name=TotalTimeMs,request=Produce
kafka.network:type=RequestMetrics,name=TotalTimeMs,request=FetchConsumer
kafka.server:type=ReplicaManager,name=UnderReplicatedPartitions  ← 0이어야 정상
kafka.controller:type=KafkaController,name=ActiveControllerCount ← 1이어야 정상
```

### 소비자 그룹 지표

```bash
# Consumer Lag 모니터링
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group order-processor
```

```
Alert 조건:
  UnderReplicatedPartitions > 0 → 복제 지연
  ActiveControllerCount != 1   → 컨트롤러 문제
  Consumer Lag 급증             → 처리 속도 저하
  Request latency P99 > 100ms  → 브로커 부하
```

---

## 처리량 vs 지연 트레이드오프 정리

```
처리량 ↑                지연 ↓
─────────────────────────────────────────────────────
linger.ms 증가          linger.ms=0
batch.size 증가         batch.size 감소
압축 사용               압축 없음
acks=1 또는 0           acks=1 또는 0 (같음)
파티션 수 증가          파티션 수 최소화
fetch.min.bytes 증가    fetch.min.bytes=1
```

---

## 정리

- **처리량**: 배치 크기↑, linger.ms↑, lz4 압축, 파티션 수↑
- **지연**: linger.ms=0, 압축 없음, 소수 파티션
- **JVM**: G1GC, 힙은 총 RAM의 50% 이하 (OS 캐시 확보)
- **시스템**: 파일 디스크립터, 소켓 버퍼, swappiness=1
- **모니터링**: UnderReplicatedPartitions, Consumer Lag, Request Latency P99
