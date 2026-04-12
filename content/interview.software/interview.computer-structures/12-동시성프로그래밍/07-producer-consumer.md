---
title: "생산자-소비자 (Producer-Consumer) 패턴"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "concurrency", "producer-consumer", "semaphore", "csapp"]
---

## 생산자-소비자 패턴

가장 중요한 동시성 패턴 중 하나입니다. 스레드 풀, 메시지 큐, 이벤트 시스템의 근간입니다.

---

## 1. 문제 정의

```
생산자 (Producer):
  아이템을 생성하여 버퍼에 넣음
  버퍼가 가득 차면 대기

소비자 (Consumer):
  버퍼에서 아이템을 꺼내 처리
  버퍼가 비면 대기

공유 버퍼 (Shared Buffer):
  생산자와 소비자를 분리
  속도 차이 흡수 (생산 > 소비 또는 반대)

동기화 필요:
  1. 버퍼 접근은 상호 배제 (한 번에 1개 스레드)
  2. 버퍼 가득 참 → 생산자 대기
  3. 버퍼 비어 있음 → 소비자 대기
```

---

## 2. 세마포어로 구현

```c
#include <pthread.h>
#include <semaphore.h>

#define BUF_SIZE 10

typedef struct {
    int items[BUF_SIZE];
    int in, out; // 링 버퍼 인덱스
} Buffer;

Buffer buf = {.in = 0, .out = 0};

sem_t empty;  // 빈 슬롯 수 (초기값: BUF_SIZE)
sem_t full;   // 찬 슬롯 수 (초기값: 0)
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;

void init() {
    sem_init(&empty, 0, BUF_SIZE); // BUF_SIZE개 빈 슬롯
    sem_init(&full,  0, 0);        // 0개 찬 슬롯
}

// 생산자
void produce(int item) {
    sem_wait(&empty);          // 빈 슬롯 기다림 (empty--)
    pthread_mutex_lock(&mutex);
    buf.items[buf.in] = item;
    buf.in = (buf.in + 1) % BUF_SIZE;
    pthread_mutex_unlock(&mutex);
    sem_post(&full);           // 찬 슬롯 알림 (full++)
}

// 소비자
int consume() {
    sem_wait(&full);           // 찬 슬롯 기다림 (full--)
    pthread_mutex_lock(&mutex);
    int item = buf.items[buf.out];
    buf.out = (buf.out + 1) % BUF_SIZE;
    pthread_mutex_unlock(&mutex);
    sem_post(&empty);          // 빈 슬롯 알림 (empty++)
    return item;
}
```

---

## 3. 조건 변수로 구현

```c
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t not_full  = PTHREAD_COND_INITIALIZER;
pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;

void produce(int item) {
    pthread_mutex_lock(&mutex);
    while (count == BUF_SIZE) {       // 버퍼 가득 참
        pthread_cond_wait(&not_full, &mutex); // 대기
    }
    buf[in] = item;
    in = (in + 1) % BUF_SIZE;
    count++;
    pthread_cond_signal(&not_empty);  // 소비자에게 신호
    pthread_mutex_unlock(&mutex);
}

int consume() {
    pthread_mutex_lock(&mutex);
    while (count == 0) {              // 버퍼 비어있음
        pthread_cond_wait(&not_empty, &mutex); // 대기
    }
    int item = buf[out];
    out = (out + 1) % BUF_SIZE;
    count--;
    pthread_cond_signal(&not_full);   // 생산자에게 신호
    pthread_mutex_unlock(&mutex);
    return item;
}
```

---

## 4. Java의 BlockingQueue

```java
// 고수준 추상화
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(10);

// 생산자
void producer() throws InterruptedException {
    while (true) {
        Task task = createTask();
        queue.put(task);   // 버퍼 가득 차면 블로킹
    }
}

// 소비자
void consumer() throws InterruptedException {
    while (true) {
        Task task = queue.take(); // 버퍼 비면 블로킹
        process(task);
    }
}
```

---

## 5. 실제 활용 사례

```
웹 서버 (스레드 풀):
  주 스레드: 요청 수신 → 큐에 추가 (생산자)
  워커 스레드: 큐에서 요청 꺼내 처리 (소비자)

로그 시스템:
  애플리케이션 스레드: 로그 이벤트 생성 (생산자)
  로그 기록 스레드: 파일/네트워크에 저장 (소비자)
  
  장점: 로그 쓰기가 메인 처리에 영향 없음

파이프라인 처리:
  단계1 → 버퍼1 → 단계2 → 버퍼2 → 단계3
  각 단계가 독립 속도로 실행
  예: 이미지 파이프라인, 컴파일러 단계
  
Kafka, RabbitMQ:
  분산 시스템의 생산자-소비자
  영속성 보장, 다수 소비자 그룹
```

---

## 6. 다수 생산자, 다수 소비자

```c
// 여러 생산자, 여러 소비자가 같은 큐 사용
// → 뮤텍스 하나로 충분 (큐 자체를 보호)

// 생산자 3개, 소비자 5개:
for (int i = 0; i < 3; i++) {
    pthread_create(&tid, NULL, producer_thread, &queue);
    pthread_detach(tid);
}
for (int i = 0; i < 5; i++) {
    pthread_create(&tid, NULL, consumer_thread, &queue);
    pthread_detach(tid);
}

// pthread_cond_broadcast vs pthread_cond_signal:
// signal: 대기 중인 스레드 하나만 깨움
// broadcast: 대기 중인 스레드 모두 깨움
// 다수 소비자의 경우 not_empty에는 signal로 충분 (하나만 처리)
// 단, Spurious Wakeup 때문에 while 루프 필수
```

---

## 핵심 요약

- **생산자-소비자**: 공유 버퍼를 통한 비동기 작업 처리.
- **세마포어**: `empty`(빈 슬롯), `full`(찬 슬롯) + `mutex`(버퍼 보호).
- **조건 변수**: `while`로 조건 재확인 필수 (spurious wakeup 대비).
- **실제 사용**: 스레드 풀, 로그 비동기 처리, 파이프라인.
- **다수 생산자/소비자**: 큐 뮤텍스 하나로 안전하게 처리.
