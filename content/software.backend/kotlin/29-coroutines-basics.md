---
title: "[Kotlin 시리즈] 29. 코루틴 기초 — suspend, launch, async"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "coroutine", "suspend", "launch", "async", "runBlocking", "코루틴"]
---

# 코루틴 기초 — suspend, launch, async

## 코루틴이란

코루틴은 **일시 중단 가능한 계산 단위**입니다. 스레드보다 훨씬 가볍습니다.

```kotlin
// 스레드 — 1만 개 생성 시 메모리/컨텍스트 스위칭 비용 큼
repeat(10_000) {
    Thread { Thread.sleep(1000) }.start()
}

// 코루틴 — 1만 개도 가볍게 동작
runBlocking {
    repeat(10_000) {
        launch { delay(1000) }  // 비블로킹 대기
    }
}
```

핵심 차이:
- **스레드**: OS 수준, 블로킹 시 스레드 점유
- **코루틴**: 라이브러리 수준, 일시 중단 시 스레드 반환 → 다른 코루틴이 사용

---

## suspend 함수

`suspend` 키워드가 붙은 함수는 코루틴 내부에서만 호출할 수 있으며, **일시 중단 지점**을 가질 수 있습니다.

```kotlin
suspend fun fetchUser(id: Long): User {
    delay(1000)  // 1초 비블로킹 대기 (스레드 점유 없음)
    return User(id, "홍길동")
}

suspend fun fetchOrder(userId: Long): List<Order> {
    delay(500)
    return listOf(Order(1L, userId))
}
```

`delay`는 `Thread.sleep`과 달리 스레드를 블로킹하지 않습니다. 코루틴만 중단시키고 스레드는 다른 작업에 사용됩니다.

---

## 코루틴 빌더

### runBlocking — 진입점

일반 함수에서 코루틴 세계로 진입합니다. 내부 코루틴이 모두 완료될 때까지 현재 스레드를 블로킹합니다.

```kotlin
fun main() = runBlocking {
    println("시작")
    delay(1000)
    println("1초 후")
}
```

주로 `main` 함수나 테스트 코드의 진입점으로 사용합니다. 프로덕션 코드 내부에서는 사용하지 않는 것이 좋습니다.

### launch — fire-and-forget

결과가 필요 없는 코루틴. `Job`을 반환합니다.

```kotlin
fun main() = runBlocking {
    val job = launch {
        delay(1000)
        println("launch 완료")
    }

    println("launch 시작됨")
    job.join()  // 완료 대기
    println("모두 완료")
}
// launch 시작됨
// (1초 후)
// launch 완료
// 모두 완료
```

### async — 결과 반환

`Deferred<T>`를 반환하며, `await()`으로 결과를 받습니다.

```kotlin
fun main() = runBlocking {
    val deferred = async {
        delay(1000)
        42  // 결과값
    }

    println("다른 작업...")
    val result = deferred.await()  // 결과가 준비될 때까지 대기
    println("결과: $result")
}
```

### 병렬 실행

```kotlin
fun main() = runBlocking {
    val start = System.currentTimeMillis()

    // 순차 실행 — 2초
    val user = fetchUser(1L)    // 1초
    val orders = fetchOrder(1L) // 1초

    // 병렬 실행 — 약 1초
    val userDeferred = async { fetchUser(1L) }
    val ordersDeferred = async { fetchOrder(1L) }
    val user2 = userDeferred.await()
    val orders2 = ordersDeferred.await()

    println("${System.currentTimeMillis() - start}ms")
}
```

```kotlin
// awaitAll — 여러 Deferred 한꺼번에 대기
val results = (1..5).map { id ->
    async { fetchUser(id.toLong()) }
}.awaitAll()
```

### coroutineScope — 범위 생성

자식 코루틴이 모두 완료될 때까지 대기합니다. 자식 중 하나라도 실패하면 나머지를 취소합니다.

```kotlin
suspend fun loadDashboard(): Dashboard = coroutineScope {
    val user = async { fetchUser(currentUserId()) }
    val notifications = async { fetchNotifications() }
    val feed = async { fetchFeed() }

    Dashboard(
        user = user.await(),
        notifications = notifications.await(),
        feed = feed.await(),
    )
}
```

---

## 일시 중단과 재개

코루틴이 `suspend` 함수를 만나면 현재 상태를 저장하고 스레드를 반환합니다. 작업이 완료되면 다시 재개됩니다.

```kotlin
fun main() = runBlocking {
    println("스레드: ${Thread.currentThread().name}")

    launch {
        println("코루틴 시작: ${Thread.currentThread().name}")
        delay(1000)   // 여기서 일시 중단
        println("코루틴 재개: ${Thread.currentThread().name}")
    }

    println("main 계속")
}
// 스레드: main
// main 계속
// 코루틴 시작: main
// (1초 후)
// 코루틴 재개: main
```

---

## 코루틴 vs 스레드

```kotlin
// 스레드 기반 — 블로킹 I/O
fun fetchWithThread(url: String): String {
    return Thread.currentThread().let {
        // I/O 동안 스레드 점유
        URL(url).readText()
    }
}

// 코루틴 기반 — 비블로킹 I/O
suspend fun fetchWithCoroutine(url: String): String {
    return withContext(Dispatchers.IO) {
        // I/O 동안 스레드 반환, 완료 후 재개
        URL(url).readText()
    }
}
```

| | 스레드 | 코루틴 |
|--|--------|--------|
| 생성 비용 | 높음 (수 MB) | 낮음 (수 KB) |
| 컨텍스트 스위칭 | OS 수준 | 라이브러리 수준 |
| 블로킹 | 스레드 점유 | 스레드 반환 |
| 동시 실행 수 | 수백~수천 | 수십만 |

---

## 구조적 동시성

코루틴은 **부모-자식 관계**를 가집니다. 부모 코루틴이 취소되면 자식도 취소됩니다.

```kotlin
fun main() = runBlocking {
    val parentJob = launch {
        launch {
            delay(1000)
            println("자식 1")  // 실행 안 됨
        }
        launch {
            delay(2000)
            println("자식 2")  // 실행 안 됨
        }
        println("부모 실행 중")
    }

    delay(500)
    parentJob.cancel()  // 부모 취소 → 자식도 취소
    println("부모 취소됨")
}
```

---

## 실전 패턴

### 순차 vs 병렬

```kotlin
// 순차 — 의존성이 있을 때
suspend fun getOrderDetails(orderId: Long): OrderDetails {
    val order = fetchOrder(orderId)    // 먼저 주문 조회
    val user = fetchUser(order.userId) // 주문의 userId로 사용자 조회
    return OrderDetails(order, user)
}

// 병렬 — 독립적인 작업
suspend fun getDashboardData(): DashboardData = coroutineScope {
    val userD = async { fetchCurrentUser() }
    val statsD = async { fetchStats() }
    val newsD = async { fetchNews() }

    DashboardData(userD.await(), statsD.await(), newsD.await())
}
```

### 에러 처리

```kotlin
suspend fun safeLoad(): Result<User> = runCatching {
    fetchUser(1L)
}

fun main() = runBlocking {
    val job = launch {
        try {
            val user = fetchUser(1L)
            println("성공: $user")
        } catch (e: Exception) {
            println("실패: ${e.message}")
        }
    }
    job.join()
}
```

---

## 정리

- **`suspend fun`**: 코루틴 내에서만 호출 가능, 일시 중단 지점 보유
- **`runBlocking`**: 일반 → 코루틴 진입, 테스트/main 전용
- **`launch`**: fire-and-forget, `Job` 반환
- **`async`**: 결과 필요, `Deferred<T>` 반환, `await()`으로 결과 획득
- **`coroutineScope`**: 자식 모두 완료 대기, 하나 실패 시 나머지 취소
- **`delay`**: 비블로킹 대기 — 스레드 점유 없음
- 구조적 동시성: 부모 취소 → 자식 취소
