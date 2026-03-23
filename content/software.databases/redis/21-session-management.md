---
title: "[Redis] 21. 세션 관리 — Spring Session, 멀티 서버 세션"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "session", "spring-session", "JWT", "세션관리", "고가용성"]
---

# 세션 관리 — Spring Session, 멀티 서버 세션

## 세션 관리의 문제

```
서버 1대:
  클라이언트 → 서버 1 → 로컬 세션 저장 → 정상

서버 여러 대 (로드밸런서):
  로그인: 클라이언트 → 서버 1 → 세션 저장
  다음 요청: 클라이언트 → 서버 2 → 세션 없음! → 로그인 필요

해결책:
  1. Sticky Session: 같은 서버로만 라우팅 (단일 장애점)
  2. 세션 복제: 모든 서버에 세션 동기화 (비효율)
  3. Redis 중앙 세션 저장소 (권장)
```

---

## Redis 세션 직접 구현

```kotlin
// 세션 서비스
@Service
class SessionService(private val redis: StringRedisTemplate) {

    private val sessionTtl = Duration.ofHours(2)

    fun create(userId: Long, role: String): String {
        val sessionId = UUID.randomUUID().toString()
        val sessionKey = "session:$sessionId"

        redis.opsForHash<String, String>().putAll(
            sessionKey,
            mapOf(
                "userId" to userId.toString(),
                "role" to role,
                "createdAt" to Instant.now().toString(),
                "lastAccessAt" to Instant.now().toString(),
            )
        )
        redis.expire(sessionKey, sessionTtl)

        return sessionId
    }

    fun get(sessionId: String): Session? {
        val sessionKey = "session:$sessionId"
        val data = redis.opsForHash<String, String>().entries(sessionKey)
        if (data.isEmpty()) return null

        // 마지막 접근 시각 업데이트 + TTL 갱신
        redis.opsForHash<String, String>().put(
            sessionKey, "lastAccessAt", Instant.now().toString()
        )
        redis.expire(sessionKey, sessionTtl)

        return Session(
            sessionId = sessionId,
            userId = data["userId"]!!.toLong(),
            role = data["role"]!!,
        )
    }

    fun delete(sessionId: String) {
        redis.delete("session:$sessionId")
    }

    fun deleteAllForUser(userId: Long) {
        // 사용자의 모든 세션 삭제 (Set으로 세션 목록 관리)
        val userSessionsKey = "user-sessions:$userId"
        val sessionIds = redis.opsForSet().members(userSessionsKey) ?: return
        sessionIds.forEach { redis.delete("session:$it") }
        redis.delete(userSessionsKey)
    }
}
```

---

## Spring Session Redis

Spring Session은 `HttpSession`을 Redis에 자동으로 저장.

### 의존성

```kotlin
// build.gradle.kts
implementation("org.springframework.session:spring-session-data-redis")
implementation("org.springframework.boot:spring-boot-starter-data-redis")
```

### 설정

```yaml
# application.yml
spring:
  session:
    store-type: redis
    redis:
      namespace: "spring:session"      # Redis 키 prefix
      flush-mode: on-save              # on-save(기본) 또는 immediate
      save-mode: on-set-attribute      # always, on-set-attribute, on-get-attribute
    timeout: 7200s                     # 세션 만료 시간 (2시간)
  data:
    redis:
      host: localhost
      port: 6379
```

```kotlin
// @EnableRedisHttpSession 활성화
@SpringBootApplication
@EnableRedisHttpSession(
    maxInactiveIntervalInSeconds = 7200,
    redisNamespace = "myapp:session"
)
class Application
```

### 사용 (기존 코드 변경 없음)

```kotlin
@RestController
class AuthController {

    @PostMapping("/login")
    fun login(
        @RequestBody request: LoginRequest,
        session: HttpSession,
    ): ResponseEntity<*> {
        val user = authService.authenticate(request.email, request.password)

        // HttpSession에 저장 → 자동으로 Redis에 저장됨
        session.setAttribute("userId", user.id)
        session.setAttribute("role", user.role)
        session.setAttribute("email", user.email)

        return ResponseEntity.ok(LoginResponse(sessionId = session.id))
    }

    @PostMapping("/logout")
    fun logout(session: HttpSession) {
        session.invalidate()  // Redis에서 세션 삭제
    }

    @GetMapping("/me")
    fun me(session: HttpSession): ResponseEntity<*> {
        val userId = session.getAttribute("userId") as? Long
            ?: return ResponseEntity.status(401).build<Any>()

        return ResponseEntity.ok(userService.get(userId))
    }
}
```

### Redis에 저장되는 구조

```
spring:session:sessions:<sessionId>
  → Hash {
      sessionAttr:userId = 1001,
      sessionAttr:role = "admin",
      creationTime = 1700000000000,
      lastAccessedTime = 1700003600000,
      maxInactiveInterval = 7200,
    }

spring:session:expirations:<roundedExpiry>
  → Set { <sessionId> }

spring:session:sessions:expires:<sessionId>
  → String (TTL 만료용 더미 키)
```

---

## Spring Session + Cookie 설정

```kotlin
@Bean
fun cookieSerializer(): CookieSerializer {
    return DefaultCookieSerializer().apply {
        setCookieName("SESSION")
        setCookiePath("/")
        setDomainNamePattern("^.+?\\.(.+\\.[a-z]+)$")  // 서브도메인 공유
        setCookieMaxAge(7200)
        setUseSecureCookie(true)   // HTTPS만
        setUseHttpOnlyCookie(true) // JavaScript 접근 불가
        setSameSite("Strict")
    }
}
```

---

## Spring Session + Spring Security

```kotlin
@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        return http
            .sessionManagement { session ->
                session
                    .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                    .maximumSessions(5)  // 동시 세션 최대 5개
                    .maxSessionsPreventsLogin(false)  // 초과 시 이전 세션 만료
                    .sessionRegistry(sessionRegistry())
            }
            .build()
    }

    @Bean
    fun sessionRegistry(): SessionRegistry {
        return SpringSessionBackedSessionRegistry(
            FindByIndexNameSessionRepository(/* Spring Session Repository */)
        )
    }
}
```

---

## 세션 + Index (사용자별 세션 조회)

```kotlin
// build.gradle.kts
// Spring Session은 FindByIndexNameSessionRepository 지원

// 사용자 ID로 세션 인덱싱
session.setAttribute(
    FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME,
    userId.toString()
)

// 특정 사용자의 모든 세션 조회
@Autowired
lateinit var sessionRepository: FindByIndexNameSessionRepository<*>

fun getSessionsByUser(userId: Long): Map<String, *> {
    return sessionRepository.findByPrincipalName(userId.toString())
}

// 특정 사용자 강제 로그아웃 (모든 세션 삭제)
fun forceLogout(userId: Long) {
    val sessions = sessionRepository.findByPrincipalName(userId.toString())
    sessions.keys.forEach { sessionId ->
        sessionRepository.deleteById(sessionId)
    }
}
```

---

## 세션 vs JWT

| | Redis 세션 | JWT |
|--|-----------|-----|
| 저장 위치 | 서버(Redis) | 클라이언트 |
| 무효화 | 즉시 (Redis DEL) | 어려움 (블랙리스트 필요) |
| 서버 부하 | Redis 조회 필요 | 서명 검증만 (DB 없음) |
| 크기 | 작은 쿠키(세션 ID) | JWT 크기만큼 (수백 바이트) |
| 수평 확장 | Redis 필요 | 상태 없음 |
| 실시간 권한 변경 | 즉시 반영 | 토큰 만료 전까지 유지 |

**혼합 패턴**:
```
Access Token (JWT, 15분) + Refresh Token (Redis, 7일)

로그인 → Access + Refresh 발급
API 요청 → Access Token 검증 (Redis 없이 빠름)
Access 만료 → Refresh로 새 Access 발급
로그아웃 → Redis에서 Refresh Token 삭제 (즉시 무효화)
```

---

## 정리

- **Spring Session**: `@EnableRedisHttpSession` + `HttpSession` 그대로 사용
- **세션 공유**: Redis 중앙 저장 → 모든 서버가 같은 세션 접근
- **강제 로그아웃**: `FindByIndexNameSessionRepository`로 사용자별 세션 조회/삭제
- **JWT + Redis Refresh**: Access는 JWT(빠름), Refresh는 Redis(무효화 가능)
