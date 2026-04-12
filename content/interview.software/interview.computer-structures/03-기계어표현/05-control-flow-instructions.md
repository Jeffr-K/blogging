---
title: "제어 흐름: 조건 코드(Condition Code)와 조건 분기 (JMP, JE, JNE)"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "assembly", "control-flow", "jump", "condition-code", "csapp"]
---

## 제어 흐름 명령어

프로그램의 if/else, 반복문, 함수 호출은 어셈블리 레벨에서 **조건 코드**와 **분기 명령어**로 구현됩니다.

---

## 1. 조건 코드 (Condition Code / EFLAGS)

산술/논리 연산이 수행될 때 CPU는 자동으로 **EFLAGS 레지스터**의 조건 코드를 업데이트합니다.

| 플래그 | 이름 | 설명 |
|-------|------|------|
| CF | Carry Flag | unsigned 덧셈 오버플로우 or 뺄셈 빌림 발생 |
| ZF | Zero Flag | 결과 = 0 |
| SF | Sign Flag | 결과의 최상위 비트 = 1 (음수) |
| OF | Overflow Flag | signed 오버플로우 발생 |

### CMP와 TEST

조건 코드만 설정하고 결과는 버리는 특수 명령어:

```asm
cmpq %rsi, %rdi     # rdi - rsi 계산, 플래그만 업데이트
testq %rdi, %rdi    # rdi & rdi 계산, 플래그만 업데이트 (0 확인에 사용)
```

---

## 2. 조건부 점프 (Conditional Jump)

### 2.1 부호 있는 비교 (Signed Comparison)

```asm
# cmpq Src2, Src1  (Src1 - Src2 수행 후 플래그 확인)
cmpq %rbx, %rax   # rax - rbx

je   label   # rax == rbx  (ZF = 1)
jne  label   # rax != rbx  (ZF = 0)
jl   label   # rax <  rbx  (SF ≠ OF)
jle  label   # rax <= rbx  (SF ≠ OF or ZF = 1)
jg   label   # rax >  rbx  (ZF = 0 and SF = OF)
jge  label   # rax >= rbx  (SF = OF)
```

### 2.2 부호 없는 비교 (Unsigned Comparison)

```asm
jb   label   # rax <  rbx  (CF = 1)     "below"
jbe  label   # rax <= rbx  (CF = 1 or ZF = 1)
ja   label   # rax >  rbx  (CF = 0 and ZF = 0)  "above"
jae  label   # rax >= rbx  (CF = 0)
```

### 2.3 무조건 점프

```asm
jmp  label   # 항상 점프
jmp  *%rax   # 간접 점프 (rax에 저장된 주소로)
jmp  *(%rax) # 간접 점프 (rax가 가리키는 메모리의 값으로)
```

---

## 3. if/else 컴파일 패턴

### 3.1 기본 if/else

```c
long absdiff(long x, long y) {
    if (x > y) return x - y;
    else return y - x;
}
```

```asm
absdiff:
    cmpq  %rsi, %rdi    # x - y 비교
    jle   .L1           # x <= y 이면 .L1으로
    movq  %rdi, %rax
    subq  %rsi, %rax    # rax = x - y
    ret
.L1:
    movq  %rsi, %rax
    subq  %rdi, %rax    # rax = y - x
    ret
```

### 3.2 조건부 이동 (CMOV) — 분기 없는 최적화

현대 CPU는 파이프라인을 사용하기 때문에 분기 예측 실패 시 비용이 큽니다. 컴파일러는 가능하면 **CMOV(Conditional Move)**를 사용해 분기를 제거합니다.

```asm
# 위의 absdiff를 CMOV로 최적화
absdiff:
    movq %rdi, %rax
    subq %rsi, %rax    # rax = x - y
    movq %rsi, %rdx
    subq %rdi, %rdx    # rdx = y - x
    cmpq %rsi, %rdi    # x - y 비교
    cmovle %rdx, %rax  # x <= y 이면 rax = rdx (분기 없음!)
    ret
```

| CMOV 명령어 | 조건 | 설명 |
|------------|------|------|
| `cmove` | ZF=1 | equal |
| `cmovne` | ZF=0 | not equal |
| `cmovl` | SF≠OF | less |
| `cmovg` | ZF=0 && SF=OF | greater |
| `cmovle` | SF≠OF or ZF=1 | less or equal |

---

## 4. 반복문 (Loop) 컴파일 패턴

### 4.1 while 루프

```c
long count_ones(unsigned long x) {
    long count = 0;
    while (x != 0) {
        count += x & 1;
        x >>= 1;
    }
    return count;
}
```

```asm
count_ones:
    movl  $0, %eax        # count = 0
    jmp   .Ltest          # 조건 먼저 확인 (do-while로 변환)
.Lloop:
    movq  %rdi, %rcx
    andl  $1, %ecx        # rcx = x & 1
    addq  %rcx, %rax      # count += x & 1
    shrq  %rdi            # x >>= 1
.Ltest:
    testq %rdi, %rdi      # x != 0?
    jne   .Lloop          # 아니면 루프 계속
    ret
```

컴파일러는 while을 `if (조건 false) goto 끝; do { ... } while (조건);` 패턴으로 변환합니다.

### 4.2 for 루프

```c
long sum(long n) {
    long result = 0;
    for (long i = 0; i < n; i++) {
        result += i;
    }
    return result;
}
```

```asm
sum:
    testq %rdi, %rdi    # n <= 0?
    jle   .Ldone
    movl  $0, %eax      # result = 0
    movl  $0, %ecx      # i = 0
.Lloop:
    addq  %rcx, %rax    # result += i
    incq  %rcx          # i++
    cmpq  %rdi, %rcx    # i < n?
    jl    .Lloop
.Ldone:
    ret
```

---

## 5. switch 문 컴파일 패턴

switch 문은 케이스가 많을 때 **점프 테이블(Jump Table)**로 최적화됩니다.

```c
long switch_eg(long x) {
    switch (x) {
        case 1: return x * 2;
        case 2: return x + 3;
        case 3: return x - 1;
        default: return 0;
    }
}
```

```asm
switch_eg:
    cmpq  $3, %rdi      # x > 3?
    ja    .Ldefault
    jmp   *.Ltable(, %rdi, 8)   # 점프 테이블 인덱싱

.Ltable:
    .quad .Ldefault   # x=0
    .quad .Lcase1     # x=1
    .quad .Lcase2     # x=2
    .quad .Lcase3     # x=3

.Lcase1:
    leaq (%rdi, %rdi), %rax  # x * 2
    ret
.Lcase2:
    leaq 3(%rdi), %rax       # x + 3
    ret
.Lcase3:
    leaq -1(%rdi), %rax      # x - 1
    ret
.Ldefault:
    movl $0, %eax
    ret
```

**점프 테이블의 장점**: O(1) 시간으로 케이스 선택. 케이스가 많을수록 if-else 체인보다 훨씬 빠름.

---

## 핵심 요약

- **CMP**: 뺄셈으로 플래그 설정 (결과 버림). **TEST**: AND로 플래그 설정.
- **조건 점프**: `je/jne/jl/jg` (signed), `jb/ja` (unsigned).
- **CMOV**: 분기 없이 조건부로 값 선택. 분기 예측 실패 비용 회피.
- **while 루프**: 컴파일러가 `do-while`+`if` 패턴으로 변환.
- **switch**: 케이스 범위가 조밀하면 점프 테이블로 O(1) 선택.
