---
title: "메모리 접근 패턴과 캐시 친화적 코드"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "cache", "memory-access", "locality", "csapp"]
---

## 메모리 접근 패턴

코드의 알고리즘 복잡도가 같아도 **메모리 접근 패턴**에 따라 성능이 수십 배 차이날 수 있습니다. 현대 CPU에서 L1 캐시 히트는 4사이클, DRAM 접근은 200사이클이 걸리기 때문입니다.

---

## 1. 행 우선 vs 열 우선: 행렬 순회

### 1.1 C의 행 우선 저장 (Row-major)

```c
int matrix[4][4];
// 메모리 레이아웃:
// [0][0] [0][1] [0][2] [0][3] | [1][0] [1][1] ...
// ← 연속 메모리 →
```

### 1.2 행 우선 순회 (캐시 친화적)

```c
// 행 우선 순회: 순차적 메모리 접근
void row_major(int matrix[N][N]) {
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            matrix[i][j] *= 2;  // 연속 메모리 → 캐시 히트!
        }
    }
}
```

캐시 동작:
```
접근: [0][0], [0][1], [0][2], [0][3] → 캐시라인 1개 로드로 4개 처리
접근: [1][0], [1][1], [1][2], [1][3] → 다음 캐시라인 로드
→ 캐시 미스율: ~1/16 (캐시라인 64B = int16개)
```

### 1.3 열 우선 순회 (캐시 비친화적)

```c
// 열 우선 순회: 비연속 메모리 접근 → 캐시 미스 폭발!
void col_major(int matrix[N][N]) {
    for (int j = 0; j < N; j++) {
        for (int i = 0; i < N; i++) {
            matrix[i][j] *= 2;  // 스트라이드 N×4바이트 → 캐시 미스!
        }
    }
}
```

캐시 동작:
```
접근: [0][0], [1][0], [2][0], [3][0] → 각각 다른 캐시라인!
→ 캐시 미스율: ~1 (매 접근마다 미스)
```

실측 성능 (N=1024):
```
row_major: 2ms    (캐시 히트율 높음)
col_major: 40ms   (20× 느림! 캐시 미스)
```

---

## 2. 행렬 곱셈 최적화

### 2.1 단순 구현 (ijk 순서)

```c
// 표준 행렬 곱: C = A × B
void matmul_ijk(double A[N][N], double B[N][N], double C[N][N]) {
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            for (int k = 0; k < N; k++) {
                C[i][j] += A[i][k] * B[k][j];  // B[k][j]: 열 접근!
            }
        }
    }
}
// B 행렬이 열 우선 접근 → 캐시 미스 폭발
```

### 2.2 순서 변경 (ikj 순서)

```c
// B를 행 우선으로 접근하는 순서로 변경
void matmul_ikj(double A[N][N], double B[N][N], double C[N][N]) {
    for (int i = 0; i < N; i++) {
        for (int k = 0; k < N; k++) {
            double a_ik = A[i][k];
            for (int j = 0; j < N; j++) {
                C[i][j] += a_ik * B[k][j];  // B[k][j]: 행 접근! 캐시 친화적
            }
        }
    }
}
// B를 행 방향으로 접근 → 캐시 히트 증가
```

### 2.3 블록(Tiling) 기법

```c
#define BLOCK 32  // 캐시 크기에 맞는 블록

void matmul_blocked(double A[N][N], double B[N][N], double C[N][N]) {
    for (int ii = 0; ii < N; ii += BLOCK) {
        for (int jj = 0; jj < N; jj += BLOCK) {
            for (int kk = 0; kk < N; kk += BLOCK) {
                // BLOCK×BLOCK 블록 처리
                for (int i = ii; i < min(ii+BLOCK, N); i++) {
                    for (int j = jj; j < min(jj+BLOCK, N); j++) {
                        double sum = 0.0;
                        for (int k = kk; k < min(kk+BLOCK, N); k++) {
                            sum += A[i][k] * B[k][j];
                        }
                        C[i][j] += sum;
                    }
                }
            }
        }
    }
}
```

블록 크기 선택:
```
목표: 3개 블록(A, B, C)이 L1/L2 캐시에 들어가야 함
L1 캐시 32KB: 32KB / (3 × sizeof(double)) ≈ 1365 원소
→ 블록 크기 ≈ √1365 ≈ 37 → BLOCK = 32 (2의 거듭제곱)

성능 비교 (N=1024):
ijk:     5.2초 (캐시 미스 폭발)
ikj:     1.8초 (행 접근)
blocked: 0.5초 (10× 향상, 캐시 완전 활용)
```

---

## 3. 구조체 레이아웃: AoS vs SoA

### 3.1 AoS (Array of Structures) — 일반적

```c
// AoS: 구조체 배열
struct Particle {
    float x, y, z;  // 위치
    float vx, vy, vz;  // 속도
    float mass;
};

struct Particle particles[N];

// x만 업데이트할 때:
for (int i = 0; i < N; i++) {
    particles[i].x += particles[i].vx * dt;  // stride = sizeof(Particle) = 28
    // vx, y, vy, z, vz, mass를 같은 캐시라인에서 로드하지만 사용 안 함 → 낭비!
}
```

### 3.2 SoA (Structure of Arrays) — SIMD에 최적화

```c
// SoA: 각 필드를 별도 배열로
struct Particles {
    float x[N], y[N], z[N];
    float vx[N], vy[N], vz[N];
    float mass[N];
};

struct Particles particles;

// x만 업데이트:
for (int i = 0; i < N; i++) {
    particles.x[i] += particles.vx[i] * dt;
    // x 배열 연속 접근 → 캐시 히트!
    // SIMD로 8개씩 처리 가능!
}
```

성능 비교:
```
AoS (위치 업데이트만): 1.0× (기준)
SoA (위치 업데이트만): 3~5× 빠름 (캐시 효율 + SIMD)

AoS (모든 필드 사용): 비슷하거나 AoS가 유리 (한 번에 로드)
→ 접근 패턴에 따라 선택!
```

---

## 4. 프리패칭 (Prefetching)

```c
// 하드웨어 프리패처: 순차/스트라이드 패턴 자동 감지
// 불규칙 패턴은 소프트웨어 프리패치 사용

void process_with_prefetch(int *arr, int n) {
    for (int i = 0; i < n; i++) {
        __builtin_prefetch(&arr[i + 16], 0, 1);  // 16원소 ahead 프리패치
        // 0: 읽기, 1: L2 캐시에 유지
        process(arr[i]);
    }
}
```

프리패치 파라미터:
```c
__builtin_prefetch(addr, rw, locality)
// rw: 0=읽기, 1=쓰기
// locality: 0=사용후 캐시 제거, 1=L2유지, 2=L2유지, 3=L1유지
```

---

## 5. 거짓 공유 (False Sharing)

멀티스레드 환경에서 다른 데이터가 같은 캐시라인에 있을 때 발생합니다.

```c
// 문제: counter[0]과 counter[1]이 같은 캐시라인 (64바이트 = 16 int)
int counter[2];

void thread0() { for(;;) counter[0]++; }  // Core 0
void thread1() { for(;;) counter[1]++; }  // Core 1
// 같은 캐시라인 공유 → 캐시 무효화 핑퐁 → 성능 대폭 하락!

// 해결: 패딩으로 캐시라인 분리
struct PaddedCounter {
    int value;
    char pad[60];  // 64바이트 정렬
} counter[2];
// 각 counter가 별도 캐시라인 → 거짓 공유 없음
```

---

## 핵심 요약

- **행 우선 순회**: C 행렬은 행 우선 저장 → 열 순회는 20× 느릴 수 있음.
- **블록화(Tiling)**: 행렬 연산을 캐시 크기에 맞는 블록으로 분할 → 10× 향상.
- **SoA vs AoS**: SIMD와 특정 필드만 접근 시 SoA가 유리. 모든 필드 사용 시 AoS가 유리.
- **프리패칭**: 불규칙 메모리 접근 시 `__builtin_prefetch`로 데이터를 미리 로드.
- **거짓 공유**: 멀티스레드에서 다른 데이터가 같은 캐시라인 공유 → 패딩으로 분리.
