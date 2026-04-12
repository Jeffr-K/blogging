---
title: "ELF(Executable and Linkable Format) 파일 구조"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "linking", "ELF", "executable", "object-file", "csapp"]
---

## ELF 파일 형식

ELF(Executable and Linkable Format)는 Linux/Unix 시스템에서 **오브젝트 파일, 실행 파일, 공유 라이브러리, 코어 덤프**를 표현하는 표준 바이너리 형식입니다.

---

## 1. ELF 파일의 세 가지 형태

```
ELF 파일 타입:
1. 재배치 가능 파일 (Relocatable): .o
   → 링커 입력용. 주소 미확정.

2. 실행 파일 (Executable): a.out, prog
   → OS가 직접 실행. 주소 확정.

3. 공유 오브젝트 (Shared Object): .so
   → 동적 링킹용. PIC 코드.

4. 코어 덤프 (Core Dump): core
   → 프로세스 충돌 시 메모리 스냅샷.
```

---

## 2. ELF 파일 레이아웃

```
ELF 파일 전체 구조:

┌─────────────────────┐ ← 파일 시작
│   ELF 헤더          │  52바이트(32bit) / 64바이트(64bit)
│   (ELF Header)      │
├─────────────────────┤
│   프로그램 헤더 테이블 │  실행 시 세그먼트 정의 (실행파일/공유라이브러리)
│   (Program Headers)  │  없는 경우도 있음 (.o 파일)
├─────────────────────┤
│   섹션들            │
│   .text             │  실행 코드
│   .rodata           │  읽기 전용 데이터
│   .data             │  초기화된 전역/정적 변수
│   .bss              │  미초기화 변수 (파일 공간 없음, 크기만)
│   .symtab           │  심볼 테이블
│   .strtab           │  심볼 이름 문자열
│   .rel.text         │  .text 재배치 정보
│   .rel.data         │  .data 재배치 정보
│   .debug            │  디버그 정보 (-g 시)
│   .line             │  소스 줄 번호 매핑
│   .got              │  Global Offset Table
│   .plt              │  Procedure Linkage Table
│   ...               │
├─────────────────────┤
│   섹션 헤더 테이블   │  각 섹션의 메타데이터 (링커가 사용)
│   (Section Headers)  │
└─────────────────────┘ ← 파일 끝
```

---

## 3. ELF 헤더 상세

```c
// ELF64 헤더 구조체
typedef struct {
    unsigned char e_ident[16];  // 매직 넘버 + 클래스 + 엔디안 + 버전
    Elf64_Half    e_type;       // 파일 타입 (ET_REL, ET_EXEC, ET_DYN)
    Elf64_Half    e_machine;    // 아키텍처 (EM_X86_64=62)
    Elf64_Word    e_version;    // ELF 버전
    Elf64_Addr    e_entry;      // 진입점 주소 (main 아님! _start)
    Elf64_Off     e_phoff;      // 프로그램 헤더 테이블 오프셋
    Elf64_Off     e_shoff;      // 섹션 헤더 테이블 오프셋
    Elf64_Word    e_flags;      // 아키텍처 특정 플래그
    Elf64_Half    e_ehsize;     // ELF 헤더 크기 (64바이트)
    Elf64_Half    e_phentsize;  // 프로그램 헤더 엔트리 크기
    Elf64_Half    e_phnum;      // 프로그램 헤더 수
    Elf64_Half    e_shentsize;  // 섹션 헤더 엔트리 크기
    Elf64_Half    e_shnum;      // 섹션 수
    Elf64_Half    e_shstrndx;   // 섹션 이름 문자열 테이블 인덱스
} Elf64_Ehdr;
```

```bash
# 매직 넘버 (파일의 처음 4바이트)
$ xxd prog | head -1
00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............
#          ↑ 7f 'E' 'L' 'F' = ELF 매직 넘버
```

---

## 4. 섹션 vs 세그먼트

```
섹션 (Section): 링커의 관점
  - 파일 내 데이터 덩어리 (.text, .data, .symtab 등)
  - 링크 시 사용
  - 섹션 헤더 테이블이 설명

세그먼트 (Segment): 로더의 관점
  - OS가 메모리에 로드할 단위
  - 실행 시 사용
  - 프로그램 헤더 테이블이 설명

여러 섹션 → 하나의 세그먼트:
  LOAD 세그먼트 1 (읽기+실행): .text + .rodata
  LOAD 세그먼트 2 (읽기+쓰기): .data + .bss
```

```bash
# 세그먼트 확인
readelf -l prog

# Elf file type is EXEC (Executable file)
# Entry point 0x401020
# There are 9 program headers:
#
# Type      Offset   VirtAddr           PhysAddr
# PHDR      0x000040 0x0000000000400040 ...
# INTERP    0x000238 0x0000000000400238 ...  ← 동적 링커 경로
# LOAD      0x000000 0x0000000000400000 ...  ← 코드 세그먼트 (r-x)
# LOAD      0x002e00 0x0000000000602e00 ...  ← 데이터 세그먼트 (rw-)
# DYNAMIC   ...                               ← 동적 링킹 정보
```

---

## 5. 주요 분석 도구

```bash
# ELF 헤더 전체 분석
readelf -a prog                # 전체 정보
readelf -h prog                # ELF 헤더만
readelf -S prog                # 섹션 헤더 테이블
readelf -l prog                # 프로그램 헤더 테이블
readelf -s prog                # 심볼 테이블

# 역어셈블
objdump -d prog                # .text 역어셈블
objdump -D prog                # 모든 섹션 역어셈블
objdump -x prog                # 헤더 정보
objdump -r main.o             # 재배치 항목

# 심볼 조회
nm prog                        # 심볼 테이블
nm -D prog                     # 동적 심볼 테이블
nm prog | c++filt              # C++ 역맹글링

# 의존성 확인
ldd prog                       # 동적 라이브러리 의존성
file prog                      # 파일 타입 확인

# 16진수 덤프
xxd prog | head                # 원시 바이트
hexdump -C prog | head
```

---

## 6. 실행 파일 vs 오브젝트 파일 비교

| 항목 | 오브젝트 파일(.o) | 실행 파일 |
|------|-------------------|-----------|
| 주소 | 상대적 (0부터) | 절대 주소 |
| 심볼 | 미해석 (외부 참조) | 해석 완료 |
| 섹션 헤더 | 있음 | 있음 |
| 프로그램 헤더 | 없음 | 있음 |
| 재배치 항목 | 있음 | 없음 |
| 실행 가능 | 불가 | 가능 |

---

## 핵심 요약

- **ELF**: Linux/Unix의 표준 바이너리 형식. `.o`, 실행파일, `.so`, 코어덤프 모두 ELF.
- **섹션**: 링커가 사용. `.text`(코드), `.data`(초기화 변수), `.bss`(미초기화), `.symtab`(심볼).
- **세그먼트**: OS 로더가 사용. 여러 섹션을 메모리 권한별로 묶음 (r-x, rw-).
- **ELF 헤더**: 매직넘버(`\x7fELF`), 아키텍처, 진입점, 섹션/프로그램 헤더 위치.
- **분석 도구**: `readelf`, `objdump`, `nm`, `ldd`, `file` — 실무에서 자주 사용.
