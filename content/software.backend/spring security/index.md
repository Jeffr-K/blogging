# Spring Security 완전 학습 인덱스

---

## 1. 개요 & 아키텍처

### Spring Security란?
- 인증(Authentication) vs 인가(Authorization) 개념 구분
- Spring Security가 해결하는 문제들
- Spring Boot와의 자동 구성 (`SecurityAutoConfiguration`)
- Spring Security 5.x → 6.x 주요 변화 (Lambda DSL 필수, Deprecated API 제거)

### 핵심 아키텍처
- `Filter` → `DelegatingFilterProxy` → `FilterChainProxy` 흐름
- `SecurityFilterChain` — 필터 체인 선택 기준 (`requestMatcher`)
- 복수 `SecurityFilterChain` 등록 (`@Order`)
- `SecurityContext` / `SecurityContextHolder` — ThreadLocal 기반 인증 정보 저장
- `SecurityContextRepository` — 요청 간 SecurityContext 유지 방법

### 빌트인 필터 실행 순서
- `SecurityContextHolderFilter`
- `UsernamePasswordAuthenticationFilter`
- `BasicAuthenticationFilter`
- `BearerTokenAuthenticationFilter`
- `ExceptionTranslationFilter` — 인증/인가 예외를 HTTP 응답으로 변환
- `AuthorizationFilter` — 최종 접근 제어

---

## 2. SecurityFilterChain 설정

### Lambda DSL (Spring Security 6.x)
- `http.authorizeHttpRequests(auth -> auth...)` 방식
- `WebSecurityConfigurerAdapter` 제거 이후의 `@Bean` 방식
- `HttpSecurity` 빌더 주요 메서드 목록
- `SecurityFilterChain` 빈 반환 패턴

### URL 기반 접근 제어
- `requestMatchers()` — Ant Pattern, MVC Pattern, Regex
- `.permitAll()` / `.authenticated()` / `.hasRole()` / `.hasAuthority()`
- `.hasAnyRole()` / `.hasAnyAuthority()`
- `.access(AuthorizationManager)` — 커스텀 접근 제어
- 규칙 순서의 중요성 (더 구체적인 규칙 먼저)

### 공개 엔드포인트 처리
- `requestMatchers(...).permitAll()` vs `WebSecurity.ignoring()`
- `permitAll()`은 필터를 통과하지만 인증 없이 접근 허용
- `ignoring()`은 필터 체인 자체를 건너뜀 (Spring Security 6에서 사용 자제 권장)

---

## 3. 인증 (Authentication)

### 인증 처리 흐름
- `AuthenticationFilter` → `AuthenticationManager`
- `ProviderManager` — 여러 `AuthenticationProvider` 위임
- `AuthenticationProvider` — 실제 인증 로직
- `UserDetailsService.loadUserByUsername()` 호출 흐름
- 인증 성공 → `SecurityContextHolder`에 저장

### UserDetails & UserDetailsService
- `UserDetails` 인터페이스 구현 — `getAuthorities()`, `isEnabled()` 등
- `UserDetailsService` 인터페이스 구현
- `UserDetailsManager` — 사용자 생성/수정/삭제 (`JdbcUserDetailsManager`)
- `InMemoryUserDetailsManager` — 개발/테스트용
- 커스텀 `UserDetails` 구현 (추가 필드 포함)

### Form 로그인
- `http.formLogin()` 설정
- 커스텀 로그인 페이지 (`loginPage`, `loginProcessingUrl`)
- `defaultSuccessUrl` / `failureUrl`
- `RememberMe` 토큰 설정 (`rememberMeParameter`, `tokenValiditySeconds`)
- `AuthenticationSuccessHandler` / `AuthenticationFailureHandler` 커스터마이징

### HTTP Basic 인증
- `http.httpBasic()` 설정
- `BasicAuthenticationEntryPoint` 커스터마이징
- Stateless API에서의 Basic 인증 활용

### 로그아웃
- `http.logout()` 설정
- `logoutUrl`, `logoutSuccessUrl`
- `invalidateHttpSession`, `deleteCookies`, `clearAuthentication`
- `LogoutSuccessHandler` 커스터마이징

---

## 4. JWT 인증

### JWT 개요
- JWT 구조 (Header.Payload.Signature)
- Access Token / Refresh Token 전략
- Stateless 인증에서 JWT의 역할
- JWT 서명 알고리즘 (HS256, RS256, ES256)

### jjwt 라이브러리 (0.12.x)
- 토큰 생성 (`Jwts.builder()`)
- 토큰 검증 (`Jwts.parser()`)
- 서명 키 관리 (`SecretKey`, `KeyPair`)
- Claims 파싱 및 커스텀 클레임

### 커스텀 JWT 필터 구현
- `OncePerRequestFilter` 상속
- `Authorization: Bearer <token>` 헤더 파싱
- 토큰 검증 → `UsernamePasswordAuthenticationToken` 생성
- `SecurityContextHolder`에 인증 정보 저장
- 필터 체인에 등록 (`addFilterBefore`)

### Refresh Token 전략
- Refresh Token 저장소 (Redis / DB)
- Access Token 만료 감지 → Refresh Token으로 재발급
- Refresh Token Rotation (재발급 시 기존 토큰 폐기)
- Token Revocation (블랙리스트 패턴)

---

## 5. OAuth2 / OIDC

### OAuth2 개념
- Authorization Code Flow — 웹 서비스 표준
- Client Credentials Flow — 서버 간 통신
- PKCE (Proof Key for Code Exchange) — 모바일/SPA
- Implicit Flow (deprecated)
- OAuth2 vs OIDC 차이 (`id_token`, UserInfo Endpoint)

### OAuth2 로그인 클라이언트 (`spring-security-oauth2-client`)
- `spring.security.oauth2.client.registration.*` 설정
- Google, GitHub, Kakao, Naver 등 Provider 설정
- `ClientRegistrationRepository` 자동 구성
- `OAuth2LoginAuthenticationFilter` 동작 흐름
- `OAuth2AuthorizedClientService` — 토큰 관리
- `DefaultOAuth2User` → 커스텀 `OAuth2UserService`

### OAuth2 Resource Server
- `spring-security-oauth2-resource-server`
- `http.oauth2ResourceServer(oauth2 -> oauth2.jwt(...))` 설정
- `JwtDecoder` — 자체 발급(SecretKey) vs JWKS URI (Authorization Server)
- `JwtAuthenticationConverter` — JWT Claim → `GrantedAuthority` 변환
- Opaque Token 검증 (Introspection Endpoint)

### Authorization Server (Spring Authorization Server)
- `spring-authorization-server` 라이브러리
- Authorization Server 기본 설정
- Client 등록 (`RegisteredClient`)
- `JWKSource` — 서명 키 설정
- Token Customizer — 커스텀 Claim 추가

---

## 6. 메서드 보안 (Method Security)

### @EnableMethodSecurity
- `@EnableMethodSecurity` (Spring 6.x) vs `@EnableGlobalMethodSecurity` (5.x 이하)
- `prePostEnabled`, `securedEnabled`, `jsr250Enabled` 옵션
- AOP 기반 동작 원리

### @PreAuthorize / @PostAuthorize
- SpEL 표현식 기반 인가
- `hasRole('ADMIN')` / `hasAuthority('READ_ORDER')`
- `authentication.name` — 현재 인증 사용자
- `#param` — 메서드 파라미터 참조
- `@PostAuthorize("returnObject.ownerId == authentication.name")` — 반환값 기반 검증

### @Secured
- 단순 역할 기반 접근 제어
- `@Secured("ROLE_ADMIN")` — `ROLE_` prefix 필수
- `@PreAuthorize` 대비 제한적 표현식

### @RolesAllowed (JSR-250)
- `jsr250Enabled = true` 필요
- `@RolesAllowed("ADMIN")` — `ROLE_` prefix 불필요
- `@PermitAll` / `@DenyAll`

### 계층 권한 (RoleHierarchy)
- `ROLE_ADMIN > ROLE_MANAGER > ROLE_USER` 설정
- `RoleHierarchyImpl` 빈 등록
- URL 접근 제어 + 메서드 보안 모두 적용

---

## 7. 비밀번호 인코딩

### PasswordEncoder
- `BCryptPasswordEncoder` — 기본 권장 (cost factor 설정)
- `Argon2PasswordEncoder` — 메모리 하드 해시
- `SCryptPasswordEncoder`
- `Pbkdf2PasswordEncoder`
- `NoOpPasswordEncoder` — 테스트 전용 (절대 운영 사용 금지)

### DelegatingPasswordEncoder
- 여러 알고리즘 동시 지원 (`{bcrypt}$2a$...`, `{argon2}...`)
- 알고리즘 마이그레이션 전략 — 로그인 시 자동 업그레이드
- `PasswordEncoderFactories.createDelegatingPasswordEncoder()`

---

## 8. CSRF 보호

### CSRF 공격 원리
- Cross-Site Request Forgery — 의도치 않은 상태 변경 요청
- SameSite Cookie 정책과 CSRF 관계
- CSRF 토큰이 필요한 상황 / 불필요한 상황

### Spring Security CSRF 설정
- 기본 활성화 상태
- `CsrfTokenRepository` — 세션 기반 vs 쿠키 기반 (`CookieCsrfTokenRepository`)
- `csrf.disable()` — REST API(Stateless JWT)에서 비활성화
- `X-CSRF-TOKEN` 헤더 / `_csrf` 파라미터 전송 방법
- SPA(React/Vue)와 CSRF 토큰 연동 패턴

---

## 9. CORS 설정

### CORS 동작 원리
- 브라우저의 SOP(Same-Origin Policy)
- Preflight 요청 (OPTIONS)
- Simple Request vs Preflight Request 조건

### Spring Security에서 CORS 설정
- `http.cors(cors -> cors.configurationSource(...))` 방식
- `CorsConfigurationSource` 빈 등록
- `allowedOrigins` / `allowedMethods` / `allowedHeaders` / `allowCredentials`
- `@CrossOrigin` 어노테이션과의 우선순위
- Spring MVC `WebMvcConfigurer.addCorsMappings()` vs Spring Security CORS 처리 순서

---

## 10. 세션 관리

### 세션 전략
- `SessionCreationPolicy.ALWAYS` / `IF_REQUIRED` / `NEVER` / `STATELESS`
- Stateless API (JWT)에서 `STATELESS` 설정
- `HttpSession` 기반 SecurityContext 저장

### 동시 세션 제어
- `http.sessionManagement().maximumSessions(1)` — 최대 세션 수 제한
- `maxSessionsPreventsLogin(true)` — 초과 시 신규 로그인 차단
- `SessionRegistry` — 활성 세션 목록 관리
- 세션 고정 공격(Session Fixation) 방어 (`changeSessionId`, `newSession`)

### 세션 클러스터링
- `HttpSessionEventPublisher` 등록 (Spring Session 연동 필요)
- Spring Session + Redis 분산 세션
- `@EnableRedisHttpSession`

---

## 11. 인증 예외 처리

### ExceptionTranslationFilter
- `AuthenticationException` → 401 / 로그인 페이지 리다이렉트
- `AccessDeniedException` → 403 / 접근 거부 페이지
- `AuthenticationEntryPoint` — 미인증 요청 처리 커스터마이징
- `AccessDeniedHandler` — 인가 실패 처리 커스터마이징

### REST API 예외 응답
- JSON 형식 에러 응답 반환 (`HttpServletResponse.setStatus()`)
- `AuthenticationEntryPoint` — 401 JSON 반환
- `AccessDeniedHandler` — 403 JSON 반환
- Spring MVC `@ExceptionHandler`와의 차이점 (필터 레이어 예외)

---

## 12. 멀티 SecurityFilterChain

### 여러 FilterChain 등록
- `@Order`로 우선순위 지정
- `securityMatcher()`로 적용 경로 분리
- 예: `/api/**` — JWT Stateless, `/admin/**` — 세션 기반

### 실전 패턴
- API 서버 + 관리자 페이지 분리
- 공개 API vs 인증 필요 API 분리
- Actuator 전용 보안 체인

---

## 13. 테스트

### @WithMockUser
- `roles`, `authorities`, `username` 설정
- 커스텀 `UserDetails`가 필요한 경우 `@WithUserDetails`
- `@WithAnonymousUser` — 익명 사용자 테스트

### @WithSecurityContext
- 커스텀 `SecurityContext` 설정이 필요한 경우
- `WithSecurityContextFactory` 구현
- OAuth2 인증 컨텍스트 설정

### MockMvc + Spring Security
- `@WebMvcTest` + `@Import(SecurityConfig.class)`
- `SecurityMockMvcRequestPostProcessors` — `csrf()`, `jwt()`, `user()`
- `jwt().jwt(builder -> builder.claim(...))` — JWT 인증 시뮬레이션
- `.with(csrf())` — CSRF 토큰 자동 첨부

### WebTestClient + Spring Security
- `SecurityMockServerConfigurers` — WebFlux 보안 테스트
- `.mutateWith(csrf())` / `.mutateWith(mockJwt())`

---

## 14. 실전 설계 패턴

### 권한 체계 설계
- Role vs Authority 구분 (`ROLE_` prefix 규칙)
- 계층적 권한 설계 (RBAC)
- 세밀한 권한 제어 (ABAC — Attribute-Based)
- DB 기반 동적 권한 설정

### 멀티 테넌트 보안
- 테넌트 ID 기반 데이터 접근 제어
- `@PostAuthorize`를 이용한 소유권 검증
- 테넌트 컨텍스트 ThreadLocal 관리

### 감사 로깅 (Audit Logging)
- `ApplicationEventPublisher`로 인증 이벤트 수신
- `AuthenticationSuccessEvent` / `AbstractAuthenticationFailureEvent`
- 로그인 실패 카운트 & 계정 잠금 구현
- `AbstractSecurityInterceptorEvent` — 인가 이벤트

### Spring Security 성능
- SecurityContext 저장소 선택 (`HttpSessionSecurityContextRepository` vs `RequestAttributeSecurityContextRepository`)
- 불필요한 세션 생성 방지
- `STATELESS` 정책에서의 성능 이점
- Actuator 엔드포인트 보안 최적화

---

## 15. Spring Security 6.x 마이그레이션

### 주요 제거/변경 사항
- `WebSecurityConfigurerAdapter` 완전 제거 → `SecurityFilterChain` 빈 방식
- `authorizeRequests()` → `authorizeHttpRequests()` (필수 변경)
- `antMatchers()` / `mvcMatchers()` → `requestMatchers()` 통합
- `HttpSecurity.and()` 메서드 제거 → 람다 방식만 지원
- `@EnableGlobalMethodSecurity` → `@EnableMethodSecurity`
- `UseAuthorizationFilter` 기본 활성화 → `FilterSecurityInterceptor` 제거

### 기본 보안 강화
- 기본적으로 모든 요청 인증 필요 (명시적 `permitAll` 필요)
- `SecurityFilterChain`에 `requestMatcher` 지정 없으면 전체 적용
- CSRF SameSite Cookie 기본값 변경
