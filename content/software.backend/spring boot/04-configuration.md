---
title: "Spring Boot: 설정 관리 완전 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "configuration", "profiles", "configurationproperties"]
---

# 설정 관리 완전 가이드

## application.yml vs application.properties

두 형식은 동일한 기능을 제공하지만, YAML이 계층 구조를 표현하기 훨씬 편하다.

```properties
# application.properties
spring.datasource.url=jdbc:mysql://localhost:3306/mydb
spring.datasource.username=root
spring.jpa.hibernate.ddl-auto=validate
```

```yaml
# application.yml (동일 내용)
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb
    username: root
  jpa:
    hibernate:
      ddl-auto: validate
```

YAML의 다중 문서(`---`) 기능으로 프로파일별 설정을 한 파일에 담을 수 있다:

```yaml
spring:
  application:
    name: my-app

---
spring:
  config:
    activate:
      on-profile: dev
  datasource:
    url: jdbc:h2:mem:testdb

---
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: jdbc:mysql://prod-db:3306/mydb
```

---

## 설정 우선순위

Spring Boot는 17가지 설정 소스를 지원하며, 아래로 갈수록 우선순위가 낮다 (위가 이긴다):

| 순위 | 소스 | 예시 |
|---|---|---|
| 1 | 커맨드라인 인수 | `--server.port=9090` |
| 2 | `SPRING_APPLICATION_JSON` | JSON 형태 환경 변수 |
| 3 | ServletConfig init params | 서블릿 설정 |
| 4 | OS 환경 변수 | `SPRING_DATASOURCE_URL=...` |
| 5 | JVM 시스템 프로퍼티 | `-Dserver.port=9090` |
| 6 | `application-{profile}.yml` | `application-prod.yml` |
| 7 | `application.yml` | 기본 설정 파일 |
| 8 | `@PropertySource` | 커스텀 소스 |
| 9 | 기본값 | `@Value("${key:defaultValue}")` |

```bash
# 커맨드라인 인수 (가장 높은 우선순위)
java -jar app.jar --server.port=9090 --spring.profiles.active=prod

# JVM 시스템 프로퍼티
java -Dserver.port=9090 -jar app.jar
```

### 환경 변수 바인딩 규칙

OS 환경 변수는 점(`.`)을 포함할 수 없기 때문에 Spring Boot가 자동으로 변환한다:

| 환경 변수 | 프로퍼티 |
|---|---|
| `SPRING_DATASOURCE_URL` | `spring.datasource.url` |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | `spring.jpa.hibernate.ddl-auto` |
| `SERVER_PORT` | `server.port` |

---

## 프로파일 (Profiles)

### 기본 사용

```yaml
# application-dev.yml
spring:
  datasource:
    url: jdbc:h2:mem:testdb
  jpa:
    show-sql: true

logging:
  level:
    com.example: DEBUG
```

```yaml
# application-prod.yml
spring:
  datasource:
    url: jdbc:mysql://prod-db/mydb
  jpa:
    show-sql: false
```

활성화:

```bash
# 환경 변수
SPRING_PROFILES_ACTIVE=prod java -jar app.jar

# 커맨드라인
java -jar app.jar --spring.profiles.active=prod

# application.yml (기본 프로파일 설정)
spring:
  profiles:
    active: dev  # 개발 시 기본값
```

### @Profile 어노테이션

```java
@Component
@Profile("dev")
public class DevDataInitializer implements ApplicationRunner {
    @Override
    public void run(ApplicationArguments args) {
        // 개발 환경에서만 실행되는 초기화
    }
}
```

### 프로파일 그룹 (Spring Boot 2.4+)

```yaml
spring:
  profiles:
    group:
      production:
        - prod
        - metrics
        - alerts
```

`production` 프로파일 활성화 시 `prod`, `metrics`, `alerts`가 모두 활성화된다.

---

## @ConfigurationProperties

여러 관련 설정을 하나의 클래스로 묶는 타입 안전한 방법.

### 기본 사용

```yaml
# application.yml
app:
  mail:
    host: smtp.gmail.com
    port: 587
    username: myapp@gmail.com
    from: noreply@myapp.com
    retry-attempts: 3
    timeout: 30s
```

```java
@ConfigurationProperties(prefix = "app.mail")
@Validated
public class MailProperties {

    @NotBlank
    private String host;

    @Min(1) @Max(65535)
    private int port = 587;

    private String username;
    private String from;
    private int retryAttempts = 3;

    @DurationUnit(ChronoUnit.SECONDS)
    private Duration timeout = Duration.ofSeconds(30);

    // getters & setters
}
```

### 등록 방법

```java
// 방법 1: @EnableConfigurationProperties
@Configuration
@EnableConfigurationProperties(MailProperties.class)
public class MailConfig { }

// 방법 2: @ConfigurationPropertiesScan (루트 클래스에)
@SpringBootApplication
@ConfigurationPropertiesScan
public class MyApplication { }
```

### Record 기반 (Java 16+)

```java
@ConfigurationProperties(prefix = "app.mail")
public record MailProperties(
    @NotBlank String host,
    int port,
    String username,
    String from
) {
    public MailProperties {
        if (port <= 0) throw new IllegalArgumentException("port must be positive");
    }
}
```

### IDE 자동완성 설정

```kotlin
// build.gradle.kts
annotationProcessor("org.springframework.boot:spring-boot-configuration-processor")
```

이 설정을 추가하면 `application.yml`에서 커스텀 프로퍼티 자동완성이 된다.

---

## @Value

단순 값 하나를 주입할 때 사용한다.

```java
@Component
public class MyService {

    @Value("${app.name}")
    private String appName;

    @Value("${app.timeout:30}")       // 기본값 30
    private int timeout;

    @Value("${app.features.enabled:false}")
    private boolean featureEnabled;

    @Value("#{systemProperties['user.home']}")  // SpEL
    private String userHome;

    @Value("${app.servers}")          // 콤마 구분 리스트
    private List<String> servers;
}
```

### @Value vs @ConfigurationProperties

| 항목 | `@Value` | `@ConfigurationProperties` |
|---|---|---|
| 사용 대상 | 단일 값 | 그룹화된 설정 |
| 타입 검증 | 없음 | `@Validated` 지원 |
| 코드 가독성 | 낮음 (설정 분산) | 높음 (한 클래스로 집중) |
| 테스트 | `@TestPropertySource` 필요 | 일반 생성자로 주입 |
| IDE 지원 | 제한적 | 자동완성 가능 |
| SpEL | 지원 | 미지원 |

3개 이상 관련된 설정이라면 `@ConfigurationProperties`를 쓰는 것이 낫다.

---

## 설정 암호화 (Jasypt)

DB 비밀번호, API 키 같은 민감한 정보를 평문으로 설정 파일에 두면 안 된다.

### 의존성

```kotlin
implementation("com.github.ulisesbocchio:jasypt-spring-boot-starter:3.0.5")
```

### 사용

```bash
# 암호화
java -cp jasypt-1.9.3.jar org.jasypt.intf.cli.JasyptPBEStringEncryptionCLI \
  input="mySecretPassword" password="myEncryptKey" algorithm="PBEWithMD5AndDES"

# 출력: ENC(abc123xyz...)
```

```yaml
spring:
  datasource:
    password: ENC(abc123xyz...)  # 암호화된 값

jasypt:
  encryptor:
    password: ${JASYPT_PASSWORD}  # 환경 변수로 암호화 키 주입
```

운영 환경에서는 `JASYPT_PASSWORD` 환경 변수를 Kubernetes Secret이나 AWS Secrets Manager로 관리한다.
