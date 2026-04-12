---
title: "setjmp/longjmp: 비지역 점프"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "setjmp", "longjmp", "exception-handling", "csapp"]
---

## setjmp/longjmp

`setjmp`/`longjmp`는 **함수 호출 경계를 넘어 점프할 수 있는 메커니즘**입니다. C 언어에서 try-catch와 유사한 예외 처리나 에러 복구에 사용됩니다.

---

## 1. 기본 사용법

```c
#include <setjmp.h>

jmp_buf env;  // 점프 환경 저장

// setjmp: 현재 환경(레지스터, 스택 포인터 등) 저장
// 처음 호출 시 0 반환, longjmp로 돌아오면 longjmp의 val 반환
int ret = setjmp(env);

if (ret == 0) {
    // 정상 실행 경로
    do_work();
} else {
    // 에러 복구 경로 (longjmp로 여기로 점프됨)
    printf("에러 발생: %d\n", ret);
}
```

```c
// longjmp: setjmp가 저장한 환경으로 복귀
void handle_error(int error_code) {
    // setjmp를 호출한 위치로 점프!
    // setjmp가 error_code 값을 반환하는 것처럼 보임
    longjmp(env, error_code);  // 반환하지 않음
}
```

---

## 2. 완전한 예시: 에러 복구

```c
#include <setjmp.h>
#include <stdio.h>

jmp_buf error_env;

void level3() {
    printf("level3 실행\n");
    longjmp(error_env, 42);  // main의 setjmp로 점프!
    printf("이 줄은 실행 안 됨\n");
}

void level2() {
    printf("level2 실행\n");
    level3();
    printf("이 줄도 실행 안 됨\n");
}

void level1() {
    printf("level1 실행\n");
    level2();
    printf("이 줄도 실행 안 됨\n");
}

int main() {
    int code = setjmp(error_env);
    
    if (code == 0) {
        printf("정상 실행 시작\n");
        level1();
        printf("이 줄도 실행 안 됨\n");
    } else {
        printf("longjmp로 복귀! 에러 코드: %d\n", code);
        // 출력: longjmp로 복귀! 에러 코드: 42
    }
    
    return 0;
}

// 출력:
// 정상 실행 시작
// level1 실행
// level2 실행
// level3 실행
// longjmp로 복귀! 에러 코드: 42
```

---

## 3. jmp_buf의 내용

```
jmp_buf에 저장되는 것:
  - 스택 포인터 (rsp)
  - 프레임 포인터 (rbp)
  - 프로그램 카운터 (rip, setjmp 다음 명령어)
  - 캘리-세이브드 레지스터 (rbx, r12~r15)
  - 시그널 마스크 (sigsetjmp 사용 시)

longjmp 동작:
  1. jmp_buf에서 값 복원
  2. 스택 포인터를 setjmp 시점으로 복원
  3. PC를 setjmp 위치로 점프
  → 중간의 모든 스택 프레임이 사라짐!
     (소멸자, finally, 정리 코드 호출 안 됨)
```

---

## 4. 주의사항

### 4.1 스택 변수의 volatile

```c
// longjmp 후 지역 변수의 값이 불확정!
int main() {
    int x = 10;           // volatile 없으면 최적화로 잃을 수 있음
    volatile int y = 10;  // volatile: 반드시 메모리에서 읽음 (안전)
    
    if (setjmp(env) == 0) {
        x = 20;
        y = 20;
        longjmp(env, 1);
    } else {
        // x의 값: 불확정 (레지스터에 최적화됐을 경우 10이 될 수도)
        // y의 값: 20 (volatile로 메모리에 저장됨)
        printf("x=%d, y=%d\n", x, y);
    }
}
```

### 4.2 longjmp 후 스택 해제

```c
// 문제: longjmp가 소멸자/정리 코드를 건너뜀
void problematic() {
    FILE *f = fopen("file.txt", "r");
    // ...
    longjmp(env, 1);  // fclose()가 호출되지 않음! → 리소스 누수
}
```

---

## 5. sigsetjmp / siglongjmp

시그널 마스크도 함께 저장/복원합니다:

```c
#include <setjmp.h>

sigjmp_buf senv;

void handler(int sig) {
    siglongjmp(senv, 1);  // 시그널 마스크도 복원
}

int main() {
    signal(SIGINT, handler);
    
    if (sigsetjmp(senv, 1) == 0) {  // 1: 시그널 마스크도 저장
        // 정상 실행
        while (1) sleep(1);
    } else {
        // Ctrl+C 처리
        printf("SIGINT 처리됨\n");
    }
}
```

---

## 6. C++ 예외 처리와의 관계

```cpp
// C++의 try-catch는 내부적으로 setjmp/longjmp와 유사한 원리
// 단, C++은 스택 언와인딩(Stack Unwinding)을 추가로 수행:
// → 소멸자(destructor) 자동 호출
// → RAII 보장

try {
    std::unique_ptr<Resource> res = std::make_unique<Resource>();
    throw std::runtime_error("error");
    // 예외 발생: res의 소멸자 자동 호출 (RAII)
} catch (const std::exception& e) {
    // e.what() = "error"
}

// C의 longjmp: 소멸자/정리 코드 호출 안 됨 → 리소스 누수 위험
```

---

## 7. 실용적 사용 사례

```c
// 재귀 알고리즘에서 조기 탈출
jmp_buf found_env;

int search_tree(Node *node, int target) {
    if (node == NULL) return;
    if (node->val == target) longjmp(found_env, 1);  // 발견!
    search_tree(node->left, target);
    search_tree(node->right, target);
}

int find_in_tree(Node *root, int target) {
    if (setjmp(found_env) == 0) {
        search_tree(root, target);
        return 0;  // 못 찾음
    }
    return 1;  // 찾음
}
```

---

## 핵심 요약

- **setjmp**: 현재 실행 환경(레지스터, 스택 포인터, PC) 저장. 처음엔 0 반환.
- **longjmp**: setjmp 지점으로 비지역 점프. setjmp가 지정된 값을 반환하는 것처럼 보임.
- **스택 언와인딩 없음**: 중간 스택 프레임의 정리 코드(C++ 소멸자, close 등) 실행 안 됨.
- **volatile 필요**: setjmp 사이의 지역 변수 변경이 longjmp 후 반영되려면 volatile 필요.
- **sigsetjmp/siglongjmp**: 시그널 마스크도 함께 저장/복원.
- **현대적 대안**: C++의 예외 처리(try-catch)가 더 안전. C에서는 리소스 누수 주의.
