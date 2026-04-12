---
title: "데드락 (Deadlock): 발생 조건과 회피 전략"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "concurrency", "deadlock", "csapp"]
---

## 데드락 (Deadlock)

두 개 이상의 스레드가 서로 상대방이 보유한 자원을 기다리며 **영원히 대기하는 상태**입니다.

---

## 1. 데드락 예시

```c
pthread_mutex_t A = PTHREAD_MUTEX_INITIALIZER;
pthread_mutex_t B = PTHREAD_MUTEX_INITIALIZER;

void *thread1(void *arg) {
    pthread_mutex_lock(&A);
    sleep(1); // 스레드2가 B를 잠글 시간 줌
    pthread_mutex_lock(&B); // ← 영원히 대기!
    // ...
    pthread_mutex_unlock(&B);
    pthread_mutex_unlock(&A);
    return NULL;
}

void *thread2(void *arg) {
    pthread_mutex_lock(&B);
    sleep(1);
    pthread_mutex_lock(&A); // ← 영원히 대기!
    // ...
    pthread_mutex_unlock(&A);
    pthread_mutex_unlock(&B);
    return NULL;
}
```

```
교착 상황:
  스레드1: A 보유, B 대기
  스레드2: B 보유, A 대기
  → 서로 기다림 → 영원히 진전 없음
```

---

## 2. 코프만 조건 (Coffman Conditions)

데드락이 발생하려면 **4가지 조건이 모두** 만족되어야 합니다.

```
1. 상호 배제 (Mutual Exclusion):
   자원은 한 번에 하나의 스레드만 사용 가능
   
2. 점유와 대기 (Hold and Wait):
   자원을 보유한 채로 다른 자원을 기다림
   
3. 선점 불가 (No Preemption):
   자원을 강제로 빼앗을 수 없음
   스레드가 자발적으로 해제해야 함
   
4. 순환 대기 (Circular Wait):
   스레드 체인이 순환 형태로 대기
   T1 → T2 → T3 → T1 (자원 대기 사슬)

하나라도 깨면 데드락 없음!
```

---

## 3. 데드락 예방 (Prevention)

```
조건 1 (상호 배제) 제거:
  불가능한 경우 많음 (락의 본질)
  읽기 전용 자원은 공유 허용 (RWLock)

조건 2 (점유와 대기) 제거:
  자원 전부 한 번에 요청 (All-or-Nothing)
  장점: 데드락 없음
  단점: 자원 낭비 (필요 없는 자원도 미리 잠금)

조건 3 (선점 불가) 제거:
  자원 강제 회수
  예: trylock + 실패 시 보유 자원 모두 해제
  단점: starvation 가능성

조건 4 (순환 대기) 제거: ← 가장 실용적!
  자원에 전역 순서 번호 부여
  항상 번호 오름차순으로만 획득
  
  예:
    mutex_A 번호: 1
    mutex_B 번호: 2
    모든 스레드: lock(A) 다음 lock(B) ← 순환 불가!
```

---

## 4. 데드락 회피 (Avoidance): 은행원 알고리즘

```
은행원 알고리즘 (Banker's Algorithm):
  자원 할당 전 "안전한 상태"인지 확인
  안전한 상태: 모든 스레드가 최종적으로 자원 획득 가능

안전 순서 (Safe Sequence):
  T1, T2, T3, ... 순서로 자원 할당이 가능한 순서
  T1 완료 후 자원 반납 → T2 할당 가능, ...

실용성:
  최대 자원 요구량을 미리 선언해야 함 → 비현실적
  OS에서는 잘 사용 안 함
  DB 시스템 등 특수 환경에서 활용
```

---

## 5. 데드락 탐지 및 복구

```
탐지 (Detection):
  자원 할당 그래프 (Resource Allocation Graph)
  순환이 있으면 데드락
  
  주기적으로 그래프 검사
  → 오버헤드 있지만 발생 후 처리

복구 (Recovery):
  방법 1: 스레드 종료
    데드락 관련 스레드 하나씩 강제 종료
    → 데드락 깨질 때까지 반복
    단점: 작업 손실
  
  방법 2: 자원 선점
    데드락 스레드에서 자원 강제 회수
    → 해당 스레드를 이전 상태로 롤백
    단점: 롤백 메커니즘 필요
  
  방법 3: 프로세스/스레드 재시작
    가장 간단하지만 작업 손실

DB 트랜잭션:
  데드락 탐지 후 희생자(victim) 트랜잭션 롤백
  다른 트랜잭션이 완료 후 재시도
```

---

## 6. trylock으로 데드락 방지

```c
void transfer(Account *from, Account *to, int amount) {
    while (1) {
        if (pthread_mutex_trylock(&from->lock) == 0) {
            if (pthread_mutex_trylock(&to->lock) == 0) {
                // 두 락 모두 획득 성공
                from->balance -= amount;
                to->balance += amount;
                pthread_mutex_unlock(&to->lock);
                pthread_mutex_unlock(&from->lock);
                return;
            }
            // to 락 실패 → from 락 해제 후 재시도
            pthread_mutex_unlock(&from->lock);
        }
        // 잠시 대기 (livelock 방지)
        usleep(1000 + rand() % 1000); // 랜덤 백오프
    }
}
// 주의: livelock 발생 가능 → 랜덤 백오프로 완화
// 더 나은 해결: 락 순서 정규화
```

---

## 7. 데드락 vs 라이브락 vs 기아

```
데드락 (Deadlock):
  모든 스레드가 완전히 멈춤
  진전 없음 + CPU 사용 없음

라이브락 (Livelock):
  스레드들이 계속 실행 중이지만 진전 없음
  예: 서로 양보하다가 계속 충돌
  CPU 사용 있음 (바쁜 낭비)
  해결: 랜덤 백오프, 우선순위

기아 (Starvation):
  일부 스레드가 영원히 자원 획득 못 함
  다른 스레드들은 정상 진행
  해결: 공정한 스케줄링, 타임아웃
```

---

## 핵심 요약

- **데드락**: 순환 대기로 영원히 진전 없음.
- **코프만 4조건**: 상호 배제 + 점유대기 + 선점불가 + 순환대기 → 모두 필요.
- **예방**: 락 순서 고정 (조건 4 제거)이 가장 실용적.
- **회피**: 은행원 알고리즘 (현실에서 비실용적).
- **탐지+복구**: DB 트랜잭션 방식 (희생자 롤백).
- **trylock + 백오프**: 데드락 없지만 라이브락 주의.
