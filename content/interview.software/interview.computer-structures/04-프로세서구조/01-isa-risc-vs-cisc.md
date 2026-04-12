---
title: "명령어 집합 구조(ISA): RISC vs CISC"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "isa", "risc", "cisc", "arm", "x86", "csapp"]
---

## 명령어 집합 구조 (ISA)

ISA(Instruction Set Architecture)는 CPU가 이해하는 명령어 집합과 그 규칙(레지스터, 메모리 접근 방식, 타입 등)을 정의하는 **하드웨어-소프트웨어 인터페이스**입니다. ISA는 두 가지 주요 철학으로 나뉩니다.

---

## 1. CISC (Complex Instruction Set Computer)

### 특징

- **복잡하고 강력한 명령어**가 많음 (수백~수천 개)
- 하나의 명령어가 여러 연산을 수행
- **가변 길이 명령어** (x86: 1~15바이트)
- 메모리 피연산자 직접 지원 (`add [mem], reg`)
- 마이크로코드(Microcode)로 복잡한 명령어 구현

### 대표: x86-64 (Intel, AMD)

```asm
; CISC x86: 한 명령어로 메모리에서 읽고 더하기
add eax, DWORD PTR [rbx + 8]   ; M[rbx+8]을 읽어서 eax에 더함

; 문자열 복사 명령어 (하나의 명령어로 루프 포함!)
rep movsb   ; rcx바이트를 rsi → rdi로 복사

; 스택 프레임 설정 (단 2개 명령어로)
enter 32, 0   ; push rbp; mov rbp, rsp; sub rsp, 32 와 동일
leave         ; mov rsp, rbp; pop rbp 와 동일
```

---

## 2. RISC (Reduced Instruction Set Computer)

### 특징

- **단순하고 적은 명령어** (수십~수백 개)
- 모든 명령어가 **고정 길이** (ARM: 4바이트, MIPS: 4바이트)
- **Load/Store 아키텍처**: 메모리 접근은 load/store만, 연산은 레지스터만
- **많은 범용 레지스터** (ARM64: 31개, MIPS: 32개)
- 파이프라이닝에 최적화

### 대표: ARM (모바일, Apple Silicon), RISC-V, MIPS

```asm
# ARM64 (RISC): 메모리에서 읽고 더하기
ldr x1, [x0, #8]   # x1 = M[x0+8]  (Load)
add x2, x2, x1     # x2 = x2 + x1  (Register 연산)
str x2, [x0]       # M[x0] = x2    (Store)

# CISC와 달리 load/store를 항상 분리
```

---

## 3. RISC vs CISC 비교

| 특성 | CISC | RISC |
|------|------|------|
| 명령어 수 | 많음 (수백~수천) | 적음 (수십~수백) |
| 명령어 길이 | 가변 길이 | 고정 길이 |
| 메모리 접근 | 모든 명령어에서 가능 | Load/Store만 |
| 레지스터 수 | 적음 (x86-64: 16개) | 많음 (ARM64: 31개) |
| 파이프라이닝 | 복잡 (가변 길이 때문) | 단순하고 효율적 |
| 컴파일러 복잡도 | 낮음 (HW가 처리) | 높음 (SW가 최적화) |
| 대표 | x86, x86-64 | ARM, RISC-V, MIPS |
| 주 사용처 | 데스크톱, 서버 | 모바일, 임베디드, Apple M 시리즈 |

---

## 4. 현대의 수렴

현대 CPU에서 RISC와 CISC의 경계는 모호해졌습니다.

### x86이 내부적으로 RISC처럼 동작하는 이유

현대 Intel/AMD CPU는 x86 명령어를 내부에서 **μops(마이크로 연산, micro-operations)**으로 분해합니다.

```
add eax, DWORD PTR [rbx + 8]
  →  [load μop] temp = M[rbx+8]
  →  [add μop]  eax = eax + temp
```

이렇게 CISC 명령어를 RISC 스타일의 단순한 μops로 변환하면, 파이프라이닝, 비순차 실행, 슈퍼스칼라 등 RISC의 장점을 그대로 활용할 수 있습니다.

### ARM이 복잡해진 이유

ARM도 NEON(SIMD), SVE, 가상화 지원 등을 추가하면서 명령어 수가 크게 늘었습니다.

---

## 5. Apple Silicon (M1/M2/M3/M4)

Apple이 x86에서 ARM 기반 Apple Silicon으로 전환한 이유:

```
성능/와트 비율:
ARM (Apple M1): 높은 성능, 낮은 전력 소비
x86 (Intel): 높은 절대 성능, 높은 전력 소비

배터리 수명 2배↑, 발열 감소, 성능도 향상
→ RISC의 에너지 효율이 모바일에서 결정적 우위
```

M1 칩 사양 (ARM64):
- 31개 범용 레지스터 (x0~x30)
- 32개 부동소수점/SIMD 레지스터 (v0~v31)
- 4바이트 고정 길이 명령어

---

## 6. RISC-V: 오픈소스 ISA

RISC-V는 학술 목적으로 시작된 **완전 오픈소스 ISA**입니다.

```
특징:
- 특허/라이선스 비용 없음
- 모듈식: 기본(RV32I) + 확장(M: 곱셈, F: 부동소수점, V: 벡터 등)
- SiFive, ESP32-C3, StarFive 등에서 상용화
- 중국의 탈x86 전략의 핵심
```

---

## 핵심 요약

- **CISC**: 복잡하고 많은 명령어, 가변 길이. 대표: x86. 하드웨어가 복잡한 연산 담당.
- **RISC**: 단순하고 적은 명령어, 고정 길이. 대표: ARM, RISC-V. 파이프라이닝에 최적.
- **현대**: CISC CPU도 내부에서 μops로 분해해 RISC처럼 동작. 두 철학의 수렴.
- **성능/와트**: RISC(ARM)의 우위 → Apple Silicon, 모바일 CPU의 선택.
