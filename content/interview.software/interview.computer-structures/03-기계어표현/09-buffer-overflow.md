---
title: "버퍼 오버플로우(Buffer Overflow) 공격과 스택 카나리아(Stack Canary)"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "security", "buffer-overflow", "stack-canary", "csapp"]
---

## 버퍼 오버플로우

버퍼 오버플로우는 배열 또는 버퍼의 경계를 넘어 메모리를 덮어쓰는 버그입니다. 스택 버퍼 오버플로우는 **반환 주소를 덮어써서 공격자가 원하는 코드를 실행**하게 만들 수 있는 대표적인 보안 취약점입니다.

---

## 1. 버퍼 오버플로우의 원리

```c
// 취약한 함수
void vulnerable(char *input) {
    char buf[8];         // 8바이트 버퍼
    strcpy(buf, input);  // 길이 검사 없이 복사!
}

int main() {
    vulnerable("AAAAAAAAAAAAAAAAAAAAAA");  // 22바이트 → 오버플로우!
    return 0;
}
```

스택 레이아웃:
```
높은 주소
┌──────────────────────────┐
│     반환 주소 (8바이트)   │ ← 이게 덮어씌워지면 위험!
├──────────────────────────┤
│   저장된 %rbp (8바이트)   │
├──────────────────────────┤
│      buf[0..7]           │ ← strcpy 시작점
└──────────────────────────┘ ← 낮은 주소
```

`buf`에 8바이트 이상 쓰면:
- 8~15바이트: 저장된 `%rbp` 덮어씀
- 16~23바이트: 반환 주소 덮어씀 → 함수 반환 시 덮어씌운 주소로 점프!

---

## 2. 공격 시나리오

```
입력: [쉘코드(16바이트)][반환 주소 → buf의 주소]

buf:        [쉘코드 16바이트]
저장된 rbp: [덮어씌워진 값]
반환 주소:  [buf의 시작 주소] ← ret 실행 시 쉘코드로 점프!
```

과거에는 이 방법으로 `gets()`, `scanf("%s", ...)`, `strcpy()` 등을 이용한 공격이 빈번했습니다.

---

## 3. 현대의 방어 기법

### 3.1 스택 카나리아 (Stack Canary)

컴파일러가 **버퍼와 반환 주소 사이에 랜덤 값(카나리아)을 삽입**합니다. 함수 반환 전에 카나리아 값이 변했는지 확인합니다.

```
┌──────────────────────────┐
│     반환 주소             │
├──────────────────────────┤
│   저장된 %rbp            │
├──────────────────────────┤
│  ★ 카나리아 (8바이트)    │ ← 랜덤 값
├──────────────────────────┤
│      buf[0..7]           │
└──────────────────────────┘
```

카나리아 삽입 코드:
```asm
vulnerable:
    pushq %rbp
    movq  %rsp, %rbp
    subq  $16, %rsp
    
    # 프롤로그: 카나리아 설정
    movq  %fs:40, %rax        # 스레드 로컬 카나리아 값 읽기
    movq  %rax, -8(%rbp)      # 스택에 저장
    xorl  %eax, %eax
    
    # ... 함수 본문 ...
    
    # 에필로그: 카나리아 검증
    movq  -8(%rbp), %rax      # 스택에서 카나리아 읽기
    xorq  %fs:40, %rax        # 원래 값과 비교
    jne   __stack_chk_fail    # 다르면 프로그램 종료!
    
    leave
    ret
```

GCC에서 `-fstack-protector` (기본), `-fstack-protector-all` 로 활성화.

```bash
gcc -fstack-protector-all -o program program.c
# 오버플로우 시 출력:
# *** stack smashing detected ***
```

### 3.2 ASLR (Address Space Layout Randomization)

프로세스가 시작할 때마다 스택, 힙, 라이브러리의 **메모리 주소를 랜덤화**합니다. 공격자가 buf의 주소를 예측할 수 없게 만듭니다.

```bash
# Linux에서 ASLR 확인
cat /proc/sys/kernel/randomize_va_space
# 0: 비활성화
# 1: 부분 랜덤화
# 2: 완전 랜덤화 (기본값)

# 각 실행마다 스택 주소가 달라짐
for i in 1 2 3; do
    cat /proc/self/maps | grep stack
done
# 7ffd1a2b4000 ... [stack]
# 7ffc9f3a1000 ... [stack]
# 7ffdab2c5000 ... [stack]
```

### 3.3 NX/DEP (Non-Executable Stack / Data Execution Prevention)

스택 메모리를 **실행 불가(Non-Executable)**로 표시합니다. 스택에 쉘코드를 주입해도 실행할 수 없습니다.

```bash
# 실행 불가 스택 확인
readelf -l program | grep GNU_STACK
# GNU_STACK  ... RW  (실행 권한 없음: W만 있고 X는 없음)
# 만약 RWE라면 실행 가능 스택 (취약)
```

### 3.4 안전한 함수 사용

| 취약한 함수 | 안전한 대안 |
|-----------|-----------|
| `gets()` | `fgets(buf, sizeof(buf), stdin)` |
| `strcpy()` | `strncpy()` 또는 `strlcpy()` |
| `strcat()` | `strncat()` 또는 `strlcat()` |
| `sprintf()` | `snprintf()` |
| `scanf("%s", ...)` | `scanf("%127s", ...)` (길이 제한) |

---

## 4. 현대 공격 기법 (방어 우회)

ASLR + NX가 적용되어도 공격 기법은 계속 발전했습니다.

**ROP (Return-Oriented Programming)**: 쉘코드 삽입 대신, 이미 실행 가능한 메모리 내 코드 조각(가젯, Gadget)의 주소를 스택에 쌓아 원하는 동작을 조합합니다.

```
스택에 배치:
[가젯1 주소]  → pop rdi; ret
["/bin/sh" 주소]
[가젯2 주소]  → call system
```

이를 방어하기 위해 **CET (Control-flow Enforcement Technology)**, **CFI (Control Flow Integrity)** 등의 기법이 개발되었습니다.

---

## 5. 실습: 카나리아 우회 시도 감지

```c
#include <stdio.h>
#include <string.h>

void test(void) {
    char buf[8];
    printf("buf 주소: %p\n", buf);
    gets(buf);  // 취약!
}

int main(void) {
    test();
    return 0;
}
```

```bash
# 컴파일 (카나리아 활성화)
gcc -fstack-protector -o test test.c -w

# 긴 입력 제공
python3 -c "print('A' * 100)" | ./test
# *** stack smashing detected ***: terminated
# Aborted (core dumped)
```

---

## 핵심 요약

- **버퍼 오버플로우**: 경계 없는 복사 함수(`strcpy`, `gets`)로 스택의 반환 주소 덮어씀.
- **스택 카나리아**: 버퍼와 반환 주소 사이에 랜덤 값 삽입, 함수 반환 전 검증.
- **ASLR**: 스택/힙 주소 랜덤화 → 공격자의 주소 예측 어렵게.
- **NX**: 스택을 실행 불가 → 삽입한 쉘코드 실행 방지.
- **안전한 함수**: `fgets`, `snprintf`, `strncpy` 등을 사용하세요.
