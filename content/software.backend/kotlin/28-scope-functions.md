---
title: "[Kotlin 시리즈] 28. 스코프 함수 — let, run, with, apply, also"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "scope functions", "let", "run", "with", "apply", "also", "takeIf"]
---

# 스코프 함수 — let, run, with, apply, also

## 한눈에 비교

| 함수 | 수신 객체 참조 | 반환값 | 확장 함수 |
|------|-------------|--------|---------|
| `let` | `it` | 람다 결과 | O |
| `run` | `this` | 람다 결과 | O |
| `with` | `this` | 람다 결과 | X (인자로 받음) |
| `apply` | `this` | 수신 객체 | O |
| `also` | `it` | 수신 객체 | O |

---

## let — 변환 + null 안전 체인

`it`으로 참조, 람다 결과 반환.

```kotlin
val len = "Kotlin".let { it.length }   // 6
val upper = "hello".let { it.uppercase() }  // "HELLO"
```

### null 안전 체인

```kotlin
val name: String? = findUser()?.name

// let으로 null이 아닐 때만 실행
name?.let { n ->
    println("이름: $n")
    sendEmail(n)
}
```

### 변수 범위 제한

```kotlin
// 임시 변수를 바깥 스코프에 노출하지 않음
val result = heavyComputation().let { value ->
    process(value)
    transform(value)
}
```

---

## run — 초기화 블록 + 결과 계산

`this`로 참조, 람다 결과 반환.

```kotlin
val message = StringBuilder().run {
    append("안녕하세요, ")
    append("코틀린!")
    toString()  // 이 값이 반환됨
}
// "안녕하세요, 코틀린!"
```

### 조건부 실행

```kotlin
val connection = getConnection()

val result = connection?.run {
    query("SELECT * FROM users")
    // this = connection, 결과 반환
} ?: emptyList()
```

### 확장 함수 없는 run

객체 없이 단순 블록으로도 사용할 수 있습니다.

```kotlin
val answer = run {
    val x = computeX()
    val y = computeY()
    x + y  // 블록 결과 반환
}
```

---

## with — 이미 있는 객체에 연산

`this`로 참조, 람다 결과 반환. 확장 함수가 아니라 인자로 받습니다.

```kotlin
data class User(var name: String, var age: Int, var email: String)

val user = User("홍길동", 30, "hong@example.com")

with(user) {
    println(name)    // this.name
    println(age)
    println(email)
}
```

```kotlin
// 객체의 여러 프로퍼티를 읽어 계산
val summary = with(order) {
    "주문 #$id: ${items.size}건, 총 ${totalPrice}원, 상태: $status"
}
```

---

## apply — 객체 설정 후 반환

`this`로 참조, **수신 객체 반환**. 빌더 패턴에 적합합니다.

```kotlin
data class ServerConfig(
    var host: String = "localhost",
    var port: Int = 8080,
    var timeout: Int = 3000,
)

val config = ServerConfig().apply {
    host = "prod.example.com"
    port = 443
    timeout = 5000
}
```

### 체이닝

```kotlin
val request = HttpRequest()
    .apply { url = "https://api.example.com" }
    .apply { method = "POST" }
    .apply { addHeader("Content-Type", "application/json") }
```

### 생성자 + 초기화

```kotlin
val list = mutableListOf<String>().apply {
    add("first")
    add("second")
    add("third")
}
```

---

## also — 부수 효과, 체이닝 유지

`it`으로 참조, **수신 객체 반환**. 객체를 변경하지 않고 부수 효과를 추가합니다.

```kotlin
val user = createUser()
    .also { println("생성됨: $it") }
    .also { logger.log("user created: ${it.id}") }
    .also { auditService.record(it) }
// user는 createUser()의 결과 그대로
```

### 파이프라인 디버깅

```kotlin
val result = data
    .filter { it > 0 }
    .also { println("필터 후: $it") }
    .map { it * 2 }
    .also { println("맵 후: $it") }
    .take(5)
```

---

## takeIf / takeUnless — 조건부 반환

조건에 따라 객체 또는 null을 반환합니다.

```kotlin
val input = "kotlin"

// takeIf — 조건이 true면 객체, false면 null
val result = input.takeIf { it.length > 3 }  // "kotlin"
val none = input.takeIf { it.length > 10 }   // null

// takeUnless — 조건이 false면 객체, true면 null
val noBlank = input.takeUnless { it.isBlank() }  // "kotlin"
```

```kotlin
// null 연산자와 조합
fun process(input: String): String? =
    input
        .takeIf { it.isNotBlank() }
        ?.trim()
        ?.uppercase()
```

---

## 선택 기준

```
객체를 설정하고 그대로 반환 → apply
객체로 계산하고 다른 값 반환 → let, run, with
부수 효과 추가, 객체 유지 → also
null 안전 체인 → ?.let { }
조건부 반환 → takeIf / takeUnless
```

### 실전 예시

```kotlin
// apply — 설정 후 반환
val dialog = AlertDialog.Builder(context).apply {
    setTitle("확인")
    setMessage("삭제하시겠습니까?")
    setPositiveButton("예") { _, _ -> delete() }
    setNegativeButton("아니오", null)
}.create()

// let — null 체크 후 변환
val userName = user?.let { "${it.firstName} ${it.lastName}" } ?: "Guest"

// also — 로깅
fun saveUser(user: User): User =
    repository.save(user)
        .also { log.info("저장됨: ${it.id}") }

// with — 여러 프로퍼티 읽기
val report = with(statistics) {
    "총 ${totalCount}건, 성공 ${successCount}건 (${successRate}%)"
}

// run — 복잡한 초기화
val client = run {
    val cert = loadCertificate()
    val ssl = buildSslContext(cert)
    HttpClient(ssl)
}
```

---

## 정리

- **`let`**: `it` 참조, 람다 결과 반환 — null 체크, 범위 제한, 변환
- **`run`**: `this` 참조, 람다 결과 반환 — 복잡한 초기화, 계산 블록
- **`with`**: `this` 참조, 람다 결과 반환 — 기존 객체의 여러 멤버 접근
- **`apply`**: `this` 참조, 수신 객체 반환 — 빌더, 객체 설정
- **`also`**: `it` 참조, 수신 객체 반환 — 로깅, 검증, 체인 유지
- **`takeIf`** / **`takeUnless`**: 조건부 nullable 반환
