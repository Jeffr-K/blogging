---
title: "대량 메모리 할당과 Page Fault 최소화 전략"
date: 2026-04-13
tags: [os, page-fault, virtual-memory, mmap, hugepage, memory]
---

## 가상 메모리와 Page Fault 복습

OS는 모든 프로세스에게 **가상 주소 공간**을 제공합니다. 프로세스가 보는 주소(`0x7fff...`)는 가상 주소이고, 실제 물리 메모리 위치는 **페이지 테이블**이 매핑합니다.

```
가상 주소 0x7fff0000  →  페이지 테이블  →  물리 주소 0x2a3f0000
가상 주소 0x7fff1000  →  페이지 테이블  →  [아직 물리 메모리 없음!]
```

### Page Fault 발생 순서

```
1. 프로세스가 가상 주소 접근
2. TLB(Translation Lookaside Buffer) 확인 → 미스
3. 페이지 테이블 확인
   → 물리 페이지 있음: TLB에 올리고 접근 (Minor Fault)
   → 물리 페이지 없음: OS가 개입 (Major Fault)
4. OS: 물리 메모리 할당 → 페이지 테이블 업데이트
5. 프로세스 재실행

비용:
  TLB 히트:     ~1 사이클
  Minor Fault:  ~수백 사이클 (물리 메모리는 있음)
  Major Fault:  ~수십만 사이클 (디스크까지 다녀옴)
```

---

## 문제: 대량 메모리 할당의 함정

```javascript
// Node.js 예시
const buf = Buffer.allocUnsafe(1024 * 1024 * 1024); // 1GB 할당
// 이 순간: 가상 주소 1GB만 예약, 물리 메모리는 아직 0

buf[0] = 1;           // Page Fault #1: OS가 4KB 물리 메모리 할당
buf[4096] = 1;        // Page Fault #2: 또 다른 페이지
buf[8192] = 1;        // Page Fault #3: ...
// 총 256,000번의 Page Fault → 성능 급락
```

이것이 **Demand Paging**: 실제로 접근할 때 비로소 물리 메모리를 할당합니다.

---

## 전략 1: mmap과 Prefault (Linux)

`MAP_POPULATE` 플래그로 할당 시점에 미리 물리 메모리를 전부 채웁니다.

```c
// C (Linux)
// 기본 mmap: 접근 시마다 Page Fault
void* ptr = mmap(NULL, size, PROT_READ | PROT_WRITE,
                 MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);

// MAP_POPULATE: 할당 시 물리 메모리 미리 확보 → 이후 Page Fault 없음
void* ptr = mmap(NULL, size, PROT_READ | PROT_WRITE,
                 MAP_PRIVATE | MAP_ANONYMOUS | MAP_POPULATE, -1, 0);
```

```javascript
// Node.js에서는 직접 제어 불가
// 대신 Buffer.alloc()가 내부적으로 zero-fill하면서 prefault 효과

// Buffer.allocUnsafe(): Page Fault 지연 (빠르게 할당, 접근 시 fault)
// Buffer.alloc():       할당 시 zero-fill → 즉시 물리 메모리 확보
const safe = Buffer.alloc(1024 * 1024 * 100);    // 100MB, 할당 느림 / 접근 빠름
const unsafe = Buffer.allocUnsafe(1024 * 1024 * 100); // 100MB, 할당 빠름 / 첫 접근 느림

// 용도:
// allocUnsafe + 즉시 전체 쓰기: 처음부터 전부 쓸 거라면 어차피 fault 발생
// alloc: 일부만 쓸 때, 또는 첫 접근 지연이 허용 안 될 때
```

---

## 전략 2: HugePage (Huge TLB)

일반 페이지는 4KB, Huge Page는 2MB(또는 1GB).

### 왜 Huge Page가 빠른가

```
일반 4KB 페이지로 1GB 배열:
  1GB / 4KB = 262,144개 페이지 = 262,144개 TLB 항목 필요
  TLB는 수백~수천 항목만 보유 → TLB 미스 빈번

2MB Huge Page로 1GB 배열:
  1GB / 2MB = 512개 페이지 = 512개 TLB 항목
  TLB 미스 512배 감소 → 대규모 배열 순회 속도 대폭 향상
```

```bash
# Linux: Transparent Huge Pages (THP) 확인
cat /sys/kernel/mm/transparent_hugepage/enabled
# [always] madvise never

# 항상 활성화 (Redis, JVM 등에서 성능 향상)
echo always > /sys/kernel/mm/transparent_hugepage/enabled

# 특정 영역만 Huge Page로 (madvise)
madvise(ptr, size, MADV_HUGEPAGE);
```

```c
// C: 명시적 Huge Page 사용
void* ptr = mmap(NULL, size, PROT_READ | PROT_WRITE,
                 MAP_PRIVATE | MAP_ANONYMOUS | MAP_HUGETLB, -1, 0);
```

### Redis와 HugePage

```bash
# redis.conf
# THP 비활성화 권장 (Redis는 fork() 기반 RDB 저장 사용)
# THP + fork + Copy-on-Write = 대규모 메모리 복사 → 오히려 느려질 수 있음
# Redis 공식 권장: THP 비활성화

echo never > /sys/kernel/mm/transparent_hugepage/enabled

# Redis 로그에서 경고 메시지:
# WARNING you have Transparent Huge Pages (THP) support enabled in your kernel.
# This will create latency and memory usage issues with Redis.
```

---

## 전략 3: 메모리 풀 (Memory Pool)

반복적으로 할당/해제하면 Page Fault가 누적됩니다. 미리 큰 블록을 할당해두고 직접 관리합니다.

```javascript
class MemoryPool {
  constructor(blockSize, blockCount) {
    this.blockSize = blockSize;
    this.blockCount = blockCount;
    // 한 번에 전체 할당 → Page Fault를 초기화 시점에 집중
    this.buffer = Buffer.alloc(blockSize * blockCount); // zero-fill = prefault
    this.freeList = Array.from({ length: blockCount }, (_, i) => i);
  }

  allocate() {
    if (this.freeList.length === 0) return null;
    const blockIndex = this.freeList.pop();
    const offset = blockIndex * this.blockSize;
    return { buffer: this.buffer, offset, blockIndex };
  }

  free(blockIndex) {
    this.freeList.push(blockIndex);
  }
}

// 사용: 1KB 블록 10만 개 풀
const pool = new MemoryPool(1024, 100000);

// 이후 할당은 Page Fault 없음 (이미 물리 메모리 확보됨)
const block = pool.allocate();
```

---

## 전략 4: madvise로 접근 패턴 힌트

OS에게 "이 메모리를 어떻게 쓸 예정"인지 힌트를 줍니다.

```c
// 순차 접근할 예정 → OS가 미리 읽음 (Prefetch)
madvise(ptr, size, MADV_SEQUENTIAL);

// 랜덤 접근 예정 → Prefetch 불필요, 페이지 교체 더 적극적으로
madvise(ptr, size, MADV_RANDOM);

// 곧 필요 없음 → OS가 물리 메모리 회수해도 됨
madvise(ptr, size, MADV_DONTNEED);

// 곧 접근할 예정 → 미리 로딩 요청
madvise(ptr, size, MADV_WILLNEED);
```

```javascript
// Node.js에서는 직접 madvise 호출 불가
// 하지만 동일한 효과를 코드 구조로 구현 가능

// 순차 접근 패턴 → OS가 자동으로 Prefetch 감지
function processSequential(buf) {
  for (let i = 0; i < buf.length; i++) {
    // 순차 → OS/하드웨어 Prefetcher가 다음 페이지 미리 로딩
    buf[i] = transform(buf[i]);
  }
}

// 랜덤 접근 → Prefetch 효과 없음, 피할 수 없다면 접근 패턴 재설계
function processRandom(buf, indices) {
  // 인덱스를 정렬하면 랜덤 → 순차에 가까워짐
  indices.sort((a, b) => a - b);
  for (const idx of indices) {
    buf[idx] = transform(buf[idx]);
  }
}
```

---

## 전략 5: NUMA(Non-Uniform Memory Access) 고려

멀티소켓 서버에서는 CPU와 메모리의 물리적 거리가 성능에 영향을 미칩니다.

```
NUMA 토폴로지 (2소켓 서버):

  CPU 0 (소켓 0) ←─── DRAM 0 (로컬, ~100ns)
       │
       └──── DRAM 1 (원격, ~200ns) ←─── CPU 1 (소켓 1)

같은 물리 메모리인데 어느 CPU에서 접근하느냐에 따라 2배 지연 차이
```

```bash
# NUMA 정보 확인
numactl --hardware

# Node.js 프로세스를 특정 NUMA 노드에 바인딩
numactl --cpunodebind=0 --membind=0 node server.js
# CPU 0번 소켓 + 메모리 0번 노드만 사용 → 원격 메모리 접근 없음
```

---

## 실전: Node.js 대용량 처리 패턴

```javascript
// 1GB 파일을 메모리에 올리고 처리하는 예시

// ❌ 나쁜 방법: 스트림 없이 한 번에 읽기
const data = fs.readFileSync("bigfile.bin"); // 1GB 한 번에 → 256,000 Page Fault
process(data);

// ✅ 좋은 방법 1: 청크 단위 처리 (Page Fault 분산)
const CHUNK_SIZE = 64 * 1024; // 64KB = 16 페이지
const stream = fs.createReadStream("bigfile.bin", { highWaterMark: CHUNK_SIZE });

stream.on("data", (chunk) => {
  // 64KB씩 처리 → Page Fault가 64KB마다 발생, 작업 중에 분산됨
  processChunk(chunk);
});

// ✅ 좋은 방법 2: 처음 접근 시 워밍
function prewarmBuffer(buf) {
  // 페이지 경계마다 한 번씩 읽기 → 모든 Page Fault를 지금 일으킴
  const PAGE_SIZE = 4096;
  for (let i = 0; i < buf.length; i += PAGE_SIZE) {
    buf[i]; // read touch
  }
  // 이후 실제 처리 시 Page Fault 없음
}

const buf = Buffer.allocUnsafe(1024 * 1024 * 1024);
prewarmBuffer(buf); // "콜드 스타트" 시점에 Page Fault 집중
// 이후 처리: Page Fault 없이 순수 계산만
```

---

## 계층별 최적화 요약

| 문제 | 원인 | 해결책 |
|------|------|--------|
| 첫 접근 느림 | Demand Paging | `MAP_POPULATE` / `Buffer.alloc()` |
| TLB 미스 빈번 | 4KB 소페이지 | Huge Page (2MB) |
| 반복 할당/해제 | Page Fault 누적 | 메모리 풀 (사전 할당) |
| 랜덤 접근 느림 | HW Prefetcher 무효 | 접근 패턴 정렬 |
| 원격 메모리 접근 | NUMA 토폴로지 | numactl 바인딩 |
| 스왑 사용 | 물리 메모리 부족 | `mlock()` / 메모리 증설 |

---

## 핵심 요약

- **Page Fault**: 가상 주소 접근 시 물리 페이지가 없으면 OS가 개입 (Major는 수십만 사이클 비용)
- **Demand Paging**: 접근 전까지는 물리 메모리 없음 → 대규모 할당 후 첫 순회가 느린 이유
- **Prefault**: `Buffer.alloc()` / `MAP_POPULATE`로 할당 시점에 Page Fault 집중
- **Huge Page**: TLB 항목 수를 최대 512배 줄임 → 대규모 배열 순회 성능 향상
- **메모리 풀**: 한 번에 큰 블록 할당 + 직접 관리 → 반복 할당 비용 제거
- Redis: THP 비활성화 권장 (fork + CoW와 충돌)
