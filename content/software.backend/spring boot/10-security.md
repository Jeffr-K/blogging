---
title: "Spring Boot: Spring Security 완전 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "spring-security", "jwt", "oauth2"]
---

# Spring Security 완전 가이드

## 아키텍처 이해

```
HTTP 요청
    ↓
DelegatingFilterProxy          (서블릿 컨테이너 → Spring 컨텍스트 연결)
    ↓
FilterChainProxy               (보안 필터 체인 관리)
    ↓
SecurityFilterChain            (필터 목록)
    ├── SecurityContextPersistenceFilter
    ├── UsernamePasswordAuthenticationFilter (Form 로그인)
    ├── JwtAuthenticationFilter (커스텀)
    ├── ExceptionTranslationFilter
    └── FilterSecurityInterceptor (인가)
    ↓
Controller
```

### 인증 흐름

```
UsernamePasswordAuthenticationFilter
    ↓
AuthenticationManager.authenticate(token)
    ↓
AuthenticationProvider (DaoAuthenticationProvider)
    ↓
UserDetailsService.loadUserByUsername(username)
    ↓
UserDetails 반환 → 비밀번호 검증
    ↓
Authentication 객체 생성 → SecurityContext 저장
```

---

## SecurityFilterChain 설정 (Spring Security 6.x)

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // @PreAuthorize 등 메서드 보안 활성화
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)  // REST API는 CSRF 불필요
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, e) -> {
                    response.setStatus(HttpStatus.UNAUTHORIZED.value());
                    response.getWriter().write("{\"error\": \"인증이 필요합니다\"}");
                })
                .accessDeniedHandler((request, response, e) -> {
                    response.setStatus(HttpStatus.FORBIDDEN.value());
                    response.getWriter().write("{\"error\": \"권한이 없습니다\"}");
                })
            )
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
        throws Exception {
        return config.getAuthenticationManager();
    }
}
```

---

## JWT 완전 구현

```kotlin
// build.gradle.kts
implementation("io.jsonwebtoken:jjwt-api:0.12.5")
runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.5")
runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.5")
```

### JwtTokenProvider

```java
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.access-token-expire:3600000}")    // 1시간
    private long accessTokenExpire;

    @Value("${jwt.refresh-token-expire:604800000}")  // 7일
    private long refreshTokenExpire;

    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(Long userId, String email, List<String> roles) {
        return Jwts.builder()
            .subject(email)
            .claim("userId", userId)
            .claim("roles", roles)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + accessTokenExpire))
            .signWith(getSigningKey())
            .compact();
    }

    public String generateRefreshToken(Long userId) {
        return Jwts.builder()
            .subject(userId.toString())
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + refreshTokenExpire))
            .signWith(getSigningKey())
            .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public boolean isTokenValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String getEmail(String token) {
        return parseToken(token).getSubject();
    }

    @SuppressWarnings("unchecked")
    public List<String> getRoles(String token) {
        return (List<String>) parseToken(token).get("roles");
    }
}
```

### JwtAuthenticationFilter

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);

        if (token != null && jwtTokenProvider.isTokenValid(token)) {
            String email = jwtTokenProvider.getEmail(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(email);

            UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities()
                );
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
```

### 인증 엔드포인트

```java
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserService userService;
    private final RedisTemplate<String, String> redisTemplate;

    @PostMapping("/login")
    public TokenResponse login(@RequestBody @Valid LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        String accessToken = jwtTokenProvider.generateAccessToken(
            principal.getId(), principal.getEmail(), principal.getRoleNames()
        );
        String refreshToken = jwtTokenProvider.generateRefreshToken(principal.getId());

        // Refresh Token Redis 저장 (7일)
        redisTemplate.opsForValue().set(
            "refresh:" + principal.getId(), refreshToken, Duration.ofDays(7)
        );

        return new TokenResponse(accessToken, refreshToken);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@RequestBody RefreshRequest request) {
        if (!jwtTokenProvider.isTokenValid(request.refreshToken())) {
            throw new BusinessException("유효하지 않은 리프레시 토큰입니다");
        }
        // Redis에서 토큰 검증 후 새 Access Token 발급
        // ...
    }
}
```

---

## 메서드 보안

```java
@Service
public class OrderService {

    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.principal.id")
    public List<Order> findOrdersByUser(Long userId) {
        return orderRepository.findByUserId(userId);
    }

    @PostAuthorize("returnObject.userId == authentication.principal.id")
    public Order findById(Long id) {
        return orderRepository.findById(id).orElseThrow();
    }

    @PreAuthorize("hasAuthority('ORDER_WRITE')")
    public Order createOrder(CreateOrderRequest request) { ... }
}
```

---

## CORS 설정

```java
@Configuration
public class CorsConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://myapp.com", "http://localhost:3000"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization", "X-Request-Id"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
```

SecurityFilterChain에 적용:

```java
.cors(cors -> cors.configurationSource(corsConfigurationSource()))
```

---

## OAuth2 Resource Server

외부 인증 서버(Keycloak, Auth0 등)에서 발급한 JWT를 검증한다.

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          jwk-set-uri: https://auth.example.com/.well-known/jwks.json
```

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        .oauth2ResourceServer(oauth2 -> oauth2
            .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
        )
        .build();
}

@Bean
public JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtGrantedAuthoritiesConverter converter = new JwtGrantedAuthoritiesConverter();
    converter.setAuthoritiesClaimName("roles");  // JWT 클레임 이름
    converter.setAuthorityPrefix("ROLE_");

    JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
    jwtConverter.setJwtGrantedAuthoritiesConverter(converter);
    return jwtConverter;
}
```

---

## 비밀번호 인코딩

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);  // strength: 4~31, 기본 10
}

// 회원가입
String encoded = passwordEncoder.encode(rawPassword);

// 로그인 검증
boolean matches = passwordEncoder.matches(rawPassword, encodedPassword);
```

### DelegatingPasswordEncoder (알고리즘 마이그레이션)

```java
// 여러 알고리즘을 혼용할 때 (기존 MD5 → BCrypt 전환 등)
@Bean
public PasswordEncoder passwordEncoder() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
}

// 저장 형식: {bcrypt}$2a$10$...
```
