---
title: "Spring Boot: 배포 — Docker, Kubernetes, Native Image"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "docker", "kubernetes", "graalvm", "virtual-threads"]
---

# 배포

## JAR 패키징

### 실행 가능한 FAT JAR

```bash
./gradlew bootJar
# build/libs/myapp-1.0.0.jar — 모든 의존성 포함
java -jar build/libs/myapp-1.0.0.jar
```

### 레이어드 JAR (Docker 최적화)

레이어드 JAR는 Docker 빌드 캐시를 최대한 활용하기 위해 JAR를 여러 레이어로 분리한다.

```kotlin
// build.gradle.kts
tasks.bootJar {
    layered {
        enabled = true
    }
}
```

```bash
# 레이어 확인
java -Djarmode=layertools -jar myapp.jar list
# dependencies
# spring-boot-loader
# snapshot-dependencies
# application  ← 코드 변경 시 이 레이어만 변경됨
```

---

## Docker 멀티 스테이지 빌드

```dockerfile
# Stage 1: 빌드
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY gradlew .
COPY gradle gradle
COPY build.gradle.kts .
COPY settings.gradle.kts .

# 의존성 캐시 (소스 변경 시 재다운로드 방지)
RUN ./gradlew dependencies --no-daemon

COPY src src
RUN ./gradlew bootJar --no-daemon -x test

# Stage 2: 레이어 추출
FROM eclipse-temurin:21-jre-alpine AS extract
WORKDIR /workspace
COPY --from=build /workspace/build/libs/*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# Stage 3: 실행 이미지
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# 비루트 사용자로 실행
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

COPY --from=extract /workspace/dependencies/ ./
COPY --from=extract /workspace/spring-boot-loader/ ./
COPY --from=extract /workspace/snapshot-dependencies/ ./
COPY --from=extract /workspace/application/ ./

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "org.springframework.boot.loader.launch.JarLauncher"]
```

### Buildpacks (Dockerfile 없이)

```bash
# Spring Boot의 Cloud Native Buildpacks 지원
./gradlew bootBuildImage --imageName=myapp:latest

# Docker Hub에 푸시
./gradlew bootBuildImage --imageName=myrepo/myapp:1.0.0 --publishImage
```

---

## Kubernetes 배포

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
        - name: order-service
          image: myrepo/order-service:1.0.0
          ports:
            - containerPort: 8080
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: "production"
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: password
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8081
            initialDelaySeconds: 30
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8081
            initialDelaySeconds: 60
            periodSeconds: 30
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]  # 우아한 종료 대기
```

### Service & Ingress

```yaml
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app: order-service
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: order-service-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 80
```

### ConfigMap & Secret

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: order-service-config
data:
  application.yml: |
    spring:
      datasource:
        url: jdbc:postgresql://postgres-svc:5432/orderdb
    management:
      endpoints:
        web:
          exposure:
            include: health,prometheus
---
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
stringData:
  password: "my-secure-password"
```

### Kubernetes Probes 설정 (Spring Boot 2.3+)

```yaml
management:
  endpoint:
    health:
      probes:
        enabled: true
  health:
    livenessstate:
      enabled: true
    readinessstate:
      enabled: true
```

- `/actuator/health/liveness` — JVM이 살아있는가? (OOM 등 치명적 오류 감지)
- `/actuator/health/readiness` — 트래픽을 받을 수 있는가? (DB 연결, 초기화 완료)

---

## 우아한 종료 (Graceful Shutdown)

```yaml
server:
  shutdown: graceful  # 기본값: immediate

spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s  # 최대 대기 시간
```

SIGTERM 수신 시 동작:
1. 새 요청 수락 중단 (readiness → OUT_OF_SERVICE)
2. 진행 중인 요청 완료 대기 (최대 30초)
3. 애플리케이션 종료

---

## Virtual Threads (Java 21 + Spring Boot 3.2+)

가상 스레드는 Project Loom에서 도입된 경량 스레드다. I/O 블로킹이 많은 서비스에서 처리량이 크게 향상된다.

```yaml
spring:
  threads:
    virtual:
      enabled: true  # 서블릿 요청 처리를 가상 스레드로
```

설정 하나로 Tomcat 스레드 풀이 가상 스레드로 교체된다. 기존 동기 코드(JDBC, RestTemplate)를 수정 없이 높은 동시성으로 처리할 수 있다.

```java
// @Async도 가상 스레드로 실행
@Bean(name = "taskExecutor")
public Executor taskExecutor() {
    return Executors.newVirtualThreadPerTaskExecutor();
}
```

> **주의**: 가상 스레드와 `synchronized` 블록을 함께 쓰면 성능이 저하될 수 있다 (pinning). ReentrantLock으로 교체를 권장한다.

---

## GraalVM Native Image

JVM 없이 실행되는 네이티브 바이너리로 컴파일한다. 기동 시간이 수백 ms → 수십 ms로 단축되고, 메모리 사용량이 크게 줄어든다.

```kotlin
// build.gradle.kts
plugins {
    id("org.graalvm.buildtools.native") version "0.10.1"
}
```

```bash
# 네이티브 이미지 빌드 (GraalVM 필요, 빌드 시간 오래 걸림)
./gradlew nativeCompile

# 또는 Docker를 통한 빌드 (GraalVM 설치 불필요)
./gradlew bootBuildImage
```

### AOT(Ahead-of-Time) 처리

Spring Boot 3.x는 AOT를 통해 런타임 리플렉션을 컴파일 타임에 처리한다.

```bash
./gradlew processAot  # AOT 힌트 생성
```

### Reflection 힌트 추가

리플렉션이 필요한 클래스는 힌트를 등록해야 한다.

```java
@Configuration
@ImportRuntimeHints(MyRuntimeHints.class)
public class AppConfig { }

public class MyRuntimeHints implements RuntimeHintsRegistrar {

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        hints.reflection()
            .registerType(MyDto.class, MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                MemberCategory.DECLARED_FIELDS);
        hints.resources()
            .registerPattern("templates/*.html");
    }
}
```

### Native Image 한계

| 항목 | 지원 여부 |
|---|---|
| 리플렉션 | 힌트 등록 필요 |
| 동적 프록시 | 제한적 지원 |
| 클래스 로더 | 제한적 |
| JVM 동적 최적화 | 없음 (AOT 최적화만) |

---

## 환경별 배포 전략

```yaml
# application.yml (공통)
spring:
  application:
    name: order-service

---
# application-local.yml
spring:
  config:
    activate:
      on-profile: local
  datasource:
    url: jdbc:h2:mem:testdb

---
# application-production.yml
spring:
  config:
    activate:
      on-profile: production
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
```

```bash
# 환경 변수로 프로파일 지정
SPRING_PROFILES_ACTIVE=production java -jar myapp.jar

# Kubernetes에서
env:
  - name: SPRING_PROFILES_ACTIVE
    value: "production"
```
