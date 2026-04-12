# Core Node.js: 엔진의 심장과 근본

Node.js를 단순히 사용할 줄 아는 단계를 넘어, V8 엔진, 이벤트 루프(Event Loop), 그리고 런타임의 내부 구조를 이해함으로써 고성능 비동기 시스템을 설계하는 역량을 기릅니다.

---

## 1. 런타임 개요 & V8 엔진

- Node.js의 구조: V8, Libuv, C++ 바인딩
- V8 엔진의 내부: JIT 컴파일러(Ignition & TurboFan), 가비지 컬렉션(Orinoco) 원리
- JavaScript 소스 코드에서 기계어까지의 여정
- V8 힙(Heap)과 스택(Stack)의 메모리 구조 분석

## 2. 이벤트 루프 (Event Loop)

- Libuv의 역할과 이벤트 루프의 6개 단계(Phase) 상세 분석
- `process.nextTick` vs `setImmediate` vs `setTimeout`의 우선순위 결정 방식
- 마이크로태스크 큐(Microtask Queue)와 매크로태스크 큐(Macrotask Queue)의 상호작용
- 이벤트 루프 블로킹(Blocking)과 성능 저하의 원인 분석

## 3. 비동기 I/O와 스레드 풀

- 논블로킹(Non-blocking) I/O의 실전 메커니즘
- Libuv의 스레드 풀(Thread Pool): 어떤 작업이 스레드 풀을 사용하는가?
- 파일 시스템(FS) 작업과 네트워크 I/O의 내부 차이점
- `UV_THREADPOOL_SIZE` 조정을 통한 성능 튜닝

## 4. 모듈 시스템 (CommonJS & ESM)

- CommonJS의 동기적 로딩과 캐싱 방식
- ESM(ECMAScript Modules)의 비동기적 로딩 및 정적 분석
- 서포트되지 않는 모듈 간 혼용 문제와 해결 전략
- 모듈 로더(Module Loader)를 통한 의존성 해결(Resolution) 알고리즘

## 5. 스트림과 버퍼 (Stream & Buffer)

- `Buffer` — 바이너리 데이터를 직접 다루는 원리와 메모리 관리
- `Stream` — 대용량 데이터 전송의 효율성 (Readable, Writable, Duplex, Transform)
- 백압(Backpressure) 현상 이해와 해결 방법
- `pipeline`과 `pump`를 이용한 안정적인 스트림 처리

## 6. 멀티 스레딩과 동시성 (Worker Threads & Cluster)

- `Worker Threads` — 공유 메모리를 활용한 병렬 연산 최적화
- `Cluster` 모듈 — 프로세스 복제를 통한 서버 스케일 아웃
- `SharedArrayBuffer`와 `Atomics`를 이용한 스레드 간 데이터 동기화
- 자식 프로세스(Child Process) vs 워커 스레드 선택 기준

## 7. 네트워크와 보안 (HTTP, HTTPS, TLS)

- `http.Server`의 내부 동작과 소켓 통신 원리
- `https` 모듈과 SSL/TLS 프로토콜의 하위 단계 분석
- 스트리밍 응답과 전송 인코딩(Transfer-encoding: chunked) 이해
- 웹 보안(CORS, CSRF, Rate Limiting)의 시스템적 구현

## 8. 성능 분석과 프로파일링

- `node --inspect`와 Chrome DevTools를 이용한 디버깅
- 메모리 릭(Memory Leak) 탐지를 위한 힙 스탭샷(Heap Snapshot) 분석
- CPU 프로파일링을 통한 핫 함수(Hot Function) 식별 전략
- 실제 운영 환경에서의 모니터링 및 로깅 시스템 구축

---

이 인덱스를 바탕으로 각 단계별 상세 가이드와 딥다이브 아티클을 구성할 예정입니다. 어떤 주제부터 시작해볼까요?
