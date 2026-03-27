---
title: "Spring Boot: 의존성 주입과 Bean 관리"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "dependency-injection", "bean", "ioc"]
---

# 의존성 주입과 Bean 관리

## Spring IoC 컨테이너

IoC(Inversion of Control)란 **객체 생성과 의존성 연결의 제어권을 개발자가 아닌 프레임워크가 가지는 것**이다.

전통적인 방식:
```java
// 개발자가 직접 생성 및 연결
UserRepository repository = new UserRepositoryImpl(dataSource);
UserService service = new UserServiceImpl(repository);
```

IoC 방식:
```java
// Spring이 알아서 생성하고 주입
@Service
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {  // Spring이 주입
        this.userRepository = userRepository;
    }
}
```

### ApplicationContext 계층

```
ApplicationContext
├── AnnotationConfigApplicationContext        (일반 Spring)
└── AnnotationConfigServletWebServerApplicationContext  (Spring Boot 웹)
    └── WebApplicationContext  (요청 범위 빈 포함)
```

---

## Bean 생명주기

```
1. 인스턴스화  (new UserService())
2. 의존성 주입 (setRepository() 또는 생성자)
3. @PostConstruct 메서드 실행  ← 초기화 로직
4. 빈 사용
5. @PreDestroy 메서드 실행    ← 소멸 전 정리
6. 소멸
```

### BeanPostProcessor

모든 빈의 초기화 전후에 가로채는 확장 포인트. AOP 프록시 생성이 이 방식으로 동작한다.

```java
@Component
public class LoggingBeanPostProcessor implements BeanPostProcessor {

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        // @PostConstruct 실행 전
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        // @PostConstruct 실행 후 — 여기서 프록시로 교체 가능
        return bean;
    }
}
```

---

## Bean 등록 방식

### 스테레오타입 어노테이션

```java
@Component    // 일반 컴포넌트
@Service      // 서비스 레이어 (비즈니스 로직)
@Repository   // 데이터 액세스 레이어 (예외 변환 추가)
@Controller   // 웹 레이어
@RestController // @Controller + @ResponseBody
```

`@Service`와 `@Repository`는 `@Component`의 특수화다. 기능적 차이는 없지만 역할을 명확히 표현하고, `@Repository`는 JPA 예외를 Spring 예외로 변환해준다.

### @Bean 메서드

```java
@Configuration
public class AppConfig {

    @Bean
    public ObjectMapper objectMapper() {
        return Jackson2ObjectMapperBuilder.json()
            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .modules(new JavaTimeModule())
            .build();
    }

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
            .connectTimeout(Duration.ofSeconds(5))
            .readTimeout(Duration.ofSeconds(30))
            .build();
    }
}
```

서드파티 라이브러리 클래스처럼 소스를 수정할 수 없는 경우에 `@Bean` 방식을 사용한다.

---

## 의존성 주입 방식

### 생성자 주입 (권장)

```java
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentService paymentService;
    private final EventPublisher eventPublisher;

    // Spring이 자동으로 호출
    public OrderService(
        OrderRepository orderRepository,
        PaymentService paymentService,
        EventPublisher eventPublisher
    ) {
        this.orderRepository = orderRepository;
        this.paymentService = paymentService;
        this.eventPublisher = eventPublisher;
    }
}
```

Lombok으로 더 간결하게:

```java
@Service
@RequiredArgsConstructor  // final 필드에 대한 생성자 자동 생성
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentService paymentService;
    private final EventPublisher eventPublisher;
}
```

**생성자 주입을 권장하는 이유:**
- `final` 필드로 불변성 보장
- 테스트에서 순수 Java로 의존성 주입 가능 (`new OrderService(mockRepo, ...)`)
- 순환 의존성이 **컴파일 타임**에 감지됨
- 필수 의존성을 명시적으로 표현

### 세터 주입

```java
@Service
public class NotificationService {

    private EmailSender emailSender;

    @Autowired(required = false)  // 선택적 의존성
    public void setEmailSender(EmailSender emailSender) {
        this.emailSender = emailSender;
    }
}
```

선택적 의존성(없어도 동작하는 경우)에만 사용한다.

### 필드 주입 (비권장)

```java
@Service
public class BadService {

    @Autowired  // 권장하지 않음
    private UserRepository userRepository;
}
```

**문제점:**
- `final` 불가 → 불변성 보장 안 됨
- 테스트 시 리플렉션 없이는 주입 불가
- 순환 의존성이 런타임에만 발견됨

---

## @Qualifier와 @Primary

같은 타입의 빈이 여러 개일 때 어떤 것을 주입할지 지정한다.

```java
@Component("mysqlDataSource")
public class MySQLDataSource implements DataSource { ... }

@Component("h2DataSource")
public class H2DataSource implements DataSource { ... }
```

```java
// @Qualifier로 이름 지정
@Service
public class UserService {
    public UserService(@Qualifier("mysqlDataSource") DataSource dataSource) { ... }
}

// @Primary로 기본 빈 지정
@Component
@Primary
public class MySQLDataSource implements DataSource { ... }
```

---

## Bean 스코프

### singleton (기본)

컨테이너당 1개. 모든 요청에서 동일한 인스턴스.

```java
@Component
// @Scope("singleton")  // 기본값이라 생략 가능
public class UserService { }
```

### prototype

주입받을 때마다 새 인스턴스 생성.

```java
@Component
@Scope("prototype")
public class ReportBuilder {
    private List<String> lines = new ArrayList<>(); // 상태가 있는 객체
}
```

> **주의**: prototype 빈은 Spring이 소멸까지 관리하지 않는다. `@PreDestroy`가 호출되지 않는다.

### 웹 스코프

```java
@Component
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class RequestContext {
    private final String requestId = UUID.randomUUID().toString();
}
```

- `request`: HTTP 요청마다 새 인스턴스
- `session`: HTTP 세션마다 새 인스턴스
- `application`: ServletContext 당 1개

`proxyMode = ScopedProxyMode.TARGET_CLASS`가 필요한 이유: `@Service`는 singleton인데 request scope 빈을 주입받으려면 프록시를 통해야 한다.

---

## 초기화 & 소멸 콜백

### @PostConstruct / @PreDestroy (권장)

```java
@Component
public class CacheManager {

    private Map<String, Object> cache;

    @PostConstruct
    public void init() {
        this.cache = new ConcurrentHashMap<>();
        // DB에서 초기 데이터 로드
    }

    @PreDestroy
    public void cleanup() {
        cache.clear();
        // 리소스 정리
    }
}
```

### @Bean 방식

```java
@Bean(initMethod = "start", destroyMethod = "stop")
public MyConnectionPool connectionPool() {
    return new MyConnectionPool();
}
```

### SmartLifecycle — 시작/종료 순서 제어

여러 컴포넌트의 시작/종료 순서가 중요할 때 사용한다.

```java
@Component
public class MessageConsumer implements SmartLifecycle {

    private boolean running = false;

    @Override
    public void start() {
        // 메시지 소비 시작
        running = true;
    }

    @Override
    public void stop() {
        // 메시지 소비 중단
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public int getPhase() {
        return 100;  // 숫자가 낮을수록 먼저 시작, 나중에 종료
    }
}
```

---

## 실무 팁

**순환 의존성 해결**: A → B → A 처럼 순환 의존성이 생기면 설계를 재검토해야 한다. 불가피하다면 `@Lazy`를 사용할 수 있지만, 근본적인 구조 개선이 바람직하다.

**@Lazy 지연 초기화**: 애플리케이션 시작 시간이 너무 길다면 특정 빈에 `@Lazy`를 붙여 실제 사용 시점에 초기화하게 할 수 있다. 전역 설정은 `spring.main.lazy-initialization=true`.
