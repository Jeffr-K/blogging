---
title: "Spring Boot: 데이터 액세스 — JPA, Redis, MongoDB"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "jpa", "spring-data", "redis", "mongodb"]
---

# 데이터 액세스

## Spring Data 공통 개념

### Repository 계층

```
Repository<T, ID>                    (마커)
└── CrudRepository<T, ID>            (기본 CRUD)
    └── PagingAndSortingRepository   (페이징/정렬)
        └── JpaRepository<T, ID>     (JPA 특화 + flush, deleteInBatch 등)
```

```java
public interface UserRepository extends JpaRepository<User, Long> {

    // 메서드 이름으로 쿼리 생성
    List<User> findByEmailAndActiveTrue(String email);
    Optional<User> findByEmail(String email);
    long countByStatus(UserStatus status);
    boolean existsByEmail(String email);

    // @Query로 JPQL 직접 작성
    @Query("SELECT u FROM User u WHERE u.createdAt >= :since")
    List<User> findRecentUsers(@Param("since") LocalDateTime since);

    // 네이티브 쿼리
    @Query(value = "SELECT * FROM users WHERE MATCH(name) AGAINST(:keyword)", nativeQuery = true)
    List<User> fullTextSearch(@Param("keyword") String keyword);
}
```

### Auditing

```java
@EntityListeners(AuditingEntityListener.class)
@MappedSuperclass
public abstract class BaseEntity {

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(updatable = false)
    private String createdBy;

    @LastModifiedBy
    private String updatedBy;
}
```

```java
@Configuration
@EnableJpaAuditing
public class JpaConfig {

    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
            .map(Authentication::getName);
    }
}
```

### 페이징

```java
// Page<T>: 전체 개수 포함 (COUNT 쿼리 추가 발생)
Page<User> page = userRepository.findAll(PageRequest.of(0, 20, Sort.by("createdAt").descending()));
page.getContent();      // 현재 페이지 데이터
page.getTotalElements();// 전체 개수
page.getTotalPages();   // 전체 페이지 수

// Slice<T>: 다음 페이지 존재 여부만 (무한 스크롤에 적합)
Slice<User> slice = userRepository.findAll(PageRequest.of(0, 20));
slice.hasNext();        // 다음 페이지 있는지
```

---

## Spring Data JPA

### 기본 엔티티

```java
@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_email", columnList = "email", unique = true)
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserStatus status = UserStatus.ACTIVE;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Order> orders = new ArrayList<>();

    @Builder
    public User(String name, String email) {
        this.name = name;
        this.email = email;
    }
}
```

### N+1 해결

```java
// @EntityGraph로 Fetch Join
@EntityGraph(attributePaths = {"orders", "orders.items"})
List<User> findAllWithOrders();

// @Query로 Fetch Join
@Query("SELECT u FROM User u LEFT JOIN FETCH u.orders WHERE u.id = :id")
Optional<User> findByIdWithOrders(@Param("id") Long id);
```

컬렉션 페이징 + N+1 동시 해결:

```yaml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 100  # IN 쿼리로 한꺼번에 조회
```

---

## DataSource 설정

### HikariCP

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb?useSSL=false&serverTimezone=Asia/Seoul
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
    hikari:
      maximum-pool-size: 10         # 최대 커넥션 수
      minimum-idle: 5               # 최소 유휴 커넥션
      connection-timeout: 30000     # 커넥션 획득 대기 시간 (ms)
      idle-timeout: 600000          # 유휴 커넥션 유지 시간 (ms)
      max-lifetime: 1800000         # 커넥션 최대 수명 (ms)
      pool-name: MyHikariPool
```

### Read/Write 분리

```java
public class RoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
            ? "read" : "write";
    }
}

@Configuration
public class DataSourceConfig {

    @Bean
    public DataSource dataSource() {
        RoutingDataSource routing = new RoutingDataSource();
        routing.setTargetDataSources(Map.of(
            "write", writeDataSource(),
            "read", readDataSource()
        ));
        routing.setDefaultTargetDataSource(writeDataSource());
        return routing;
    }
}
```

---

## 트랜잭션 관리

### @Transactional 전파

```java
@Service
public class OrderService {

    // 읽기 전용 — flush 생략, Dirty Checking 생략
    @Transactional(readOnly = true)
    public List<OrderResponse> findOrders(Long userId) {
        return orderRepository.findByUserId(userId)
            .stream().map(OrderResponse::from).toList();
    }

    // 쓰기 — 기본 전파 REQUIRED
    @Transactional
    public OrderResponse createOrder(Long userId, CreateOrderRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("사용자를 찾을 수 없습니다"));
        Order order = Order.of(user, request.items());
        return OrderResponse.from(orderRepository.save(order));
    }

    // 새 트랜잭션 — 기존 트랜잭션과 독립
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAuditLog(String action, Long userId) {
        auditLogRepository.save(new AuditLog(action, userId));
    }
}
```

### 트랜잭션 전파 비교표

| 전파 | 기존 트랜잭션 있을 때 | 없을 때 |
|---|---|---|
| `REQUIRED` (기본) | 참여 | 새로 생성 |
| `REQUIRES_NEW` | 중단 후 새로 생성 | 새로 생성 |
| `SUPPORTS` | 참여 | 없이 실행 |
| `MANDATORY` | 참여 | 예외 발생 |
| `NEVER` | 예외 발생 | 없이 실행 |
| `NESTED` | 중첩 트랜잭션 | 새로 생성 |

### rollbackFor

```java
@Transactional(rollbackFor = Exception.class)  // Checked Exception도 롤백
public void processPayment(PaymentRequest request) throws PaymentException {
    // ...
}
```

기본적으로 `RuntimeException`과 `Error`만 롤백된다. `Checked Exception`은 `rollbackFor`를 명시해야 한다.

---

## DB 마이그레이션

### Flyway

```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true  # 기존 DB에 Flyway 처음 도입 시
```

파일 네이밍: `V{버전}__{설명}.sql`

```sql
-- V1__create_users_table.sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- V2__add_users_index.sql
CREATE INDEX idx_users_status ON users(status);
```

---

## Spring Data Redis

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password: ${REDIS_PASSWORD:}
      lettuce:
        pool:
          max-active: 8
          max-idle: 8
          min-idle: 0
```

```java
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        return template;
    }
}
```

```java
@Service
public class SessionStore {

    private final RedisTemplate<String, Object> redisTemplate;

    public void save(String key, Object value, Duration ttl) {
        redisTemplate.opsForValue().set(key, value, ttl);
    }

    public Optional<Object> get(String key) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(key));
    }

    public void delete(String key) {
        redisTemplate.delete(key);
    }
}
```

### Pub/Sub

```java
@Configuration
public class RedisPubSubConfig {

    @Bean
    public RedisMessageListenerContainer listenerContainer(
        RedisConnectionFactory factory,
        MessageListenerAdapter listenerAdapter
    ) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener(listenerAdapter, new PatternTopic("order.*"));
        return container;
    }

    @Bean
    public MessageListenerAdapter listenerAdapter(OrderEventHandler handler) {
        return new MessageListenerAdapter(handler, "handleMessage");
    }
}
```
