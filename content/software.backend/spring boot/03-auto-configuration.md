---
title: "Spring Boot: 자동 구성(Auto Configuration) 완전 이해"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "auto-configuration", "conditional"]
---

# 자동 구성(Auto Configuration) 완전 이해

Spring Boot의 핵심 철학은 **"필요한 것을 자동으로 설정해준다"**는 것이다. 클래스패스에 `spring-boot-starter-web`이 있으면 Tomcat과 DispatcherServlet을 자동으로 설정하고, `spring-boot-starter-data-jpa`가 있으면 DataSource와 EntityManagerFactory를 자동으로 구성한다.

## 동작 원리

### @SpringBootApplication 분해

```java
@SpringBootApplication
// =
@SpringBootConfiguration      // @Configuration과 동일
@EnableAutoConfiguration       // 자동 구성 활성화
@ComponentScan                 // 컴포넌트 스캔
```

`@EnableAutoConfiguration`이 핵심이다. 이 어노테이션이 자동 구성 로딩을 시작한다.

### AutoConfiguration.imports 파일

Spring Boot는 클래스패스에 있는 모든 JAR의 다음 파일을 읽는다:

```
META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

이 파일 안에는 자동 구성 클래스들의 FQCN이 나열되어 있다:

```
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration
org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration
...
```

Spring Boot는 이 클래스들을 로드하고, 각 클래스에 붙은 `@Conditional` 조건을 평가해 실제로 빈을 등록할지 결정한다.

---

## @Conditional 어노테이션 계열

### @ConditionalOnClass

클래스패스에 특정 클래스가 있을 때만 설정 적용.

```java
@AutoConfiguration
@ConditionalOnClass(DataSource.class)  // DataSource 클래스가 있을 때만
public class DataSourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public DataSource dataSource(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().build();
    }
}
```

`spring-boot-starter-jdbc`를 추가하면 `DataSource` 클래스가 클래스패스에 들어오고, 이 자동 구성이 활성화된다.

### @ConditionalOnMissingBean

**해당 타입의 빈이 아직 등록되지 않았을 때만** 빈을 등록한다. 이것이 사용자 정의가 우선시되는 원리다.

```java
@Bean
@ConditionalOnMissingBean(ObjectMapper.class)  // 사용자가 직접 등록하지 않은 경우에만
public ObjectMapper objectMapper() {
    return new ObjectMapper();
}
```

사용자가 직접 `ObjectMapper` 빈을 등록하면 자동 구성의 것은 무시된다.

```java
// 이 빈이 있으면 자동 구성 ObjectMapper는 등록되지 않음
@Bean
public ObjectMapper customObjectMapper() {
    ObjectMapper mapper = new ObjectMapper();
    mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
    return mapper;
}
```

### @ConditionalOnProperty

프로퍼티 값 조건.

```java
@Bean
@ConditionalOnProperty(
    name = "spring.cache.type",
    havingValue = "redis",
    matchIfMissing = false
)
public RedisCacheManager redisCacheManager(RedisConnectionFactory factory) {
    return RedisCacheManager.create(factory);
}
```

### @ConditionalOnWebApplication

웹 환경(서블릿 또는 리액티브)일 때만 적용.

```java
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
```

### 전체 @Conditional 목록

| 어노테이션 | 조건 |
|---|---|
| `@ConditionalOnClass` | 클래스패스에 클래스 존재 |
| `@ConditionalOnMissingClass` | 클래스패스에 클래스 없음 |
| `@ConditionalOnBean` | 컨텍스트에 빈 존재 |
| `@ConditionalOnMissingBean` | 컨텍스트에 빈 없음 |
| `@ConditionalOnProperty` | 프로퍼티 값 조건 |
| `@ConditionalOnResource` | 리소스 파일 존재 |
| `@ConditionalOnWebApplication` | 웹 환경 |
| `@ConditionalOnNotWebApplication` | 비웹 환경 |
| `@ConditionalOnExpression` | SpEL 표현식 |
| `@ConditionalOnJava` | JVM 버전 조건 |
| `@ConditionalOnCloudPlatform` | 클라우드 플랫폼 (Kubernetes 등) |

---

## 자동 구성 디버깅

### --debug 플래그

```bash
java -jar app.jar --debug
# 또는
./gradlew bootRun --args='--debug'
```

실행 시 **Conditions Evaluation Report**가 출력된다:

```
============================
CONDITIONS EVALUATION REPORT
============================

Positive matches:
-----------------
   DataSourceAutoConfiguration matched:
      - @ConditionalOnClass found required classes 'javax.sql.DataSource', 'org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType' (OnClassCondition)

Negative matches:
-----------------
   ActiveMQAutoConfiguration:
      Did not match:
         - @ConditionalOnClass did not find required class 'jakarta.jms.ConnectionFactory' (OnClassCondition)
```

- **Positive matches**: 조건을 만족해서 활성화된 자동 구성
- **Negative matches**: 조건 미충족으로 비활성화된 자동 구성

### /actuator/conditions 엔드포인트

런타임에서도 확인할 수 있다:

```bash
curl http://localhost:8080/actuator/conditions
```

### application.yml 디버그 모드

```yaml
debug: true
```

---

## 자동 구성 제외

특정 자동 구성을 비활성화하고 싶을 때:

```java
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,
    SecurityAutoConfiguration.class
})
public class MyApplication { ... }
```

또는 프로퍼티로:

```yaml
spring:
  autoconfigure:
    exclude:
      - org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
```

---

## 커스텀 Auto Configuration 작성

라이브러리를 만들 때 사용자가 의존성만 추가하면 자동으로 설정되게 하고 싶다면 커스텀 Auto Configuration을 작성한다.

### 1. 자동 구성 클래스 작성

```java
@AutoConfiguration
@ConditionalOnClass(MyService.class)
@EnableConfigurationProperties(MyProperties.class)
public class MyAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public MyService myService(MyProperties properties) {
        return new MyService(properties.getApiUrl(), properties.getTimeout());
    }
}
```

### 2. 프로퍼티 클래스

```java
@ConfigurationProperties(prefix = "my.service")
public class MyProperties {
    private String apiUrl = "http://localhost:8080";
    private Duration timeout = Duration.ofSeconds(30);

    // getters & setters
}
```

### 3. AutoConfiguration.imports 파일 등록

`src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 파일 생성:

```
com.example.mylibrary.MyAutoConfiguration
```

### 4. 순서 제어

```java
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
// 또는
@AutoConfigureBefore(SecurityAutoConfiguration.class)
@AutoConfigureAfter(DataSourceAutoConfiguration.class)
```

### 스타터 구조

실무에서는 두 모듈로 분리한다:

```
my-spring-boot-starter/          (의존성만 가지는 빈 모듈)
  └── pom.xml / build.gradle.kts
      └── depends on: my-spring-boot-autoconfigure

my-spring-boot-autoconfigure/    (실제 자동 구성 코드)
  └── MyAutoConfiguration.java
  └── MyProperties.java
  └── META-INF/spring/...imports
```

---

## 실무 팁

**자동 구성 재정의 패턴**: 자동으로 등록된 빈이 마음에 들지 않으면 같은 타입의 빈을 `@Bean`으로 직접 등록하면 된다. `@ConditionalOnMissingBean` 덕분에 자동 구성 것은 무시된다.

**자동 구성 소스 코드 읽기**: `spring-boot-autoconfigure` JAR 안의 자동 구성 클래스들을 IDE에서 직접 열어보는 것이 Spring Boot 내부를 이해하는 가장 좋은 방법이다.
