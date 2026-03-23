---
title: "[Kotlin 시리즈] 30. CoroutineContext & Dispatchers"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "coroutine", "CoroutineContext", "Dispatcher", "withContext", "CoroutineScope"]
---

# CoroutineContext & Dispatchers

## CoroutineContext

코루틴의 실행 환경을 정의하는 **요소들의 집합**입니다. `+` 연산자로 조합합니다.

```kotlin
val context: CoroutineContext =
    Dispatchers.IO +                      // 어디서 실행할지
    CoroutineName("fetch-user") +         // 디버깅용 이름
    Job()                                  // 생명주기
```

### 주요 컨텍스트 요소

| 요소 | 역할 |
|------|------|
| `Dispatcher` | 실행 스레드/스레드풀 결정 |
| `Job` | 코루틴 생명주기 관리 |
| `CoroutineName` | 디버깅용 이름 |
| `CoroutineExceptionHandler` | 예외 처리 |

---

## Dispatchers

### Dispatchers.Default — CPU 집약 작업

공유 스레드 풀 (코어 수만큼). 정렬, 파싱, 복잡한 계산에 적합합니다.

```kotlin
launch(Dispatchers.Default) {
    val sorted = largeList.sortedWith(complexComparator)
    val parsed = heavyJson.let { parseJson(it) }
}
```

### Dispatchers.IO — I/O 작업

최대 64개(또는 코어 수, 둘 중 더 큰 값) 스레드 풀. 파일, 네트워크, DB 작업에 적합합니다.

```kotlin
launch(Dispatchers.IO) {
    val content = File("data.txt").readText()
    val response = httpClient.get("https://api.example.com")
    val users = database.query("SELECT * FROM users")
}
```

### Dispatchers.Main — UI 스레드

Android/JavaFX/Swing의 메인 스레드. UI 업데이트에 사용합니다.

```kotlin
// Android
launch(Dispatchers.Main) {
    textView.text = "로딩 중..."
    val data = withContext(Dispatchers.IO) { fetchData() }
    textView.text = data
}
```

### Dispatchers.Unconfined — 제한 없음

첫 번째 일시 중단 이전: 호출자 스레드에서 실행. 재개 후: 중단한 스레드에서 실행. 주로 테스트나 특수 목적에 사용합니다.

```kotlin
launch(Dispatchers.Unconfined) {
    println("1: ${Thread.currentThread().name}")  // main
    delay(100)
    println("2: ${Thread.currentThread().name}")  // kotlinx.coroutines.DefaultExecutor
}
```

### newSingleThreadContext — 전용 스레드

```kotlin
val singleThread = newSingleThreadContext("MyThread")

launch(singleThread) {
    println(Thread.currentThread().name)  // MyThread
}

// 사용 후 반드시 닫기
singleThread.close()
```

---

## withContext — 디스패처 전환

코루틴 내에서 실행 스레드를 전환합니다.

```kotlin
suspend fun loadAndProcess(): ProcessedData {
    // IO 스레드에서 데이터 로드
    val raw = withContext(Dispatchers.IO) {
        fetchFromNetwork()
    }

    // Default 스레드에서 CPU 집약 처리
    val processed = withContext(Dispatchers.Default) {
        heavyTransform(raw)
    }

    return processed
}
```

```kotlin
// Android 패턴
suspend fun refreshUi() {
    withContext(Dispatchers.Main) {
        showLoading()
    }

    val data = withContext(Dispatchers.IO) {
        loadData()
    }

    withContext(Dispatchers.Main) {
        hideLoading()
        displayData(data)
    }
}
```

---

## CoroutineScope

코루틴이 실행되는 범위를 정의합니다. 스코프가 취소되면 그 안의 모든 코루틴이 취소됩니다.

```kotlin
class UserRepository {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun startSync() {
        scope.launch {
            while (true) {
                sync()
                delay(60_000)
            }
        }
    }

    fun close() {
        scope.cancel()  // 모든 코루틴 취소
    }
}
```

### 커스텀 스코프 생성

```kotlin
// Job + Dispatcher 조합
val myScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

// 작업 시작
val job = myScope.launch { doWork() }

// 스코프 전체 취소
myScope.cancel()
```

### 컨텍스트 상속

자식 코루틴은 부모의 컨텍스트를 상속합니다. 덮어쓸 수 있습니다.

```kotlin
runBlocking(CoroutineName("parent")) {
    println(coroutineContext[CoroutineName])  // CoroutineName(parent)

    launch(CoroutineName("child")) {
        println(coroutineContext[CoroutineName])  // CoroutineName(child)
        println(coroutineContext[Job])             // 부모 Job 상속
    }
}
```

---

## Job

코루틴의 생명주기를 관리합니다.

```kotlin
val job = launch {
    delay(5000)
    println("완료")
}

println(job.isActive)    // true
println(job.isCancelled) // false
println(job.isCompleted) // false

job.cancel()
println(job.isCancelled) // true
```

### Job 계층

```kotlin
val parentJob = Job()
val scope = CoroutineScope(parentJob)

scope.launch { /* 자식 1 */ }
scope.launch { /* 자식 2 */ }

parentJob.cancel()  // 자식 1, 2 모두 취소
```

### SupervisorJob — 자식 실패 독립

일반 `Job`은 자식이 실패하면 다른 자식도 취소됩니다. `SupervisorJob`은 각 자식이 독립적으로 실패합니다.

```kotlin
// 일반 Job — 자식 하나 실패 → 모두 취소
val scope1 = CoroutineScope(Job())
scope1.launch {
    delay(100)
    throw RuntimeException("실패!")
}
scope1.launch {
    delay(200)
    println("이건 실행될까?")  // 실행 안 됨 — 형제가 실패해서 취소
}

// SupervisorJob — 각 자식 독립
val scope2 = CoroutineScope(SupervisorJob())
scope2.launch {
    delay(100)
    throw RuntimeException("실패!")
}
scope2.launch {
    delay(200)
    println("이건 실행될까?")  // 실행됨 — 독립적
}
```

---

## CoroutineExceptionHandler

`launch`에서 잡히지 않은 예외를 처리합니다.

```kotlin
val handler = CoroutineExceptionHandler { context, exception ->
    println("예외 처리: ${exception.message}")
    // 로깅, 알림 등
}

val scope = CoroutineScope(SupervisorJob() + handler)

scope.launch {
    throw RuntimeException("테스트 예외")
}

// "예외 처리: 테스트 예외" 출력
```

> `async`에서 발생한 예외는 `await()` 시 전파됩니다 — handler가 잡지 않음.

---

## 디스패처 선택 가이드

```
CPU 집약 작업 (정렬, 파싱, 암호화)  → Dispatchers.Default
블로킹 I/O (파일, 네트워크, DB)      → Dispatchers.IO
UI 업데이트                          → Dispatchers.Main
단순 코루틴 간 전환                   → Dispatchers.Default 또는 부모 상속
```

```kotlin
class DataProcessor {
    suspend fun process(id: Long): Result {
        // 1. IO: 데이터 로드
        val raw = withContext(Dispatchers.IO) {
            repository.load(id)
        }

        // 2. Default: CPU 집약 처리
        val processed = withContext(Dispatchers.Default) {
            transform(raw)
        }

        // 3. IO: 저장
        withContext(Dispatchers.IO) {
            repository.save(processed)
        }

        return processed
    }
}
```

---

## 정리

- **`CoroutineContext`**: 코루틴 환경 — `+`로 요소 조합
- **`Dispatchers.Default`**: CPU 작업, 코어 수 스레드풀
- **`Dispatchers.IO`**: I/O 작업, 최대 64 스레드풀
- **`Dispatchers.Main`**: UI 스레드 (Android 등)
- **`withContext`**: 코루틴 내 디스패처 전환
- **`CoroutineScope`**: 코루틴 실행 범위, 취소 시 모든 자식 취소
- **`Job`**: 생명주기 관리 — 계층적
- **`SupervisorJob`**: 자식 실패가 형제에 영향 없음
- **`CoroutineExceptionHandler`**: 잡히지 않은 예외 처리
