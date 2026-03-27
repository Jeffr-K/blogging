---
title: "Spring Batch: 병렬 처리 완전 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "parallel", "partitioning", "multi-thread"]
---

## 병렬 처리 전략 비교

Spring Batch에서 제공하는 병렬 처리 방식은 크게 4가지다. 상황에 따라 적절한 전략을 선택해야 성능과 안정성을 모두 잡을 수 있다.

| 전략 | 핵심 개념 | 적합한 상황 | 재시작 지원 | 복잡도 |
|------|-----------|------------|------------|--------|
| **Multi-threaded Step** | 단일 Step에서 청크를 여러 스레드로 처리 | I/O 바운드 작업, Reader가 Thread-safe할 때 | 제한적 | 낮음 |
| **Parallel Steps (Split Flow)** | 독립적인 Step들을 병렬 실행 | 독립적인 비즈니스 플로우가 여러 개일 때 | 완전 지원 | 낮음 |
| **Partitioning** | 데이터를 나누어 Worker Step이 병렬 처리 | 대용량 단일 데이터셋 처리 | 완전 지원 | 중간 |
| **Remote Chunking** | Manager가 읽기, Worker가 처리/쓰기 (네트워크) | 처리 로직이 극도로 무거울 때 | 복잡 | 높음 |

---

## 1. Multi-threaded Step

### 개념

하나의 Step 내에서 청크(Chunk)를 여러 스레드가 동시에 처리한다. 구현이 단순하며, TaskExecutor만 Step에 연결하면 된다. 단, Reader가 Thread-safe하지 않으면 데이터 중복 또는 손실이 발생한다.

### ThreadPoolTaskExecutor 설정

```java
@Configuration
public class ThreadPoolConfig {

    @Bean
    public ThreadPoolTaskExecutor batchTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);        // 기본 스레드 수
        executor.setMaxPoolSize(8);         // 최대 스레드 수
        executor.setQueueCapacity(25);      // 큐 대기 용량
        executor.setThreadNamePrefix("batch-thread-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }
}
```

### Multi-threaded Step 전체 코드

```java
@Configuration
@RequiredArgsConstructor
public class MultiThreadedJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final DataSource dataSource;
    private final ThreadPoolTaskExecutor batchTaskExecutor;

    @Bean
    public Job multiThreadedJob() {
        return new JobBuilder("multiThreadedJob", jobRepository)
                .start(multiThreadedStep())
                .build();
    }

    @Bean
    public Step multiThreadedStep() {
        return new StepBuilder("multiThreadedStep", jobRepository)
                .<User, UserDto>chunk(100, transactionManager)
                .reader(threadSafeUserReader())
                .processor(userProcessor())
                .writer(userWriter())
                .taskExecutor(batchTaskExecutor)  // TaskExecutor 적용
                .build();
    }

    @Bean
    @StepScope
    public SynchronizedItemStreamReader<User> threadSafeUserReader() {
        // Thread-safe하지 않은 JdbcCursorItemReader를 래핑
        JdbcCursorItemReader<User> reader = new JdbcCursorItemReaderBuilder<User>()
                .name("userReader")
                .dataSource(dataSource)
                .sql("SELECT id, name, email FROM users WHERE status = 'ACTIVE'")
                .rowMapper(new BeanPropertyRowMapper<>(User.class))
                .build();

        // SynchronizedItemStreamReader로 동기화 처리
        SynchronizedItemStreamReader<User> synchronizedReader = new SynchronizedItemStreamReader<>();
        synchronizedReader.setDelegate(reader);
        return synchronizedReader;
    }

    @Bean
    public ItemProcessor<User, UserDto> userProcessor() {
        return user -> {
            // Thread-safe한 처리 로직 (stateless 권장)
            return new UserDto(user.getId(), user.getName().toUpperCase(), user.getEmail());
        };
    }

    @Bean
    public JdbcBatchItemWriter<UserDto> userWriter() {
        return new JdbcBatchItemWriterBuilder<UserDto>()
                .dataSource(dataSource)
                .sql("INSERT INTO user_dto (id, name, email) VALUES (:id, :name, :email) " +
                     "ON DUPLICATE KEY UPDATE name = :name, email = :email")
                .beanMapped()
                .build();
    }
}
```

### Thread-safe하지 않은 Reader 문제

`JdbcCursorItemReader`는 DB 커서를 내부적으로 유지하므로 멀티스레드 환경에서 사용하면 안 된다. 두 스레드가 동시에 `read()`를 호출하면 커서 위치가 꼬인다.

```java
// 잘못된 방식 - JdbcCursorItemReader를 그대로 사용
@Bean
public JdbcCursorItemReader<User> unsafeReader() {
    return new JdbcCursorItemReaderBuilder<User>()
            .name("unsafeReader")
            .dataSource(dataSource)
            .sql("SELECT * FROM users")
            .rowMapper(new BeanPropertyRowMapper<>(User.class))
            .build();
    // Multi-threaded Step에서 사용하면 데이터 중복/누락 발생!
}

// 올바른 방식 1 - SynchronizedItemStreamReader로 래핑
@Bean
public SynchronizedItemStreamReader<User> safeReader() {
    JdbcCursorItemReader<User> delegate = new JdbcCursorItemReaderBuilder<User>()
            .name("userCursorReader")
            .dataSource(dataSource)
            .sql("SELECT * FROM users")
            .rowMapper(new BeanPropertyRowMapper<>(User.class))
            .build();

    SynchronizedItemStreamReader<User> reader = new SynchronizedItemStreamReader<>();
    reader.setDelegate(delegate);
    return reader;
}

// 올바른 방식 2 - JdbcPagingItemReader 사용 (페이지 단위라 본질적으로 Thread-safe)
@Bean
public JdbcPagingItemReader<User> pagingReader(PagingQueryProvider queryProvider) {
    return new JdbcPagingItemReaderBuilder<User>()
            .name("userPagingReader")
            .dataSource(dataSource)
            .queryProvider(queryProvider)
            .rowMapper(new BeanPropertyRowMapper<>(User.class))
            .pageSize(100)
            .build();
}
```

### 재시작 지원 제한 이유

Multi-threaded Step은 실패 후 재시작 시 어느 청크부터 다시 처리해야 할지 특정하기 어렵다. 청크들이 순서 없이 병렬 처리되므로 `ExecutionContext`에 정확한 재시작 위치를 저장하기 불가능하다.

```java
// 재시작 불필요 설정 (멱등성이 보장된 경우)
@Bean
public Step multiThreadedStep() {
    return new StepBuilder("multiThreadedStep", jobRepository)
            .<User, UserDto>chunk(100, transactionManager)
            .reader(threadSafeUserReader())
            .processor(userProcessor())
            .writer(userWriter())
            .taskExecutor(batchTaskExecutor)
            .allowStartIfComplete(true)  // 이미 완료된 Step도 재실행 허용
            .build();
}
```

**언제 쓰는가:** I/O 바운드 작업(파일 읽기/쓰기, 외부 API 호출)이 병목일 때, Reader를 Thread-safe하게 만들 수 있을 때, 구현을 단순하게 유지하고 싶을 때.

---

## 2. Parallel Steps (Split Flow)

### 개념

서로 독립적인 Step들을 동시에 실행한다. Split Flow를 사용하면 모든 병렬 Step이 완료된 후 다음 Step으로 진행한다.

### 전체 코드: 파일 처리 + 이메일 발송 병렬 실행

```java
@Configuration
@RequiredArgsConstructor
public class ParallelStepsJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final ThreadPoolTaskExecutor batchTaskExecutor;

    @Bean
    public Job parallelStepsJob() {
        // flow1과 flow2를 병렬로 실행한 뒤, 마지막 Step 실행
        return new JobBuilder("parallelStepsJob", jobRepository)
                .start(splitFlow())
                .next(finalStep())  // 두 Flow가 모두 완료된 후 실행
                .end()
                .build();
    }

    @Bean
    public Flow splitFlow() {
        return new FlowBuilder<SimpleFlow>("splitFlow")
                .split(batchTaskExecutor)
                .add(fileProcessingFlow(), emailSendingFlow())
                .build();
    }

    // Flow 1: 파일 처리
    @Bean
    public Flow fileProcessingFlow() {
        return new FlowBuilder<SimpleFlow>("fileProcessingFlow")
                .start(fileProcessingStep())
                .build();
    }

    @Bean
    public Step fileProcessingStep() {
        return new StepBuilder("fileProcessingStep", jobRepository)
                .<Order, ProcessedOrder>chunk(200, transactionManager)
                .reader(orderFileReader())
                .processor(orderProcessor())
                .writer(processedOrderWriter())
                .build();
    }

    // Flow 2: 이메일 발송
    @Bean
    public Flow emailSendingFlow() {
        return new FlowBuilder<SimpleFlow>("emailSendingFlow")
                .start(emailSendingStep())
                .build();
    }

    @Bean
    public Step emailSendingStep() {
        return new StepBuilder("emailSendingStep", jobRepository)
                .<Member, EmailResult>chunk(50, transactionManager)
                .reader(pendingEmailReader())
                .processor(emailProcessor())
                .writer(emailResultWriter())
                .build();
    }

    // 병렬 처리 완료 후 최종 집계 Step
    @Bean
    public Step finalStep() {
        return new StepBuilder("finalStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    // 두 Flow의 결과를 종합
                    log.info("파일 처리 및 이메일 발송 모두 완료. 집계 시작.");
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }

    // Reader/Processor/Writer 빈들은 생략...
}
```

**핵심 동작:** `split(taskExecutor).add(flow1, flow2)`에서 두 Flow는 각각 별도 스레드에서 실행된다. 둘 중 하나라도 실패하면 전체 Job이 FAILED 상태가 된다.

---

## 3. Partitioning (핵심 전략)

### 개념

Manager Step이 전체 데이터를 여러 파티션으로 분할하고, 각 파티션을 Worker Step에 할당하여 병렬 처리한다. 각 Worker는 독립적인 `StepExecution`을 갖는다.

```
Manager Step
    ├── 파티션 1 (ID: 1 ~ 1000)   → Worker Step (Thread 1)
    ├── 파티션 2 (ID: 1001 ~ 2000) → Worker Step (Thread 2)
    ├── 파티션 3 (ID: 2001 ~ 3000) → Worker Step (Thread 3)
    └── 파티션 4 (ID: 3001 ~ 4000) → Worker Step (Thread 4)
```

### Partitioner 인터페이스 구현: ColumnRangePartitioner

```java
@Component
@RequiredArgsConstructor
public class ColumnRangePartitioner implements Partitioner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public Map<String, ExecutionContext> partition(int gridSize) {
        // 처리 대상 데이터의 min/max ID 조회
        Map<String, Object> result = jdbcTemplate.queryForMap(
                "SELECT MIN(id) AS min_id, MAX(id) AS max_id FROM orders WHERE status = 'PENDING'"
        );

        long minId = ((Number) result.get("min_id")).longValue();
        long maxId = ((Number) result.get("max_id")).longValue();

        // 파티션당 처리할 데이터 범위 계산
        long targetSize = (maxId - minId) / gridSize + 1;

        Map<String, ExecutionContext> partitions = new HashMap<>();

        long start = minId;
        long end = start + targetSize - 1;

        for (int i = 0; i < gridSize; i++) {
            ExecutionContext context = new ExecutionContext();
            context.putLong("minId", start);
            context.putLong("maxId", Math.min(end, maxId));
            context.putInt("partitionNumber", i);

            partitions.put("partition" + i, context);

            start += targetSize;
            end += targetSize;

            if (start > maxId) {
                break;
            }
        }

        return partitions;
    }
}
```

### TaskExecutorPartitionHandler 설정

```java
@Bean
public PartitionHandler partitionHandler() {
    TaskExecutorPartitionHandler handler = new TaskExecutorPartitionHandler();
    handler.setTaskExecutor(batchTaskExecutor);  // 병렬 실행 executor
    handler.setStep(workerStep());               // Worker Step 지정
    handler.setGridSize(4);                      // 파티션 수 (스레드 수)
    return handler;
}
```

### Worker Step: @StepScope + ExecutionContext에서 범위 읽기

```java
@Bean
@StepScope
public JdbcPagingItemReader<Order> partitionedOrderReader(
        @Value("#{stepExecutionContext['minId']}") Long minId,
        @Value("#{stepExecutionContext['maxId']}") Long maxId) {

    log.info("파티션 처리 범위: {} ~ {}", minId, maxId);

    SqlPagingQueryProviderFactoryBean queryProvider = new SqlPagingQueryProviderFactoryBean();
    queryProvider.setDataSource(dataSource);
    queryProvider.setSelectClause("SELECT id, product_id, amount, status");
    queryProvider.setFromClause("FROM orders");
    queryProvider.setWhereClause("WHERE id >= :minId AND id <= :maxId AND status = 'PENDING'");
    queryProvider.setSortKey("id");

    Map<String, Object> parameterValues = new HashMap<>();
    parameterValues.put("minId", minId);
    parameterValues.put("maxId", maxId);

    try {
        return new JdbcPagingItemReaderBuilder<Order>()
                .name("partitionedOrderReader")
                .dataSource(dataSource)
                .queryProvider(queryProvider.getObject())
                .parameterValues(parameterValues)
                .rowMapper(new BeanPropertyRowMapper<>(Order.class))
                .pageSize(100)
                .build();
    } catch (Exception e) {
        throw new RuntimeException("Reader 생성 실패", e);
    }
}
```

### Manager Step + Worker Step 전체 @Configuration

```java
@Configuration
@RequiredArgsConstructor
public class PartitioningJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final DataSource dataSource;
    private final ColumnRangePartitioner columnRangePartitioner;
    private final ThreadPoolTaskExecutor batchTaskExecutor;

    @Bean
    public Job partitioningJob() {
        return new JobBuilder("partitioningJob", jobRepository)
                .start(managerStep())
                .build();
    }

    // Manager Step: 파티션 분할 후 Worker에 위임
    @Bean
    public Step managerStep() {
        return new StepBuilder("managerStep", jobRepository)
                .partitioner("workerStep", columnRangePartitioner)  // Partitioner 지정
                .partitionHandler(partitionHandler())
                .build();
    }

    @Bean
    public PartitionHandler partitionHandler() {
        TaskExecutorPartitionHandler handler = new TaskExecutorPartitionHandler();
        handler.setTaskExecutor(batchTaskExecutor);
        handler.setStep(workerStep());
        handler.setGridSize(4);  // CPU 코어 수 또는 데이터 크기에 따라 조정
        return handler;
    }

    // Worker Step: Manager가 생성한 각 파티션에서 실행
    @Bean
    public Step workerStep() {
        return new StepBuilder("workerStep", jobRepository)
                .<Order, ProcessedOrder>chunk(100, transactionManager)
                .reader(partitionedOrderReader(null, null))  // @StepScope로 Late Binding
                .processor(orderProcessor())
                .writer(processedOrderWriter())
                .faultTolerant()
                .skipLimit(10)
                .skip(DataAccessException.class)
                .build();
    }

    @Bean
    @StepScope
    public JdbcPagingItemReader<Order> partitionedOrderReader(
            @Value("#{stepExecutionContext['minId']}") Long minId,
            @Value("#{stepExecutionContext['maxId']}") Long maxId) {
        // 위의 코드와 동일
        // ...
        return null; // 실제 구현 생략
    }

    @Bean
    public ItemProcessor<Order, ProcessedOrder> orderProcessor() {
        return order -> {
            // 주문 처리 로직
            ProcessedOrder processed = new ProcessedOrder();
            processed.setOrderId(order.getId());
            processed.setProcessedAt(LocalDateTime.now());
            return processed;
        };
    }

    @Bean
    public JdbcBatchItemWriter<ProcessedOrder> processedOrderWriter() {
        return new JdbcBatchItemWriterBuilder<ProcessedOrder>()
                .dataSource(dataSource)
                .sql("UPDATE orders SET status = 'PROCESSED', processed_at = :processedAt WHERE id = :orderId")
                .beanMapped()
                .build();
    }
}
```

### gridSize vs 실제 파티션 수

`gridSize`는 Partitioner에게 "몇 개로 나눠라"라고 힌트를 주는 값이다. 실제 파티션 수는 Partitioner 구현에 따라 달라질 수 있다. 예를 들어, 데이터가 10건밖에 없는데 gridSize가 4라면 파티션이 4개보다 적게 생성될 수 있다.

```java
// ColumnRangePartitioner에서 gridSize를 기준으로 파티션 생성
// 실제 파티션 수 = Math.min(gridSize, 실제 데이터 범위)
```

### 파티셔닝이 대용량 처리에 효과적인 이유

1. **독립적인 StepExecution**: 각 파티션이 별도 `StepExecution`을 가져 실패/재시작이 파티션 단위로 처리된다
2. **완전한 재시작 지원**: 실패한 파티션만 재처리 가능
3. **데이터 격리**: 각 Worker가 서로 다른 ID 범위를 처리하므로 동기화 불필요
4. **선형적 성능 향상**: 4 파티션 = 약 4배 빠른 처리 (I/O 한계까지)

---

## 4. Remote Chunking

### 개념

Manager가 데이터를 읽어 메시지 큐(RabbitMQ, Kafka)로 전송하고, 여러 Worker 인스턴스가 각 메시지를 받아 처리와 쓰기를 담당한다. 처리 로직이 극도로 무거울 때 사용한다.

```
Manager 서버                     Worker 서버들
┌──────────────┐    RabbitMQ    ┌──────────────┐
│ ItemReader   │ ──→ Queue ──→  │ ItemProcessor│
│ (데이터 읽기) │                 │ ItemWriter   │ x N
└──────────────┘                └──────────────┘
```

### Spring Integration + RabbitMQ 기반 아키텍처

```xml
<!-- Maven 의존성 -->
<dependency>
    <groupId>org.springframework.batch</groupId>
    <artifactId>spring-batch-integration</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.integration</groupId>
    <artifactId>spring-integration-amqp</artifactId>
</dependency>
```

```java
// Manager 측 설정
@Configuration
public class RemoteChunkingManagerConfig {

    @Bean
    public Step managerStep(
            RemoteChunkingManagerStepBuilderFactory managerStepBuilderFactory) {

        return managerStepBuilderFactory
                .<User, User>get("managerStep")
                .chunk(100)
                .reader(userReader())
                .outputChannel(requestsChannel())   // Worker로 청크 전송
                .inputChannel(repliesChannel())      // Worker 처리 결과 수신
                .build();
    }

    @Bean
    public DirectChannel requestsChannel() {
        return new DirectChannel();
    }

    @Bean
    public DirectChannel repliesChannel() {
        return new DirectChannel();
    }

    @Bean
    public AmqpOutboundEndpoint amqpOutboundEndpoint(AmqpTemplate amqpTemplate) {
        AmqpOutboundEndpoint endpoint = new AmqpOutboundEndpoint(amqpTemplate);
        endpoint.setExchangeName("batch.requests");
        endpoint.setOutputChannel(repliesChannel());
        return endpoint;
    }
}

// Worker 측 설정
@Configuration
public class RemoteChunkingWorkerConfig {

    @Bean
    public IntegrationFlow workerIntegrationFlow(
            RemoteChunkingWorkerBuilder<User, User> workerBuilder) {

        return workerBuilder
                .itemProcessor(userProcessor())
                .itemWriter(userWriter())
                .inputChannel(requestsChannel())
                .outputChannel(repliesChannel())
                .build();
    }
}
```

### Remote Chunking vs Partitioning 선택 기준

| 기준 | Partitioning | Remote Chunking |
|------|-------------|-----------------|
| **병목 지점** | 데이터 읽기/쓰기 | 데이터 처리(CPU 집약) |
| **네트워크 통신** | 없음 (로컬) | 있음 (메시지 큐) |
| **인프라 복잡도** | 낮음 | 높음 (MQ 필요) |
| **확장성** | 수직 확장 (스레드) | 수평 확장 (Worker 서버 추가) |
| **재시작** | 완전 지원 | 복잡 |
| **추천 상황** | 대부분의 대용량 배치 | ML 추론, 이미지 처리 등 CPU 집약 작업 |

**실무 권장:** 대부분의 대용량 배치는 **Partitioning**으로 충분하다. Remote Chunking은 처리 로직이 단일 서버 CPU를 포화시킬 정도로 무거울 때만 고려한다.

---

## 실무 팁

### 스레드 수 결정 방법

```java
// CPU 바운드 작업: 코어 수와 동일하게
int cpuCores = Runtime.getRuntime().availableProcessors();

// I/O 바운드 작업: 코어 수의 2~4배 (대기 시간이 많으므로)
int ioThreads = cpuCores * 2;

// DB 작업: 커넥션 풀 크기 이하로 설정
// HikariCP maxPoolSize = 10이라면, gridSize는 8 이하 권장
```

### 청크 크기와 병렬 처리 조합

```java
// 총 10만 건, 4개 파티션, 청크 크기 100
// - 각 파티션: 2만 5천 건
// - 각 파티션당 250회 트랜잭션
// - 총 커밋: 1000회 (단일 스레드 대비 4배 빠름)

// 청크가 너무 크면: 메모리 사용량 증가, 실패 시 재처리 범위 커짐
// 청크가 너무 작으면: 트랜잭션 오버헤드 증가
// 권장: 100 ~ 1000 사이에서 벤치마크
```

### 파티셔닝 모니터링

```java
// Manager Step이 생성한 파티션 목록 확인
@AfterJob
public void logPartitions(JobExecution jobExecution) {
    jobExecution.getStepExecutions().forEach(stepExecution -> {
        log.info("Step: {}, ReadCount: {}, WriteCount: {}, Status: {}",
                stepExecution.getStepName(),
                stepExecution.getReadCount(),
                stepExecution.getWriteCount(),
                stepExecution.getStatus());
    });
}
```
