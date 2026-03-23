---
title: "[Kotlin 시리즈] 13b. 컨텍스트 수신 객체 & 컨텍스트 파라미터"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "context receivers", "context parameters", "컨텍스트", "수신객체", "DSL"]
---

# 컨텍스트 수신 객체 & 컨텍스트 파라미터

## 왜 필요한가

함수가 여러 "환경"에 의존할 때, 기존 방식은 모두 파라미터로 명시적으로 전달해야 합니다.

```kotlin
// 기존 방식 — 모든 의존성을 파라미터로 전달
fun saveUser(
    user: User,
    db: Database,
    logger: Logger,
    tx: Transaction,
) {
    logger.log("저장 시작: ${user.id}")
    tx.run { db.insert(user) }
}
```

함수가 많아지면 `db`, `logger`, `tx`가 모든 호출 체인을 오염시킵니다. **컨텍스트 수신 객체**는 이런 "환경" 의존성을 함수 시그니처에서 분리합니다.

---

## Context Receivers (Kotlin 1.6.20 ~ 2.1, 실험적)

> **주의**: `-Xcontext-receivers` 컴파일러 플래그 필요. Kotlin 2.2부터 **Context Parameters**로 대체됩니다.

### 활성화

```kotlin
// build.gradle.kts
kotlin {
    compilerOptions {
        freeCompilerArgs.add("-Xcontext-receivers")
    }
}
```

### 기본 문법

```kotlin
context(Logger, Transaction)
fun saveUser(user: User) {
    // Logger와 Transaction의 멤버를 this 없이 접근
    log("저장 시작: ${user.id}")   // Logger.log
    run { insert(user) }           // Transaction.run + Database
}
```

수신 객체와 달리, 컨텍스트는 호출 시 자동으로 스코프에서 해결됩니다.

```kotlin
interface Logger {
    fun log(message: String)
}

interface Transaction {
    fun <T> run(block: () -> T): T
}

context(Logger, Transaction)
fun processOrder(order: Order) {
    log("주문 처리 시작: ${order.id}")
    run {
        // 트랜잭션 내에서 실행
        order.items.forEach { item ->
            log("아이템 처리: ${item.name}")
        }
    }
    log("주문 처리 완료")
}
```

### 호출 방법

```kotlin
val logger = object : Logger {
    override fun log(message: String) = println("[LOG] $message")
}

val transaction = object : Transaction {
    override fun <T> run(block: () -> T): T {
        println("[TX START]")
        return block().also { println("[TX END]") }
    }
}

with(logger) {
    with(transaction) {
        processOrder(order)  // 두 컨텍스트가 스코프 안에 있어야 호출 가능
    }
}
```

### 클래스와 프로퍼티에도 적용

```kotlin
context(UserRepository)
class UserService {
    fun getUser(id: Long) = findById(id)  // UserRepository.findById 접근
}

context(Logger)
val User.displayName: String
    get() {
        log("displayName 접근: $id")
        return "$firstName $lastName"
    }
```

---

## Context Parameters (Kotlin 2.2+, 실험적)

Kotlin 2.2에서 Context Receivers를 대체하는 새 설계입니다. 이름이 있어 더 명확합니다.

> **활성화**: `-Xcontext-parameters` 컴파일러 플래그 필요.

### 문법 비교

```kotlin
// Context Receivers (구 방식)
context(Logger, Transaction)
fun saveUser(user: User) { ... }

// Context Parameters (새 방식, Kotlin 2.2+)
context(logger: Logger, tx: Transaction)
fun saveUser(user: User) {
    logger.log("저장 시작")
    tx.run { insert(user) }
}
```

이름이 있으므로 모호성 없이 접근합니다.

### 호출

```kotlin
// with 없이 직접 호출 — 컨텍스트 파라미터 전달
saveUser(user) with(logger, transaction)

// 또는 스코프 안에서
context(logger, transaction) {
    saveUser(user)
}
```

---

## 실용 패턴

### 로깅 컨텍스트

```kotlin
interface LogContext {
    fun log(level: String, message: String)
    fun info(message: String) = log("INFO", message)
    fun error(message: String) = log("ERROR", message)
}

context(LogContext)
fun fetchUser(id: Long): User {
    info("사용자 조회 시작: $id")
    val user = database.findUser(id)
        ?: run {
            error("사용자 없음: $id")
            throw NotFoundException("User $id not found")
        }
    info("사용자 조회 성공: ${user.name}")
    return user
}

context(LogContext)
fun processUserBatch(ids: List<Long>): List<User> {
    info("배치 처리 시작: ${ids.size}건")
    return ids.map { fetchUser(it) }  // fetchUser도 같은 컨텍스트 공유
}
```

### 트랜잭션 컨텍스트

```kotlin
interface TransactionContext {
    fun <T> inTransaction(block: TransactionContext.() -> T): T
    fun rollback()
}

context(TransactionContext)
fun transferMoney(from: Account, to: Account, amount: Long) {
    require(from.balance >= amount) { "잔액 부족" }
    from.balance -= amount
    to.balance += amount
}

// 사용
txContext.inTransaction {
    transferMoney(accountA, accountB, 10_000L)
}
```

### DSL 스코프 정제

기존 DSL에서 중첩 스코프의 잘못된 수신 객체 접근을 방지하는 데 활용할 수 있습니다.

```kotlin
interface HtmlContext
interface BodyContext : HtmlContext
interface TableContext : BodyContext

context(TableContext)
fun row(block: () -> Unit) { /* ... */ }

context(BodyContext)
fun table(block: TableContext.() -> Unit) { /* ... */ }

context(HtmlContext)
fun body(block: BodyContext.() -> Unit) { /* ... */ }

// row는 TableContext 안에서만 호출 가능 — 컨텍스트 밖에서 호출 시 컴파일 에러
```

### 권한 컨텍스트

```kotlin
interface AuthContext {
    val currentUser: User
    fun requireRole(role: String) {
        check(currentUser.hasRole(role)) { "권한 없음: $role" }
    }
}

context(AuthContext)
fun deletePost(postId: Long) {
    requireRole("ADMIN")
    postRepository.delete(postId)
}

context(AuthContext)
fun updatePost(postId: Long, content: String) {
    val post = postRepository.findById(postId)
    check(post.authorId == currentUser.id || currentUser.hasRole("ADMIN")) {
        "수정 권한 없음"
    }
    postRepository.update(postId, content)
}
```

---

## 기존 방식과 비교

### 수신 객체 지정 람다와의 차이

```kotlin
// 수신 객체 지정 람다 — 하나의 수신 객체
fun String.process(): String = uppercase()

// 컨텍스트 수신 객체 — 여러 환경 컨텍스트
context(Logger, Formatter)
fun String.process(): String {
    log("처리 중: $this")
    return format(this)
}
```

수신 객체가 **주인공**(메서드를 호출하는 대상)이라면, 컨텍스트는 **환경**(배경 의존성)입니다.

### 파라미터 vs 컨텍스트

```kotlin
// 명시적 파라미터 — 호출마다 전달 필요
fun processWithLogger(data: Data, logger: Logger) { ... }
fun transformWithLogger(data: Data, logger: Logger) { ... }
fun saveWithLogger(data: Data, logger: Logger, db: Database) { ... }

// 컨텍스트 — 스코프 안에서 자동 해결
context(Logger, Database)
fun process(data: Data) { ... }

context(Logger, Database)
fun transform(data: Data) { ... }

context(Logger, Database)
fun save(data: Data) { ... }

// 한 번만 설정, 스코프 안에서 자유롭게 호출
with(logger) {
    with(database) {
        process(data)
        transform(data)
        save(data)
    }
}
```

---

## 현재 상태 및 선택 가이드 (2026년 기준)

| | Context Receivers | Context Parameters |
|--|-----------------|------------------|
| Kotlin 버전 | 1.6.20 ~ | 2.2+ |
| 상태 | 실험적 (deprecated 예정) | 실험적 (후속 설계) |
| 이름 | 없음 | 있음 |
| 접근 | 암묵적 `this` | 명시적 이름 |
| 안정성 | 없음 | 없음 (아직) |

**현재 실무 권장**:
- 아직 두 기능 모두 실험적 — **프로덕션 코드에서는 주의**
- 실험적 DSL / 내부 프레임워크 코드에서 활용 가능
- Kotlin 2.2 이상이면 Context Parameters 방향으로

---

## 정리

- **Context Receivers** (`context(A, B)`) — 여러 수신 객체를 암묵적으로 주입, 실험적
- **Context Parameters** (`context(a: A)`) — 이름 있는 컨텍스트, Kotlin 2.2+ 방향
- 로깅, 트랜잭션, 권한 같은 **횡단 관심사**를 시그니처 오염 없이 전달
- 수신 객체가 "주인공"이라면 컨텍스트는 "배경 환경"
- 아직 실험적 — API 변경 가능성 있음
