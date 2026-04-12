---
title: "프로시저 호출과 스택 프레임 (Stack Frame) 구조"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "stack", "stack-frame", "procedure", "x86-64", "csapp"]
---

## 스택 프레임 (Stack Frame)

함수(프로시저)가 호출될 때마다 스택에 **스택 프레임(Stack Frame, Activation Record)**이 생성됩니다. 스택 프레임은 함수가 실행되는 데 필요한 모든 정보를 담습니다.

---

## 1. 스택의 방향

x86-64에서 스택은 **높은 주소에서 낮은 주소로 성장**합니다.

```
높은 주소 ↑
┌──────────────────────┐
│    이전 함수 프레임    │
├──────────────────────┤ ← 이전 %rsp (= 현재 %rbp + 8)
│   반환 주소 (8바이트)  │ ← call 명령어가 자동으로 push
├──────────────────────┤ ← 현재 %rbp
│   저장된 %rbp (8바이트)│ ← pushq %rbp
├──────────────────────┤
│   지역 변수들         │
│   저장된 레지스터들   │
├──────────────────────┤ ← 현재 %rsp
│   (빈 공간)           │
낮은 주소 ↓
```

---

## 2. 함수 호출의 4단계

### 2.1 CALL 명령어

```asm
call func     # 1. pushq %rip  (다음 명령어 주소를 스택에 저장)
              # 2. jmp func    (함수 시작 주소로 점프)
```

### 2.2 함수 프롤로그 (Prologue)

함수 시작 시 스택 프레임을 설정합니다.

```asm
func:
    pushq %rbp          # 이전 프레임 포인터 저장
    movq  %rsp, %rbp    # 새로운 프레임 포인터 설정
    subq  $32, %rsp     # 지역 변수 공간 확보 (32바이트)
    pushq %rbx          # callee-saved 레지스터 저장
```

### 2.3 함수 본문 실행

```asm
    # 지역 변수는 -8(%rbp), -16(%rbp) 등으로 접근
    movq %rdi, -8(%rbp)   # 첫 번째 인자를 지역변수에 저장
    movq $0, -16(%rbp)    # 두 번째 지역변수 초기화
```

### 2.4 함수 에필로그 (Epilogue)

```asm
    popq %rbx           # callee-saved 레지스터 복원
    movq %rbp, %rsp     # 스택 포인터 복원
    popq %rbp           # 이전 프레임 포인터 복원
    ret                 # popq %rip (반환 주소로 점프)
```

`leave` 명령어는 `movq %rbp, %rsp` + `popq %rbp` 의 축약입니다.

---

## 3. 구체적 예시

```c
long caller(void) {
    long v1 = 10;
    long v2 = 20;
    long result = callee(v1, v2);
    return result;
}

long callee(long a, long b) {
    long local = a + b;
    return local;
}
```

**caller의 스택 프레임 설정**:
```asm
caller:
    pushq %rbp
    movq  %rsp, %rbp
    subq  $16, %rsp         # v1, v2 공간
    movq  $10, -8(%rbp)     # v1 = 10
    movq  $20, -16(%rbp)    # v2 = 20
    movq  -8(%rbp), %rdi    # 첫 번째 인자 = v1
    movq  -16(%rbp), %rsi   # 두 번째 인자 = v2
    call  callee
    # callee 반환 후 rax에 결과
    movq  %rax, %rax        # result = rax
    leave
    ret
```

**call 직후 스택 상태**:
```
높은 주소
┌─────────────────────────┐
│ caller의 v2 (-16(%rbp)) │ → 20
├─────────────────────────┤
│ caller의 v1 (-8(%rbp))  │ → 10
├─────────────────────────┤ ← caller의 %rbp
│ 저장된 caller의 %rbp    │
├─────────────────────────┤
│ 반환 주소 (callee 호출 후)│ ← callee 실행 시작 시 %rsp
├─────────────────────────┤ ← callee의 %rbp (pushq %rbp 후)
│ 저장된 caller의 %rbp    │
├─────────────────────────┤ ← callee의 %rsp
낮은 주소
```

---

## 4. 프레임 포인터 없는 방식 (-fomit-frame-pointer)

최적화 시 컴파일러는 `%rbp`를 범용 레지스터로 사용합니다. 대신 `%rsp` 기준으로 지역 변수에 접근합니다.

```asm
# -O2 컴파일 시
func:
    subq $16, %rsp          # 지역 변수 공간
    movq $10, (%rsp)        # v1 = 10  (rbp 없이 rsp 기준)
    movq $20, 8(%rsp)       # v2 = 20
    # ...
    addq $16, %rsp
    ret
```

**장점**: `%rbp`를 하나 더 사용 가능, 프롤로그/에필로그 단순화, 스택 프레임 1개 축소.  
**단점**: 디버거에서 스택 추적이 어려움 (디버그 빌드에서는 보통 비활성화).

---

## 5. 콜 스택 (Call Stack)

중첩 호출 시 스택 프레임이 쌓입니다.

```
main() 호출 → f() 호출 → g() 호출

높은 주소
┌──────────────┐
│  main 프레임 │
├──────────────┤
│  f() 프레임  │
├──────────────┤
│  g() 프레임  │ ← 현재 실행 중
└──────────────┘ ← 현재 %rsp
낮은 주소
```

각 함수가 반환하면 자신의 프레임이 소멸되고, 호출자로 돌아갑니다.

---

## 6. 스택 오버플로우

스택은 제한된 크기를 가집니다(일반적으로 8MB). 재귀가 너무 깊거나, 지역 변수가 너무 크면 스택이 부족해집니다.

```c
// 스택 오버플로우 예시
void infinite_recursion() {
    char buf[1024];  // 매 호출마다 1KB 스택 소비
    infinite_recursion();  // 끝없이 재귀 → segfault
}
```

```
// 스택이 힙과 만나는 순간:
SIGSEGV (Segmentation Fault) 발생
```

---

## 핵심 요약

- **스택 프레임**: 함수 호출 시 생성되는 메모리 영역. 반환 주소, 저장된 레지스터, 지역 변수, 인자 포함.
- **CALL**: `pushq %rip; jmp target`. RET: `popq %rip`.
- **프롤로그**: `pushq %rbp; movq %rsp, %rbp; subq $N, %rsp`.
- **에필로그**: `leave; ret` (= `movq %rbp, %rsp; popq %rbp; ret`).
- **콜 스택**: 중첩 호출 시 프레임이 쌓임. 깊은 재귀는 스택 오버플로우 위험.
