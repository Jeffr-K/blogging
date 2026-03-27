---
title: "Spring Boot: 이벤트, 비동기, 스케줄링"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "events", "async", "scheduling"]
---

# 이벤트, 비동기, 스케줄링

## Spring Application Events

도메인 이벤트를 통해 컴포넌트 간 결합도를 낮출 수 있다. 주문이 생성되면 "알림 발송", "포인트 적립", "재고 감소"를 각각 독립적인 리스너가 처리하게 하는 패턴이다.

### 이벤트 정의

```java
// Spring 4.2+: ApplicationEvent 상속 없이 POJO 이벤트 가능
public record OrderCreatedEvent(Long orderId, Long userId, BigDecimal totalAmount) {}
```

### 이벤트 발행

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final ApplicationEventPublisher eventPublisher;
    private final OrderRepository orderRepository;

    @Transactional
    public Order createOrder(CreateOrderRequest request) {
        Order order = Order.of(request);
        orderRepository.save(order);

        // 트랜잭션 내에서 이벤트 발행
        eventPublisher.publishEvent(new OrderCreatedEvent(
            order.getId(), request.userId(), order.getTotalAmount()
        ));

        return order;
    }
}
```

### 이벤트 리스너

```java
@Component
@RequiredArgsConstructor
public class OrderEventHandler {

    private final NotificationService notificationService;
    private final PointService pointService;

    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        notificationService.sendOrderConfirmation(event.userId(), event.orderId());
    }

    // 여러 이벤트 처리
    @EventListener({OrderCreatedEvent.class, OrderCancelledEvent.class})
    public void updateInventory(Object event) { ... }

    // 조건부 처리 (SpEL)
    @EventListener(condition = "#event.totalAmount > 50000")
    public void awardBonusPoints(OrderCreatedEvent event) {
        pointService.awardBonus(event.userId(), event.totalAmount());
    }
}
```

### @TransactionalEventListener

트랜잭션 결과에 따라 이벤트 처리 시점을 제어한다.

```java
@Component
@RequiredArgsConstructor
public class OrderNotificationHandler {

    private final SlackClient slackClient;
    private final EmailService emailService;

    // 트랜잭션 커밋 후 실행 (기본값)
    // DB 저장이 확실히 완료된 후 알림을 보낼 때 사용
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendOrderConfirmEmail(OrderCreatedEvent event) {
        emailService.sendOrderConfirmation(event.userId(), event.orderId());
    }

    // 트랜잭션 롤백 후 실행
    @TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
    public void handleOrderFailure(OrderCreatedEvent event) {
        slackClient.sendAlert("주문 생성 실패: " + event.orderId());
    }
}
```

> **주의**: `@TransactionalEventListener`는 트랜잭션 내에서 발행된 이벤트에만 작동한다. 트랜잭션 없이 발행하면 기본적으로 무시된다. `fallbackExecution = true`를 설정하면 트랜잭션 없을 때도 실행된다.

---

## @Async 비동기 처리

### 설정

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    @Bean(name = "taskExecutor")
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);          // 기본 스레드 수
        executor.setMaxPoolSize(20);          // 최대 스레드 수
        executor.setQueueCapacity(100);       // 대기 큐 크기
        executor.setThreadNamePrefix("Async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) -> {
            log.error("Async error in {}: {}", method.getName(), ex.getMessage(), ex);
        };
    }
}
```

### @Async 메서드

```java
@Service
public class EmailService {

    // void 반환 — fire-and-forget
    @Async
    public void sendWelcomeEmail(String email) {
        // 실제 이메일 발송 (느린 작업)
        smtpClient.send(email, "환영합니다!");
    }

    // CompletableFuture 반환 — 결과 추적 가능
    @Async
    public CompletableFuture<Boolean> sendVerificationEmail(String email, String code) {
        try {
            smtpClient.send(email, "인증 코드: " + code);
            return CompletableFuture.completedFuture(true);
        } catch (Exception e) {
            return CompletableFuture.completedFuture(false);
        }
    }
}
```

### 병렬 처리 패턴

```java
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final OrderService orderService;
    private final UserService userService;
    private final AnalyticsService analyticsService;

    public DashboardData getDashboard(Long userId) throws ExecutionException, InterruptedException {
        // 세 가지 조회를 병렬로 실행
        CompletableFuture<List<Order>> ordersFuture = orderService.findRecentOrdersAsync(userId);
        CompletableFuture<UserStats> statsFuture = userService.getUserStatsAsync(userId);
        CompletableFuture<List<Recommendation>> recsFuture = analyticsService.getRecommendationsAsync(userId);

        // 모두 완료될 때까지 대기
        CompletableFuture.allOf(ordersFuture, statsFuture, recsFuture).join();

        return DashboardData.of(
            ordersFuture.get(),
            statsFuture.get(),
            recsFuture.get()
        );
    }
}
```

### 자기 호출 문제

```java
@Service
public class ReportService {

    // ❌ 자기 호출 — @Async 무시됨 (AOP 프록시 우회)
    public void generateAllReports() {
        this.generateReport("monthly");  // 프록시를 통하지 않아 @Async 미적용
    }

    @Async
    public void generateReport(String type) { ... }
}
```

해결: 별도 빈으로 분리하거나, `ApplicationContext`에서 자기 자신을 꺼내 호출한다.

---

## 스케줄링

### 기본 설정

```java
@SpringBootApplication
@EnableScheduling
public class MyApplication { }
```

### @Scheduled 옵션

```java
@Component
public class ScheduledTasks {

    // 고정 주기 — 이전 실행 시작 기준으로 5초마다
    @Scheduled(fixedRate = 5000)
    public void fixedRateTask() { }

    // 고정 지연 — 이전 실행 완료 후 5초 기다렸다가 실행
    @Scheduled(fixedDelay = 5000)
    public void fixedDelayTask() { }

    // 시작 후 10초 대기, 이후 5초마다 실행
    @Scheduled(fixedRate = 5000, initialDelay = 10000)
    public void delayedTask() { }

    // Cron 표현식 — 매일 새벽 2시
    @Scheduled(cron = "0 0 2 * * *")
    public void dailyBatchJob() { }

    // 프로퍼티에서 cron 읽기
    @Scheduled(cron = "${batch.cron:0 0 2 * * *}")
    public void configurableBatchJob() { }
}
```

### Cron 표현식

```
초 분 시 일 월 요일
 0  0  2  *  *  *   → 매일 02:00:00
 0  */5  *  *  *  * → 5분마다
 0  0  9-18  *  *  MON-FRI → 평일 9시~18시 매 정각
 0  0  0  1  *  *  → 매월 1일 자정
```

### 동적 스케줄 등록/해제

```java
@Configuration
@EnableScheduling
public class DynamicScheduleConfig implements SchedulingConfigurer {

    private final Map<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();
    private final TaskScheduler scheduler;

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.setTaskScheduler(scheduler);
    }

    // 런타임에 새 스케줄 등록
    public void addTask(String taskId, Runnable task, String cronExpression) {
        ScheduledFuture<?> future = scheduler.schedule(task, new CronTrigger(cronExpression));
        scheduledTasks.put(taskId, future);
    }

    // 런타임에 스케줄 취소
    public void removeTask(String taskId) {
        ScheduledFuture<?> future = scheduledTasks.remove(taskId);
        if (future != null) {
            future.cancel(false);
        }
    }
}
```
