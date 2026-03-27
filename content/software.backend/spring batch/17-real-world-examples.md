---
title: "Spring Batch: 실전 예제 — 정산 배치와 대용량 마이그레이션"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "examples", "settlement", "migration"]
---

## 개요

이 글에서는 실무에서 자주 접하는 세 가지 배치 시나리오를 전체 코드와 함께 설명한다. 주문 정산 배치, 대용량 DB 마이그레이션, FTP 파일 가져오기 배치를 통해 Spring Batch의 실전 활용 패턴을 익힌다.

---

## 예제 1: 주문 정산 배치 (전체 코드)

### 시나리오

매일 새벽 2시, 전날 완료된 주문을 집계해 정산 테이블에 저장한다. 정산 실패한 주문은 별도 오류 테이블에 기록하고, 정산 완료 후 담당자에게 Slack 알림을 발송한다.

### 도메인 모델

```java
@Data
@Builder
public class Order {
    private Long id;
    private Long userId;
    private BigDecimal amount;
    private String orderType;   // NORMAL, SUBSCRIPTION, B2B
    private String status;      // COMPLETED, CANCELLED
    private boolean settled;
    private LocalDateTime createdAt;
}

@Data
@Builder
public class Settlement {
    private Long orderId;
    private Long userId;
    private BigDecimal grossAmount;
    private BigDecimal fee;
    private BigDecimal netAmount;
    private LocalDate targetDate;
    private LocalDateTime settledAt;
}
```

### Job 전체 구성

```java
@Configuration
@RequiredArgsConstructor
@Slf4j
public class SettlementJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    /**
     * 3단계 Job 구성:
     * Step 1: 주문 집계 및 정산 테이블 저장
     * Step 2: 정산 완료 상태 업데이트
     * Step 3: 정산 결과 Slack 알림
     */
    @Bean
    public Job settlementJob(Step aggregationStep,
                             Step statusUpdateStep,
                             Step notificationStep,
                             SettlementJobListener jobListener) {
        return new JobBuilder("settlementJob", jobRepository)
            .start(aggregationStep)
            .next(statusUpdateStep)
            .next(notificationStep)
            .listener(jobListener)
            .build();
    }

    // ===== Step 1: 정산 집계 =====

    @Bean
    public Step aggregationStep(
            SettlementItemReader reader,
            SettlementItemProcessor processor,
            SettlementItemWriter writer,
            SettlementSkipListener skipListener) {
        return new StepBuilder("aggregationStep", jobRepository)
            .<Order, Settlement>chunk(500, transactionManager)
            .reader(reader)
            .processor(processor)
            .writer(writer)
            .faultTolerant()
            .skipLimit(1000)                                     // 최대 1,000건까지 Skip 허용
            .skip(InvalidOrderException.class)                   // 유효하지 않은 주문 Skip
            .skip(SettlementCalculationException.class)          // 계산 오류 Skip
            .noSkip(DataAccessException.class)                   // DB 오류는 Skip 금지
            .listener(skipListener)
            .build();
    }

    // ===== Step 2: 정산 완료 상태 업데이트 =====

    @Bean
    public Step statusUpdateStep(JdbcTemplate jdbcTemplate) {
        return new StepBuilder("statusUpdateStep", jobRepository)
            .tasklet((contribution, chunkContext) -> {
                String targetDate = (String) chunkContext.getStepContext()
                    .getJobParameters().get("targetDate");

                int updatedCount = jdbcTemplate.update("""
                    UPDATE orders
                    SET settled = true, settled_at = NOW()
                    WHERE DATE(created_at) = ?
                      AND status = 'COMPLETED'
                      AND settled = false
                    """, targetDate);

                log.info("정산 완료 상태 업데이트 - targetDate={}, count={}", targetDate, updatedCount);

                // 다음 Step에 전달할 통계 저장
                chunkContext.getStepContext()
                    .getStepExecution()
                    .getJobExecution()
                    .getExecutionContext()
                    .putInt("updatedOrderCount", updatedCount);

                return RepeatStatus.FINISHED;
            }, transactionManager)
            .build();
    }

    // ===== Step 3: Slack 알림 =====

    @Bean
    public Step notificationStep(SlackNotificationService slackService) {
        return new StepBuilder("notificationStep", jobRepository)
            .tasklet((contribution, chunkContext) -> {
                ExecutionContext jobContext = chunkContext.getStepContext()
                    .getStepExecution()
                    .getJobExecution()
                    .getExecutionContext();

                String targetDate = (String) chunkContext.getStepContext()
                    .getJobParameters().get("targetDate");
                int settledCount = jobContext.getInt("updatedOrderCount", 0);
                long skipCount = chunkContext.getStepContext()
                    .getStepExecution()
                    .getJobExecution()
                    .getStepExecutions()
                    .stream()
                    .filter(s -> s.getStepName().equals("aggregationStep"))
                    .mapToLong(s -> s.getSkipCount())
                    .sum();

                slackService.sendMessage("""
                    [정산 배치 완료] 📊
                    - 대상 날짜: %s
                    - 정산 건수: %,d건
                    - Skip 건수: %,d건
                    """.formatted(targetDate, settledCount, skipCount));

                return RepeatStatus.FINISHED;
            }, transactionManager)
            .build();
    }
}
```

### Reader: @StepScope와 날짜 기반 쿼리

```java
@Component
@StepScope
@RequiredArgsConstructor
@Slf4j
public class SettlementItemReader implements ItemStreamReader<Order> {

    private final DataSource dataSource;

    @Value("#{jobParameters['targetDate']}")
    private String targetDate;  // 5.x: LocalDate 타입으로도 사용 가능

    private JdbcCursorItemReader<Order> delegate;

    @PostConstruct
    public void init() {
        log.info("SettlementItemReader 초기화 - targetDate={}", targetDate);

        this.delegate = new JdbcCursorItemReaderBuilder<Order>()
            .name("settlementOrderReader")
            .dataSource(dataSource)
            .sql("""
                SELECT id, user_id, amount, order_type, status, created_at
                FROM orders
                WHERE DATE(created_at) = ?
                  AND status = 'COMPLETED'
                  AND settled = false
                ORDER BY id
                """)
            .preparedStatementSetter(ps -> ps.setString(1, targetDate))
            .rowMapper(new BeanPropertyRowMapper<>(Order.class))
            .fetchSize(500)
            .build();
    }

    @Override
    public Order read() throws Exception { return delegate.read(); }

    @Override
    public void open(ExecutionContext ctx) throws ItemStreamException { delegate.open(ctx); }

    @Override
    public void update(ExecutionContext ctx) throws ItemStreamException { delegate.update(ctx); }

    @Override
    public void close() throws ItemStreamException { delegate.close(); }
}
```

### Processor: 정산 금액 계산

```java
@Component
@RequiredArgsConstructor
public class SettlementItemProcessor implements ItemProcessor<Order, Settlement> {

    private final FeeCalculationService feeService;

    @Value("#{jobParameters['targetDate']}")
    private String targetDate;

    @Override
    public Settlement process(Order order) throws Exception {
        // 검증
        if (order.getAmount() == null || order.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidOrderException(
                "유효하지 않은 주문 금액: orderId=" + order.getId());
        }

        // 수수료 계산 (주문 타입별 차등 적용)
        BigDecimal fee = feeService.calculateFee(order.getAmount(), order.getOrderType());
        BigDecimal netAmount = order.getAmount().subtract(fee);

        return Settlement.builder()
            .orderId(order.getId())
            .userId(order.getUserId())
            .grossAmount(order.getAmount())
            .fee(fee)
            .netAmount(netAmount)
            .targetDate(LocalDate.parse(targetDate))
            .settledAt(LocalDateTime.now())
            .build();
    }
}
```

### Writer: UPSERT로 멱등성 보장

```java
@Component
@RequiredArgsConstructor
public class SettlementItemWriter implements ItemWriter<Settlement> {

    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbc;

    @Override
    public void write(Chunk<? extends Settlement> chunk) throws Exception {
        List<? extends Settlement> items = chunk.getItems();

        // MySQL UPSERT: 같은 order_id로 재실행해도 안전
        namedJdbc.batchUpdate("""
            INSERT INTO settlements (order_id, user_id, gross_amount, fee, net_amount,
                                     target_date, settled_at)
            VALUES (:orderId, :userId, :grossAmount, :fee, :netAmount,
                    :targetDate, :settledAt)
            ON DUPLICATE KEY UPDATE
                gross_amount = VALUES(gross_amount),
                fee          = VALUES(fee),
                net_amount   = VALUES(net_amount),
                settled_at   = VALUES(settled_at)
            """,
            items.stream()
                .map(BeanPropertySqlParameterSource::new)
                .toArray(SqlParameterSource[]::new)
        );

        log.debug("정산 저장 완료 - count={}", items.size());
    }
}
```

### SkipListener: 정산 실패 주문 기록

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class SettlementSkipListener implements SkipListener<Order, Settlement> {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void onSkipInProcess(Order item, Throwable t) {
        log.warn("정산 Skip - orderId={}, reason={}", item.getId(), t.getMessage());

        // 실패 이력 기록
        jdbcTemplate.update("""
            INSERT INTO settlement_errors (order_id, error_message, skipped_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                error_message = VALUES(error_message),
                skipped_at    = VALUES(skipped_at)
            """,
            item.getId(), t.getMessage()
        );
    }

    @Override
    public void onSkipInWrite(Settlement item, Throwable t) {
        log.error("정산 쓰기 Skip - orderId={}, error={}", item.getOrderId(), t.getMessage());
        jdbcTemplate.update("""
            INSERT INTO settlement_errors (order_id, error_message, skipped_at)
            VALUES (?, ?, NOW())
            """, item.getOrderId(), t.getMessage());
    }
}
```

---

## 예제 2: 대용량 사용자 데이터 마이그레이션 배치

### 시나리오

레거시 DB의 `legacy_users` 테이블(1,000만 건)을 신규 DB의 `users` 테이블로 마이그레이션한다. ID 범위로 10개 파티션을 나눠 병렬 처리한다.

### ColumnRangePartitioner 구현

```java
@Component
@RequiredArgsConstructor
public class ColumnRangePartitioner implements Partitioner {

    private final JdbcTemplate jdbcTemplate;
    private final String tableName;
    private final String columnName;

    @Override
    public Map<String, ExecutionContext> partition(int gridSize) {
        // 전체 ID 범위 조회
        Map<String, Object> minMax = jdbcTemplate.queryForMap(
            "SELECT MIN(%s) AS min_id, MAX(%s) AS max_id FROM %s"
                .formatted(columnName, columnName, tableName)
        );

        long minId = ((Number) minMax.get("min_id")).longValue();
        long maxId = ((Number) minMax.get("max_id")).longValue();
        long rangeSize = (maxId - minId) / gridSize + 1;

        Map<String, ExecutionContext> partitions = new LinkedHashMap<>();

        for (int i = 0; i < gridSize; i++) {
            long partitionMin = minId + (rangeSize * i);
            long partitionMax = Math.min(partitionMin + rangeSize - 1, maxId);

            ExecutionContext context = new ExecutionContext();
            context.putLong("minId", partitionMin);
            context.putLong("maxId", partitionMax);
            context.putInt("partitionIndex", i);

            partitions.put("partition-" + i, context);
            log.info("파티션 생성 - index={}, min={}, max={}", i, partitionMin, partitionMax);
        }

        return partitions;
    }
}
```

### 마이그레이션 Job 전체 구성

```java
@Configuration
@RequiredArgsConstructor
@Slf4j
public class UserMigrationJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final ColumnRangePartitioner partitioner;

    @Bean
    public Job userMigrationJob(Step partitionedMigrationStep) {
        return new JobBuilder("userMigrationJob", jobRepository)
            .start(partitionedMigrationStep)
            .listener(migrationJobListener())
            .build();
    }

    /**
     * Manager Step: 파티션을 나눠 Worker Step들에게 위임
     */
    @Bean
    public Step partitionedMigrationStep(Step workerMigrationStep) {
        // 파티셔너에 테이블/컬럼 정보 주입
        partitioner.setTableName("legacy_users");
        partitioner.setColumnName("id");

        return new StepBuilder("partitionedMigrationStep", jobRepository)
            .partitioner("workerMigrationStep", partitioner)
            .step(workerMigrationStep)
            .gridSize(10)                           // 10개 파티션
            .taskExecutor(migrationTaskExecutor())  // 병렬 실행
            .build();
    }

    /**
     * Worker Step: 각 파티션의 ID 범위를 처리
     */
    @Bean
    public Step workerMigrationStep(
            ItemReader<LegacyUser> legacyUserReader,
            ItemProcessor<LegacyUser, User> userTransformProcessor,
            ItemWriter<User> newUserWriter) {
        return new StepBuilder("workerMigrationStep", jobRepository)
            .<LegacyUser, User>chunk(1000, transactionManager)
            .reader(legacyUserReader)
            .processor(userTransformProcessor)
            .writer(newUserWriter)
            .faultTolerant()
            .retryLimit(3)
            .retry(TransientDataAccessException.class)
            .build();
    }

    @Bean
    public TaskExecutor migrationTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);      // 파티션 수와 동일
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(0);
        executor.setThreadNamePrefix("migration-");
        executor.initialize();
        return executor;
    }
}
```

### Worker Reader: 파티션 범위 기반 읽기

```java
@Bean
@StepScope
public JdbcCursorItemReader<LegacyUser> legacyUserReader(
        @Qualifier("legacyDataSource") DataSource legacyDataSource,
        @Value("#{stepExecutionContext['minId']}") Long minId,
        @Value("#{stepExecutionContext['maxId']}") Long maxId) {

    log.info("LegacyUserReader 생성 - minId={}, maxId={}", minId, maxId);

    return new JdbcCursorItemReaderBuilder<LegacyUser>()
        .name("legacyUserReader")
        .dataSource(legacyDataSource)
        .sql("""
            SELECT id, username, email, phone, created_date, status
            FROM legacy_users
            WHERE id BETWEEN ? AND ?
            ORDER BY id
            """)
        .preparedStatementSetter(ps -> {
            ps.setLong(1, minId);
            ps.setLong(2, maxId);
        })
        .rowMapper(new BeanPropertyRowMapper<>(LegacyUser.class))
        .fetchSize(1000)
        .build();
}
```

### Processor: 레거시 → 신규 도메인 변환

```java
@Component
public class UserTransformProcessor implements ItemProcessor<LegacyUser, User> {

    @Override
    public User process(LegacyUser legacy) throws Exception {
        // 레거시 데이터 정제
        String normalizedPhone = normalizePhone(legacy.getPhone());
        UserStatus status = mapStatus(legacy.getStatus());

        // null 검사
        if (legacy.getEmail() == null || legacy.getEmail().isBlank()) {
            // 이메일 없는 레거시 계정은 Skip (null 반환)
            log.warn("이메일 없는 레거시 유저 Skip - legacyId={}", legacy.getId());
            return null;
        }

        return User.builder()
            .legacyId(legacy.getId())
            .username(legacy.getUsername().trim())
            .email(legacy.getEmail().toLowerCase().trim())
            .phone(normalizedPhone)
            .status(status)
            .createdAt(legacy.getCreatedDate().toLocalDateTime())
            .migratedAt(LocalDateTime.now())
            .build();
    }

    private String normalizePhone(String phone) {
        if (phone == null) return null;
        return phone.replaceAll("[^0-9]", "");  // 숫자만 추출
    }

    private UserStatus mapStatus(String legacyStatus) {
        return switch (legacyStatus) {
            case "A", "ACTIVE"   -> UserStatus.ACTIVE;
            case "I", "INACTIVE" -> UserStatus.INACTIVE;
            case "D", "DELETED"  -> UserStatus.WITHDRAWN;
            default              -> UserStatus.INACTIVE;
        };
    }
}
```

### 진행 상황 모니터링 쿼리

```sql
-- 현재 실행 중인 Job 전체 진행 상황
SELECT
    ji.JOB_NAME,
    je.JOB_EXECUTION_ID,
    je.STATUS,
    je.START_TIME,
    je.END_TIME,
    se.STEP_NAME,
    se.STATUS AS STEP_STATUS,
    se.READ_COUNT,
    se.WRITE_COUNT,
    se.SKIP_COUNT,
    ROUND(se.WRITE_COUNT * 100.0 /
          NULLIF(se.READ_COUNT + se.WRITE_COUNT, 0), 1) AS PROGRESS_PCT
FROM BATCH_JOB_EXECUTION je
JOIN BATCH_JOB_INSTANCE ji ON je.JOB_INSTANCE_ID = ji.JOB_INSTANCE_ID
JOIN BATCH_STEP_EXECUTION se ON je.JOB_EXECUTION_ID = se.JOB_EXECUTION_ID
WHERE je.STATUS = 'STARTED'
ORDER BY se.START_TIME DESC;

-- 파티션별 처리 현황
SELECT
    se.STEP_NAME,
    se.STATUS,
    se.READ_COUNT,
    se.WRITE_COUNT,
    se.SKIP_COUNT,
    TIMESTAMPDIFF(SECOND, se.START_TIME, COALESCE(se.END_TIME, NOW())) AS ELAPSED_SECONDS
FROM BATCH_STEP_EXECUTION se
JOIN BATCH_JOB_EXECUTION je ON se.JOB_EXECUTION_ID = je.JOB_EXECUTION_ID
WHERE je.JOB_EXECUTION_ID = :jobExecutionId
  AND se.STEP_NAME LIKE 'workerMigrationStep%'
ORDER BY se.STEP_NAME;
```

### 예상 처리 시간 계산

```java
@Component
@RequiredArgsConstructor
public class MigrationProgressEstimator {

    private final JdbcTemplate jdbcTemplate;

    public MigrationEstimate estimate(long jobExecutionId) {
        Map<String, Object> stats = jdbcTemplate.queryForMap("""
            SELECT
                SUM(READ_COUNT) AS total_read,
                SUM(WRITE_COUNT) AS total_written,
                MAX(TIMESTAMPDIFF(SECOND, START_TIME, NOW())) AS elapsed_seconds
            FROM BATCH_STEP_EXECUTION
            WHERE JOB_EXECUTION_ID = ?
              AND STEP_NAME LIKE 'workerMigrationStep%'
            """, jobExecutionId);

        long totalWritten = ((Number) stats.get("total_written")).longValue();
        long elapsedSeconds = ((Number) stats.get("elapsed_seconds")).longValue();
        long totalTarget = getTotalTarget();  // 전체 마이그레이션 대상 건수

        double throughput = elapsedSeconds > 0
            ? (double) totalWritten / elapsedSeconds : 0;
        long remainingItems = totalTarget - totalWritten;
        long estimatedRemainingSeconds = throughput > 0
            ? (long) (remainingItems / throughput) : Long.MAX_VALUE;

        return MigrationEstimate.builder()
            .totalWritten(totalWritten)
            .totalTarget(totalTarget)
            .progressPercent(totalTarget > 0 ? totalWritten * 100.0 / totalTarget : 0)
            .throughputPerSecond((long) throughput)
            .estimatedRemainingSeconds(estimatedRemainingSeconds)
            .build();
    }
}
```

---

## 예제 3: 외부 파일 가져오기 배치 (FTP → DB)

### 시나리오

매일 오전 6시 파트너사 FTP 서버에서 주문 CSV 파일을 내려받아 DB에 저장한다. 잘못된 행은 Skip하고 오류 리포트를 생성한다.

### 전체 Job 구성 (4단계)

```java
@Configuration
@RequiredArgsConstructor
@Slf4j
public class FtpImportJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    @Bean
    public Job ftpImportJob(Step downloadStep,
                            Step importStep,
                            Step moveFileStep) {
        return new JobBuilder("ftpImportJob", jobRepository)
            // 다운로드 → 파싱/저장 → 파일 이동
            .start(downloadStep)
            .next(importStep)
            .next(moveFileStep)
            .build();
    }

    // ===== Step 1: FTP 파일 다운로드 =====

    @Bean
    public Step downloadStep(FtpDownloadTasklet downloadTasklet) {
        return new StepBuilder("downloadStep", jobRepository)
            .tasklet(downloadTasklet, transactionManager)
            .build();
    }

    // ===== Step 2: 파일 파싱 및 DB 저장 =====

    @Bean
    public Step importStep(
            FlatFileItemReader<PartnerOrder> fileReader,
            PartnerOrderValidationProcessor validationProcessor,
            JdbcBatchItemWriter<PartnerOrder> orderWriter,
            ImportErrorListener errorListener) {
        return new StepBuilder("importStep", jobRepository)
            .<PartnerOrder, PartnerOrder>chunk(1000, transactionManager)
            .reader(fileReader)
            .processor(validationProcessor)
            .writer(orderWriter)
            .faultTolerant()
            .skipLimit(500)                           // 최대 500행 Skip
            .skip(FlatFileParseException.class)       // 파싱 오류 Skip
            .skip(InvalidPartnerOrderException.class) // 검증 실패 Skip
            .listener(errorListener)                  // 오류 리포트 생성
            .build();
    }

    // ===== Step 3: 처리 완료 파일 이동 =====

    @Bean
    public Step moveFileStep(FileMoveTasklet moveTasklet) {
        return new StepBuilder("moveFileStep", jobRepository)
            .tasklet(moveTasklet, transactionManager)
            .build();
    }
}
```

### Tasklet: FTP 파일 다운로드

```java
@Component
@StepScope
@RequiredArgsConstructor
@Slf4j
public class FtpDownloadTasklet implements Tasklet {

    private final FTPClient ftpClient;

    @Value("${ftp.host}")
    private String ftpHost;

    @Value("${ftp.remote-path}")
    private String remotePath;

    @Value("${batch.local-temp-dir}")
    private String localTempDir;

    @Value("#{jobParameters['targetDate']}")
    private String targetDate;

    @Override
    public RepeatStatus execute(StepContribution contribution,
                                ChunkContext chunkContext) throws Exception {
        String remoteFile = remotePath + "/orders_" + targetDate + ".csv";
        String localFile = localTempDir + "/orders_" + targetDate + ".csv";

        try {
            ftpClient.connect(ftpHost);
            ftpClient.login(ftpUser, ftpPassword);
            ftpClient.enterLocalPassiveMode();
            ftpClient.setFileType(FTP.BINARY_FILE_TYPE);

            log.info("FTP 파일 다운로드 시작 - remote={}", remoteFile);

            try (FileOutputStream fos = new FileOutputStream(localFile)) {
                boolean success = ftpClient.retrieveFile(remoteFile, fos);
                if (!success) {
                    throw new FtpDownloadException("파일 다운로드 실패: " + remoteFile);
                }
            }

            // 다운로드 완료된 파일 경로를 JobExecutionContext에 저장
            chunkContext.getStepContext()
                .getStepExecution()
                .getJobExecution()
                .getExecutionContext()
                .putString("localFilePath", localFile);

            log.info("FTP 다운로드 완료 - local={}", localFile);
            contribution.incrementWriteCount(1);

        } finally {
            if (ftpClient.isConnected()) {
                ftpClient.logout();
                ftpClient.disconnect();
            }
        }

        return RepeatStatus.FINISHED;
    }
}
```

### FlatFileItemReader: CSV 파일 읽기

```java
@Bean
@StepScope
public FlatFileItemReader<PartnerOrder> partnerOrderFileReader(
        @Value("#{jobExecutionContext['localFilePath']}") String filePath) {

    log.info("CSV 파일 Reader 생성 - file={}", filePath);

    return new FlatFileItemReaderBuilder<PartnerOrder>()
        .name("partnerOrderFileReader")
        .resource(new FileSystemResource(filePath))
        .linesToSkip(1)              // 헤더 행 건너뜀
        .delimited()
        .delimiter(",")
        .names("partnerOrderId", "userId", "productCode", "quantity",
               "unitPrice", "totalAmount", "orderDate")
        .fieldSetMapper(fieldSet -> PartnerOrder.builder()
            .partnerOrderId(fieldSet.readString("partnerOrderId"))
            .userId(fieldSet.readLong("userId"))
            .productCode(fieldSet.readString("productCode"))
            .quantity(fieldSet.readInt("quantity"))
            .unitPrice(fieldSet.readBigDecimal("unitPrice"))
            .totalAmount(fieldSet.readBigDecimal("totalAmount"))
            .orderDate(LocalDate.parse(fieldSet.readString("orderDate")))
            .build())
        .build();
}
```

### Processor: 데이터 검증

```java
@Component
@Slf4j
public class PartnerOrderValidationProcessor
        implements ItemProcessor<PartnerOrder, PartnerOrder> {

    @Override
    public PartnerOrder process(PartnerOrder order) throws Exception {
        List<String> errors = new ArrayList<>();

        // 필수 필드 검증
        if (order.getPartnerOrderId() == null || order.getPartnerOrderId().isBlank()) {
            errors.add("partnerOrderId가 비어있음");
        }

        if (order.getUserId() == null || order.getUserId() <= 0) {
            errors.add("유효하지 않은 userId: " + order.getUserId());
        }

        // 데이터 타입 검증
        if (order.getQuantity() <= 0) {
            errors.add("수량은 0보다 커야 함: " + order.getQuantity());
        }

        if (order.getTotalAmount().compareTo(
                order.getUnitPrice().multiply(BigDecimal.valueOf(order.getQuantity()))) != 0) {
            errors.add("합계 금액 불일치");
        }

        // 날짜 검증 (미래 날짜 주문 불가)
        if (order.getOrderDate().isAfter(LocalDate.now())) {
            errors.add("미래 날짜 주문: " + order.getOrderDate());
        }

        if (!errors.isEmpty()) {
            throw new InvalidPartnerOrderException(
                "주문 검증 실패 - orderId=" + order.getPartnerOrderId() +
                ", errors=" + String.join(", ", errors)
            );
        }

        return order;
    }
}
```

### SkipListener: 오류 리포트 생성

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class ImportErrorListener
        implements SkipListener<PartnerOrder, PartnerOrder>, StepExecutionListener {

    private final List<ErrorReport> errorReports = new ArrayList<>();

    @Value("${batch.error-report-dir}")
    private String errorReportDir;

    private String targetDate;

    @Override
    public void beforeStep(StepExecution stepExecution) {
        this.targetDate = stepExecution.getJobParameters().getString("targetDate");
    }

    @Override
    public void onSkipInRead(Throwable t) {
        if (t instanceof FlatFileParseException e) {
            errorReports.add(ErrorReport.builder()
                .lineNumber(e.getLineNumber())
                .input(e.getInput())
                .reason("파싱 실패: " + t.getMessage())
                .build());
        }
    }

    @Override
    public void onSkipInProcess(PartnerOrder item, Throwable t) {
        errorReports.add(ErrorReport.builder()
            .orderId(item.getPartnerOrderId())
            .reason("검증 실패: " + t.getMessage())
            .build());
    }

    @Override
    public ExitStatus afterStep(StepExecution stepExecution) {
        if (!errorReports.isEmpty()) {
            writeErrorReport();
            log.warn("오류 리포트 생성 - targetDate={}, errorCount={}",
                targetDate, errorReports.size());
        }
        return null;
    }

    private void writeErrorReport() {
        String reportPath = errorReportDir + "/error_report_" + targetDate + ".csv";
        try (PrintWriter writer = new PrintWriter(new FileWriter(reportPath))) {
            writer.println("line_number,order_id,reason");
            errorReports.forEach(r ->
                writer.printf("%s,%s,%s%n", r.getLineNumber(), r.getOrderId(), r.getReason())
            );
        } catch (IOException e) {
            log.error("오류 리포트 쓰기 실패", e);
        }
    }
}
```

### Tasklet: 처리 완료 후 파일 이동

```java
@Component
@StepScope
@RequiredArgsConstructor
@Slf4j
public class FileMoveTasklet implements Tasklet {

    @Value("${batch.processed-dir}")
    private String processedDir;

    @Override
    public RepeatStatus execute(StepContribution contribution,
                                ChunkContext chunkContext) throws Exception {
        String localFilePath = chunkContext.getStepContext()
            .getStepExecution()
            .getJobExecution()
            .getExecutionContext()
            .getString("localFilePath");

        Path source = Paths.get(localFilePath);
        Path target = Paths.get(processedDir, source.getFileName().toString());

        Files.createDirectories(target.getParent());
        Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);

        log.info("파일 이동 완료 - {} → {}", source, target);
        return RepeatStatus.FINISHED;
    }
}
```

---

## 공통 유틸리티 패턴

### 배치 실행 시간 측정 AOP

```java
@Aspect
@Component
@Slf4j
public class BatchPerformanceAspect {

    @Around("execution(* org.springframework.batch.core.step.item.ChunkOrientedTasklet.execute(..))")
    public Object measureChunkTime(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        Object result = pjp.proceed();
        long elapsed = System.currentTimeMillis() - start;

        if (elapsed > 5000) {  // 5초 이상 소요되는 청크 경고
            log.warn("청크 처리 지연 감지 - elapsed={}ms", elapsed);
        }

        return result;
    }

    // Job 전체 실행 시간 측정
    @Component
    public static class JobTimingListener implements JobExecutionListener {

        @Override
        public void afterJob(JobExecution jobExecution) {
            Duration duration = Duration.between(
                jobExecution.getStartTime(), jobExecution.getEndTime());

            log.info("Job 완료 - name={}, status={}, duration={}분 {}초",
                jobExecution.getJobInstance().getJobName(),
                jobExecution.getStatus(),
                duration.toMinutes(),
                duration.toSecondsPart());
        }
    }
}
```

### 배치 메타데이터 DB와 업무 DB 분리 설정

대규모 배치에서는 메타데이터 DB와 업무 DB를 분리해 서로 영향을 주지 않도록 한다.

```java
@Configuration
public class DataSourceConfig {

    /**
     * 배치 메타데이터 전용 DataSource (BATCH_* 테이블)
     * Spring Batch 자동 구성이 이 DataSource를 사용하도록 설정
     */
    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource.batch-meta")
    public DataSource batchMetaDataSource() {
        return DataSourceBuilder.create().build();
    }

    /**
     * 업무 DB DataSource (orders, users, settlements 등)
     */
    @Bean
    @ConfigurationProperties("spring.datasource.business")
    public DataSource businessDataSource() {
        return DataSourceBuilder.create().build();
    }

    /**
     * 배치 메타데이터용 TransactionManager
     */
    @Bean
    @Primary
    public PlatformTransactionManager batchTransactionManager(
            @Qualifier("batchMetaDataSource") DataSource batchMetaDataSource) {
        return new DataSourceTransactionManager(batchMetaDataSource);
    }

    /**
     * 업무 DB용 TransactionManager
     */
    @Bean
    public PlatformTransactionManager businessTransactionManager(
            @Qualifier("businessDataSource") DataSource businessDataSource) {
        return new DataSourceTransactionManager(businessDataSource);
    }
}
```

```yaml
# application.yml
spring:
  datasource:
    batch-meta:
      url: jdbc:mysql://batch-meta-db:3306/batch_metadata
      username: batch_user
      password: ${BATCH_META_DB_PASSWORD}
      hikari:
        maximum-pool-size: 10
        pool-name: BatchMetaPool

    business:
      url: jdbc:mysql://business-db:3306/business?rewriteBatchedStatements=true
      username: batch_reader
      password: ${BUSINESS_DB_PASSWORD}
      hikari:
        maximum-pool-size: 30   # 파티션 수(10) * 3 여유분
        pool-name: BusinessPool

  batch:
    job:
      enabled: false
    jdbc:
      initialize-schema: never  # 스키마 자동 생성 비활성화 (운영환경)
```

**주의:** Spring Batch가 `@Primary` DataSource를 자동으로 메타데이터 저장소로 사용한다. `DefaultBatchConfiguration`을 상속해 명시적으로 `getDataSource()`를 오버라이드하는 것이 더 안전하다.

```java
@Configuration
public class BatchConfig extends DefaultBatchConfiguration {

    @Autowired
    @Qualifier("batchMetaDataSource")
    private DataSource batchMetaDataSource;

    @Override
    protected DataSource getDataSource() {
        return batchMetaDataSource;  // 명시적으로 메타데이터 DB 지정
    }
}
```
