---
title: "[Redis] 2. 설치와 CLI"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "설치", "CLI", "redis-cli", "RESP"]
---

# 설치와 CLI

## 설치

### macOS

```bash
brew install redis

# 서비스로 시작
brew services start redis

# 직접 실행
redis-server

# 설정 파일 위치
/opt/homebrew/etc/redis.conf
```

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install redis-server

# 서비스 시작
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 상태 확인
sudo systemctl status redis-server
```

### Docker

```bash
# 단순 실행
docker run -d --name redis -p 6379:6379 redis:7.2

# 설정 파일과 데이터 볼륨 마운트
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v $(pwd)/redis.conf:/usr/local/etc/redis/redis.conf \
  -v $(pwd)/data:/data \
  redis:7.2 redis-server /usr/local/etc/redis/redis.conf

# Redis CLI 접속
docker exec -it redis redis-cli
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7.2
    container_name: redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    restart: unless-stopped

volumes:
  redis-data:
```

---

## redis.conf 핵심 설정

```conf
# 바인드 주소 (0.0.0.0은 모든 인터페이스)
bind 127.0.0.1

# 포트 (기본 6379)
port 6379

# 백그라운드 실행
daemonize yes

# 비밀번호
requirepass your-strong-password

# 최대 메모리
maxmemory 2gb
maxmemory-policy allkeys-lru

# 영속성
save 900 1    # 900초 내 1번 변경 시 저장
save 300 10   # 300초 내 10번 변경 시 저장
save 60 10000 # 60초 내 10000번 변경 시 저장

# AOF
appendonly yes
appendfsync everysec

# 로그
logfile /var/log/redis/redis-server.log
loglevel notice

# 데이터 디렉터리
dir /var/lib/redis

# 데이터베이스 수 (기본 16)
databases 16
```

---

## redis-cli 기본 사용

### 접속

```bash
# 로컬 기본 접속
redis-cli

# 호스트/포트 지정
redis-cli -h 192.168.1.100 -p 6379

# 비밀번호
redis-cli -a your-password

# 특정 DB 선택 (0~15)
redis-cli -n 1

# 원격 + 인증
redis-cli -h redis.example.com -p 6379 -a password

# TLS
redis-cli --tls --cacert /path/to/ca.crt
```

### 직접 명령 실행

```bash
# 단일 명령
redis-cli SET name "alice"
redis-cli GET name

# 파이프라인 모드
cat commands.txt | redis-cli --pipe

# 반복 실행
redis-cli -r 100 -i 0.1 INFO keyspace  # 0.1초마다 100번
```

---

## CLI 핵심 명령어

### 서버 정보

```bash
# 서버 상태 전체
INFO

# 특정 섹션
INFO server
INFO clients
INFO memory
INFO stats
INFO replication
INFO keyspace

# 설정 확인
CONFIG GET maxmemory
CONFIG GET bind
CONFIG GET *  # 전체

# 설정 동적 변경
CONFIG SET maxmemory 4gb
CONFIG SET loglevel debug

# 설정 디스크 저장
CONFIG REWRITE
```

### 데이터베이스

```bash
# DB 선택 (0~15)
SELECT 0
SELECT 1

# 현재 DB 키 수
DBSIZE

# 전체 키 패턴 검색 (프로덕션 주의!)
KEYS *
KEYS user:*
KEYS "user:*:profile"

# 안전한 키 순회 (KEYS 대신 사용)
SCAN 0 MATCH user:* COUNT 100

# 현재 DB 모든 키 삭제
FLUSHDB

# 전체 DB 삭제
FLUSHALL

# 비동기 삭제 (블로킹 없음)
FLUSHDB ASYNC
FLUSHALL ASYNC
```

### 키 관련

```bash
# 키 존재 여부
EXISTS user:1

# 키 타입
TYPE user:1       # string, list, set, zset, hash, stream

# 키 이름 변경
RENAME old-key new-key
RENAMENX old-key new-key  # new-key 없을 때만

# 키 삭제
DEL key1 key2 key3

# 비동기 삭제 (큰 자료구조에 유용)
UNLINK key1 key2

# TTL 확인
TTL key         # 남은 시간(초), -1=영구, -2=없는 키
PTTL key        # 밀리초

# TTL 설정
EXPIRE key 3600       # 초
PEXPIRE key 3600000   # 밀리초
EXPIREAT key 1700000000  # 유닉스 타임스탬프

# TTL 제거 (영구로 변경)
PERSIST key

# 키 직렬화
DUMP key
RESTORE key 0 <serialized>

# 키를 다른 서버로 이동
MIGRATE host port key destination-db timeout
```

### 디버깅

```bash
# 느린 쿼리 로그
SLOWLOG GET 10    # 최근 10개
SLOWLOG LEN       # 로그 수
SLOWLOG RESET     # 초기화

# 명령어 실행 시간 측정
DEBUG SLEEP 0     # 서버 응답 시간 테스트

# 메모리 사용량
MEMORY USAGE key  # 특정 키의 메모리 사용량 (bytes)
MEMORY DOCTOR     # 메모리 이슈 진단

# 객체 인코딩 확인
OBJECT ENCODING key
OBJECT IDLETIME key   # 마지막 접근 후 경과 시간
OBJECT REFCOUNT key   # 참조 카운트
OBJECT FREQ key       # 접근 빈도 (LFU 정책 시)

# 실시간 명령어 모니터링 (프로덕션 주의!)
MONITOR
```

### SCAN — 안전한 키 순회

```bash
# SCAN cursor [MATCH pattern] [COUNT count] [TYPE type]

# 기본 사용
SCAN 0

# 패턴 매칭
SCAN 0 MATCH "user:*" COUNT 100

# 타입 필터
SCAN 0 TYPE hash COUNT 100

# 전체 순회 스크립트
cursor=0
while true; do
  result=$(redis-cli SCAN $cursor MATCH "session:*" COUNT 100)
  cursor=$(echo "$result" | head -1)
  keys=$(echo "$result" | tail -n +2)
  echo "$keys"
  [ "$cursor" = "0" ] && break
done

# 관련 명령어
HSCAN hash-key 0 MATCH field:* COUNT 100   # Hash 순회
SSCAN set-key 0 COUNT 100                  # Set 순회
ZSCAN zset-key 0 COUNT 100                 # Sorted Set 순회
```

---

## RESP 프로토콜

Redis Serialization Protocol — 클라이언트-서버 통신 프로토콜.

```
데이터 타입:
  + 단순 문자열:   +OK\r\n
  - 에러:          -ERR unknown command\r\n
  : 정수:          :1000\r\n
  $ 벌크 문자열:  $6\r\nfoobar\r\n
  * 배열:          *2\r\n$3\r\nfoo\r\n$3\r\nbar\r\n

예시 — SET foo bar:
  클라이언트: *3\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n
  서버:       +OK\r\n

예시 — GET foo:
  클라이언트: *2\r\n$3\r\nGET\r\n$3\r\nfoo\r\n
  서버:       $3\r\nbar\r\n
```

```bash
# netcat으로 직접 확인
echo -e "*2\r\n\$4\r\nINFO\r\n\$6\r\nserver\r\n" | nc localhost 6379
```

---

## 유용한 CLI 팁

```bash
# 모든 키 개수
redis-cli DBSIZE

# 특정 패턴 키 삭제 (SCAN 활용)
redis-cli --scan --pattern "cache:*" | xargs redis-cli DEL

# 키 메모리 사용량 상위 10개
redis-cli --bigkeys

# 전체 키 분석
redis-cli --hotkeys  # maxmemory-policy=allkeys-lfu 필요

# 지연 모니터링
redis-cli --latency
redis-cli --latency-history
redis-cli --latency-dist

# 통계 모니터링
redis-cli --stat

# RDB 파일을 JSON으로 변환 (rdbtools 설치 필요)
rdb --command json /var/lib/redis/dump.rdb
```

---

## 정리

- `redis-cli`: 대화형 CLI, `-h/-p/-a` 옵션으로 원격 접속
- `SCAN` > `KEYS`: 프로덕션에서 대량 키 조회는 항상 SCAN 사용
- `CONFIG GET/SET`: 런타임 설정 변경 가능
- `SLOWLOG GET`: 느린 명령어 추적
- `MEMORY USAGE key`: 특정 키의 메모리 사용량 분석
- `--bigkeys`: 전체 키 중 메모리 사용량 큰 키 탐지
