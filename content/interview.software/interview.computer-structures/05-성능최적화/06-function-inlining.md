---
title: "함수 인라이닝(Function Inlining)과 최적화"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "inlining", "optimization", "compiler", "csapp"]
---

## 함수 인라이닝 (Function Inlining)

함수 인라이닝은 **함수 호출을 함수 본문으로 대체**하는 컴파일러 최적화입니다. 호출 오버헤드를 제거하고, 인라이닝 이후 추가 최적화 기회를 만듭니다.

---

## 1. 함수 호출의 비용

함수를 호출할 때는 다음 작업이 필요합니다:

```asm
; 호출자 (Caller)
pushq   %rbp              ; 프레임 포인터 저장
subq    $48, %rsp         ; 스택 공간 할당
movq    %rdi, -8(%rbp)    ; 인자 저장
callq   func              ; 1) 반환 주소 push, 2) 점프
; 함수 반환 후:
movq    %rax, %rcx        ; 반환값 사용
addq    $48, %rsp         ; 스택 복원
```

비용 분석:
```
함수 호출 오버헤드:
- 반환 주소 push (1 사이클)
- 스택 프레임 설정 (2~5 사이클)
- 인자 전달 (레지스터: 0, 스택: N사이클)
- 분기 예측 비용 (indirect call: ~5 사이클)
- 반환 값 처리 (1 사이클)

합계: ~10~20 사이클
→ 본문이 짧으면 오버헤드가 본문보다 클 수 있음!
```

---

## 2. 인라이닝의 효과

```c
// 인라이닝 전
static int square(int x) { return x * x; }

int compute(int a, int b) {
    return square(a) + square(b);
}
```

컴파일러가 인라이닝하면:
```c
// 인라이닝 후 (컴파일러 내부 표현)
int compute(int a, int b) {
    return (a * a) + (b * b);  // 함수 호출 없음!
}
```

어셈블리 비교:
```asm
; 인라이닝 전:
call square    ; 10 사이클
...
call square    ; 10 사이클

; 인라이닝 후:
imulq %rdi, %rdi   ; 1 사이클
imulq %rsi, %rsi   ; 1 사이클
addq  %rsi, %rdi   ; 1 사이클
; 20 사이클 → 3 사이클!
```

---

## 3. inline 키워드와 컴파일러 동작

### 3.1 C/C++에서 inline

```c
// inline 힌트 (컴파일러가 무시할 수 있음)
inline int max(int a, int b) {
    return a > b ? a : b;
}

// 강제 인라이닝 (GCC 확장)
__attribute__((always_inline))
static inline int min(int a, int b) {
    return a < b ? a : b;
}

// 인라이닝 방지
__attribute__((noinline))
void debug_print(const char *msg) {
    // 디버그 시 스택 추적을 위해 인라이닝 방지
    printf("%s\n", msg);
}
```

### 3.2 컴파일러의 인라이닝 결정

컴파일러는 다음 기준으로 인라이닝 여부를 결정합니다:

```
인라이닝 유리:
✓ 함수 본문이 짧음 (< 30 명령어)
✓ 호출 횟수가 적음 (핫스팟 아님)
✓ 인라이닝 후 추가 최적화 가능 (상수 전파 등)

인라이닝 불리:
✗ 본문이 길면 코드 크기 증가 → I-Cache 압박
✗ 재귀 함수 (직접 인라이닝 불가)
✗ 가상 함수 (vtable 통한 간접 호출)
✗ 함수 포인터 (컴파일 시점에 대상 모름)
```

---

## 4. 인라이닝 이후 추가 최적화

인라이닝이 강력한 이유는 호출 제거 외에 **추가 최적화 기회**를 만들기 때문입니다.

### 4.1 상수 전파 (Constant Propagation)

```c
int clamp(int x, int lo, int hi) {
    if (x < lo) return lo;
    if (x > hi) return hi;
    return x;
}

int result = clamp(value, 0, 255);  // lo=0, hi=255 상수

// 인라이닝 + 상수 전파 후:
int result;
if (value < 0) result = 0;
else if (value > 255) result = 255;
else result = value;
// 그리고 0과 255가 상수이므로 추가 최적화 가능
```

### 4.2 데드 코드 제거 (Dead Code Elimination)

```c
int safe_div(int a, int b, int *error) {
    if (b == 0) {
        *error = 1;
        return 0;
    }
    *error = 0;
    return a / b;
}

// 항상 b != 0인 컨텍스트에서 호출:
int err;
int result = safe_div(x, 4, &err);  // b=4, 절대 0 아님

// 인라이닝 후 컴파일러가:
// if (4 == 0) → 항상 false → 분기 제거!
int result = x / 4;  // 단순화
```

### 4.3 레지스터 최적화

```c
// 인라이닝 전: 인자를 레지스터로 전달하고 스택 프레임 설정
// 인라이닝 후: 지역 변수로 레지스터에 직접 배치
//             스택 조작 없음 → 레지스터 활용 극대화
```

---

## 5. LTO (Link-Time Optimization)

인라이닝은 컴파일 단위(translation unit) 내에서만 적용됩니다. **LTO**를 사용하면 다른 파일의 함수도 인라이닝할 수 있습니다.

```bash
# LTO 활성화
gcc -O2 -flto -o program a.c b.c c.c
# 또는
gcc -O2 -flto a.c -c -o a.o
gcc -O2 -flto b.c -c -o b.o
gcc -O2 -flto a.o b.o -o program

# LTO는 링커 단계에서 전체 프로그램 최적화 수행
# 다른 .c 파일의 작은 함수도 인라이닝 가능
```

LTO 효과:
```
일반 컴파일:  a.o의 함수 → b.o의 함수: 항상 호출
LTO:         b.o의 작은 함수 → a.o에서 인라이닝 가능
→ 경계를 넘는 최적화 (Inter-procedural Optimization)
```

---

## 6. 인라이닝 트레이드오프

```
인라이닝 과도하면:
- 코드 크기 급증 (Code Bloat)
- I-Cache(명령어 캐시) 용량 초과
- 오히려 I-Cache 미스 증가 → 성능 저하

최적 인라이닝:
- 작은 함수 (getter/setter, min/max, 간단한 변환)
- 루프 내부에서 자주 호출되는 함수
- 인라이닝 후 상수 전파/데드 코드 제거 효과가 큰 함수

인라이닝 피해야 할 경우:
- 큰 함수 (100+ 명령어)
- 에러 경로 (드물게 호출)
- 디버깅이 중요한 코드
```

---

## 핵심 요약

- **함수 호출 비용**: 스택 프레임 설정, 인자 전달, 반환 처리 등 ~10~20 사이클.
- **인라이닝**: 함수 본문을 호출 위치에 삽입하여 오버헤드 제거. 추가로 상수 전파, 데드 코드 제거 가능.
- **`always_inline`**: 컴파일러에게 반드시 인라이닝하도록 강제. 짧고 핫한 함수에 유용.
- **LTO**: 링크 타임에 파일 경계를 넘어 인라이닝 및 전체 프로그램 최적화.
- **코드 크기 트레이드오프**: 과도한 인라이닝은 I-Cache 압박으로 역효과. 프로파일링으로 적절한 수준 결정.
