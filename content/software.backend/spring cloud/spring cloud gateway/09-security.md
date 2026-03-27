---
title: "Spring Cloud Gateway: 보안 설정 완전 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "security", "jwt", "oauth2"]
---

## 게이트웨이에서 보안을 처리하는 이유

마이크로서비스 각각에 인증/인가 로직을 구현하면 중복 코드가 발생하고 보안 정책 변경 시 모든 서비스를 수정해야 한다. API Gateway에서 보안을 집중 처리하면:

- **단일 책임**: 인증/인가 로직을 한 곳에서 관리
- **일관성**: 모든 서비스에 동일한 보안 정책 적용
- **마이크로서비스 단순화**: 하위 서비스는 비즈니스 로직에만 집중
- **클레임 전파**: 검증된 사용자 정보를 헤더로 하위 서비스에 전달

---

## Spring Security WebFlux 설정

### 의존성

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.springframework.cloud:spring-cloud-starter-gateway")
    implementation("org.springframework.boot:spring-boot-starter-security")
    // JWT Resource Server
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    // OAuth2 Client (TokenRelay 사용 시)
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
}
```

### SecurityWebFilterChain 기본 설정

```kotlin
// SecurityConfig.kt
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity
import org.springframework.security.config.web.server.ServerHttpSecurity
import org.springframework.security.web.server.SecurityWebFilterChain
import org.springframework.security.web.server.authentication.HttpStatusServerEntryPoint
import org.springframework.security.web.server.authorization.HttpStatusServerAccessDeniedHandler
import reactor.core.publisher.Mono

@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http
            .csrf { it.disable() }  // REST API — CSRF 불필요
            .formLogin { it.disable() }
            .httpBasic { it.disable() }
            .authorizeExchange { auth ->
                auth
                    // 인증 불필요 경로
                    .pathMatchers(
                        "/api/auth/**",
                        "/api/public/**",
                        "/actuator/health",
                        "/fallback/**"
                    ).permitAll()
                    // 관리자 전용 경로
                    .pathMatchers("/api/admin/**").hasRole("ADMIN")
                    // 내부 서비스 간 통신 경로
                    .pathMatchers("/internal/**").hasRole("SERVICE")
                    // 나머지는 인증 필요
                    .anyExchange().authenticated()
            }
            // 인증 안 된 요청 → 401 (기본값은 302 리다이렉트)
            .exceptionHandling { exception ->
                exception
                    .authenticationEntryPoint(
                        HttpStatusServerEntryPoint(HttpStatus.UNAUTHORIZED)
                    )
                    .accessDeniedHandler(
                        HttpStatusServerAccessDeniedHandler(HttpStatus.FORBIDDEN)
                    )
            }
            // JWT Resource Server 설정
            .oauth2ResourceServer { oauth2 ->
                oauth2.jwt { jwt ->
                    jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())
                }
            }
            .build()
    }

    @Bean
    fun jwtAuthenticationConverter(): org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverter {
        val converter = org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverter()

        // JWT 클레임 → GrantedAuthority 변환
        val grantedAuthoritiesConverter =
            org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter().apply {
                // "roles" 클레임에서 권한 추출
                setAuthoritiesClaimName("roles")
                // "ROLE_" 접두사 추가
                setAuthorityPrefix("ROLE_")
            }

        converter.setJwtGrantedAuthoritiesConverter(
            org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtGrantedAuthoritiesConverterAdapter(
                grantedAuthoritiesConverter
            )
        )

        return converter
    }
}
```

### JWT Resource Server YAML 설정

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          # Authorization Server의 JWK Set URI (공개키 자동 갱신)
          jwk-set-uri: https://auth.example.com/.well-known/jwks.json
          # 또는 issuer-uri 사용 시 자동으로 jwk-set-uri, token-endpoint 탐색
          # issuer-uri: https://auth.example.com
```

---

## 커스텀 JWT 검증 GlobalFilter

Spring Security의 Resource Server로 처리하기 어려운 경우(레거시 JWT, 커스텀 서명 방식 등)에는 `GlobalFilter`로 직접 구현한다.

```kotlin
// JwtAuthenticationFilter.kt
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

@Component
class JwtAuthenticationFilter(
    private val jwtDecoder: ReactiveJwtDecoder
) : GlobalFilter, Ordered {

    // 인증 불필요 경로
    private val publicPaths = listOf(
        "/api/auth/",
        "/api/public/",
        "/actuator/health",
        "/fallback/"
    )

    override fun getOrder(): Int = -100  // 다른 필터보다 먼저 실행

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val request = exchange.request
        val path = request.path.value()

        // 공개 경로는 통과
        if (publicPaths.any { path.startsWith(it) }) {
            return chain.filter(exchange)
        }

        // Authorization 헤더에서 Bearer 토큰 추출
        val authHeader = request.headers.getFirst(HttpHeaders.AUTHORIZATION)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return unauthorized(exchange, "Authorization 헤더가 없습니다.")
        }

        val token = authHeader.removePrefix("Bearer ").trim()

        return jwtDecoder.decode(token)
            .flatMap { jwt ->
                // 클레임 추출
                val userId = jwt.getClaimAsString("sub")
                    ?: return@flatMap unauthorized(exchange, "sub 클레임이 없습니다.")
                val roles = jwt.getClaimAsStringList("roles") ?: emptyList()
                val email = jwt.getClaimAsString("email") ?: ""
                val plan = jwt.getClaimAsString("plan") ?: "free"

                // 하위 서비스에 사용자 정보 헤더로 전달
                val mutatedRequest = exchange.request.mutate()
                    .header("X-User-Id", userId)
                    .header("X-User-Email", email)
                    .header("X-User-Roles", roles.joinToString(","))
                    .header("X-User-Plan", plan)
                    // 원본 Authorization 헤더 제거 (하위 서비스에서 재검증 방지)
                    // .header(HttpHeaders.AUTHORIZATION, "")  // 필요에 따라 활성화
                    .build()

                chain.filter(exchange.mutate().request(mutatedRequest).build())
            }
            .onErrorResume { error ->
                when {
                    error.message?.contains("expired") == true ->
                        unauthorized(exchange, "토큰이 만료되었습니다.")
                    error.message?.contains("signature") == true ->
                        unauthorized(exchange, "토큰 서명이 유효하지 않습니다.")
                    else ->
                        unauthorized(exchange, "토큰 검증에 실패했습니다.")
                }
            }
    }

    private fun unauthorized(exchange: ServerWebExchange, message: String): Mono<Void> {
        val response = exchange.response
        response.statusCode = HttpStatus.UNAUTHORIZED
        response.headers.add("Content-Type", "application/json")

        val body = """{"error":"Unauthorized","message":"$message"}"""
        val buffer = response.bufferFactory().wrap(body.toByteArray())
        return response.writeWith(Mono.just(buffer))
    }
}
```

---

## OAuth2 TokenRelay

OAuth2 Login이 적용된 게이트웨이에서 Access Token을 하위 서비스에 그대로 전달하는 패턴이다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: resource-service
          uri: lb://resource-service
          predicates:
            - Path=/api/resources/**
          filters:
            # 현재 세션의 Access Token을 Authorization 헤더로 전달
            - TokenRelay=
```

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          keycloak:
            client-id: gateway-client
            client-secret: ${KEYCLOAK_SECRET}
            authorization-grant-type: authorization_code
            scope: openid, profile, email
        provider:
          keycloak:
            issuer-uri: https://keycloak.example.com/realms/myrealm
```

```kotlin
// TokenRelay를 위한 추가 빈 설정
@Configuration
class TokenRelayConfig {

    @Bean
    fun tokenRelayGatewayFilterFactory(
        loadBalancerFactory: ReactiveLoadBalancerExchangeFilterFunction
    ): TokenRelayGatewayFilterFactory {
        return TokenRelayGatewayFilterFactory()
    }
}
```

---

## CORS 설정

### Gateway CORS 설정

```yaml
spring:
  cloud:
    gateway:
      globalcors:
        corsConfigurations:
          '[/**]':
            allowedOrigins:
              - "https://app.example.com"
              - "https://admin.example.com"
            allowedMethods:
              - GET
              - POST
              - PUT
              - DELETE
              - PATCH
              - OPTIONS
            allowedHeaders:
              - "*"
            exposedHeaders:
              - "X-RateLimit-Remaining"
              - "X-Request-Id"
              - "X-Trace-Id"
            allowCredentials: true
            maxAge: 3600

          # 특정 경로에만 다른 CORS 정책 적용
          '[/api/public/**]':
            allowedOrigins: "*"
            allowedMethods:
              - GET
              - OPTIONS
            allowedHeaders:
              - "*"
            allowCredentials: false
```

### Spring Security + Gateway CORS 충돌 해결

Spring Security와 Gateway가 각각 CORS 처리를 하면 응답 헤더가 중복될 수 있다.

```kotlin
@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http
            // Spring Security의 CORS 처리를 Gateway에 위임
            .cors { cors ->
                cors.configurationSource(corsConfigurationSource())
            }
            // ...
            .build()
    }

    @Bean
    fun corsConfigurationSource(): org.springframework.web.cors.reactive.CorsConfigurationSource {
        val config = org.springframework.web.cors.CorsConfiguration().apply {
            allowedOrigins = listOf("https://app.example.com")
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
            maxAge = 3600L
        }
        val source = org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", config)
        return source
    }
}
```

```yaml
# CORS 응답 헤더 중복 제거
spring:
  cloud:
    gateway:
      routes:
        - id: some-service
          uri: lb://some-service
          predicates:
            - Path=/api/**
          filters:
            # 하위 서비스에서 이미 CORS 헤더를 반환하는 경우 중복 제거
            - DedupeResponseHeader=Access-Control-Allow-Origin Access-Control-Allow-Credentials, RETAIN_FIRST
```

---

## SecureHeaders 필터

`SecureHeaders` 필터는 보안 관련 응답 헤더를 자동으로 추가한다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: web-service
          uri: lb://web-service
          predicates:
            - Path=/web/**
          filters:
            - SecureHeaders
```

자동으로 추가되는 헤더:

| 헤더 | 기본값 | 설명 |
|------|--------|------|
| `X-Xss-Protection` | `1 ; mode=block` | XSS 필터 활성화 |
| `Strict-Transport-Security` | `max-age=631138519` | HTTPS 강제 |
| `X-Frame-Options` | `DENY` | 클릭재킹 방지 |
| `X-Content-Type-Options` | `nosniff` | MIME 타입 스니핑 방지 |
| `Referrer-Policy` | `no-referrer` | 리퍼러 정보 전송 안 함 |
| `Content-Security-Policy` | 다양한 제한 | XSS, 코드 인젝션 방지 |
| `X-Download-Options` | `noopen` | IE 파일 직접 실행 방지 |
| `X-Permitted-Cross-Domain-Policies` | `none` | Flash 정책 파일 제한 |

### 헤더 비활성화 및 커스터마이징

```yaml
spring:
  cloud:
    gateway:
      filter:
        secure-headers:
          # 특정 헤더 비활성화
          disable:
            - x-frame-options
            - content-security-policy
          # 커스텀 값으로 덮어쓰기
          content-security-policy: "default-src 'self'; script-src 'self' https://cdn.example.com"
          x-frame-options: "SAMEORIGIN"
          strict-transport-security: "max-age=31536000; includeSubDomains; preload"
```

---

## IP 화이트리스트 패턴

특정 IP에서만 접근을 허용하는 관리자 API 보호 패턴이다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        # 관리자 API — 특정 IP만 허용
        - id: admin-api
          uri: lb://admin-service
          predicates:
            - Path=/api/admin/**
            # 단일 IP
            - RemoteAddr=192.168.1.0/24, 10.0.0.1
          filters:
            - name: CircuitBreaker
              args:
                name: adminServiceCB
                fallbackUri: forward:/fallback/admin

        # VPN IP 대역만 허용
        - id: internal-api
          uri: lb://internal-service
          predicates:
            - Path=/internal/**
            - RemoteAddr=10.0.0.0/8, 172.16.0.0/12
```

### X-Forwarded-For 기반 IP 확인 (리버스 프록시 환경)

```kotlin
// TrustedIpGatewayFilter.kt
import org.springframework.cloud.gateway.filter.GatewayFilter
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import reactor.core.publisher.Mono

@Component
class IpWhitelistGatewayFilterFactory :
    AbstractGatewayFilterFactory<IpWhitelistGatewayFilterFactory.Config>(Config::class.java) {

    data class Config(var allowedIps: List<String> = emptyList())

    override fun apply(config: Config): GatewayFilter {
        return GatewayFilter { exchange, chain ->
            val xForwardedFor = exchange.request.headers.getFirst("X-Forwarded-For")
            val clientIp = xForwardedFor?.split(",")?.firstOrNull()?.trim()
                ?: exchange.request.remoteAddress?.address?.hostAddress

            if (clientIp != null && config.allowedIps.any { clientIp.startsWith(it) }) {
                chain.filter(exchange)
            } else {
                exchange.response.statusCode = HttpStatus.FORBIDDEN
                exchange.response.setComplete()
            }
        }
    }
}
```

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: admin-api-custom
          uri: lb://admin-service
          predicates:
            - Path=/api/admin/**
          filters:
            - name: IpWhitelist
              args:
                allowedIps:
                  - "192.168.1."
                  - "10.0.0."
```

---

## 실무 팁

### 1. 하위 서비스에서 게이트웨이 헤더만 신뢰

게이트웨이가 `X-User-Id` 헤더를 주입한다면, 외부에서 직접 이 헤더를 조작하지 못하도록 게이트웨이에서 원본 헤더를 제거해야 한다.

```yaml
filters:
  # 외부에서 들어온 X-User-Id 헤더 제거 (게이트웨이가 재설정)
  - RemoveRequestHeader=X-User-Id
  - RemoveRequestHeader=X-User-Email
  - RemoveRequestHeader=X-User-Roles
```

### 2. Actuator 엔드포인트 보호

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics
  endpoint:
    health:
      show-details: when-authorized
      roles: ACTUATOR
```

```kotlin
// Actuator 경로는 ACTUATOR 역할만 접근
.pathMatchers("/actuator/**").hasRole("ACTUATOR")
```

### 3. JWT 클레임 검증 강화

```kotlin
// 커스텀 JWT 검증 조건 추가
@Bean
fun jwtDecoder(): ReactiveJwtDecoder {
    val decoder = ReactiveJwtDecoders.fromIssuerLocation(issuerUri)
    // 추가 검증: audience 클레임 확인
    val audienceValidator = JwtClaimValidator<List<String>>("aud") { aud ->
        aud.contains("gateway-api")
    }
    val withAudience = DelegatingOAuth2TokenValidator(
        JwtValidators.createDefaultWithIssuer(issuerUri),
        audienceValidator
    )
    (decoder as NimbusReactiveJwtDecoder).setJwtValidator(withAudience)
    return decoder
}
```

### 4. 보안 헤더 테스트

```bash
# 응답 보안 헤더 확인
curl -I https://api.example.com/api/users/me \
  -H "Authorization: Bearer <token>"

# CORS Preflight 테스트
curl -X OPTIONS https://api.example.com/api/users \
  -H "Origin: https://app.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```
