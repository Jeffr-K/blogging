---
title: "컴파일과 링킹의 차이: 오브젝트 파일과 실행 파일"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "linking", "compile", "object-file", "executable", "csapp"]
---

## 컴파일과 링킹

소스 코드가 실행 파일이 되기까지 **전처리 → 컴파일 → 어셈블 → 링크** 네 단계를 거칩니다. 각 단계의 역할과 산출물을 명확히 이해해야 합니다.

---

## 1. 빌드 파이프라인 전체 흐름

```
소스 파일:  main.c        swap.c
              ↓               ↓
        [전처리기 cpp]  [전처리기 cpp]
              ↓               ↓
       main.i (전처리됨)  swap.i
              ↓               ↓
        [컴파일러 cc1]  [컴파일러 cc1]
              ↓               ↓
       main.s (어셈블리)  swap.s
              ↓               ↓
        [어셈블러 as]   [어셈블러 as]
              ↓               ↓
       main.o (오브젝트)  swap.o (오브젝트)
              └───────┬───────┘
                [링커 ld]
                      ↓
               prog (실행 파일)
```

---

## 2. 각 단계 상세

### 2.1 전처리 (Preprocessing)

```bash
gcc -E main.c -o main.i
```

```c
// 입력: main.c
#include <stdio.h>
#define MAX 100
int main() { printf("%d\n", MAX); }

// 출력: main.i (수천 줄로 확장됨)
// stdio.h 전체 내용 삽입
// MAX → 100으로 치환
// 주석 제거
```

**처리 내용**: `#include`, `#define`, `#ifdef`, `#pragma` 등 전처리 지시문.

### 2.2 컴파일 (Compilation)

```bash
gcc -S main.i -o main.s
```

```
# 입력: C 코드 (main.i)
# 출력: x86-64 어셈블리 (main.s)

main:
    pushq   %rbp
    movq    %rsp, %rbp
    movl    $100, %esi
    leaq    .LC0(%rip), %rdi
    call    printf@PLT
    ...
```

**처리 내용**: 문법 분석, 최적화, 어셈블리 코드 생성.

### 2.3 어셈블 (Assembly)

```bash
gcc -c main.s -o main.o
```

```
입력: 어셈블리 텍스트 (main.s)
출력: 기계어 오브젝트 파일 (main.o) — 바이너리

오브젝트 파일 내용:
  - 기계어 코드 (텍스트 섹션)
  - 초기화된 전역/정적 변수 (.data)
  - 미초기화 변수 (.bss, 공간만 예약)
  - 심볼 테이블 (정의된/참조한 심볼 목록)
  - 재배치 정보 (주소가 확정되지 않은 곳 표시)
```

### 2.4 링크 (Linking)

```bash
ld main.o swap.o -o prog
# (실제로는 gcc가 ld를 자동 호출)
gcc main.o swap.o -o prog
```

```
입력: 여러 오브젝트 파일 + 라이브러리
출력: 실행 가능한 바이너리

링커가 하는 일:
  1. 심볼 해석: 각 파일에서 참조한 심볼의 정의를 찾음
  2. 재배치: 심볼의 최종 주소를 확정하여 코드에 기입
  3. 섹션 병합: 여러 .o의 .text, .data를 하나로 합침
```

---

## 3. 오브젝트 파일(.o) 구조

```
ELF 오브젝트 파일 레이아웃:
┌─────────────────────┐
│   ELF 헤더          │  파일 형식, 아키텍처, 엔트리 포인트
├─────────────────────┤
│   .text             │  실행 가능한 기계어 코드
├─────────────────────┤
│   .rodata           │  읽기 전용 데이터 (문자열 상수, switch 테이블)
├─────────────────────┤
│   .data             │  초기화된 전역/정적 변수
├─────────────────────┤
│   .bss              │  미초기화 전역/정적 변수 (파일에서 공간 차지 안 함)
├─────────────────────┤
│   .symtab           │  심볼 테이블 (함수명, 변수명과 주소)
├─────────────────────┤
│   .rel.text         │  .text의 재배치 항목 (링커가 주소를 채워야 할 곳)
├─────────────────────┤
│   .rel.data         │  .data의 재배치 항목
├─────────────────────┤
│   .debug            │  디버그 정보 (-g 옵션 시)
├─────────────────────┤
│   섹션 헤더 테이블   │  각 섹션의 위치와 크기
└─────────────────────┘
```

```bash
# 오브젝트 파일 분석 명령어
objdump -d main.o        # 역어셈블
nm main.o                # 심볼 테이블 출력
readelf -a main.o        # ELF 헤더 상세 정보
objdump -r main.o        # 재배치 항목 출력
```

---

## 4. 컴파일 단계별 오류

```
전처리 오류: #include 파일 없음
  → error: stdio.h: No such file or directory

컴파일 오류: 문법/타입 오류 (가장 흔함)
  → error: 'x' undeclared, type mismatch...

어셈블 오류: 잘못된 어셈블리 (드묾)
  → error: unrecognized instruction

링크 오류: 심볼을 찾지 못함
  → undefined reference to 'swap'    ← 정의 없음
  → multiple definition of 'main'    ← 중복 정의
  → cannot find -lm                  ← 라이브러리 없음
```

---

## 5. 분리 컴파일의 장점

```
전체 재컴파일 vs 분리 컴파일:
소스 파일 10개, main.c만 수정 시:

전체 재컴파일: 10개 파일 모두 컴파일 → 느림
분리 컴파일:  main.c만 재컴파일 후 링크 → 빠름

Make/CMake가 이를 자동화:
$ make
  gcc -c main.c -o main.o     ← 변경된 파일만
  ld main.o swap.o ... -o prog  ← 전체 링크
```

---

## 핵심 요약

- **전처리**: `#include`/`#define` 처리. 산출물: `.i` (텍스트).
- **컴파일**: C코드 → 어셈블리. 최적화 수행. 산출물: `.s` (텍스트).
- **어셈블**: 어셈블리 → 기계어. 산출물: `.o` (바이너리, 주소 미확정).
- **링크**: 심볼 해석 + 재배치 + 섹션 병합. 산출물: 실행 파일 (주소 확정).
- **링크 오류**: undefined reference = 정의 없음, multiple definition = 중복 정의.
- **분리 컴파일**: 수정된 파일만 재컴파일 후 링크 → 빌드 시간 단축.
