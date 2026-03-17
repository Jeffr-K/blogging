---
title: "운영체제 (Operating System) 면접 가이드"
date: 2026-03-17
tags:
  - cs
  - interview
  - os
---

# 운영체제 (Operating System)

운영체제(OS)는 하드웨어와 소프트웨어를 관리하는 시스템의 핵심으로, 엔지니어가 작성한 코드가 컴퓨터 위에서 어떻게 실행되고 자원을 할당받는지 이해하기 위해 필수적인 CS(Computer Science) 지식입니다.

면접에서는 주로 프로세스 관리(동시성, 스레드), 메모리 관리, 그리고 데드락(교착 상태)과 관련된 주제가 가장 빈번하게 출제됩니다. 아래 목차를 통해 운영체제의 핵심 개념들을 정복해 보세요.

---

## 1. 운영체제 개요 (OS Fundamentals)
운영체제의 역할과 커널, 그리고 사용자와 하드웨어 간의 인터페이스를 이해합니다.

*   [운영체제의 목적과 구조 (커널, 쉘)](./os-overview)
*   [시스템 콜(System Call)과 듀얼 모드 (유저 모드 vs 커널 모드)](./system-call)
*   [인터럽트(Interrupt)의 개념과 처리 과정](./interrupt)

## 2. 프로세스와 스레드 (Process & Thread)
면접에서 **가장 중요한 파트 1순위**입니다. 프로그램이 실행되는 단위와 동시성에 대해 다룹니다.

*   [**프로세스(Process) vs 스레드(Thread)의 차이점**](./process-vs-thread)
*   [프로세스의 메모리 구조 (Code, Data, Heap, Stack)](./process-memory-structure)
*   [PCB(Process Control Block)와 TCB(Thread Control Block)](./pcb-tcb)
*   [**문맥 교환 (Context Switching)**](./context-switching)
*   [멀티 프로세스 vs 멀티 스레드 (장단점 비교)](./multi-process-vs-multi-thread)
*   [크롬 브라우저의 멀티 프로세스 아키텍처 (실무 사례)](./chrome-architecture)

## 3. CPU 스케줄링 (CPU Scheduling)
한정된 CPU 자원을 여러 프로세스에 어떻게 분배할 것인지에 대한 알고리즘입니다.

*   [스케줄러의 종류 (장기, 단기, 중기 스케줄러)](./scheduler-types)
*   [선점형(Preemptive) vs 비선점형(Non-preemptive) 스케줄링](./preemptive-vs-nonpreemptive)
*   [주요 스케줄링 알고리즘 (FCFS, SJF, SRTF, RR, Priority)](./scheduling-algorithms)
*   [기아 상태(Starvation)와 에이징(Aging) 기법](./starvation-aging)

## 4. 동기화와 교착 상태 (Synchronization & Deadlock)
멀티 스레드 환경에서 자원 공유로 인해 발생하는 문제들과 그 해결책을 다룹니다. 면접 **중요도 2순위**입니다.

*   [임계 구역(Critical Section)과 경쟁 상태(Race Condition)](./critical-section)
*   [**뮤텍스(Mutex)와 세마포어(Semaphore)의 차이**](./mutex-vs-semaphore)
*   [모니터(Monitor) 개념](./monitor)
*   [**교착 상태(Deadlock)의 개념과 발생 4가지 조건**](./deadlock-conditions)
*   [교착 상태의 해결 방법 (예방, 회피, 발견, 회복 - 은행원 알고리즘)](./deadlock-solutions)

## 5. 메모리 관리 (Memory Management)
프로세스들이 제한된 물리 메모리를 어떻게 나누어 쓰는지, 그리고 가상 메모리 개념을 이해합니다.

*   [메모리 계층 구조 (캐시, 메인 메모리, 보조 기억 장치)](./memory-hierarchy)
*   [연속 메모리 할당 (단편화 - 내부/외부 단편화)](./fragmentation)
*   [**가상 메모리 (Virtual Memory)와 페이징(Paging) 시스템**](./virtual-memory-and-paging)
*   [세그멘테이션(Segmentation)](./segmentation)
*   [페이지 교체 알고리즘 (FIFO, LRU, LFU, Clock)](./page-replacement-algorithms)
*   [페이지 폴트(Page Fault)와 스레싱(Thrashing)](./page-fault-thrashing)

## 6. 파일 시스템 (File System) & I/O
디스크에 데이터를 저장하고 관리하는 방법입니다.

*   [파일 시스템의 구조 (i-node, FAT)](./file-system-structure)
*   [캐시 메모리(Cache Memory)의 원리와 지역성(Locality)](./cache-locality)

---

### 💡 면접 대비 팁 (Interview Tips)
*   **실무적 관점:** 면접관은 단순히 책에 있는 "세마포어의 정의가 무엇인가요?" 보다는, "여러 스레드가 동시에 공유 자원에 접근할 때 발생할 수 있는 문제는 무엇이고, 본인이라면 어떻게 해결하겠습니까?"와 같이 실무 상황에 빗대어 묻는 경우가 많습니다.
*   **Trade-off 이해:** 어떤 개념이든 완벽한 은 총알(Silver Bullet)은 없습니다. '멀티 프로세스'와 '멀티 스레드', '뮤텍스'와 '세마포어' 등 비교 대조군이 있는 주제들은 **각각의 장단점(Trade-off)**을 명확히 설명할 수 있어야 합니다.