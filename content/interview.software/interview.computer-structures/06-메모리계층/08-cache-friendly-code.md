---
title: "캐시 친화적 코드 작성법"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "cache", "cache-friendly", "performance", "csapp"]
---

## 캐시 친화적 코드 (Cache-Friendly Code)

캐시 미스를 최소화하여 성능을 극대화하는 코딩 기법입니다. 알고리즘 복잡도가 같아도 캐시 효율에 따라 **수십 배** 성능 차이가 날 수 있습니다.

---

## 1. 기본 원칙: 지역성 극대화

```
✅ 캐시 친화적인 접근:
  - 메모리를 순서대로(Sequential) 읽기
  - 같은 데이터를 여러 번 재사용 (시간 지역성)
  - 인접한 데이터를 함께 처리 (공간 지역성)

❌ 캐시 비친화적인 접근:
  - 랜덤 메모리 접근
  - 포인터를 따라다니는 순회 (링크드 리스트)
  - 크기가 캐시를 초과하는 전체 스캔
```

---

## 2. 행 우선 vs 열 우선 접근

```c
// 나쁜 예: 열 우선 접근 (C 배열은 행 우선 저장)
// a[0][0], a[1][0], a[2][0]... → N*4 바이트 점프
void sum_cols(int a[N][N], int n) {
    int sum = 0;
    for (int j = 0; j < n; j++)
        for (int i = 0; i < n; i++)
            sum += a[i][j];   // 캐시라인 낭비: 64B 로드 후 4B만 사용
}

// 좋은 예: 행 우선 접근
void sum_rows(int a[N][N], int n) {
    int sum = 0;
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            sum += a[i][j];   // 캐시라인 완전 활용: 64B 로드 후 16int 사용
}

// 성능 차이 (N=4096, 64MB 배열):
// sum_cols: ~3000ms (L3 캐시 미스 지속)
// sum_rows: ~300ms  (10배 빠름)
```

---

## 3. 루프 타일링 (Loop Tiling / Blocking)

큰 데이터를 캐시에 맞는 블록 단위로 쪼개어 처리합니다.

```c
// 단순 행렬 전치 (N=1024, 4MB)
// L3 캐시가 8MB라도 읽기/쓰기 배열 합산이 8MB → Capacity Miss
void transpose_naive(int src[N][N], int dst[N][N]) {
    for (int i = 0; i < N; i++)
        for (int j = 0; j < N; j++)
            dst[j][i] = src[i][j];  // dst 쓰기가 열 방향 → 미스
}

// 타일링 적용 (블록 크기 B = 캐시에 맞게 조정)
#define B 32  // 32×32×4바이트 = 4KB < L1 캐시
void transpose_tiled(int src[N][N], int dst[N][N]) {
    for (int i = 0; i < N; i += B)
        for (int j = 0; j < N; j += B)
            // B×B 블록을 캐시에 올려놓고 처리
            for (int ii = i; ii < i+B && ii < N; ii++)
                for (int jj = j; jj < j+B && jj < N; jj++)
                    dst[jj][ii] = src[ii][jj];
}
// 성능: 단순 대비 2~4배 향상
```

---

## 4. AoS vs SoA (데이터 레이아웃)

```c
// AoS (Array of Structs): 일반적 객체 배열
struct Particle {
    float x, y, z;    // 위치 (12바이트)
    float vx, vy, vz; // 속도 (12바이트)
    float mass;        // 질량 (4바이트)
    int   type;        // 타입 (4바이트)
    // 구조체 총 32바이트
};
Particle particles[N];  // AoS

// 위치만 업데이트하는 루프:
for (int i = 0; i < N; i++) {
    particles[i].x += particles[i].vx * dt;  // 32바이트 중 x,vx만 사용
    // 캐시라인 64B = Particle 2개
    // 사용하는 데이터: x(4B) + vx(4B) = 8B → 12.5% 활용
}

// SoA (Struct of Arrays): 필드별 분리
struct Particles {
    float x[N], y[N], z[N];
    float vx[N], vy[N], vz[N];
    float mass[N];
    int   type[N];
};
Particles particles;  // SoA

// 위치만 업데이트:
for (int i = 0; i < N; i++) {
    particles.x[i] += particles.vx[i] * dt;
    // x배열이 연속 → 캐시라인 16 float = 100% 활용!
}
// 성능: AoS 대비 3~5배 (SIMD 벡터화도 쉬움)
```

---

## 5. 핫/콜드 데이터 분리

```c
// 나쁜 예: 자주 쓰는 필드와 드물게 쓰는 필드가 섞임
struct Employee {
    char name[64];        // 자주 읽힘 (핫)
    int  salary;          // 자주 읽힘 (핫)
    char bio[512];        // 거의 안 읽힘 (콜드)
    char resume[1024];    // 거의 안 읽힘 (콜드)
    // 총 1604바이트 → 캐시라인 26개
};

// 좋은 예: 핫 데이터를 앞에 모음
struct Employee {
    char name[64];    // 핫
    int  salary;      // 핫
    // 여기까지 68바이트 ≈ 캐시라인 2개

    // 콜드 데이터는 포인터로 분리
    char *bio;
    char *resume;
};
// 이름+급여 조회 시: 캐시라인 2개만 로드 (콜드 데이터 무관)
```

---

## 6. 포인터 추적 최소화

```c
// 나쁜 예: 링크드 리스트 (포인터 추적 → 캐시 미스 연발)
struct Node { int val; struct Node *next; };
Node *head;
int sum = 0;
for (Node *n = head; n; n = n->next) {
    sum += n->val;   // n->next가 가리키는 위치: 예측 불가
    // 매 접근마다 캐시 미스 가능
}

// 좋은 예: 배열 사용 (연속 메모리)
int arr[N];
int sum = 0;
for (int i = 0; i < N; i++) {
    sum += arr[i];  // 순차 접근 → 캐시 히트
}

// 링크드 리스트가 필요하다면:
// → 메모리 풀(Memory Pool) 사용으로 노드를 연속 배치
int pool[MAX_NODES];  // 노드를 연속 공간에 할당
```

---

## 7. 프리페칭 힌트 (Prefetching)

```c
// 컴파일러에게 미리 가져올 데이터 힌트
#include <xmmintrin.h>

for (int i = 0; i < N; i++) {
    // 8번 이후 접근할 데이터를 미리 캐시로 로드
    _mm_prefetch((char*)&arr[i + 8], _MM_HINT_T0);
    process(arr[i]);
}

// GCC 내장 함수
__builtin_prefetch(&arr[i + 8], 0, 3);
// 두 번째 인자: 0=읽기용, 1=쓰기용
// 세 번째 인자: 지역성 힌트 0(낮음)~3(높음, L1에 유지)

// 주의: 지나친 프리페치는 오히려 캐시 오염 유발
```

---

## 핵심 요약

- **행 우선 접근**: C의 2D 배열은 행 우선 저장 → 내부 루프를 열 방향으로.
- **루프 타일링**: 큰 데이터를 L1/L2 캐시 크기에 맞는 블록으로 분할 처리.
- **SoA > AoS**: 동일 필드를 연속 배열로 저장하면 캐시 활용률 대폭 향상.
- **핫/콜드 분리**: 자주 쓰는 필드를 구조체 앞부분에 모아 캐시라인 효율화.
- **배열 > 링크드 리스트**: 포인터 추적은 캐시 미스의 주범.
- **측정 우선**: `perf stat`, Valgrind Cachegrind로 실제 미스율 확인 후 최적화.
