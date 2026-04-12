---
title: "Redis 운영 명령어 모음"
date: 2026-04-12
tags: [redis, operations, monitoring, cli, commands]
---

## 상태 확인

```bash
# 전체 서버 정보
redis-cli INFO all

# 섹션별 조회
redis-cli INFO server      # 버전, 운영 시간
redis-cli INFO clients     # 연결 수
redis-cli INFO memory      # 메모리 사용
redis-cli INFO stats       # 히트율, OPS
redis-cli INFO replication # 복제 상태
redis-cli INFO keyspace    # DB별 키 수

# 실시간 모니터링
redis-cli --stat           # 초당 갱신되는 통계
redis-cli --latency        # 지연시간 측정
redis-cli --latency-history 1  # 1초마다 지연시간 기록
```

---

## 키 탐색 (안전하게)

```bash
# KEYS는 운영에서 절대 금지 (전체 블록)
# redis-cli KEYS *  ← 사용 금지!

# SCAN 사용 (블록 없음)
redis-cli SCAN 0 MATCH "user:*" COUNT 100

# 모든 키 수
redis-cli DBSIZE

# 특정 타입의 키
redis-cli SCAN 0 TYPE string COUNT 100
redis-cli SCAN 0 TYPE hash COUNT 100
```

---

## 메모리 분석

```bash
# 전체 메모리 상태
redis-cli MEMORY DOCTOR

# 특정 키 메모리 사용량
redis-cli MEMORY USAGE "user:42"
redis-cli MEMORY USAGE "big:hash" SAMPLES 10

# 큰 키 찾기 (상위 1%)
redis-cli --bigkeys

# 메모리 사용량으로 정렬된 키 목록
redis-cli --memkeys
```

---

## 성능 진단

```bash
# 느린 명령어 로그
redis-cli SLOWLOG GET 20       # 최근 20개
redis-cli SLOWLOG RESET        # 로그 초기화
redis-cli SLOWLOG LEN          # 로그 개수

# 현재 실행 중인 명령어 (블로킹 명령어 확인)
redis-cli CLIENT LIST

# CPU/메모리 사용률 실시간
redis-cli INFO cpu
```

---

## 복제 상태

```bash
# 마스터에서
redis-cli INFO replication
# role:master
# connected_slaves:2
# slave0:ip=...,port=6380,state=online,offset=...,lag=0
# slave1:ip=...,port=6381,state=online,offset=...,lag=1

# 슬레이브에서
redis-cli INFO replication
# role:slave
# master_host:redis-master
# master_link_status:up
# master_sync_in_progress:0
```

---

## 설정 관리

```bash
# 현재 설정 조회
redis-cli CONFIG GET maxmemory
redis-cli CONFIG GET maxmemory-policy
redis-cli CONFIG GET save

# 런타임 설정 변경 (재시작 불필요)
redis-cli CONFIG SET maxmemory 4gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET slowlog-log-slower-than 10000

# 변경 사항을 redis.conf에 저장
redis-cli CONFIG REWRITE
```

---

## 유지보수

```bash
# 수동 RDB 저장 (백그라운드)
redis-cli BGSAVE
redis-cli LASTSAVE  # 마지막 저장 시각 (unix timestamp)

# AOF 재작성 (파일 크기 압축)
redis-cli BGREWRITEAOF

# 메모리 조각 모음 (Redis 4.0+)
redis-cli MEMORY PURGE

# 특정 DB 초기화 (주의!)
redis-cli FLUSHDB ASYNC    # 현재 DB만
redis-cli FLUSHALL ASYNC   # 전체 DB (위험!)

# 디버그용 객체 인코딩 확인
redis-cli OBJECT ENCODING "user:42"
redis-cli OBJECT IDLETIME "user:42"   # 마지막 접근 후 경과 시간
redis-cli OBJECT FREQ "user:42"       # LFU 접근 빈도 (LFU 정책 시)
```

---

## Cluster 관리

```bash
# 클러스터 상태
redis-cli cluster info
redis-cli cluster nodes

# 슬롯 균형 재조정
redis-cli --cluster rebalance redis1:7001

# 새 노드 추가
redis-cli --cluster add-node new-node:7007 existing-node:7001

# 헬스 체크
redis-cli --cluster check redis1:7001
```

---

## 자주 쓰는 원라이너

```bash
# Redis 히트율 계산
redis-cli INFO stats | awk -F: '/keyspace_hits/{h=$2} /keyspace_misses/{m=$2} END{print h/(h+m)*100 "%"}'

# TTL 없는 키 수 (메모리 누수 의심)
redis-cli SCAN 0 COUNT 1000 | tail -n +2 | xargs -I {} redis-cli TTL {} | grep -c "^-1$"

# 패턴으로 키 삭제
redis-cli SCAN 0 MATCH "session:*" COUNT 100 | tail -n +2 | xargs redis-cli DEL

# 메모리 사용량 상위 10개 키
redis-cli --bigkeys 2>&1 | grep "Biggest" | head -20
```

---

## 핵심 요약

- 히트율: `INFO stats | grep keyspace`
- 메모리: `INFO memory`, `MEMORY USAGE`, `--bigkeys`
- 느린 명령어: `SLOWLOG GET`
- 키 탐색: `SCAN` (KEYS 절대 금지)
- 설정 변경: `CONFIG SET` → `CONFIG REWRITE`로 영속화
- 복제 상태: `INFO replication`
