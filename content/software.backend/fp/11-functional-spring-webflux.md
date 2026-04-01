---
title: "[Kotlin FP] 11. 함수형 Spring WebFlux"
author: oscar.rs
date: 2026-04-01
tags: ["kotlin", "spring-boot", "webflux", "RouterFunction", "Mono", "Flux", "FP"]
---

# 함수형 Spring WebFlux

Spring WebFlux는 어노테이션 기반(`@RestController`)과 **함수형 라우터** 두 가지 방식을 지원한다. 함수형 라우터는 라우팅 로직을 코드로 명시적으로 표현하는 방식으로, FP의 "함수를 값으로 다루기" 원칙에 가깝다.

---

## RouterFunction — 함수형 라우터

```kotlin
// 어노테이션 방식
@RestController
@RequestMapping("/api/orders")
class OrderController {
    @GetMapping("/{id}")
    fun getOrder(@PathVariable id: Long) = ...
}

// 함수형 라우터 방식
@Configuration
class OrderRouter {

    @Bean
    fun orderRoutes(handler: OrderHandler): RouterFunction<ServerResponse> =
        router {
            "/api/orders".nest {
                GET("/{id}", handler::getOrder)
                POST("/", handler::createOrder)
                PUT("/{id}/cancel", handler::cancelOrder)
                GET("/", handler::listOrders)
            }
        }
}
```

라우터는 **어디로 라우팅할지**를 선언하고, **Handler**가 실제 로직을 담당한다.

---

## Handler 구현

```kotlin
@Component
class OrderHandler(private val orderService: OrderService) {

    suspend fun getOrder(request: ServerRequest): ServerResponse {
        val id = request.pathVariable("id").toLong()

        return orderService.findOrder(OrderId(id))
            .fold(
                ifLeft  = { error -> error.toServerResponse() },
                ifRight = { order -> ServerResponse.ok().bodyValueAndAwait(order.toResponse()) }
            )
    }

    suspend fun createOrder(request: ServerRequest): ServerResponse {
        val command = request.awaitBody<CreateOrderCommand>()

        return orderService.createOrder(command).fold(
            ifLeft  = { it.toServerResponse() },
            ifRight = { order ->
                ServerResponse.status(201)
                    .bodyValueAndAwait(order.toResponse())
            }
        )
    }

    suspend fun listOrders(request: ServerRequest): ServerResponse {
        val userId = request.queryParam("userId")
            .map { UserId(it.toLong()) }
            .orElse(null)
            ?: return ServerResponse.badRequest().buildAndAwait()

        val orders = orderService.getOrdersFlow(userId)
            .map { it.toResponse() }
            .toList()

        return ServerResponse.ok().bodyValueAndAwait(orders)
    }
}
```

---

## Mono/Flux를 Either처럼 다루기

WebFlux의 `Mono<T>`는 Arrow의 `Either<E, A>`와 유사한 개념이다. 둘 다 "값이 있거나 없거나(에러)"를 표현한다.

```kotlin
// Mono — 성공 또는 에러 시그널
Mono.just(order)           // 성공
Mono.error(NotFoundException())  // 에러

// Either — Right 또는 Left
order.right()
OrderError.NotFound.left()
```

서비스가 `Either`를 반환한다면 `Mono`로 변환할 수 있다.

```kotlin
fun <E : AppError, T> Either<E, T>.toMono(): Mono<T> = fold(
    ifLeft  = { Mono.error(it.toException()) },
    ifRight = { Mono.just(it) }
)

fun <E : AppError, T> Either<E, T>.toServerResponseMono(
    successStatus: HttpStatus = HttpStatus.OK
): Mono<ServerResponse> = fold(
    ifLeft  = { error ->
        ServerResponse.status(error.httpStatus())
            .bodyValue(ErrorResponse(error.message))
    },
    ifRight = { value ->
        ServerResponse.status(successStatus).bodyValue(value)
    }
)
```

---

## Flux — 스트리밍 응답

```kotlin
@Bean
fun orderStreamRoutes(handler: OrderStreamHandler): RouterFunction<ServerResponse> =
    router {
        GET("/api/orders/stream", handler::streamOrders)
        GET("/api/events/orders", handler::orderEventStream)
    }

@Component
class OrderStreamHandler(private val orderService: OrderService) {

    // Server-Sent Events 스트리밍
    suspend fun streamOrders(request: ServerRequest): ServerResponse {
        val userId = UserId(request.queryParam("userId").orElseThrow().toLong())

        return ServerResponse.ok()
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .bodyAndAwait(
                orderService.getOrdersFlow(userId).map { it.toResponse() }.asFlux()
            )
    }

    // 이벤트 스트림 (Flux 직접 사용)
    fun orderEventStream(request: ServerRequest): Mono<ServerResponse> {
        val events: Flux<OrderEvent> = orderEventService.subscribe()
            .filter { it.type != OrderEventType.HEARTBEAT }
            .map { it.toSseEvent() }

        return ServerResponse.ok()
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .body(events, OrderEvent::class.java)
    }
}
```

---

## 에러 처리 — onErrorResume vs Either

WebFlux에서 에러 처리 방법이 두 가지 있다.

### 방법 1: onErrorResume (리액티브 방식)

```kotlin
fun getOrder(orderId: OrderId): Mono<Order> =
    Mono.fromCallable { orderRepository.findById(orderId) }
        .subscribeOn(Schedulers.boundedElastic())
        .onErrorResume(EntityNotFoundException::class.java) { e ->
            Mono.error(OrderNotFoundException(orderId))
        }
        .onErrorResume(DataAccessException::class.java) { e ->
            Mono.error(DatabaseException("DB 오류", e))
        }
```

### 방법 2: Either와 조합 (타입 안전)

```kotlin
// 서비스 — Either 반환
suspend fun getOrder(orderId: OrderId): Either<OrderError, Order>

// Handler — Either를 ServerResponse로 변환
suspend fun getOrder(request: ServerRequest): ServerResponse {
    val id = OrderId(request.pathVariable("id").toLong())
    return orderService.getOrder(id).fold(
        ifLeft  = { error ->
            when (error) {
                is OrderError.NotFound -> ServerResponse.notFound().buildAndAwait()
                else -> ServerResponse.status(500).buildAndAwait()
            }
        },
        ifRight = { order ->
            ServerResponse.ok().bodyValueAndAwait(order.toResponse())
        }
    )
}
```

`Either` 방식은 에러 타입이 컴파일 타임에 확정되어 처리 누락이 없다. `onErrorResume`은 런타임 예외 타입에 의존한다.

---

## WebFilter — 함수형 미들웨어

```kotlin
@Component
@Order(1)
class RequestLoggingFilter : WebFilter {

    override fun filter(exchange: ServerWebExchange, chain: WebFilterChain): Mono<Void> {
        val request = exchange.request
        val requestId = UUID.randomUUID().toString()

        return chain.filter(exchange)
            .doFirst {
                log.info("→ {} {} [{}]", request.method, request.path, requestId)
            }
            .doOnSuccess {
                log.info("← {} {} [{}]", exchange.response.statusCode, request.path, requestId)
            }
    }
}
```

```kotlin
// 코루틴 WebFilter
@Component
class JwtAuthFilter(private val jwtService: JwtService) : CoWebFilter() {

    override suspend fun filter(exchange: ServerWebExchange, chain: CoWebFilterChain) {
        val token = exchange.request.headers.getFirst("Authorization")
            ?.removePrefix("Bearer ")

        if (token != null) {
            jwtService.validateToken(token).fold(
                ifLeft  = { /* 무시 — Security가 처리 */ },
                ifRight = { claims ->
                    val auth = UsernamePasswordAuthenticationToken(
                        claims.subject, null, claims.authorities()
                    )
                    val context = SecurityContextImpl(auth)
                    exchange.attributes[SecurityContext::class.java.name] = context
                }
            )
        }

        chain.filter(exchange)
    }
}
```

---

## 함수형 라우터 vs 어노테이션 방식

| | 어노테이션 (`@RestController`) | 함수형 라우터 |
|---|---|---|
| 라우팅 방식 | 어노테이션으로 선언 | 코드로 명시 |
| 가독성 | 간결 (소규모) | 라우팅 구조 한눈에 파악 |
| 테스트 | `@WebFluxTest` | `RouterFunctions.toHttpHandler()`로 단독 테스트 |
| 유연성 | 제한적 | 동적 라우팅 가능 |
| Spring 통합 | 자동 | 수동 설정 |

소규모 API는 어노테이션, 라우팅 구조가 복잡하거나 미들웨어 조합이 필요한 경우 함수형 라우터가 적합하다. 두 방식을 혼합해서 써도 된다.

---

## 함수형 라우터 테스트

```kotlin
class OrderRouterTest {

    private val orderService = mockk<OrderService>()
    private val handler = OrderHandler(orderService)
    private val router = OrderRouter().orderRoutes(handler)

    private val client = WebTestClient
        .bindToRouterFunction(router)
        .build()

    @Test
    fun `GET /api/orders/{id} — 존재하는 주문 반환`() {
        val order = Order(OrderId(1L), OrderStatus.Pending, ...)
        coEvery { orderService.findOrder(OrderId(1L)) } returns order.right()

        client.get().uri("/api/orders/1")
            .exchange()
            .expectStatus().isOk
            .expectBody<OrderResponse>()
            .value { response ->
                assertThat(response.id).isEqualTo(1L)
            }
    }
}
```

`@SpringBootTest` 없이도 라우터를 테스트할 수 있다.
