---
title: "데이터 이동 명령어: MOV, PUSH, POP"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "assembly", "mov", "push", "pop", "x86-64", "csapp"]
---

## 데이터 이동 명령어

데이터 이동 명령어는 레지스터와 메모리 사이에서 데이터를 복사합니다. 어셈블리에서 가장 자주 등장하는 명령어군입니다.

---

## 1. MOV 명령어

### 1.1 기본 MOV

```asm
movq Src, Dst   # Dst ← Src

# 가능한 조합 (메모리 → 메모리는 불가)
movq $42, %rax         # 즉시값 → 레지스터
movq %rax, %rbx        # 레지스터 → 레지스터
movq %rax, (%rbx)      # 레지스터 → 메모리
movq (%rbx), %rax      # 메모리 → 레지스터
movq $42, (%rbx)       # 즉시값 → 메모리
```

> **규칙**: 한 명령어에서 **출처와 목적지가 동시에 메모리일 수 없습니다**.  
> 메모리 → 메모리 복사는 레지스터를 거쳐야 합니다.

```asm
# 메모리 복사 (레지스터 중간 단계 필요)
movq (%rsi), %rax      # 메모리 → 레지스터
movq %rax, (%rdi)      # 레지스터 → 메모리
```

### 1.2 MOVZ (Zero-Extension, 부호 없는 확장)

작은 타입을 큰 타입으로 **0으로 확장**.

```asm
movzbq %al, %rax    # 8비트 → 64비트 (상위 56비트를 0으로)
movzwq %ax, %rax    # 16비트 → 64비트
movzbl %al, %eax    # 8비트 → 32비트

# 예:
# al = 0b11110000 (= -16 부호 있는, = 240 부호 없는)
movzbq %al, %rax
# rax = 0x00000000000000F0 (= 240, 상위 비트 0으로 채움)
```

### 1.3 MOVS (Sign-Extension, 부호 있는 확장)

**부호 비트로 확장** (음수의 1이 상위 비트로 채워짐).

```asm
movsbq %al, %rax    # 8비트 → 64비트 (부호 확장)
movswq %ax, %rax    # 16비트 → 64비트
movslq %eax, %rax   # 32비트 → 64비트

# 예:
# al = 0b11110000 (= -16, 부호 있는)
movsbq %al, %rax
# rax = 0xFFFFFFFFFFFFFFF0 (= -16, 부호 비트 1로 채움)

# al = 0b01110000 (= 112, 양수)
movsbq %al, %rax
# rax = 0x0000000000000070 (= 112, 부호 비트 0으로 채움)
```

### 1.4 MOVABS (64비트 즉시값 이동)

```asm
movabsq $0xDEADBEEFCAFEBABE, %rax  # 64비트 상수를 레지스터로
```

일반 `movq`는 32비트 부호 확장 상수만 지원. 64비트 상수는 `movabsq` 필요.

---

## 2. PUSH / POP 명령어

스택은 메모리의 한 영역으로, `%rsp`(Stack Pointer)가 최상단을 가리킵니다. **스택은 높은 주소에서 낮은 주소로 성장**합니다.

### 2.1 PUSHQ

```asm
pushq %rax
```

동작:
```
1. %rsp ← %rsp - 8
2. M[%rsp] ← %rax
```

```asm
# pushq %rax 와 동일
subq $8, %rsp
movq %rax, (%rsp)
```

### 2.2 POPQ

```asm
popq %rbx
```

동작:
```
1. %rbx ← M[%rsp]
2. %rsp ← %rsp + 8
```

```asm
# popq %rbx 와 동일
movq (%rsp), %rbx
addq $8, %rsp
```

### 2.3 스택 동작 예시

```
초기 상태:        pushq $1:         pushq $2:
rsp → [0x100]    rsp → [0x0F8] 1   rsp → [0x0F0] 2
      [0x0F8]          [0x100]           [0x0F8] 1
      [0x0F0]          [0x0F8]           [0x100]

popq %rax:        (rax = 2)
rsp → [0x0F8] 1   (스택에서 2 제거)
      [0x100]
```

---

## 3. 기타 이동 명령어

### 3.1 LEA (Load Effective Address)

주소를 **계산하여 레지스터에 저장**. 메모리를 실제로 읽지 않습니다. 컴파일러가 **산술 연산 단축**에 자주 활용합니다.

```asm
leaq (%rdi, %rdi, 2), %rax    # rax = rdi + rdi×2 = 3×rdi (곱셈 없이!)
leaq 4(%rsp), %rdi            # rdi = rsp + 4

# 컴파일러의 레아 활용 (x * 5 최적화)
# long f(long x) { return x * 5; }
leaq (%rdi, %rdi, 4), %rax    # rax = x + x×4 = 5×x (imulq 없이!)
```

> **MOV vs LEA 차이**:
> ```asm
> movq (%rax), %rbx   # rbx ← M[rax] (메모리에서 읽음)
> leaq (%rax), %rbx   # rbx ← rax (주소를 저장, 메모리 접근 없음)
> ```

### 3.2 XCHG (Exchange)

두 피연산자의 값을 교환. (임시 변수 없이 스왑)

```asm
xchgq %rax, %rbx    # rax, rbx 값 교환
```

### 3.3 CMPXCHG (Compare and Exchange)

원자적 비교-교환. 멀티스레드 동기화에 핵심.

```asm
# if (rax == M[rbx]) M[rbx] = rcx; else rax = M[rbx];
lock cmpxchgq %rcx, (%rbx)
```

---

## 4. C 코드와 어셈블리 대응

```c
long f(long *p, long x) {
    long old = *p;   // 메모리에서 읽기
    *p = x;          // 메모리에 쓰기
    return old;
}
```

```asm
f:
    movq (%rdi), %rax    # rax = *p (rdi는 첫 번째 인자 p)
    movq %rsi, (%rdi)    # *p = x  (rsi는 두 번째 인자 x)
    ret                  # return rax (old)
```

---

## 핵심 요약

- **MOV**: 레지스터↔레지스터, 레지스터↔메모리, 즉시값→레지스터/메모리. 단 메모리→메모리는 불가.
- **MOVZ**: 0 확장 (unsigned 의미). MOVS: 부호 확장 (signed 의미).
- **PUSH**: `rsp -= 8; M[rsp] = src`. POP: `dst = M[rsp]; rsp += 8`.
- **LEA**: 주소 계산을 산술 연산에 활용. 메모리 접근 없음.
- 스택은 높은 주소 → 낮은 주소 방향. `rsp`는 항상 스택의 최상단.
