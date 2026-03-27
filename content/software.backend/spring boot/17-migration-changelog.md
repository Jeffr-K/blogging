---
title: "Spring Boot: 마이그레이션 가이드 & 버전별 변경사항"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "migration", "changelog", "jakarta"]
---

# 마이그레이션 가이드 & 버전별 변경사항

## javax → jakarta 마이그레이션 (Spring Boot 3.0)

Spring Boot 3.0 / Spring Framework 6.0은 Jakarta EE 10을 기반으로 한다. 패키지 이름이 `javax.*`에서 `jakarta.*`로 변경됐다.

### 주요 변경 패키지

| 이전 (javax) | 이후 (jakarta) |
|---|---|
| `javax.servlet.*` | `jakarta.servlet.*` |
| `javax.persistence.*` | `jakarta.persistence.*` |
| `javax.validation.*` | `jakarta.validation.*` |
| `javax.transaction.*` | `jakarta.transaction.*` |
| `javax.annotation.*` | `jakarta.annotation.*` |

### 마이그레이션 방법

**1. OpenRewrite 사용 (권장)**

```kotlin
// build.gradle.kts
plugins {
    id("org.openrewrite.rewrite") version "6.x.x"
}

rewrite {
    activeRecipe("org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_0")
}

dependencies {
    rewrite("org.openrewrite.recipe:rewrite-spring:5.x.x")
}
```

```bash
./gradlew rewriteRun
```

**2. IDE 전체 교체**

IntelliJ: `Find in Files` → `javax.` → `jakarta.` 일괄 치환 후 컴파일 오류 수정.

---

## Spring Security 5 → 6 마이그레이션

### WebSecurityConfigurerAdapter 제거

```java
// ❌ Spring Security 5 (더 이상 사용 불가)
@Configuration
public class SecurityConfig extends WebSecurityConfigurerAdapter {

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.authorizeRequests()
            .antMatchers("/api/public/**").permitAll()
            .anyRequest().authenticated();
    }
}

// ✅ Spring Security 6
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .build();
    }
}
```

### 주요 API 변경

| 이전 (5.x) | 이후 (6.x) |
|---|---|
| `authorizeRequests()` | `authorizeHttpRequests()` |
| `antMatchers()` | `requestMatchers()` |
| `HttpSecurity.and()` | 체이닝 제거, 람다 방식 |
| `WebSecurityCustomizer.ignoring()` | `requestMatchers().permitAll()` |
| `UsernamePasswordAuthenticationFilter` 직접 설정 | `addFilterBefore()` |

### 기본 보안 강화

Spring Security 6에서 기본적으로 강화된 설정:
- CSRF 보호 기본 활성화 (REST API에서는 명시적으로 `disable()` 필요)
- Same-site cookie 기본 `Lax`
- `X-Frame-Options` 기본 `DENY`

---

## Spring Boot 3.0 (2022년 11월)

### 최소 요구사항

- Java 17 (최소)
- Spring Framework 6
- Jakarta EE 10
- Gradle 7.5+ / Maven 3.5+

### 주요 변경사항

**1. AOT(Ahead-of-Time) 엔진 내장**
```bash
./gradlew processAot  # GraalVM Native 빌드를 위한 힌트 생성
./gradlew nativeCompile
```

**2. @ConstructorBinding 불필요**

```java
// ❌ 3.0 이전
@ConfigurationProperties("app")
@ConstructorBinding  // 제거됨
public record AppProperties(String name, int timeout) {}

// ✅ 3.0 이후 — 레코드에는 자동 적용
@ConfigurationProperties("app")
public record AppProperties(String name, int timeout) {}
```

**3. Actuator 엔드포인트 변경**
- `/actuator/health/liveness`, `/actuator/health/readiness` 기본 활성화

---

## Spring Boot 3.1 (2023년 5월)

### @ServiceConnection

```java
// ❌ 3.0: @DynamicPropertySource 필요
@DynamicPropertySource
static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
}

// ✅ 3.1: @ServiceConnection
@Container
@ServiceConnection
static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");
```

### Docker Compose 지원

```yaml
# compose.yml이 있으면 Spring Boot가 자동으로 docker-compose up 실행
spring:
  docker:
    compose:
      lifecycle-management: start-and-stop  # start-only | none
```

### SSL 번들 (인증서 설정 간소화)

```yaml
spring:
  ssl:
    bundle:
      jks:
        mybundle:
          key:
            alias: "myalias"
          keystore:
            location: "classpath:certificate.p12"
            password: "${KEYSTORE_PASSWORD}"
server:
  ssl:
    bundle: mybundle
```

---

## Spring Boot 3.2 (2023년 11월)

### Virtual Threads 공식 지원

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

### RestClient 도입

```java
// WebClient(리액티브)나 RestTemplate(레거시) 대신 새로운 동기 클라이언트
RestClient restClient = RestClient.builder()
    .baseUrl("https://api.example.com")
    .defaultHeader("Authorization", "Bearer " + token)
    .build();

UserResponse user = restClient.get()
    .uri("/users/{id}", userId)
    .retrieve()
    .body(UserResponse.class);
```

### JdbcClient 도입

```java
// JdbcTemplate의 더 유연한 대안
JdbcClient jdbcClient = JdbcClient.create(dataSource);

List<User> users = jdbcClient
    .sql("SELECT * FROM users WHERE status = :status")
    .param("status", "ACTIVE")
    .query(User.class)
    .list();
```

---

## Spring Boot 3.3 (2024년 5월)

### CDS (Class Data Sharing) 지원

JVM 클래스 로딩을 최적화해 기동 시간을 단축한다.

```bash
# CDS 아카이브 생성
java -XX:ArchiveClassesAtExit=app.jsa -Dspring.context.exit=onRefresh -jar app.jar

# CDS 적용 실행
java -XX:SharedArchiveFile=app.jsa -jar app.jar
```

### 구조화 로깅

```yaml
logging:
  structured:
    format:
      console: ecs  # JSON 로그 출력
```

---

## Spring Boot 3.4 (2024년 11월)

### @Fallback

`@Primary` 없이 폴백 빈을 지정한다. 다른 구현체가 없을 때만 사용된다.

```java
@Component
@Fallback  // 다른 PaymentGateway 빈이 있으면 이 빈은 무시됨
public class MockPaymentGateway implements PaymentGateway {
    // 테스트/개발용 구현체
}
```

### MockMvcTester

```java
// 기존 MockMvc보다 간결한 API
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    MockMvcTester mvc;

    @Test
    void getOrder() {
        assertThat(mvc.get().uri("/api/orders/1"))
            .hasStatusOk()
            .bodyJson()
            .hasPathSatisfying("$.id", id -> assertThat(id).isEqualTo(1));
    }
}
```

---

## Gradle 의존성 업그레이드 절차

```bash
# 1. Spring Boot 버전 올리기
# build.gradle.kts
plugins {
    id("org.springframework.boot") version "3.4.0"
}

# 2. Java 버전 확인 (3.x는 최소 17)
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

# 3. 의존성 변경사항 확인
./gradlew dependencies | grep spring

# 4. 컴파일 오류 수정 (주로 javax → jakarta)

# 5. 테스트 실행
./gradlew test

# 6. 통합 테스트
./gradlew integrationTest
```

### 마이그레이션 체크리스트

- [ ] Java 버전 17+ (3.x), 21+ (3.2+ 권장)
- [ ] `javax.*` → `jakarta.*` 전체 교체
- [ ] `WebSecurityConfigurerAdapter` → `SecurityFilterChain` 빈
- [ ] `authorizeRequests()` → `authorizeHttpRequests()`
- [ ] `antMatchers()` → `requestMatchers()`
- [ ] Spring Cloud 버전 호환성 확인 (2022.0.x / 2023.0.x)
- [ ] 서드파티 라이브러리 Jakarta 지원 버전 확인
- [ ] `@ConstructorBinding` 불필요 어노테이션 제거
- [ ] Flyway/Liquibase 버전 업그레이드
