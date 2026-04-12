---
title: "프로파일링(Profiling): 성능 병목 찾기"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "profiling", "perf", "gprof", "optimization", "csapp"]
---

## 프로파일링 (Profiling)

**"추측하지 말고 측정하라"** — 최적화의 황금률입니다. 프로파일링은 프로그램의 어느 부분이 시간을 가장 많이 쓰는지 **실측**하는 과정입니다.

암달의 법칙을 기억하세요: 전체 시간의 1%를 차지하는 함수를 10배 빠르게 해도 전체 성능은 0.9% 향상에 불과합니다.

---

## 1. 프로파일링 도구 종류

| 도구 | 방식 | 특징 |
|------|------|------|
| `gprof` | 계측(Instrumentation) | 함수 호출 횟수, 실행 시간 |
| `perf` | 샘플링(Sampling) | CPU 하드웨어 카운터 활용 |
| `Valgrind/Cachegrind` | 시뮬레이션 | 캐시 미스 상세 분석 |
| `gperftools` | 샘플링 | Google 제작, 낮은 오버헤드 |
| `VTune` | 하드웨어 카운터 | Intel, 가장 상세한 분석 |

---

## 2. gprof 사용법

### 2.1 기본 사용법

```bash
# 1. 계측 포함하여 컴파일
gcc -O2 -pg -o program source.c

# 2. 프로그램 실행 (gmon.out 생성)
./program input_data

# 3. 프로파일 분석
gprof program gmon.out > analysis.txt
cat analysis.txt
```

### 2.2 gprof 출력 해석

```
Flat profile:

Each sample counts as 0.01 seconds.
  %   cumulative   self              self     total
 time   seconds   seconds    calls  ms/call  ms/call  name
 72.45      3.62      3.62        1  3620.00  3620.00  compute_matrix
 15.23      4.38      0.76   100000     0.01     0.01  inner_loop
  8.12      4.79      0.41        1   410.00   410.00  sort_data
  4.20      5.00      0.21    50000     0.00     0.00  hash_lookup
```

핵심 지표:
- `% time`: 전체 시간 중 이 함수가 차지하는 비율
- `self seconds`: 이 함수 자체 실행 시간
- `calls`: 호출 횟수
- **`compute_matrix`가 72%** → 여기를 먼저 최적화!

---

## 3. perf 사용법 (Linux)

`perf`는 Linux 커널에 내장된 프로파일러로, 하드웨어 성능 카운터를 활용합니다.

### 3.1 stat: 전체 통계

```bash
perf stat ./program

# 출력:
 Performance counter stats for './program':

     10,234.56 msec task-clock                #    1.000 CPUs utilized
             0      context-switches          #    0.000 /sec
             0      cpu-migrations            #    0.000 /sec
         1,234      page-faults               #  120.687 /sec
27,634,521,098      cycles                    #    2.700 GHz
18,291,045,231      instructions              #    0.66  insn per cycle  ← IPC!
 4,521,234,100      branches                  #  441.763 M/sec
    45,212,341      branch-misses             #    1.00% of all branches
 3,456,789,012      cache-misses              #   45.23% of all cache refs ← 높다!
```

IPC가 낮거나 cache-miss 비율이 높으면 최적화 대상입니다.

### 3.2 record + report: 함수별 분석

```bash
# 샘플링 데이터 수집
perf record -g ./program

# 함수별 비용 보고
perf report
# 또는 TUI로
perf report --stdio
```

### 3.3 특정 이벤트 모니터링

```bash
# L1/L2/LLC 캐시 미스
perf stat -e cache-references,cache-misses,L1-dcache-misses,LLC-load-misses ./program

# 분기 예측 실패
perf stat -e branch-instructions,branch-misses ./program

# TLB 미스
perf stat -e dTLB-loads,dTLB-load-misses ./program
```

---

## 4. Cachegrind: 캐시 시뮬레이션

```bash
# Valgrind의 캐시 분석 툴
valgrind --tool=cachegrind --branch-sim=yes ./program

# 결과 파일 분석
cg_annotate cachegrind.out.<pid> source.c

# 출력 예:
  Dr   D1mr DLmr   Dw   D1mw DLmw
-------------------------------------------
 총 메모리 읽기: 1,234,567  D1 미스: 123,456  LLC 미스: 12,345
```

줄별 분석:
```
      Ir  I1mr ILmr   Dr  D1mr DLmr
       1     0    0    0     0    0  void process(int *arr, int n) {
      45     0    0    0     0    0      int i;
  100000     0    0    0     0    0      for (i = 0; i < n; i++) {
  100000     1    0  100000  12000  1200      arr[i] = arr[i] * 2;  ← 캐시 미스 많음!
```

---

## 5. 마이크로 벤치마크 주의사항

```c
// 잘못된 벤치마크: 컴파일러가 최적화로 제거할 수 있음
clock_t start = clock();
for (int i = 0; i < 1000000; i++) {
    result = heavy_compute(i);  // result가 쓰이지 않으면 컴파일러가 제거!
}
clock_t end = clock();

// 올바른 벤치마크: 결과가 실제로 사용됨을 보장
volatile int sink;
for (int i = 0; i < 1000000; i++) {
    sink = heavy_compute(i);  // volatile: 최적화 방지
}
```

Google Benchmark 라이브러리:
```cpp
#include <benchmark/benchmark.h>

static void BM_MyFunction(benchmark::State& state) {
    std::vector<int> data(state.range(0));
    for (auto _ : state) {
        benchmark::DoNotOptimize(compute(data));  // 최적화 방지
    }
}
BENCHMARK(BM_MyFunction)->Range(8, 8<<10);  // 8 ~ 8192
BENCHMARK_MAIN();
```

---

## 6. 최적화 워크플로우

```
1. 정확성 확인 (먼저 동작하게!)
      ↓
2. 프로파일링 → 핫스팟 20% 찾기 (파레토 원칙: 20%가 80% 시간 차지)
      ↓
3. 알고리즘 복잡도 최적화 (O(n²)→O(n log n))
      ↓
4. 캐시 친화적 코드 (메모리 접근 패턴)
      ↓
5. 컴파일러 최적화 유도 (restrict, const, inline)
      ↓
6. SIMD/언롤링 (마이크로 최적화)
      ↓
7. 다시 프로파일링 → 검증
```

---

## 핵심 요약

- **측정 먼저**: 추측으로 최적화하지 말고 프로파일링으로 핫스팟을 찾아라.
- **gprof**: 함수 호출 비용 측정. `-pg` 플래그 + `gmon.out` 분석.
- **perf**: Linux 하드웨어 카운터. IPC, 캐시 미스율, 분기 예측 실패율 등 상세 정보.
- **Cachegrind**: 소스 코드 줄 단위 캐시 미스 분석.
- **마이크로 벤치마크 함정**: `volatile`과 `DoNotOptimize`로 컴파일러 최적화 방지.
- **파레토 원칙**: 코드의 20%가 실행 시간의 80%를 차지. 거기에 집중.
