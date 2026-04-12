---
title: "재배치(Relocation): 주소를 확정하는 과정"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "linking", "relocation", "address", "ELF", "csapp"]
---

## 재배치 (Relocation)

링커의 두 번째 핵심 작업입니다. 각 오브젝트 파일의 코드/데이터에는 **상대적 주소(0부터 시작)**만 있는데, 링커가 최종 **절대 주소**를 확정하고 코드에 기입합니다.

---

## 1. 재배치가 필요한 이유

```c
// add.c
int global_val = 100;  // .data에 저장

int add(int x, int y) {
    return x + y + global_val;  // global_val의 주소가 필요!
}
```

```
컴파일 후 add.o의 .text:
  add 함수가 0x0000 주소부터 시작 (가상)
  global_val 참조 위치에는 ??? 표시 (주소 미확정)

링크 후 prog의 .text:
  add 함수가 0x401020 주소에 배치
  global_val이 0x404010에 배치됨이 확정
  → add 함수 내 global_val 참조 → 0x404010으로 채워짐
```

---

## 2. 재배치 항목 (Relocation Entry)

어셈블러는 주소가 확정되지 않은 참조에 **재배치 항목**을 남깁니다.

```c
// ELF 재배치 항목 구조 (Elf64_Rela)
typedef struct {
    Elf64_Addr  r_offset;   // 수정할 코드 내 위치 (바이트 오프셋)
    Elf64_Xword r_info;     // 심볼 인덱스 + 재배치 타입
    Elf64_Sxword r_addend;  // 상수 가감치
} Elf64_Rela;
```

```bash
# 재배치 항목 확인
objdump -r add.o

# 출력 예:
# RELOCATION RECORDS FOR [.text]:
# OFFSET   TYPE              VALUE
# 00000015 R_X86_64_PC32     global_val-0x4
# 0000002a R_X86_64_PLT32    printf-0x4
```

---

## 3. 재배치 유형

### 3.1 R_X86_64_32 (절대 주소 참조)

```
32비트 절대 주소로 패치:
  refaddr = ADDR(s.r_offset)
  *refaddr = (uint32_t)(ADDR(r.symbol) + r.addend)

사용: 전역 변수 주소, 절대 점프
```

### 3.2 R_X86_64_PC32 (PC 상대 주소 참조)

```
32비트 PC 상대 주소로 패치 (현대 x86-64의 표준):
  refaddr = ADDR(s.r_offset)
  *refaddr = (uint32_t)(ADDR(r.symbol) + r.addend - refaddr)

사용: 함수 호출 (CALL 명령어), 조건 분기
이점: 위치 독립적 → 공유 라이브러리에 유리
```

### 3.3 R_X86_64_PLT32 (PLT를 통한 함수 호출)

```
공유 라이브러리 함수 호출 시 사용:
  → PLT(Procedure Linkage Table)를 거쳐 GOT(Global Offset Table) 참조
  → 동적 링킹에서 사용 (아래 공유 라이브러리 문서 참조)
```

---

## 4. 섹션 병합과 주소 할당

```
링커의 섹션 병합 과정:

입력:
  main.o: .text(0x30B), .data(0x8), .bss(0x4)
  swap.o: .text(0x1A8), .data(0x0), .bss(0x28)

출력 (prog):
  .text: 0x4004d0 ~ 0x4006b4 (main.o + swap.o 합침)
    main.o .text → 0x4004d0
    swap.o .text → 0x4005db
  .data: 0x601028 ~ 0x601030
  .bss:  0x601030 ~ 0x60105c

주소 할당 기준 (일반적):
  .text: 0x400000 (코드 세그먼트 시작)
  .data: 0x600000 (데이터 세그먼트 시작)
```

---

## 5. 재배치 적용 예시

```c
// main.c
extern int swap_val;
void swap(int *a, int *b);

int main() {
    int x = 1, y = 2;
    swap(&x, &y);
    return swap_val;
}
```

```
링크 전 main.o의 CALL 명령어:
  0x18: e8 00 00 00 00   CALL swap  ← 주소가 00000000 (미확정)

swap의 최종 주소: 0x4005db (링커가 결정)

PC 상대 재배치 계산:
  CALL 명령어 위치: 0x4004d8
  다음 명령어 위치(PC): 0x4004d8 + 5 = 0x4004dd
  상대 오프셋 = 0x4005db - 0x4004dd = 0xfe

링크 후:
  0x18: e8 fe 00 00 00   CALL 0x4005db  ← 올바른 주소
```

---

## 6. 재배치 확인

```bash
# 실행 파일의 역어셈블로 확인
objdump -d prog | grep -A5 "main>"

# 심볼과 주소 확인
nm prog
# 0000000000601028 D swap_val
# 00000000004004d0 T main
# 00000000004005db T swap

# 메모리 맵 (실행 시)
cat /proc/$(pgrep prog)/maps
```

---

## 핵심 요약

- **재배치의 목적**: 오브젝트 파일의 상대 주소를 실행 파일의 절대 주소로 확정.
- **재배치 항목**: 어셈블러가 남긴 표시 (어디를 어떤 심볼의 주소로 채울지).
- **섹션 병합**: 여러 `.o` 파일의 `.text`, `.data` 섹션을 순서대로 합침.
- **PC 상대 주소**: `CALL` 명령어는 절대 주소 대신 현재 PC로부터 상대 오프셋 사용.
- **주소 확정 순서**: 섹션 배치 결정 → 각 심볼의 주소 결정 → 재배치 항목 패치.
