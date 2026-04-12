---
title: "CPU의 명령어 실행 사이클: Fetch → Decode → Execute → Write-back"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "cpu", "instruction-cycle", "fetch-decode-execute", "csapp"]
---

## 명령어 실행 사이클

CPU는 명령어를 실행하기 위해 항상 동일한 단계를 반복합니다. 이를 **명령어 실행 사이클(Instruction Execution Cycle)** 또는 **Fetch-Decode-Execute-Writeback 사이클**이라 합니다.

---

## 1. 사이클 개요

```
┌──────────────────────────────────────────────┐
│                  CPU                          │
│                                               │
│  ┌───────┐  ┌────────┐  ┌─────────┐  ┌─────┐│
│  │ Fetch │→ │ Decode │→ │ Execute │→ │Write││
│  └───────┘  └────────┘  └─────────┘  └─────┘│
│       ↑                                   |   │
│       └───────────── PC += 4 ─────────────┘  │
└──────────────────────────────────────────────┘
```

---

## 2. 단계별 상세 설명

### 2.1 Fetch (명령어 인출)

PC(Program Counter, = rip)가 가리키는 메모리 주소에서 명령어를 가져옵니다.

```
PC = 0x400550
메모리 M[0x400550] = 0x4801C7 (= movq $1, %rax)

동작:
1. PC → 메모리 버스로 주소 전송
2. 메모리에서 명령어 비트 수신
3. IR(Instruction Register)에 저장
4. PC += 명령어 크기 (x86: 가변, RISC: 고정 4바이트)
```

**주의 사항**: 명령어는 보통 L1 I-캐시(Instruction Cache)에서 가져옵니다. 캐시 미스 시 수백 사이클 지연.

### 2.2 Decode (명령어 해석)

명령어 비트를 분석하여 어떤 연산인지, 피연산자가 무엇인지 파악합니다.

```
명령어 비트: 0100 1000 0000 0001 1100 0111
             ↑                            ↑
          REX 접두사                  opcode

해석:
- opcode: MOV (메모리 이동)
- 크기: q (quad, 8바이트)
- 목적지: %rax
- 출처: 즉시값 1
```

CISC(x86)에서는 이 단계가 복잡합니다. 현대 x86 CPU는 이 단계에서 복잡한 명령어를 **μops로 분해**합니다.

### 2.3 Execute (실행)

ALU(Arithmetic Logic Unit)가 실제 연산을 수행합니다.

```
명령어에 따른 ALU 연산:
ADD:   A + B
SUB:   A - B
AND:   A & B
OR:    A | B
CMP:   A - B (결과 버림, 플래그만 설정)
LOAD:  메모리 주소 계산 = base + offset
STORE: 메모리 주소 계산 + 데이터 준비
```

메모리 연산의 경우 이 단계에서 메모리 접근도 발생합니다 (또는 별도의 Memory Access 단계로 분리).

### 2.4 Write-back (결과 기록)

실행 결과를 레지스터 파일(Register File) 또는 메모리에 저장합니다.

```
ADD %rbx, %rax 결과:
  rax ← rax + rbx (레지스터에 기록)
  EFLAGS 업데이트 (ZF, SF, CF, OF)

STORE (movq %rax, (%rdi)):
  M[rdi] ← rax (메모리에 기록)
  → L1 D-캐시(Data Cache)에 우선 기록 후 DRAM 전파
```

---

## 3. 구체적 예시: `add %rbx, %rax`

```
1. FETCH:
   PC = 0x400100
   M[0x400100] = 0x4801C3  (add rbx, rax의 인코딩)
   IR ← 0x4801C3
   PC ← 0x400103 (3바이트 명령어)

2. DECODE:
   opcode = ADD
   src = %rbx (현재 값: 5)
   dst = %rax (현재 값: 3)

3. EXECUTE:
   ALU: 3 + 5 = 8
   ZF = 0 (결과 ≠ 0)
   SF = 0 (결과 > 0)
   OF = 0 (오버플로우 없음)

4. WRITE-BACK:
   rax ← 8
   EFLAGS ← 업데이트
```

---

## 4. 단순 사이클의 한계: 매 사이클마다 1명령어

단순 구현에서는 하나의 명령어가 완전히 끝나야 다음 명령어를 시작합니다.

```
사이클:  1  2  3  4  5  6  7  8  9  10  11  12
명령어1: F  D  E  W
명령어2:          F  D  E  W
명령어3:                   F  D  E  W

→ 명령어당 4 사이클 소요 = 낭비!
```

이 문제를 해결하기 위해 **파이프라이닝(Pipelining)**이 도입됩니다.

---

## 5. 파이프라이닝의 직관

각 단계가 독립적인 하드웨어를 사용한다면, 동시에 여러 명령어를 다른 단계에서 처리할 수 있습니다.

```
사이클:  1  2  3  4  5  6  7
명령어1: F  D  E  W
명령어2:    F  D  E  W
명령어3:       F  D  E  W
명령어4:          F  D  E  W

→ 사이클 4부터 매 사이클마다 1명령어 완료!
→ 이상적으로 4배 처리량 향상
```

---

## 6. 클럭 주파수와 CPI

```
성능 = 클럭 주파수 × (1 / CPI) × 명령어 수

클럭 주파수 (GHz): CPU의 속도 (3GHz = 초당 30억 사이클)
CPI (Cycles Per Instruction): 명령어당 평균 사이클 수

이상적 파이프라인: CPI = 1
파이프라인 해저드로 인해 실제 CPI > 1

현대 슈퍼스칼라 CPU: CPI < 1 (한 사이클에 여러 명령어 완료)
```

---

## 핵심 요약

| 단계 | 역할 | 사용 하드웨어 |
|------|------|-------------|
| Fetch | PC가 가리키는 주소에서 명령어 읽기 | PC, I-Cache |
| Decode | 명령어 해석, μops 분해 | 디코더 |
| Execute | ALU가 실제 연산 | ALU, FPU |
| Write-back | 결과를 레지스터/메모리에 기록 | Register File, D-Cache |

- **사이클 반복**: CPU는 이 4단계를 무한 반복하며 프로그램을 실행.
- **파이프라이닝**: 4단계를 동시에 처리해 처리량 향상.
- **캐시 미스**: Fetch(I-Cache 미스)와 Write-back(D-Cache 미스)에서 수백 사이클 지연 가능.
