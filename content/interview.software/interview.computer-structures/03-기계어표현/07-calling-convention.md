---
title: "함수 호출 규약(Calling Convention): 인자 전달과 반환값"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "calling-convention", "abi", "x86-64", "csapp"]
---

## 함수 호출 규약 (Calling Convention)

호출 규약은 **함수를 어떻게 호출하고, 인자를 어떻게 전달하고, 결과를 어떻게 반환하는가**에 대한 약속입니다. 이 규약이 없으면 다른 언어/컴파일러로 컴파일된 함수를 서로 호출할 수 없습니다.

Linux x86-64의 표준은 **System V AMD64 ABI**입니다.

---

## 1. 인자 전달 규칙

### 1.1 정수/포인터 인자

첫 6개는 레지스터로, 7번째부터는 스택으로 전달합니다.

```
1번째: %rdi
2번째: %rsi
3번째: %rdx
4번째: %rcx
5번째: %r8
6번째: %r9
7번째~: 스택 (오른쪽→왼쪽 순서로 push)
```

```c
long func(long a, long b, long c, long d, long e, long f, long g, long h);
//         rdi   rsi   rdx   rcx   r8    r9    stack  stack
```

### 1.2 7번째 이상 인자 (스택 전달)

```c
long f(int a1, int a2, int a3, int a4, int a5, int a6, int a7, int a8) {
    return a1 + a7 + a8;
}
```

```asm
# 호출자 (caller)
movl  $7, 8(%rsp)   # a8: rsp+8에 저장 (7번째 인자보다 위)
movl  $7, (%rsp)    # a7: rsp에 저장
movl  $6, %r9d
movl  $5, %r8d
movl  $4, %ecx
movl  $3, %edx
movl  $2, %esi
movl  $1, %edi
call  f

# 피호출자 (callee)에서:
# a7 = 16(%rbp)  (반환 주소 8바이트 + 저장된 rbp 8바이트)
# a8 = 24(%rbp)
```

---

## 2. 반환값 규칙

```
정수/포인터 반환값: %rax
64비트보다 큰 반환값: rdx:rax (rdx: 상위, rax: 하위)
부동소수점: %xmm0
구조체 반환: 숨겨진 포인터 (첫 번째 인자로 전달)
```

```c
// 구조체 반환 시
typedef struct { long x, y; } Point;

Point make_point(long x, long y) {
    return (Point){x, y};
}

// 어셈블리 레벨에서:
// void make_point(Point *ret, long x, long y)
// rdi = 결과를 저장할 메모리 주소 (숨겨진 첫 번째 인자)
// rsi = x, rdx = y
```

---

## 3. 레지스터 저장 책임

### 3.1 Caller-saved (호출자 저장 책임)

함수를 호출하면 이 레지스터 값이 바뀔 수 있습니다. 호출자가 필요하면 미리 저장해야 합니다.

```
%rax, %rcx, %rdx, %rsi, %rdi, %r8, %r9, %r10, %r11
```

```c
// 컴파일러가 자동으로 처리
void caller() {
    long x = compute();      // x가 rax에
    long y = other_func(x);  // 호출 전 rax를 스택에 저장, 호출 후 복원
    use(x, y);
}
```

### 3.2 Callee-saved (피호출자 저장 책임)

피호출자(함수)가 이 레지스터를 사용하면, **반환 전에 반드시 원래 값으로 복원**해야 합니다.

```
%rbx, %rbp, %r12, %r13, %r14, %r15
```

```asm
func_using_rbx:
    pushq %rbx       # rbx 원래 값 저장 (prologue)
    movq  %rdi, %rbx # rbx 사용
    # ... 긴 계산 ...
    movq  %rbx, %rax # 반환값
    popq  %rbx        # rbx 복원 (epilogue)
    ret
```

---

## 4. 스택 정렬 요구사항

System V ABI는 **CALL 명령어 실행 전(직전), 스택이 16바이트로 정렬**되어야 합니다.

```
CALL 전: %rsp % 16 == 0  (16바이트 정렬)
CALL 후: 반환 주소(8바이트)가 push 되어 %rsp % 16 == 8
함수 진입 시 프롤로그에서 rbp push: %rsp % 16 == 0 (다시 정렬)
```

이는 SSE/AVX 명령어가 16바이트 정렬된 메모리를 요구하기 때문입니다.

```asm
caller:
    subq $8, %rsp    # 더미 패딩으로 정렬 맞추기
    call func
    addq $8, %rsp
```

---

## 5. 실제 예시: 복잡한 함수 호출

```c
long multstore(long x, long y, long *dest) {
    long t = mult2(x, y);
    *dest = t;
    return t;
}

long mult2(long a, long b) {
    long s = a * b;
    return s;
}
```

```asm
multstore:
    pushq %rbx          # callee-saved (dest를 보존하기 위해)
    movq  %rdx, %rbx    # rbx = dest (call 후에도 필요하므로 callee-saved에 저장)
    # rdi=x, rsi=y (mult2에 그대로 전달 가능)
    call  mult2          # rax = x*y
    movq  %rax, (%rbx)  # *dest = t
    popq  %rbx           # dest 복원 (실제로는 이미 사용했으므로 복원만)
    ret
    # rax = t (mult2 반환값이 rax에 그대로 있음)

mult2:
    imulq %rsi, %rdi    # rdi = a*b
    movq  %rdi, %rax    # rax = 결과
    ret
```

---

## 6. Windows vs Linux 차이

| | Linux (System V AMD64) | Windows (Microsoft x64) |
|--|----------------------|------------------------|
| 첫 4 정수 인자 | rdi, rsi, rdx, rcx | rcx, rdx, r8, r9 |
| 스택 섀도우 공간 | 없음 | 32바이트 필수 |
| Callee-saved | rbx, rbp, r12-r15 | rbx, rbp, rdi, rsi, r12-r15 |
| 부동소수점 인자 | xmm0-xmm7 | xmm0-xmm3 |

---

## 핵심 요약

- **인자 순서**: `rdi, rsi, rdx, rcx, r8, r9` → 스택 (7번째부터).
- **반환값**: `rax` (정수), `xmm0` (부동소수점).
- **Caller-saved**: `rax, rcx, rdx, rsi, rdi, r8-r11` → 호출자가 보존 책임.
- **Callee-saved**: `rbx, rbp, r12-r15` → 피호출자가 사용 전 저장, 반환 전 복원.
- **스택 정렬**: CALL 전 16바이트 정렬 필수.
