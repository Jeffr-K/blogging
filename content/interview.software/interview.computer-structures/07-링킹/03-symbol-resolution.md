---
title: "심볼(Symbol) 해석: 강한 심볼 vs 약한 심볼"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "linking", "symbol", "strong-symbol", "weak-symbol", "csapp"]
---

## 심볼 해석 (Symbol Resolution)

링커의 핵심 작업 중 하나는 **심볼(Symbol)**을 해석하는 것입니다. 각 파일에서 참조(Reference)한 심볼의 정의(Definition)를 찾아 연결합니다.

---

## 1. 심볼의 종류

```
심볼 = 함수 이름 또는 전역/정적 변수 이름

전역 심볼 (Global Symbol):
  - 모듈 외부에서 참조 가능
  - static 키워드 없는 함수/전역 변수
  예: int x = 5;    // 전역 심볼 x 정의
      void foo();   // 전역 심볼 foo 정의

로컬 심볼 (Local Symbol):
  - 모듈 내부에서만 사용 (static)
  - 링커가 외부 참조 해석에 사용하지 않음
  예: static int y = 0;  // 로컬 심볼 y

외부 심볼 (External Symbol):
  - 다른 모듈에서 정의된 심볼에 대한 참조
  예: extern int x;    // 다른 파일의 x 참조
      printf("...");   // libc의 printf 참조
```

```bash
# 심볼 테이블 확인
nm main.o
# U printf       ← Undefined (외부 참조)
# T main         ← Text section (함수 정의)
# D global_var   ← Data section (초기화된 전역변수)
# B uninit_var   ← BSS section (미초기화 전역변수)
# t local_func   ← 소문자 = 로컬 심볼
```

---

## 2. 강한 심볼 vs 약한 심볼

### 2.1 강한 심볼 (Strong Symbol)

```c
// 강한 심볼: 초기화된 전역 변수 + 함수 정의
int x = 5;          // 강한 심볼 (초기화됨)
void foo() { ... }  // 강한 심볼 (함수 정의)
```

### 2.2 약한 심볼 (Weak Symbol)

```c
// 약한 심볼: 미초기화 전역 변수
int x;              // 약한 심볼 (초기화 안 됨)

// 또는 __attribute__((weak))로 명시
__attribute__((weak)) void bar() { ... }  // 약한 심볼 함수
```

---

## 3. 링커의 심볼 해석 규칙

```
규칙 1: 강한 심볼은 하나만 존재해야 함
  → 두 파일에 같은 이름의 강한 심볼 → 링크 에러!

규칙 2: 강한 심볼과 약한 심볼이 충돌하면 강한 심볼 선택
  → 강한 심볼이 우선 (약한 심볼 무시)

규칙 3: 약한 심볼끼리 충돌하면 임의로 하나 선택
  → 어떤 것이 선택될지 미정! (위험)
```

### 규칙 위반 예시

```c
// file1.c
int x = 5;      // 강한 심볼 x
void f() { printf("x = %d\n", x); }

// file2.c
int x = 10;     // 강한 심볼 x (중복!)
int main() { f(); return 0; }

// $ gcc file1.c file2.c -o prog
// Error: multiple definition of 'x'
```

```c
// file1.c
int x = 5;   // 강한 심볼 x (선택됨!)

// file2.c
int x;       // 약한 심볼 x (무시됨)
int main() {
    printf("x = %d\n", x);  // x = 5 출력
    return 0;
}
// 경고 없이 컴파일됨 → 의도치 않은 동작 주의
```

---

## 4. 위험한 약한 심볼 시나리오

```c
// file1.c: double x = 3.14 (강한, 8바이트)
double x = 3.14;
void f() {
    printf("x = %f\n", x);
}

// file2.c: int x (약한, 4바이트)
int x;  // file1.c의 x(8바이트)를 덮어쓰는 셈!
int main() {
    x = 100;    // int(4바이트)로 씀 → x의 하위 4바이트만 변경
    f();        // double(8바이트)로 읽음 → 쓰레기 값!
    return 0;
}

// 결과: x = 0.000000 (예측 불가)
// 이런 버그는 찾기 매우 어려움!
```

**해결책**: 전역 변수에 항상 `static` 또는 초기화 사용.

---

## 5. 라이브러리에서의 심볼 해석

```
링커의 라이브러리 처리 순서:

gcc main.o libvector.a libc.a -o prog

1. main.o 처리: 미해결 심볼 목록에 addvec, printf 추가
2. libvector.a 처리:
   → addvec 심볼을 찾아 addvec.o 추출
   → 미해결 목록에서 addvec 제거
3. libc.a 처리:
   → printf 심볼을 찾아 printf.o 추출
   → 미해결 목록에서 printf 제거
4. 미해결 심볼 없음 → 링크 성공!
```

**라이브러리 순서가 중요!**

```bash
# 올바른 순서: main.o가 참조하는 라이브러리가 뒤에
gcc main.o -lmylib -lc -o prog  # OK

# 잘못된 순서: 라이브러리가 참조자보다 앞에
gcc -lmylib main.o -o prog      # Error: undefined reference
# 이유: -lmylib 처리 시 main.o가 아직 없어 참조를 모름
```

---

## 6. C++ 이름 맹글링 (Name Mangling)

```cpp
// C++은 함수 오버로딩 지원 → 같은 이름, 다른 시그니처
void foo(int x);    // 심볼: _Z3fooi
void foo(double x); // 심볼: _Z3food

// C 함수처럼 링크하려면:
extern "C" void bar(int x);  // 심볼: bar (맹글링 없음)
```

```bash
# 맹글링된 심볼 확인
nm main.o | c++filt   # 역맹글링하여 가독성 있게 출력
```

---

## 핵심 요약

- **강한 심볼**: 초기화된 전역 변수 + 함수 정의. 중복 불가 (링크 에러).
- **약한 심볼**: 미초기화 전역 변수. 강한 심볼에 우선권 양보.
- **규칙 3 주의**: 약한 심볼 충돌 시 임의 선택 → 타입 크기 불일치 시 메모리 손상 가능.
- **라이브러리 순서**: 참조하는 파일(`.o`)이 라이브러리보다 앞에 와야 함.
- **static 사용**: 전역 변수를 파일 범위로 제한하면 심볼 충돌 방지.
- **C++ 맹글링**: 함수 오버로딩을 위해 심볼 이름에 타입 정보 포함.
