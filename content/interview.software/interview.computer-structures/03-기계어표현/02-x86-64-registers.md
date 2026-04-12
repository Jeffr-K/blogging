---
title: "x86-64 레지스터 체계 (rax, rbx, rsp, rbp, rip 등)"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "x86-64", "registers", "assembly", "csapp"]
---

## x86-64 레지스터 체계

x86-64 아키텍처는 16개의 64비트 범용 레지스터와 몇 가지 특수 레지스터를 가집니다. 각 레지스터는 특정 관례(Convention)에 따라 사용됩니다.

---

## 1. 16개 범용 레지스터

```
64비트  32비트  16비트  8비트(하위)
──────────────────────────────────────
%rax    %eax    %ax     %al     ← 반환값, 누산기
%rbx    %ebx    %bx     %bl     ← Callee-saved
%rcx    %ecx    %cx     %cl     ← 4번째 함수 인자
%rdx    %edx    %dx     %dl     ← 3번째 함수 인자, 나눗셈
%rsi    %esi    %si     %sil    ← 2번째 함수 인자
%rdi    %edi    %di     %dil    ← 1번째 함수 인자
%rsp    %esp    %sp     %spl    ← 스택 포인터 (Stack Pointer)
%rbp    %ebp    %bp     %bpl    ← 프레임 포인터 (Frame Pointer)
%r8     %r8d    %r8w    %r8b    ← 5번째 함수 인자
%r9     %r9d    %r9w    %r9b    ← 6번째 함수 인자
%r10    %r10d   %r10w   %r10b   ← Caller-saved
%r11    %r11d   %r11w   %r11b   ← Caller-saved
%r12    %r12d   %r12w   %r12b   ← Callee-saved
%r13    %r13d   %r13w   %r13b   ← Callee-saved
%r14    %r14d   %r14w   %r14b   ← Callee-saved
%r15    %r15d   %r15w   %r15b   ← Callee-saved
```

---

## 2. 레지스터의 크기 관계

하나의 물리 레지스터에 여러 이름으로 접근할 수 있습니다.

```
rax (64비트):
┌─────────────────────────────────────┐
│               rax (64비트)           │
│         ┌──────────────────┐        │
│         │     eax (32비트)  │        │
│         │   ┌────────┐     │        │
│         │   │ ax(16) │     │        │
│         │   │ ah │ al│     │        │
│         │   │ (8)│(8)│     │        │
│         │   └────────┘     │        │
│         └──────────────────┘        │
└─────────────────────────────────────┘
```

> **중요**: 32비트 연산(`movl`, `addl` 등)은 자동으로 상위 32비트를 0으로 초기화합니다.  
> 하지만 8비트/16비트 연산은 상위 비트를 건드리지 않습니다.

```asm
movq $0xDEADBEEFCAFEBABE, %rax  # rax = 0xDEADBEEFCAFEBABE
movl $0x12345678, %eax          # rax = 0x0000000012345678 (상위 초기화!)
movw $0xABCD, %ax               # rax = 0x000000001234ABCD (상위 유지)
movb $0xFF, %al                 # rax = 0x00000000123ABCFF (상위 유지)
```

---

## 3. 특수 레지스터

### 3.1 %rsp (Stack Pointer)

스택의 **최상단(Top)을 가리키는 포인터**. x86-64에서 스택은 높은 주소에서 낮은 주소 방향으로 성장합니다.

```asm
pushq %rax    # %rsp -= 8; M[%rsp] = %rax
popq  %rbx    # %rbx = M[%rsp]; %rsp += 8
```

절대 임의로 변경하면 안 됩니다. 함수 내에서 지역변수 공간 확보에 사용됩니다.

```asm
subq $16, %rsp   # 지역변수 16바이트 공간 확보
# ... 사용 ...
addq $16, %rsp   # 반환 전 원상복구
```

### 3.2 %rbp (Base/Frame Pointer)

**현재 스택 프레임의 기준점**. 함수의 로컬 변수와 인자 접근에 사용됩니다.

```asm
# 함수 프롤로그
pushq %rbp        # 이전 rbp 저장
movq  %rsp, %rbp  # rbp = 현재 스택 탑 (프레임 시작)

# 로컬 변수 접근
movq -8(%rbp), %rax   # 첫 번째 로컬 변수
movq -16(%rbp), %rbx  # 두 번째 로컬 변수

# 함수 에필로그
movq %rbp, %rsp   # 스택 복원
popq %rbp         # 이전 rbp 복원
ret
```

`-O2` 이상 최적화에서는 보통 `-fomit-frame-pointer` 가 활성화되어 rbp를 범용 레지스터로 사용합니다.

### 3.3 %rip (Instruction Pointer / Program Counter)

**다음 실행할 명령어의 주소**를 가리킵니다. 직접 수정할 수 없고, `jmp`, `call`, `ret`에 의해 변경됩니다.

```asm
# RIP-relative addressing (위치 독립 코드에서 전역 변수 접근)
movq value(%rip), %rax   # rax = M[rip + offset_of_value]
```

---

## 4. 조건 코드 레지스터 (EFLAGS)

CPU는 산술/논리 연산 결과에 따라 **조건 코드(Condition Code)**를 설정합니다.

| 플래그 | 이름 | 설명 |
|-------|------|------|
| CF | Carry Flag | 부호 없는 오버플로우 |
| ZF | Zero Flag | 결과가 0일 때 |
| SF | Sign Flag | 결과가 음수일 때 (최상위 비트) |
| OF | Overflow Flag | 부호 있는 오버플로우 |

```asm
cmpq %rbx, %rax    # rax - rbx 수행, 플래그 설정
je   equal_label   # ZF=1 이면 점프 (rax == rbx)
jl   less_label    # SF≠OF 이면 점프 (rax < rbx, signed)
jb   below_label   # CF=1 이면 점프 (rax < rbx, unsigned)
```

---

## 5. 함수 호출 규약에서의 레지스터 역할

Linux x86-64 System V ABI:

### 5.1 인자 전달 순서

```
1번째 인자: %rdi
2번째 인자: %rsi
3번째 인자: %rdx
4번째 인자: %rcx
5번째 인자: %r8
6번째 인자: %r9
7번째 이후: 스택
```

```c
// long func(long a, long b, long c, long d, long e, long f, long g)
// a → %rdi, b → %rsi, c → %rdx, d → %rcx, e → %r8, f → %r9
// g → 스택
```

### 5.2 Caller-saved vs Callee-saved

**Caller-saved (호출자가 저장 책임)**:
- `%rax`, `%rcx`, `%rdx`, `%rsi`, `%rdi`, `%r8`-`%r11`
- 함수 호출 후 값이 바뀔 수 있으므로, 호출자가 필요하면 미리 저장

**Callee-saved (피호출자가 저장 책임)**:
- `%rbx`, `%rbp`, `%r12`-`%r15`
- 함수가 이 레지스터를 사용하면, 반환 전 반드시 원래 값 복원

```asm
func:
    pushq %rbx        # callee-saved: 저장
    pushq %r12        # callee-saved: 저장
    # ... rbx, r12 사용 ...
    popq  %r12        # 복원
    popq  %rbx        # 복원
    ret
```

---

## 6. 반환값

```
정수/포인터 반환: %rax
큰 구조체 반환:   숨겨진 포인터 인자 (호출자가 공간 제공)
부동소수점 반환:  %xmm0 (SSE 레지스터)
```

---

## 핵심 요약

- **16개 범용 레지스터**: `%rax`~`%r15`. 각 레지스터는 64/32/16/8비트 뷰 제공.
- **`%rsp`**: 스택 포인터. 스택은 아래로 성장. `push/pop`으로 조작.
- **`%rbp`**: 프레임 포인터. 함수 내 지역변수 접근 기준점.
- **`%rip`**: 프로그램 카운터. 직접 수정 불가.
- **인자 순서**: `rdi, rsi, rdx, rcx, r8, r9` (7번째부터 스택).
- **Callee-saved**: `rbx, rbp, r12-r15` → 함수가 바꾸면 반환 전 복원 의무.
