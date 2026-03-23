---
title: "[Kafka] 12. 운영 & 모니터링 — Consumer Lag, 메트릭, CLI"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "operations", "monitoring", "consumer-lag", "metrics", "CLI"]
---

# 운영 & 모니터링 — Consumer Lag, 메트릭, CLI

## 핵심 모니터링 지표

### 클러스터 건강 지표

| 지표 | 정상 | 위험 | 설명 |
|------|------|------|------|
| `ActiveControllerCount` | 1 | 0 또는 2 | 컨트롤러 1개만 존재해야 함 |
| `UnderReplicatedPartitions` | 0 | > 0 | 복제 지연 파티션 수 |
| `OfflinePartitionsCount` | 0 | > 0 | 리더 없는 파티션 수 |
| `UnderMinIsrPartitionCount` | 0 | > 0 | min.insync.replicas 미달 파티션 |

### 브로커 처리량 지표

```
kafka.server:type=BrokerTopicMetrics

MessagesInPerSec       ← 초당 메시지 수신
BytesInPerSec          ← 초당 데이터 수신 (bytes)
BytesOutPerSec         ← 초당 데이터 전송 (bytes)
BytesRejectedPerSec    ← 초당 거부된 bytes (> 0이면 문제)
```

### 요청 지연 지표

```
kafka.network:type=RequestMetrics,name=TotalTimeMs,request=Produce
kafka.network:type=RequestMetrics,name=TotalTimeMs,request=FetchConsumer
kafka.network:type=RequestMetrics,name=TotalTimeMs,request=FetchFollower

중요 분위수: Mean, P95, P99, Max

P99 > 100ms → 브로커 과부하 또는 네트워크 문제
```

---

## Consumer Lag

### Consumer Lag이란?

```
Consumer Lag = Log End Offset - Consumer Current Offset

파티션 0: LEO=1000, Committed=950  → Lag=50
파티션 1: LEO=2000, Committed=2000 → Lag=0
파티션 2: LEO=1500, Committed=1200 → Lag=300

Total Lag = 50 + 0 + 300 = 350
```

### CLI로 확인

```bash
# Consumer Group 상태
kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe \
  --group order-processor

# 출력:
# GROUP           TOPIC     PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG   CONSUMER-ID                    HOST
# order-processor orders    0          1000            1050            50    consumer-1-uuid-...            /10.0.0.1
# order-processor orders    1          2000            2000            0     consumer-2-uuid-...            /10.0.0.2
# order-processor orders    2          800             1100            300   consumer-3-uuid-...            /10.0.0.3

# 모든 Consumer Group 목록
kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --list

# 특정 그룹 오프셋 리셋
kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group order-processor \
  --topic orders \
  --reset-offsets \
  --to-earliest \
  --execute
```

### Lag 임계값 설정

```
경고 (Warning):  Lag > 1,000       (처리 속도 모니터링 필요)
위험 (Critical): Lag > 10,000      (즉시 대응 필요)
장애:           Consumer = 0명     (소비자 다운)
```

---

## 주요 CLI 명령어

### 토픽 관리

```bash
# 토픽 생성
kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic orders \
  --partitions 6 \
  --replication-factor 3

# 토픽 목록
kafka-topics.sh --bootstrap-server localhost:9092 --list

# 토픽 상세 정보
kafka-topics.sh --bootstrap-server localhost:9092 \
  --describe --topic orders

# 파티션 수 변경 (늘리기만 가능)
kafka-topics.sh --bootstrap-server localhost:9092 \
  --alter --topic orders --partitions 12

# 토픽 삭제
kafka-topics.sh --bootstrap-server localhost:9092 \
  --delete --topic orders

# 토픽 설정 변경
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --entity-type topics --entity-name orders \
  --add-config retention.ms=86400000,max.message.bytes=10485760

# 토픽 설정 확인
kafka-configs.sh --bootstrap-server localhost:9092 \
  --describe --entity-type topics --entity-name orders
```

### 메시지 테스트

```bash
# Producer 콘솔
kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic orders \
  --property "parse.key=true" \
  --property "key.separator=:"

# Consumer 콘솔 (처음부터 읽기)
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic orders \
  --from-beginning \
  --property "print.key=true" \
  --property "key.separator=:" \
  --max-messages 100

# 특정 파티션/오프셋부터
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic orders \
  --partition 0 \
  --offset 100
```

### 오프셋 조회

```bash
# 파티션별 최신 오프셋
kafka-run-class.sh kafka.tools.GetOffsetShell \
  --bootstrap-server localhost:9092 \
  --topic orders \
  --time -1  # -1=latest, -2=earliest

# 출력:
# orders:0:1234
# orders:1:5678
# orders:2:9012
```

### 파티션 재할당

```bash
# 재할당 계획 생성
kafka-reassign-partitions.sh \
  --bootstrap-server localhost:9092 \
  --topics-to-move-json-file topics.json \
  --broker-list "1,2,3,4" \
  --generate

# 재할당 실행
kafka-reassign-partitions.sh \
  --bootstrap-server localhost:9092 \
  --reassignment-json-file reassignment.json \
  --execute \
  --throttle 50000000  # 50MB/s 대역폭 제한

# 재할당 상태 확인
kafka-reassign-partitions.sh \
  --bootstrap-server localhost:9092 \
  --reassignment-json-file reassignment.json \
  --verify
```

---

## Prometheus + Grafana 모니터링

### JMX Exporter 설정

```yaml
# jmx-kafka-exporter.yml
startDelaySeconds: 0
ssl: false
lowercaseOutputName: true

rules:
  # 브로커 메트릭
  - pattern: kafka.server<type=BrokerTopicMetrics, name=(.+)><>OneMinuteRate
    name: kafka_server_brokertopicmetrics_$1_rate
    labels:
      topic: "$2"

  # Consumer Lag
  - pattern: kafka.consumer<type=consumer-fetch-manager-metrics, client-id=(.+)><>records-lag-max
    name: kafka_consumer_records_lag_max
    labels:
      client_id: "$1"
```

### 핵심 Grafana 대시보드 패널

```
1. 처리량 패널
   rate(kafka_server_brokertopicmetrics_messagesinpersec_rate[5m])

2. Consumer Lag 패널
   kafka_consumer_group_lag{group="order-processor"}

3. Under-Replicated Partitions
   kafka_server_replicamanager_underreplicatedpartitions

4. Request Latency P99
   histogram_quantile(0.99,
     rate(kafka_network_requestmetrics_totaltimems_bucket[5m]))
```

### Kafka UI (오픈소스)

```yaml
# docker-compose.yml
kafka-ui:
  image: provectuslabs/kafka-ui:latest
  ports:
    - "8080:8080"
  environment:
    KAFKA_CLUSTERS_0_NAME: local
    KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
    KAFKA_CLUSTERS_0_SCHEMAREGISTRY: http://schema-registry:8081
```

---

## 운영 작업

### 브로커 롤링 재시작

```bash
# 한 번에 하나씩 재시작 (가용성 유지)
# 재시작 전: UnderReplicatedPartitions = 0 확인

# 1. 브로커 1 재시작
systemctl restart kafka
# UnderReplicatedPartitions → 0이 될 때까지 대기

# 2. 브로커 2 재시작
# ...
```

### 브로커 추가

```bash
# 1. 새 브로커 시작
# 2. 기존 파티션 일부를 새 브로커로 이동 (재할당)
# 3. 리더 재균형

kafka-leader-election.sh \
  --bootstrap-server localhost:9092 \
  --election-type preferred \
  --all-topic-partitions
```

### 비정상 메시지 처리

```bash
# Dead Letter Queue 등에서 메시지 직접 확인
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic orders.DLQ \
  --from-beginning \
  --property print.timestamp=true \
  --property print.key=true
```

---

## 정리

- **핵심 지표**: `UnderReplicatedPartitions`(0), `ActiveControllerCount`(1), Consumer Lag(0에 가까울수록 좋음)
- **Consumer Lag**: `kafka-consumer-groups.sh --describe`로 실시간 확인
- **오프셋 리셋**: `--reset-offsets --to-earliest/latest/datetime/offset`
- **Prometheus+Grafana**: JMX Exporter로 메트릭 수집, 알림 설정 필수
- **롤링 재시작**: 한 번에 하나씩, UnderReplicatedPartitions=0 확인 후 다음 브로커
