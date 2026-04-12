# Apache Kafka 완전 학습 인덱스

---

## 1. Kafka란 무엇인가

### 핵심 개념
- 분산 이벤트 스트리밍 플랫폼
- 메시지 큐 vs Pub/Sub vs 이벤트 스트리밍 차이
- Kafka가 해결하는 문제 — 시스템 간 결합도, 데이터 파이프라인
- 전통적인 메시지 브로커(RabbitMQ, ActiveMQ)와의 차이
- 로그 기반 저장 구조 (append-only log)
- pull 방식 소비 — 소비자가 직접 가져감

### 주요 사용 사례
- 실시간 데이터 파이프라인 (ETL 대체)
- 마이크로서비스 간 이벤트 기반 통신
- 이벤트 소싱 (Event Sourcing)
- 로그 집계 / 모니터링
- 스트림 처리 (실시간 분석)
- CDC (Change Data Capture) — DB 변경 이벤트 스트리밍

---

## 2. 핵심 아키텍처 — Broker, Topic, Partition

### Broker
- Kafka 브로커 — 메시지를 저장하고 제공하는 서버
- 브로커 클러스터 — 여러 브로커로 구성
- Controller 브로커 — 클러스터 메타데이터 관리 (KRaft 이전: ZooKeeper 의존)
- 리더 / 팔로워 브로커

### Topic
- Topic — 메시지를 분류하는 논리적 채널
- Topic 이름 규칙 및 설계 전략
- `auto.create.topics.enable` 설정

### Partition
- 파티션 — Topic의 물리적 분할 단위
- 파티션 수 결정 기준 (처리량, 소비자 수)
- 파티션 내 메시지 순서 보장 — 오프셋(Offset)
- 파티션 간 순서 보장 없음
- 파티션 키 (Partition Key) — 같은 키는 같은 파티션
- 파티션 증가 가능, 감소 불가

### Offset
- 오프셋 — 파티션 내 메시지 위치 (단조 증가 정수)
- Consumer Offset — 소비자가 읽은 위치
- `__consumer_offsets` 토픽 — 오프셋 저장소

---

## 3. Producer

### 기본 동작
- `ProducerRecord` — key, value, topic, partition, timestamp, headers
- 직렬화 (Serializer) — `StringSerializer`, `ByteArraySerializer`, Custom
- 파티셔닝 전략
  - 키 있음: `hash(key) % numPartitions` — 같은 키는 같은 파티션
  - 키 없음: 라운드 로빈 (Kafka 2.4+: Sticky Partitioner)
  - 커스텀 Partitioner 구현

### 배치 & 버퍼
- `batch.size` — 배치 최대 크기 (bytes)
- `linger.ms` — 배치 대기 시간 (0 = 즉시 전송)
- `buffer.memory` — 전체 프로듀서 버퍼 크기
- `max.block.ms` — 버퍼 가득 찼을 때 대기 시간

### 전송 보장 — acks
- `acks=0` — 응답 없이 전송 (최저 지연, 유실 위험)
- `acks=1` — 리더만 확인 (기본값, 리더 장애 시 유실 가능)
- `acks=all` (또는 `-1`) — 모든 ISR 확인 (가장 안전)
- `min.insync.replicas` — acks=all 시 최소 동기화 복제본 수

### 재시도 & 멱등성
- `retries` — 재시도 횟수
- `retry.backoff.ms` — 재시도 간격
- `enable.idempotence=true` — 중복 전송 방지 (정확히 한 번 전송)
- `max.in.flight.requests.per.connection` — 미확인 요청 최대 수

### 트랜잭션 프로듀서
- `transactional.id` 설정
- `initTransactions()` → `beginTransaction()` → `send()` → `commitTransaction()` / `abortTransaction()`
- 정확히 한 번 의미론(Exactly-once semantics)

### 압축
- `compression.type` — `none`, `gzip`, `snappy`, `lz4`, `zstd`
- 압축 단위: 배치

---

## 4. Consumer

### 기본 동작
- `poll()` — 메시지 가져오기 (pull 방식)
- `ConsumerRecord` — key, value, topic, partition, offset, timestamp, headers
- 역직렬화 (Deserializer)
- `max.poll.records` — 한 번 poll에서 가져올 최대 레코드 수

### Consumer Group
- 컨슈머 그룹 — 같은 `group.id`를 공유하는 소비자 집합
- 파티션:소비자 = N:1 (한 파티션은 그룹 내 한 소비자만)
- 소비자 수 > 파티션 수 → 일부 소비자 유휴 상태
- 그룹 간 독립적 소비 — 같은 토픽을 여러 그룹이 독립적으로 읽기 가능

### Rebalancing
- 리밸런싱 — 파티션 재할당 (소비자 추가/제거, 파티션 변경 시)
- Eager Rebalancing — 전체 파티션 반납 후 재할당 (짧은 중단 발생)
- Cooperative (Incremental) Rebalancing — 필요한 파티션만 이동 (Kafka 2.4+)
- `partition.assignment.strategy` — `RangeAssignor`, `RoundRobinAssignor`, `StickyAssignor`, `CooperativeStickyAssignor`
- `heartbeat.interval.ms` / `session.timeout.ms` — 소비자 생존 확인
- `max.poll.interval.ms` — poll 호출 최대 간격 (초과 시 그룹 이탈)

### 오프셋 관리
- 자동 커밋 — `enable.auto.commit=true`, `auto.commit.interval.ms`
- 수동 커밋 — `commitSync()`, `commitAsync()`
- 특정 오프셋부터 읽기 — `seek()`, `seekToBeginning()`, `seekToEnd()`
- `auto.offset.reset` — `earliest`, `latest`, `none`

### 소비 의미론
- At-most-once — 처리 전 커밋 (유실 가능)
- At-least-once — 처리 후 커밋 (중복 가능, 일반적)
- Exactly-once — 트랜잭션 활용

---

## 5. Replication & 장애 복구

### 복제 구조
- `replication.factor` — 파티션 복제 수
- ISR (In-Sync Replicas) — 리더와 동기화된 복제본 집합
- OSR (Out-of-Sync Replicas) — 뒤처진 복제본
- `replica.lag.time.max.ms` — ISR 이탈 기준 시간

### 리더 선출
- 리더 장애 시 ISR 중 하나가 리더로 선출
- `unclean.leader.election.enable` — ISR 없을 때 OSR 리더 허용 여부 (데이터 유실 위험)
- Preferred Leader — 원래 리더로 복구

### 장애 시나리오
- 브로커 장애 → 리더 재선출, 클라이언트 재연결
- 네트워크 파티션 → ISR 이탈, split-brain 방지
- 전체 클러스터 재시작 → `unclean.leader.election` 설정에 따라

---

## 6. ZooKeeper vs KRaft

### ZooKeeper 기반 (구 아키텍처)
- ZooKeeper — 브로커 메타데이터, 컨트롤러 선출, 설정 관리
- 단점: ZooKeeper 별도 운영, 스케일 한계, 메타데이터 불일치 가능

### KRaft (Kafka Raft, Kafka 3.3+ 안정화)
- ZooKeeper 제거 — Kafka 자체 Raft 합의 프로토콜
- Controller Quorum — 홀수 개 컨트롤러 노드 (3 또는 5)
- 메타데이터를 `__cluster_metadata` 토픽에 저장
- 장점: 단순한 운영, 빠른 컨트롤러 장애 복구, 더 많은 파티션 지원
- Kafka 3.5+ — KRaft 기본, ZooKeeper deprecated
- Kafka 4.0 — ZooKeeper 완전 제거

---

## 7. 저장 & 보존 정책

### 로그 세그먼트
- 파티션 = 여러 세그먼트 파일로 구성
- `.log` — 실제 메시지 / `.index` — 오프셋 인덱스 / `.timeindex` — 타임스탬프 인덱스
- `log.segment.bytes` — 세그먼트 최대 크기
- `log.roll.ms` — 세그먼트 롤링 주기

### 보존 정책
- `log.retention.bytes` — 파티션 최대 크기
- `log.retention.ms` / `log.retention.hours` — 보존 기간
- `log.cleanup.policy=delete` — 만료 세그먼트 삭제 (기본)
- `log.cleanup.policy=compact` — 키별 최신 값만 유지 (Log Compaction)
- `log.cleanup.policy=delete,compact` — 혼합

### Log Compaction
- 동일 키의 이전 값 제거 — 최신 값만 유지
- 컴팩션 후에도 토픽 전체 읽기 가능
- `null` 값 메시지 = tombstone (삭제 마커)
- 활용: CDC, 상태 저장소 복구

---

## 8. Kafka Streams

### 개요
- Kafka Streams — Kafka 내장 스트림 처리 라이브러리 (별도 클러스터 불필요)
- 의존성: `kafka-streams`

### 핵심 개념
- `StreamsBuilder` — 토폴로지 빌더
- `KStream` — 이벤트 스트림 (각 레코드가 독립적)
- `KTable` — 상태 테이블 (최신값 유지, 변경 로그)
- `GlobalKTable` — 전체 파티션을 로컬에 복제
- `KStream` → `KTable` 변환 — `toTable()`
- `KTable` → `KStream` 변환 — `toStream()`

### 주요 연산
- Stateless: `map`, `filter`, `flatMap`, `mapValues`, `foreach`, `branch`
- Stateful: `groupByKey`, `count`, `reduce`, `aggregate`
- Windowing: `TimeWindows`, `SessionWindows`, `SlidingWindows`
- Join: `KStream-KStream`, `KStream-KTable`, `KTable-KTable`

### 상태 저장소 (State Store)
- RocksDB — 기본 로컬 상태 저장소
- In-memory store
- 변경 로그 토픽 (`-changelog`) — 상태 복구에 사용
- Interactive Queries — 외부에서 상태 조회

### 처리 보장
- At-least-once (기본)
- Exactly-once — `processing.guarantee=exactly_once_v2`

---

## 9. Kafka Connect

### 개요
- Kafka Connect — 외부 시스템 ↔ Kafka 데이터 파이프라인
- 코드 없이 커넥터 설정만으로 연동

### 구성
- Source Connector — 외부 → Kafka
- Sink Connector — Kafka → 외부
- Worker — 커넥터를 실행하는 Kafka Connect 프로세스
- Standalone / Distributed 모드

### 주요 커넥터
- JDBC Source/Sink — DB ↔ Kafka
- Debezium — CDC (MySQL, PostgreSQL, MongoDB)
- Elasticsearch Sink
- S3 Sink / Source
- HTTP Sink
- MongoDB Source/Sink

### Converter & Transformation
- Converter — 데이터 형식 변환 (JSON, Avro, Protobuf)
- Single Message Transforms (SMT) — 메시지 변환, 필터링, 라우팅

---

## 10. Schema Registry

### 개요
- Schema Registry — Avro/Protobuf/JSON Schema 중앙 관리
- 스키마 호환성 검사 — 프로듀서/소비자 간 계약
- `schema.registry.url` 설정

### Avro 직렬화
- `KafkaAvroSerializer` / `KafkaAvroDeserializer`
- 메시지에 스키마 ID 포함 (5 bytes 헤더)
- GenericRecord vs SpecificRecord

### 호환성 정책
- `BACKWARD` — 새 스키마로 이전 메시지 읽기 가능 (기본)
- `FORWARD` — 이전 스키마로 새 메시지 읽기 가능
- `FULL` — 양방향 호환
- `NONE` — 호환성 검사 없음

---

## 11. 성능 & 튜닝

### 프로듀서 튜닝
- `batch.size` + `linger.ms` — 배치 최적화
- `compression.type=lz4` 또는 `zstd` — 처리량 향상
- `buffer.memory` — 메모리 충분히
- `acks=1` vs `acks=all` — 내구성 vs 성능 트레이드오프

### 소비자 튜닝
- `fetch.min.bytes` / `fetch.max.wait.ms` — 배치 가져오기
- `max.poll.records` — 한 번에 처리할 레코드 수
- 파티션 수 = 소비자 수 — 병렬 처리 극대화
- `CooperativeStickyAssignor` — 리밸런싱 중단 최소화

### 브로커 튜닝
- `num.io.threads`, `num.network.threads` — I/O 스레드 수
- `log.flush.interval.messages` / `log.flush.interval.ms` — 디스크 플러시 주기
- OS 페이지 캐시 활용 — 디스크 직접 읽기 최소화
- `socket.send.buffer.bytes` / `socket.receive.buffer.bytes`

### 파티션 수 설계
- 처리량 목표 / 브로커당 처리량 = 최소 파티션 수
- 소비자 그룹의 최대 병렬도 = 파티션 수
- 너무 많은 파티션 → 리더 선출 오래 걸림, 파일 핸들 증가
- 권장: 브로커당 2,000~4,000 파티션 이하

---

## 12. 운영 & 모니터링

### 핵심 메트릭
- **프로듀서**: `record-send-rate`, `record-error-rate`, `request-latency-avg`, `batch-size-avg`
- **소비자**: `records-lag` (파티션별 지연), `records-consumed-rate`, `fetch-latency-avg`
- **브로커**: `UnderReplicatedPartitions`, `ActiveControllerCount`, `OfflinePartitionsCount`, `RequestHandlerAvgIdlePercent`, `NetworkProcessorAvgIdlePercent`
- **JVM**: GC 시간, 힙 사용량

### Consumer Lag 관리
- Consumer Lag = 최신 오프셋 - 소비자 오프셋
- `kafka-consumer-groups.sh --describe` 로 확인
- 래그 증가 원인: 소비 속도 저하, 파티션 증가, 리밸런싱
- 대응: 소비자 수 증가, 처리 로직 최적화

### 주요 운영 명령
```bash
# 토픽 생성
kafka-topics.sh --create --topic my-topic --partitions 6 --replication-factor 3

# 토픽 목록 / 상세
kafka-topics.sh --list
kafka-topics.sh --describe --topic my-topic

# 컨슈머 그룹 오프셋
kafka-consumer-groups.sh --describe --group my-group

# 오프셋 리셋
kafka-consumer-groups.sh --reset-offsets --to-earliest --topic my-topic --group my-group --execute

# 메시지 확인
kafka-console-consumer.sh --topic my-topic --from-beginning
kafka-console-producer.sh --topic my-topic
```

### 모니터링 도구
- JMX + Prometheus JMX Exporter + Grafana
- Confluent Control Center
- AKHQ (Kafka HQ) — 오픈소스 UI
- Kafka UI (Provectus)
- Burrow — Consumer Lag 전용 모니터링

---

## 13. 보안

### 인증 (Authentication)
- SSL/TLS — 클라이언트-브로커 암호화 + 인증
- SASL/PLAIN — username/password
- SASL/SCRAM — 해시 기반 패스워드
- SASL/GSSAPI (Kerberos) — 기업 환경
- SASL/OAUTHBEARER — OAuth 2.0 토큰

### 인가 (Authorization)
- ACL (Access Control List) — 토픽/그룹별 읽기/쓰기/생성 권한
- `kafka-acls.sh` 로 관리
- `super.users` — 슈퍼유저 설정

### 암호화
- `security.inter.broker.protocol=SSL` — 브로커 간 암호화
- `ssl.keystore.location`, `ssl.truststore.location`

---

## 14. 고급 패턴

### 이벤트 소싱 (Event Sourcing)
- 상태 변경을 이벤트로 저장
- Kafka 토픽 = 이벤트 로그
- 컴팩션 토픽 = 현재 상태 스냅샷

### CQRS + Kafka
- Command → Kafka → Event → Read Model 업데이트
- 쓰기/읽기 모델 분리

### Saga 패턴
- 분산 트랜잭션을 이벤트 체인으로
- Choreography Saga — 서비스 간 직접 이벤트 교환
- Orchestration Saga — 중앙 오케스트레이터

### Outbox 패턴
- DB 트랜잭션 + Kafka 전송 원자성 보장
- DB에 outbox 테이블 저장 → Debezium CDC → Kafka

### Dead Letter Queue (DLQ)
- 처리 실패 메시지를 별도 토픽으로 격리
- 재처리 / 알림 / 모니터링

### Request-Reply 패턴
- Kafka 위에서 동기식 요청-응답
- 응답 토픽 + Correlation ID
- `reply.topic` 헤더 활용

---

## 15. Kafka vs 유사 기술

| | Kafka | RabbitMQ | AWS SQS/SNS | Pulsar |
|--|-------|----------|------------|--------|
| 모델 | Pull / 로그 기반 | Push / 큐 기반 | Push / 큐 기반 | Pull / 로그 기반 |
| 보존 | 설정 기간 유지 | 소비 후 삭제 | 소비 후 삭제 | 설정 기간 유지 |
| 처리량 | 매우 높음 | 중간 | 중간 | 높음 |
| 순서 보장 | 파티션 내 | 큐 단위 | FIFO 큐 | 토픽 단위 |
| 재소비 | 오프셋으로 가능 | 기본 불가 | 불가 | 커서로 가능 |
| 스트림 처리 | Kafka Streams | 없음 | 없음 | Pulsar Functions |

---

## 학습 순서 권장

```
1단계 — 핵심 개념
  Kafka란 → 아키텍처 (Broker/Topic/Partition) → Producer → Consumer

2단계 — 신뢰성
  Replication → ZooKeeper vs KRaft → 저장/보존 정책

3단계 — 처리 보장
  acks/retries/idempotence → Consumer Offset 관리 → Exactly-once

4단계 — 생태계
  Kafka Streams → Kafka Connect → Schema Registry

5단계 — 실무
  성능 튜닝 → 운영/모니터링 → 보안 → 고급 패턴
```
