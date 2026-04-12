---
title: "부동소수점 정밀도 오차와 반올림 문제"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "floating-point", "precision", "rounding", "csapp"]
---

## 부동소수점 정밀도 문제

부동소수점 연산은 **실수를 유한한 비트로 근사**하기 때문에 정밀도 오차가 발생합니다. 이를 이해하지 못하면 돈을 잘못 계산하거나, 루프가 예상치 못하게 종료되거나, 수치 해석이 폭발할 수 있습니다.

---

## 1. 0.1을 이진수로 표현할 수 없다

십진수 0.1은 이진수로 **무한 순환소수**입니다. float이나 double로 정확히 표현할 수 없습니다.

```
0.1 (십진수) → 이진 변환:
0.1 × 2 = 0.2  → 0
0.2 × 2 = 0.4  → 0
0.4 × 2 = 0.8  → 0
0.8 × 2 = 1.6  → 1
0.6 × 2 = 1.2  → 1
0.2 × 2 = 0.4  → 0  ← 반복 시작
...

0.1₁₀ = 0.000110011001100110011...₂  (무한 반복)
```

double(64비트)은 이를 52비트 가수로 잘라서 저장하므로 근사값입니다.

```python
>>> 0.1 + 0.2
0.30000000000000004  # 정확히 0.3이 아님!

>>> 0.1 + 0.2 == 0.3
False
```

---

## 2. 정밀도 손실의 종류

### 2.1 표현 오차 (Representation Error)

0.1, 0.2처럼 이진수로 정확히 표현할 수 없는 수.

```c
double x = 0.1;
printf("%.20f\n", x);  
// 0.10000000000000000555  (정확히 0.1이 아님)
```

### 2.2 반올림 오차 (Rounding Error)

유한한 비트로 인해 연산 결과를 반올림할 때 발생.

```c
float a = 16777216.0f;  // 2^24 (float의 정수 정밀도 한계)
float b = a + 1.0f;
printf("%f\n", b);  // 16777216.000000 (1이 사라짐!)

// float의 유효 자리수: ~7자리
// 16777216은 8자리 → 더 이상 1씩 구분 불가
```

### 2.3 치명적 소거 (Catastrophic Cancellation)

거의 같은 두 수를 빼면 유효 자리가 급격히 줄어드는 현상.

```c
double a = 1.000000001;
double b = 1.000000000;
double diff = a - b;  // 1e-9이어야 하지만...
printf("%.20f\n", diff);  // 실제로는 정밀도 손실 발생

// 큰 예시:
double x = 100000.0001;
double y = 100000.0000;
double z = x - y;  // 이론: 1e-4, 실제: 약간의 오차
```

---

## 3. 실무에서 부동소수점 비교 방법

### ❌ 잘못된 방법

```c
float a = 0.1f + 0.2f;
float b = 0.3f;
if (a == b) {  // 거의 항상 false! 절대 금지
    printf("같음\n");
}
```

### ✅ 올바른 방법 1: 절대 오차 (Epsilon 비교)

```c
#include <math.h>
#include <float.h>

bool float_equal(float a, float b) {
    return fabsf(a - b) < FLT_EPSILON;  // FLT_EPSILON ≈ 1.19e-7
}

bool double_equal(double a, double b) {
    return fabs(a - b) < DBL_EPSILON;   // DBL_EPSILON ≈ 2.22e-16
}
```

> **단점**: 큰 수에 대해서는 FLT_EPSILON이 너무 작음.

### ✅ 올바른 방법 2: 상대 오차 (Relative Epsilon)

```c
bool approx_equal(double a, double b, double rel_eps) {
    double diff = fabs(a - b);
    double max_val = fmax(fabs(a), fabs(b));
    if (max_val == 0.0) return diff == 0.0;
    return diff / max_val < rel_eps;
}

// 사용 예:
approx_equal(1000000.0, 1000000.1, 1e-6);  // true
approx_equal(0.0001, 0.00010001, 1e-3);    // true
```

### ✅ 올바른 방법 3: ULP (Units in the Last Place) 비교

두 float이 얼마나 "가까운" 표현인지를 비트 단위로 비교.

```c
bool floats_are_close(float a, float b, int max_ulps) {
    int ia, ib;
    memcpy(&ia, &a, 4);
    memcpy(&ib, &b, 4);
    // 음수 처리
    if (ia < 0) ia = 0x80000000 - ia;
    if (ib < 0) ib = 0x80000000 - ib;
    return abs(ia - ib) <= max_ulps;
}
```

---

## 4. 재무 계산에서의 올바른 방법

부동소수점으로 돈을 계산하면 안 됩니다.

```python
# 잘못된 방법
price = 0.1 + 0.2  # 0.30000000000000004

# 올바른 방법 1: 정수로 환산 (센트 단위)
price_cents = 10 + 20  # 30 cents (정확!)

# 올바른 방법 2: Python Decimal
from decimal import Decimal
price = Decimal('0.1') + Decimal('0.2')  # Decimal('0.3') 정확!
```

```java
// Java에서 BigDecimal 사용
BigDecimal a = new BigDecimal("0.1");
BigDecimal b = new BigDecimal("0.2");
BigDecimal sum = a.add(b);  // 0.3 (정확!)
```

---

## 5. 수치 안정성 (Numerical Stability)

알고리즘의 수치 안정성은 부동소수점 오차가 누적되지 않도록 설계하는 것입니다.

### 예시: 두 근 공식

```
이차 방정식 ax² + bx + c = 0의 근:
x = (-b ± √(b²-4ac)) / 2a
```

b가 매우 크면 `-b + √(b²-4ac)`에서 치명적 소거 발생.

**수치 안정적 공식**:
```c
// 큰 b에 대한 안정적 계산
double discriminant = b*b - 4*a*c;
double sqrt_d = sqrt(discriminant);

// b의 부호에 따라 분모를 선택 (치명적 소거 방지)
double x1 = (-b - copysign(sqrt_d, b)) / (2*a);
double x2 = c / (a * x1);  // 비에타 공식 활용
```

---

## 핵심 요약

- **0.1은 이진수로 정확히 표현 불가**: 무한 순환소수이므로 float/double은 근사값.
- **절대 `==`로 비교하지 말 것**: 엡실론(epsilon) 기반 비교를 사용.
- **치명적 소거**: 비슷한 두 수를 빼면 유효 자리가 급감. 알고리즘 설계 시 주의.
- **재무 계산**: 부동소수점 금지. 정수(센트 단위) 또는 `BigDecimal` 사용.
- **수치 안정성**: 오차 누적을 최소화하는 알고리즘 설계가 중요.
