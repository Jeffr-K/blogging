---
title: "[Kafka] 9. Kafka Connect — Source/Sink Connector, Debezium CDC"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "kafka-connect", "debezium", "CDC", "connector", "데이터통합"]
---

# Kafka Connect — Source/Sink Connector, Debezium CDC

## Kafka Connect란?

**외부 시스템 ↔ Kafka** 데이터를 이동시키는 프레임워크.

```
외부 시스템         Kafka Connect          Kafka
(DB, S3, ES 등)
     ↑                                       ↑
Source Connector: 외부 → Kafka으로 데이터 가져오기
Sink Connector:   Kafka → 외부로 데이터 내보내기
```

코드 없이 설정(JSON/REST API)만으로 데이터 파이프라인 구축.

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                   Kafka Connect Cluster                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Worker 1   │  │   Worker 2   │  │   Worker 3   │  │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │  │
│  │ │Connector │ │  │ │Connector │ │  │ │Connector │ │  │
│  │ │Task 1    │ │  │ │Task 2    │ │  │ │Task 3    │ │  │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
         ↕ REST API                        ↕ Kafka
```

**Worker**: Connect 프로세스. 커넥터와 태스크 실행.
**Connector**: 연결 설정 및 태스크 수 결정.
**Task**: 실제 데이터 이동 단위 (병렬 처리).

---

## 배포 모드

### Standalone 모드 (단일 프로세스)

```bash
connect-standalone.sh connect-standalone.properties \
  mysql-source.properties \
  elasticsearch-sink.properties
```

개발/테스트 환경에 적합.

### Distributed 모드 (클러스터)

```bash
connect-distributed.sh connect-distributed.properties
```

프로덕션 환경. REST API로 커넥터 관리.

---

## REST API로 커넥터 관리

```bash
# 커넥터 목록
curl http://localhost:8083/connectors

# 커넥터 생성
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mysql-orders-source",
    "config": {
      "connector.class": "...",
      ...
    }
  }'

# 커넥터 상태
curl http://localhost:8083/connectors/mysql-orders-source/status

# 커넥터 삭제
curl -X DELETE http://localhost:8083/connectors/mysql-orders-source

# 커넥터 재시작
curl -X POST http://localhost:8083/connectors/mysql-orders-source/restart
```

---

## Source Connector 예시

### JDBC Source Connector (DB → Kafka)

```json
{
  "name": "mysql-orders-source",
  "config": {
    "connector.class": "io.confluent.connect.jdbc.JdbcSourceConnector",
    "connection.url": "jdbc:mysql://mysql:3306/shop",
    "connection.user": "kafka",
    "connection.password": "secret",
    "table.whitelist": "orders,order_items",
    "mode": "incrementing",
    "incrementing.column.name": "id",
    "topic.prefix": "mysql.",
    "poll.interval.ms": "1000"
  }
}
```

**mode 옵션**:
- `incrementing`: 증가하는 ID 컬럼 기준 (새 행만)
- `timestamp`: 타임스탬프 기준 (업데이트 포함)
- `timestamp+incrementing`: 둘 다 활용
- `bulk`: 전체 테이블 주기적 복사

---

## Sink Connector 예시

### Elasticsearch Sink Connector (Kafka → Elasticsearch)

```json
{
  "name": "elasticsearch-sink",
  "config": {
    "connector.class": "io.confluent.connect.elasticsearch.ElasticsearchSinkConnector",
    "tasks.max": "3",
    "topics": "mysql.orders",
    "connection.url": "http://elasticsearch:9200",
    "type.name": "_doc",
    "key.ignore": "false",
    "schema.ignore": "true",
    "behavior.on.malformed.documents": "warn"
  }
}
```

### S3 Sink Connector (Kafka → S3)

```json
{
  "name": "s3-sink",
  "config": {
    "connector.class": "io.confluent.connect.s3.S3SinkConnector",
    "tasks.max": "3",
    "topics": "orders,payments",
    "s3.region": "ap-northeast-2",
    "s3.bucket.name": "my-data-lake",
    "s3.part.size": "5242880",
    "storage.class": "io.confluent.connect.s3.storage.S3Storage",
    "format.class": "io.confluent.connect.s3.format.parquet.ParquetFormat",
    "flush.size": "1000",
    "rotate.interval.ms": "3600000",
    "locale": "en_US",
    "timezone": "UTC",
    "timestamp.extractor": "RecordField",
    "timestamp.field": "created_at"
  }
}
```

---

## Debezium — CDC (Change Data Capture)

### CDC란?

DB의 모든 변경(INSERT/UPDATE/DELETE)을 실시간으로 Kafka로 스트리밍.

```
MySQL binlog
  ↓
Debezium MySQL Connector
  ↓
Kafka Topic (orders)
  ↓
Elasticsearch, 캐시, 마이크로서비스...
```

JDBC Source와 차이:
- JDBC: polling (주기적 쿼리) → 지연, 부하, DELETE 캐치 불가
- Debezium: 트랜잭션 로그 기반 → 실시간, 저부하, DELETE 포함

### Debezium MySQL Connector 설정

```json
{
  "name": "mysql-debezium",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "tasks.max": "1",
    "database.hostname": "mysql",
    "database.port": "3306",
    "database.user": "debezium",
    "database.password": "secret",
    "database.server.id": "184054",
    "topic.prefix": "dbserver1",
    "database.include.list": "shop",
    "table.include.list": "shop.orders,shop.users",
    "schema.history.internal.kafka.bootstrap.servers": "kafka:9092",
    "schema.history.internal.kafka.topic": "schema-changes.shop"
  }
}
```

### Debezium 이벤트 구조

```json
{
  "schema": { ... },
  "payload": {
    "before": {
      "id": 1,
      "status": "PENDING",
      "amount": 50000
    },
    "after": {
      "id": 1,
      "status": "PAID",
      "amount": 50000
    },
    "source": {
      "version": "2.4.0",
      "connector": "mysql",
      "db": "shop",
      "table": "orders",
      "ts_ms": 1700000000000,
      "gtid": null,
      "file": "mysql-bin.000003",
      "pos": 154,
      "op": "u"  ← c(create), u(update), d(delete), r(snapshot read)
    },
    "op": "u",
    "ts_ms": 1700000001234
  }
}
```

### MySQL 권한 설정

```sql
CREATE USER 'debezium'@'%' IDENTIFIED BY 'secret';
GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT
  ON *.* TO 'debezium'@'%';
FLUSH PRIVILEGES;

-- binlog 활성화 (my.cnf)
-- log_bin = mysql-bin
-- binlog_format = ROW
-- binlog_row_image = FULL
```

### PostgreSQL Debezium

```json
{
  "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
  "plugin.name": "pgoutput",
  "database.hostname": "postgres",
  "database.dbname": "shop",
  "slot.name": "debezium_slot",
  "publication.name": "debezium_pub"
}
```

```sql
-- PostgreSQL: logical replication 활성화
-- postgresql.conf: wal_level = logical

-- 슬롯 생성
SELECT pg_create_logical_replication_slot('debezium_slot', 'pgoutput');

-- 퍼블리케이션 생성
CREATE PUBLICATION debezium_pub FOR TABLE orders, users;
```

---

## SMT (Single Message Transform)

Connector 내에서 메시지 변환.

```json
{
  "transforms": "unwrap,addField",
  "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
  "transforms.unwrap.drop.tombstones": "false",
  "transforms.addField.type": "org.apache.kafka.connect.transforms.InsertField$Value",
  "transforms.addField.static.field": "source",
  "transforms.addField.static.value": "mysql-shop"
}
```

주요 SMT:
- `ExtractNewRecordState`: Debezium 이벤트에서 `after` 값만 추출
- `ReplaceField`: 필드 이름 변경/제거
- `MaskField`: 민감 정보 마스킹
- `TimestampConverter`: 타임스탬프 포맷 변환
- `Router`: 조건에 따라 다른 토픽으로 라우팅

---

## 정리

- **Kafka Connect**: 설정 기반 데이터 파이프라인, 코드 없이 외부 시스템 연동
- **Source Connector**: 외부 → Kafka (DB, S3, HTTP 등)
- **Sink Connector**: Kafka → 외부 (Elasticsearch, S3, JDBC 등)
- **Debezium**: 트랜잭션 로그 기반 CDC, INSERT/UPDATE/DELETE 실시간 캡처
- **SMT**: 커넥터 내에서 경량 메시지 변환
- **Distributed 모드**: 프로덕션 환경 권장, REST API로 커넥터 관리
