---
title: "스레드 풀 (Thread Pool) 설계 원리"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "concurrency", "thread-pool", "csapp"]
---

## 스레드 풀 (Thread Pool)

미리 만들어둔 스레드들이 작업 큐에서 태스크를 꺼내 처리하는 패턴입니다.

---

## 1. 왜 스레드 풀이 필요한가

```
스레드 per 요청 방식의 문제:
  HTTP 요청마다 pthread_create() + pthread_join()
  
  비용:
    스레드 생성: ~수백 μs
    스택 메모리: 8MB (기본)
    10000 동시 요청 = 10000 스레드 = 80GB 스택!

스레드 풀 해결책:
  시작 시 N개 스레드 미리 생성
  요청 → 작업 큐에 추가
  유휴 스레드가 큐에서 꺼내 처리
  처리 후 스레드 반납 (재사용)

장점:
  ✓ 스레드 생성/삭제 비용 없음
  ✓ 메모리 사용량 예측 가능
  ✓ 동시성 제한 (과부하 방지)
  ✓ 자원 재사용
```

---

## 2. 스레드 풀 구현

```c
#include <pthread.h>
#include <semaphore.h>
#include <stdlib.h>

#define QUEUE_SIZE 1024
#define THREAD_COUNT 8

typedef void (*task_func)(void *);

typedef struct {
    task_func func;
    void *arg;
} Task;

typedef struct {
    Task queue[QUEUE_SIZE];
    int head, tail, count;
    pthread_mutex_t mutex;
    sem_t not_empty;  // 작업 있음 알림
    pthread_t threads[THREAD_COUNT];
    int shutdown;
} ThreadPool;

// 워커 스레드 함수
void *worker(void *arg) {
    ThreadPool *pool = (ThreadPool *)arg;
    
    while (1) {
        sem_wait(&pool->not_empty); // 작업 대기
        
        pthread_mutex_lock(&pool->mutex);
        if (pool->shutdown && pool->count == 0) {
            pthread_mutex_unlock(&pool->mutex);
            break;
        }
        
        Task task = pool->queue[pool->head];
        pool->head = (pool->head + 1) % QUEUE_SIZE;
        pool->count--;
        pthread_mutex_unlock(&pool->mutex);
        
        task.func(task.arg); // 작업 실행
    }
    return NULL;
}

// 풀 초기화
ThreadPool *pool_create(void) {
    ThreadPool *pool = calloc(1, sizeof(ThreadPool));
    pthread_mutex_init(&pool->mutex, NULL);
    sem_init(&pool->not_empty, 0, 0);
    
    for (int i = 0; i < THREAD_COUNT; i++) {
        pthread_create(&pool->threads[i], NULL, worker, pool);
    }
    return pool;
}

// 작업 제출
int pool_submit(ThreadPool *pool, task_func func, void *arg) {
    pthread_mutex_lock(&pool->mutex);
    if (pool->count == QUEUE_SIZE) {
        pthread_mutex_unlock(&pool->mutex);
        return -1; // 큐 가득 참
    }
    pool->queue[pool->tail] = (Task){func, arg};
    pool->tail = (pool->tail + 1) % QUEUE_SIZE;
    pool->count++;
    pthread_mutex_unlock(&pool->mutex);
    
    sem_post(&pool->not_empty); // 워커 깨움
    return 0;
}

// 풀 종료
void pool_destroy(ThreadPool *pool) {
    pool->shutdown = 1;
    // 모든 워커 깨움 (종료 신호)
    for (int i = 0; i < THREAD_COUNT; i++)
        sem_post(&pool->not_empty);
    for (int i = 0; i < THREAD_COUNT; i++)
        pthread_join(pool->threads[i], NULL);
    
    pthread_mutex_destroy(&pool->mutex);
    sem_destroy(&pool->not_empty);
    free(pool);
}
```

---

## 3. 고급 스레드 풀: 동적 크기 조정

```
스레드 수 동적 조정:
  
  부하 기반 조정:
    큐 길이 > 임계값 → 스레드 추가
    유휴 스레드 > 임계값 → 스레드 제거
    
  범위 제한:
    min_threads: 항상 유지할 최소 스레드 수
    max_threads: 최대 허용 스레드 수

Java Executors:
  // 고정 크기:
  ExecutorService pool = Executors.newFixedThreadPool(8);
  
  // 동적 크기 (캐시):
  ExecutorService pool = Executors.newCachedThreadPool();
  // 필요 시 스레드 생성, 60초 유휴 시 삭제
  
  // 설정 가능:
  ThreadPoolExecutor pool = new ThreadPoolExecutor(
      4,    // corePoolSize
      32,   // maximumPoolSize
      60L, TimeUnit.SECONDS, // keepAliveTime
      new ArrayBlockingQueue<>(1000) // 작업 큐
  );
```

---

## 4. 큐 거부 정책 (Rejection Policy)

```
큐가 가득 찬 경우 처리 방법:

AbortPolicy (기본):
  RejectedExecutionException 발생
  호출자가 예외 처리

CallerRunsPolicy:
  작업을 제출한 스레드가 직접 실행
  자연스러운 배압(backpressure)

DiscardPolicy:
  조용히 작업 버림 (유실 허용)

DiscardOldestPolicy:
  큐에서 가장 오래된 작업 버리고 새 작업 추가

커스텀:
  큐 가득 참 → 지연 후 재시도
  메트릭 기록
```

---

## 5. 작업 반환값: Future/Promise

```java
// Java CompletableFuture
ExecutorService pool = Executors.newFixedThreadPool(4);

Future<Integer> future = pool.submit(() -> {
    // 백그라운드에서 실행
    return computeExpensiveResult();
});

// 다른 작업 수행...

// 결과 가져오기 (블로킹)
int result = future.get(5, TimeUnit.SECONDS);
```

```c
// C에서 결과 수집 패턴
typedef struct {
    int input;
    int result;
    sem_t done; // 완료 신호
} Task;

void compute(void *arg) {
    Task *t = (Task *)arg;
    t->result = t->input * t->input;
    sem_post(&t->done); // 완료 알림
}

// 제출 후 기다림:
Task t = {.input = 7};
sem_init(&t.done, 0, 0);
pool_submit(pool, compute, &t);
sem_wait(&t.done);  // 결과 기다림
printf("결과: %d\n", t.result); // 49
```

---

## 6. 적정 스레드 수 결정

```
I/O 바운드 작업:
  스레드 대부분이 I/O 대기 중
  스레드 수 >> CPU 코어 수 (수십~수백)
  예: N = CPU 코어 × (1 + 대기 시간 / 처리 시간)

CPU 바운드 작업:
  스레드 대부분이 계산 중
  스레드 수 ≈ CPU 코어 수 (또는 +1)
  스레드가 너무 많으면 컨텍스트 스위칭 오버헤드

혼합:
  프로파일링으로 최적값 실험적 결정
  
일반 지침:
  일반 서버: CPU 코어 × 2
  DB 집약적: CPU 코어 × 4 ~ 8
  순수 CPU: CPU 코어 수
```

---

## 핵심 요약

- **스레드 풀**: 미리 생성한 스레드들이 작업 큐에서 태스크를 꺼내 처리.
- **생산자-소비자**: 제출 스레드(생산자) + 워커 스레드(소비자).
- **큐 포화**: 거부 정책 필요 (abort, caller-runs, discard).
- **I/O 바운드**: 스레드 많이. **CPU 바운드**: 코어 수에 맞게.
- **동적 풀**: 부하에 따라 스레드 수 조절 (Java CachedThreadPool 등).
