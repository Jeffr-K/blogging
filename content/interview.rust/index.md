🦀 Rust 심화 면접 질문 20선

1. 메모리 모델 및 소유권 (Memory & Ownership)

[Interior Mutability: Arc<Mutex<T>>와 Arc<RwLock<T>>의 성능 차이는 무엇이며, Write 작업이 빈번한 실시간 스트리밍 환경에서 어떤 것을 선택하시겠습니까?]()

[Memory Leak: Rust에서 메모리 누수가 발생할 수 있는 시나리오(예: Rc 순환 참조)를 설명하고, 이를 Weak 포인터로 해결하는 방법을 설명해 주세요.]()

[Zero-copy: 실시간 미디어 데이터를 처리할 때 Clone을 피하고 Zero-copy를 달성하기 위해 std::borrow::Cow나 슬라이스`₩(&[u8])`를 어떻게 활용하시겠습니까?]()

[Stack vs Heap: 대규모 데이터를 다룰 때 Box<T>를 사용하는 기준과, 재귀 구조에서 Box가 필요한 이유를 설명해 주세요.]()

2. 동시성 및 비동기 프로그래밍 (Concurrency & Async)

[Send & Sync: *const T와 같은 Raw Pointer가 기본적으로 Send나 Sync가 아닌 이유는 무엇이며, 이를 수동으로 구현해야 할 때의 주의점은 무엇인가요?]()

[Async Runtime: tokio 루프 안에서 std::thread::sleep을 사용하면 안 되는 이유와, blocking 작업을 처리하기 위한 spawn_blocking의 동작 원리를 설명해 주세요.]()

[Select Loop: 여러 개의 비동기 스트림(예: Redis 채널, SNS API, 내부 이벤트)을 동시에 대기할 때 tokio::select!를 안전하게 사용하는 방법은 무엇인가요?]()

[Pinning: Future를 다룰 때 Pin<&mut Self>가 필요한 이유와, 자가 참조 구조체(Self-referential struct)와 어떤 관계가 있는지 설명해 주세요.]()

3. 타입 시스템 및 아키텍처 (Type System & Architecture)

[Trait Object vs Generics: 정적 디스패치(Monomorphization)와 동적 디스패치(dyn Trait)의 런타임 성능 차이와 바이너리 크기에 미치는 영향을 설명해 주세요.]()

[Error Handling: thiserror와 anyhow의 차이점은 무엇이며, 라이브러리 개발(예: Meshestra)과 최종 서비스 애플리케이션 개발 시 각각 어떤 것을 선호하시나요?]()

[Marker Traits: 아무런 메서드가 없는 마커 트레이트를 정의하여 컴파일 타임에 특정 로직을 강제(Safety Guard)해 본 경험이 있나요?]()

[newtype Pattern: String이나 u64 대신 Newtype 패턴을 사용하여 도메인 로직의 안정성을 높이는 방법과 그 이점을 설명해 주세요.]()

4. 실시간 처리 및 성능 (Streaming & Performance)

[Channel Selection: mpsc, broadcast, oneshot, watch 채널 중 실시간 미디어 상태 업데이트를 모든 클라이언트에게 전파할 때 가장 적합한 것은 무엇인가요?]()

[Drop Trait: 리소스(DB 커넥션, 파일 핸들 등)를 명시적으로 해제해야 할 때 Drop 트레이트를 어떻게 활용하며, Panic 발생 시 안정성을 어떻게 보장하나요?]()

[SIMD & Optimization: Rust에서 intrinsics나 SIMD를 활용해 수치 계산(예: 오디오 처리)을 최적화하는 것에 대해 어떻게 생각하시나요?]()

[Allocators: 기본 할당자 대신 jemalloc이나 mimalloc을 도입하여 Rust 서버의 성능을 개선할 수 있는 시나리오는 무엇인가요?]()

5. 프로젝트 관리 및 안정성 (Operations & Reliability)

[Unsafe Rust: unsafe 블록을 최소화해야 하는 이유는 무엇이며, 부득이하게 사용할 경우 Safety 주석을 어떻게 작성하시나요?]()

[Testing: proptest와 같은 속성 기반 테스트(Property-based testing)를 Rust 프로젝트에 도입해 본 적이 있나요? 그 효용성은 무엇이었나요?]()

[Conditional Compilation: `#[cfg(feature = "...")]` 를 활용해 특정 플랫폼이나 환경에 맞는 기능을 분리하는 전략을 설명해 주세요.]()

[Cargo Mastery: Cargo.toml의 workspace 기능을 활용해 거대 모노레포를 관리할 때, 의존성 충돌과 빌드 시간을 최적화하는 방법은 무엇인가요?]()

6. Rust 멀티스레딩 & 동시성 심화 면접 질문

### 1. 비동기 환경에서의 락(Lock) 관리
[Arc<Mutex<T>>를 사용할 때, 락(Guard)을 보유한 상태로 .await를 호출하면 발생하는 'Future is not Send' 에러의 근본적인 원인과 이를 해결하기 위한 설계적 대안은 무엇인가요?]()
**핵심 포인트:** `std::sync::MutexGuard`가 `Send`를 구현하지 않는 이유(OS 레벨 락의 특성)와 `tokio::sync::Mutex` 도입 시의 성능 트레이드오프, 혹은 블록 스코프(`{ }`)를 이용한 락 점유 시간 최소화 전략.

### 2. 채널(Channel)과 백프레셔(Backpressure)
[실시간 스트리밍 데이터를 처리할 때, Bound가 없는 Unbounded 채널 사용이 시스템의 가용성에 미치는 영향과 이를 제어하기 위한 Backpressure(역압) 구현 전략은 무엇인가요?](https://example.com)
* **핵심 포인트:** 메모리 무한 증식(OOM) 위험성, `mpsc::channel(capacity)` 사용 시 송신측의 대기 방식, 그리고 데이터 유실이 허용되는 경우 `watch`나 `broadcast` 채널로의 전환 고려.

### 3. 타입 시스템과 메모리 안전성
[Rc<T>와 같이 Send 트레이트가 구현되지 않은 타입을 멀티스레드 런타임(tokio::spawn)에서 공유하려 할 때 발생하는 컴파일 에러를 통해 Rust가 보장하는 메모리 안전성의 핵심 원리는 무엇인가요?](https://example.com)
* **핵심 포인트:** 데이터 레이스(Data Race) 방지를 위한 `Send`/`Sync` 마커 트레이트의 역할, `Rc`의 비원자적 참조 카운팅과 `Arc`의 원자적(Atomic) 연산 차이.

### 4. 성능 최적화와 데이터 대여(Borrowing)
[대량의 프레임 데이터를 복사(Clone) 없이 여러 스레드에 안전하게 대여해 주기 위해 std::thread::scope를 사용하는 방식이 Arc를 활용하는 방식보다 성능과 수명 주기(Lifetime) 관리 측면에서 갖는 이점은 무엇인가요?]()
* **핵심 포인트:** 힙 할당 및 참조 카운팅 오버헤드 제거, 부모 스레드의 스택 프레임을 안전하게 참조하는 구조, 실시간 영상 처리 시 제로 카운팅 오버헤드 달성.

### 5. 런타임 스케줄링 및 응답성
[비동기 런타임의 워커 스레드가 무거운 연산(CPU-bound)으로 인해 점유(Starvation)되는 현상을 방지하기 위해 spawn_blocking이나 전용 스레드 풀을 활용하는 기준은 무엇인가요?]()
* **핵심 포인트:** `Tokio` 이벤트 루프 블로킹 방지, 미디어 인코딩/립싱크 연산과 I/O 작업의 분리 설계, `yield_now`를 통한 협력적 멀티태스킹 이해도.
