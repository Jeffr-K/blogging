---
title: "SIMD와 벡터화(Vectorization) 최적화"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "simd", "vectorization", "avx", "sse", "csapp"]
---

## SIMD (Single Instruction, Multiple Data)

SIMD는 **하나의 명령어로 여러 데이터를 동시에 처리**하는 기법입니다. CPU에 탑재된 벡터 레지스터와 벡터 명령어를 활용하여, 루프를 통한 스칼라 연산 대신 한 번에 여러 원소를 처리합니다.

---

## 1. SIMD 레지스터 진화

```
SSE (1999, Pentium III):
  XMM 레지스터: 128비트 = float 4개 OR double 2개 OR int32 4개

AVX (2011, Sandy Bridge):
  YMM 레지스터: 256비트 = float 8개 OR double 4개 OR int32 8개

AVX-512 (2016, Skylake-X):
  ZMM 레지스터: 512비트 = float 16개 OR double 8개 OR int32 16개
```

이론적 처리량:
```
스칼라 float:  1개/사이클
SSE (128비트): 4개/사이클  (4× 향상)
AVX (256비트): 8개/사이클  (8× 향상)
AVX-512:      16개/사이클  (16× 향상)
```

---

## 2. 자동 벡터화 (Auto-Vectorization)

컴파일러가 스칼라 루프를 자동으로 SIMD 코드로 변환합니다.

```c
// 스칼라 루프 → 컴파일러가 자동으로 SIMD로 변환
void add_arrays(float *a, float *b, float *c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}
```

```bash
gcc -O2 -mavx2 -S add_arrays.c
```

생성된 어셈블리:
```asm
; AVX2 자동 벡터화 결과
vmovups (%rsi,%rax,4), %ymm0    ; 8개 float 로드 (a[i..i+7])
vmovups (%rdx,%rax,4), %ymm1    ; 8개 float 로드 (b[i..i+7])
vaddps  %ymm1, %ymm0, %ymm2     ; 8개 float 동시 덧셈
vmovups %ymm2, (%rcx,%rax,4)    ; 8개 float 저장 (c[i..i+7])
add     $8, %rax                ; i += 8
```

---

## 3. 자동 벡터화 방해 요소

### 3.1 메모리 앨리어싱

```c
// 컴파일러가 벡터화 거부: a, b, c가 겹칠 수 있음
void add(float *a, float *b, float *c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];  // c가 a나 b와 겹치면?
    }
}

// restrict로 해결: 앨리어싱 없음 보장
void add(float * restrict a, float * restrict b,
         float * restrict c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];  // 벡터화 가능!
    }
}
```

### 3.2 메모리 정렬 문제

```c
// 비정렬 접근: 벡터화 불가 또는 성능 저하
float arr[17];          // 17개 원소
float *p = &arr[1];     // 4바이트 오프셋 → 32바이트 비정렬

// 정렬된 메모리 할당
float *aligned_arr = (float *)aligned_alloc(32, n * sizeof(float));
// 또는 posix_memalign(&aligned_arr, 32, n * sizeof(float));
```

### 3.3 조건문 (데이터 의존 분기)

```c
// 벡터화 어려움: 조건에 따라 다른 연산
for (int i = 0; i < n; i++) {
    if (a[i] > 0) c[i] = a[i] + b[i];
    else          c[i] = a[i] - b[i];
}

// 벡터화 가능 버전: 마스킹 사용
for (int i = 0; i < n; i++) {
    float mask = (a[i] > 0) ? 1.0f : -1.0f;
    c[i] = a[i] + mask * b[i];  // 분기 없음
}
```

### 3.4 루프 캐리 의존성

```c
// 벡터화 불가: 이전 결과에 의존
for (int i = 1; i < n; i++) {
    arr[i] = arr[i-1] + 1;  // arr[i]가 arr[i-1]에 의존
}

// 벡터화 가능: 각 원소가 독립
for (int i = 0; i < n; i++) {
    arr[i] = arr[i] * 2;  // 독립적
}
```

---

## 4. 인트린식 (Intrinsics)으로 수동 SIMD

자동 벡터화가 충분하지 않을 때 직접 SIMD 명령어를 사용합니다.

```c
#include <immintrin.h>  // AVX/AVX2 인트린식

// AVX2: 8개 float 덧셈
void add_avx2(float *a, float *b, float *c, int n) {
    int i;
    for (i = 0; i <= n - 8; i += 8) {
        __m256 va = _mm256_loadu_ps(&a[i]);   // 8개 float 로드
        __m256 vb = _mm256_loadu_ps(&b[i]);
        __m256 vc = _mm256_add_ps(va, vb);    // 8개 동시 덧셈
        _mm256_storeu_ps(&c[i], vc);          // 8개 float 저장
    }
    // 나머지 스칼라 처리
    for (; i < n; i++) c[i] = a[i] + b[i];
}
```

### 주요 인트린식 타입

| 타입 | 크기 | 용도 |
|------|------|------|
| `__m128` | 128비트 | float×4 (SSE) |
| `__m128d` | 128비트 | double×2 (SSE2) |
| `__m128i` | 128비트 | 정수 (SSE4) |
| `__m256` | 256비트 | float×8 (AVX) |
| `__m256d` | 256비트 | double×4 (AVX) |
| `__m256i` | 256비트 | 정수 (AVX2) |

---

## 5. 실전 예제: 점곱(Dot Product)

```c
// 스칼라 버전
float dot_scalar(float *a, float *b, int n) {
    float sum = 0.0f;
    for (int i = 0; i < n; i++) sum += a[i] * b[i];
    return sum;
}

// AVX2 버전 (8개씩 처리)
float dot_avx2(float *a, float *b, int n) {
    __m256 vsum = _mm256_setzero_ps();  // sum = 0 (8개)
    int i;
    for (i = 0; i <= n - 8; i += 8) {
        __m256 va = _mm256_loadu_ps(&a[i]);
        __m256 vb = _mm256_loadu_ps(&b[i]);
        vsum = _mm256_fmadd_ps(va, vb, vsum);  // FMA: sum += a*b (1 명령어!)
    }
    // 8개 float를 하나로 합산 (horizontal sum)
    __m128 vlow  = _mm256_castps256_ps128(vsum);
    __m128 vhigh = _mm256_extractf128_ps(vsum, 1);
    vlow = _mm_add_ps(vlow, vhigh);
    __m128 shuf = _mm_movehdup_ps(vlow);
    __m128 sums = _mm_add_ps(vlow, shuf);
    shuf = _mm_movehl_ps(shuf, sums);
    sums = _mm_add_ss(sums, shuf);
    float result = _mm_cvtss_f32(sums);

    // 나머지
    for (; i < n; i++) result += a[i] * b[i];
    return result;
}
```

성능:
```
스칼라:  4.0 ns/원소 (n=1M, 싱글 코어)
AVX2:    0.5 ns/원소 → 8× 향상
AVX-512: 0.25 ns/원소 → 16× 향상
```

---

## 6. 컴파일러 플래그

```bash
# CPU 아키텍처에 맞는 최적화
gcc -O3 -march=native source.c       # 현재 CPU 기준 최적화
gcc -O3 -mavx2 -mfma source.c        # AVX2 + FMA 명시적 지정
gcc -O2 -fopt-info-vec source.c      # 벡터화 성공/실패 리포트
gcc -O2 -fno-tree-vectorize source.c # 벡터화 비활성화 (비교용)

# Clang
clang -O3 -march=native -Rpass=loop-vectorize source.c
```

---

## 핵심 요약

- **SIMD**: 128~512비트 벡터 레지스터로 한 번에 4~16개 원소 처리. 이론적 4~16× 향상.
- **자동 벡터화**: 컴파일러(`-O2 -mavx2`)가 스칼라 루프를 자동 변환. `restrict`와 정렬된 메모리가 핵심.
- **벡터화 방해**: 메모리 앨리어싱, 루프 캐리 의존성, 조건 분기, 비정렬 접근.
- **인트린식**: 자동 벡터화 불충분 시 `<immintrin.h>`로 직접 SIMD 제어.
- **FMA**: Fused Multiply-Add로 `a*b + c`를 1 명령어로 처리 (정확도↑, 속도↑).
