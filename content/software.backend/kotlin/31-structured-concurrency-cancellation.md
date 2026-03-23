---
title: "[Kotlin 시리즈] 31. 구조적 동시성 & 취소"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "coroutine", "structured concurrency", "cancellation", "timeout", "Job"]
---

# 구조적 동시성 & 취소

## 구조적 동시성이란

코루틴은 **스코프** 안에서만 실행됩니다. 부모 스코프가 완료되기 전에 모든 자식 코루틴이 완료되어야 합니다.

```kotlin
fun main() = runBlocking {  // 스코프 시작
    launch {                 // 자식 코루틴 1
        delay(1000)
        println("자식 1 완료")
    }
    launch {                 // 자식 코루틴 2
        delay(500)
        println("자식 2 완료")
    }
    println("부모 블록 끝")
}
// 자식 2 완료
// 자식 1 완료
// (모든 자식이 완료된 후 runBlocking 반환)
```

누수 없음 보장: 스코프 밖으로 코루틴이 탈출하지 않습니다.

---

## Job 생명주기

```
New → Active → Completing → Completed
                ↓
          Cancelling → Cancelled
```

```kotlin
val job = launch { delay(Long.MAX_VALUE) }

println(job.isActive)    // true
println(job.isCompleted) // false
println(job.isCancelled) // false

job.cancel()

println(job.isActive)    // false
println(job.isCompleted) // true (cancel 후 완전히 종료되면)
println(job.isCancelled) // true
```

### join — 완료 대기

```kotlin
val job = launch {
    delay(1000)
    println("작업 완료")
}

job.join()  // 작업이 완료될 때까지 현재 코루틴 대기
println("join 후")

// 여러 Job 대기
val jobs = (1..5).map { launch { delay(it * 100L) } }
jobs.joinAll()
```

---

## 취소 (Cancellation)

### job.cancel()

```kotlin
val job = launch {
    repeat(1000) { i ->
        println("작업 $i")
        delay(500)
    }
}

delay(1300)
println("취소 요청")
job.cancel()
job.join()
println("취소 완료")
// 작업 0, 작업 1, 작업 2 출력 후 취소
```

### 취소는 협력적(cooperative)

`delay`, `yield` 등 취소 가능 지점이 있어야 취소가 작동합니다.

```kotlin
val job = launch(Dispatchers.Default) {
    // 취소 가능 지점 없음 — 취소 안 됨!
    var i = 0
    while (i < 1_000_000) {
        i++
        // CPU 바운드 작업
    }
    println("완료: $i")
}

delay(100)
job.cancel()
job.join()
println("여기까지 왔나?")  // 완료 후에야 실행됨
```

### isActive / ensureActive / yield

```kotlin
val job = launch(Dispatchers.Default) {
    var i = 0
    while (i < 1_000_000) {
        // 방법 1: isActive 체크
        if (!isActive) break

        // 방법 2: ensureActive() — CancellationException 던짐
        ensureActive()

        // 방법 3: yield() — 취소 체크 + 다른 코루틴에 양보
        yield()

        i++
    }
}
```

### CancellationException

취소는 `CancellationException`으로 전파됩니다. `try-catch`로 잡으면 안 됩니다.

```kotlin
val job = launch {
    try {
        delay(Long.MAX_VALUE)
    } catch (e: CancellationException) {
        println("취소됨")
        // CancellationException은 반드시 다시 던져야 함
        throw e  // 또는 return
    } finally {
        println("finally 실행")  // 취소 후 정리 작업
    }
}

job.cancel()
job.join()
```

`Exception`으로 잡으면 `CancellationException`도 잡아 취소가 정상 작동하지 않을 수 있습니다.

```kotlin
// 위험 — CancellationException도 잡힘
try { ... } catch (e: Exception) { /* e가 CancellationException일 수 있음 */ }

// 안전 — 명시적 처리
try { ... } catch (e: CancellationException) { throw e }
              catch (e: Exception) { /* 다른 예외 처리 */ }
```

### NonCancellable — 취소 불가 블록

취소 후 정리 작업에서 취소될 수 없는 코드를 실행합니다.

```kotlin
val job = launch {
    try {
        delay(1000)
    } finally {
        withContext(NonCancellable) {
            // 이 블록은 취소되지 않음
            println("DB 연결 종료")
            delay(100)   // suspend 함수도 사용 가능
            println("완료")
        }
    }
}

job.cancel()
job.join()
```

---

## 타임아웃

### withTimeout

지정 시간 초과 시 `TimeoutCancellationException` (CancellationException 서브타입) 발생.

```kotlin
try {
    withTimeout(2000L) {
        delay(5000)
        println("완료")  // 실행 안 됨
    }
} catch (e: TimeoutCancellationException) {
    println("타임아웃!")
}
```

### withTimeoutOrNull

초과 시 예외 대신 `null` 반환.

```kotlin
val result = withTimeoutOrNull(2000L) {
    delay(5000)
    "완료"  // 반환 안 됨
}
println(result)  // null

val result2 = withTimeoutOrNull(5000L) {
    delay(1000)
    "성공"
}
println(result2)  // "성공"
```

---

## 예외 처리

### launch vs async의 예외 전파

```kotlin
// launch — 예외 즉시 전파 (CoroutineExceptionHandler 또는 부모에게)
val scope = CoroutineScope(SupervisorJob())
scope.launch {
    throw RuntimeException("launch 예외")  // 즉시 전파
}

// async — await() 호출 시 예외 전파
val deferred = scope.async {
    throw RuntimeException("async 예외")  // await() 전까지 보류
}
try {
    deferred.await()  // 여기서 예외 발생
} catch (e: RuntimeException) {
    println("잡음: ${e.message}")
}
```

### supervisorScope — 자식 실패 독립

```kotlin
supervisorScope {
    val a = async {
        delay(100)
        throw RuntimeException("A 실패")
    }
    val b = async {
        delay(200)
        "B 성공"
    }

    // a가 실패해도 b는 계속 실행
    try {
        println(a.await())
    } catch (e: RuntimeException) {
        println("A 실패: ${e.message}")
    }
    println(b.await())  // "B 성공"
}
```

### CoroutineExceptionHandler

```kotlin
val handler = CoroutineExceptionHandler { _, exception ->
    println("처리되지 않은 예외: $exception")
}

val scope = CoroutineScope(SupervisorJob() + handler)

scope.launch {
    throw RuntimeException("미처리 예외")
}
// "처리되지 않은 예외: java.lang.RuntimeException: 미처리 예외"
```

---

## 실전 패턴

### 작업 취소 가능하게 만들기

```kotlin
class DataSyncService {
    private var syncJob: Job? = null

    fun startSync(scope: CoroutineScope) {
        syncJob = scope.launch {
            while (isActive) {
                try {
                    syncData()
                } catch (e: Exception) {
                    println("동기화 실패: ${e.message}")
                }
                delay(30_000)
            }
        }
    }

    fun stopSync() {
        syncJob?.cancel()
        syncJob = null
    }
}
```

### 타임아웃 + 재시도

```kotlin
suspend fun <T> retryWithTimeout(
    times: Int = 3,
    timeoutMs: Long = 5000,
    block: suspend () -> T,
): T {
    repeat(times) { attempt ->
        try {
            return withTimeout(timeoutMs) { block() }
        } catch (e: TimeoutCancellationException) {
            if (attempt == times - 1) throw e
            println("타임아웃, 재시도 ${attempt + 1}/$times")
            delay(1000L * (attempt + 1))  // exponential backoff
        }
    }
    error("unreachable")
}
```

### 리소스 안전 정리

```kotlin
suspend fun processFile(path: String) {
    val file = openFile(path)
    try {
        coroutineScope {
            launch { file.processChunk(0, 1000) }
            launch { file.processChunk(1000, 2000) }
        }
    } finally {
        file.close()  // 취소되어도 반드시 실행
    }
}
```

---

## 정리

- **구조적 동시성**: 부모 스코프 완료 전 모든 자식 완료 보장 — 누수 없음
- **취소는 협력적**: `delay`, `yield`, `isActive`, `ensureActive` 필요
- **`CancellationException`**: 재던지기 필수, `Exception`으로 무심코 삼키지 않도록 주의
- **`NonCancellable`**: finally에서 취소 불가 정리 작업
- **`withTimeout`**: 예외 발생 / **`withTimeoutOrNull`**: null 반환
- **`launch`**: 예외 즉시 전파 / **`async`**: `await()` 시 전파
- **`supervisorScope`**: 자식 실패가 형제에 영향 없음
