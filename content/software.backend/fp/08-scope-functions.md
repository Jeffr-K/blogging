---
title: "[Kotlin FP] 8. Scope Functions 실전 활용"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "scope-functions", "let", "run", "apply", "also", "FP"]
---

# Scope Functions 실전 활용

Kotlin의 scope function(`let`, `run`, `apply`, `also`, `with`)은 FP에서 자주 쓰는 **문맥(context) 안에서 변환** 패턴을 간결하게 표현한다. 무심코 쓰면 코드가 오히려 복잡해지므로, 각각의 의도를 명확히 이해해야 한다.

---

## 5가지 비교

| 함수 | 수신 객체 참조 | 반환값 | 주 용도 |
|---|---|---|---|
| `let` | `it` | 람다 결과 | null-safe 변환, 범위 제한 |
| `run` | `this` | 람다 결과 | 초기화 + 결과 반환 |
| `apply` | `this` | 수신 객체 | 빌더 패턴, 초기화 |
| `also` | `it` | 수신 객체 | 부수 효과(로깅, 검증) |
| `with` | `this` | 람다 결과 | 여러 연산을 한 블록으로 |

---

## let — null-safe 변환 & 범위 제한

```kotlin
// null-safe 변환 — ?.let으로 null이면 건너뜀
val userName: String? = userRepository.findByEmail(email)?.name

val greeting = userName?.let { name ->
    "안녕하세요, $name!"
} ?: "안녕하세요!"

// Spring에서 — nullable Optional 처리
val order: Order? = orderRepository.findById(id)
val response = order?.let { OrderResponse.from(it) }
    ?: throw OrderNotFoundException(id)
```

```kotlin
// 범위 제한 — 임시 변수를 블록 안으로 가둠
val result = userRepository.findById(userId)
    ?.let { user ->
        val discountRate = if (user.isVip) 0.2 else 0.1
        OrderPrice(user.id, originalPrice * (1 - discountRate))
    }
```

---

## apply — 빌더 패턴, 초기화

`apply`는 수신 객체 자신을 반환한다. 빌더 패턴이나 객체 초기화에 적합하다.

```kotlin
// Spring RestClient 설정
val restClient = RestClient.builder()
    .apply {
        baseUrl("https://api.payment.com")
        defaultHeader("Authorization", "Bearer $token")
        defaultHeader("Content-Type", "application/json")
        requestTimeout(Duration.ofSeconds(5))
    }
    .build()

// Kafka ProducerFactory 설정
@Bean
fun kafkaProducerFactory(): ProducerFactory<String, Any> =
    DefaultKafkaProducerFactory<String, Any>(
        mapOf(
            ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
        )
    ).apply {
        setValueSerializer(JsonSerializer())
        setTransactionIdPrefix("order-tx-")
    }
```

```kotlin
// 엔티티 초기화
fun Order.toEntity(): OrderEntity =
    OrderEntity(userId = userId.value, totalAmount = totalAmount.amount).apply {
        items.addAll(this@toEntity.items.map { it.toEntity(this) })
    }
```

---

## also — 부수 효과 삽입 (로깅, 검증)

체인을 끊지 않고 중간에 로깅이나 검증을 삽입할 때 쓴다.

```kotlin
fun createOrder(command: CreateOrderCommand): Either<OrderError, Order> = either {
    val user  = userRepository.findById(command.userId).bind()
        .also { log.debug("주문 생성 사용자: {}", it.id) }

    val order = Order.create(command, user)
        .also { log.info("주문 생성: items={}, total={}", it.items.size, it.totalAmount) }

    orderRepository.save(order)
        .also { saved -> eventPublisher.publishEvent(OrderCreatedEvent(saved.id)) }
}
```

`also`는 **수신 객체를 그대로 반환**하므로 체인이 끊기지 않는다.

```kotlin
// 테스트에서 중간 값 캡처
val result = calculateDiscount(user, coupon, amount)
    .also { println("할인 계산 결과: $it") }  // 디버깅용
    .getOrElse { Money.ZERO }
```

---

## run — 초기화 + 결과 반환

```kotlin
// 객체 없이 블록 실행 (with 대신)
val config = run {
    val host = System.getenv("DB_HOST") ?: "localhost"
    val port = System.getenv("DB_PORT")?.toInt() ?: 5432
    DatabaseConfig(host, port)
}

// 수신 객체의 여러 프로퍼티를 활용해 새 값 계산
val summary = order.run {
    "주문 #${id.value}: ${items.size}개 상품, 총 ${totalAmount.amount}원"
}
```

---

## with — 같은 수신 객체에 대한 연산 묶기

`with`는 확장 함수가 아니라 일반 함수다. 이미 존재하는 객체에 대해 여러 연산을 묶을 때 쓴다.

```kotlin
val orderSummary = with(order) {
    OrderSummary(
        orderId     = id,
        itemCount   = items.size,
        totalAmount = totalAmount,
        isVipOrder  = totalAmount >= Money.of(100_000),
        createdAt   = createdAt,
    )
}
```

```kotlin
// Spring Security DSL도 with와 유사한 패턴
@Bean
fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
    with(http) {
        csrf { it.disable() }
        authorizeHttpRequests { auth ->
            auth.requestMatchers("/api/public/**").permitAll()
            auth.anyRequest().authenticated()
        }
        sessionManagement { it.sessionCreationPolicy(STATELESS) }
    }
    return http.build()
}
```

---

## 잘못된 사용 — 안티패턴

```kotlin
// ❌ 중첩이 깊어지면 가독성 저하
val result = user?.let { u ->
    order?.let { o ->
        coupon?.let { c ->
            calculateDiscount(u, o, c)
        }
    }
}

// ✅ Either나 직접 변수 할당이 더 명확
val result = either {
    val u = user.toEither { Error.UserNotFound }.bind()
    val o = order.toEither { Error.OrderNotFound }.bind()
    val c = coupon.toEither { Error.CouponNotFound }.bind()
    calculateDiscount(u, o, c)
}
```

```kotlin
// ❌ 반환값이 필요 없는데 let 사용
user?.let {
    log.info("user: $it")  // 반환값 미사용
}

// ✅ also 또는 if 사용
user?.also { log.info("user: $it") }
if (user != null) log.info("user: $user")
```

---

## Spring Boot에서 자주 쓰는 패턴 모음

```kotlin
// 1. Optional → null-safe 처리
jpaRepository.findById(id)
    .orElse(null)
    ?.let { it.toDomain() }
    ?: throw NotFoundException()

// 2. @Bean 설정 초기화
@Bean
fun objectMapper(): ObjectMapper = ObjectMapper().apply {
    registerModule(JavaTimeModule())
    disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
    configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
}

// 3. 조건부 설정 체인
fun buildCacheConfig(ttl: Duration?): RedisCacheConfiguration =
    RedisCacheConfiguration.defaultCacheConfig()
        .let { config ->
            if (ttl != null) config.entryTtl(ttl) else config
        }
        .serializeValuesWith(
            RedisSerializationContext.SerializationPair.fromSerializer(
                GenericJackson2JsonRedisSerializer()
            )
        )

// 4. 로그 + 반환 조합
fun saveOrder(order: Order): Order =
    orderRepository.save(order)
        .also { saved ->
            log.info("주문 저장 완료: id={}, status={}", saved.id, saved.status)
            meterRegistry.counter("order.created").increment()
        }
```

---

## 선택 기준 요약

```
변환이 필요하고 null 처리가 필요 → ?.let { }
초기화하고 객체 자신 반환       → apply { }
중간에 부수 효과만 삽입         → also { }
계산 후 새 값 반환              → run { } 또는 with(obj) { }
```
