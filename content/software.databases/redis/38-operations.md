---
title: "[Redis] 38. 운영 — 백업, 복구, 마이그레이션, 점검"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "operations", "backup", "migration", "maintenance", "운영"]
---

# 운영 — 백업, 복구, 마이그레이션, 점검

## 백업

### RDB 백업

```bash
# 즉시 RDB 저장 (블로킹)
SAVE

# 백그라운드 RDB 저장 (fork, 비블로킹)
BGSAVE

# 마지막 저장 시각 확인
LASTSAVE
date -d @$(redis-cli LASTSAVE)

# RDB 파일 위치
CONFIG GET dir
CONFIG GET dbfilename

# 자동 백업 설정 (redis.conf)
save 900 1      # 900초 내 1개 변경 시 저장
save 300 10     # 300초 내 10개 변경 시 저장
save 60 10000   # 60초 내 10,000개 변경 시 저장

# RDB 파일 수동 백업 스크립트
```

```bash
#!/bin/bash
# redis-backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
REDIS_DIR=$(redis-cli CONFIG GET dir | tail -1)
REDIS_FILE=$(redis-cli CONFIG GET dbfilename | tail -1)
BACKUP_DIR="/backup/redis"

redis-cli BGSAVE
sleep 5  # 저장 대기

cp "${REDIS_DIR}/${REDIS_FILE}" "${BACKUP_DIR}/dump_${DATE}.rdb"
echo "백업 완료: dump_${DATE}.rdb"

# 7일 이상 된 백업 삭제
find "${BACKUP_DIR}" -name "dump_*.rdb" -mtime +7 -delete
```

### AOF 백업

```bash
# AOF 재작성 (압축)
BGREWRITEAOF

# AOF 상태 확인
INFO persistence
# aof_enabled: 1
# aof_rewrite_in_progress: 0
# aof_current_size: 12345678
# aof_base_size: 10000000

# AOF 파일 위치
CONFIG GET appendfilename
CONFIG GET appenddirname  # Redis 7.0+ (Multi-Part AOF)
```

---

## 복구

### RDB로 복구

```bash
# 1. Redis 중지
systemctl stop redis

# 2. 기존 RDB 파일 교체
cp /backup/redis/dump_20240315.rdb /var/lib/redis/dump.rdb

# 3. 권한 설정
chown redis:redis /var/lib/redis/dump.rdb

# 4. Redis 시작
systemctl start redis

# 5. 확인
redis-cli DBSIZE
redis-cli INFO keyspace
```

### AOF로 복구

```bash
# AOF 파일 손상 시 복구 도구
redis-check-aof --fix /var/lib/redis/appendonly.aof

# 확인 (수정 없음)
redis-check-aof /var/lib/redis/appendonly.aof

# RDB 파일 검사
redis-check-rdb /var/lib/redis/dump.rdb
```

### 특정 시점 복구 (PITR)

```bash
# AOF + RDB 조합으로 특정 시점 복구
# 1. RDB: 마지막 스냅샷 시점
# 2. AOF: 스냅샷 이후 명령어 재생
# → RDB 복원 후 AOF 적용으로 특정 시점까지 복구 가능

# AOF 특정 지점까지만 적용 (수동)
# AOF 파일에서 특정 시각 이후 명령어 제거 후 복구
```

---

## 데이터 마이그레이션

### DUMP / RESTORE — 키 복사

```bash
# 키를 직렬화
DUMP user:1001

# 다른 서버로 복원
RESTORE user:1001 0 <serialized-value>

# TTL 유지 복원
RESTORE user:1001 3600000 <serialized-value>  # 1시간 TTL
```

### MIGRATE — 원자적 이동

```bash
# 다른 서버로 키 이동
MIGRATE 10.0.0.2 6379 user:1001 0 5000
# 형식: MIGRATE host port key db timeout

# 복사 (원본 유지)
MIGRATE 10.0.0.2 6379 user:1001 0 5000 COPY

# 여러 키 이동
MIGRATE 10.0.0.2 6379 "" 0 5000 KEYS user:1001 user:1002 user:1003
```

### redis-cli --pipe — 대량 이전

```bash
# 1. 기존 서버에서 데이터 추출 (RDB → key-value)
redis-cli --no-auth-warning -a oldpass \
  --rdb /tmp/migration.rdb

# 2. redis-dump 도구 사용 (npm: redis-dump)
npm install -g redis-dump
redis-dump -h old-server > dump.txt
redis-cli -h new-server < dump.txt

# 3. 직접 SCAN + MIGRATE
```

```kotlin
// 키 이전 스크립트
@Component
class RedisMigration(
    private val sourceRedis: StringRedisTemplate,
    private val targetRedis: StringRedisTemplate,
) {

    fun migrateByPattern(pattern: String) {
        var totalMigrated = 0

        sourceRedis.scan(
            ScanOptions.scanOptions().match(pattern).count(200).build()
        ).use { cursor ->
            val batch = mutableListOf<String>()

            cursor.forEach { key ->
                batch.add(key)

                if (batch.size >= 100) {
                    migrateBatch(batch)
                    totalMigrated += batch.size
                    batch.clear()
                    logger.info("마이그레이션 진행: $totalMigrated개")
                }
            }

            if (batch.isNotEmpty()) {
                migrateBatch(batch)
                totalMigrated += batch.size
            }
        }

        logger.info("마이그레이션 완료: 총 ${totalMigrated}개")
    }

    private fun migrateBatch(keys: List<String>) {
        val pipeline = sourceRedis.executePipelined {
            keys.forEach { key ->
                it.opsForValue().get(key)
            }
            null
        }

        targetRedis.executePipelined {
            keys.forEachIndexed { i, key ->
                val value = pipeline[i] as? String ?: return@forEachIndexed
                val ttl = sourceRedis.getExpire(key, TimeUnit.MILLISECONDS)
                if (ttl > 0) {
                    it.opsForValue().set(key, value, Duration.ofMillis(ttl))
                } else {
                    it.opsForValue().set(key, value)
                }
            }
            null
        }
    }
}
```

---

## 버전 업그레이드

```bash
# 무중단 업그레이드 (Replica를 통한 롤링)
# 1. 레플리카를 새 버전으로 업그레이드
# 2. 레플리카를 마스터로 승격 (Sentinel FAILOVER)
# 3. 기존 마스터를 새 버전으로 업그레이드 → 레플리카로 재연결
# 4. 필요 시 다시 마스터 교체

# Sentinel 수동 페일오버
SENTINEL FAILOVER mymaster

# 클러스터 롤링 업그레이드
redis-cli --cluster check localhost:7001
redis-cli --cluster fix localhost:7001
```

---

## 정기 점검

### 일별 점검

```bash
#!/bin/bash
# daily-check.sh

# 연결 상태
redis-cli PING

# 메모리 사용량
redis-cli INFO memory | grep used_memory_human

# 히트율
HITS=$(redis-cli INFO stats | grep keyspace_hits | cut -d: -f2)
MISSES=$(redis-cli INFO stats | grep keyspace_misses | cut -d: -f2)
echo "Hit Rate: $(echo "scale=2; $HITS / ($HITS + $MISSES) * 100" | bc)%"

# 복제 상태
redis-cli INFO replication | grep -E "role|connected_slaves|lag"

# SLOWLOG 확인
redis-cli SLOWLOG LEN
redis-cli SLOWLOG GET 5
```

### RESET STAT

```bash
# 통계 초기화 (유지보수 후)
DEBUG SLEEP 0         # 1ms sleep (연결 테스트)
CONFIG RESETSTAT      # 통계 초기화 (keyspace_hits 등)
SLOWLOG RESET
LATENCY RESET
```

### 키 분포 분석

```bash
# 네임스페이스별 키 수 분석
redis-cli --no-auth-warning -a pass \
  --scan --pattern "*" | \
  awk -F: '{print $1":"$2}' | \
  sort | uniq -c | sort -rn | head -20

# 타입별 분포
for type in string list set zset hash; do
  count=$(redis-cli --scan --pattern "*" | \
    xargs -L 1 redis-cli TYPE | \
    grep -c "^$type$")
  echo "$type: $count"
done
```

---

## DEBUG 명령어 (개발/테스트용)

```bash
# 슬립 (연결 테스트용)
DEBUG SLEEP 0

# 임의 크래시 (테스트용)
# DEBUG SEGFAULT  # 절대 프로덕션에서 사용 금지!

# 키 만료 즉시 처리
DEBUG SET-ACTIVE-EXPIRE 1

# 객체 정보
DEBUG OBJECT user:1001

# 리로드 (RDB 저장 후 재로드)
DEBUG RELOAD

# 특정 key의 reference count
OBJECT REFCOUNT user:1001
OBJECT ENCODING user:1001
OBJECT IDLETIME user:1001
OBJECT FREQ user:1001   # LFU 정책 시
```

---

## 유지보수 모드

```bash
# 쓰기 차단 (읽기 전용 모드)
CONFIG SET replica-read-only yes   # 레플리카를 읽기 전용으로

# 클라이언트 연결 일시 중지 (배포 시)
CLIENT PAUSE 5000   # 5초간 일반 명령어 처리 중지
CLIENT PAUSE 10000 WRITE  # 쓰기만 중지 (7.0+)

# 클러스터 노드 접근 금지
CLUSTER FAILOVER    # 마스터 교체

# 연결 수 임시 제한
CONFIG SET maxclients 10   # 점검 시 신규 연결 차단
```

---

## 정리

| 작업 | 명령어/방법 |
|------|-----------|
| 백업 | `BGSAVE` + 파일 복사 |
| 복구 | RDB 파일 교체 후 재시작 |
| AOF 복구 | `redis-check-aof --fix` |
| 키 이전 | `MIGRATE` or `redis-cli --pipe` |
| 무중단 업그레이드 | Replica 롤링 + Sentinel FAILOVER |
| 통계 초기화 | `CONFIG RESETSTAT` |
| 일시 중지 | `CLIENT PAUSE` |

- **정기 백업**: cron으로 `BGSAVE` + 파일 복사 자동화
- **복제 우선**: 마이그레이션은 레플리카 통해 무중단으로
- **AOF + RDB**: 중요 데이터는 두 영속성 모두 활성화
- **redis-check-aof**: AOF 손상 시 자동 복구 도구 활용
