---
title: "정적 링킹(Static Linking) vs 동적 링킹(Dynamic Linking)"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "linking", "static-linking", "dynamic-linking", "shared-library", "csapp"]
---

## 정적 vs 동적 링킹

라이브러리를 실행 파일에 포함시키는 방법은 두 가지입니다: **정적 링킹**(실행 파일에 내장)과 **동적 링킹**(실행 시 로드).

---

## 1. 정적 링킹 (Static Linking)

> 라이브러리의 코드를 **실행 파일 안에 완전히 포함**시킵니다.

```
빌드 시:
main.o + libm.a(math 라이브러리) → prog (단일 실행 파일)

libm.a (정적 라이브러리 = 아카이브):
  sin.o, cos.o, sqrt.o, ... 오브젝트 파일들의 묶음

링커 동작:
  main.o에서 sqrt 함수 참조 발견
  → libm.a에서 sqrt.o만 추출하여 실행 파일에 포함
  → (사용하지 않는 함수는 포함하지 않음)
```

```bash
# 정적 라이브러리 생성
ar rcs libmymath.a add.o subtract.o multiply.o

# 정적 링킹으로 컴파일
gcc main.c -L. -lmymath -static -o prog_static
ls -lh prog_static  # 큰 파일 크기
```

**장점**:
```
✅ 실행 파일이 자체 완결적 (라이브러리 의존성 없음)
✅ 배포 간단 (파일 하나만 복사)
✅ 실행 시 라이브러리 로딩 오버헤드 없음
✅ 버전 충돌 없음 (DLL Hell 없음)
```

**단점**:
```
❌ 실행 파일 크기 큼
❌ 메모리 낭비: 100개 프로세스가 같은 printf 코드를 100벌 메모리에 로드
❌ 라이브러리 업데이트 시 전체 재빌드 필요
❌ 보안 패치 적용 불편 (모든 바이너리 재배포)
```

---

## 2. 동적 링킹 (Dynamic Linking)

> 라이브러리를 **실행 시간에 로드**합니다. 공유 라이브러리(Shared Library).

```
빌드 시:
main.o + libm.so (공유 라이브러리 참조만) → prog (작은 실행 파일)

실행 시:
prog 실행
  → OS가 동적 링커(ld-linux.so)를 먼저 로드
  → 동적 링커가 libm.so를 메모리에 매핑
  → main의 sqrt 참조를 libm.so의 sqrt 주소로 해결
  → prog 실행 시작
```

```bash
# 동적 라이브러리 생성 (-fPIC: Position Independent Code)
gcc -fPIC -shared add.c subtract.c -o libmymath.so

# 동적 링킹 (기본값)
gcc main.c -L. -lmymath -o prog_dynamic
ls -lh prog_dynamic  # 작은 파일 크기

# 의존 라이브러리 확인
ldd prog_dynamic
# libmymath.so => ./libmymath.so
# libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6

# 런타임 라이브러리 경로 설정
export LD_LIBRARY_PATH=.:$LD_LIBRARY_PATH
./prog_dynamic
```

**장점**:
```
✅ 실행 파일 크기 작음
✅ 메모리 공유: 100개 프로세스가 libc.so를 물리 메모리에 1벌만 올림
✅ 라이브러리 업데이트 시 재빌드 불필요 (바이너리 배포)
✅ 보안 패치: libc 패치하면 모든 프로그램 즉시 적용
```

**단점**:
```
❌ 실행 시 라이브러리 로딩 오버헤드 (초기 시작 시간)
❌ DLL Hell: 라이브러리 버전 충돌 문제
❌ 배포 복잡: 의존 라이브러리도 함께 관리
❌ 런타임에 라이브러리 없으면 실행 불가
```

---

## 3. 공유 라이브러리 메모리 공유

```
물리 메모리:                    프로세스 A 가상 메모리:
┌──────────────┐                ┌────────────────┐
│  libc.so     │ ◄──────────── │  libc.so 매핑  │
│  (물리 1벌)  │                │  (각자 다른 VA) │
│              │ ◄──────────── │                 │
└──────────────┘                └────────────────┘
                                프로세스 B 가상 메모리:
                                ┌────────────────┐
                                │  libc.so 매핑  │
                                └────────────────┘

→ 코드(읽기 전용 .text)는 물리 메모리 1벌 공유
→ 데이터(.data, .bss)는 CoW(Copy-on-Write)로 프로세스별 독립
```

---

## 4. 런타임 동적 로딩 (dlopen)

```c
// 프로그램 실행 중 동적으로 라이브러리 로드 (플러그인 시스템)
#include <dlfcn.h>

// 라이브러리 열기
void *handle = dlopen("./plugin.so", RTLD_LAZY);
if (!handle) {
    fprintf(stderr, "%s\n", dlerror());
    exit(1);
}

// 심볼(함수) 가져오기
typedef int (*plugin_func_t)(int);
plugin_func_t func = (plugin_func_t)dlsym(handle, "process");

// 사용
int result = func(42);

// 닫기
dlclose(handle);

// 컴파일:
gcc main.c -ldl -o prog
```

---

## 5. 비교 요약

| 항목 | 정적 링킹 | 동적 링킹 |
|------|-----------|-----------|
| 파일 크기 | 크다 | 작다 |
| 메모리 사용 | 중복 (프로세스별) | 공유 (1벌) |
| 실행 속도 | 빠름 (로딩 없음) | 약간 느림 (초기) |
| 배포 | 단순 | 복잡 (의존성 관리) |
| 업데이트 | 재빌드 필요 | 라이브러리만 교체 |
| 버전 충돌 | 없음 | DLL Hell 가능 |
| 사용 사례 | 컨테이너, 임베디드 | 일반 애플리케이션 |

---

## 핵심 요약

- **정적 링킹**: 빌드 시 라이브러리 코드를 실행 파일에 내장. 자체 완결적이지만 크고 메모리 낭비.
- **동적 링킹**: 실행 시 공유 라이브러리 로드. 메모리 공유, 업데이트 쉬움, 의존성 관리 필요.
- **공유 라이브러리**: 여러 프로세스가 물리 메모리의 코드 섹션을 공유 → 메모리 절약.
- **dlopen**: 런타임에 라이브러리 동적 로드 → 플러그인 아키텍처 구현.
- **-fPIC**: 공유 라이브러리 컴파일에 필수. 위치 독립 코드(PIC) 생성.
