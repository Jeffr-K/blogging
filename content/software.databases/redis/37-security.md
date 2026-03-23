---
title: "[Redis] 37. 보안 — 인증, TLS, ACL, 네트워크 격리"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "security", "ACL", "TLS", "authentication", "network"]
---

# 보안 — 인증, TLS, ACL, 네트워크 격리

## 기본 인증 (requirepass)

```bash
# redis.conf
requirepass your-strong-password-here

# 런타임 설정
CONFIG SET requirepass "your-strong-password"

# 클라이언트 인증
AUTH your-strong-password

# redis-cli
redis-cli -a your-strong-password

# Spring application.yml
spring:
  data:
    redis:
      password: your-strong-password
```

---

## ACL (Access Control List) — Redis 6.0+

기존 단일 비밀번호 → 사용자별 권한 세분화.

### ACL 기본 사용

```bash
# 현재 ACL 목록
ACL LIST

# 기본 출력:
# user default on nopass ~* &* +@all

# 사용자 생성
ACL SETUSER alice on >alice-password ~cache:* +GET +SET +DEL

# 읽기 전용 사용자
ACL SETUSER readonly on >readonly-pass ~* +@read

# 특정 명령어 그룹만
ACL SETUSER worker on >worker-pass ~queue:* +LPUSH +RPUSH +BLPOP +LLEN

# 비활성 사용자 생성
ACL SETUSER bob off >bob-pass ~* +@all

# 사용자 정보 조회
ACL GETUSER alice

# 사용자 삭제
ACL DELUSER alice

# 현재 사용자
ACL WHOAMI

# ACL 카테고리 목록
ACL CAT
ACL CAT string   # string 카테고리 명령어 목록
```

### ACL 규칙 문법

```bash
# 상태
on          # 활성화
off         # 비활성화

# 비밀번호
>password   # 비밀번호 추가
<password   # 비밀번호 제거
nopass      # 비밀번호 없음 (주의)
resetpass   # 모든 비밀번호 제거 + nopass 해제

# 키 패턴
~pattern    # 접근 가능한 키 패턴 (glob)
~*          # 모든 키
~cache:*    # cache: 로 시작하는 키만
%R~pattern  # 읽기 전용 키 패턴 (7.0+)
%W~pattern  # 쓰기 전용 키 패턴 (7.0+)
allkeys     # 모든 키 (~* 와 동일)
resetkeys   # 키 패턴 초기화

# 채널 (Pub/Sub)
&channel    # 구독 가능한 채널
&*          # 모든 채널
allchannels # 모든 채널
resetchannels

# 명령어
+command    # 명령어 허용
-command    # 명령어 거부
+@category  # 카테고리 전체 허용
-@category  # 카테고리 전체 거부
+@all       # 모든 명령어 허용
-@all       # 모든 명령어 거부
allcommands # 모든 명령어 허용
nocommands  # 모든 명령어 거부
```

### ACL 파일 설정

```bash
# redis.conf
aclfile /etc/redis/users.acl

# /etc/redis/users.acl
user default off
user admin on >admin-pass ~* &* +@all
user api on >api-pass ~session:* ~cache:* +GET +SET +DEL +EXPIRE +TTL
user readonly on >readonly-pass ~* +@read -@write
user queue on >queue-pass ~queue:* +LPUSH +RPUSH +BLPOP +LRANGE +LLEN

# ACL 파일 재로드 (런타임)
ACL LOAD
ACL SAVE   # 현재 ACL을 파일에 저장
```

---

## TLS/SSL 설정

### 인증서 생성 (개발용)

```bash
# CA 생성
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
  -subj "/CN=Redis CA"

# 서버 인증서
openssl genrsa -out redis.key 2048
openssl req -new -key redis.key -out redis.csr \
  -subj "/CN=redis-server"
openssl x509 -req -days 3650 -CA ca.crt -CAkey ca.key \
  -CAcreateserial -in redis.csr -out redis.crt

# 클라이언트 인증서 (mTLS)
openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr \
  -subj "/CN=redis-client"
openssl x509 -req -days 3650 -CA ca.crt -CAkey ca.key \
  -CAcreateserial -in client.csr -out client.crt
```

### TLS redis.conf 설정

```bash
# TLS 포트
port 0              # 일반 포트 비활성화
tls-port 6380       # TLS 포트

# 인증서 설정
tls-cert-file /etc/redis/redis.crt
tls-key-file /etc/redis/redis.key
tls-ca-cert-file /etc/redis/ca.crt

# mTLS (클라이언트 인증서 요구)
tls-auth-clients yes          # 클라이언트 인증서 필수
# tls-auth-clients optional   # 선택적

# TLS 버전 및 암호화
tls-protocols "TLSv1.2 TLSv1.3"
tls-ciphers DEFAULT:!MEDIUM
tls-prefer-server-ciphers yes

# 복제 TLS
tls-replication yes
```

### Spring TLS 설정

```yaml
# application.yml
spring:
  data:
    redis:
      host: redis.example.com
      port: 6380
      ssl:
        enabled: true
        bundle: redis-ssl

spring:
  ssl:
    bundle:
      jks:
        redis-ssl:
          keystore:
            location: classpath:keystore.p12
            password: keystore-password
            type: PKCS12
          truststore:
            location: classpath:truststore.p12
            password: truststore-password
```

```kotlin
// Lettuce TLS 설정 (직접)
@Bean
fun redisConnectionFactory(): LettuceConnectionFactory {
    val sslContext = SslContextBuilder.forClient()
        .trustManager(File("/etc/ssl/ca.crt"))
        .keyManager(File("/etc/ssl/client.crt"), File("/etc/ssl/client.key"))
        .build()

    val clientConfig = LettuceClientConfiguration.builder()
        .useSsl()
        .build()

    val config = RedisStandaloneConfiguration("redis.example.com", 6380)
    config.password = RedisPassword.of("password")

    return LettuceConnectionFactory(config, clientConfig)
}
```

---

## 네트워크 격리

```bash
# redis.conf — bind 설정
bind 127.0.0.1                  # 로컬만 (기본 권장)
bind 127.0.0.1 10.0.0.5        # 특정 인터페이스만
bind 0.0.0.0                    # 모든 인터페이스 (주의!)

# protected-mode (bind 미설정 시 보호 모드)
protected-mode yes   # 외부 접속 차단 (기본값)

# 명령어 rename (위험한 명령어 숨기기)
rename-command FLUSHALL ""      # 비활성화
rename-command FLUSHDB ""
rename-command DEBUG ""
rename-command CONFIG "CONFIG-SECRET-NAME"
rename-command KEYS ""          # SCAN 사용 권장
```

### Docker 네트워크 격리

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass "${REDIS_PASSWORD}" --bind 0.0.0.0
    networks:
      - backend      # 내부 네트워크만
    # ports 미노출 (외부 접근 차단)

  app:
    image: myapp
    networks:
      - backend
      - frontend
    environment:
      REDIS_URL: redis://redis:6379

networks:
  backend:
    internal: true   # 외부 트래픽 차단
  frontend:
```

---

## 보안 체크리스트

```bash
# 1. 인증 확인
CONFIG GET requirepass

# 2. bind 확인
CONFIG GET bind

# 3. protected-mode 확인
CONFIG GET protected-mode

# 4. TLS 상태
CONFIG GET tls-port

# 5. 위험한 명령어 확인
CONFIG GET rename-command

# 6. ACL 현황
ACL LIST

# 7. 현재 연결된 클라이언트
CLIENT LIST

# 8. 보안 경고 확인
redis-cli --no-auth-warning -a pass CONFIG REWRITE
```

---

## 정리

| 보안 영역 | 방법 | 버전 |
|----------|------|------|
| 기본 인증 | `requirepass` | 전체 |
| 사용자 권한 | ACL | 6.0+ |
| 전송 암호화 | TLS | 6.0+ |
| 네트워크 격리 | `bind` + `protected-mode` | 전체 |
| 명령어 제한 | `rename-command` | 전체 |

- **ACL 기본 사용자**: `default` 사용자 반드시 비활성화 또는 제한
- **TLS**: 프로덕션 환경에서는 TLS 필수
- **bind**: 외부 노출 최소화, VPC 내부 IP만 허용
- **FLUSHALL/FLUSHDB**: `rename-command`로 비활성화
