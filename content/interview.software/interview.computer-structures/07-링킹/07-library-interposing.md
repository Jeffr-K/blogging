---
title: "라이브러리 인터포징(Library Interposing)으로 함수 가로채기"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "linking", "interposing", "LD_PRELOAD", "malloc", "csapp"]
---

## 라이브러리 인터포징 (Library Interposing)

라이브러리의 함수를 **자신의 버전으로 대체**하는 기법입니다. 재컴파일 없이 동작을 바꾸거나, 함수 호출을 추적/프로파일링할 수 있습니다.

---

## 1. 인터포징이란?

```
일반 함수 호출:
  프로그램 → malloc (libc)

인터포징 후:
  프로그램 → 내 malloc (인터포저) → malloc (libc)
                  ↓
            로그 출력, 메모리 추적, 에러 주입 등

활용 사례:
  - malloc/free 메모리 누수 추적
  - 함수 호출 프로파일링
  - 보안 감사 (시스템 콜 모니터링)
  - 테스트 더블 (Mock 함수 주입)
  - 버그 재현 (에러 주입)
```

---

## 2. 컴파일 타임 인터포징

소스 코드에서 `#include`와 매크로로 함수를 가로챕니다.

```c
// mymalloc.h
#define malloc(size)  mymalloc(size, __FILE__, __LINE__)
#define free(ptr)     myfree(ptr, __FILE__, __LINE__)

void *mymalloc(size_t size, char *file, int line);
void  myfree(void *ptr, char *file, int line);
```

```c
// mymalloc.c
#include <stdio.h>
#include <malloc.h>

void *mymalloc(size_t size, char *file, int line) {
    void *ptr = malloc(size);  // 실제 malloc 호출
    printf("[malloc] size=%zu, file=%s, line=%d, ptr=%p\n",
           size, file, line, ptr);
    return ptr;
}

void myfree(void *ptr, char *file, int line) {
    printf("[free] ptr=%p, file=%s, line=%d\n", ptr, file, line);
    free(ptr);  // 실제 free 호출
}
```

```c
// main.c
#include "mymalloc.h"  // ← 이 줄 하나로 모든 malloc 추적!
#include <stdlib.h>

int main() {
    int *p = malloc(sizeof(int) * 10);
    free(p);
    return 0;
}
```

```bash
gcc -c mymalloc.c -o mymalloc.o
gcc main.c mymalloc.o -o prog
./prog
# [malloc] size=40, file=main.c, line=5, ptr=0x5593a2b12260
# [free] ptr=0x5593a2b12260, file=main.c, line=6
```

---

## 3. 링크 타임 인터포징

링커 플래그 `--wrap`을 사용하여 링크 시점에 심볼을 가로챕니다.

```c
// mymalloc.c
#include <stdio.h>

// --wrap malloc 시: malloc → __wrap_malloc, 실제 malloc → __real_malloc
void *__wrap_malloc(size_t size) {
    void *ptr = __real_malloc(size);  // 실제 malloc 호출
    printf("[WRAP malloc] size=%zu, ptr=%p\n", size, ptr);
    return ptr;
}

void __wrap_free(void *ptr) {
    printf("[WRAP free] ptr=%p\n", ptr);
    __real_free(ptr);  // 실제 free 호출
}
```

```bash
# --wrap=malloc: malloc 심볼을 __wrap_malloc으로 리다이렉트
gcc -Wl,--wrap=malloc -Wl,--wrap=free main.c mymalloc.c -o prog
./prog
```

---

## 4. 런타임 인터포징: LD_PRELOAD

가장 강력한 방법. **재컴파일 없이** 모든 프로그램의 함수를 가로챌 수 있습니다.

```c
// mymalloc.c - 공유 라이브러리로 빌드
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <dlfcn.h>  // dlsym

// 함수 포인터 타입 정의
typedef void *(*malloc_t)(size_t);
typedef void  (*free_t)(void *);

void *malloc(size_t size) {
    // 실제 libc의 malloc을 동적으로 찾기
    malloc_t real_malloc = (malloc_t)dlsym(RTLD_NEXT, "malloc");
    void *ptr = real_malloc(size);
    fprintf(stderr, "[malloc] size=%zu, ptr=%p\n", size, ptr);
    return ptr;
}

void free(void *ptr) {
    free_t real_free = (free_t)dlsym(RTLD_NEXT, "free");
    fprintf(stderr, "[free] ptr=%p\n", ptr);
    real_free(ptr);
}
```

```bash
# 공유 라이브러리로 컴파일
gcc -fPIC -shared mymalloc.c -o mymalloc.so -ldl

# LD_PRELOAD로 모든 malloc 가로채기 (재컴파일 불필요!)
LD_PRELOAD=./mymalloc.so ls
LD_PRELOAD=./mymalloc.so ./prog
LD_PRELOAD=./mymalloc.so python3 my_script.py
```

---

## 5. 실전 활용 예시

### 5.1 메모리 누수 탐지

```c
// leak_detector.c
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_ALLOCS 10000
static void *alloc_table[MAX_ALLOCS];
static size_t alloc_sizes[MAX_ALLOCS];
static int alloc_count = 0;

void *malloc(size_t size) {
    static void *(*real_malloc)(size_t) = NULL;
    if (!real_malloc) real_malloc = dlsym(RTLD_NEXT, "malloc");

    void *ptr = real_malloc(size);
    if (alloc_count < MAX_ALLOCS) {
        alloc_table[alloc_count] = ptr;
        alloc_sizes[alloc_count] = size;
        alloc_count++;
    }
    return ptr;
}

void free(void *ptr) {
    static void (*real_free)(void *) = NULL;
    if (!real_free) real_free = dlsym(RTLD_NEXT, "free");

    for (int i = 0; i < alloc_count; i++) {
        if (alloc_table[i] == ptr) {
            alloc_table[i] = NULL;
            break;
        }
    }
    real_free(ptr);
}

// 프로그램 종료 시 미해제 메모리 출력
__attribute__((destructor))
void report_leaks() {
    for (int i = 0; i < alloc_count; i++) {
        if (alloc_table[i] != NULL)
            fprintf(stderr, "LEAK: ptr=%p, size=%zu\n",
                    alloc_table[i], alloc_sizes[i]);
    }
}
```

### 5.2 유명 도구들의 인터포징 사용

```
Valgrind: 모든 메모리 연산 인터포징 (바이너리 변환 방식)
AddressSanitizer: 컴파일 시 인터포징으로 메모리 오류 탐지
tcmalloc (Google): malloc 인터포징으로 고성능 메모리 할당
jemalloc (Meta): 동일한 원리

LD_PRELOAD 실전:
  LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libasan.so.5 ./prog
```

---

## 6. 인터포징 주의사항

```
⚠️ 무한 재귀 방지:
  인터포저에서 malloc을 호출하면 자기 자신을 다시 호출!
  → RTLD_NEXT로 실제 함수 찾거나
  → 재진입 플래그(reentrancy guard) 사용

⚠️ 스레드 안전성:
  전역 추적 테이블 접근 시 뮤텍스 필요

⚠️ 초기화 순서:
  dlsym 자체가 malloc을 호출할 수 있음
  → 정적 버퍼나 sbrk()로 부트스트랩 필요
```

---

## 핵심 요약

- **인터포징**: 라이브러리 함수를 내 함수로 대체. 재컴파일 없이 동작 변경 가능.
- **컴파일 타임**: `#define malloc mymalloc` — 소스 수정 필요, 간단.
- **링크 타임**: `--wrap=malloc` — 링커 플래그로 심볼 리다이렉트.
- **런타임**: `LD_PRELOAD=./mymalloc.so` — 가장 강력, 재컴파일 불필요.
- **RTLD_NEXT**: `dlsym(RTLD_NEXT, "malloc")`로 다음 라이브러리의 실제 함수 참조.
- **활용**: 메모리 누수 탐지, 프로파일링, 테스트 목(Mock), 에러 주입.
