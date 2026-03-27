---
title: "Spring Batch: 실무 패턴과 안티패턴"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "best-practices", "patterns", "anti-patterns"]
---

## 대용량 처리 설계

### JdbcCursorItemReader vs JdbcPagingItemReader 선택 기준

| 항목 | JdbcCursorItemReader | JdbcPagingItemReader |
|------|---------------------|---------------------|
| **동시성** | Thread-safe 아님 | Thread-safe |
| **메모리** | 스트리밍 (낮음) | 페이지 단위 (중간) |
| **DB 커넥션** | 처리 내내 단일 커넥션 유지 | 페이지마다 커넥션 획득/반환 |
| **처리 중 데이터 변경** | 불일치 가능성 있음 | 안전 |
| **멀티스레드** | SynchronizedItemStreamReader 필수 | 그대로 사용 가능 |
| **추천 상황** | 단일 스레드, 대용량 스트리밍 | 멀티스레드, Partitioning |

```java
// 단일 스레드 대용량: JdbcCursorItemReader (DB 커넥션 1개, 메모리 효율적)
@Bean
@StepScope
public JdbcCursorItemReader<Order> singleThreadReader(
        @Value("#{jobParameters['targetDate']}") String targetDate) {
    return new JdbcCursorItemReaderBuilder<Order>()
            .name("singleThreadReader")
            .dataSource(dataSource)
            .sql("SELECT * FROM orders WHERE order_date = ? ORDER BY id")
            .preparedStatementSetter(ps -> ps.setString(1, targetDate))
            .rowMapper(new BeanPropertyRowMapper<>(Order.class))
            .fetchSize(1000)  // DB에서 한 번에 가져올 행 수 (네트워크 최적화)
            .build();
}

// 멀티스레드/파티셔닝: JdbcPagingItemReader (각 스레드가 독립적인 커넥션)
@Bean
@StepScope
public JdbcPagingItemReader<Order> partitionedReader(
        @Value("#{stepExecutionContext['minId']}") Long minId,
        @Value("#{stepExecutionContext['maxId']}") Long maxId) throws Exception {

    SqlPagingQueryProviderFactoryBean queryProvider = new SqlPagingQueryProviderFactoryBean();
    queryProvider.setDataSource(dataSource);
    queryProvider.setSelectClause("SELECT id, amount, status");
    queryProvider.setFromClause("FROM orders");
    queryProvider.setWhereClause("WHERE id BETWEEN :minId AND :maxId");
    queryProvider.setSortKey("id");

    return new JdbcPagingItemReaderBuilder<Order>()
            .name("partitionedReader")
            .dataSource(dataSource)
            .queryProvider(queryProvider.getObject())
            .parameterValues(Map.of("minId", minId, "maxId", maxId))
            .rowMapper(new BeanPropertyRowMapper<>(Order.class))
            .pageSize(500)
            .build();
}
```

### 적절한 Chunk Size 결정 방법

단일 최적값은 없다. 데이터 크기, 처리 로직, DB 성능에 따라 다르다. **직접 벤치마크**해야 한다.

```java
// 벤치마크 패턴: 같은 Job을 chunk size만 바꿔서 실행
// chunk=100:  처리 시간 120초, 커밋 횟수 1000회
// chunk=500:  처리 시간  60초, 커밋 횟수  200회
// chunk=1000: 처리 시간  55초, 커밋 횟수  100회
// chunk=5000: 처리 시간  80초 (OOM 위험, GC 압박)

// 일반 권장값
// - 단순 변환 + DB 쓰기: 500 ~ 1000
// - 외부 API 호출 포함: 10 ~ 50 (API 타임아웃 고려)
// - 대용량 파일 처리: 1000 ~ 5000

@Bean
public Step benchmarkStep() {
    int chunkSize = Integer.parseInt(System.getProperty("chunkSize", "500"));
    log.info("Chunk size: {}", chunkSize);

    return new StepBuilder("benchmarkStep", jobRepository)
            .<Order, ProcessedOrder>chunk(chunkSize, transactionManager)
            .reader(orderReader())
            .processor(orderProcessor())
            .writer(orderWriter())
            .build();
}
```

### Partitioning으로 병렬화 (CPU 코어 수 기준 gridSize)

```java
@Bean
public PartitionHandler partitionHandler() {
    int gridSize = Runtime.getRuntime().availableProcessors();  // CPU 코어 수
    // I/O 바운드라면 코어 수의 2배도 고려
    // DB 커넥션 풀 크기 초과하지 않도록 주의

    TaskExecutorPartitionHandler handler = new TaskExecutorPartitionHandler();
    handler.setTaskExecutor(batchTaskExecutor());
    handler.setStep(workerStep());
    handler.setGridSize(gridSize);
    return handler;
}

@Bean
public ThreadPoolTaskExecutor batchTaskExecutor() {
    int coreSize = Runtime.getRuntime().availableProcessors();
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(coreSize);
    executor.setMaxPoolSize(coreSize * 2);
    executor.setQueueCapacity(coreSize * 4);
    executor.setThreadNamePrefix("partition-worker-");
    executor.initialize();
    return executor;
}
```

### 배치 전용 DB 연결 풀 분리

```yaml
# application.yml
spring:
  datasource:
    # 웹 서버용 기본 풀
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      pool-name: WebHikariPool

# 배치 전용 DataSource 설정
batch:
  datasource:
    url: jdbc:mysql://batch-replica:3306/batchdb  # 읽기 전용 레플리카 권장
    hikari:
      maximum-pool-size: 10  # 파티션 수 + 여유분
      minimum-idle: 2
      pool-name: BatchHikariPool
      connection-timeout: 30000
      idle-timeout: 600000
```

```java
@Configuration
public class BatchDataSourceConfig {

    @Bean
    @ConfigurationProperties("batch.datasource.hikari")
    public HikariDataSource batchDataSource() {
        return DataSourceBuilder.create().type(HikariDataSource.class).build();
    }
}
```

---

## 멱등성 (Idempotency) 확보

### 배치는 언제든 재실행 가능해야 한다

네트워크 장애, 서버 재시작, 버그 수정 후 재처리 등으로 배치가 중간에 실패하거나 재실행될 수 있다. 데이터 중복/누락 없이 여러 번 실행해도 결과가 같아야 한다.

### UPSERT 패턴

```java
// MySQL: INSERT ... ON DUPLICATE KEY UPDATE
@Bean
public JdbcBatchItemWriter<ProcessedOrder> idempotentWriter() {
    return new JdbcBatchItemWriterBuilder<ProcessedOrder>()
            .dataSource(dataSource)
            .sql("""
                 INSERT INTO processed_orders (order_id, final_amount, processed_at, target_date)
                 VALUES (:orderId, :finalAmount, :processedAt, :targetDate)
                 ON DUPLICATE KEY UPDATE
                     final_amount = VALUES(final_amount),
                     processed_at = VALUES(processed_at)
                 """)
            .beanMapped()
            .build();
}

// PostgreSQL: INSERT ... ON CONFLICT DO UPDATE
// INSERT INTO processed_orders (order_id, final_amount, processed_at)
// VALUES (:orderId, :finalAmount, :processedAt)
// ON CONFLICT (order_id) DO UPDATE SET
//     final_amount = EXCLUDED.final_amount,
//     processed_at = EXCLUDED.processed_at
```

### 처리 완료 플래그 컬럼 활용

```java
// Reader에서 미처리 데이터만 조회
@Bean
@StepScope
public JdbcCursorItemReader<Order> pendingOrderReader(
        @Value("#{jobParameters['targetDate']}") String targetDate) {
    return new JdbcCursorItemReaderBuilder<Order>()
            .name("pendingOrderReader")
            .dataSource(dataSource)
            .sql("""
                 SELECT id, amount, status
                 FROM orders
                 WHERE DATE(created_at) = ?
                   AND processed_at IS NULL  -- 미처리 데이터만 조회
                 ORDER BY id
                 """)
            .preparedStatementSetter(ps -> ps.setString(1, targetDate))
            .rowMapper(new BeanPropertyRowMapper<>(Order.class))
            .build();
}

// Writer에서 처리 완료 시 processed_at 업데이트
@Bean
public JdbcBatchItemWriter<ProcessedOrder> flagWriter() {
    return new JdbcBatchItemWriterBuilder<ProcessedOrder>()
            .dataSource(dataSource)
            .sql("UPDATE orders SET processed_at = NOW(), status = 'PROCESSED' WHERE id = :orderId")
            .beanMapped()
            .build();
}
```

### 처리 날짜 범위 기반 멱등 설계

```java
// 같은 날짜의 Job은 항상 동일한 결과를 보장
// JobParameters에 targetDate 포함 → 같은 날짜 재실행 = 같은 데이터 재처리
// UPSERT로 중복 저장 방지

// 재실행 허용을 위해 timestamp 추가 (동일 파라미터 중복 실행 방지 해제)
JobParameters params = new JobParametersBuilder()
        .addString("targetDate", "2026-03-27")   // 비즈니스 키
        .addLong("timestamp", System.currentTimeMillis())  // 재실행 허용 키
        .toJobParameters();
```

---

## 배치 실패 알림 패턴

### JobExecutionListener.afterJob()에서 FAILED 감지 + Slack 알림

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class BatchFailureNotificationListener implements JobExecutionListener {

    private final SlackWebhookClient slackClient;

    @Override
    public void afterJob(JobExecution jobExecution) {
        if (jobExecution.getStatus() != BatchStatus.FAILED) {
            return;  // 실패가 아니면 무시
        }

        String jobName = jobExecution.getJobInstance().getJobName();
        String targetDate = jobExecution.getJobParameters().getString("targetDate", "N/A");
        String exitDescription = jobExecution.getExitStatus().getExitDescription();

        // 실패 원인 파싱 (스택 트레이스에서 첫 줄만 추출)
        String errorSummary = extractFirstLine(exitDescription);

        // 알림이 이미 발송되었는지 확인 (재시작 시 중복 방지)
        ExecutionContext jobContext = jobExecution.getExecutionContext();
        if (jobContext.containsKey("alertSent")) {
            log.info("[알림] 이미 알림이 발송된 실행입니다. 중복 발송 건너뜀.");
            return;
        }

        String message = String.format("""
                *배치 실패 알림*
                - Job: `%s`
                - 대상일: `%s`
                - Execution ID: `%d`
                - 실패 원인: `%s`
                - 실행 시작: `%s`
                """,
                jobName,
                targetDate,
                jobExecution.getId(),
                errorSummary,
                jobExecution.getStartTime());

        slackClient.sendMessage(message);

        // 알림 발송 완료 플래그 저장
        jobContext.put("alertSent", true);
    }

    private String extractFirstLine(String exitDescription) {
        if (exitDescription == null || exitDescription.isBlank()) {
            return "알 수 없는 오류";
        }
        return exitDescription.lines().findFirst().orElse("알 수 없는 오류");
    }
}

// Slack Webhook 클라이언트
@Component
@RequiredArgsConstructor
public class SlackWebhookClient {

    private final RestTemplate restTemplate;

    @Value("${slack.webhook.url}")
    private String webhookUrl;

    public void sendMessage(String text) {
        try {
            Map<String, String> payload = Map.of("text", text);
            restTemplate.postForEntity(webhookUrl, payload, String.class);
        } catch (Exception e) {
            log.error("Slack 알림 발송 실패", e);
            // 알림 실패가 배치 동작에 영향 주지 않도록 예외 삼킴
        }
    }
}
```

---

## 청크 내 트랜잭션 주의사항

### Step 안에서 @Transactional 서비스 호출 시 트랜잭션 전파 문제

```java
// 잘못된 패턴 1: Processor에서 @Transactional 서비스 호출
@Component
@RequiredArgsConstructor
public class BadOrderProcessor implements ItemProcessor<Order, ProcessedOrder> {

    private final OrderService orderService;  // @Transactional이 있는 서비스

    @Override
    public ProcessedOrder process(Order order) {
        // 문제: orderService.save()가 새 트랜잭션을 시작하면
        // Chunk 트랜잭션과 별개로 커밋됨 → Writer에서 실패해도 이미 저장된 상태
        orderService.markAsProcessing(order.getId());  // 별도 트랜잭션으로 커밋!
        return new ProcessedOrder(order);
    }
}

// 잘못된 패턴 2: REQUIRES_NEW로 인한 커넥션 고갈
@Service
public class BadService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void process(Order order) {
        // 청크 크기 500 × REQUIRES_NEW = 동시에 500개 커넥션 사용
        // HikariCP maxPoolSize=10이면 커넥션 풀 고갈 → 데드락!
    }
}

// 올바른 패턴: Chunk 트랜잭션 하나만 사용
@Component
public class CorrectOrderProcessor implements ItemProcessor<Order, ProcessedOrder> {

    @Override
    public ProcessedOrder process(Order order) {
        // 순수한 변환 로직만 수행
        // DB 저장은 Writer에서 Chunk 트랜잭션 하에서 일괄 처리
        ProcessedOrder processed = new ProcessedOrder();
        processed.setOrderId(order.getId());
        processed.setFinalAmount(calculateFinalAmount(order));
        return processed;
    }

    private BigDecimal calculateFinalAmount(Order order) {
        return order.getAmount().multiply(BigDecimal.valueOf(0.9));
    }
}
```

---

## IDENTITY 전략 + 배치 INSERT 불가 문제

### 원인

`GenerationType.IDENTITY`는 DB가 키를 생성한다. Hibernate가 `INSERT`를 실행한 후 즉시 `SELECT LAST_INSERT_ID()`를 호출해 생성된 키를 가져와야 한다. 이 때문에 여러 INSERT를 묶어 배치로 처리할 수 없다.

```java
// 문제가 있는 설정
@Entity
public class ProcessedOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // 배치 INSERT 불가!
    private Long id;
}
```

### 해결 1: SEQUENCE 전략으로 변경

```java
// MySQL에서 SEQUENCE 시뮬레이션
@Entity
@SequenceGenerator(name = "order_seq", sequenceName = "order_id_seq", allocationSize = 50)
public class ProcessedOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "order_seq")
    private Long id;
    // allocationSize=50: 50개씩 미리 할당 → 배치 INSERT 가능
}

// application.yml
spring:
  jpa:
    properties:
      hibernate:
        jdbc:
          batch_size: 50         # 배치 INSERT 크기
          order_inserts: true    # INSERT 순서 최적화
          order_updates: true    # UPDATE 순서 최적화
```

### 해결 2: JpaItemWriter 대신 JdbcBatchItemWriter 사용

```java
// JpaItemWriter 대신 JdbcBatchItemWriter 사용 (IDENTITY 전략 유지 가능)
@Bean
public JdbcBatchItemWriter<ProcessedOrder> batchInsertWriter() {
    return new JdbcBatchItemWriterBuilder<ProcessedOrder>()
            .dataSource(dataSource)
            .sql("""
                 INSERT INTO processed_orders (order_id, final_amount, processed_at)
                 VALUES (:orderId, :finalAmount, :processedAt)
                 """)
            .beanMapped()
            .build();
    // JDBC 레벨에서 addBatch() / executeBatch() 사용 → IDENTITY와 호환
}
```

### 해결 3: hibernate.jdbc.batch_size 설정 + SEQUENCE 전략 조합

```yaml
spring:
  jpa:
    properties:
      hibernate:
        jdbc:
          batch_size: 100
          fetch_size: 100
        order_inserts: true
        order_updates: true
        generate_statistics: false  # 운영에서는 false (성능)
```

---

## Job 분리 전략

### 하나의 Job = 하나의 책임

```java
// 나쁜 패턴: 하나의 Job에 너무 많은 책임
@Bean
public Job megaJob() {
    return new JobBuilder("megaJob", jobRepository)
            .start(parseOrdersStep())
            .next(calculateDiscountsStep())
            .next(sendEmailsStep())
            .next(generateReportsStep())
            .next(cleanupTempDataStep())
            .next(syncToExternalSystemStep())
            .build();
    // 문제: 중간 Step 실패 시 전체 재실행, 단독 실행 불가
}

// 좋은 패턴: 책임 단위로 Job 분리
@Bean public Job orderProcessingJob() { ... }    // 주문 처리만
@Bean public Job reportGenerationJob() { ... }   // 리포트 생성만
@Bean public Job emailSendingJob() { ... }       // 이메일 발송만
```

### 공통 Step을 여러 Job에서 재사용

```java
@Configuration
@RequiredArgsConstructor
public class CommonStepConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    // 공통 정리 Step: 여러 Job에서 재사용
    @Bean
    public Step cleanupTempDataStep() {
        return new StepBuilder("cleanupTempDataStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    log.info("임시 데이터 정리");
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }
}

@Configuration
@RequiredArgsConstructor
public class OrderJobConfig {

    private final CommonStepConfig commonStepConfig;

    @Bean
    public Job orderJob() {
        return new JobBuilder("orderJob", jobRepository)
                .start(processOrdersStep())
                .next(commonStepConfig.cleanupTempDataStep())  // 공통 Step 재사용
                .build();
    }
}
```

---

## 안티패턴 목록

### 안티패턴 1: chunk size = 1

```java
// 나쁜 예: chunk size = 1 → 아이템마다 트랜잭션 커밋
@Bean
public Step badStep() {
    return new StepBuilder("badStep", jobRepository)
            .<Order, ProcessedOrder>chunk(1, transactionManager)  // 10만 건 = 10만 번 커밋!
            .reader(orderReader())
            .processor(orderProcessor())
            .writer(orderWriter())
            .build();
}

// 좋은 예: 적절한 chunk size 사용
@Bean
public Step goodStep() {
    return new StepBuilder("goodStep", jobRepository)
            .<Order, ProcessedOrder>chunk(500, transactionManager)  // 10만 건 = 200번 커밋
            .reader(orderReader())
            .processor(orderProcessor())
            .writer(orderWriter())
            .build();
}
```

### 안티패턴 2: @StepScope 없이 JobParameters SpEL 바인딩

```java
// 나쁜 예: @StepScope 없음 → 애플리케이션 시작 시 jobParameters = null
@Bean
// @StepScope 없음!
public ItemReader<Order> brokenReader(
        @Value("#{jobParameters['targetDate']}") String targetDate) {
    // targetDate = null → NullPointerException 또는 잘못된 쿼리
    return new JdbcCursorItemReaderBuilder<Order>()
            .sql("SELECT * FROM orders WHERE date = '" + targetDate + "'")
            // ...
            .build();
}

// 좋은 예
@Bean
@StepScope  // 반드시 필요
public ItemReader<Order> correctReader(
        @Value("#{jobParameters['targetDate']}") String targetDate) {
    // Step 실행 시점에 호출 → targetDate 정상 바인딩
    return new JdbcCursorItemReaderBuilder<Order>()
            .sql("SELECT * FROM orders WHERE order_date = ?")
            .preparedStatementSetter(ps -> ps.setString(1, targetDate))
            // ...
            .build();
}
```

### 안티패턴 3: Processor에서 DB 저장 후 Writer에서 다시 저장

```java
// 나쁜 예: Processor에서 이미 저장 → Writer에서 또 저장 → 중복!
@Component
public class BadProcessor implements ItemProcessor<Order, ProcessedOrder> {
    private final ProcessedOrderRepository repository;

    @Override
    public ProcessedOrder process(Order order) {
        ProcessedOrder processed = new ProcessedOrder(order);
        repository.save(processed);  // Processor에서 저장 (잘못됨!)
        return processed;
    }
}

// 나쁜 Writer: 이미 저장된 데이터를 또 저장
@Bean
public JpaItemWriter<ProcessedOrder> badWriter() {
    return new JpaItemWriter<>();  // 중복 저장 발생!
}

// 좋은 예: Processor는 변환만, Writer가 저장
@Component
public class CorrectProcessor implements ItemProcessor<Order, ProcessedOrder> {
    @Override
    public ProcessedOrder process(Order order) {
        return new ProcessedOrder(order);  // 변환만!
    }
}
```

### 안티패턴 4: EAGER 로딩 엔티티를 JpaItemWriter로 쓰기

```java
// 나쁜 예
@Entity
public class Order {
    @OneToMany(fetch = FetchType.EAGER)  // EAGER 로딩
    private List<OrderItem> items;
    // 10만 건 Order → 10만 번 OrderItem 조회 (N+1)
}

// JpaItemWriter 사용 + IDENTITY → 배치 INSERT 불가, N+1 문제
@Bean
public JpaItemWriter<ProcessedOrder> badWriter() {
    JpaItemWriter<ProcessedOrder> writer = new JpaItemWriter<>();
    writer.setEntityManagerFactory(entityManagerFactory);
    return writer;
}

// 좋은 예: LAZY 로딩 + JdbcBatchItemWriter
@Entity
public class Order {
    @OneToMany(fetch = FetchType.LAZY)  // LAZY 로딩
    private List<OrderItem> items;
}

@Bean
public JdbcBatchItemWriter<ProcessedOrder> goodWriter() {
    return new JdbcBatchItemWriterBuilder<ProcessedOrder>()
            .dataSource(dataSource)
            .sql("INSERT INTO processed_orders (order_id, amount) VALUES (:orderId, :amount)")
            .beanMapped()
            .build();
}
```

### 안티패턴 5: 메타데이터 테이블 무한 누적

```java
// 해결책: 주기적 정리 스케줄러 (상세 코드는 10-monitoring.md 참조)
@Scheduled(cron = "0 0 3 * * SUN")
public void cleanupBatchMetadata() {
    // 90일 이상 지난 실행 이력 삭제
    // BATCH_STEP_EXECUTION_CONTEXT → BATCH_STEP_EXECUTION →
    // BATCH_JOB_EXECUTION_CONTEXT → BATCH_JOB_EXECUTION_PARAMS →
    // BATCH_JOB_EXECUTION → BATCH_JOB_INSTANCE 순서로 삭제
}
```

### 안티패턴 6: ItemReader에서 비즈니스 로직 수행

```java
// 나쁜 예: Reader에서 변환/계산까지 수행
@Bean
@StepScope
public ItemReader<ProcessedOrder> badReader() {
    return () -> {
        Order raw = fetchNextOrder();
        if (raw == null) return null;

        // Reader에서 비즈니스 로직 수행 (잘못됨!)
        double discount = calculateDiscount(raw);  // 계산 로직
        sendNotification(raw);                    // 알림 발송 (부작용!)
        return new ProcessedOrder(raw, discount);
    };
}

// 좋은 예: Reader는 읽기만, 로직은 Processor로
@Bean
@StepScope
public JdbcCursorItemReader<Order> correctReader() {
    return new JdbcCursorItemReaderBuilder<Order>()
            .name("correctReader")
            .dataSource(dataSource)
            .sql("SELECT * FROM orders WHERE status = 'PENDING'")
            .rowMapper(new BeanPropertyRowMapper<>(Order.class))
            .build();
    // 오직 읽기만!
}

@Bean
public ItemProcessor<Order, ProcessedOrder> correctProcessor() {
    return order -> {
        // 비즈니스 로직은 Processor에서
        double discount = calculateDiscount(order);
        return new ProcessedOrder(order, discount);
    };
}
```

---

## 안티패턴 요약표

| 안티패턴 | 증상 | 해결책 |
|---------|------|--------|
| chunk size = 1 | 배치가 DB에 부하를 줌, 처리 속도 극히 느림 | chunk size 100 이상으로 설정 |
| @StepScope 누락 | 시작 시 NPE, targetDate = null | `@StepScope` 추가 |
| Processor에서 저장 | 데이터 중복 저장, 트랜잭션 불일치 | Writer에서만 저장 |
| EAGER + JpaItemWriter | N+1 쿼리, 배치 INSERT 불가 | LAZY + JdbcBatchItemWriter |
| 메타데이터 누적 | 조회 쿼리 느려짐, 디스크 부족 | 주기적 삭제 스케줄러 |
| Reader에서 비즈니스 로직 | 테스트 어려움, 재사용 불가 | Reader(읽기) / Processor(변환) / Writer(저장) 역할 분리 |
