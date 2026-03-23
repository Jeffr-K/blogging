# RabbitMQ 완전 학습 인덱스

---

## 1. RabbitMQ란 무엇인가

### 핵심 개념
- AMQP (Advanced Message Queuing Protocol) 구현체
- 메시지 브로커 — 생산자와 소비자 사이의 중간 계층
- Push 기반 메시지 전달 — 브로커가 소비자에게 전달
- 메시지 큐 vs Kafka 이벤트 스트리밍의 차이
  - RabbitMQ: 처리 후 삭제, 라우팅 중심, 작업 분배에 적합
  - Kafka: 로그 보존, 재소비 가능, 대용량 스트리밍에 적합

### 주요 사용 사례
- 작업 큐 (Task Queue) — 백그라운드 작업 분산 처리
- RPC (Remote Procedure Call) — 응답이 필요한 요청
- 마이크로서비스 간 비동기 통신
- 이벤트 알림 (Notification)
- 이메일/SMS 발송 큐
- 분산 시스템의 로드 레벨링

### AMQP 프로토콜
- AMQP 0-9-1 — RabbitMQ 기본 프로토콜
- MQTT, STOMP, HTTP 플러그인으로 멀티 프로토콜 지원
- 채널(Channel) — 단일 TCP 연결 위의 가상 연결 (멀티플렉싱)

---

## 2. 핵심 아키텍처 — Exchange, Queue, Binding

### Producer → Exchange → Queue → Consumer 흐름
- Producer가 Exchange에 메시지 발행
- Exchange가 Binding 규칙에 따라 Queue로 라우팅
- Consumer가 Queue에서 메시지 수신

### Exchange
- 메시지를 받아 적절한 Queue로 라우팅하는 라우터
- Exchange 속성: name, type, durable, auto-delete, internal, arguments
- 기본 Exchange (`""`) — 라우팅 키 = 큐 이름으로 직접 전달

#### Exchange 타입
- **Direct** — 라우팅 키 정확히 일치하는 큐로 전달
- **Fanout** — 바인딩된 모든 큐에 브로드캐스트 (라우팅 키 무시)
- **Topic** — 패턴 매칭 (`*` = 단어 하나, `#` = 0개 이상 단어)
- **Headers** — 메시지 헤더 기반 라우팅 (라우팅 키 무시)
- **Default (nameless)** — 라우팅 키 = 큐 이름
- **Dead Letter Exchange (DLX)** — 처리 실패 메시지 재라우팅

### Queue
- 메시지가 실제로 저장되는 버퍼
- 속성: name, durable, exclusive, auto-delete, arguments
- `durable=true` — 브로커 재시작 후에도 큐 유지
- `exclusive=true` — 선언한 연결에서만 사용, 연결 종료 시 삭제
- `auto-delete=true` — 마지막 소비자 해제 시 자동 삭제

#### Queue 타입 (Quorum / Classic / Stream)
- **Classic Queue** — 기본 큐, 단일 노드 또는 미러링
- **Quorum Queue** — Raft 기반 복제, 고가용성 권장 (3.8+)
- **Stream Queue** — Kafka처럼 로그 기반, 재소비 가능 (3.9+)

### Binding
- Exchange와 Queue를 연결하는 규칙
- Binding Key — Direct/Topic Exchange에서 라우팅 기준

### Virtual Host (vhost)
- 논리적 격리 단위 — 큐, Exchange, Binding을 그룹화
- 멀티테넌시 구현
- 기본 vhost: `/`

---

## 3. 메시지

### 메시지 구조
- Body — 실제 데이터 (byte array)
- Properties — 메타데이터
  - `content_type`, `content_encoding`
  - `delivery_mode` — 1: 비영속, 2: 영속 (디스크 저장)
  - `priority` — 우선순위 (0~9)
  - `correlation_id` — RPC 패턴에서 요청-응답 매핑
  - `reply_to` — 응답 큐 이름
  - `expiration` — 메시지 TTL (ms)
  - `message_id`, `timestamp`, `type`, `app_id`
- Headers — 커스텀 헤더 (Headers Exchange에서 사용)

### 메시지 영속성
- `delivery_mode=2` + `durable=true` 큐 — 브로커 재시작 후 복구
- 성능 vs 내구성 트레이드오프
- Lazy Queue — 메시지를 즉시 디스크에 저장 (메모리 절약)

### 메시지 우선순위
- `x-max-priority` 큐 인자로 우선순위 큐 활성화
- 우선순위 높은 메시지 먼저 전달
- 0~255 범위 (권장: 0~9)

### TTL (Time To Live)
- 메시지 TTL — `expiration` 속성 또는 큐 단위 `x-message-ttl`
- 큐 TTL — `x-expires` (큐 미사용 시 자동 삭제)
- TTL 초과 메시지 → DLX로 라우팅 가능

---

## 4. Consumer

### 구독 방식
- `basicConsume` (Push) — 브로커가 메시지 밀어줌 (권장)
- `basicGet` (Pull) — 소비자가 직접 요청 (비권장, 폴링)

### Acknowledgement (ACK)
- `basicAck` — 처리 완료, 큐에서 삭제
- `basicNack` — 처리 실패, requeue 여부 선택
  - `requeue=true` — 큐 앞으로 돌려보냄
  - `requeue=false` — 큐에서 제거 (DLX 설정 시 DLQ로 이동)
- `basicReject` — nack과 동일 (단일 메시지, 구식)
- `auto-ack=true` — 전달 즉시 ACK (처리 실패 시 유실)

### Prefetch (QoS)
- `basicQos(prefetchCount)` — 미확인 메시지 최대 수 제한
- `prefetchCount=1` — 한 번에 하나만 처리 (공정한 분배)
- `prefetchCount=0` — 무제한 (기본, 소비자 과부하 위험)
- 채널 단위 vs 소비자 단위 설정

### Consumer 취소
- `basicCancel` — 구독 취소
- Consumer Cancel Notification — 큐 삭제/HA 장애 시 알림

---

## 5. 메시지 신뢰성

### Publisher Confirms
- 브로커가 메시지 수신 확인 (`basic.ack` / `basic.nack`)
- 동기 방식 — `waitForConfirms()` (느리지만 단순)
- 비동기 방식 — `addConfirmListener()` (높은 처리량)
- 배치 확인 — `waitForConfirmsOrDie()` (배치 단위)

### Transactions (AMQP 트랜잭션)
- `txSelect()` → `txCommit()` / `txRollback()`
- Publisher Confirms보다 250배 느림 — 실무에서 비권장
- 원자적 발행이 필요한 특수 경우에만 사용

### Dead Letter Exchange (DLX)
- 메시지가 다음 조건 시 DLX로 라우팅:
  - `basicNack`/`basicReject` with `requeue=false`
  - TTL 초과
  - 큐 길이 초과 (`x-max-length`)
- `x-dead-letter-exchange` — DLX 지정
- `x-dead-letter-routing-key` — DLX로 보낼 라우팅 키 오버라이드
- Dead Letter Queue (DLQ) — 재처리/알림/분석에 활용

### 재시도 패턴
- DLX + TTL을 활용한 지연 재시도 (Delayed Retry)
- `rabbitmq-delayed-message-exchange` 플러그인
- 재시도 횟수 헤더(`x-retry-count`) 추적
- 최대 재시도 초과 시 영구 실패 큐로 이동

---

## 6. High Availability & 클러스터링

### Classic Queue HA (구 방식)
- Mirrored Queue — 여러 노드에 큐 복제
- `ha-mode`: all / exactly / nodes
- 마스터 노드 장애 시 미러 중 하나가 승격
- Kafka 3.8 이후 deprecated — Quorum Queue 권장

### Quorum Queue (권장)
- Raft 합의 알고리즘 기반 복제
- 과반 노드 정상 시 동작 (3노드 클러스터 → 1개 장애 허용)
- 데이터 일관성 보장 — "at least once" 전달 보장
- `x-queue-type: quorum` 선언
- Leader Election — 자동 리더 선출

### 클러스터 구성
- 동일 Erlang 쿠키 — 클러스터 인증
- `rabbitmqctl join_cluster` — 노드 추가
- Disk Node vs RAM Node
  - Disk Node — 메타데이터 디스크 저장 (최소 1개 필수)
  - RAM Node — 메타데이터 메모리만 (더 빠르지만 재시작 시 복구 필요)
- 네트워크 파티션 처리 — `cluster_partition_handling`
  - `ignore` / `pause_minority` / `autoheal`

### Federation & Shovel
- Federation — WAN 환경에서 Exchange/Queue를 원격 브로커와 연결
- Shovel — 큐 간 메시지 이동 (클러스터 간, 버전 간 마이그레이션)

---

## 7. Stream Queue (3.9+)

### 개요
- Kafka와 유사한 로그 기반 저장 구조
- 메시지 소비 후에도 보존 (오프셋 기반 재소비)
- 여러 소비자 그룹이 독립적으로 소비
- `x-queue-type: stream` 선언

### 특징
- 오프셋 기반 소비 — `x-stream-offset` 지정
- 시간 기반 오프셋 — `timestamp`, `first`, `last`, `next`
- 고처리량 — 배치 발행, 배치 소비
- 복제 — Quorum 기반

### Classic/Quorum vs Stream
| | Classic | Quorum | Stream |
|--|---------|--------|--------|
| 재소비 | X | X | O |
| 복제 | Mirror | Raft | Raft |
| 소비 후 삭제 | O | O | X (보존) |
| 적합한 용도 | 작업 큐 | 안전한 작업 큐 | 이벤트 로그 |

---

## 8. 주요 패턴

### Work Queue (Task Queue)
- 여러 소비자가 큐 하나를 공유해 작업 분산
- `prefetchCount=1` + 수동 ACK — 공정한 분배
- 느린 소비자에게 과부하 방지

### Publish/Subscribe
- Fanout Exchange + 소비자별 임시 큐
- 동일 메시지를 모든 구독자에게 전달
- 큐 이름 자동 생성, `exclusive=true`

### Routing
- Direct Exchange + 라우팅 키
- 로그 레벨(info/warn/error)별 다른 큐로 라우팅

### Topics (패턴 기반 라우팅)
- Topic Exchange + 와일드카드 (`*`, `#`)
- `logs.*.error` — 서비스별 에러 로그
- `payments.#` — 결제 관련 모든 이벤트

### RPC (Request-Reply)
- `reply_to` — 응답 큐 이름 지정 (임시 큐 또는 고정 큐)
- `correlation_id` — 요청-응답 매핑
- 응답 타임아웃 처리 필수

### Delayed Message
- `rabbitmq-delayed-message-exchange` 플러그인
- `x-delay` 헤더로 지연 시간 지정
- 스케줄링, 재시도 지연에 활용

### Consistent Hashing Exchange
- 플러그인 — 라우팅 키 해시 기반 분산
- 소비자 추가/제거 시 최소 재분배

---

## 9. 성능 & 튜닝

### 연결 & 채널
- 연결(Connection) 재사용 — 연결 생성 비용 높음
- 채널(Channel) 풀링 — 연결당 채널 수 적절히 유지
- 멀티스레드 환경 — 스레드당 채널 하나 권장
- `connection_max`, `channel_max` 설정

### 처리량 최적화
- `delivery_mode=1` (비영속) — 디스크 I/O 없음
- Lazy Queue → 메모리 절약, 디스크 기반 처리
- Publisher Confirms 비동기 방식
- 배치 발행 (트랜잭션 없이)
- `prefetchCount` 조정 — 소비자 처리 능력에 맞게

### 메모리 & 디스크 관리
- `vm_memory_high_watermark` — 메모리 임계값 (기본 40%)
- 임계값 초과 시 프로듀서 차단 (flow control)
- `disk_free_limit` — 최소 여유 디스크 공간
- Lazy Queue — 메모리 대신 디스크에 메시지 저장

### 큐 설계
- 큐 수 최소화 — 큐가 많을수록 메모리 사용 증가
- `x-max-length` — 큐 길이 제한 + DLX 조합
- Quorum Queue — HA 환경에서 Classic Mirror보다 효율적

---

## 10. 운영 & 모니터링

### Management Plugin
- `rabbitmq-management` 플러그인 — 웹 UI + HTTP API
- 기본 포트: 15672 (HTTP), 15671 (HTTPS)
- 큐 상태, 메시지 속도, 연결/채널 현황

### 핵심 메트릭
- **큐**: messages (ready + unacknowledged), message_stats (publish_rate, deliver_rate, ack_rate)
- **소비자**: consumer_utilisation — 소비자 바쁜 정도 (1.0 = 100% 바쁨)
- **연결**: 연결 수, 채널 수, 메모리 사용량
- **노드**: fd_used (파일 디스크립터), mem_used, disk_free, proc_used

### 주요 알림 기준
- `messages_ready` 급증 → 소비자 처리 지연
- `consumer_utilisation` 낮음 → `prefetchCount` 낮거나 소비자 부족
- `mem_alarm=true` → 메모리 임계값 초과, 프로듀서 차단
- `disk_alarm=true` → 디스크 부족

### CLI 명령

```bash
# 큐 목록
rabbitmqctl list_queues name messages consumers

# 연결/채널
rabbitmqctl list_connections
rabbitmqctl list_channels

# 플러그인
rabbitmq-plugins list
rabbitmq-plugins enable rabbitmq_management

# 노드 상태
rabbitmqctl status
rabbitmqctl cluster_status

# 큐 비우기
rabbitmqctl purge_queue my-queue

# vhost 생성
rabbitmqctl add_vhost /my-app
rabbitmqctl set_permissions -p /my-app myuser ".*" ".*" ".*"
```

### 모니터링 도구
- Prometheus + `rabbitmq_prometheus` 플러그인 + Grafana
- Datadog RabbitMQ Integration
- CloudWatch (AWS AmazonMQ)

---

## 11. 보안

### 인증 (Authentication)
- 내장 사용자/패스워드 (`rabbitmqctl add_user`)
- LDAP 플러그인 — Active Directory 연동
- OAuth 2.0 플러그인 — JWT 토큰 기반
- x509 인증서 기반

### 권한 (Authorization)
- 퍼미션 3가지: `configure`, `write`, `read`
  - `configure` — 큐/Exchange 선언, 삭제
  - `write` — 발행 (Exchange에 대한 권한)
  - `read` — 소비, 바인딩 (큐에 대한 권한)
- vhost별 권한 설정
- Tag — `administrator`, `monitoring`, `policymaker`, `management`

### 암호화
- TLS/SSL — 클라이언트-브로커 암호화
- `ssl_options` 설정 — `certfile`, `keyfile`, `cacertfile`
- 상호 TLS (mTLS) — 클라이언트 인증서 검증

---

## 12. RabbitMQ vs Kafka 심화 비교

### 언제 RabbitMQ를 선택하는가
- 복잡한 라우팅 로직 (Exchange 타입 활용)
- 낮은 지연 레이턴시가 중요한 경우
- 메시지 처리 후 삭제가 기본인 작업 큐
- RPC 패턴 필요
- 소규모~중규모 메시지 처리
- 우선순위 큐, TTL, DLQ 등 세밀한 메시지 제어

### 언제 Kafka를 선택하는가
- 대용량 이벤트 스트리밍 (초당 수십만 메시지)
- 메시지 재소비, 이벤트 소싱
- 스트림 처리 (Kafka Streams)
- 감사 로그, 이벤트 히스토리 보존
- 여러 소비자 그룹이 독립적으로 소비

### 메시지 보장 비교

| | RabbitMQ | Kafka |
|--|----------|-------|
| At-most-once | auto-ack | acks=0 |
| At-least-once | 수동 ACK + nack | acks=all + 재시도 |
| Exactly-once | 어렵 (트랜잭션 플러그인) | 트랜잭션 프로듀서 + EOS |
| 순서 보장 | 단일 소비자 + 단일 큐 | 파티션 내 보장 |

---

## 학습 순서 권장

```
1단계 — 핵심 개념
  AMQP 이해 → Exchange/Queue/Binding → 메시지 구조

2단계 — 라우팅 패턴
  Direct → Fanout → Topic → Headers → DLX

3단계 — 신뢰성
  Publisher Confirms → ACK/NACK → DLX/DLQ → 재시도 패턴

4단계 — 고가용성
  Quorum Queue → 클러스터링 → 네트워크 파티션 처리

5단계 — 고급
  Stream Queue → Federation/Shovel → 성능 튜닝 → 보안

6단계 — 실무 패턴
  Work Queue → Pub/Sub → RPC → Delayed Message
```
