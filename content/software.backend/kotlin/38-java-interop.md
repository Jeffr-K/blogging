---
title: "[Kotlin 시리즈] 38. Java 상호운용성"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "java interop", "JvmStatic", "JvmField", "platform type", "SAM"]
---

# Java 상호운용성

## Kotlin에서 Java 호출

### 기본 타입과 컬렉션

```kotlin
// Java의 기본 타입 — Kotlin에서 Int, Long 등으로 자동 매핑
val list: java.util.ArrayList<String> = java.util.ArrayList()
list.add("hello")

// Kotlin 컬렉션과 Java 컬렉션 자동 변환
val kotlinList: List<String> = list           // Java List → Kotlin List
val javaList: java.util.List<String> = mutableListOf("a", "b")  // Kotlin → Java
```

### 플랫폼 타입 (Platform Type)

Java의 `null` 반환 여부가 불명확한 타입은 `T!`(플랫폼 타입)로 처리됩니다. Kotlin이 nullable 여부를 강제하지 않습니다.

```java
// Java
public class JavaService {
    public String getName() { return null; }   // null 반환 가능
    @NotNull public String getId() { ... }      // null 아님 보장
    @Nullable public String getEmail() { ... }  // null 가능
}
```

```kotlin
val service = JavaService()

// 플랫폼 타입 — Kotlin이 null 여부 모름
val name: String = service.name   // String! (위험 — NPE 가능)
val name2: String? = service.name // String? (안전)

// @NotNull/@Nullable 어노테이션이 있으면 Kotlin이 타입 추론
val id: String = service.id        // @NotNull → String
val email: String? = service.email // @Nullable → String?
```

### Java 예외 처리

Java의 checked exception은 Kotlin에서 강제되지 않습니다.

```kotlin
// Java IOException은 checked지만 Kotlin에서 try-catch 강제 없음
fun readFile(path: String): String {
    return java.io.File(path).readText()  // IOException이어도 try-catch 선택적
}

// 명시적으로 처리 가능
fun safeRead(path: String): String? =
    runCatching { java.io.File(path).readText() }.getOrNull()
```

### Java SAM 인터페이스

```kotlin
// Runnable, Callable 등 단일 메서드 인터페이스 → 람다 자동 변환
Thread { println("스레드 실행") }.start()

val callable: java.util.concurrent.Callable<String> = java.util.concurrent.Callable {
    "결과"
}

// Comparator
val sorted = listOf("banana", "apple", "cherry")
    .sortedWith(Comparator { a, b -> a.compareTo(b) })
// 또는 람다 직접
    .sortedWith { a, b -> a.compareTo(b) }
```

### Java static 멤버

```kotlin
// Java static 메서드/필드 접근
val pi = java.lang.Math.PI
val max = java.lang.Math.max(3, 5)
val uuid = java.util.UUID.randomUUID()

// System
System.currentTimeMillis()
System.getenv("HOME")
System.getProperty("java.version")
```

---

## Java에서 Kotlin 호출

### @JvmStatic — 정적 메서드 노출

```kotlin
class MathHelper {
    companion object {
        @JvmStatic
        fun square(n: Int) = n * n

        fun cube(n: Int) = n * n * n  // @JvmStatic 없음
    }
}
```

```java
// Java에서 호출
MathHelper.square(5);           // @JvmStatic — 정상
MathHelper.Companion.cube(5);   // @JvmStatic 없음 — Companion 필요
```

### @JvmField — 필드로 노출

```kotlin
class Config {
    companion object {
        @JvmField val DEFAULT_HOST = "localhost"
        const val DEFAULT_PORT = 8080  // const val은 자동으로 static final
    }

    @JvmField var name: String = ""   // getter/setter 없이 직접 필드 접근
}
```

```java
// Java에서
Config.DEFAULT_HOST;   // @JvmField — 직접 필드 접근
Config.DEFAULT_PORT;   // const val — 자동 static final
config.name = "test";  // @JvmField 인스턴스 필드
```

### @JvmOverloads — 기본 파라미터 오버로드

```kotlin
class Builder @JvmOverloads constructor(
    val host: String = "localhost",
    val port: Int = 8080,
    val timeout: Int = 3000,
)
```

```java
// Java에서 — 모든 오버로드 자동 생성
new Builder();
new Builder("prod.example.com");
new Builder("prod.example.com", 443);
new Builder("prod.example.com", 443, 5000);
```

### @JvmName — JVM 이름 변경

```kotlin
// 같은 JVM 시그니처 충돌 방지
@JvmName("filterStrings")
fun List<String>.filter(predicate: (String) -> Boolean): List<String> = filter(predicate)

// 파일 레벨 — 클래스명 변경
@file:JvmName("StringUtils")
package com.example.utils

fun capitalize(s: String) = s.replaceFirstChar { it.uppercase() }
```

```java
// Java에서
StringUtils.capitalize("hello");  // @file:JvmName 적용
```

### @Throws — checked 예외 선언

```kotlin
@Throws(IOException::class)
fun readFile(path: String): String = File(path).readText()
```

```java
// Java에서 — IOException checked 처리 강제
try {
    readFile("/tmp/data.txt");
} catch (IOException e) {
    e.printStackTrace();
}
```

---

## 프로퍼티 → getter/setter

Kotlin 프로퍼티는 Java에서 getter/setter로 보입니다.

```kotlin
class Person(val name: String, var age: Int)
```

```java
// Java에서
Person person = new Person("홍길동", 30);
person.getName();  // val → getter만
person.getAge();   // var → getter + setter
person.setAge(31);
```

### Boolean 프로퍼티

```kotlin
class Status {
    var isActive: Boolean = false
    val hasData: Boolean get() = true
}
```

```java
// Boolean → is 접두사
status.isActive();
status.setActive(true);
status.hasData();
```

---

## internal 수정자 주의

`internal`은 같은 모듈에서만 접근 가능하지만, Java에서는 접근 제한이 없습니다. 이름이 mangled됩니다.

```kotlin
internal fun internalFunction() {}
```

```java
// Java에서 — mangled name으로 접근 가능 (우회 가능)
internalFunction$module_name();  // 일부러 복잡하게 만들어 discourage
```

---

## 확장 함수 호출

Kotlin 확장 함수는 Java에서 정적 메서드로 보입니다.

```kotlin
// 파일: StringExtensions.kt
fun String.isPalindrome(): Boolean = this == this.reversed()
```

```java
// Java에서
StringExtensionsKt.isPalindrome("racecar");  // 파일명 + Kt 접미사
```

---

## 코루틴 + Java 상호운용

```kotlin
// suspend 함수를 Java에서 호출
class UserService {
    suspend fun getUser(id: Long): User { ... }
}
```

Java에서 `suspend` 함수를 직접 호출하면 `Continuation` 파라미터가 추가됩니다. Java에서 호출하려면 `kotlinx-coroutines-jdk8`의 `future` 빌더를 사용합니다.

```kotlin
// Java 친화적 래퍼
class UserServiceJava(private val service: UserService) {
    fun getUser(id: Long): CompletableFuture<User> =
        GlobalScope.future { service.getUser(id) }
}
```

---

## 정리

**Kotlin → Java**
- 플랫폼 타입 `T!` — `@NotNull`/`@Nullable` 어노테이션으로 해결
- Java checked exception — try-catch 선택적
- Java SAM 인터페이스 → 람다 자동 변환

**Java → Kotlin**
- `@JvmStatic` — companion object 메서드를 static으로
- `@JvmField` — getter/setter 없이 필드 접근
- `@JvmOverloads` — 기본 파라미터 오버로드 생성
- `@JvmName` — JVM 이름 변경, 이름 충돌 해결
- `@Throws` — checked 예외 Java에 선언
- 프로퍼티 → `getName()`/`setName()` 자동 생성
- 확장 함수 → `FileNameKt.extensionFun()` 정적 메서드
