---
title: "Spring Batch: JobParameters와 @StepScope/@JobScope"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "job-parameters", "stepscope", "jobscope"]
---

## JobParameters 개요

`JobParameters`는 Job 실행 시 전달하는 외부 입력값이다. 동일한 Job도 파라미터가 다르면 새로운 `JobInstance`로 취급된다. 타입은 `String`, `Long`, `Double`, `Date`를 지원하며, Spring Batch 5.x부터는 `LocalDate`, `LocalDateTime`을 직접 지원하지 않으므로 `String`으로 받아 파싱한다.

---

## JobParameters에서 값 꺼내는 방법

### 방법 1: @Value SpEL Late Binding (권장)

가장 선언적이고 간결한 방법. 반드시 `@StepScope` 또는 `@JobScope`와 함께 사용해야 한다.

```java
@Bean
@StepScope
public JdbcCursorItemReader<Order> orderReader(
        @Value("#{jobParameters['targetDate']}") String targetDate,
        @Value("#{jobParameters['batchSize']}") Long batchSize) {

    LocalDate date = LocalDate.parse(targetDate);  // String → LocalDate 파싱
    log.info("처리 대상 날짜: {}, 배치 크기: {}", date, batchSize);

    return new JdbcCursorItemReaderBuilder<Order>()
            .name("orderReader")
            .dataSource(dataSource)
            .sql("SELECT * FROM orders WHERE order_date = ? AND status = 'PENDING'")
            .preparedStatementSetter(ps -> ps.setString(1, targetDate))
            .rowMapper(new BeanPropertyRowMapper<>(Order.class))
            .build();
}
```

### 방법 2: StepExecution에서 직접 꺼내기

`StepExecution`을 직접 주입받아 파라미터를 꺼낼 수 있다. 복잡한 로직이 필요할 때 유용하다.

```java
@Bean
@StepScope
public ItemProcessor<Order, ProcessedOrder> orderProcessor() {
    return new ItemProcessor<Order, ProcessedOrder>() {

        @BeforeStep
        public void beforeStep(StepExecution stepExecution) {
            // StepExecution에서 JobParameters 접근
            JobParameters params = stepExecution.getJobParameters();
            String targetDate = params.getString("targetDate");
            Long discountRate = params.getLong("discountRate");
            log.info("Processor 초기화 - targetDate: {}, discountRate: {}", targetDate, discountRate);
        }

        @Override
        public ProcessedOrder process(Order order) {
            // 처리 로직
            ProcessedOrder processed = new ProcessedOrder();
            processed.setOrderId(order.getId());
            processed.setProcessedAt(LocalDateTime.now());
            return processed;
        }
    };
}
```

### 방법 3: @BeforeStep으로 StepExecution 주입받기

컴포넌트를 별도 클래스로 분리할 때 이 방식이 명확하다.

```java
@Component
@StepScope
public class OrderItemProcessor implements ItemProcessor<Order, ProcessedOrder> {

    private String targetDate;
    private Double discountRate;

    @BeforeStep
    public void retrieveInterStepData(StepExecution stepExecution) {
        JobParameters jobParameters = stepExecution.getJobParameters();
        this.targetDate = jobParameters.getString("targetDate");

        // Double 타입 파라미터 (JobParameters에서는 Double로 저장)
        Double rate = jobParameters.getDouble("discountRate");
        this.discountRate = rate != null ? rate : 0.0;

        // 이전 Step에서 저장한 데이터도 꺼낼 수 있음
        ExecutionContext jobContext = stepExecution.getJobExecution().getExecutionContext();
        Integer totalCount = (Integer) jobContext.get("totalCount");
    }

    @Override
    public ProcessedOrder process(Order order) {
        ProcessedOrder processed = new ProcessedOrder();
        processed.setOrderId(order.getId());
        processed.setDiscountAmount(order.getAmount() * discountRate);
        processed.setTargetDate(LocalDate.parse(targetDate));
        return processed;
    }
}
```

### JobParameters 타입 변환: String → LocalDate 파싱 패턴

```java
@Component
public class DateJobParameterConverter {

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /**
     * "2026-03-27" 형식의 String → LocalDate
     */
    public static LocalDate toLocalDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            return LocalDate.now();  // 기본값: 오늘
        }
        try {
            return LocalDate.parse(dateStr, FORMATTER);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(
                    "날짜 형식이 올바르지 않습니다. 예: 2026-03-27. 입력값: " + dateStr, e);
        }
    }

    /**
     * JobParameters 생성 헬퍼
     */
    public static JobParameters createWithDate(String targetDate) {
        return new JobParametersBuilder()
                .addString("targetDate", targetDate)
                .addLong("timestamp", System.currentTimeMillis())  // 중복 실행 방지
                .toJobParameters();
    }
}

// 사용 예시
@Bean
@StepScope
public JdbcCursorItemReader<Order> orderReader(
        @Value("#{jobParameters['targetDate']}") String targetDateStr) {

    LocalDate targetDate = DateJobParameterConverter.toLocalDate(targetDateStr);
    String formattedDate = targetDate.format(DateTimeFormatter.ISO_LOCAL_DATE);

    return new JdbcCursorItemReaderBuilder<Order>()
            .name("orderReader")
            .dataSource(dataSource)
            .sql("SELECT * FROM orders WHERE DATE(created_at) = '" + formattedDate + "'")
            .rowMapper(new BeanPropertyRowMapper<>(Order.class))
            .build();
}
```

---

## @StepScope 완전 이해

### @StepScope 없이 SpEL을 쓰면 왜 null이 뜨는가

Spring 컨테이너는 애플리케이션 시작 시 빈을 초기화한다. 이때 `JobParameters`는 아직 존재하지 않는다. Job은 나중에 실행될 때 파라미터를 받기 때문이다.

```java
// 잘못된 코드 - @StepScope 없이 SpEL 사용
@Bean
// @StepScope 빠짐!
public JdbcCursorItemReader<Order> brokenReader(
        @Value("#{jobParameters['targetDate']}") String targetDate) {
    // 애플리케이션 시작 시 빈 초기화 → 이 시점에 jobParameters가 없음
    // targetDate = null 또는 SpEL 평가 실패로 NPE/예외 발생
    log.info("targetDate: {}", targetDate);  // null 출력
    return new JdbcCursorItemReaderBuilder<Order>()
            .name("brokenReader")
            .dataSource(dataSource)
            .sql("SELECT * FROM orders WHERE order_date = '" + targetDate + "'")  // NPE!
            .rowMapper(new BeanPropertyRowMapper<>(Order.class))
            .build();
}
```

### Step 빌드 시점 vs Step 실행 시점

```
애플리케이션 시작
    │
    ├── @Bean 메서드 실행 (빌드 시점)
    │       jobParameters = null  ← 아직 없음!
    │
    └── Job 실행 (실행 시점)
            jobParameters = {targetDate=2026-03-27, ...}  ← 이때 존재
```

### Lazy Proxy 동작 원리

`@StepScope`를 붙이면 Spring이 실제 빈 대신 **프록시 객체**를 반환한다. Step이 실제로 실행될 때 프록시가 실제 빈을 생성하고, 이 시점에 `jobParameters`가 존재하므로 SpEL 평가가 성공한다.

```java
// @StepScope가 동작하는 방식 (내부 원리 설명)
//
// 1. 애플리케이션 시작: Spring이 Proxy 빈 등록
//    getBean("orderReader") → ScopedProxyFactoryBean (실제 Reader 아님)
//
// 2. Job 실행 시작: Step이 Reader를 사용할 때
//    Proxy.read() 호출 → 이때 실제 JdbcCursorItemReader 생성
//    → @Value SpEL 평가 → jobParameters['targetDate'] = "2026-03-27" (정상!)
//
// 3. Step 종료: Proxy가 실제 빈을 소멸시킴

@Bean
@StepScope  // Proxy로 감싸서 Step 실행 시점에 빈 생성
public JdbcCursorItemReader<Order> orderReader(
        @Value("#{jobParameters['targetDate']}") String targetDate) {
    // 이 코드는 Step 실행 시점에 호출됨 → jobParameters 존재
    return new JdbcCursorItemReaderBuilder<Order>()
            .name("orderReader")
            .dataSource(dataSource)
            .sql("SELECT * FROM orders WHERE order_date = ?")
            .preparedStatementSetter(ps -> ps.setString(1, targetDate))
            .rowMapper(new BeanPropertyRowMapper<>(Order.class))
            .build();
}
```

### @StepScope 적용 가능 대상

```java
// ItemReader
@Bean
@StepScope
public JdbcCursorItemReader<Order> orderReader(
        @Value("#{jobParameters['targetDate']}") String targetDate) { ... }

// ItemProcessor
@Bean
@StepScope
public ItemProcessor<Order, ProcessedOrder> orderProcessor(
        @Value("#{jobParameters['discountRate']}") Double discountRate) { ... }

// ItemWriter
@Bean
@StepScope
public FlatFileItemWriter<ProcessedOrder> resultWriter(
        @Value("#{jobParameters['outputPath']}") String outputPath) { ... }

// Tasklet
@Bean
@StepScope
public Tasklet cleanupTasklet(
        @Value("#{jobParameters['targetDate']}") String targetDate) {
    return (contribution, chunkContext) -> {
        log.info("{} 날짜 임시 파일 정리", targetDate);
        return RepeatStatus.FINISHED;
    };
}
```

### 전체 코드 예제: @StepScope ItemReader가 targetDate를 쿼리 조건으로 사용

```java
@Configuration
@RequiredArgsConstructor
public class DateBasedJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final DataSource dataSource;

    @Bean
    public Job dateBasedJob() {
        return new JobBuilder("dateBasedJob", jobRepository)
                .start(processOrderStep())
                .next(generateReportStep())
                .build();
    }

    @Bean
    public Step processOrderStep() {
        return new StepBuilder("processOrderStep", jobRepository)
                .<Order, ProcessedOrder>chunk(100, transactionManager)
                .reader(orderReader(null))    // null은 Late Binding 자리 표시자
                .processor(orderProcessor(null))
                .writer(processedOrderWriter(null))
                .build();
    }

    @Bean
    @StepScope
    public JdbcCursorItemReader<Order> orderReader(
            @Value("#{jobParameters['targetDate']}") String targetDate) {

        LocalDate date = LocalDate.parse(targetDate);
        log.info("[orderReader] 처리 날짜: {}", date);

        return new JdbcCursorItemReaderBuilder<Order>()
                .name("orderReader")
                .dataSource(dataSource)
                .sql("""
                     SELECT id, product_id, customer_id, amount, status
                     FROM orders
                     WHERE DATE(created_at) = ?
                       AND status = 'PENDING'
                     ORDER BY id
                     """)
                .preparedStatementSetter(ps -> ps.setString(1, targetDate))
                .rowMapper((rs, rowNum) -> {
                    Order order = new Order();
                    order.setId(rs.getLong("id"));
                    order.setProductId(rs.getLong("product_id"));
                    order.setCustomerId(rs.getLong("customer_id"));
                    order.setAmount(rs.getBigDecimal("amount"));
                    order.setStatus(rs.getString("status"));
                    return order;
                })
                .build();
    }

    @Bean
    @StepScope
    public ItemProcessor<Order, ProcessedOrder> orderProcessor(
            @Value("#{jobParameters['targetDate']}") String targetDate) {
        return order -> {
            ProcessedOrder processed = new ProcessedOrder();
            processed.setOrderId(order.getId());
            processed.setTargetDate(LocalDate.parse(targetDate));
            processed.setFinalAmount(order.getAmount());
            processed.setProcessedAt(LocalDateTime.now());
            return processed;
        };
    }

    @Bean
    @StepScope
    public FlatFileItemWriter<ProcessedOrder> processedOrderWriter(
            @Value("#{jobParameters['targetDate']}") String targetDate) {

        return new FlatFileItemWriterBuilder<ProcessedOrder>()
                .name("processedOrderWriter")
                .resource(new FileSystemResource("/output/orders_" + targetDate + ".csv"))
                .delimited()
                .delimiter(",")
                .names("orderId", "targetDate", "finalAmount", "processedAt")
                .build();
    }

    @Bean
    public Step generateReportStep() {
        return new StepBuilder("generateReportStep", jobRepository)
                .tasklet(reportTasklet(null), transactionManager)
                .build();
    }

    @Bean
    @StepScope
    public Tasklet reportTasklet(
            @Value("#{jobParameters['targetDate']}") String targetDate) {
        return (contribution, chunkContext) -> {
            // Step 실행 통계 조회
            StepExecution stepExecution = chunkContext.getStepContext().getStepExecution();
            JobExecution jobExecution = stepExecution.getJobExecution();

            // 이전 Step 결과 조회
            Optional<StepExecution> processStep = jobExecution.getStepExecutions()
                    .stream()
                    .filter(se -> se.getStepName().equals("processOrderStep"))
                    .findFirst();

            processStep.ifPresent(se ->
                    log.info("[리포트] {} 처리 완료 - 읽기: {}, 쓰기: {}, 건너뜀: {}",
                            targetDate, se.getReadCount(), se.getWriteCount(), se.getSkipCount()));

            return RepeatStatus.FINISHED;
        };
    }
}
```

---

## @JobScope

`@JobScope`는 `@StepScope`와 유사하지만 생명주기가 Job 레벨이다. Job 실행 시 생성되고 Job 종료 시 소멸한다.

```java
// @JobScope는 Step 빈 자체에 적용할 수 있음
@Bean
@JobScope
public Step conditionalStep(
        @Value("#{jobParameters['mode']}") String mode) {

    if ("FULL".equals(mode)) {
        return fullProcessingStep();
    } else {
        return incrementalProcessingStep();
    }
}

// Job 공통 설정 빈에도 활용
@Bean
@JobScope
public JobScopedConfig jobConfig(
        @Value("#{jobParameters['batchSize']}") Long batchSize,
        @Value("#{jobParameters['targetDate']}") String targetDate) {
    return new JobScopedConfig(batchSize.intValue(), LocalDate.parse(targetDate));
}
```

### @StepScope vs @JobScope 비교

| 항목 | @StepScope | @JobScope |
|------|-----------|-----------|
| **생성 시점** | Step 실행 시작 | Job 실행 시작 |
| **소멸 시점** | Step 실행 종료 | Job 실행 종료 |
| **SpEL 접근** | `jobParameters`, `stepExecutionContext` | `jobParameters`, `jobExecutionContext` |
| **적용 대상** | Reader, Processor, Writer, Tasklet | Step 빈, Job 레벨 공통 컴포넌트 |
| **주요 용도** | 파라미터 기반 Reader/Processor/Writer | Step 간 공유 설정, 조건부 Step 구성 |

---

## Job 실행 방식

### 1. CommandLineJobRunner로 CLI 실행

```bash
# Fat JAR로 실행
java -jar batch-application.jar \
  --spring.batch.job.name=dateBasedJob \
  targetDate=2026-03-27 \
  batchSize=500

# Spring Boot 실행 인수 형식
java -jar batch-application.jar \
  targetDate=2026-03-27 \
  "outputPath=/output/result.csv"
```

### 2. 자동 실행 비활성화

```yaml
# application.yml
spring:
  batch:
    job:
      enabled: false    # 애플리케이션 시작 시 자동 실행 방지
      name: dateBasedJob  # 특정 Job만 실행 (자동 실행 시)
```

자동 실행을 비활성화하는 이유: 웹 애플리케이션에 배치가 함께 있는 경우, 서버 재시작마다 배치가 돌지 않도록 하기 위해서다.

### 3. 프로그래밍 방식: JobLauncher.run() (REST API로 트리거)

```java
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/batch")
public class BatchController {

    private final JobLauncher jobLauncher;
    private final Job dateBasedJob;

    @PostMapping("/trigger")
    public ResponseEntity<String> triggerBatch(
            @RequestParam String targetDate,
            @RequestParam(defaultValue = "100") Long batchSize) {

        try {
            JobParameters params = new JobParametersBuilder()
                    .addString("targetDate", targetDate)
                    .addLong("batchSize", batchSize)
                    .addLong("timestamp", System.currentTimeMillis())  // 동일 날짜 재실행 허용
                    .toJobParameters();

            JobExecution execution = jobLauncher.run(dateBasedJob, params);

            return ResponseEntity.ok(
                    "Job 실행 시작 - ID: " + execution.getId() +
                    ", 상태: " + execution.getStatus());

        } catch (JobExecutionAlreadyRunningException e) {
            return ResponseEntity.status(409).body("이미 실행 중인 Job입니다.");
        } catch (JobInstanceAlreadyCompleteException e) {
            return ResponseEntity.status(409).body("이미 완료된 Job입니다. timestamp를 변경하여 재실행하세요.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Job 실행 실패: " + e.getMessage());
        }
    }
}
```

### 4. 비동기 JobLauncher 설정

기본 `JobLauncher`는 동기식이라 Job이 완료될 때까지 블로킹된다. REST API에서 호출할 때는 비동기로 설정해야 한다.

```java
@Configuration
public class AsyncJobLauncherConfig {

    @Bean
    public JobLauncher asyncJobLauncher(JobRepository jobRepository) {
        TaskExecutorJobLauncher jobLauncher = new TaskExecutorJobLauncher();
        jobLauncher.setJobRepository(jobRepository);
        jobLauncher.setTaskExecutor(new SimpleAsyncTaskExecutor());  // 비동기 실행
        return jobLauncher;
    }
}

// REST API에서 비동기 JobLauncher 주입
@RestController
@RequiredArgsConstructor
public class AsyncBatchController {

    @Qualifier("asyncJobLauncher")
    private final JobLauncher asyncJobLauncher;
    private final Job dateBasedJob;

    @PostMapping("/api/batch/async-trigger")
    public ResponseEntity<String> asyncTrigger(@RequestParam String targetDate) throws Exception {
        JobParameters params = new JobParametersBuilder()
                .addString("targetDate", targetDate)
                .addLong("timestamp", System.currentTimeMillis())
                .toJobParameters();

        // 즉시 반환 (Job은 백그라운드에서 실행)
        JobExecution execution = asyncJobLauncher.run(dateBasedJob, params);
        return ResponseEntity.accepted().body("Job 제출 완료 - ID: " + execution.getId());
    }
}
```

### 5. JobOperator로 실행 중인 Job 관리

```java
@Service
@RequiredArgsConstructor
public class BatchOperationService {

    private final JobOperator jobOperator;
    private final JobExplorer jobExplorer;

    /**
     * 실행 중인 Job 중지
     */
    public void stopJob(Long executionId) throws Exception {
        boolean stopped = jobOperator.stop(executionId);
        log.info("Job {} 중지 요청 결과: {}", executionId, stopped);
    }

    /**
     * 실패한 Job 재시작
     */
    public Long restartJob(Long executionId) throws Exception {
        Long newExecutionId = jobOperator.restart(executionId);
        log.info("Job {} 재시작 → 새 실행 ID: {}", executionId, newExecutionId);
        return newExecutionId;
    }

    /**
     * 특정 Job의 최근 실행 이력 조회
     */
    public List<JobExecution> getRecentExecutions(String jobName, int count) {
        return jobExplorer.findJobInstancesByJobName(jobName, 0, count)
                .stream()
                .flatMap(instance -> jobExplorer.getJobExecutions(instance).stream())
                .sorted(Comparator.comparing(JobExecution::getStartTime).reversed())
                .limit(count)
                .collect(Collectors.toList());
    }

    /**
     * 현재 실행 중인 Job 목록
     */
    public Set<Long> getRunningJobIds(String jobName) throws Exception {
        return jobOperator.getRunningExecutions(jobName);
    }
}
```

---

## 실무 팁

### JobParameters 설계 원칙

```java
// 좋은 JobParameters 설계
JobParameters params = new JobParametersBuilder()
        .addString("targetDate", "2026-03-27")      // 비즈니스 의미 있는 파라미터
        .addString("mode", "FULL")                   // 실행 모드 구분
        .addLong("timestamp", System.currentTimeMillis()) // 재실행 허용 키
        .toJobParameters();

// 피해야 할 패턴
// - 환경 설정값을 JobParameters로 (DB URL, 패스워드 등) → application.yml로
// - 너무 많은 파라미터 → Job이 너무 많은 책임을 가진다는 신호
// - 파라미터 없이 timestamp만 사용 → 이력 추적이 어려워짐
```

### @StepScope 적용 시 주의사항

```java
// Step 빈 선언 시 null 전달 패턴 (Late Binding 자리 표시자)
@Bean
public Step myStep() {
    return new StepBuilder("myStep", jobRepository)
            .<Order, ProcessedOrder>chunk(100, transactionManager)
            .reader(orderReader(null))      // null → Spring이 실행 시 실제 값으로 채움
            .processor(orderProcessor(null))
            .writer(orderWriter(null))
            .build();
}

// Step 선언 자체에 @StepScope를 붙이지 말 것
// Step은 싱글턴이어야 하며, @StepScope는 Reader/Processor/Writer에 붙인다
```
