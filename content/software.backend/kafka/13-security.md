---
title: "[Kafka] 13. 보안 — SSL/TLS, SASL, ACL"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "security", "SSL", "SASL", "ACL", "인증", "인가", "암호화"]
---

# 보안 — SSL/TLS, SASL, ACL

## Kafka 보안 레이어

```
┌─────────────────────────────────────────────┐
│              보안 레이어                     │
│                                              │
│  1. 전송 암호화    → SSL/TLS                 │
│  2. 인증          → SASL (PLAIN, SCRAM, etc) │
│  3. 인가          → ACL (Access Control List) │
└─────────────────────────────────────────────┘
```

---

## SSL/TLS — 전송 암호화

### 인증서 준비

```bash
# CA(Certificate Authority) 생성
openssl req -new -x509 -keyout ca-key -out ca-cert -days 365 \
  -subj "/CN=Kafka-CA/OU=Dev/O=MyCompany/L=Seoul/C=KR"

# 각 브로커용 키스토어 생성
keytool -keystore kafka.server.keystore.jks \
  -alias localhost \
  -validity 365 \
  -genkey \
  -keyalg RSA \
  -dname "CN=kafka1.example.com,OU=Dev,O=MyCompany,C=KR"

# CSR 생성 및 CA 서명
keytool -keystore kafka.server.keystore.jks \
  -alias localhost \
  -certreq -file cert-file

openssl x509 -req -CA ca-cert -CAkey ca-key \
  -in cert-file -out cert-signed \
  -days 365 -CAcreateserial

# 트러스트스토어 생성
keytool -keystore kafka.server.truststore.jks \
  -alias CARoot -import -file ca-cert
```

### 브로커 SSL 설정

```properties
# server.properties
listeners=PLAINTEXT://kafka1:9092,SSL://kafka1:9093
advertised.listeners=PLAINTEXT://kafka1:9092,SSL://kafka1:9093

ssl.keystore.location=/etc/kafka/secrets/kafka.server.keystore.jks
ssl.keystore.password=keystore-password
ssl.key.password=key-password
ssl.truststore.location=/etc/kafka/secrets/kafka.server.truststore.jks
ssl.truststore.password=truststore-password

# 클라이언트 인증서 요구 (mTLS)
ssl.client.auth=required  # none, requested, required
```

### 클라이언트 SSL 설정

```kotlin
val props = Properties().apply {
    put("bootstrap.servers", "kafka1:9093")
    put("security.protocol", "SSL")
    put("ssl.truststore.location", "/etc/kafka/client.truststore.jks")
    put("ssl.truststore.password", "truststore-password")

    // mTLS (클라이언트 인증서)
    put("ssl.keystore.location", "/etc/kafka/client.keystore.jks")
    put("ssl.keystore.password", "keystore-password")
    put("ssl.key.password", "key-password")
}
```

---

## SASL — 인증

**SASL (Simple Authentication and Security Layer)**: 인증 프로토콜 프레임워크.

### SASL 메커니즘 종류

| 메커니즘 | 설명 | 권장 환경 |
|----------|------|-----------|
| `PLAIN` | 평문 아이디/비밀번호, SSL 필수 | 내부망, 간단한 설정 |
| `SCRAM-SHA-256` | 해시 기반 챌린지-응답 | 비밀번호 인증 |
| `SCRAM-SHA-512` | SCRAM-SHA-256보다 강력 | 높은 보안 요구 |
| `GSSAPI (Kerberos)` | 엔터프라이즈 SSO | 대기업/금융 |
| `OAUTHBEARER` | JWT 토큰 기반 | 클라우드/MSA |

### SASL/SCRAM 설정

```bash
# 사용자 추가 (ZooKeeper 또는 --bootstrap-server)
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --entity-type users --entity-name alice \
  --add-config 'SCRAM-SHA-512=[password=alice-password]'

# 사용자 삭제
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --entity-type users --entity-name alice \
  --delete-config 'SCRAM-SHA-512'
```

```properties
# server.properties
listeners=SASL_SSL://kafka1:9094
advertised.listeners=SASL_SSL://kafka1:9094

security.inter.broker.protocol=SASL_SSL
sasl.mechanism.inter.broker.protocol=SCRAM-SHA-512

sasl.enabled.mechanisms=SCRAM-SHA-512

# JAAS 설정
listener.name.sasl_ssl.scram-sha-512.sasl.jaas.config=\
  org.apache.kafka.common.security.scram.ScramLoginModule required \
  username="kafka-broker" \
  password="broker-password";
```

### 클라이언트 SASL/SCRAM 설정

```kotlin
val props = Properties().apply {
    put("bootstrap.servers", "kafka1:9094")
    put("security.protocol", "SASL_SSL")
    put("sasl.mechanism", "SCRAM-SHA-512")
    put("sasl.jaas.config",
        "org.apache.kafka.common.security.scram.ScramLoginModule required " +
        "username=\"alice\" " +
        "password=\"alice-password\";"
    )
    // SSL 설정도 함께
    put("ssl.truststore.location", "/etc/kafka/client.truststore.jks")
    put("ssl.truststore.password", "truststore-password")
}
```

### SASL/PLAIN 설정 (간단한 내부 환경)

```properties
# server.properties
listeners=SASL_PLAINTEXT://kafka1:9095
sasl.enabled.mechanisms=PLAIN

listener.name.sasl_plaintext.plain.sasl.jaas.config=\
  org.apache.kafka.common.security.plain.PlainLoginModule required \
  username="kafka-broker" \
  password="broker-password" \
  user_alice="alice-password" \
  user_bob="bob-password";
```

### SASL/OAUTHBEARER (JWT)

```kotlin
props["sasl.mechanism"] = "OAUTHBEARER"
props["sasl.login.callback.handler.class"] =
    "org.apache.kafka.common.security.oauthbearer.secured.OAuthBearerLoginCallbackHandler"
props["sasl.oauthbearer.token.endpoint.url"] = "https://auth-server/oauth/token"
props["sasl.jaas.config"] =
    "org.apache.kafka.common.security.oauthbearer.OAuthBearerLoginModule required " +
    "clientId=\"kafka-client\" " +
    "clientSecret=\"secret\";"
```

---

## ACL — 인가

**ACL (Access Control List)**: 인증된 주체가 어떤 작업을 할 수 있는지 제어.

### ACL 활성화

```properties
# server.properties
authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer

# super user (ACL 제한 없음)
super.users=User:kafka-broker;User:kafka-admin

# ACL이 없으면 기본 허용/거부
allow.everyone.if.no.acl.found=false  # 기본 거부 (권장)
```

### ACL 설정 명령어

```bash
# 토픽에 대한 쓰기 권한 부여
kafka-acls.sh --bootstrap-server localhost:9092 \
  --add \
  --allow-principal User:order-service \
  --operation Write \
  --topic orders

# 토픽에 대한 읽기 권한 부여
kafka-acls.sh --bootstrap-server localhost:9092 \
  --add \
  --allow-principal User:analytics-service \
  --operation Read \
  --topic orders

# Consumer Group 접근 권한 (소비자는 필수)
kafka-acls.sh --bootstrap-server localhost:9092 \
  --add \
  --allow-principal User:analytics-service \
  --operation Read \
  --group analytics-group

# 와일드카드 (모든 토픽)
kafka-acls.sh --bootstrap-server localhost:9092 \
  --add \
  --allow-principal User:admin-service \
  --operation All \
  --topic '*'

# Produce + Describe (프로듀서에게 필요한 최소 권한)
kafka-acls.sh --bootstrap-server localhost:9092 \
  --add \
  --allow-principal User:order-service \
  --operation Write \
  --operation Describe \
  --topic orders

# ACL 목록 확인
kafka-acls.sh --bootstrap-server localhost:9092 \
  --list --topic orders

# ACL 제거
kafka-acls.sh --bootstrap-server localhost:9092 \
  --remove \
  --allow-principal User:order-service \
  --operation Write \
  --topic orders
```

### ACL 작업 종류

| 작업 | 대상 | 설명 |
|------|------|------|
| `Read` | Topic, Group | 메시지 읽기, 오프셋 커밋 |
| `Write` | Topic | 메시지 쓰기 |
| `Create` | Cluster | 토픽 생성 |
| `Delete` | Topic | 토픽 삭제 |
| `Alter` | Topic | 파티션 수 변경 등 |
| `Describe` | Topic, Group | 메타데이터 조회 |
| `DescribeConfigs` | Topic, Broker | 설정 조회 |
| `AlterConfigs` | Topic, Broker | 설정 변경 |
| `All` | - | 모든 권한 |

---

## 보안 설정 전략

### 최소 권한 원칙

```
프로듀서:  Write + Describe (토픽)
소비자:    Read (토픽) + Read (Consumer Group)
Admin:     Describe + Alter + Create + Delete
브로커간: ClusterAction (복제, 컨트롤러 통신)
```

### 환경별 보안 수준

```
개발:   PLAINTEXT (암호화/인증 없음)
스테이징: SASL_PLAINTEXT + SCRAM
프로덕션: SASL_SSL + SCRAM-SHA-512 + ACL
금융/의료: SASL_SSL + Kerberos + ACL + 감사로그
```

### 감사 로그

```properties
# 모든 인증/인가 이벤트 로깅
log4j.logger.kafka.authorizer.logger=INFO, authorizerAppender
log4j.additivity.kafka.authorizer.logger=false

log4j.appender.authorizerAppender=org.apache.log4j.DailyRollingFileAppender
log4j.appender.authorizerAppender.DatePattern='.'yyyy-MM-dd-HH
log4j.appender.authorizerAppender.File=/var/log/kafka/kafka-authorizer.log
```

---

## 정리

- **SSL/TLS**: 전송 데이터 암호화, mTLS로 클라이언트 인증서 검증
- **SASL**: 인증 메커니즘 — 내부망은 SCRAM, 클라우드는 OAUTHBEARER, 엔터프라이즈는 Kerberos
- **ACL**: 주체(User)에게 토픽/Consumer Group에 대한 작업 권한 부여
- **최소 권한**: 프로듀서는 Write, 소비자는 Read, 관리자만 All
- **프로덕션 권장**: `SASL_SSL` + `SCRAM-SHA-512` + `ACL` + `allow.everyone.if.no.acl.found=false`
