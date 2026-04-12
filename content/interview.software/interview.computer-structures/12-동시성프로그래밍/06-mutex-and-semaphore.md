---
title: "뮤텍스 (Mutex)와 세마포어 (Semaphore)로 동기화하기"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "concurrency", "mutex", "semaphore", "synchronization", "csapp"]
---

## 뮤텍스와 세마포어

공유 자원에 대한 동시 접근을 제어하는 동기화 도구입니다.

---

## 1. 뮤텍스 (Mutex, Mutual Exclusion Lock)

```
상호 배제 잠금: 한 번에 하나의 스레드만 임계 구역 실행

상태: 잠김(locked) / 열림(unlocked)
소유권: 잠금을 획득한 스레드만 해제 가능
```

```c
#include <pthread.h>

pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
int counter = 0;

void *increment(void *arg) {
    for (int i = 0; i < 1000000; i++) {
        pthread_mutex_lock(&lock);   // 잠금 획득 (블로킹)
        counter++;                    // 임계 구역
        pthread_mutex_unlock(&lock); // 잠금 해제
    }
    return NULL;
}

// 동적 초기화:
pthread_mutex_t lock;
pthread_mutex_init(&lock, NULL);
// ...
pthread_mutex_destroy(&lock);

// 비블로킹 시도:
if (pthread_mutex_trylock(&lock) == 0) {
    // 잠금 획득 성공
    // ...
    pthread_mutex_unlock(&lock);
} else {
    // 잠금 획득 실패 (이미 잠김)
}
```

---

## 2. 뮤텍스 내부 동작

```
lock() 구현 (간단화):
  원자적 테스트-설정 (test-and-set):
    if (mutex == 0) {
        mutex = 1;  // 원자적으로!
        return;     // 성공
    } else {
        // 대기 (스핀 or sleep)
    }

실제 Linux 구현 (futex):
  사용자 공간에서 원자적 연산으로 먼저 시도
  충돌 시 커널의 futex 시스템 콜로 대기
  → 경합 없을 때 시스템 콜 없음 = 빠름

스핀락 (Spinlock):
  대기 중 CPU를 계속 사용 (바쁜 대기, busy-wait)
  짧은 임계 구역에 유리 (컨텍스트 스위칭 없음)
  
뮤텍스:
  대기 중 sleep → OS가 깨워줌
  긴 임계 구역에 유리
```

---

## 3. 세마포어 (Semaphore)

```
뮤텍스보다 일반화된 동기화 도구
값(count)을 가지며 P(wait)와 V(signal) 두 연산

카운팅 세마포어:
  값 범위: 0 ~ n
  예: 데이터베이스 최대 10개 연결 허용

이진 세마포어 (값 0 또는 1):
  뮤텍스와 유사. 단, 소유권 없음 (다른 스레드가 V 가능)
```

```c
#include <semaphore.h>

// 초기화: 값 1로 (이진 세마포어)
sem_t sem;
sem_init(&sem, 0, 1); // 0 = 프로세스 내 공유, 1 = 초기값

// P 연산 (wait, 감소): 값이 0이면 블로킹
sem_wait(&sem);
// 임계 구역
sem_post(&sem); // V 연산 (signal, 증가)

// 비블로킹:
if (sem_trywait(&sem) == 0) {
    // 성공
    sem_post(&sem);
}

// 타임아웃:
struct timespec ts;
clock_gettime(CLOCK_REALTIME, &ts);
ts.tv_sec += 5; // 5초 타임아웃
sem_timedwait(&sem, &ts);

sem_destroy(&sem);
```

---

## 4. 뮤텍스 vs 세마포어

```
                뮤텍스          세마포어
소유권:         예 (획득자만 해제) 없음 (다른 스레드가 V 가능)
초기값:         항상 1           0 ~ n
용도:           상호 배제        신호 전달, 자원 카운팅
교착상태:       같은 스레드 재잠금 → 교착 이진 세마포어도 교착 가능
재귀 락:        특수 설정 필요    해당 없음
성능:           약간 빠름         약간 느림

사용 지침:
  상호 배제 → 뮤텍스
  자원 풀 관리 (최대 N개) → 카운팅 세마포어
  스레드 간 신호 전달 → 세마포어 (초기값 0)
  조건 대기 → 조건 변수(Condition Variable)
```

---

## 5. 조건 변수 (Condition Variable)

```c
// 뮤텍스 + 조건 변수로 복잡한 동기화 구현

pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t cond = PTHREAD_COND_INITIALIZER;
int ready = 0;

// 소비자 스레드:
void *consumer(void *arg) {
    pthread_mutex_lock(&mutex);
    while (!ready) {                // while! (spurious wakeup 대비)
        pthread_cond_wait(&cond, &mutex); // 원자적으로: mutex 해제 + 대기
    }
    // ready == 1, mutex 보유 상태
    consume_data();
    pthread_mutex_unlock(&mutex);
    return NULL;
}

// 생산자 스레드:
void *producer(void *arg) {
    produce_data();
    pthread_mutex_lock(&mutex);
    ready = 1;
    pthread_cond_signal(&cond);   // 하나 깨움
    // 또는: pthread_cond_broadcast(&cond); // 모두 깨움
    pthread_mutex_unlock(&mutex);
    return NULL;
}
```

---

## 6. 락 획득 순서 규칙

```
데드락 방지 규칙:
  항상 같은 순서로 락 획득

위험한 코드:
  스레드 A: lock(mutex1); lock(mutex2);
  스레드 B: lock(mutex2); lock(mutex1); ← 순서 다름!
  → 교착 발생 가능

안전한 코드:
  스레드 A, B 모두: lock(mutex1); lock(mutex2);
  → 같은 순서 → 교착 없음

실제 적용:
  여러 뮤텍스에 전역 순서 번호 부여
  번호 순서대로만 잠금
```

---

## 핵심 요약

- **뮤텍스**: 임계 구역 보호. 한 번에 1개 스레드만. 소유권 있음.
- **세마포어**: 카운터 기반. P(감소/대기), V(증가/신호). 소유권 없음.
- **조건 변수**: 특정 조건이 될 때까지 대기. `while`로 감싸야 함.
- **스핀락**: 짧은 임계 구역에 빠름. 긴 대기 시 CPU 낭비.
- **락 순서**: 항상 같은 순서로 여러 락 획득 → 데드락 방지.
