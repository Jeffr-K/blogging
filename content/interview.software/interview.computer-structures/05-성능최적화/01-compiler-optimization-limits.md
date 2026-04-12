---
title: "컴파일러 최적화의 한계: 메모리 앨리어싱(Memory Aliasing)"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "optimization", "compiler", "aliasing", "csapp"]
---

## 컴파일러 최적화의 한계

컴파일러는 코드를 자동으로 최적화하는 놀라운 능력이 있습니다. 그러나 **정확성을 보장해야 하기 때문에**, 일부 최적화를 수행하지 못하는 경우가 있습니다. 그중 가장 중요한 제한이 **메모리 앨리어싱(Memory Aliasing)**입니다.

---

## 1. 메모리 앨리어싱이란?

두 포인터가 **같은 메모리 위치를 가리킬 수 있는 경우**입니다.

```c
void add_to(int *a, int *b) {
    *a += *b;  // a와 b가 같은 주소라면?
    *a += *b;  // *b의 값이 첫 번째 줄에서 바뀌었을 수 있음!
}

// 호출 예:
int x = 5;
add_to(&x, &x);  // a == b! 앨리어싱 발생
// 결과: x = 5+5 = 10, x = 10+10 = 20
```

---

## 2. 앨리어싱 때문에 컴파일러가 못 하는 최적화

```c
// 원본 코드
void twiddle1(long *xp, long *yp) {
    *xp += *yp;   // 메모리 읽기 2번, 쓰기 1번
    *xp += *yp;   // 메모리 읽기 2번, 쓰기 1번 (총 6회 메모리 접근)
}

// 프로그래머가 최적화하면?
void twiddle2(long *xp, long *yp) {
    *xp += 2 * (*yp);  // 메모리 읽기 2번, 쓰기 1번 (총 3회 메모리 접근)
}

// 이 두 함수는 xp != yp일 때만 동일!
// xp == yp인 경우:
// twiddle1: *xp = *xp + *xp = 2x; *xp = *xp + *xp = 4x
// twiddle2: *xp = *xp + 2 * *xp = 3x  ← 다름!

// 따라서 컴파일러는 twiddle1을 twiddle2로 변환 불가
```

---

## 3. restrict 키워드

`restrict` 키워드는 프로그래머가 컴파일러에게 **"이 포인터들은 앨리어싱이 없다"**고 보장합니다.

```c
// restrict 없음: 컴파일러가 보수적으로 최적화
void add_arrays(double *a, double *b, double *c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];  // a, b, c가 겹칠 수 있어서 벡터화 어려움
    }
}

// restrict 있음: 컴파일러가 적극적으로 최적화 (벡터화 가능)
void add_arrays(double * restrict a, double * restrict b, 
                double * restrict c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];  // 앨리어싱 없음 보장 → SIMD 벡터화!
    }
}
```

성능 차이:
```bash
# restrict 없음:
gcc -O3 -S add_arrays.c  # 스칼라 루프 생성

# restrict 있음:
gcc -O3 -S add_arrays_restrict.c  # AVX2 벡터 루프 생성 (4배 빠름)
```

---

## 4. 다른 컴파일러 최적화 한계

### 4.1 함수 호출 부작용

```c
long f(long *p) {
    return *p + *p;  // 이걸
    // return 2 * *p; 로 바꿀 수 있을까?
}

// 불가! f()가 *p를 수정하는 전역 함수를 호출한다면?
// 예:
long counter = 0;
long increment() {
    return ++counter;
}

// 컴파일러는 *p가 사이드 이펙트 없이 stable하다고 가정할 수 없음
```

### 4.2 volatile 변수

```c
// 하드웨어 레지스터 매핑 (메모리 맵 I/O)
volatile int *status_reg = (volatile int *)0xFFFF0000;

// 컴파일러가 최적화하면 안 됨 (volatile 없으면 최적화될 수 있음)
while (*status_reg == 0) {  // 실제로 매번 읽어야 함 (하드웨어가 값을 바꿈)
    /* 대기 */
}

// volatile 없으면 컴파일러가:
int cached = *status_reg;  // 한 번만 읽고
while (cached == 0) { }    // 무한 루프!
```

### 4.3 전역 변수 vs 지역 변수

```c
// 전역 변수: 외부 함수가 변경할 수 있음
int global_counter = 0;

void increment_twice() {
    global_counter++;
    some_other_function();  // global_counter를 변경할 수 있음!
    global_counter++;
    // 컴파일러가 rax에 캐시할 수 없음
}

// 지역 변수: 앨리어싱 없음, 적극 최적화 가능
void increment_twice_local() {
    int x = 0;
    x++;
    x++;
    // x = 2 (컴파일러가 완전히 상수로 접힘)
}
```

---

## 5. 컴파일러를 도와주는 방법

```c
// 방법 1: 포인터를 지역 변수에 복사
void add(long *xp, long *yp) {
    long x = *xp, y = *yp;  // 한 번만 읽기
    *xp = x + y;             // 한 번만 쓰기 (앨리어싱 무관)
    *xp = x + y;             // 컴파일러가 최적화 가능
}

// 방법 2: restrict 사용
// 방법 3: 인라인 힌트
static inline void helper(...) { ... }

// 방법 4: const 지정
void read_only(const int *p) {
    // 컴파일러가 *p가 변하지 않는다고 가정 가능
    return *p + *p;  // return 2 * *p 로 최적화 가능!
}
```

---

## 핵심 요약

- **메모리 앨리어싱**: 두 포인터가 같은 주소를 가리킬 수 있는 상황. 컴파일러가 재배치/합병 최적화를 포기하게 만듦.
- **restrict**: 앨리어싱 없음을 컴파일러에 보장. 벡터화 등 적극적 최적화 가능.
- **volatile**: 값이 하드웨어나 다른 스레드에 의해 바뀔 수 있음 표시. 캐싱 금지.
- **지역 변수에 복사**: 포인터 대신 지역 변수를 사용하면 컴파일러가 레지스터에 캐시 가능.
- 성능이 중요한 코드에서는 컴파일러의 제한을 이해하고 명시적으로 도움을 줄 것.
