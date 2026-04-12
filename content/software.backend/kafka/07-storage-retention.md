---
title: "[Kafka] 7. 스토리지 & 보존 — 세그먼트, 보존 정책, Log Compaction"
author: oscar.rs
date: 2026-03-23
tags: ["kafka", "storage", "retention", "log-compaction", "세그먼트", "보존정책"]
---

# 스토리지 & 보존 — 세그먼트, 보존 정책, Log Compaction

## 파티션 로그 구조

Kafka의 각 파티션은 디스크의 디렉터리에 저장.

```
/var/kafka/data/
  orders-0/          ← Topic "orders", Partition 0
    00000000000000000000.log        ← 메시지 데이터
    00000000000000000000.index      ← 오프셋 인덱스
    00000000000000000000.timeindex  ← 타임스탬프 인덱스
    00000000000001048576.log        ← 두 번째 세그먼트
    00000000000001048576.index
    ...
  orders-1/
  orders-2/
```

파일명 = 해당 세그먼트의 **시작 오프셋** (20자리 0 패딩).

---

## 세그먼트 (Segment)

### 세그먼트 구성

```
.log 파일: 실제 메시지 데이터 (순차 기록)
  [offset][timestamp][key-size][value-size][key][value]
  [offset][timestamp][key-size][value-size][key][value]
  ...

.index 파일: 오프셋 → .log 파일 내 바이트 위치 (희소 인덱스)
  offset=0   → position=0
  offset=100 → position=4567
  offset=200 → position=9012
  ...

.timeindex 파일: 타임스탬프 → 오프셋
  timestamp=1700000000000 → offset=100
  ...
```

### 세그먼트 롤링 (새 세그먼트 생성)

```
log.segment.bytes = 1073741824 (1GB, 기본)
  → 세그먼트 파일이 1GB 초과 시 새 세그먼트 생성

log.roll.ms = 604800000 (7일, 기본)
  → 마지막 롤링으로부터 7일 경과 시 새 세그먼트 생성
```

### Active Segment

- 현재 쓰기가 진행 중인 마지막 세그먼트
- Active Segment는 보존 정책 삭제 대상에서 제외
- 닫힌 세그먼트(Closed Segment)만 삭제/압축 대상

---

## 보존 정책 (Retention Policy)

### 시간 기반 보존 (delete + time)

```
log.retention.ms = 604800000  (7일, 기본)
log.retention.hours = 168     (7일, 같은 의미)
log.retention.minutes = 10080 (7일, 같은 의미)
```

```
현재 시각: 2024-01-10 12:00
보존 기간: 7일

세그먼트의 마지막 메시지 타임스탬프가 2024-01-03 이전 → 삭제 대상
```

### 크기 기반 보존 (delete + size)

```
log.retention.bytes = -1  (기본, 제한 없음)
log.retention.bytes = 107374182400  (100GB로 제한)
```

파티션 단위 크기 제한. 총 토픽 크기 = retention.bytes × 파티션 수.

### 삭제 주기

```
log.retention.check.interval.ms = 300000 (5분마다 체크)

Log Cleaner 스레드가 주기적으로 보존 정책 초과 세그먼트 삭제
```

### 토픽별 설정 재정의

```bash
# 토픽 생성 시
kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic audit-logs \
  --config retention.ms=2592000000 \  # 30일
  --config retention.bytes=10737418240  # 10GB

# 기존 토픽 설정 변경
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --entity-type topics --entity-name audit-logs \
  --add-config retention.ms=2592000000
```

---

## Log Compaction

### 언제 사용?

**delete** 보존: 오래된 메시지 전체 삭제 → 이벤트 스트리밍에 적합

**compact** 보존: 같은 키의 최신 값만 보존 → 상태 스냅샷에 적합

```
사용 사례:
  - 사용자 프로필 최신 상태
  - 장치 마지막 위치
  - 설정 변경 이력 (최신값만)
  - DB 변경 이벤트 (CDC)
```

### Compaction 동작

```
Before Compaction:
offset: 0    1    2    3    4    5    6    7
key:    A    B    A    C    B    A    D    C
value:  v1   v1   v2   v1   v2   v3   v1   v2

After Compaction (같은 키의 최신 값만 보존):
offset: 5    6    7
key:    A    D    C
value:  v3   v1   v2

→ B의 최신값(offset=4)도 보존됨:
offset: 4    5    6    7
key:    B    A    D    C
value:  v2   v3   v1   v2
```

### Tombstone (삭제 마커)

```
key=A, value=null  → Tombstone 레코드

Compaction 후 Tombstone 보존 (삭제 전파)
일정 시간(delete.retention.ms) 후 Tombstone도 삭제
→ 다운스트림 소비자가 삭제 이벤트를 놓치지 않도록 충분한 시간 설정
```

```bash
delete.retention.ms = 86400000  (24시간, 기본)
```

### Compaction 내부 구조

```
파티션 로그:
  ┌─────────────┬─────────────┐
  │ Clean Head  │ Dirty Tail  │
  │ (이미 정리됨) │ (정리 대상)  │
  └─────────────┴─────────────┘

Log Cleaner 스레드:
  1. Dirty Tail에서 키 → 최신 오프셋 매핑 생성 (offset map)
  2. Clean Head + Dirty Tail 중 최신 오프셋이 아닌 레코드 제거
  3. 정리된 세그먼트를 새 파일로 복사
```

### Compaction 설정

```properties
# 토픽 레벨
log.cleanup.policy=compact

# delete + compact 동시 사용 (일정 기간 후 오래된 레코드 삭제, 남은 것은 compact)
log.cleanup.policy=compact,delete
log.retention.ms=604800000  # 7일 이상 된 레코드 삭제

# Compaction 트리거
min.cleanable.dirty.ratio=0.5  # Dirty 비율이 50% 이상이면 Compaction 실행
log.compaction.interval.ms=300000  # 5분마다 체크
```

---

## 인덱스 구조와 랜덤 접근

Kafka는 로그 파일에서 특정 오프셋을 O(log n)으로 탐색.

```
.index 파일: 희소 인덱스 (모든 오프셋이 아닌 일부만 기록)

오프셋 1500을 찾고 싶다면:
  1. .index에서 이진 탐색: offset=1400 → position=50000
  2. .log에서 position=50000부터 순차 탐색: offset 1400 → 1500
  3. 발견!

index.interval.bytes = 4096 (기본)
  → 4KB마다 인덱스 엔트리 추가
```

---

## 스토리지 모범 사례

```
파티션 크기 권장:
  파티션 하나의 크기: 수 GB ~ 수십 GB
  너무 크면 → 복구 시간 증가, 컴팩션 느려짐
  너무 작으면 → 파일 수 폭발

디스크 설정:
  RAID-0 또는 JBOD (Kafka 자체 복제가 있으므로 RAID 불필요)
  SSD 권장 (특히 고처리량 환경)
  log.dirs에 여러 디스크 경로 지정 → 병렬 I/O

log.dirs=/data1/kafka,/data2/kafka,/data3/kafka
```

---

## 정리

- **Segment**: 파티션 로그의 물리적 단위, Active Segment는 삭제 불가
- **delete 보존**: 시간(`retention.ms`) 또는 크기(`retention.bytes`) 기준 오래된 세그먼트 삭제
- **compact 보존**: 같은 키의 최신 값만 보존, Tombstone으로 삭제 전파
- **compact+delete**: 기간 지난 것은 삭제, 나머지는 압축 — 이벤트 소싱/CDC에 유용
- **인덱스**: 희소 인덱스로 O(log n) 오프셋 탐색
