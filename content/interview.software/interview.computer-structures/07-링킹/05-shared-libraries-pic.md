---
title: "공유 라이브러리(Shared Library)와 위치 독립 코드(PIC)"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "linking", "shared-library", "PIC", "GOT", "PLT", "csapp"]
---

## 공유 라이브러리와 PIC

동적 링킹에서 공유 라이브러리는 **여러 프로세스가 동시에 메모리에서 공유**합니다. 이를 위해 코드가 **어느 주소에 로드되어도 동작**하는 위치 독립 코드(PIC)가 필요합니다.

---

## 1. 위치 독립 코드 (PIC: Position Independent Code)

```
왜 PIC가 필요한가?

프로세스 A: libmath.so를 0x7f000000에 로드
프로세스 B: libmath.so를 0x7f800000에 로드 (다른 위치!)

절대 주소를 사용하면:
  → 각 프로세스마다 주소가 다름
  → 코드를 복사하고 각각 재배치 필요
  → 공유 불가!

PIC를 사용하면:
  → 코드는 주소 독립적
  → 물리 메모리 1벌의 코드를 여러 프로세스가 다른 가상 주소로 공유
  → 데이터(GOT)만 프로세스별로 별도 유지
```

---

## 2. PIC 데이터 참조: GOT (Global Offset Table)

```
PIC의 핵심: 절대 주소 대신 GOT를 경유

컴파일 시 (주소 미확정):
  mov    global_var(%rip), %eax  ← RIP 상대 주소로 GOT 접근

GOT 레이아웃:
┌──────────────┐
│ GOT[0]       │ → .dynamic 섹션 주소
│ GOT[1]       │ → link_map 주소
│ GOT[2]       │ → _dl_runtime_resolve 주소
│ GOT[3]       │ → global_var의 실제 주소 ← 동적 링커가 채움
│ ...          │
└──────────────┘

실행 시 동작:
1. 동적 링커가 libmath.so를 특정 주소에 로드
2. global_var의 실제 주소를 계산하여 GOT[3]에 기입
3. 코드: GOT[3]을 읽어 global_var 접근
```

```c
// -fPIC 옵션으로 PIC 코드 생성
// gcc -fPIC -shared mylib.c -o mylib.so

// 내부적으로 전역 변수 접근:
// PIC 없음: movl $0x601028, %edi     ← 절대 주소 (재배치 필요)
// PIC 있음: movq global_var@GOTPCREL(%rip), %rax  ← GOT 상대 주소
```

---

## 3. PIC 함수 호출: PLT + GOT (Lazy Binding)

공유 라이브러리의 함수 호출은 **PLT(Procedure Linkage Table)**를 거칩니다.

```
PLT 동작 원리 (Lazy Binding):

첫 번째 printf 호출:
  main → PLT[printf]
    → GOT[printf]가 _dl_runtime_resolve를 가리킴
    → _dl_runtime_resolve: printf의 실제 주소 찾기
    → GOT[printf]에 실제 주소 저장
    → printf 실행

두 번째 이후 printf 호출:
  main → PLT[printf]
    → GOT[printf]가 이제 실제 printf 주소를 가리킴
    → 바로 printf 실행 (오버헤드 없음!)
```

```
PLT 어셈블리 구조:
PLT[0] (스텁):
  pushq   *GOT[1](%rip)    ← link_map 푸시
  jmpq    *GOT[2](%rip)    ← _dl_runtime_resolve로 점프

PLT[printf]:
  jmpq    *GOT[printf](%rip)   ← GOT 항목으로 점프 (처음엔 다음 줄)
  pushq   $idx                  ← 심볼 인덱스 푸시 (처음 호출 시)
  jmpq    PLT[0]               ← 동적 링커 호출 (처음 호출 시)
```

---

## 4. GOT와 PLT 메모리 레이아웃

```
공유 라이브러리 메모리 레이아웃:
┌─────────────────────────┐
│  .text (코드, 읽기전용)  │ ← 모든 프로세스가 공유 (물리 메모리 1벌)
│  .rodata (상수)         │
├─────────────────────────┤
│  .data (전역 변수)      │ ← 프로세스별 독립 (CoW)
│  .bss (미초기화)        │
├─────────────────────────┤
│  .got (GOT)             │ ← 프로세스별 독립 (동적 링커가 채움)
│  .plt (PLT)             │ ← 코드 섹션 (공유)
└─────────────────────────┘
```

---

## 5. ASLR (Address Space Layout Randomization)

```
보안 기능: 라이브러리 로드 주소를 매 실행마다 무작위화

PIC 없는 코드: ASLR 적용 불가 (절대 주소 사용)
PIC 코드:      ASLR 자유롭게 적용 가능

$ ldd /bin/ls
  libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f3a4b2c0000)
$ ldd /bin/ls
  libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f8c3a1e0000)
  ↑ 매번 다른 주소!
```

---

## 6. PIC 성능 오버헤드

```
PIC의 비용:
1. GOT 간접 참조: 전역 변수 접근마다 추가 메모리 로드
2. PLT 점프: 함수 호출마다 PLT 거쳐야 함 (첫 호출 시 +느림)

실제 오버헤드: 수 % 미만 (현대 CPU의 캐시와 분기 예측으로 완화)
장점 (메모리 공유)이 비용보다 훨씬 큼

최적화:
  -fvisibility=hidden: 내부 함수를 PIC 없이 직접 호출
  -O2 이상: 컴파일러가 PIC 오버헤드 최소화
```

---

## 핵심 요약

- **PIC**: 어느 주소에 로드되어도 동작하는 코드. 공유 라이브러리의 핵심.
- **GOT**: 전역 변수의 실제 주소를 저장하는 테이블. 동적 링커가 채움. 프로세스별 독립.
- **PLT**: 공유 함수 호출의 간접 테이블. Lazy Binding으로 첫 호출 시만 주소 해석.
- **Lazy Binding**: 함수를 실제 처음 호출할 때 GOT에 실제 주소 저장 → 시작 시간 단축.
- **ASLR**: PIC 덕분에 라이브러리 로드 주소 무작위화 가능 → 보안 강화.
- **-fPIC 필수**: 공유 라이브러리 컴파일 시 반드시 사용.
