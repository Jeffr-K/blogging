---
title: "공유 변수와 경쟁 상태: 스레드 안전성 (Thread Safety)"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "concurrency", "race-condition", "thread-safety", "csapp"]
---

## 경쟁 상태와 스레드 안전성

멀티스레드 프로그래밍에서 가장 중요하고 까다로운 개념입니다.

---

## 1. 경쟁 상태 (Race Condition)

```
정의: 프로그램의 결과가 스레드 실행 순서에 따라 달라지는 버그

예시: 두 스레드가 동시에 카운터 증가
  int counter = 0;
  
  void increment() {
      counter++;  // 이 한 줄이 사실 3개 명령어!
  }

어셈블리 수준:
  1. LOAD  R1, counter    (메모리에서 레지스터로)
  2. ADD   R1, R1, 1      (레지스터에서 +1)
  3. STORE counter, R1    (레지스터에서 메모리로)

인터리빙 문제:
  스레드 A              스레드 B
  LOAD R1=0
  (컨텍스트 스위칭)      LOAD R1=0
                         ADD  R1=1
                         STORE counter=1
  ADD  R1=1
  STORE counter=1      ← 스레드 B의 작업 덮어씀!
  
결과: counter=1 (기대: counter=2)
```

---

## 2. 임계 구역 (Critical Section)

```
임계 구역: 공유 자원에 접근하는 코드 블록
  → 한 번에 하나의 스레드만 실행해야 함

원자성 (Atomicity):
  임계 구역이 분리되지 않고 실행되어야 함
  "all or nothing"

임계 구역 요구사항:
  1. 상호 배제 (Mutual Exclusion): 동시 실행 금지
  2. 진행 (Progress): 임계 구역 밖 스레드가 방해 불가
  3. 유한 대기 (Bounded Waiting): 무한정 대기 금지
```

---

## 3. 스레드 안전 함수 분류

```
Class 1: 재진입 가능 (Reentrant) = 최고
  공유 데이터 전혀 없음
  항상 안전
  예: 순수 계산 함수, sin(), cos()

Class 2: 뮤텍스로 보호된 공유 변수
  잠금으로 경쟁 상태 방지
  예: 락이 있는 counter 증가

Class 3: 한 번만 초기화
  pthread_once()로 한 번만 실행
  예: 싱글톤 패턴

Class 4: 스레드 로컬 저장소 (TLS)
  스레드별 독립 복사본
  __thread int x; // GCC 확장
  thread_local int x; // C11/C++11
```

---

## 4. 스레드 안전하지 않은 함수들

```c
// rand(): 전역 시드 공유
// → rand_r(seed) 사용 (재진입 가능)

// strtok(): 내부 정적 버퍼 사용
char *token = strtok(str, ","); // 위험!
// → strtok_r(str, ",", &saveptr) 사용

// errno: POSIX에서 스레드 로컬로 정의됨 (현대 C 런타임)
// → 현대 환경에서는 안전

// glibc의 많은 함수들이 내부 static 변수 사용
// _r 접미사 버전이 재진입 가능 버전
//   gethostbyname() → gethostbyname_r()
//   ctime()         → ctime_r()
//   localtime()     → localtime_r()
```

---

## 5. 데이터 경쟁 탐지

```bash
# ThreadSanitizer (TSan): 데이터 경쟁 동적 감지
gcc -fsanitize=thread -g -o prog prog.c
./prog
# → 데이터 경쟁 발생 시 리포트 출력

# Helgrind (Valgrind): 락 순서 위반, 경쟁 감지
valgrind --tool=helgrind ./prog
```

```c
// 데이터 경쟁 있는 코드:
int g = 0;
void *thread_func(void *arg) {
    g++; // 경쟁 상태!
    return NULL;
}

// TSan 보고 메시지:
// WARNING: ThreadSanitizer: data race
//   Write of size 4 at 0x... by thread T2:
//     #0 thread_func prog.c:4
//   Previous read of size 4 at 0x... by thread T1:
//     #0 thread_func prog.c:4
```

---

## 6. 불변성 (Immutability)으로 회피

```c
// 가장 안전한 방법: 공유 데이터를 읽기 전용으로
const int CONFIG_VALUE = 42; // 스레드 안전

// 초기화 후 읽기만:
static char *config = NULL;
void init() {
    config = load_config(); // 단일 스레드에서 초기화
}
void *thread_func(void *arg) {
    printf("%s\n", config); // 읽기만 → 안전
    return NULL;
}

// 함수형 프로그래밍:
// 불변 데이터 + 순수 함수 → 경쟁 상태 근본 제거
// Erlang, Haskell, Rust의 기본 철학
```

---

## 핵심 요약

- **경쟁 상태**: 실행 순서에 따라 결과가 달라지는 버그. 간헐적이라 찾기 어려움.
- **원인**: 읽기-수정-쓰기가 원자적이지 않음.
- **임계 구역**: 공유 자원 접근 코드. 상호 배제 필요.
- **재진입 가능**: 공유 데이터 없는 함수. 가장 안전.
- **TSan**: 컴파일 시 `-fsanitize=thread`로 데이터 경쟁 탐지.
- **최선책**: 공유를 최소화하거나 불변 데이터 사용.
