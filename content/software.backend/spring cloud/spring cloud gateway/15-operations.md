---
title: "Spring Cloud Gateway: 운영과 Kubernetes 배포"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "kubernetes", "docker", "operations"]
---

# Spring Cloud Gateway: 운영과 Kubernetes 배포

개발이 완료된 Gateway를 실제 운영 환경에 배포하고 유지하는 방법을 다룬다. 헬스 체크, 그레이스풀 셧다운, Docker 이미지 빌드, Kubernetes 배포까지 전체 흐름을 정리한다.

---

## 1. 헬스 체크

### /actuator/health 응답 예시

```json
{
  "status": "UP",
  "components": {
    "discoveryComposite": {
      "status": "UP",
      "components": {
        "eureka": {
          "status": "UP",
          "details": {
            "applications": {
              "USER-SERVICE": 2,
              "ORDER-SERVICE": 1
            }
          }
        }
      }
    },
    "gateway": {
      "status": "UP"
    },
    "redis": {
      "status": "UP"
    },
    "livenessState": {
      "status": "UP"
    },
    "readinessState": {
      "status": "UP"
    }
  }
}
```

### 하위 서비스 상태를 포함한 HealthIndicator

```java
// DownstreamServicesHealthIndicator.java
@Component
public class DownstreamServicesHealthIndicator implements ReactiveHealthIndicator {

    private final WebClient webClient;
    private final List<DownstreamServiceConfig> services;

    public DownstreamServicesHealthIndicator(
            WebClient.Builder webClientBuilder,
            DownstreamServicesProperties properties) {
        this.webClient = webClientBuilder.build();
        this.services = properties.getServices();
    }

    @Override
    public Mono<Health> health() {
        List<Mono<Map.Entry<String, Health>>> checks = services.stream()
                .map(service -> checkService(service)
                        .map(health -> Map.entry(service.getName(), health)))
                .toList();

        return Flux.merge(checks)
                .collectMap(Map.Entry::getKey, Map.Entry::getValue)
                .map(details -> {
                    boolean allUp = details.values().stream()
                            .allMatch(h -> h.getStatus() == Status.UP);
                    Health.Builder builder = allUp ? Health.up() : Health.down();
                    details.forEach(builder::withDetail);
                    return builder.build();
                });
    }

    private Mono<Health> checkService(DownstreamServiceConfig service) {
        return webClient.get()
                .uri(service.getHealthUrl())
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(3))
                .map(body -> Health.up().withDetail("url", service.getHealthUrl()).build())
                .onErrorResume(ex -> Mono.just(
                        Health.down()
                                .withDetail("url", service.getHealthUrl())
                                .withDetail("error", ex.getMessage())
                                .build()));
    }
}
```

### Kubernetes Probe 설정

```yaml
# application.yml
management:
  endpoint:
    health:
      probes:
        enabled: true
      show-details: always
      group:
        liveness:
          include: livenessState
        readiness:
          include: readinessState, redis, gateway

  endpoints:
    web:
      exposure:
        include: health, info, metrics, gateway, prometheus

  health:
    livenessstate:
      enabled: true
    readinessstate:
      enabled: true
```

- **Liveness (`/actuator/health/liveness`)**: 프로세스가 살아있는지 확인. 실패 시 컨테이너를 재시작한다.
- **Readiness (`/actuator/health/readiness`)**: 트래픽을 받을 준비가 되었는지 확인. 실패 시 로드밸런서에서 제외한다.

---

## 2. 그레이스풀 셧다운

### 설정

```yaml
# application.yml
server:
  shutdown: graceful  # 기본값은 immediate

spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s  # 최대 30초 대기 후 강제 종료
```

### 셧다운 흐름

```
1. Kubernetes가 Pod에 SIGTERM 시그널 전송
2. Spring Boot가 readinessState를 REFUSING_TRAFFIC으로 전환
   → Kubernetes가 /readiness 체크 실패를 감지하고 로드밸런서에서 Pod 제거
3. 진행 중인 요청 처리 완료 대기 (최대 timeout-per-shutdown-phase)
4. 모든 요청 완료 (또는 타임아웃) 후 서버 종료
5. 프로세스 정상 종료 (exit code 0)
```

Kubernetes 입장에서 `terminationGracePeriodSeconds`와 Spring의 `timeout-per-shutdown-phase`를 맞춰야 한다.

```yaml
# Kubernetes Deployment
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 60  # Spring timeout보다 여유 있게 설정
      containers:
        - name: gateway
          lifecycle:
            preStop:
              exec:
                # SIGTERM 전에 잠시 대기 (로드밸런서 갱신 시간 확보)
                command: ["/bin/sh", "-c", "sleep 5"]
```

**실무 팁:** Kubernetes의 `terminationGracePeriodSeconds`를 Spring의 `timeout-per-shutdown-phase`보다 10~15초 길게 설정한다. Spring이 셧다운 완료 후 JVM 종료에도 시간이 필요하기 때문이다.

---

## 3. Docker 이미지

### Layered JAR Dockerfile (멀티 스테이지 빌드)

```dockerfile
# Dockerfile
# 1단계: 빌드
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
RUN ./gradlew dependencies --no-daemon   # 의존성 캐싱
COPY src ./src
RUN ./gradlew bootJar --no-daemon

# 2단계: Layered JAR 추출
FROM eclipse-temurin:21-jdk-alpine AS extractor
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# 3단계: 최종 이미지
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# 보안: root가 아닌 사용자로 실행
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Layered JAR 레이어 순서대로 복사 (변경 빈도 낮은 것부터)
COPY --from=extractor /app/dependencies/ ./
COPY --from=extractor /app/spring-boot-loader/ ./
COPY --from=extractor /app/snapshot-dependencies/ ./
COPY --from=extractor /app/application/ ./

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "org.springframework.boot.loader.launch.JarLauncher"]
```

Layered JAR를 사용하면 코드 변경 시 `application` 레이어만 교체하고, 의존성 레이어는 캐시를 재사용한다. CI/CD 빌드 시간이 크게 단축된다.

### Cloud Native Buildpacks 활용

```bash
# build.gradle 설정
bootBuildImage {
    imageName = "registry.example.com/gateway:${version}"
    builder = "paketobuildpacks/builder-jammy-base"
    environment = [
        "BP_JVM_VERSION": "21",
        "BPE_DELIM_JAVA_TOOL_OPTIONS": " ",
        "BPE_APPEND_JAVA_TOOL_OPTIONS": "-XX:MaxRAMPercentage=75.0"
    ]
}
```

```bash
./gradlew bootBuildImage --publishImage
```

### 환경 변수로 설정 주입

```bash
docker run -d \
  -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_REDIS_HOST=redis.internal \
  -e SPRING_REDIS_PORT=6379 \
  -e JWT_SECRET=your-very-long-secret-key \
  -e SPRING_CLOUD_GATEWAY_ROUTES_0_URI=lb://user-service \
  registry.example.com/gateway:1.0.0
```

---

## 4. Kubernetes 배포 전체 예제

### ConfigMap (application.yml)

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: gateway-config
  namespace: backend
data:
  application.yml: |
    server:
      port: 8080
      shutdown: graceful

    spring:
      lifecycle:
        timeout-per-shutdown-phase: 30s
      cloud:
        gateway:
          routes:
            - id: user-service
              uri: lb://user-service
              predicates:
                - Path=/api/users/**
              filters:
                - RewritePath=/api/users/(?<segment>.*), /users/${segment}
            - id: order-service
              uri: lb://order-service
              predicates:
                - Path=/api/orders/**
              filters:
                - RewritePath=/api/orders/(?<segment>.*), /orders/${segment}
      redis:
        host: ${REDIS_HOST}
        port: ${REDIS_PORT:6379}

    management:
      endpoint:
        health:
          probes:
            enabled: true
      endpoints:
        web:
          exposure:
            include: health, info, metrics, prometheus
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
  namespace: backend
  labels:
    app: gateway
    version: "1.0.0"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: gateway
  template:
    metadata:
      labels:
        app: gateway
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: gateway
          image: registry.example.com/gateway:1.0.0
          imagePullPolicy: Always
          ports:
            - containerPort: 8080
              protocol: TCP
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: "prod"
            - name: REDIS_HOST
              value: "redis-service.backend.svc.cluster.local"
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: gateway-secrets
                  key: jwt-secret
          volumeMounts:
            - name: config-volume
              mountPath: /workspace/config
              readOnly: true
          resources:
            requests:
              memory: "256Mi"
              cpu: "200m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8080
            initialDelaySeconds: 20
            periodSeconds: 5
            failureThreshold: 3
            timeoutSeconds: 3
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 5"]
      volumes:
        - name: config-volume
          configMap:
            name: gateway-config
```

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: gateway-service
  namespace: backend
spec:
  type: ClusterIP
  selector:
    app: gateway
  ports:
    - name: http
      port: 80
      targetPort: 8080
      protocol: TCP
```

### HPA (Horizontal Pod Autoscaler)

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gateway-hpa
  namespace: backend
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # 5분 안정화 후 스케일 다운
```

---

## 5. Ingress vs Spring Cloud Gateway

### 역할 비교

```
외부 트래픽
    │
    ▼
┌─────────────────────────────────┐
│  Kubernetes Ingress (L7 라우팅)   │  ← 클러스터 진입점
│  (Nginx, Traefik, AWS ALB 등)    │     도메인/경로 기반 라우팅
└─────────────────┬───────────────┘     TLS 종료
                  │
                  ▼
┌─────────────────────────────────┐
│  Spring Cloud Gateway           │  ← 애플리케이션 레벨 게이트웨이
│  (ClusterIP Service)            │     JWT 인증, Rate Limit
└──────┬──────────────────┬───────┘     서비스 디스커버리, 로드밸런싱
       │                  │
       ▼                  ▼
┌──────────┐        ┌──────────┐
│  User    │        │  Order   │
│  Service │        │  Service │
└──────────┘        └──────────┘
```

| 항목 | Kubernetes Ingress | Spring Cloud Gateway |
|---|---|---|
| 레이어 | L4/L7 네트워크 | 애플리케이션 |
| TLS 종료 | 지원 | 가능하지만 Ingress에서 처리 권장 |
| 인증/인가 | 제한적 | JWT, API Key 등 풍부하게 지원 |
| 트래픽 변환 | 경로 재작성 수준 | 헤더 조작, 바디 변환 |
| Rate Limiting | Nginx Ingress 지원 (제한적) | Redis 기반 정밀 제어 |
| 서비스 디스커버리 | kube-dns 기반 | Eureka, Consul 연동 |

둘을 함께 사용하는 것이 일반적이다. Ingress는 클러스터 진입점(TLS, 도메인 라우팅)을 담당하고, Spring Cloud Gateway는 인증/인가와 서비스 간 라우팅을 담당한다.

---

## 6. 수평 확장 시 고려사항

Spring Cloud Gateway 자체는 **Stateless**하다. 요청마다 JVM 메모리에 상태를 저장하지 않으므로, Pod를 늘리기만 하면 수평 확장이 된다. 단, 함께 사용하는 기능들이 상태를 가지고 있으면 공유 저장소가 필요하다.

### Rate Limit: Redis 공유

```yaml
# 모든 Gateway Pod가 동일한 Redis를 바라봐야 한다
spring:
  redis:
    cluster:
      nodes:
        - redis-node-1:6379
        - redis-node-2:6379
        - redis-node-3:6379
```

단일 Redis가 SPOF(단일 장애점)가 되지 않도록 Redis Cluster 또는 Sentinel 구성을 사용한다.

### 라우트 동기화: DB/Redis 기반 RouteDefinitionRepository

여러 Gateway Pod 간 라우트 설정을 동기화하려면 로컬 메모리 대신 공유 저장소에서 라우트를 로드해야 한다.

```java
// RedisRouteDefinitionRepository.java
@Component
public class RedisRouteDefinitionRepository implements RouteDefinitionRepository {

    private static final String ROUTES_KEY = "gateway:routes";
    private final ReactiveRedisTemplate<String, RouteDefinition> redisTemplate;
    private final ApplicationEventPublisher publisher;

    @Override
    public Flux<RouteDefinition> getRouteDefinitions() {
        return redisTemplate.opsForHash()
                .values(ROUTES_KEY)
                .cast(RouteDefinition.class);
    }

    @Override
    public Mono<Void> save(Mono<RouteDefinition> route) {
        return route.flatMap(r ->
                redisTemplate.opsForHash()
                        .put(ROUTES_KEY, r.getId(), r)
                        .then(Mono.fromRunnable(() ->
                                publisher.publishEvent(new RefreshRoutesEvent(this))))
                        .then());
    }

    @Override
    public Mono<Void> delete(Mono<String> routeId) {
        return routeId.flatMap(id ->
                redisTemplate.opsForHash()
                        .remove(ROUTES_KEY, id)
                        .then(Mono.fromRunnable(() ->
                                publisher.publishEvent(new RefreshRoutesEvent(this))))
                        .then());
    }
}
```

---

## 7. Spring Cloud Config 연동

### bootstrap.yml (Spring Boot 2.4 이전 방식)

```yaml
# bootstrap.yml
spring:
  application:
    name: gateway
  cloud:
    config:
      uri: http://config-server:8888
      fail-fast: true
      retry:
        max-attempts: 6
        initial-interval: 1000
        max-interval: 2000
```

### spring.config.import 방식 (Spring Boot 2.4+)

```yaml
# application.yml
spring:
  application:
    name: gateway
  config:
    import: "configserver:http://config-server:8888"
  cloud:
    config:
      fail-fast: true
```

### Config Server에서 라우트 관리

Config Server의 `gateway.yml` (또는 `gateway-prod.yml`):

```yaml
# Config Server의 gateway.yml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/users/**
          filters:
            - RewritePath=/api/users/(?<segment>.*), /users/${segment}
        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - RewritePath=/api/orders/(?<segment>.*), /orders/${segment}
```

### 라우트 동적 갱신

Config Server의 설정을 변경한 후 Gateway에서 `/actuator/gateway/refresh`를 호출하면 재시작 없이 새 라우트를 적용할 수 있다.

```bash
# 단일 인스턴스 갱신
curl -X POST http://gateway:8080/actuator/refresh

# 이후 Gateway 라우트 갱신
curl -X POST http://gateway:8080/actuator/gateway/refresh

# Spring Cloud Bus를 사용하면 모든 인스턴스에 일괄 갱신 가능
curl -X POST http://gateway:8080/actuator/busrefresh
```

### Spring Cloud Bus 연동 (선택)

여러 Gateway Pod에 동시에 설정 변경을 전파하려면 Spring Cloud Bus를 사용한다.

```yaml
spring:
  cloud:
    bus:
      enabled: true
  rabbitmq:
    host: rabbitmq-service
    port: 5672
```

설정 변경 → Config Server Push Webhook → `/actuator/busrefresh` 호출 → RabbitMQ/Kafka를 통해 모든 Gateway Pod에 `RefreshRemoteApplicationEvent` 전파 → 각 Pod가 설정 갱신.

**실무 팁:** Config Server 연결이 실패할 때 Gateway가 완전히 시작되지 않는 상황을 방지하기 위해 `spring.cloud.config.fail-fast=false`로 설정하거나, Config Server가 항상 먼저 올라오도록 Kubernetes `initContainer`를 활용한다.
