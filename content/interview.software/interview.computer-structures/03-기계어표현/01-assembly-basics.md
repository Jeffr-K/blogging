---
title: "어셈블리(Assembly) 언어 기초: 레지스터, 피연산자, 명령어"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "assembly", "x86-64", "registers", "csapp"]
---

## 어셈블리 언어 기초

어셈블리 언어는 기계어와 1:1로 대응하는 저수준 언어입니다. C 코드가 컴파일러에 의해 어셈블리로 변환되기 때문에, 어셈블리를 읽을 줄 알면 컴파일러의 최적화를 이해하고, 성능 분석을 하고, 보안 취약점을 분석하는 데 도움이 됩니다.

---

## 1. AT&T 문법 vs Intel 문법

어셈블리에는 두 가지 문법이 있습니다. GCC는 AT&T 문법을 기본으로 사용합니다.

```asm
; Intel 문법 (NASM, 윈도우)
mov rax, 42       ; 목적지, 출처

; AT&T 문법 (GCC, Linux)
movq $42, %rax    ; 출처, 목적지 (순서 반대!)
```

| 특징 | AT&T (GCC) | Intel (NASM) |
|------|-----------|--------------|
| 피연산자 순서 | 출처, 목적지 | 목적지, 출처 |
| 레지스터 | `%rax` | `rax` |
| 상수 | `$42` | `42` |
| 크기 접미사 | `movq`, `movl` | 없음 (문맥 판단) |
| 메모리 | `(%rax)` | `[rax]` |

이 글은 GCC가 생성하는 **AT&T 문법**을 기준으로 합니다.

---

## 2. 피연산자 종류

x86-64 명령어의 피연산자는 세 가지 종류입니다.

### 2.1 즉시값 (Immediate)

명령어에 직접 포함된 상수. `$` 접두사.

```asm
movq $42, %rax      # rax ← 42
movq $0xFF, %rbx    # rbx ← 255
addq $8, %rsp       # rsp ← rsp + 8
```

### 2.2 레지스터 (Register)

CPU 내부의 고속 저장소. `%` 접두사.

```asm
movq %rax, %rbx     # rbx ← rax
addq %rcx, %rdx     # rdx ← rdx + rcx
```

### 2.3 메모리 참조 (Memory Reference)

메모리 주소를 통한 간접 참조. `()` 사용.

```asm
# 기본 형태: Imm(Rb, Ri, s) = Imm + Rb + Ri×s
movq (%rax), %rbx           # rbx ← M[rax]           (간접 참조)
movq 8(%rax), %rbx          # rbx ← M[rax + 8]       (오프셋)
movq (%rax, %rcx), %rbx     # rbx ← M[rax + rcx]     (인덱싱)
movq (%rax, %rcx, 4), %rbx  # rbx ← M[rax + rcx×4]  (스케일)
movq 4(%rax, %rcx, 2), %rbx # rbx ← M[4 + rax + rcx×2]
```

---

## 3. 명령어 크기 접미사

AT&T 문법에서는 명령어 뒤에 크기를 나타내는 접미사를 붙입니다.

| 접미사 | 크기 | C 타입 |
|-------|------|--------|
| `b` | 1바이트 (8비트) | `char` |
| `w` | 2바이트 (16비트) | `short` |
| `l` | 4바이트 (32비트) | `int` |
| `q` | 8바이트 (64비트) | `long`, 포인터 |

```asm
movb $0x41, %al     # 1바이트 이동 ('A' = 0x41)
movw $1000, %ax     # 2바이트 이동
movl $100000, %eax  # 4바이트 이동
movq $-1, %rax      # 8바이트 이동 (0xFFFFFFFFFFFFFFFF)
```

---

## 4. 기본 명령어 분류

### 4.1 데이터 이동

```asm
movq %rax, %rbx      # rbx = rax
movq $42, %rax       # rax = 42
movq (%rsp), %rax    # rax = *rsp (메모리에서 읽기)
movq %rax, (%rsp)    # *rsp = rax (메모리에 쓰기)
```

### 4.2 산술/논리 연산

```asm
addq %rbx, %rax     # rax += rbx
subq $8, %rsp       # rsp -= 8
imulq %rbx, %rax    # rax *= rbx
idivq %rbx          # rdx:rax = rdx:rax / rbx (몫→rax, 나머지→rdx)
andq %rbx, %rax     # rax &= rbx
orq  %rbx, %rax     # rax |= rbx
xorq %rbx, %rax     # rax ^= rbx
notq %rax           # rax = ~rax
negq %rax           # rax = -rax (2의 보수)
```

### 4.3 비교와 조건 분기

```asm
cmpq %rbx, %rax     # rax - rbx 계산, 결과는 버리고 플래그만 설정
testq %rax, %rax    # rax & rax, 0 여부 확인에 주로 사용
je   label          # ZF=1이면 jump (equal)
jne  label          # ZF=0이면 jump (not equal)
jl   label          # SF≠OF이면 jump (less)
jg   label          # ZF=0 && SF=OF이면 jump (greater)
jmp  label          # 무조건 jump
```

### 4.4 스택 조작

```asm
pushq %rax          # rsp -= 8; M[rsp] = rax
popq  %rax          # rax = M[rsp]; rsp += 8
```

### 4.5 함수 호출/반환

```asm
call  func          # pushq %rip; jmp func
ret                 # popq %rip
```

---

## 5. 간단한 C → 어셈블리 예시

```c
// C 코드
long add(long a, long b) {
    return a + b;
}
```

```asm
# 컴파일된 어셈블리 (x86-64, -O1)
add:
    movq %rdi, %rax    # rax = a (첫 번째 인자는 rdi)
    addq %rsi, %rax    # rax += b (두 번째 인자는 rsi)
    ret                # rax를 반환값으로 반환
```

```c
// 더 복잡한 예시
long absval(long x) {
    if (x < 0) return -x;
    return x;
}
```

```asm
absval:
    movq  %rdi, %rax    # rax = x
    negq  %rax          # rax = -x
    testq %rdi, %rdi    # x & x (x의 부호 확인)
    cmovge %rdi, %rax   # x >= 0이면 rax = x (조건부 이동, 분기 없음!)
    ret
```

---

## 핵심 요약

- **AT&T 문법**: `출처, 목적지` 순서. 레지스터 `%`, 상수 `$`.
- **세 가지 피연산자**: 즉시값, 레지스터, 메모리 참조 `Imm(Rb, Ri, s)`.
- **크기 접미사**: `b`(1), `w`(2), `l`(4), `q`(8) 바이트.
- 어셈블리를 읽으면 컴파일러 최적화(CMOV, 인라이닝 등)를 직접 확인할 수 있습니다.
- `gcc -S -O1 -o out.s file.c` 로 생성된 어셈블리를 직접 보는 연습이 효과적입니다.
