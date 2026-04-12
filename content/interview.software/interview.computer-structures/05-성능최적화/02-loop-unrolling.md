---
title: "루프 언롤링(Loop Unrolling)으로 성능 높이기"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "optimization", "loop-unrolling", "pipeline", "csapp"]
---

## 루프 언롤링 (Loop Unrolling)

루프 언롤링은 루프 본문을 여러 번 복제하여 반복 횟수를 줄이는 최적화 기법입니다. 루프 제어 오버헤드를 줄이고 **파이프라인 효율성**을 높입니다.

---

## 1. 기본 루프 언롤링

### 1.1 일반 루프 (1×)

```c
// 원본: 배열 합산
long sum = 0;
for (long i = 0; i < n; i++) {
    sum += arr[i];
}
```

어셈블리 관점:
```
loop:
    movq (%rdi, %rax, 8), %rdx  ; 로드
    addq %rdx, %rsi              ; 누적
    incq %rax                    ; i++
    cmpq %rcx, %rax              ; i < n?
    jl loop                      ; 루프 제어 (오버헤드!)
```

### 1.2 2× 언롤링

```c
long sum = 0;
long i;
for (i = 0; i < n - 1; i += 2) {  // 2씩 증가
    sum += arr[i];
    sum += arr[i + 1];
}
// 나머지 처리 (n이 홀수일 경우)
for (; i < n; i++) {
    sum += arr[i];
}
```

오버헤드 비교:
```
원본:    N번 루프 제어 (incq, cmpq, jl = 3개 명령어 × N)
2× 언롤: N/2번 루프 제어 → 루프 제어 비용 50% 감소
```

---

## 2. 파이프라인 관점에서의 한계

### 2.1 연속 누적의 문제

```c
// 2× 언롤이지만 여전히 순차적 의존성!
sum += arr[i];      // sum 업데이트
sum += arr[i + 1];  // 이전 sum에 의존 → 파이프라인 스톨!
```

의존성 체인:
```
사이클 1: sum = sum + arr[0]  (레이턴시: 1 사이클)
사이클 2: sum = sum + arr[1]  (이전 결과 필요 → 대기)
사이클 3: sum = sum + arr[2]  (대기)
...
```

### 2.2 해결책: 여러 누적 변수

```c
// k×k 언롤링: 2개 누적 변수로 의존성 체인 분리
long sum0 = 0, sum1 = 0;
for (long i = 0; i < n - 1; i += 2) {
    sum0 += arr[i];      // 독립적인 체인 1
    sum1 += arr[i + 1];  // 독립적인 체인 2
}
long sum = sum0 + sum1;
```

파이프라인 활용:
```
사이클 1: sum0 = sum0 + arr[0]
사이클 1: sum1 = sum1 + arr[1]  ← 동시 실행! (독립적)
사이클 2: sum0 = sum0 + arr[2]
사이클 2: sum1 = sum1 + arr[3]  ← 동시 실행!
```

---

## 3. k×k 언롤링

### 3.1 4개 누적 변수 예시

```c
// 4×4 언롤링: 최대 ILP 활용
long sum0 = 0, sum1 = 0, sum2 = 0, sum3 = 0;
long i;
for (i = 0; i <= n - 4; i += 4) {
    sum0 += arr[i];
    sum1 += arr[i + 1];
    sum2 += arr[i + 2];
    sum3 += arr[i + 3];
}
// 나머지
for (; i < n; i++) sum0 += arr[i];
long sum = sum0 + sum1 + sum2 + sum3;
```

### 3.2 성능 비교 (64비트 정수 배열, N=10⁸)

```
1× (원본):         0.50 ns/원소  (약 1 사이클/원소)
2× (단일 변수):    0.50 ns/원소  (의존성으로 이득 없음)
2× (2 변수):       0.25 ns/원소  (2× 향상)
4× (4 변수):       0.25 ns/원소  (포화: 실행 유닛 한계)
8× (8 변수):       0.25 ns/원소  (추가 이득 없음)
```

> **의존성 체인 레이턴시**가 병목이지 루프 제어 오버헤드가 아님!

---

## 4. 부동소수점 언롤링 주의사항

```c
// 부동소수점은 결합법칙 불성립!
double sum = 0.0;
for (int i = 0; i < n; i++) {
    sum += arr[i];
}

// 2 누적 변수 버전: 합산 순서가 달라 결과가 다를 수 있음!
double sum0 = 0.0, sum1 = 0.0;
for (int i = 0; i < n - 1; i += 2) {
    sum0 += arr[i];
    sum1 += arr[i + 1];
}
// sum0 + sum1의 순서 ≠ 원본 순서 → 반올림 오차 차이
```

컴파일러가 자동으로 이 최적화를 하지 않는 이유:
- `-ffast-math` 플래그 없이는 FP 재결합 금지 (C 표준 준수)
- `-ffast-math` 사용 시 컴파일러가 자동 언롤링 수행 가능

---

## 5. 컴파일러 자동 언롤링

```bash
# GCC 자동 언롤링 활성화
gcc -O2 -funroll-loops source.c      # 휴리스틱 기반
gcc -O3 source.c                     # -O3에는 언롤링 포함
gcc -O2 -funroll-all-loops source.c  # 모든 루프 언롤 (코드 크기 증가!)

# 특정 루프에 GCC pragma로 힌트
#pragma GCC optimize("unroll-loops")
```

어노테이션으로 제어:
```c
// GCC/Clang
__attribute__((optimize("unroll-loops")))
void compute(double *arr, long n) {
    for (long i = 0; i < n; i++) {
        arr[i] *= 2.0;
    }
}

// Clang pragma
#pragma clang loop unroll_count(4)
for (int i = 0; i < n; i++) { ... }
```

---

## 6. 트레이드오프

```
언롤링의 이점:
✓ 루프 제어 오버헤드 감소
✓ 파이프라인 ILP 증가 (여러 누적 변수 시)
✓ 명령어 스케줄링 기회 증가

언롤링의 단점:
✗ 코드 크기 증가 → I-Cache 압박
✗ 레지스터 압박 (누적 변수가 많으면 스필 발생)
✗ 나머지(remainder) 처리 코드 필요
✗ 컴파일 시간 증가

최적 언롤 계수:
- 보통 4~8× (CPU 실행 유닛 수와 연관)
- 프로파일링으로 실측 필요!
```

---

## 핵심 요약

- **루프 언롤링**: 루프 본문을 N배 복제하여 루프 제어 오버헤드 감소.
- **핵심 이득은 누적 변수 분리**: 단순 언롤은 의존성 체인 때문에 이득 없음. **여러 누적 변수**로 체인을 분리해야 실질적 성능 향상.
- **k×k 언롤링**: k 요소를 k 누적 변수로 처리. k=4~8이 일반적 최적.
- **부동소수점 주의**: FP 결합법칙 불성립으로 컴파일러 자동 최적화 제한 (`-ffast-math`로 허용 가능).
- **I-Cache 트레이드오프**: 코드 크기가 너무 커지면 오히려 캐시 미스로 역효과.
