---
title: "Spring Boot: 개요와 핵심 철학"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "overview", "auto-configuration"]
---

## Spring Framework만 쓸 때의 고통

Spring Boot가 등장하기 전, Spring Framework를 사용하는 개발자들은 상당한 설정 부담을 안고 있었다. 단순한 웹 애플리케이션 하나를 만들기 위해서도 아래와 같은 복잡한 XML 파일들을 작성해야 했다.

```xml
<!-- web.xml - 서블릿 컨테이너 진입점 -->
<web-app>
    <servlet>
        <servlet-name>dispatcher</servlet-name>
        <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
        <init-param>
            <param-name>contextConfigLocation</param-name>
            <param-value>/WEB-INF/spring/appServlet/servlet-context.xml</param-value>
        </init-param>
        <load-on-startup>1</load-on-startup>
    </servlet>
    <servlet-mapping>
        <servlet-name>dispatcher</servlet-name>
        <url-pattern>/</url-pattern>
    </servlet-mapping>
    <context-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>/WEB-INF/spring/root-context.xml</param-value>
    </context-param>
    <listener>
        <listener-class>org.springframework.web.context.ContextLoaderListener</listener-class>
    </listener>
</web-app>

<!-- root-context.xml - 공통 Bean 설정 -->
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:tx="http://www.springframework.org/schema/tx">
    <context:component-scan base-package="com.example"/>
    <tx:annotation-driven/>
    <bean id="dataSource" class="org.apache.commons.dbcp2.BasicDataSource">
        <property name="driverClassName" value="com.mysql.cj.jdbc.Driver"/>
        <property name="url" value="jdbc:mysql://localhost:3306/mydb"/>
        <property name="username" value="root"/>
        <property name="password" value="password"/>
    </bean>
    <bean id="entityManagerFactory" class="org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean">
        <property name="dataSource" ref="dataSource"/>
        <!-- ... 계속되는 설정 ... -->
    </bean>
</beans>
```

이런 설정 지옥 외에도 세 가지 핵심 문제가 있었다.

**1. 의존성 충돌 (Dependency Hell)**

Spring MVC, Spring Data, Hibernate, Jackson 등 여러 라이브러리를 수동으로 관리해야 했는데, 버전 간 호환성 문제가 자주 발생했다. `pom.xml`에 수십 개의 의존성을 직접 작성하고, 버전 충돌이 생기면 `mvn dependency:tree`를 뒤져가며 원인을 찾아야 했다.

**2. 내장 서버 없음**

WAR 파일을 만들고, Tomcat이나 JBoss 같은 외부 서버를 별도로 설치·설정·배포해야 했다. 개발 환경과 운영 환경의 서버 버전이 달라 "내 PC에서는 되는데?" 류의 문제가 반복되었다.

**3. 반복적인 보일러플레이트**

프로젝트마다 거의 동일한 설정을 처음부터 다시 작성해야 했다. 트랜잭션 관리, View Resolver, MessageConverter, 예외 처리 등 — 모두 매번 손으로 설정해야 하는 반복 작업이었다.

---

## Spring Boot가 해결한 3가지

### 1. Auto Configuration (자동 구성)

클래스패스에 있는 라이브러리를 감지해 적절한 Bean을 자동으로 등록한다. `spring-webmvc`가 클래스패스에 있으면 `DispatcherServlet`을 자동으로 설정하고, `h2` 드라이버가 있으면 인메모리 데이터소스를 자동으로 생성한다.

개발자는 "이 설정을 이렇게 해줘"가 아니라 "필요한 라이브러리는 이것"이라고만 선언하면 된다.

### 2. Starter 의존성

`spring-boot-starter-web` 하나를 추가하면 Spring MVC, Jackson, Tomcat, 검증 라이브러리 등 웹 개발에 필요한 모든 의존성이 호환 가능한 버전으로 함께 들어온다.

```xml
<!-- 이것 하나로 웹 개발에 필요한 모든 의존성이 해결된다 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

### 3. 내장 서버 (Embedded Server)

Tomcat이 JAR 안에 내장되어 있어 `java -jar myapp.jar` 한 줄로 실행된다. 외부 서버 설치·관리가 필요 없고, 개발/운영 환경의 서버 버전 불일치 문제가 사라진다.

---

## "Convention over Configuration" 철학

Spring Boot의 핵심 철학은 **관례 우선**이다. 합리적인 기본값을 미리 정해놓고, 개발자는 그 관례에서 벗어나는 부분만 명시적으로 설정한다.

예를 들어:
- `src/main/resources/application.yml`에 설정을 쓰면 자동으로 로드된다 — 경로를 따로 지정할 필요 없다
- H2 드라이버가 클래스패스에 있으면 인메모리 DB를 자동으로 사용한다 — 별도 DataSource 설정 불필요
- `spring-boot-starter-web`을 추가하면 포트 8080에서 서버가 뜬다 — 서블릿 설정 불필요

이 철학 덕분에 새 프로젝트를 시작할 때 생산적인 코드를 바로 작성할 수 있다.

---

## Spring Boot vs Spring Framework 직접 사용 비교

| 항목 | Spring Framework 직접 사용 | Spring Boot |
|------|--------------------------|-------------|
| 프로젝트 생성 | 수동 Maven/Gradle 설정 | Spring Initializr (클릭 몇 번) |
| 의존성 관리 | 버전 직접 명시, 충돌 수동 해결 | Starter + BOM으로 호환 버전 자동 관리 |
| 설정 방식 | XML 또는 Java Config (대부분 수동) | 자동 구성 + 최소한의 application.yml |
| 서버 배포 | 외부 WAS 필요 (Tomcat, JBoss 등) | 내장 서버로 JAR 직접 실행 |
| 기본값 | 없음 — 모든 것을 명시해야 함 | 합리적 기본값 제공 |
| 운영 기능 | 직접 구현 | Actuator로 헬스체크, 메트릭 기본 제공 |
| 학습 곡선 | 가파름 (Spring 내부 원리 전체 이해 필요) | 완만함 (필요할 때 깊이 파고들 수 있음) |
| 커스터마이징 | 세밀한 제어 가능 | 자동 구성 제외 + 직접 Bean 등록으로 동일하게 가능 |

Spring Boot는 Spring Framework를 **대체**하는 것이 아니라, Spring Framework 위에서 **생산성을 높여주는 레이어**다. 내부적으로는 동일한 Spring IoC, AOP, MVC를 사용한다.

---

## Spring Boot 3.x 주요 변화

Spring Boot 3.0(2022년 11월)은 여러 중요한 변화를 가져왔다.

### Java 17 베이스라인

Java 8/11 지원이 종료되고 Java 17이 최소 요구사항이 되었다. Record, Sealed Class, Pattern Matching 등 Java 17의 언어 기능을 Spring Boot 전반에서 적극 활용할 수 있게 되었다.

```java
// Java 17+ Record를 @ConfigurationProperties와 함께 사용
@ConfigurationProperties(prefix = "app.server")
public record ServerProperties(String host, int port, boolean ssl) {}
```

### Jakarta EE 10

`javax.*` 패키지가 `jakarta.*`로 전면 이전되었다. 마이그레이션 시 가장 많은 컴파일 에러를 발생시키는 변화다.

```java
// Spring Boot 2.x (javax)
import javax.persistence.Entity;
import javax.validation.constraints.NotNull;
import javax.servlet.http.HttpServletRequest;

// Spring Boot 3.x (jakarta)
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotNull;
import jakarta.servlet.http.HttpServletRequest;
```

### GraalVM Native Image GA

Spring Boot 3.0부터 GraalVM AOT(Ahead-of-Time) 컴파일을 통한 네이티브 이미지 빌드가 정식 지원된다. 시작 시간이 수초에서 수십 밀리초로 단축되고, 메모리 사용량도 대폭 줄어든다.

```bash
# Maven으로 네이티브 이미지 빌드
./mvnw -Pnative native:compile

# 빌드된 바이너리 실행 (JVM 없이!)
./target/myapp
```

### 기타 주요 변화

- **Spring Boot 3.1**: Testcontainers `@ServiceConnection`, Docker Compose 자동 연동
- **Spring Boot 3.2**: 가상 스레드(Virtual Threads) GA, `RestClient` 신규 API, Micrometer Tracing 개선
- **Spring Boot 3.3**: CDS(Class Data Sharing) 지원, 구조화된 로그 출력

---

## 핵심 특징 4가지 상세 설명

### 1. Auto Configuration — 스마트한 자동 빈 등록

자동 구성의 핵심은 `@ConditionalOnClass`, `@ConditionalOnMissingBean` 등 조건부 어노테이션이다. 클래스패스와 기존 Bean 등록 여부를 체크해 필요한 Bean만 등록한다.

```java
// Spring Boot 내부 DataSourceAutoConfiguration 간략화 버전
@AutoConfiguration
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory")
@EnableConfigurationProperties(DataSourceProperties.class)
@Import({ DataSourcePoolMetadataProvidersConfiguration.class,
          DataSourceInitializationConfiguration.class })
public class DataSourceAutoConfiguration {

    @Configuration(proxyBeanMethods = false)
    @Conditional(EmbeddedDatabaseCondition.class)
    @ConditionalOnMissingBean({ DataSource.class, XADataSource.class })
    @Import(EmbeddedDataSourceConfiguration.class)
    protected static class EmbeddedDatabaseConfiguration {
    }

    @Configuration(proxyBeanMethods = false)
    @Conditional(PooledDataSourceCondition.class)
    @ConditionalOnMissingBean({ DataSource.class, XADataSource.class })
    @Import({ DataSourceConfiguration.Hikari.class,
              DataSourceConfiguration.Tomcat.class,
              DataSourceConfiguration.Dbcp2.class })
    protected static class PooledDataSourceConfiguration {
    }
}
```

**핵심 포인트**: `@ConditionalOnMissingBean`은 "이미 같은 타입의 Bean이 등록되어 있으면 자동 구성을 건너뜀"을 의미한다. 즉, 개발자가 직접 `DataSource` Bean을 정의하면 자동 구성이 양보한다. 이것이 Spring Boot 커스터마이징의 기본 패턴이다.

### 2. Starter 의존성 — 의존성 묶음 관리

Starter는 단순히 의존성을 모아놓은 POM이다. `spring-boot-starter-web`의 실제 내용을 보면:

```xml
<!-- spring-boot-starter-web의 내부 의존성 (발췌) -->
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter</artifactId>  <!-- 코어 + 로깅 -->
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-json</artifactId>  <!-- Jackson -->
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-tomcat</artifactId>  <!-- 내장 Tomcat -->
    </dependency>
    <dependency>
        <groupId>org.springframework</groupId>
        <artifactId>spring-webmvc</artifactId>  <!-- Spring MVC -->
    </dependency>
</dependencies>
```

주요 Starter 목록:

| Starter | 포함 내용 |
|---------|----------|
| `spring-boot-starter-web` | Spring MVC, Jackson, 내장 Tomcat |
| `spring-boot-starter-data-jpa` | Spring Data JPA, Hibernate, HikariCP |
| `spring-boot-starter-security` | Spring Security |
| `spring-boot-starter-test` | JUnit 5, Mockito, AssertJ, MockMvc |
| `spring-boot-starter-validation` | Hibernate Validator (Bean Validation) |
| `spring-boot-starter-actuator` | Actuator 엔드포인트 |
| `spring-boot-starter-webflux` | Spring WebFlux, Reactor, 내장 Netty |
| `spring-boot-starter-cache` | Spring Cache 추상화 |
| `spring-boot-starter-mail` | JavaMail API |

### 3. 내장 Tomcat — jar 하나로 실행

Spring Boot의 실행 가능한 JAR(Executable JAR, Fat JAR)는 일반 JAR과 구조가 다르다.

```
myapp.jar
├── BOOT-INF/
│   ├── classes/          ← 내 애플리케이션 클래스
│   │   └── com/example/...
│   └── lib/              ← 모든 의존성 JAR들 (내장 Tomcat 포함)
│       ├── tomcat-embed-core-10.1.x.jar
│       ├── spring-webmvc-6.x.jar
│       └── ...
├── META-INF/
│   └── MANIFEST.MF       ← Main-Class: JarLauncher
└── org/springframework/boot/loader/
    └── JarLauncher.class ← JAR-in-JAR 로더
```

`java -jar myapp.jar`를 실행하면 `JarLauncher`가 BOOT-INF/lib 안의 중첩 JAR들을 로드하는 특수한 ClassLoader를 만들고, 이후 `SpringApplication.run()`이 내장 Tomcat을 시작한다.

```bash
# 빌드
./gradlew bootJar   # 또는 ./mvnw package

# 실행
java -jar build/libs/myapp-0.0.1-SNAPSHOT.jar

# 포트 변경 (커맨드라인 인수가 application.yml보다 우선)
java -jar myapp.jar --server.port=9090

# 프로파일 활성화
java -jar myapp.jar --spring.profiles.active=prod
```

내장 서버를 Jetty나 Undertow로 교체하려면:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <!-- Tomcat 제외 -->
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>

<!-- Jetty로 교체 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jetty</artifactId>
</dependency>
```

### 4. Actuator — 운영 엔드포인트

`spring-boot-starter-actuator`를 추가하면 운영에 필요한 엔드포인트들이 즉시 사용 가능해진다.

```yaml
# application.yml - Actuator 기본 설정
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,loggers  # 노출할 엔드포인트
  endpoint:
    health:
      show-details: when-authorized  # 인증된 사용자에게만 상세 정보 표시
  server:
    port: 8081  # 관리 포트 분리 (운영 환경에서 내부망에서만 접근)
```

주요 엔드포인트:

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /actuator/health` | 헬스 체크 (K8s liveness/readiness probe에 활용) |
| `GET /actuator/info` | 앱 정보 (버전, 빌드 시각 등) |
| `GET /actuator/metrics` | Micrometer 메트릭 목록 |
| `GET /actuator/metrics/{name}` | 특정 메트릭 값 조회 |
| `GET /actuator/env` | 현재 환경 변수 전체 조회 |
| `GET /actuator/beans` | 등록된 Bean 목록 |
| `GET /actuator/mappings` | URL → 핸들러 매핑 목록 |
| `POST /actuator/loggers/{name}` | 런타임 로그 레벨 변경 |

---

## Spring Initializr 사용법

[start.spring.io](https://start.spring.io)에서 프로젝트를 생성한다.

**주요 설정 항목:**

- **Project**: Maven / Gradle (Kotlin DSL or Groovy DSL)
- **Language**: Java / Kotlin / Groovy
- **Spring Boot**: 안정 릴리즈 버전 선택 (현재 3.4.x)
- **Group**: 도메인 역순 (예: `com.example`)
- **Artifact**: 프로젝트 이름 (예: `my-service`)
- **Packaging**: Jar (일반적) / War (레거시 WAS 배포 시)
- **Java**: 17 또는 21 (LTS 권장)
- **Dependencies**: 필요한 Starter 선택

```bash
# Spring Boot CLI로 프로젝트 생성 (선택적)
spring init \
  --dependencies=web,data-jpa,security,actuator,validation \
  --java-version=17 \
  --build=gradle \
  --language=java \
  my-service
```

Gradle Kotlin DSL을 사용하는 `build.gradle.kts` 예시:

```kotlin
plugins {
    id("org.springframework.boot") version "3.4.3"
    id("io.spring.dependency-management") version "1.1.7"
    kotlin("jvm") version "2.1.0"
    kotlin("plugin.spring") version "2.1.0"
    kotlin("plugin.jpa") version "2.1.0"
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    runtimeOnly("com.h2database:h2")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
}
```

---

## 첫 @SpringBootApplication 코드 설명

```java
package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication  // 세 어노테이션의 합성
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

`@SpringBootApplication`은 세 가지 어노테이션의 합성(Composed Annotation)이다:

```java
// @SpringBootApplication의 실제 메타 어노테이션
@SpringBootConfiguration      // 1. @Configuration의 특수 버전
@EnableAutoConfiguration      // 2. 자동 구성 활성화
@ComponentScan                // 3. 컴포넌트 스캔 활성화
public @interface SpringBootApplication {
    // ...
}
```

**@SpringBootConfiguration**: `@Configuration`의 특수 버전으로, 이 클래스가 Bean 정의 소스임을 표시하고 테스트에서 설정 클래스 자동 발견에 사용된다.

**@EnableAutoConfiguration**: `AutoConfigurationImportSelector`를 활성화해 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 파일을 읽고 자동 구성 클래스들을 로드한다.

**@ComponentScan**: `DemoApplication`이 위치한 패키지(`com.example.demo`)와 그 하위 패키지를 스캔해 `@Component`, `@Service`, `@Repository`, `@Controller` 등의 어노테이션이 붙은 클래스를 Bean으로 등록한다.

> 실무 팁: `@SpringBootApplication`이 붙은 클래스는 반드시 패키지 계층 최상단에 위치해야 한다. 예를 들어 컨트롤러가 `com.example.demo.controller`에 있다면, `@SpringBootApplication` 클래스는 `com.example.demo`에 있어야 스캔 범위에 포함된다. 이 클래스를 기본 패키지(`com.example`) 바로 아래에 두면 하위 패키지 전체가 스캔되어 의도치 않은 Bean 등록이 발생할 수 있다.

간단한 REST 컨트롤러를 추가해 전체 동작을 확인해보자:

```java
package com.example.demo.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "Hello, Spring Boot 3!";
    }
}
```

```bash
# 실행
./gradlew bootRun

# 테스트
curl http://localhost:8080/hello
# Hello, Spring Boot 3!
```

Spring Boot가 가진 철학의 핵심은 "개발자가 비즈니스 로직에 집중할 수 있도록 인프라 설정의 복잡성을 숨기는 것"이다. 자동 구성, Starter 의존성, 내장 서버는 모두 이 목표를 위한 수단이다. 이어지는 아티클에서는 각 개념을 더 깊이 파고들어 Spring Boot를 자유자재로 커스터마이징하는 방법을 살펴본다.
