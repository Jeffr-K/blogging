---
title: "[Kotlin 시리즈] 42. Kotlin 답게 쓰기 — 패턴 & 관용구"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "idioms", "pattern", "관용구", "코틀린스러운", "아키텍처패턴"]
---

# Kotlin 답게 쓰기 — 패턴 & 관용구

## 표현식 우선

### if / when을 값으로

```kotlin
// 명령형
val label: String
if (score >= 90) {
    label = "A"
} else if (score >= 80) {
    label = "B"
} else {
    label = "C"
}

// Kotlin 답게
val label = when {
    score >= 90 -> "A"
    score >= 80 -> "B"
    else        -> "C"
}

// 단순 조건
val sign = if (n > 0) "양수" else if (n < 0) "음수" else "영"
```

### 타입 체크 + 스마트 캐스트

```kotlin
// 명령형
if (result is Success) {
    val data = (result as Success).data
    process(data)
}

// Kotlin 답게
if (result is Success) {
    process(result.data)  // 스마트 캐스트
}

when (result) {
    is Success -> process(result.data)
    is Failure -> handleError(result.error)
    Loading    -> showSpinner()
}
```

---

## Null 안전 패턴

```kotlin
// ?. 체이닝
val city = user?.address?.city ?: "알 수 없음"

// let으로 null이 아닐 때만 실행
user?.let { u ->
    sendWelcomeEmail(u.email)
    logLogin(u.id)
}

// takeIf / takeUnless
val activeUser = user.takeIf { it.isActive }
val validName = name.takeUnless { it.isBlank() }

// run으로 null 처리 + 계산
val result = user?.run {
    "${firstName} ${lastName} (${age}세)"
} ?: "비회원"

// Elvis로 early return
fun process(user: User?) {
    val u = user ?: return
    // 이후 u는 non-null
}
```

---

## 확장 함수로 가독성 향상

```kotlin
// 도메인 로직을 확장 함수로
fun User.isAdult() = age >= 18
fun User.hasPermission(permission: String) = roles.contains(permission)
fun List<Order>.totalAmount() = sumOf { it.amount }

// 기존 타입 확장
fun String.toSlug() = lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
fun Int.isEven() = this % 2 == 0
fun <T> List<T>.second() = get(1)
fun <T> List<T>.secondOrNull() = getOrNull(1)

// 빌더 스타일
fun buildRequest(block: RequestBuilder.() -> Unit): Request =
    RequestBuilder().apply(block).build()

val request = buildRequest {
    url = "https://api.example.com/users"
    method = "POST"
    header("Authorization", "Bearer $token")
    body(payload)
}
```

---

## 스코프 함수 관용구

```kotlin
// apply — 설정
val dialog = AlertDialog().apply {
    title = "확인"
    message = "진행하시겠습니까?"
    onConfirm = { proceed() }
}

// also — 로깅/검증, 체인 유지
fun createUser(name: String): User =
    User(name = name, createdAt = now())
        .also { logger.info("사용자 생성: ${it.id}") }
        .also { metrics.increment("user.created") }

// let — 변환, 범위 제한
val result = rawData
    .let { parseJson(it) }
    .let { validate(it) }
    .let { transform(it) }

// run — 복잡한 계산
val config = run {
    val env = System.getenv("APP_ENV") ?: "dev"
    val base = loadBaseConfig(env)
    base.merge(loadOverrides(env))
}
```

---

## 컬렉션 함수형 체인

```kotlin
// 명령형
val result = mutableListOf<String>()
for (user in users) {
    if (user.isActive && user.age >= 18) {
        result.add(user.name.uppercase())
    }
}
result.sort()

// 함수형
val result = users
    .filter { it.isActive && it.age >= 18 }
    .map { it.name.uppercase() }
    .sorted()

// groupBy + transform
val report = orders
    .groupBy { it.category }
    .mapValues { (_, orders) ->
        orders.sumOf { it.amount } to orders.size
    }
    .entries
    .sortedByDescending { (_, pair) -> pair.first }
    .joinToString("\n") { (category, pair) ->
        "$category: ${pair.second}건, ${pair.first}원"
    }
```

---

## 아키텍처 패턴

### sealed class + when — 상태 머신

```kotlin
sealed class AuthState {
    data object Unauthenticated : AuthState()
    data object Loading : AuthState()
    data class Authenticated(val user: User, val token: String) : AuthState()
    data class Error(val message: String) : AuthState()
}

class AuthViewModel {
    private val _state = MutableStateFlow<AuthState>(AuthState.Unauthenticated)
    val state = _state.asStateFlow()

    fun login(email: String, password: String) {
        _state.value = AuthState.Loading
        viewModelScope.launch {
            runCatching { authService.login(email, password) }
                .onSuccess { (user, token) ->
                    _state.value = AuthState.Authenticated(user, token)
                }
                .onFailure { error ->
                    _state.value = AuthState.Error(error.message ?: "알 수 없는 오류")
                }
        }
    }
}

// UI
viewModel.state.collect { state ->
    when (state) {
        AuthState.Unauthenticated -> showLoginForm()
        AuthState.Loading         -> showSpinner()
        is AuthState.Authenticated -> navigateToHome(state.user)
        is AuthState.Error        -> showError(state.message)
    }
}
```

### Result<T> — 에러를 타입으로

```kotlin
sealed class AppError {
    data class NetworkError(val code: Int) : AppError()
    data class ValidationError(val field: String, val message: String) : AppError()
    data object NotFoundError : AppError()
}

typealias AppResult<T> = Result<T>

suspend fun getUser(id: Long): AppResult<User> =
    runCatching {
        api.getUser(id) ?: throw NoSuchElementException()
    }

// 체이닝
getUser(userId)
    .map { it.toDisplayModel() }
    .onSuccess { display(it) }
    .onFailure { handleError(it) }
```

### 팩토리 패턴 — companion object + private constructor

```kotlin
class Session private constructor(
    val id: String,
    val userId: Long,
    val expiresAt: Long,
) {
    val isExpired: Boolean get() = System.currentTimeMillis() > expiresAt

    companion object {
        fun create(userId: Long, ttlMs: Long = 3_600_000L): Session {
            require(userId > 0) { "유효하지 않은 userId" }
            return Session(
                id = UUID.randomUUID().toString(),
                userId = userId,
                expiresAt = System.currentTimeMillis() + ttlMs,
            )
        }

        fun fromToken(token: String): Session? =
            runCatching { parseToken(token) }.getOrNull()
    }
}

val session = Session.create(userId = 42L)
```

### 커링 스타일 DI

```kotlin
// 의존성을 함수로 주입
typealias UserFinder = suspend (Long) -> User?
typealias OrderSaver = suspend (Order) -> Order

fun makeOrderService(
    findUser: UserFinder,
    saveOrder: OrderSaver,
): suspend (CreateOrderRequest) -> Order = { request ->
    val user = findUser(request.userId)
        ?: throw NotFoundException("User ${request.userId}")
    val order = Order.from(user, request)
    saveOrder(order)
}

// 조립
val orderService = makeOrderService(
    findUser = userRepository::findById,
    saveOrder = orderRepository::save,
)
```

### DSL로 설정 표현

```kotlin
class RouteBuilder {
    private val routes = mutableListOf<Route>()

    fun get(path: String, handler: suspend (Request) -> Response) {
        routes.add(Route("GET", path, handler))
    }

    fun post(path: String, handler: suspend (Request) -> Response) {
        routes.add(Route("POST", path, handler))
    }

    fun build() = routes.toList()
}

fun routes(block: RouteBuilder.() -> Unit): List<Route> =
    RouteBuilder().apply(block).build()

val appRoutes = routes {
    get("/users") { req ->
        userService.findAll().toResponse()
    }
    get("/users/{id}") { req ->
        userService.findById(req.pathParam("id").toLong()).toResponse()
    }
    post("/users") { req ->
        userService.create(req.body<CreateUserRequest>()).toResponse()
    }
}
```

---

## 동시성 패턴

### StateFlow로 상태 관리

```kotlin
class CartViewModel(private val repo: CartRepository) : ViewModel() {
    private val _items = MutableStateFlow<List<CartItem>>(emptyList())
    val items: StateFlow<List<CartItem>> = _items.asStateFlow()

    val total = items.map { list -> list.sumOf { it.price * it.quantity } }
        .stateIn(viewModelScope, SharingStarted.Lazily, 0L)

    fun addItem(product: Product) {
        _items.update { current ->
            current + CartItem(product, 1)
        }
    }

    fun removeItem(itemId: Long) {
        _items.update { it.filter { item -> item.id != itemId } }
    }
}
```

### Flow 기반 이벤트 버스

```kotlin
object AppEventBus {
    private val _events = MutableSharedFlow<AppEvent>(extraBufferCapacity = 10)
    val events: SharedFlow<AppEvent> = _events.asSharedFlow()

    suspend fun emit(event: AppEvent) = _events.emit(event)
    fun tryEmit(event: AppEvent) = _events.tryEmit(event)
}

// 구독
AppEventBus.events
    .filterIsInstance<AppEvent.UserLoggedIn>()
    .onEach { event -> refreshDashboard(event.userId) }
    .launchIn(scope)
```

---

## 정리

**표현식 우선**: `if`/`when`을 값으로 활용, 변수 대입보다 직접 반환

**Null 안전**: `?.`, `?:`, `let`, `takeIf`를 체인으로 — 명시적 null 체크 최소화

**확장 함수**: 도메인 로직을 메서드처럼 — 가독성 있는 API

**스코프 함수**: `apply`(설정), `also`(로깅), `let`(변환), `run`(계산)

**아키텍처**:
- `sealed class` + `when` → 상태 머신
- `Result<T>` / `runCatching` → 에러를 타입으로
- `companion object` + private constructor → 팩토리
- `StateFlow` → 상태 관리
- `SharedFlow` → 이벤트 버스
