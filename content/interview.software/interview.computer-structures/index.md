---
title: "컴퓨터 구조 (Computer Architecture) 면접 가이드"
date: 2026-04-09
tags:
  - cs
  - interview
  - computer-architecture
  - csapp
---

# 컴퓨터 구조 (Computer Architecture)

컴퓨터 구조는 "내가 작성한 코드가 하드웨어 위에서 어떻게 동작하는가"를 이해하는 학문입니다. CSAPP(Computer Systems: A Programmer's Perspective)를 기반으로, 비트(bit) 표현부터 CPU 파이프라인, 메모리 계층, 링킹, 그리고 동시성까지 프로그래머가 알아야 할 시스템의 모든 층위를 다룹니다.

면접에서는 캐시 동작 원리, 메모리 모델, 어셈블리 수준의 프로그램 이해, 파이프라인 해저드가 자주 출제됩니다. 아래 목차를 통해 컴퓨터 구조의 핵심 개념들을 정복해 보세요.

---

## 1. 컴퓨터 시스템 개요 (A Tour of Computer Systems)

"Hello, World" 프로그램이 컴파일되고 실행되기까지 시스템 전체를 조망합니다.

*   [컴퓨터 시스템의 추상화 계층 (하드웨어 → OS → 애플리케이션)](./system-abstraction-layers)
*   [프로그램의 생애주기: 전처리 → 컴파일 → 어셈블 → 링크 → 실행](./program-lifecycle)
*   [버스(Bus), I/O 디바이스, 메인 메모리, 프로세서의 역할](./hardware-components)
*   [캐시(Cache)가 존재하는 이유: 속도 간격(Speed Gap) 문제](./why-cache-exists)
*   [운영체제가 하드웨어를 추상화하는 방법 (프로세스, 파일, 가상 메모리)](./os-abstractions)
*   [Amdahl의 법칙: 시스템 성능 개선의 한계](./amdahls-law)

---

## 2. 정보의 표현과 처리 (Representing and Manipulating Information)

컴퓨터는 모든 것을 비트로 표현합니다. 정수, 부동소수점, 문자열이 내부적으로 어떻게 저장되는지 이해합니다.

*   [**비트(Bit)와 바이트(Byte): 정보의 최소 단위**](./bits-and-bytes)
*   [정수 표현: 부호 없는 정수(Unsigned) vs 2의 보수(Two's Complement)](./integer-representation)
*   [정수 연산의 함정: 오버플로우(Overflow)와 언더플로우(Underflow)](./integer-overflow)
*   [비트 연산 (AND, OR, XOR, NOT, Shift)과 활용법](./bitwise-operations)
*   [**부동소수점(Floating-Point): IEEE 754 표준**](./ieee-754)
*   [부동소수점 정밀도 오차와 반올림 문제](./floating-point-precision)
*   [엔디안(Endianness): 빅 엔디안 vs 리틀 엔디안](./endianness)
*   [문자 인코딩: ASCII, UTF-8, UTF-16](./character-encoding)

---

## 3. 기계어 수준의 프로그램 표현 (Machine-Level Representation of Programs)

컴파일러가 C 코드를 x86-64 어셈블리로 변환하는 과정을 이해합니다. 스택 프레임, 재귀, 버퍼 오버플로우의 근원을 파악합니다.

*   [어셈블리(Assembly) 언어 기초: 레지스터, 피연산자, 명령어](./assembly-basics)
*   [**x86-64 레지스터 체계 (rax, rbx, rsp, rbp, rip 등)**](./x86-64-registers)
*   [데이터 이동 명령어: MOV, PUSH, POP](./data-movement-instructions)
*   [산술 및 논리 연산 명령어 (ADD, SUB, IMUL, LEA)](./arithmetic-instructions)
*   [제어 흐름: 조건 코드(Condition Code)와 조건 분기 (JMP, JE, JNE)](./control-flow-instructions)
*   [**프로시저 호출과 스택 프레임 (Stack Frame) 구조**](./stack-frame)
*   [함수 호출 규약(Calling Convention): 인자 전달과 반환값](./calling-convention)
*   [배열, 구조체, 공용체(Union)의 메모리 레이아웃](./data-structures-memory-layout)
*   [**버퍼 오버플로우(Buffer Overflow) 공격과 스택 카나리아(Stack Canary)](./buffer-overflow)
*   [**재귀(Recursion)의 어셈블리 레벨 동작 원리**](./recursion-in-assembly)

---

## 4. 프로세서 아키텍처 (Processor Architecture)

CPU가 내부적으로 명령어를 어떻게 실행하는지, 파이프라인을 통해 어떻게 성능을 높이는지 이해합니다.

*   [명령어 집합 구조(ISA): RISC vs CISC](./isa-risc-vs-cisc)
*   [**CPU의 명령어 실행 사이클: Fetch → Decode → Execute → Write-back**](./instruction-execution-cycle)
*   [**파이프라이닝(Pipelining)의 원리와 성능 향상**](./pipelining)
*   [파이프라인 해저드(Hazard): 데이터 해저드, 제어 해저드, 구조적 해저드](./pipeline-hazards)
*   [데이터 포워딩(Data Forwarding)과 스톨(Stall)로 해저드 해결하기](./data-forwarding-and-stall)
*   [**분기 예측(Branch Prediction)의 원리와 중요성**](./branch-prediction)
*   [비순차적 실행(Out-of-Order Execution)과 투기적 실행(Speculative Execution)](./out-of-order-execution)
*   [슈퍼스칼라(Superscalar)와 VLIW 아키텍처](./superscalar-vliw)
*   [멜트다운(Meltdown)과 스펙터(Spectre): 투기적 실행의 보안 취약점](./meltdown-spectre)

---

## 5. 프로그램 성능 최적화 (Optimizing Program Performance)

컴파일러와 하드웨어를 최대한 활용하여 코드 성능을 극대화하는 방법을 배웁니다.

*   [컴파일러 최적화의 한계: 메모리 앨리어싱(Memory Aliasing)](./compiler-optimization-limits)
*   [**루프 언롤링(Loop Unrolling)과 파이프라인 효율화**](./loop-unrolling)
*   [SIMD(Single Instruction, Multiple Data)와 벡터화(Vectorization)](./simd-vectorization)
*   [프로파일링(Profiling): 병목 지점 측정 방법 (gprof, perf)](./profiling)
*   [메모리 접근 패턴 최적화: 공간 지역성과 시간 지역성](./memory-access-patterns)
*   [불필요한 함수 호출 제거와 인라이닝(Inlining)](./function-inlining)

---

## 6. 메모리 계층 구조 (The Memory Hierarchy)

CPU와 메인 메모리 사이의 속도 격차를 해소하는 캐시 메모리의 동작 원리를 이해합니다. 면접 **중요도 1순위**입니다.

*   [**메모리 계층 구조: 레지스터 → L1/L2/L3 캐시 → DRAM → SSD → HDD**](./memory-hierarchy)
*   [**지역성(Locality)의 원리: 시간 지역성 vs 공간 지역성**](./locality-principle)
*   [**캐시 메모리의 구조: 집합(Set), 라인(Line), 태그(Tag)**](./cache-structure)
*   [캐시 배치 방식: 직접 사상(Direct-Mapped), 완전 연관(Fully Associative), 집합 연관(Set-Associative)](./cache-placement-policies)
*   [**캐시 히트(Hit)와 캐시 미스(Miss)의 종류 (Cold, Conflict, Capacity Miss)**](./cache-hit-miss)
*   [캐시 쓰기 정책: 쓰기 통과(Write-Through) vs 쓰기 후 기록(Write-Back)](./cache-write-policies)
*   [캐시 교체 정책: LRU, LFU, FIFO](./cache-replacement-policies)
*   [**캐시 친화적 코드 작성법 (행 우선 vs 열 우선 접근)**](./cache-friendly-code)
*   [가상 메모리와 캐시의 상호작용 (VIPT, PIPT)](./virtual-cache)
*   [DRAM의 구조: 행(Row), 열(Column), 뱅크(Bank)](./dram-structure)

---

## 7. 링킹 (Linking)

여러 오브젝트 파일이 하나의 실행 파일로 합쳐지는 과정을 이해합니다.

*   [**컴파일과 링킹의 차이: 오브젝트 파일(.o)과 실행 파일**](./compile-vs-link)
*   [정적 링킹(Static Linking) vs 동적 링킹(Dynamic Linking)](./static-vs-dynamic-linking)
*   [심볼(Symbol) 해석: 강한 심볼 vs 약한 심볼](./symbol-resolution)
*   [재배치(Relocation): 주소를 확정하는 과정](./relocation)
*   [공유 라이브러리(Shared Library)와 위치 독립 코드(PIC)](./shared-libraries-pic)
*   [ELF(Executable and Linkable Format) 파일 구조](./elf-format)
*   [라이브러리 인터포징(Library Interposing)으로 함수 가로채기](./library-interposing)

---

## 8. 예외적 제어 흐름 (Exceptional Control Flow)

정상적인 명령어 실행 흐름을 벗어나는 모든 메커니즘을 다룹니다.

*   [**예외(Exception)의 종류: 인터럽트, 트랩, 폴트, 어보트**](./exception-types)
*   [시스템 콜(System Call): 유저 모드에서 커널로 진입하는 방법](./system-calls)
*   [프로세스 생성과 종료: fork(), exec(), exit(), wait()](./process-creation)
*   [**fork()의 동작 원리와 COW(Copy-On-Write)**](./fork-and-cow)
*   [좀비(Zombie) 프로세스와 고아(Orphan) 프로세스](./zombie-and-orphan-processes)
*   [**시그널(Signal)의 개념과 처리 (SIGINT, SIGTERM, SIGSEGV)**](./signals)
*   [시그널 핸들러(Signal Handler) 작성 시 주의사항](./signal-handlers)
*   [비지역 점프(Nonlocal Jump): setjmp와 longjmp](./setjmp-longjmp)

---

## 9. 가상 메모리 (Virtual Memory)

모든 프로세스가 독립적인 메모리 공간을 갖는 환상을 만들어내는 핵심 메커니즘입니다.

*   [**가상 주소 공간(Virtual Address Space)의 개념**](./virtual-address-space)
*   [**페이징(Paging): 가상 주소 → 물리 주소 변환 과정**](./paging)
*   [**TLB(Translation Lookaside Buffer): 주소 변환 캐시**](./tlb)
*   [다단계 페이지 테이블(Multi-Level Page Table)로 공간 절약하기](./multi-level-page-table)
*   [**페이지 폴트(Page Fault)의 처리 흐름**](./page-fault-handling)
*   [메모리 매핑(Memory Mapping): mmap()의 원리](./memory-mapping-mmap)
*   [동적 메모리 할당: malloc, free의 내부 구현 원리](./dynamic-memory-allocation)
*   [**힙(Heap) 메모리 관리: 명시적 할당기(Explicit Allocator) 설계**](./heap-allocator-design)
*   [메모리 단편화(Memory Fragmentation): 내부 단편화 vs 외부 단편화](./memory-fragmentation)
*   [가비지 컬렉션(Garbage Collection)의 원리 (표시-청소, 참조 카운팅)](./garbage-collection)

---

## 10. 시스템 수준 I/O (System-Level I/O)

파일, 소켓 등 모든 입출력의 근간이 되는 시스템 I/O를 이해합니다.

*   [유닉스 I/O 모델: 파일 디스크립터(File Descriptor)와 모든 것은 파일이다](./unix-io-model)
*   [파일 열기, 닫기, 읽기, 쓰기: open, close, read, write 시스템 콜](./file-operations)
*   [표준 I/O 라이브러리(stdio)와 시스템 콜의 차이: 버퍼링](./stdio-vs-syscall)
*   [I/O 리다이렉션(Redirection)과 파이프(Pipe)의 원리](./io-redirection-and-pipe)
*   [블로킹(Blocking) vs 논블로킹(Non-blocking) I/O](./blocking-vs-nonblocking-io)
*   [**I/O 다중화(I/O Multiplexing): select, poll, epoll**](./io-multiplexing)

---

## 11. 네트워크 프로그래밍 (Network Programming)

소켓(Socket) API를 통해 프로세스가 네트워크로 통신하는 원리를 이해합니다.

*   [클라이언트-서버 모델의 동작 방식](./client-server-model)
*   [소켓(Socket)의 개념: IP 주소와 포트 번호](./socket-basics)
*   [TCP 소켓 프로그래밍: socket, bind, listen, accept, connect](./tcp-socket-programming)
*   [**TCP 연결의 생애주기: 3-Way Handshake와 4-Way Handshake**](./tcp-handshake)
*   [HTTP 서버의 간단한 구현 원리](./simple-http-server)

---

## 12. 동시성 프로그래밍 (Concurrent Programming)

여러 논리적 흐름을 동시에 처리하는 세 가지 방법(프로세스, I/O 다중화, 스레드)을 비교합니다.

*   [동시성(Concurrency) vs 병렬성(Parallelism)](./concurrency-vs-parallelism)
*   [프로세스 기반 동시성: fork()를 이용한 서버](./process-based-concurrency)
*   [이벤트 기반 동시성: I/O 다중화와 이벤트 루프(Event Loop)](./event-based-concurrency)
*   [**스레드(Thread) 기반 동시성: Pthreads API**](./thread-based-concurrency)
*   [**공유 변수와 경쟁 상태(Race Condition): 스레드 안전성(Thread Safety)**](./race-condition-thread-safety)
*   [**뮤텍스(Mutex)와 세마포어(Semaphore)로 동기화하기**](./mutex-and-semaphore)
*   [생산자-소비자(Producer-Consumer) 패턴](./producer-consumer)
*   [데드락(Deadlock)의 발생 조건과 회피 전략](./deadlock)
*   [스레드 풀(Thread Pool)의 설계 원리](./thread-pool)

---

### 💡 면접 대비 팁 (Interview Tips)

*   **"왜"를 물어보세요:** 캐시가 왜 필요한지, 가상 메모리가 왜 존재하는지 근본적인 이유를 이해하면 어떤 질문에도 대답할 수 있습니다. "속도 격차(Speed Gap)"와 "추상화(Abstraction)"가 컴퓨터 구조의 두 핵심 동기입니다.
*   **코드와 연결하세요:** `int`가 4바이트인 이유, `for` 루프의 열 우선 접근이 왜 느린지, `malloc`이 어떻게 동작하는지를 코드 레벨에서 설명할 수 있어야 합니다.
*   **CSAPP 실습 과제를 직접 풀어보세요:** Data Lab(비트 연산), Bomb Lab(어셈블리 역공학), Cache Lab(캐시 시뮬레이터), Malloc Lab(힙 할당기 구현)은 면접 이해도를 비약적으로 높여줍니다.
*   **Trade-off 중심으로 사고하세요:** 캐시 크기를 늘리면 왜 좋고 왜 나쁜지, 정적 링킹과 동적 링킹의 장단점은 무엇인지 항상 양면을 생각하세요.
