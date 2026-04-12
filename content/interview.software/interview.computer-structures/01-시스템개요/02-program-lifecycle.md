---
title: "프로그램의 생애주기: 전처리 → 컴파일 → 어셈블 → 링크 → 실행"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "compilation", "linking", "csapp", "gcc"]
---

## 프로그램의 생애주기

`hello.c` 소스 파일 하나가 실행 가능한 바이너리가 되기까지 네 단계를 거칩니다. 각 단계를 이해하면 컴파일 에러, 링커 에러, 런타임 에러의 차이를 명확히 구분할 수 있습니다.

```
hello.c  →  [전처리]  →  hello.i
         →  [컴파일]  →  hello.s
         →  [어셈블]  →  hello.o
         →  [링크]    →  hello (실행 파일)
         →  [실행]    →  프로세스
```

---

## 1. 전처리 (Preprocessing)

**도구**: `cpp` (C Preprocessor)  
**출력**: `.i` 파일 (확장된 C 소스)

전처리기는 `#` 으로 시작하는 지시문을 처리합니다.

```c
// hello.c
#include <stdio.h>
#define MAX 100

int main() {
    printf("Hello, World!\n");  // stdio.h의 printf 선언 포함
    return 0;
}
```

전처리 후:
- `#include <stdio.h>` → stdio.h 파일 내용을 그대로 삽입
- `#define MAX 100` → 코드 내 `MAX`를 `100`으로 텍스트 치환
- 주석 제거

```bash
gcc -E hello.c -o hello.i  # 전처리만 수행
wc -l hello.i              # 수백~수천 줄로 늘어남
```

---

## 2. 컴파일 (Compilation)

**도구**: `cc1` (GCC 내부 컴파일러)  
**출력**: `.s` 파일 (어셈블리 코드)

컴파일러는 전처리된 C 코드를 **어셈블리 언어**로 변환합니다. 이 단계에서 최적화(-O2, -O3)가 적용됩니다.

```bash
gcc -S hello.i -o hello.s  # 컴파일만 수행
cat hello.s
```

```asm
# hello.s (x86-64 어셈블리)
.section .rodata
.LC0:
    .string "Hello, World!\n"

main:
    pushq   %rbp
    movq    %rsp, %rbp
    leaq    .LC0(%rip), %rdi   # 문자열 주소를 첫 번째 인자로
    call    puts                # puts() 함수 호출
    movl    $0, %eax           # return 0
    popq    %rbp
    ret
```

컴파일러가 하는 일:
- **어휘 분석(Lexical Analysis)**: 소스 코드를 토큰으로 분리
- **구문 분석(Syntax Analysis)**: AST(Abstract Syntax Tree) 생성
- **의미 분석(Semantic Analysis)**: 타입 검사
- **코드 생성(Code Generation)**: 어셈블리 출력
- **최적화**: 루프 언롤링, 인라이닝, 데드 코드 제거

---

## 3. 어셈블 (Assembly)

**도구**: `as` (GNU Assembler)  
**출력**: `.o` 파일 (오브젝트 파일, 기계어)

어셈블러는 어셈블리 코드를 **기계어(Machine Code)**로 변환합니다. 결과물은 ELF(Executable and Linkable Format) 형식의 오브젝트 파일입니다.

```bash
gcc -c hello.s -o hello.o  # 어셈블만 수행
file hello.o               # ELF 64-bit LSB relocatable
objdump -d hello.o         # 역어셈블로 확인
```

오브젝트 파일에는 외부 심볼(예: `printf`)에 대한 참조가 미완성 상태로 남아 있습니다. 이를 **재배치 항목(Relocation Entry)**이라 합니다.

```
call   printf    # printf의 실제 주소는 아직 모름 → 0으로 채워둠
```

---

## 4. 링크 (Linking)

**도구**: `ld` (GNU Linker)  
**출력**: 실행 파일 (또는 공유 라이브러리)

링커는 여러 오브젝트 파일과 라이브러리를 하나로 합칩니다.

```bash
gcc hello.o -o hello       # 링크 수행 (libc 자동 포함)
# 내부적으로: ld hello.o /usr/lib/libc.so -o hello
```

링커의 두 가지 핵심 작업:

**1) 심볼 해석 (Symbol Resolution)**
각 파일이 참조하는 심볼(함수명, 전역변수)의 정의를 찾아 연결합니다.
```
hello.o: printf에 대한 참조(REF)
libc.so: printf의 정의(DEF) ← 찾아서 연결
```

**2) 재배치 (Relocation)**
오브젝트 파일의 상대 주소를 실제 메모리 주소로 확정합니다.
```
call printf  →  call 0x7ffff7a1b230  (실제 printf 주소)
```

---

## 5. 실행 (Execution)

셸에서 `./hello`를 입력하면:

1. **셸이 fork()**: 자식 프로세스 생성
2. **자식이 execve()**: `hello` 파일을 로드
3. **로더(Loader)가 동작**:
   - ELF 헤더 파싱
   - 코드 세그먼트를 메모리에 매핑
   - 동적 링커(`ld-linux.so`)가 공유 라이브러리 연결
4. **`_start` → `__libc_start_main` → `main()` 호출**
5. `main()` 반환 → `exit()` → 운영체제에 자원 반환

---

## 에러 발생 단계별 원인 분류

| 에러 종류 | 발생 단계 | 예시 |
|----------|----------|------|
| 구문 에러 (Syntax Error) | 컴파일 | `int x = ;` |
| 타입 에러 (Type Error) | 컴파일 | `int x = "hello";` |
| 선언되지 않은 심볼 | 링크 | `undefined reference to 'foo'` |
| 라이브러리 없음 | 링크 | `cannot find -lm` |
| 세그멘테이션 폴트 | 실행 | 잘못된 포인터 참조 |
| 스택 오버플로우 | 실행 | 무한 재귀 |

---

## 핵심 요약

- **전처리**: `#include`, `#define` 처리. 텍스트 치환.
- **컴파일**: C → 어셈블리. 최적화 적용. 타입 검사.
- **어셈블**: 어셈블리 → 기계어 오브젝트 파일. 주소 미완성.
- **링크**: 여러 오브젝트를 합치고 주소를 확정. `undefined reference`는 여기서 발생.
- **실행**: OS 로더가 메모리에 올리고 `main()`을 호출.
