---
title: "[Kotlin 시리즈] 36. 직렬화 (kotlinx.serialization)"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "serialization", "kotlinx.serialization", "JSON", "Serializable"]
---

# 직렬화 (kotlinx.serialization)

## 설정

```kotlin
// build.gradle.kts
plugins {
    kotlin("plugin.serialization") version "2.0.0"
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.0")
}
```

---

## 기본 사용

```kotlin
import kotlinx.serialization.*
import kotlinx.serialization.json.*

@Serializable
data class User(val id: Long, val name: String, val email: String)

val user = User(1L, "홍길동", "hong@example.com")

// 직렬화 (객체 → JSON)
val json = Json.encodeToString(user)
// {"id":1,"name":"홍길동","email":"hong@example.com"}

// 역직렬화 (JSON → 객체)
val decoded = Json.decodeFromString<User>(json)
```

---

## 어노테이션

### @SerialName — 필드명 변경

```kotlin
@Serializable
data class ApiResponse(
    @SerialName("user_id") val userId: Long,
    @SerialName("full_name") val fullName: String,
    @SerialName("created_at") val createdAt: String,
)

// JSON: {"user_id":1,"full_name":"홍길동","created_at":"2026-01-01"}
```

### @Transient — 직렬화 제외

```kotlin
@Serializable
data class User(
    val id: Long,
    val name: String,
    @Transient val password: String = "",  // 직렬화 제외, 기본값 필수
    @Transient val cachedToken: String? = null,
)
```

### @Required — 기본값 있어도 필수

```kotlin
@Serializable
data class Config(
    @Required val version: String = "1.0",  // JSON에 반드시 포함되어야 함
    val debug: Boolean = false,
)
```

### @EncodeDefault — 기본값 포함/제외 제어

```kotlin
@Serializable
data class Settings(
    @EncodeDefault(EncodeDefault.Mode.ALWAYS)
    val theme: String = "light",   // 기본값이어도 항상 포함

    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val experimental: Boolean = false,  // 기본값이면 제외
)
```

---

## Json 설정

```kotlin
val json = Json {
    prettyPrint = true            // 들여쓰기 포함
    ignoreUnknownKeys = true      // 모르는 키 무시 (역직렬화 시)
    isLenient = true              // 따옴표 없는 문자열 등 허용
    encodeDefaults = true         // 기본값도 포함
    explicitNulls = false         // null 필드 제외
    coerceInputValues = true      // 잘못된 값을 기본값으로
    allowStructuredMapKeys = true // Map 키를 객체로 허용
}

val pretty = json.encodeToString(user)
```

---

## 컬렉션 직렬화

```kotlin
@Serializable
data class Page<T>(val items: List<T>, val total: Int)

val page = Page(
    items = listOf(User(1L, "Alice", "a@example.com")),
    total = 1,
)

Json.encodeToString(page)
// {"items":[{"id":1,"name":"Alice","email":"a@example.com"}],"total":1}

// 리스트 직렬화
val users = listOf(User(1L, "Alice", "a@b.com"), User(2L, "Bob", "b@c.com"))
Json.encodeToString(users)

// Map 직렬화
val map = mapOf("a" to 1, "b" to 2)
Json.encodeToString(map)  // {"a":1,"b":2}
```

---

## 다형성 직렬화

```kotlin
@Serializable
sealed class Shape {
    @Serializable
    data class Circle(val radius: Double) : Shape()

    @Serializable
    data class Rectangle(val width: Double, val height: Double) : Shape()
}

val shape: Shape = Shape.Circle(5.0)
Json.encodeToString(shape)
// {"type":"Circle","radius":5.0}  — type 판별자 자동 포함

Json.decodeFromString<Shape>("""{"type":"Circle","radius":5.0}""")
// Shape.Circle(5.0)
```

### 클래스 판별자 커스터마이징

```kotlin
@Serializable
@JsonClassDiscriminator("kind")  // 기본 "type" 대신 "kind" 사용
sealed class Event {
    @Serializable
    @SerialName("click")
    data class Click(val x: Int, val y: Int) : Event()

    @Serializable
    @SerialName("key_press")
    data class KeyPress(val key: String) : Event()
}
```

### SerializersModule — 추상 클래스 다형성

```kotlin
val module = SerializersModule {
    polymorphic(Animal::class) {
        subclass(Dog::class)
        subclass(Cat::class)
    }
}

val json = Json {
    serializersModule = module
    classDiscriminator = "type"
}
```

---

## 커스텀 직렬라이저

```kotlin
@Serializable(with = InstantSerializer::class)
class Instant

object InstantSerializer : KSerializer<Instant> {
    override val descriptor = PrimitiveSerialDescriptor("Instant", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: Instant) {
        encoder.encodeString(value.toString())
    }

    override fun deserialize(decoder: Decoder): Instant {
        return Instant.parse(decoder.decodeString())
    }
}
```

### 서로게이트 직렬라이저

```kotlin
@Serializable
private data class ColorSurrogate(val r: Int, val g: Int, val b: Int)

object ColorSerializer : KSerializer<Color> {
    override val descriptor = ColorSurrogate.serializer().descriptor

    override fun serialize(encoder: Encoder, value: Color) {
        encoder.encodeSerializableValue(
            ColorSurrogate.serializer(),
            ColorSurrogate(value.red, value.green, value.blue)
        )
    }

    override fun deserialize(decoder: Decoder): Color {
        val surrogate = decoder.decodeSerializableValue(ColorSurrogate.serializer())
        return Color(surrogate.r, surrogate.g, surrogate.b)
    }
}
```

---

## JsonElement — 동적 JSON 처리

```kotlin
// JsonElement로 파싱
val element: JsonElement = Json.parseToJsonElement(rawJson)

// 타입 체크
when (element) {
    is JsonObject  -> println(element["name"]?.jsonPrimitive?.content)
    is JsonArray   -> element.forEach { println(it) }
    is JsonPrimitive -> println(element.content)
    else -> {}
}

// JsonObject 빌더
val json = buildJsonObject {
    put("id", 1)
    put("name", "홍길동")
    putJsonArray("tags") {
        add("kotlin")
        add("developer")
    }
    putJsonObject("address") {
        put("city", "서울")
        put("zip", "12345")
    }
}
```

---

## 다른 포맷

```kotlin
// CBOR (바이너리)
implementation("org.jetbrains.kotlinx:kotlinx-serialization-cbor:1.7.0")

val bytes = Cbor.encodeToByteArray(user)
val decoded = Cbor.decodeFromByteArray<User>(bytes)

// ProtoBuf
implementation("org.jetbrains.kotlinx:kotlinx-serialization-protobuf:1.7.0")

@Serializable
data class UserProto(
    @ProtoNumber(1) val id: Long,
    @ProtoNumber(2) val name: String,
)

val bytes = ProtoBuf.encodeToByteArray(UserProto(1L, "홍길동"))
```

---

## 정리

- `@Serializable` — 직렬화 가능 클래스 선언
- `@SerialName` — JSON 키 이름 변경
- `@Transient` — 직렬화 제외 (기본값 필수)
- `Json { }` — prettyPrint, ignoreUnknownKeys, encodeDefaults 등 설정
- **sealed class** — 자동 다형성 직렬화 (`type` 판별자)
- `KSerializer<T>` — 커스텀 직렬화 로직
- `JsonElement` / `buildJsonObject` — 동적 JSON 처리
- 포맷: `Json`, `Cbor`, `ProtoBuf`
