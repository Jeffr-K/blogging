---
title: "[Kotlin 시리즈] 32. Flow"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "flow", "cold flow", "StateFlow", "SharedFlow", "collect", "코루틴"]
---

# Flow

## Flow란

`Flow<T>`는 **비동기 데이터 스트림**입니다. 여러 값을 순차적으로 방출(emit)하고, 구독자가 수집(collect)합니다.

```kotlin
// Flow 생성
val flow: Flow<Int> = flow {
    emit(1)
    delay(100)
    emit(2)
    delay(100)
    emit(3)
}

// 수집
flow.collect { value ->
    println(value)
}
// 1, 2, 3
```

---

## Cold Flow — 구독마다 새로 실행

Cold Flow는 `collect`가 호출될 때마다 처음부터 다시 실행됩니다.

```kotlin
val counter = flow {
    println("Flow 시작")
    for (i in 1..3) {
        emit(i)
        delay(100)
    }
}

counter.collect { println("구독자 1: $it") }
// "Flow 시작", 1, 2, 3

counter.collect { println("구독자 2: $it") }
// "Flow 시작", 1, 2, 3  — 다시 실행됨
```

---

## Flow 생성

```kotlin
// flow { } 빌더
val numbers = flow {
    for (i in 1..5) {
        delay(100)
        emit(i)
    }
}

// flowOf — 고정 값
val fixed = flowOf(1, 2, 3, 4, 5)

// asFlow — 컬렉션/범위에서
val fromList = listOf(1, 2, 3).asFlow()
val fromRange = (1..5).asFlow()

// generateSequence → asFlow
val infiniteFlow = generateSequence(0) { it + 1 }.asFlow()
```

---

## 중간 연산자

중간 연산자는 새 Flow를 반환하며, 최종 연산자가 호출될 때까지 실행되지 않습니다.

### map / filter / transform

```kotlin
(1..5).asFlow()
    .filter { it % 2 == 0 }
    .map { it * 10 }
    .collect { println(it) }
// 20, 40

// transform — 유연한 변환 (여러 값 방출 가능)
(1..3).asFlow()
    .transform { value ->
        emit("before $value")
        emit(value)
        emit("after $value")
    }
    .collect { println(it) }
```

### take / drop

```kotlin
(1..10).asFlow()
    .take(3)           // 3개만
    .collect { println(it) }  // 1, 2, 3

(1..10).asFlow()
    .drop(7)           // 7개 건너뜀
    .collect { println(it) }  // 8, 9, 10
```

### onEach — 부수 효과

```kotlin
(1..3).asFlow()
    .onEach { println("방출: $it") }
    .map { it * 2 }
    .collect { println("수집: $it") }
// 방출: 1, 수집: 2, 방출: 2, 수집: 4, 방출: 3, 수집: 6
```

### flatMapConcat / flatMapMerge / flatMapLatest

```kotlin
// flatMapConcat — 순서 유지, 직렬
(1..3).asFlow()
    .flatMapConcat { n ->
        flow {
            emit("${n}a")
            delay(100)
            emit("${n}b")
        }
    }
    .collect { println(it) }
// 1a, 1b, 2a, 2b, 3a, 3b

// flatMapMerge — 병렬 수집
(1..3).asFlow()
    .flatMapMerge { n ->
        flow { emit(n); delay(100); emit(n * 10) }
    }
    .collect { println(it) }
// 순서 보장 없음

// flatMapLatest — 새 값 오면 이전 취소
(1..3).asFlow()
    .onEach { delay(100) }
    .flatMapLatest { n ->
        flow {
            emit("시작 $n")
            delay(300)
            emit("완료 $n")  // 새 값이 오면 이건 취소됨
        }
    }
    .collect { println(it) }
```

### combine / zip

```kotlin
val names = flowOf("Alice", "Bob", "Carol")
val scores = flowOf(90, 85, 95)

// zip — 같은 인덱스끼리 쌍
names.zip(scores) { name, score -> "$name: $score" }
    .collect { println(it) }
// Alice: 90, Bob: 85, Carol: 95

// combine — 어느 쪽이든 새 값이 오면 최신값으로 조합
val flowA = flow { emit(1); delay(200); emit(2) }
val flowB = flow { delay(100); emit("a"); delay(200); emit("b") }
combine(flowA, flowB) { a, b -> "$a$b" }
    .collect { println(it) }
// 1a, 2a, 2b
```

### buffer / conflate / flowOn

```kotlin
// buffer — 방출과 수집을 비동기로 분리
flow {
    for (i in 1..5) {
        delay(100)
        emit(i)
    }
}
.buffer()           // 방출 측 버퍼링
.collect { value ->
    delay(300)      // 느린 소비자
    println(value)
}

// conflate — 처리 중 쌓인 값 무시, 최신 값만
flow { /* 빠르게 방출 */ }
    .conflate()
    .collect { /* 느리게 수집 — 중간값 건너뜀 */ }

// flowOn — 업스트림 실행 스레드 변경
flow { /* IO 작업 */ }
    .flowOn(Dispatchers.IO)      // 이 위의 연산은 IO 스레드
    .map { /* 변환 */ }
    .flowOn(Dispatchers.Default) // 이 위의 연산은 Default 스레드
    .collect { /* Main 스레드 */ }
```

---

## 생명주기 연산자

```kotlin
flow {
    emit(1)
    emit(2)
    throw RuntimeException("오류")
}
.onStart { println("시작") }
.onEach { println("값: $it") }
.catch { e -> println("에러: ${e.message}"); emit(-1) }
.onCompletion { e ->
    if (e != null) println("완료 (에러)")
    else println("정상 완료")
}
.collect { println("수집: $it") }
// 시작, 값: 1, 수집: 1, 값: 2, 수집: 2,
// 에러: 오류, 수집: -1, 정상 완료
```

### retry / retryWhen

```kotlin
flow {
    emit(1)
    throw IOException("네트워크 오류")
}
.retry(3) { e -> e is IOException }  // IOException이면 최대 3회 재시도

.retryWhen { cause, attempt ->
    if (cause is IOException && attempt < 3) {
        delay(1000L * (attempt + 1))  // 지수 백오프
        true
    } else false
}
```

---

## 최종 연산자

```kotlin
val flow = (1..5).asFlow()

// collect
flow.collect { println(it) }

// collectLatest — 새 값 오면 이전 수집 취소
flow.collectLatest { value ->
    println("처리 시작: $value")
    delay(1000)  // 새 값이 오면 여기서 취소
    println("처리 완료: $value")
}

// toList / toSet
val list = flow.toList()
val set = flow.toSet()

// first / last
flow.first()       // 1
flow.last()        // 5
flow.first { it > 3 }  // 4

// fold / reduce
flow.fold(0) { acc, v -> acc + v }  // 15
flow.reduce { acc, v -> acc + v }   // 15

// launchIn — 스코프에서 수집 (fire-and-forget)
flow
    .onEach { println(it) }
    .launchIn(scope)
```

---

## Hot Flow — StateFlow & SharedFlow

### StateFlow — 현재 상태 보유

항상 최신값을 보유하고, 새 구독자는 즉시 최신값을 받습니다.

```kotlin
val stateFlow = MutableStateFlow(0)

// 구독
stateFlow.collect { value ->
    println("상태: $value")
}

// 업데이트
stateFlow.value = 1
stateFlow.value = 2
stateFlow.update { it + 1 }  // 원자적 업데이트
```

```kotlin
// 실전: ViewModel 패턴
class CounterViewModel : ViewModel() {
    private val _count = MutableStateFlow(0)
    val count: StateFlow<Int> = _count.asStateFlow()

    fun increment() { _count.update { it + 1 } }
    fun decrement() { _count.update { it - 1 } }
}
```

### SharedFlow — 브로드캐스트

여러 구독자에게 값을 브로드캐스트합니다. replay로 새 구독자에게 이전 값을 전달합니다.

```kotlin
val sharedFlow = MutableSharedFlow<String>(
    replay = 1,          // 새 구독자에게 마지막 1개 재전송
    extraBufferCapacity = 10,  // 추가 버퍼
)

// 방출
sharedFlow.emit("이벤트 1")

// 구독
sharedFlow.collect { println(it) }
```

```kotlin
// 이벤트 버스 패턴
object EventBus {
    private val _events = MutableSharedFlow<AppEvent>()
    val events: SharedFlow<AppEvent> = _events.asSharedFlow()

    suspend fun post(event: AppEvent) = _events.emit(event)
}

// 구독
EventBus.events.collect { event ->
    when (event) {
        is AppEvent.UserLoggedIn  -> refreshUserData()
        is AppEvent.NetworkError  -> showRetryDialog()
    }
}
```

### stateIn / shareIn — Cold → Hot 변환

```kotlin
val hotState = coldFlow
    .stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

val hotShared = coldFlow
    .shareIn(
        scope = viewModelScope,
        started = SharingStarted.Lazily,
        replay = 1,
    )
```

| `SharingStarted` | 설명 |
|-----------------|------|
| `Eagerly` | 즉시 시작, 스코프 종료까지 유지 |
| `Lazily` | 첫 구독자 생기면 시작, 스코프 종료까지 유지 |
| `WhileSubscribed(N)` | 구독자 있을 때만, 마지막 구독자 해제 후 N ms 지연 종료 |

---

## callbackFlow — 콜백 → Flow 변환

```kotlin
fun locationFlow(): Flow<Location> = callbackFlow {
    val listener = LocationListener { location ->
        trySend(location)  // 비블로킹 방출
    }

    locationManager.requestUpdates(listener)

    awaitClose {
        locationManager.removeUpdates(listener)  // 수집 종료 시 정리
    }
}

locationFlow()
    .collect { location ->
        println("위치: ${location.lat}, ${location.lon}")
    }
```

---

## StateFlow vs SharedFlow vs Cold Flow

| | Cold Flow | StateFlow | SharedFlow |
|--|----------|-----------|-----------|
| Hot/Cold | Cold | Hot | Hot |
| 초기값 | 없음 | 필수 | 없음 |
| replay | - | 1 (최신값) | 설정 가능 |
| 구독자 | 독립 실행 | 상태 공유 | 브로드캐스트 |
| 용도 | 데이터 파이프라인 | 상태 관리 | 이벤트 버스 |

---

## 정리

- **Cold Flow**: `collect` 마다 새로 실행 — 파이프라인 처리
- **중간 연산자**: `map`, `filter`, `flatMapLatest`, `combine`, `buffer`, `flowOn`
- **생명주기**: `onStart`, `onCompletion`, `catch`, `retry`
- **StateFlow**: 현재 상태 보유, 항상 최신값 — UI 상태 관리
- **SharedFlow**: 브로드캐스트, replay 설정 — 이벤트 버스
- **callbackFlow**: 콜백 API를 Flow로 변환
- **stateIn / shareIn**: Cold → Hot 변환
