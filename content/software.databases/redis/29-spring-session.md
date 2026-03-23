---
title: "[Redis] 29. Spring Session — HttpSession을 Redis로"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "spring-session", "session", "HttpSession", "세션클러스터링"]
---

# Spring Session — HttpSession을 Redis로

## 의존성

```kotlin
// build.gradle.kts
implementation("org.springframework.session:spring-session-data-redis")
implementation("org.springframework.boot:spring-boot-starter-data-redis")
implementation("org.springframework.boot:spring-boot-starter-web")
```

---

## 설정

### application.yml

```yaml
spring:
  session:
    store-type: redis
    redis:
      namespace: "myapp:session"   # Redis 키 prefix
      flush-mode: on-save          # on-save | immediate
      save-mode: on-set-attribute  # always | on-set-attribute | on-get-attribute
      cleanup-cron: "0 * * * * *"  # 만료 세션 정리 (매 분)
    timeout: 7200s                 # 세션 만료 시간
  data:
    redis:
      host: localhost
      port: 6379
```

```kotlin
@EnableRedisHttpSession(
    maxInactiveIntervalInSeconds = 7200,  // 2시간
    redisNamespace = "myapp:session",
)
@Configuration
class SessionConfig {

    // 세션 쿠키 설정
    @Bean
    fun cookieSerializer(): CookieSerializer {
        return DefaultCookieSerializer().apply {
            setCookieName("SESSION")
            setCookiePath("/")
            setUseSecureCookie(true)
            setUseHttpOnlyCookie(true)
            setSameSite("Strict")
            setCookieMaxAge(7200)
        }
    }
}
```

---

## 기본 사용

```kotlin
@RestController
class AuthController(
    private val authService: AuthService,
) {

    @PostMapping("/login")
    fun login(
        @RequestBody request: LoginRequest,
        session: HttpSession,
    ): LoginResponse {
        val user = authService.authenticate(request.email, request.password)

        // 세션에 저장 → Redis에 자동 저장
        session.setAttribute("userId", user.id)
        session.setAttribute("role", user.role)
        session.setAttribute("email", user.email)

        return LoginResponse(
            userId = user.id,
            sessionId = session.id,
        )
    }

    @PostMapping("/logout")
    fun logout(session: HttpSession) {
        session.invalidate()  // Redis에서 세션 삭제
    }

    @GetMapping("/me")
    fun me(session: HttpSession): UserResponse {
        val userId = session.getAttribute("userId") as? Long
            ?: throw UnauthorizedException()

        return userService.get(userId).toResponse()
    }
}
```

---

## 세션 보안

```kotlin
// 로그인 성공 시 세션 ID 재생성 (Session Fixation 방지)
@PostMapping("/login")
fun login(
    request: HttpServletRequest,
    @RequestBody loginRequest: LoginRequest,
): LoginResponse {
    val user = authService.authenticate(loginRequest.email, loginRequest.password)

    // 기존 세션 무효화 후 새 세션 생성
    val oldSession = request.getSession(false)
    val oldAttributes = oldSession?.let {
        it.attributeNames.asSequence().associateWith { name -> it.getAttribute(name) }
    }
    oldSession?.invalidate()

    val newSession = request.getSession(true)
    oldAttributes?.forEach { (name, value) -> newSession.setAttribute(name, value) }

    newSession.setAttribute("userId", user.id)
    newSession.setAttribute("role", user.role)

    return LoginResponse(userId = user.id)
}
```

---

## 사용자별 세션 관리

```kotlin
// application.yml 추가
spring:
  session:
    redis:
      namespace: "myapp:session"
```

```kotlin
@Configuration
class SessionConfig {

    // FindByIndexNameSessionRepository 활성화
    @Bean
    fun sessionRepository(
        connectionFactory: RedisConnectionFactory,
        defaultSerializer: RedisSerializer<Any>?,
    ): FindByIndexNameSessionRepository<RedisSession> {
        return RedisIndexedSessionRepository(
            RedisTemplate<String, Any>().apply {
                setConnectionFactory(connectionFactory)
                afterPropertiesSet()
            }
        ).also {
            it.setDefaultMaxInactiveInterval(Duration.ofHours(2))
            it.setRedisKeyNamespace("myapp:session")
        }
    }
}
```

```kotlin
@Service
class SessionManagementService(
    private val sessionRepository: FindByIndexNameSessionRepository<*>,
) {

    // 로그인 시 세션에 사용자 인덱스 추가
    fun setUserIndex(session: HttpSession, userId: Long) {
        session.setAttribute(
            FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME,
            userId.toString()
        )
    }

    // 특정 사용자의 모든 세션 조회
    fun getUserSessions(userId: Long): Map<String, *> {
        return sessionRepository.findByPrincipalName(userId.toString())
    }

    // 특정 사용자 강제 로그아웃 (모든 세션 삭제)
    fun forceLogout(userId: Long) {
        val sessions = sessionRepository.findByPrincipalName(userId.toString())
        sessions.keys.forEach { sessionId ->
            sessionRepository.deleteById(sessionId)
        }
        logger.info("강제 로그아웃: userId=$userId, 세션 수=${sessions.size}")
    }

    // 세션 수 제한 (최대 N개 동시 세션)
    fun enforceMaxSessions(userId: Long, maxSessions: Int) {
        val sessions = sessionRepository.findByPrincipalName(userId.toString())
        if (sessions.size >= maxSessions) {
            // 가장 오래된 세션 삭제
            sessions.entries
                .sortedBy { it.value.creationTime }
                .take(sessions.size - maxSessions + 1)
                .forEach { (sessionId, _) ->
                    sessionRepository.deleteById(sessionId)
                }
        }
    }
}
```

---

## Redis에 저장되는 세션 구조

```bash
# 세션 데이터 (Hash)
myapp:session:sessions:<session-id>
  → Hash {
      sessionAttr:userId = 1001,
      sessionAttr:role = "admin",
      creationTime = 1700000000000,
      lastAccessedTime = 1700003600000,
      maxInactiveInterval = 7200,
    }

# 만료 트리거 (더미 키)
myapp:session:sessions:expires:<session-id>
  → "" (TTL 있음)

# 만료 인덱스
myapp:session:expirations:<roundedExpiry>
  → Set { <session-id> }

# 사용자 인덱스 (FindByPrincipalName용)
myapp:session:index:org.springframework.session.FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME:<userId>
  → Set { <session-id-1>, <session-id-2> }
```

---

## 다중 도메인 세션 공유

```kotlin
// 서브도메인 간 세션 공유
@Bean
fun cookieSerializer(): CookieSerializer {
    return DefaultCookieSerializer().apply {
        setCookieName("SESSION")
        // example.com의 모든 서브도메인에서 공유
        setDomainName("example.com")
        // 또는 패턴으로
        setDomainNamePattern("^.+?\\.(.+\\.[a-z]+)$")
    }
}
```

---

## 헤더 기반 세션 (REST API)

```kotlin
// 쿠키 대신 헤더로 세션 ID 전달
@Bean
fun httpSessionStrategy(): HttpSessionIdResolver {
    return HeaderHttpSessionIdResolver.xAuthToken()
    // 요청 헤더: X-Auth-Token: <session-id>
    // 응답 헤더: X-Auth-Token: <session-id>
}
```

---

## 정리

- `@EnableRedisHttpSession`: HttpSession → Redis 자동 저장
- `session.setAttribute(key, value)`: Redis Hash에 저장
- `session.invalidate()`: Redis에서 세션 삭제
- `FindByIndexNameSessionRepository`: 사용자별 세션 조회/삭제
- **세션 고정 방지**: 로그인 시 세션 ID 재생성
- **동시 세션 제한**: `findByPrincipalName` + 오래된 세션 삭제
