---
title: "재귀(Recursion)의 어셈블리 레벨 동작 원리"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "assembly", "recursion", "stack", "x86-64", "csapp"]
---

## 재귀의 어셈블리 레벨 동작

재귀 함수는 고수준 언어에서 우아해 보이지만, 어셈블리 레벨에서는 **단순한 함수 호출의 반복**입니다. 스택 프레임이 쌓이고, 기저 조건에서 언스택되는 과정을 이해하면 재귀의 메모리 비용을 정확히 파악할 수 있습니다.

---

## 1. 재귀 팩토리얼 예시

```c
long factorial(long n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
```

### 컴파일된 어셈블리

```asm
factorial:
    pushq %rbx          # rbx 보존 (callee-saved, n을 저장할 것이므로)
    movq  %rdi, %rbx    # rbx = n (재귀 호출 후에도 필요)
    
    cmpq  $1, %rdi      # n <= 1?
    jg    .Lrecurse     # n > 1이면 재귀로
    
    movl  $1, %eax      # return 1 (기저 조건)
    jmp   .Ldone
    
.Lrecurse:
    leaq  -1(%rdi), %rdi    # rdi = n - 1 (인자 준비)
    call  factorial          # factorial(n-1), 결과 rax에
    imulq %rbx, %rax         # rax = n * factorial(n-1)
    
.Ldone:
    popq  %rbx          # rbx 복원
    ret
```

---

## 2. 스택 동작 추적 (factorial(3))

```
main 호출: factorial(3)
──────────────────────────
호출 1: factorial(3)
  스택: [반환주소1][저장rbp][rbx=3]  → factorial(2) 호출

호출 2: factorial(2)
  스택: [반환주소1][저장rbp][rbx=3]
        [반환주소2][저장rbp][rbx=2]  → factorial(1) 호출

호출 3: factorial(1)
  스택: [반환주소1][저장rbp][rbx=3]
        [반환주소2][저장rbp][rbx=2]
        [반환주소3][저장rbp][rbx=1]  → 기저 조건! return 1

반환 3: rax=1, 스택에서 프레임 제거
  factorial(2): rax = 2 * 1 = 2, return 2

반환 2: rax=2, 스택에서 프레임 제거
  factorial(3): rax = 3 * 2 = 6, return 6

반환 1: rax=6, 최초 호출자로 반환
```

각 재귀 호출마다 스택에 약 24바이트가 추가됩니다(반환 주소 8 + 저장된 rbp 8 + rbx 8).

---

## 3. 재귀의 메모리 비용

```
factorial(n): n개의 스택 프레임 생성
각 프레임 크기: 약 24~32바이트
n=1000: 약 24KB ~ 32KB 스택 사용

일반 스택 크기: 8MB (Linux 기본값)
최대 재귀 깊이: 약 8MB / 24B ≈ 350,000 (단순 계산)
실제로는 훨씬 적음 (다른 스택 사용, 안전 마진 등)
```

---

## 4. 꼬리 재귀 최적화 (Tail Call Optimization, TCO)

재귀 호출이 함수의 **마지막 연산**이면 컴파일러가 새 스택 프레임을 만들지 않고 **현재 프레임을 재사용**합니다.

### 꼬리 재귀로 변환

```c
// 일반 재귀 (꼬리 재귀 아님: return n * factorial(n-1))
long factorial(long n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);  // 곱셈이 재귀 이후 → 꼬리 재귀 아님
}

// 꼬리 재귀로 변환 (누산기 사용)
long factorial_tail(long n, long acc) {
    if (n <= 1) return acc;
    return factorial_tail(n - 1, n * acc);  // 재귀가 마지막 → 꼬리 재귀!
}
long factorial(long n) { return factorial_tail(n, 1); }
```

### 꼬리 재귀의 어셈블리

```asm
factorial_tail:
    cmpq  $1, %rdi    # n <= 1?
    jle   .Ldone
    
    imulq %rdi, %rsi  # acc = n * acc
    decq  %rdi        # n = n - 1
    jmp   factorial_tail  # 새 스택 프레임 없이 점프! (TCO)
    
.Ldone:
    movq  %rsi, %rax  # return acc
    ret
```

꼬리 재귀는 `call`(새 프레임)이 아닌 `jmp`(재사용)로 컴파일됩니다. O(n) 스택 → O(1) 스택!

```bash
# GCC에서 꼬리 재귀 최적화 활성화
gcc -O2 -o program program.c   # -O2 이상에서 자동 최적화
gcc -foptimize-sibling-calls   # 명시적 활성화
```

---

## 5. 피보나치로 보는 재귀 트리

```c
long fib(long n) {
    if (n <= 1) return n;
    return fib(n-1) + fib(n-2);
}
```

이 경우 호출 트리는 지수적으로 증가합니다:

```
fib(4):
         fib(4)
        /       \
    fib(3)      fib(2)
    /    \      /    \
  fib(2) fib(1) fib(1) fib(0)
  /    \
fib(1) fib(0)
```

`fib(n)` 호출 횟수: O(2^n). 스택 깊이: O(n) (DFS 방식으로 탐색).

이 경우 재귀보다 메모이제이션(Memoization) 또는 반복문이 훨씬 효율적입니다.

---

## 6. 재귀 vs 반복문 선택 기준

| 상황 | 권장 |
|------|------|
| 트리/그래프 탐색 | 재귀 (코드 명확성) |
| 팩토리얼, 피보나치 | 반복문 (성능) |
| 분할정복 (병합정렬, 퀵정렬) | 재귀 |
| 깊이가 매우 깊을 수 있는 경우 | 반복문 (스택 오버플로우 방지) |
| 꼬리 재귀 + TCO 지원 언어 | 재귀 가능 (Haskell, Scheme 등) |

---

## 핵심 요약

- **재귀 = 반복적인 스택 프레임 생성**: 매 호출마다 반환 주소 + 저장 레지스터 + 지역변수 공간.
- **메모리 비용**: 재귀 깊이 n → O(n) 스택 사용.
- **꼬리 재귀(Tail Call)**: 마지막 연산이 재귀 호출 → 컴파일러가 `jmp`로 최적화 → O(1) 스택.
- **스택 오버플로우**: 너무 깊은 재귀는 스택을 소진. `SIGSEGV` 발생.
- GCC `-O2` 이상에서 꼬리 재귀를 자동으로 반복문으로 변환합니다.
