---
title: "캐시 히트/미스의 종류와 분석"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "cache", "cache-miss", "cold-miss", "conflict-miss", "capacity-miss", "csapp"]
---

## 캐시 미스의 종류 (3C 모델)

캐시 미스는 원인에 따라 3가지로 분류합니다: **Cold Miss, Capacity Miss, Conflict Miss** (3C 또는 4C).

---

## 1. Cold Miss (강제 미스, Compulsory Miss)

**처음으로 접근하는 데이터는 반드시 미스가 발생합니다.**

```c
// 처음 실행 시: arr[0]~arr[N-1] 모두 캐시에 없음
// → N/16개의 Cold Miss (64바이트 캐시라인 = int 16개)
for (int i = 0; i < N; i++) {
    sum += arr[i];
}

// 두 번째 실행: 배열이 캐시에 있으면 히트!
for (int i = 0; i < N; i++) {
    sum += arr[i];  // (배열이 캐시에 맞는 경우) 모두 히트
}
```

특징:
```
- 어떤 캐시도 피할 수 없음 (어차피 처음엔 없음)
- 캐시라인이 클수록 Cold Miss 수 감소 (한 번에 더 많이 로드)
- 프리패칭(Prefetching)으로 영향 줄일 수 있음
```

---

## 2. Capacity Miss (용량 미스)

**캐시 크기가 작아서 자주 사용하는 데이터를 모두 담을 수 없을 때 발생합니다.**

```c
// 가정: L1 캐시 = 32KB
// arr 크기 = 1MB → L1에 다 들어가지 않음

for (int i = 0; i < N; i++) {
    // arr[0]이 캐시에서 밀려나기 전에 arr[N-1]에 도달
    sum += arr[i];
}

// 두 번째 패스:
for (int i = 0; i < N; i++) {
    // arr[0]은 이미 캐시에서 밀려남 → MISS!
    sum += arr[i];
}
```

해결 방법:
```
1. 알고리즘 재구성: 작업 집합(Working Set)을 캐시에 맞게 분할
   → 블록화(Tiling) 기법

2. 상위 캐시 활용: L2/L3에 맞는 크기로 분할

3. 데이터 크기 축소: int32 → int16, float → half-float
```

---

## 3. Conflict Miss (충돌 미스)

**충분한 캐시 용량이 있음에도 같은 세트로 매핑되는 데이터가 많아 발생합니다.**

```c
// 가정: 직접 매핑 캐시, 4세트, 블록 4B
// arr1[0]과 arr2[0]이 같은 세트로 매핑된다고 가정

for (int i = 0; i < N; i++) {
    result[i] = arr1[i] + arr2[i];
}

// 매 반복:
// arr1[i] 로드 → 세트0에 저장
// arr2[i] 로드 → 세트0에 저장 (arr1[i] 교체!)
// result[i] 저장 → 세트0에 저장 (arr2[i] 교체!)
// → 히트율 0%, 용량은 충분한데도!

// 해결: 연관도 높이기 (N-way), 또는 배열 패딩
```

---

## 4. Coherence Miss (4번째 C, 일관성 미스)

멀티프로세서 시스템에서 **다른 프로세서가 데이터를 수정하여 캐시가 무효화**될 때 발생합니다.

```c
// Core 0: x를 쓰면 Core 1의 x 캐시라인이 무효화됨
// Core 1: x에 접근하면 미스 → 메모리에서 다시 로드

// 거짓 공유(False Sharing)가 대표적 예:
int counter[2];
// Core 0: counter[0]++  (counter[1]도 같은 캐시라인에 있음!)
// Core 1: counter[1]++  → Core 0의 캐시라인 무효화 → 미스!
```

---

## 5. 히트율과 AMAT (Average Memory Access Time)

### 5.1 AMAT 공식

```
AMAT = 히트 시간 + 미스율 × 미스 패널티

예:
L1 히트 시간: 4사이클
L1 미스율:    5%
L2 히트 시간: 12사이클
L2 미스율:    2%
DRAM 접근:    200사이클

AMAT = 4 + 0.05 × (12 + 0.02 × 200)
     = 4 + 0.05 × (12 + 4)
     = 4 + 0.05 × 16
     = 4 + 0.8 = 4.8사이클
```

### 5.2 히트율의 중요성

```
히트율이 1% 차이나도 성능이 크게 달라집니다:

AMAT 계산 (L1 히트=4사이클, 미스 패널티=200사이클):
히트율 99%: 4 + 0.01 × 200 = 4 + 2 = 6사이클
히트율 95%: 4 + 0.05 × 200 = 4 + 10 = 14사이클
히트율 90%: 4 + 0.10 × 200 = 4 + 20 = 24사이클

99% vs 90%: 4배 차이!
```

---

## 6. 미스 분석 도구

```bash
# perf: 실측 캐시 미스
perf stat -e cache-references,cache-misses,L1-dcache-misses,LLC-load-misses ./program

# 예시 출력:
     10,234,567      cache-references
        512,345      cache-misses              #    5.00% of all cache refs
      1,234,567      L1-dcache-misses
         56,789      LLC-load-misses           # DRAM 접근 횟수

# Valgrind Cachegrind: 시뮬레이션 기반 상세 분석
valgrind --tool=cachegrind ./program
cg_annotate cachegrind.out.<pid>
```

---

## 7. 미스 최소화 전략

```
Cold Miss 최소화:
- 프리패칭: __builtin_prefetch()로 미리 로드
- 큰 캐시라인: 하드웨어 설정 (변경 불가), 순차 접근으로 활용

Capacity Miss 최소화:
- 루프 블록화(Tiling): 캐시에 맞는 크기로 분할
- 데이터 압축: 작은 데이터 타입 사용
- 핫/콜드 분리: 자주 쓰는 데이터를 작은 구조체로

Conflict Miss 최소화:
- 높은 연관도 캐시 선호 (구현 불가, 하드웨어 결정)
- 배열 크기 2의 거듭제곱 피하기
- 배열 패딩으로 충돌 분산

Coherence Miss 최소화:
- 거짓 공유 제거: 캐시라인 패딩 (64바이트 정렬)
- 읽기 전용 데이터 공유 vs 쓰기 데이터 분리
```

---

## 핵심 요약

- **Cold Miss**: 최초 접근 시 불가피한 미스. 프리패칭으로 영향 최소화.
- **Capacity Miss**: 캐시가 작아서 발생. 블록화(Tiling)로 작업 집합을 캐시에 맞게 분할.
- **Conflict Miss**: 같은 세트로 충돌. 배열 패딩, 높은 연관도 캐시로 해결.
- **Coherence Miss**: 멀티코어에서 캐시 무효화. 거짓 공유 패딩으로 해결.
- **AMAT**: 히트 시간 + 미스율 × 미스 패널티. 히트율 1% 차이도 성능 수배 영향.
