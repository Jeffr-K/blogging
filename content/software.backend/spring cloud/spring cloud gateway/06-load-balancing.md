---
title: "Spring Cloud Gateway: 로드 밸런싱과 서비스 디스커버리"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "load-balancing", "eureka"]
---

# Spring Cloud Gateway: 로드 밸런싱과 서비스 디스커버리

## lb:// URI 스킴 동작 원리

`lb://service-name` URI를 사용하면 Spring Cloud LoadBalancer가 서비스 디스커버리에서 인스턴스 목록을 조회하고, 로드 밸런싱 알고리즘에 따라 하나를 선택합니다.

```
요청 흐름:
1. 클라이언트 → Gateway: GET /api/orders/1
2. Gateway Predicate 매칭: Path=/api/orders/** → order-route (uri: lb://order-service)
3. ReactiveLoadBalancerClientFilter 실행:
   - ServiceInstanceListSupplier.get("order-service") 호출
   - [10.0.0.1:8081, 10.0.0.2:8081, 10.0.0.3:8081] 목록 수신
   - RoundRobinLoadBalancer: 10.0.0.2:8081 선택
   - Exchange URL: lb://order-service → http://10.0.0.2:8081
4. NettyRoutingFilter: GET http://10.0.0.2:8081/api/orders/1 전송
```

### ReactiveLoadBalancerClientFilter

`lb://`를 처리하는 핵심 GlobalFilter입니다.

```java
// 내부 동작 요약 (실제 구현 참고용)
public class ReactiveLoadBalancerClientFilter implements GlobalFilter, Ordered {

    @Override
    public int getOrder() {
        return 10150; // RouteToRequestUrlFilter(10000) 이후, NettyRoutingFilter(MAX_VALUE) 이전
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        URI url = exchange.getAttribute(GATEWAY_REQUEST_URL_ATTR);

        if (url == null || !"lb".equals(url.getScheme())) {
            return chain.filter(exchange); // lb://가 아니면 통과
        }

        String serviceId = url.getHost(); // "order-service"

        // LoadBalancer를 통해 인스턴스 선택
        return choose(exchange, serviceId)
            .flatMap(response -> {
                ServiceInstance instance = response.getServer();
                URI requestUrl = reconstructURI(instance, url);
                exchange.getAttributes().put(GATEWAY_REQUEST_URL_ATTR, requestUrl);
                return chain.filter(exchange);
            });
    }
}
```

---

## 로드 밸런싱 알고리즘 설정

### 라운드 로빈 (기본값)

```yaml
spring:
  cloud:
    loadbalancer:
      configurations: default  # 기본: 라운드 로빈
```

```java
// Java — 명시적 라운드 로빈 설정
@Configuration
@LoadBalancerClient(name = "order-service", configuration = OrderServiceLoadBalancerConfig.class)
public class LoadBalancerConfig {
}

public class OrderServiceLoadBalancerConfig {

    @Bean
    ReactorLoadBalancer<ServiceInstance> roundRobinLoadBalancer(
            Environment environment,
            LoadBalancerClientFactory loadBalancerClientFactory) {

        String name = environment.getProperty(LoadBalancerClientFactory.PROPERTY_NAME);
        return new RoundRobinLoadBalancer(
            loadBalancerClientFactory.getLazyProvider(name, ServiceInstanceListSupplier.class),
            name
        );
    }
}
```

### 랜덤 알고리즘

```java
// Java — 랜덤 로드 밸런서
public class OrderServiceLoadBalancerConfig {

    @Bean
    ReactorLoadBalancer<ServiceInstance> randomLoadBalancer(
            Environment environment,
            LoadBalancerClientFactory loadBalancerClientFactory) {

        String name = environment.getProperty(LoadBalancerClientFactory.PROPERTY_NAME);
        return new RandomLoadBalancer(
            loadBalancerClientFactory.getLazyProvider(name, ServiceInstanceListSupplier.class),
            name
        );
    }
}
```

```yaml
# 전체 서비스에 랜덤 적용
spring:
  cloud:
    loadbalancer:
      configurations: random
```

---

## 커스텀 ReactorServiceInstanceLoadBalancer 구현

가중치 기반, Sticky Session, 최소 연결 수 등 커스텀 알고리즘이 필요할 때 구현합니다.

```java
// Java — 헬스 상태 기반 가중치 로드 밸런서
public class WeightedLoadBalancer implements ReactorServiceInstanceLoadBalancer {

    private final String serviceId;
    private final ObjectProvider<ServiceInstanceListSupplier> supplierObjectProvider;
    private final AtomicInteger position = new AtomicInteger(new Random().nextInt(1000));

    public WeightedLoadBalancer(
            String serviceId,
            ObjectProvider<ServiceInstanceListSupplier> supplierObjectProvider) {
        this.serviceId = serviceId;
        this.supplierObjectProvider = supplierObjectProvider;
    }

    @Override
    public Mono<Response<ServiceInstance>> choose(Request request) {
        ServiceInstanceListSupplier supplier = supplierObjectProvider
            .getIfAvailable(NoopServiceInstanceListSupplier::new);

        return supplier.get(request)
            .next()
            .map(instances -> {
                if (instances.isEmpty()) {
                    return new EmptyResponse();
                }
                return selectInstance(instances);
            });
    }

    private Response<ServiceInstance> selectInstance(List<ServiceInstance> instances) {
        // 가중치 기반 선택 (메타데이터의 weight 값 활용)
        int totalWeight = instances.stream()
            .mapToInt(i -> Integer.parseInt(
                i.getMetadata().getOrDefault("weight", "1")
            ))
            .sum();

        int random = new Random().nextInt(totalWeight);
        int cumulative = 0;

        for (ServiceInstance instance : instances) {
            int weight = Integer.parseInt(
                instance.getMetadata().getOrDefault("weight", "1")
            );
            cumulative += weight;
            if (random < cumulative) {
                return new DefaultResponse(instance);
            }
        }

        return new DefaultResponse(instances.get(0));
    }
}
```

```kotlin
// Kotlin — 간결한 커스텀 로드 밸런서
class WeightedLoadBalancer(
    private val serviceId: String,
    private val supplierObjectProvider: ObjectProvider<ServiceInstanceListSupplier>
) : ReactorServiceInstanceLoadBalancer {

    override fun choose(request: Request<*>): Mono<Response<ServiceInstance>> {
        val supplier = supplierObjectProvider.getIfAvailable { NoopServiceInstanceListSupplier() }

        return supplier.get(request)
            .next()
            .map { instances ->
                if (instances.isEmpty()) EmptyResponse()
                else selectWeighted(instances)
            }
    }

    private fun selectWeighted(instances: List<ServiceInstance>): Response<ServiceInstance> {
        val totalWeight = instances.sumOf { it.metadata["weight"]?.toInt() ?: 1 }
        val rand = (0 until totalWeight).random()
        var cumulative = 0

        for (instance in instances) {
            cumulative += instance.metadata["weight"]?.toInt() ?: 1
            if (rand < cumulative) return DefaultResponse(instance)
        }

        return DefaultResponse(instances.first())
    }
}
```

커스텀 로드 밸런서 등록:

```java
@Configuration
@LoadBalancerClient(name = "order-service", configuration = WeightedLoadBalancerConfig.class)
public class GatewayLoadBalancerConfig {}

class WeightedLoadBalancerConfig {

    @Bean
    public ReactorLoadBalancer<ServiceInstance> weightedLoadBalancer(
            Environment environment,
            LoadBalancerClientFactory factory) {

        String name = environment.getProperty(LoadBalancerClientFactory.PROPERTY_NAME);
        return new WeightedLoadBalancer(
            name,
            factory.getLazyProvider(name, ServiceInstanceListSupplier.class)
        );
    }
}
```

---

## Eureka 연동

### 의존성

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.springframework.cloud:spring-cloud-starter-gateway")
    implementation("org.springframework.cloud:spring-cloud-starter-netflix-eureka-client")
    implementation("org.springframework.cloud:spring-cloud-starter-loadbalancer")
}
```

### application.yml 설정

```yaml
spring:
  application:
    name: api-gateway

  cloud:
    gateway:
      routes:
        - id: order-route
          uri: lb://order-service       # Eureka에 등록된 서비스명
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=1

        - id: user-route
          uri: lb://user-service
          predicates:
            - Path=/api/users/**
          filters:
            - StripPrefix=1

# Eureka 서버 연결 설정
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/
    registry-fetch-interval-seconds: 5   # 인스턴스 목록 갱신 주기 (기본 30초)
    fetch-registry: true
    register-with-eureka: true           # 게이트웨이 자체도 Eureka에 등록

  instance:
    prefer-ip-address: true
    instance-id: ${spring.application.name}:${spring.application.instance_id:${random.value}}
    lease-renewal-interval-in-seconds: 10   # 하트비트 주기
    lease-expiration-duration-in-seconds: 30 # 만료 시간
```

Eureka에 `order-service`가 `10.0.0.1:8081`, `10.0.0.2:8081` 두 인스턴스로 등록되어 있다면, `lb://order-service`는 두 인스턴스에 라운드 로빈으로 분산됩니다.

### Eureka 연동 확인

```bash
# Eureka 서버에서 등록된 서비스 목록 확인
curl http://localhost:8761/eureka/apps | jq '.applications.application[] | {name: .name, instances: [.instance[] | .ipAddr + ":" + (.port."$")]}'
```

---

## Kubernetes 서비스 디스커버리

### 의존성

```kotlin
dependencies {
    implementation("org.springframework.cloud:spring-cloud-starter-gateway")
    implementation("org.springframework.cloud:spring-cloud-starter-kubernetes-client-loadbalancer")
}
```

### application.yml 설정

```yaml
spring:
  application:
    name: api-gateway

  cloud:
    gateway:
      routes:
        # Kubernetes Service 이름으로 직접 연결
        - id: order-route
          uri: lb://order-service    # k8s service name
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=1

    kubernetes:
      discovery:
        all-namespaces: false         # 같은 네임스페이스만 조회
        namespaces:
          - production

    loadbalancer:
      ribbon:
        enabled: false               # Ribbon 비활성화 (Spring Cloud LoadBalancer 사용)
```

Kubernetes에서 `order-service`라는 Service 리소스가 있으면, `lb://order-service`가 해당 Service의 엔드포인트로 라우팅됩니다.

```yaml
# order-service Kubernetes Service 예시
apiVersion: v1
kind: Service
metadata:
  name: order-service
  namespace: production
spec:
  selector:
    app: order-service
  ports:
    - port: 8080
      targetPort: 8080
```

---

## 자동 라우트 생성 (Discovery Locator)

서비스 디스커버리에 등록된 모든 서비스에 대해 라우트를 자동으로 생성합니다. 소규모 프로젝트나 초기 개발 단계에 유용합니다.

### 활성화 설정

```yaml
spring:
  cloud:
    gateway:
      discovery:
        locator:
          enabled: true               # 자동 라우트 생성 활성화
          lower-case-service-id: true # 서비스 ID를 소문자로 변환
```

### 자동 생성 라우트 패턴

`lower-case-service-id: true` 설정 시:
- `ORDER-SERVICE` → `/order-service/**` 경로로 라우트 생성
- URI: `lb://order-service`

`lower-case-service-id: false` (기본값):
- `ORDER-SERVICE` → `/ORDER-SERVICE/**` 경로로 라우트 생성

```bash
# 자동 생성된 라우트 확인
curl http://localhost:8080/actuator/gateway/routes | jq '.[] | select(.route_id | startswith("ReactiveCompositeDiscoveryClient_"))'
```

자동 생성 라우트 ID 형식: `ReactiveCompositeDiscoveryClient_ORDER-SERVICE`

```bash
# 자동 생성 라우트를 통한 요청
# ORDER-SERVICE의 /orders 엔드포인트 호출
curl http://localhost:8080/order-service/orders
```

### 자동 생성 라우트에 필터 추가

Discovery Locator가 생성하는 라우트에는 기본 필터만 적용됩니다. 추가 필터를 적용하려면 `spring.cloud.gateway.default-filters`를 사용합니다.

```yaml
spring:
  cloud:
    gateway:
      # 모든 라우트(자동 생성 포함)에 적용되는 기본 필터
      default-filters:
        - AddRequestHeader=X-Gateway-Source, api-gateway
        - DedupeResponseHeader=Access-Control-Allow-Origin, RETAIN_FIRST
        - name: Retry
          args:
            retries: 2
            statuses: BAD_GATEWAY

      discovery:
        locator:
          enabled: true
          lower-case-service-id: true
          # 자동 생성 라우트에 추가 필터 설정
          filters:
            - name: StripPrefix
              args:
                parts: 1
```

### Discovery Locator 커스터마이징

자동 라우트에 적용될 Predicate와 Filter를 SpEL 표현식으로 커스터마이징할 수 있습니다.

```yaml
spring:
  cloud:
    gateway:
      discovery:
        locator:
          enabled: true
          lower-case-service-id: true
          # 기본 Path Predicate 재정의 (SpEL)
          predicates:
            - name: Path
              args:
                pattern: "'/'+serviceId+'/**'"
          # StripPrefix 필터 추가 (SpEL)
          filters:
            - name: StripPrefix
              args:
                parts: "'1'"
```

---

## 실무 팁

### Discovery Locator는 개발 환경에만

```yaml
# application-dev.yml
spring:
  cloud:
    gateway:
      discovery:
        locator:
          enabled: true

# application-prod.yml
spring:
  cloud:
    gateway:
      discovery:
        locator:
          enabled: false  # 운영에서는 명시적 라우트 사용
```

Discovery Locator는 편리하지만 모든 서비스가 자동으로 노출되므로 보안상 위험합니다. 운영 환경에서는 명시적으로 필요한 라우트만 선언하는 것이 권장됩니다.

### 인스턴스 캐시 갱신 주기 조정

Eureka의 기본 인스턴스 갱신 주기(30초)는 운영 환경에서 느릴 수 있습니다.

```yaml
eureka:
  client:
    registry-fetch-interval-seconds: 5   # 5초로 단축

spring:
  cloud:
    loadbalancer:
      cache:
        ttl: 5s                          # LoadBalancer 캐시 TTL
        capacity: 256
```

### 헬스 체크 기반 인스턴스 필터링

```yaml
spring:
  cloud:
    loadbalancer:
      health-check:
        interval: 10s           # 헬스 체크 주기
        initial-delay: 0
      configurations: health-check   # 헬스 체크 통과한 인스턴스만 사용
```

### 로드 밸런싱 디버깅

```yaml
logging:
  level:
    org.springframework.cloud.gateway: DEBUG
    org.springframework.cloud.loadbalancer: DEBUG
    org.springframework.cloud.netflix.eureka: DEBUG
```

```
DEBUG ReactiveLoadBalancerClientFilter : LoadBalancer has not found instance for order-service
DEBUG RoundRobinLoadBalancer           : Selected [ServiceInstance{serviceId='order-service', host='10.0.0.2', port=8081}]
DEBUG NettyRoutingFilter               : Sending request to http://10.0.0.2:8081/orders/1
```

### Kubernetes에서 Gateway 배포 예시

```yaml
# gateway-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
        - name: api-gateway
          image: myregistry/api-gateway:latest
          ports:
            - containerPort: 8080
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: "prod"
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            initialDelaySeconds: 30
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8080
            initialDelaySeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: production
spec:
  type: LoadBalancer
  selector:
    app: api-gateway
  ports:
    - port: 80
      targetPort: 8080
```

Kubernetes에서는 Gateway가 Ingress Controller를 보완하는 역할을 합니다. Ingress가 외부 트래픽을 Gateway로 전달하면, Gateway가 내부 마이크로서비스로 세밀한 라우팅을 담당하는 구조입니다.

```
외부 트래픽 → Ingress Controller (L7 라우팅, TLS 종료) → Gateway (인증/인가, Rate Limit, 라우팅) → 마이크로서비스
```
