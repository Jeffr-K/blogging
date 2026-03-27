---
title: "Spring Boot: 프로젝트 생성과 구조 이해"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "project-structure", "springapplication"]
---

# Spring Boot 프로젝트 생성과 구조 이해

## 프로젝트 생성

### Spring Initializr

[start.spring.io](https://start.spring.io)에서 몇 가지만 선택하면 바로 시작할 수 있다.

- **Project**: Gradle - Kotlin (또는 Maven)
- **Language**: Java (또는 Kotlin)
- **Spring Boot**: 3.x 최신 버전
- **Group**: `com.example`
- **Artifact**: `my-app`
- **Dependencies**: Spring Web, Spring Data JPA, 필요한 것들

ZIP을 다운로드하거나 IDE에서 직접 임포트한다.

IntelliJ IDEA에서는 **File → New Project → Spring Initializr**로 동일하게 생성할 수 있다.

---

### Gradle Wrapper vs Maven Wrapper

프로젝트에 포함된 `gradlew` / `mvnw`를 사용하는 이유는 **Gradle/Maven 버전을 프로젝트에 고정**하기 위해서다. 팀원마다 로컬에 설치된 버전이 달라도 동일한 결과를 보장한다.

```bash
# 빌드
./gradlew build

# 테스트
./gradlew test

# 실행
./gradlew bootRun
```

---

## 프로젝트 구조

```
my-app/
├── gradle/wrapper/
│   └── gradle-wrapper.properties     # Gradle 버전 고정
├── gradlew / gradlew.bat
├── build.gradle.kts
├── settings.gradle.kts
└── src/
    ├── main/
    │   ├── java/com/example/myapp/
    │   │   └── MyAppApplication.java  # 진입점
    │   └── resources/
    │       ├── application.yml        # 설정 파일
    │       ├── static/                # 정적 파일 (CSS, JS, 이미지)
    │       └── templates/             # Thymeleaf 등 뷰 템플릿
    └── test/
        ├── java/com/example/myapp/
        └── resources/
            └── application-test.yml  # 테스트 설정
```

### @SpringBootApplication 위치

`@SpringBootApplication`이 붙은 클래스의 **패키지**가 컴포넌트 스캔의 루트가 된다.

```java
package com.example.myapp;  // 이 패키지와 하위 패키지를 스캔

@SpringBootApplication
public class MyAppApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyAppApplication.class, args);
    }
}
```

`com.example.myapp` 패키지 하위의 `@Component`, `@Service`, `@Repository`, `@Controller` 등이 모두 자동으로 빈으로 등록된다.

> **주의**: `@SpringBootApplication`을 `default` 패키지(패키지 선언 없음)에 두면 모든 클래스를 스캔하려 해서 문제가 생긴다. 반드시 패키지를 선언하자.

---

## SpringApplication.run() 동작 원리

```java
SpringApplication.run(MyAppApplication.class, args);
```

이 한 줄이 실행되면 내부적으로 다음 순서로 동작한다.

```
1. SpringApplication 인스턴스 생성
   └─ 웹 환경 감지 (SERVLET / REACTIVE / NONE)

2. ApplicationContext 생성
   └─ AnnotationConfigServletWebServerApplicationContext (서블릿 환경)

3. Environment 준비
   └─ application.yml, 환경 변수, 커맨드라인 인수 로드

4. Auto Configuration 로드
   └─ META-INF/spring/...AutoConfiguration.imports 파일 읽기
   └─ @Conditional 조건 평가 → 빈 등록

5. 내장 Tomcat 기동
   └─ server.port (기본 8080) 리스닝

6. 애플리케이션 이벤트 발행
   └─ ApplicationStartedEvent
   └─ ApplicationReadyEvent

7. ApplicationRunner / CommandLineRunner 실행
```

### ApplicationRunner / CommandLineRunner

애플리케이션 시작 직후 한 번 실행해야 할 초기화 로직을 여기에 둔다.

```java
@Component
public class DataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;

    public DataInitializer(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.count() == 0) {
            userRepository.save(new User("admin", "admin@example.com"));
        }
    }
}
```

`@Order`로 여러 Runner의 실행 순서를 제어할 수 있다.

---

## resources/ 디렉터리 구조

### application.yml

애플리케이션 설정의 핵심 파일. `application.properties`보다 YAML이 계층 구조 표현에 더 적합하다.

```yaml
spring:
  application:
    name: my-app
  datasource:
    url: jdbc:mysql://localhost:3306/mydb
    username: root
    password: secret

server:
  port: 8080

logging:
  level:
    com.example: DEBUG
```

### static/

`src/main/resources/static/` 아래의 파일은 `http://localhost:8080/파일명`으로 직접 접근된다.

- `static/index.html` → `http://localhost:8080/`
- `static/js/app.js` → `http://localhost:8080/js/app.js`

### templates/

Thymeleaf 등 서버 사이드 렌더링 템플릿 파일을 둔다.

---

## 배너 커스터마이징

`src/main/resources/banner.txt` 파일을 만들면 시작 시 출력되는 배너를 바꿀 수 있다.

```
  __  __         _
 |  \/  |_   _  / \   _ __  _ __
 | |\/| | | | |/ _ \ | '_ \| '_ \
 | |  | | |_| / ___ \| |_) | |_) |
 |_|  |_|\__, /_/   \_\ .__/| .__/
         |___/         |_|   |_|

Spring Boot ${spring-boot.version}
```

배너를 끄려면:

```yaml
spring:
  main:
    banner-mode: off
```

---

## 주요 spring.main.* 설정

```yaml
spring:
  main:
    lazy-initialization: true    # 모든 빈을 필요할 때까지 지연 초기화 (시작 시간 단축)
    banner-mode: off             # 배너 비활성화
    allow-bean-definition-overriding: false  # 동일 이름 빈 중복 등록 방지
```

`lazy-initialization=true`는 시작 시간을 줄이는 데 효과적이지만, 첫 요청 시 빈이 초기화되면서 응답이 느려질 수 있다. 개발 환경에서는 유용하다.

---

## 종료 코드 커스터마이징

```java
@Component
public class CustomExitCode implements ExitCodeGenerator {

    @Override
    public int getExitCode() {
        // 0 = 정상 종료, 0 이외 = 비정상
        return 0;
    }
}
```

```java
// 프로그래밍 방식으로 종료
int exitCode = SpringApplication.exit(applicationContext, exitCodeGenerator);
System.exit(exitCode);
```
