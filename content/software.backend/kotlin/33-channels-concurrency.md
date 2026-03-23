---
title: "[Kotlin 시리즈] 33. 채널 & 동시성 도구"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "channel", "mutex", "semaphore", "atomic", "동시성", "코루틴"]
---

# 채널 & 동시성 도구

## Channel — 코루틴 간 통신

`Channel`은 코루틴 간에 데이터를 주고받는 **파이프**입니다. `send`로 보내고 `receive`로 받습니다.

```kotlin
val channel = Channel<Int>()

// 생산자 코루틴
launch {
    for (i in 1..5) {
        println("전송: $i")
        channel.send(i)
    }
    channel.close()
}

// 소비자 코루틴
launch {
    for (value in channel) {  // close() 전까지 수신
        println("수신: $value")
    }
}
```

---

## 채널 타입

```kotlin
// RENDEZVOUS (기본) — 버퍼 없음, 송신자와 수신자가 동시에 만나야 함
val rendezvous = Channel<Int>()

// BUFFERED — 고정 버퍼 (기본 64)
val buffered = Channel<Int>(Channel.BUFFERED)
val sized = Channel<Int>(10)  // 버퍼 10개

// UNLIMITED — 무제한 버퍼 (OOM 주의)
val unlimited = Channel<Int>(Channel.UNLIMITED)

// CONFLATED — 최신값 하나만 유지
val conflated = Channel<Int>(Channel.CONFLATED)
```

### 버퍼 동작

```kotlin
val channel = Channel<Int>(2)  // 버퍼 2개

launch {
    channel.send(1)  // 버퍼에 저장
    channel.send(2)  // 버퍼에 저장
    channel.send(3)  // 버퍼 가득 — 수신자 기다림
    println("전송 완료")
}

delay(100)
println(channel.receive())  // 1
println(channel.receive())  // 2
println(channel.receive())  // 3
```

---

## trySend / tryReceive — 비블로킹

```kotlin
val channel = Channel<Int>(5)

// 블로킹 없이 시도
val result = channel.trySend(42)
if (result.isSuccess) println("전송 성공")
if (result.isFailure) println("버퍼 가득")

val received = channel.tryReceive()
if (received.isSuccess) println("수신: ${received.getOrNull()}")
if (received.isFailure) println("비어있음")
```

---

## produce / consumeEach

```kotlin
// produce — 채널을 생산하는 코루틴 빌더
val squares = produce {
    for (i in 1..5) {
        send(i * i)
    }
}

squares.consumeEach { println(it) }
// 1, 4, 9, 16, 25
```

```kotlin
// 파이프라인 패턴
fun CoroutineScope.numbers() = produce {
    var n = 1
    while (true) send(n++)
}

fun CoroutineScope.filter(input: ReceiveChannel<Int>, prime: Int) = produce {
    for (n in input) {
        if (n % prime != 0) send(n)
    }
}

// 에라토스테네스의 체
runBlocking {
    var current = numbers()
    repeat(10) {
        val prime = current.receive()
        println("소수: $prime")
        current = filter(current, prime)
    }
}
```

---

## select — 여러 채널 동시 대기

먼저 준비된 채널에서 수신합니다.

```kotlin
val ch1 = Channel<String>()
val ch2 = Channel<String>()

launch { delay(100); ch1.send("ch1") }
launch { delay(50);  ch2.send("ch2") }

val result = select {
    ch1.onReceive { "ch1에서: $it" }
    ch2.onReceive { "ch2에서: $it" }
}
println(result)  // "ch2에서: ch2" — 먼저 도착한 ch2
```

---

## Mutex — 상호 배제

공유 자원을 동시에 하나의 코루틴만 접근하게 보호합니다.

```kotlin
val mutex = Mutex()
var counter = 0

// 잘못된 방법 — 경쟁 조건
repeat(1000) {
    launch { counter++ }  // 동시 접근 — 결과 불확실
}

// 올바른 방법 — Mutex
repeat(1000) {
    launch {
        mutex.withLock {
            counter++  // 한 번에 하나만 실행
        }
    }
}
// counter == 1000 보장
```

```kotlin
class SafeCache<K, V> {
    private val mutex = Mutex()
    private val map = mutableMapOf<K, V>()

    suspend fun get(key: K): V? = mutex.withLock {
        map[key]
    }

    suspend fun put(key: K, value: V) = mutex.withLock {
        map[key] = value
    }

    suspend fun getOrPut(key: K, default: () -> V): V = mutex.withLock {
        map.getOrPut(key, default)
    }
}
```

### tryLock — 비블로킹 락 시도

```kotlin
val mutex = Mutex()

if (mutex.tryLock()) {
    try {
        // 락 획득 성공
    } finally {
        mutex.unlock()
    }
} else {
    println("락 획득 실패 — 다른 코루틴이 사용 중")
}
```

---

## Semaphore — 동시 접근 수 제한

지정한 수만큼 동시 실행을 허용합니다.

```kotlin
val semaphore = Semaphore(3)  // 최대 3개 동시

repeat(10) { i ->
    launch {
        semaphore.withPermit {
            println("작업 $i 시작")
            delay(1000)
            println("작업 $i 완료")
        }
    }
}
// 동시에 3개씩 실행
```

```kotlin
// API 요청 속도 제한
class RateLimitedClient(private val maxConcurrent: Int = 5) {
    private val semaphore = Semaphore(maxConcurrent)

    suspend fun request(url: String): String =
        semaphore.withPermit {
            httpClient.get(url)
        }
}
```

---

## Atomic — 원자적 연산

락 없이 thread-safe한 기본 타입 연산입니다.

```kotlin
import java.util.concurrent.atomic.*

val counter = AtomicInteger(0)
val flag = AtomicBoolean(false)
val longVal = AtomicLong(0L)
val ref = AtomicReference<String>("초기값")

// 원자적 연산
counter.incrementAndGet()
counter.getAndAdd(5)
counter.compareAndSet(5, 10)  // 현재값이 5이면 10으로 변경

ref.updateAndGet { it.uppercase() }
ref.compareAndSet("초기값", "변경값")
```

### @Volatile

```kotlin
class Singleton {
    companion object {
        @Volatile
        private var instance: Singleton? = null

        fun getInstance(): Singleton =
            instance ?: synchronized(this) {
                instance ?: Singleton().also { instance = it }
            }
    }
}
```

---

## ThreadLocal — 코루틴 로컬

코루틴 간에 스레드 로컬 값을 안전하게 전달합니다.

```kotlin
val threadLocal = ThreadLocal.withInitial { "기본값" }

runBlocking(threadLocal.asContextElement("코루틴 값")) {
    println(threadLocal.get())  // "코루틴 값"

    withContext(Dispatchers.IO) {
        println(threadLocal.get())  // "코루틴 값" — 다른 스레드에서도 유지
    }
}
```

---

## 동시성 도구 선택 가이드

```
단순 카운터/플래그 증감         → Atomic (가장 빠름)
공유 자원 단일 접근 보호        → Mutex
최대 N개 동시 접근 제한         → Semaphore
코루틴 간 데이터 파이프라인     → Channel
상태 공유 (단일 최신값)         → StateFlow + Mutex
이벤트 브로드캐스트             → SharedFlow
```

---

## 정리

**Channel**
- 코루틴 간 통신 파이프
- `RENDEZVOUS` / `BUFFERED` / `UNLIMITED` / `CONFLATED`
- `produce` / `consumeEach` — 생산자/소비자 패턴
- `select` — 여러 채널 동시 대기

**Mutex**
- `withLock { }` — 코루틴 안전 상호 배제
- `tryLock()` — 비블로킹 시도

**Semaphore**
- `withPermit { }` — 최대 N개 동시 실행 제한

**Atomic**
- `AtomicInteger`, `AtomicBoolean`, `AtomicReference` — 락 없는 원자적 연산

**@Volatile**
- JVM volatile — 가시성 보장 (원자성은 보장 안 됨)
