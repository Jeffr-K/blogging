---
title: "정수 연산의 함정: 오버플로우(Overflow)와 언더플로우(Underflow)"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "overflow", "underflow", "integer", "csapp", "security"]
---

## 정수 오버플로우

정수 연산 결과가 해당 타입이 표현할 수 있는 범위를 벗어날 때 **오버플로우(Overflow)**가 발생합니다. C언어에서 **부호 있는 정수의 오버플로우는 정의되지 않은 동작(Undefined Behavior)**이고, 부호 없는 정수의 오버플로우는 **모듈러 산술(Modular Arithmetic)**로 래핑됩니다.

---

## 1. 부호 없는 정수의 오버플로우 (Unsigned Overflow)

부호 없는 정수의 오버플로우는 **모듈로 2ⁿ 연산**으로 동작합니다. 이를 **래핑(Wrapping)**이라 합니다.

```c
uint8_t x = 255;  // 최댓값
uint8_t y = x + 1;  // 256 mod 256 = 0
printf("%d\n", y);  // 0 출력

uint8_t a = 0;  // 최솟값
uint8_t b = a - 1;  // -1 mod 256 = 255
printf("%d\n", b);  // 255 출력
```

```
255 + 1:
  1111 1111
+ 0000 0001
-----------
 10000 0000  → 9비트, 8비트로 잘리면 0000 0000 = 0
```

이는 **명확히 정의된 동작**입니다. C 표준은 unsigned 오버플로우가 모듈러 산술임을 보장합니다.

---

## 2. 부호 있는 정수의 오버플로우 (Signed Overflow)

C 표준에서 부호 있는 정수의 오버플로우는 **정의되지 않은 동작(Undefined Behavior, UB)**입니다. 컴파일러는 UB가 발생하지 않는다고 가정하고 최적화하기 때문에 예상치 못한 동작을 일으킵니다.

```c
int x = INT_MAX;  // 2147483647
int y = x + 1;    // 오버플로우! UB!
printf("%d\n", y); // -2147483648이 출력될 수도 있고, 
                   // 컴파일러에 따라 다름
```

### 실제 하드웨어에서 (x86):

```
2147483647 + 1:
  0111 1111 1111 1111 1111 1111 1111 1111
+ 0000 0000 0000 0000 0000 0000 0000 0001
-----------------------------------------
  1000 0000 0000 0000 0000 0000 0000 0000  = -2147483648 (INT_MIN)
```

비트 레벨에서는 래핑이 일어나지만, C 표준은 이를 UB로 정의했기 때문에 컴파일러는 이 가정을 이용해 최적화합니다.

---

## 3. 컴파일러 최적화와 UB의 위험

```c
// 컴파일러가 x+1 > x를 항상 true로 최적화할 수 있음!
int f(int x) {
    if (x + 1 > x) {  // signed overflow가 없다고 가정 → 항상 true
        return 1;
    }
    return 0;
}
// -O2로 컴파일하면 항상 return 1; 로 최적화될 수 있음
```

---

## 4. 실무에서 오버플로우가 만드는 버그와 보안 취약점

### 4.1 길이 계산 오류

```c
// 취약한 코드
void copy_data(char *dst, char *src, size_t len1, size_t len2) {
    size_t total = len1 + len2;  // 오버플로우 가능!
    if (total > MAX_SIZE) {
        return;  // 검사 우회됨
    }
    memcpy(dst, src, total);  // 버퍼 오버플로우!
}

// len1 = 0xFFFFFFFF, len2 = 1
// total = 0x100000000 → 64비트에서는 잘리면 0
// total(0) <= MAX_SIZE → 검사 통과
// memcpy(dst, src, 0) → 문제없어 보이지만...
```

### 4.2 배열 인덱스 오버플로우

```c
// 취약한 코드
int arr[100];
int index = INT_MAX;
arr[index + 1] = 0;  // index+1 오버플로우 → 음수 인덱스 → OOB
```

### 4.3 실제 보안 사례: 하트블리드(HeartBleed, CVE-2014-0160)

OpenSSL의 Heartbeat 구현에서 클라이언트가 보낸 `length` 값을 검증 없이 사용. 실제 데이터보다 큰 `length`를 요청하면 메모리 내용이 노출됨.

---

## 5. 오버플로우 안전하게 감지하기

### 방법 1: 연산 전 범위 검사

```c
// 덧셈 오버플로우 감지
bool add_overflow(int a, int b, int *result) {
    if (b > 0 && a > INT_MAX - b) return true;  // overflow
    if (b < 0 && a < INT_MIN - b) return true;  // underflow
    *result = a + b;
    return false;
}
```

### 방법 2: 더 큰 타입 사용

```c
int a = INT_MAX, b = 1;
long long result = (long long)a + b;  // 오버플로우 없음
if (result > INT_MAX) {
    // 오버플로우 처리
}
```

### 방법 3: 컴파일러 내장 함수 (GCC/Clang)

```c
int a = INT_MAX, b = 1, result;
if (__builtin_add_overflow(a, b, &result)) {
    // 오버플로우 처리
    fprintf(stderr, "Overflow detected!\n");
} else {
    printf("Result: %d\n", result);
}

// 곱셈
if (__builtin_mul_overflow(a, b, &result)) {
    // ...
}
```

### 방법 4: 컴파일러 플래그

```bash
# UBSan (Undefined Behavior Sanitizer)
gcc -fsanitize=undefined hello.c -o hello
./hello  # 오버플로우 발생 시 런타임 에러 출력

# 출력 예:
# hello.c:5:15: runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'
```

---

## 6. 언어별 오버플로우 처리

| 언어 | 처리 방식 |
|------|----------|
| C (signed) | 정의되지 않은 동작 (UB) |
| C (unsigned) | 모듈러 래핑 |
| Java | 모듈러 래핑 (항상) |
| Python | 임의 정밀도 정수 (오버플로우 없음) |
| Rust | Debug: panic, Release: 래핑 (명시적 API 있음) |
| Go | 모듈러 래핑 |

Rust의 접근법이 가장 안전합니다:
```rust
let x: i32 = i32::MAX;
// let y = x + 1;          // Debug: panic!, Release: 래핑
let y = x.wrapping_add(1); // 의도적 래핑 (-2147483648)
let z = x.checked_add(1);  // Option<i32>: None (오버플로우)
let w = x.saturating_add(1); // i32::MAX (포화)
```

---

## 핵심 요약

- **Unsigned overflow**: 모듈러 2ⁿ 래핑. 명확히 정의된 동작.
- **Signed overflow (C)**: **정의되지 않은 동작(UB)**. 컴파일러가 이를 가정하고 최적화.
- **보안 영향**: 오버플로우는 버퍼 오버플로우, 정수 언더플로우 등 보안 취약점의 근원.
- **대응**: 연산 전 범위 검사, `__builtin_xxx_overflow`, UBSan 컴파일러 플래그 활용.
