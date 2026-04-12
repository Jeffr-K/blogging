---
title: "산술 및 논리 연산 명령어 (ADD, SUB, IMUL, LEA)"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "assembly", "arithmetic", "x86-64", "csapp"]
---

## 산술 및 논리 연산 명령어

x86-64의 산술 연산 명령어들은 결과를 피연산자에 저장하고, 조건 코드(EFLAGS)를 자동으로 업데이트합니다.

---

## 1. 단항 연산 (Unary Operations)

피연산자가 하나. 레지스터 또는 메모리 피연산자.

```asm
incq %rax        # rax++ (rax = rax + 1)
decq %rax        # rax-- (rax = rax - 1)
negq %rax        # rax = -rax (2의 보수)
notq %rax        # rax = ~rax (비트 반전)

# 메모리 피연산자도 가능
incq (%rsp)      # M[rsp]++
negq -8(%rbp)    # M[rbp-8] = -M[rbp-8]
```

---

## 2. 이항 연산 (Binary Operations)

```
Op Src, Dst   →   Dst = Dst Op Src
```

### 2.1 덧셈과 뺄셈

```asm
addq %rbx, %rax    # rax += rbx
addq $16, %rsp     # rsp += 16 (스택 공간 해제)
subq %rbx, %rax    # rax -= rbx
subq $8, %rsp      # rsp -= 8  (스택 공간 확보)
```

### 2.2 곱셈

**부호 있는 곱셈 (IMUL)**:

```asm
# 2-피연산자 형태: Dst *= Src (64비트 결과)
imulq %rbx, %rax    # rax = rax × rbx

# 3-피연산자 형태: Dst = Src × Imm
imulq $3, %rdi, %rax  # rax = rdi × 3

# 1-피연산자 형태: rdx:rax = rax × Src (128비트 결과)
imulq %rbx            # rdx:rax = rax × rbx (높은 64비트 → rdx, 낮은 64비트 → rax)
```

**부호 없는 곱셈 (MUL)**:

```asm
mulq %rbx    # rdx:rax = rax × rbx (부호 없는)
```

### 2.3 나눗셈

나눗셈은 `rdx:rax`를 피제수로 사용합니다.

```asm
# 64비트 나눗셈 준비
movq $-17, %rax     # rax = -17
cqto                 # rax를 rdx:rax로 부호 확장 (Convert Quad To Oct)
# 또는: cqo

movq $5, %rcx
idivq %rcx           # rdx:rax / rcx
                     # 몫 → rax = -3
                     # 나머지 → rdx = -2

# 부호 없는 나눗셈
xorq %rdx, %rdx      # rdx = 0 (상위 64비트 초기화)
movq $17, %rax
divq %rcx            # rax = 17/5 = 3, rdx = 2
```

---

## 3. 논리 연산

```asm
andq %rbx, %rax    # rax &= rbx (AND)
orq  %rbx, %rax    # rax |= rbx (OR)
xorq %rbx, %rax    # rax ^= rbx (XOR)
notq %rax          # rax = ~rax (NOT)
```

**XOR 초기화 관용구**:
```asm
xorq %rax, %rax    # rax = 0 (rax XOR rax = 0, movq $0, %rax 보다 1바이트 작음)
```

---

## 4. 쉬프트 연산

```asm
salq $3, %rax      # rax <<= 3 (Shift Arithmetic Left, = 8배)
shlq $3, %rax      # 위와 동일 (SAL = SHL)
sarq $3, %rax      # rax >>= 3 (Shift Arithmetic Right, 부호 유지)
shrq $3, %rax      # rax >>= 3 (Shift logical Right, 0으로 채움)

# 변수 쉬프트 (cl 레지스터로 쉬프트 양 지정)
movl $5, %ecx
salq %cl, %rax     # rax <<= cl (= rax <<= 5)
```

---

## 5. LEA를 이용한 산술 최적화

`leaq`는 메모리 접근 없이 주소 계산만 수행합니다. 컴파일러는 이를 복잡한 산술 단축에 적극 활용합니다.

```c
// long scale(long x, long y, long z) { return x + 4*y + 48*z; }
```

```asm
scale:
    leaq (%rdi, %rsi, 4), %rax    # rax = x + 4*y
    leaq (%rdx, %rdx, 2), %rdx   # rdx = z + 2*z = 3*z
    leaq (%rax, %rdx, 16), %rax  # rax = (x+4y) + 16*(3z) = x+4y+48z
    ret
```

단 3개의 leaq로 곱셈과 덧셈을 처리합니다.

### 가능한 스케일 값

```
leaq (Rb, Ri, s), Dst   where s ∈ {1, 2, 4, 8}
```

- `s=1`: Rb + Ri (배열 원소 접근)
- `s=2`: Rb + 2×Ri (short 배열)
- `s=4`: Rb + 4×Ri (int 배열)
- `s=8`: Rb + 8×Ri (long/포인터 배열)

---

## 6. 조건 코드 영향

대부분의 산술/논리 명령어는 EFLAGS를 업데이트합니다.

| 명령어 | CF | ZF | SF | OF |
|--------|----|----|----|----|
| ADD | ✓ | ✓ | ✓ | ✓ |
| SUB | ✓ | ✓ | ✓ | ✓ |
| INC/DEC | - | ✓ | ✓ | ✓ |
| NEG | ✓ | ✓ | ✓ | ✓ |
| AND/OR/XOR | 0 | ✓ | ✓ | 0 |
| SAR/SHR | ✓ | ✓ | ✓ | ✓ |
| LEA | - | - | - | - |

> **LEA는 플래그를 변경하지 않습니다**. 이것이 LEA를 산술에 활용하는 또 다른 이유입니다.

---

## 7. C 코드 예시 변환

```c
long arith(long x, long y, long z) {
    long t1 = x + y;
    long t2 = z + t1;
    long t3 = x + 4;
    long t4 = y * 48;
    long t5 = t3 + t4;
    return t2 * t5;
}
```

```asm
arith:
    leaq (%rdi, %rsi), %rax     # t1 = x + y
    addq %rdx, %rax             # t2 = z + t1
    leaq (%rsi, %rsi, 2), %rcx # rcx = 3*y
    salq $4, %rcx               # t4 = 48*y (3*y << 4)
    leaq 4(%rdi, %rcx), %rcx   # t5 = x+4 + t4
    imulq %rcx, %rax            # result = t2 * t5
    ret
```

---

## 핵심 요약

- **단항**: `inc`, `dec`, `neg`, `not`. 피연산자 하나를 변경.
- **이항**: `add`, `sub`, `imul`. 형태: `Op Src, Dst` → `Dst = Dst Op Src`.
- **나눗셈**: `idivq Divisor`. 피제수는 `rdx:rax`. 몫→`rax`, 나머지→`rdx`. 반드시 `cqto` 선행.
- **LEA**: 곱셈 + 덧셈을 단일 명령어로. 플래그 미변경.
- **XOR 자기자신**: 0으로 초기화 관용구 (`xorq %rax, %rax`).
