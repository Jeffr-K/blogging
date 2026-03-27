---
title: "Spring Batch: 아키텍처 패턴과 설계 원칙"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "architecture", "design-patterns"]
---

## 개요

Spring Batch 애플리케이션은 단순한 Job/Step 구성을 넘어, 대규모 배치 시스템에서 유지보수성과 확장성을 확보하기 위한 설계 원칙이 필요하다. 이 글에서는 레이어 구조 설계부터 Job 모듈화, ExecutionContext 활용, 마이크로서비스 환경에서의 배치 설계까지 실무 패턴을 다룬다.

---

## 배치 애플리케이션 레이어 구조

### 권장 패키지 구조

```
src/main/java/com/example/batch/
├── job/
│   ├── settlement/
│   │   ├── SettlementJobConfig.java        # @Configuration, Job/Step 빈 정의
│   │   ├── SettlementItemReader.java        # 읽기 담당
│   │   ├── SettlementItemProcessor.java     # 변환/검증 담당
│   │   └── SettlementItemWriter.java        # 쓰기 담당
│   └── migration/
│       ├── MigrationJobConfig.java
│       └── ...
├── service/                                 # 도메인 서비스 (배치 전용이 아닌 공용)
│   ├── OrderService.java
│   └── SettlementService.java
├── domain/
│   ├── Order.java
│   └── Settlement.java
├── infrastructure/
│   ├── datasource/
│   │   └── DataSourceConfig.java           # 배치 메타데이터 DB 분리
│   └── s3/
│       └── S3Config.java
└── BatchApplication.java
```

### Job Configuration (@Configuration)

Job 설정 클래스는 빈 정의에만 집중하고, 비즈니스 로직은 Reader/Processor/Writer로 위임한다.

```java
@Configuration
@RequiredArgsConstructor
public class SettlementJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final DataSource batchDataSource;

    @Bean
    public Job settlementJob(Step settlementStep, Step notificationStep) {
        return new JobBuilder("settlementJob", jobRepository)
            .start(settlementStep)
            .next(notificationStep)
            .incrementer(new RunIdIncrementer())
            .listener(settlementJobListener())
            .build();
    }

    @Bean
    public Step settlementStep(
            SettlementItemReader reader,
            SettlementItemProcessor processor,
            SettlementItemWriter writer) {
        return new StepBuilder("settlementStep", jobRepository)
            .<Order, Settlement>chunk(500, transactionManager)
            .reader(reader)
            .processor(processor)
            .writer(writer)
            .faultTolerant()
            .skipLimit(100)
            .skip(InvalidOrderException.class)
            .listener(new SettlementSkipListener())
            .build();
    }

    @Bean
    public JobExecutionListener settlementJobListener() {
        return new SettlementJobListener();
    }
}
```

### Reader/Processor/Writer 빈 분리

각 컴포넌트를 별도 빈으로 분리하면 단위 테스트가 쉬워지고, 재사용성이 높아진다.

```java
@Component
@StepScope
@RequiredArgsConstructor
public class SettlementItemReader implements ItemStreamReader<Order> {

    private final DataSource dataSource;

    @Value("#{jobParameters['targetDate']}")
    private String targetDate;

    private JdbcCursorItemReader<Order> delegate;

    @PostConstruct
    public void init() {
        this.delegate = new JdbcCursorItemReaderBuilder<Order>()
            .name("settlementOrderReader")
            .dataSource(dataSource)
            .sql("""
                SELECT id, user_id, amount, status, created_at
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
    public void open(ExecutionContext ctx) { delegate.open(ctx); }

    @Override
    public void update(ExecutionContext ctx) { delegate.update(ctx); }

    @Override
    public void close() { delegate.close(); }
}
```

### 도메인 서비스 재사용: 배치에서 기존 서비스 호출 패턴

```java
@Component
@RequiredArgsConstructor
public class SettlementItemProcessor implements ItemProcessor<Order, Settlement> {

    // 배치가 기존 도메인 서비스를 재사용
    private final SettlementCalculationService calculationService;
    private final FeePolicy feePolicy;

    @Override
    public Settlement process(Order order) throws Exception {
        // 도메인 서비스 호출 (배치 전용 로직 없음)
        BigDecimal fee = feePolicy.calculateFee(order.getAmount(), order.getOrderType());
        BigDecimal netAmount = calculationService.calculateNetAmount(order, fee);

        return Settlement.builder()
            .orderId(order.getId())
            .userId(order.getUserId())
            .grossAmount(order.getAmount())
            .fee(fee)
            .netAmount(netAmount)
            .settledAt(LocalDateTime.now())
            .build();
    }
}
```

**배치 전용 서비스 vs 도메인 서비스 공유 트레이드오프:**

| 구분 | 도메인 서비스 공유 | 배치 전용 서비스 |
|------|----------------|----------------|
| 장점 | 코드 중복 없음, 비즈니스 로직 일관성 | 배치 최적화 자유도 높음 |
| 단점 | 도메인 서비스 변경이 배치에 영향 | 로직 중복, 동기화 부담 |
| 적합한 경우 | 정산/검증 로직 | 대용량 변환, ETL 특화 로직 |

---

## Job 모듈화 패턴

### 하나의 배치 앱에서 여러 Job 관리

```java
// Job 1: 정산 배치
@Configuration
public class SettlementJobConfig { ... }

// Job 2: 리포트 생성 배치
@Configuration
public class ReportJobConfig { ... }

// Job 3: 데이터 마이그레이션
@Configuration
public class MigrationJobConfig { ... }
```

실행 시 `spring.batch.job.name` 프로퍼티로 실행할 Job을 선택한다.

```bash
# 정산 Job만 실행
java -jar batch.jar --spring.batch.job.name=settlementJob targetDate=2026-03-26

# 마이그레이션 Job만 실행
java -jar batch.jar --spring.batch.job.name=migrationJob batchSize=1000
```

```yaml
# application.yml: 기본적으로 자동 실행 비활성화
spring:
  batch:
    job:
      enabled: false  # 애플리케이션 시작 시 자동 실행 방지
```

### 공통 ItemReader/Processor/Writer 재사용 패턴

```java
// 공통 페이지 쿼리 Provider Factory
@Component
public class QueryProviderFactory {

    public MySqlPagingQueryProvider createOrderQueryProvider(String additionalWhere) {
        MySqlPagingQueryProvider provider = new MySqlPagingQueryProvider();
        provider.setSelectClause("id, user_id, amount, status, created_at");
        provider.setFromClause("orders");
        provider.setWhereClause("status = 'COMPLETED'" +
            (additionalWhere != null ? " AND " + additionalWhere : ""));
        provider.setSortKeys(Map.of("id", Order.ASCENDING));
        return provider;
    }
}

// 공통 검증 Processor
@Component
public class OrderValidationProcessor implements ItemProcessor<Order, Order> {

    @Override
    public Order process(Order order) {
        if (order.getAmount() == null || order.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidOrderException("주문 금액이 0 이하: orderId=" + order.getId());
        }
        return order;
    }
}
```

---

## ExecutionContext 활용 패턴

### Step 간 데이터 전달 (JobExecutionContext)

`StepExecutionContext`는 해당 Step 내에서만 유효하다. Step 간 데이터를 전달하려면 `JobExecutionContext`를 사용한다.

```java
// Step 1: 집계 후 결과를 JobExecutionContext에 저장
@Component
public class AggregationTasklet implements Tasklet {

    @Override
    public RepeatStatus execute(StepContribution contribution,
                                ChunkContext chunkContext) {
        // 집계 수행
        AggregationResult result = performAggregation();

        // JobExecutionContext에 저장 (다음 Step에서 접근 가능)
        JobExecution jobExecution = chunkContext.getStepContext()
            .getStepExecution()
            .getJobExecution();

        jobExecution.getExecutionContext()
            .put("aggregationResult", result.toJson());

        jobExecution.getExecutionContext()
            .putLong("totalAmount", result.getTotalAmount().longValue());

        return RepeatStatus.FINISHED;
    }
}

// Step 2: 이전 Step의 집계 결과를 읽어 처리
@Component
@StepScope
public class NotificationTasklet implements Tasklet {

    // @BeforeStep으로 StepExecution 주입받기
    private StepExecution stepExecution;

    @BeforeStep
    public void beforeStep(StepExecution stepExecution) {
        this.stepExecution = stepExecution;
    }

    @Override
    public RepeatStatus execute(StepContribution contribution,
                                ChunkContext chunkContext) {

        // JobExecutionContext에서 이전 Step 결과 읽기
        ExecutionContext jobContext = stepExecution
            .getJobExecution()
            .getExecutionContext();

        String resultJson = jobContext.getString("aggregationResult");
        long totalAmount = jobContext.getLong("totalAmount");

        log.info("정산 완료 알림 발송 - totalAmount={}", totalAmount);
        sendNotification(resultJson, totalAmount);

        return RepeatStatus.FINISHED;
    }
}
```

### ExecutionContext 직렬화 주의사항

`ExecutionContext`에 저장되는 값은 DB에 직렬화되어 저장된다. 다음 제약을 반드시 지킨다.

```java
// 올바른 사용: 기본 타입과 String만 저장
executionContext.putString("lastProcessedId", "12345");
executionContext.putLong("processedCount", 50000L);
executionContext.putInt("currentPage", 10);
executionContext.putDouble("totalAmount", 1234567.89);

// 주의: 커스텀 객체 저장 시 직렬화 문제 발생 가능
// Spring Batch 5.x는 기본적으로 Jackson 직렬화 사용
// Serializable 구현 또는 Jackson 직렬화 가능한 형태로 저장

// 잘못된 예시: 큰 객체를 통째로 저장 (크기 제한: BATCH_JOB_EXECUTION_CONTEXT.SHORT_CONTEXT 2500자)
executionContext.put("allOrders", hugeList);  // 절대 금지

// 올바른 예시: 최소한의 상태 정보만 저장
executionContext.putLong("lastOrderId", lastOrder.getId());
```

**크기 제한:** Spring Batch 메타데이터 테이블의 `SHORT_CONTEXT` 컬럼은 기본 2,500자다. 큰 데이터는 별도 테이블에 저장하고 ExecutionContext에는 ID만 저장한다.

```java
// 대용량 중간 결과는 임시 테이블 활용
@Override
public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
    List<AggregationResult> results = performAggregation();

    // 결과를 임시 테이블에 저장
    aggregationTempRepository.saveAll(results);

    // ExecutionContext에는 ID만
    chunkContext.getStepContext().getStepExecution()
        .getJobExecution().getExecutionContext()
        .putString("aggregationBatchId", UUID.randomUUID().toString());

    return RepeatStatus.FINISHED;
}
```

---

## 배치 vs 이벤트 처리 결합 패턴

### 배치 실행 후 이벤트 발행

```java
@Component
@RequiredArgsConstructor
public class SettlementJobListener implements JobExecutionListener {

    private final KafkaTemplate<String, SettlementCompletedEvent> kafkaTemplate;

    @Override
    public void afterJob(JobExecution jobExecution) {
        if (jobExecution.getStatus() == BatchStatus.COMPLETED) {
            String targetDate = jobExecution.getJobParameters()
                .getString("targetDate");
            long totalCount = jobExecution.getExecutionContext()
                .getLong("totalSettledCount", 0L);

            SettlementCompletedEvent event = SettlementCompletedEvent.builder()
                .targetDate(targetDate)
                .totalCount(totalCount)
                .completedAt(LocalDateTime.now())
                .build();

            kafkaTemplate.send("settlement-completed", targetDate, event);
            log.info("정산 완료 이벤트 발행 - targetDate={}, count={}", targetDate, totalCount);
        }
    }
}
```

### 이벤트 소비 후 배치 트리거 패턴

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class BatchTriggerConsumer {

    private final JobLauncher jobLauncher;
    private final Job settlementJob;

    @KafkaListener(topics = "trigger-settlement", groupId = "batch-trigger")
    public void onTriggerEvent(TriggerSettlementEvent event) {
        try {
            JobParameters params = new JobParametersBuilder()
                .addString("targetDate", event.getTargetDate())
                .addLocalDateTime("triggeredAt", LocalDateTime.now())
                .toJobParameters();

            JobExecution execution = jobLauncher.run(settlementJob, params);
            log.info("배치 트리거 완료 - targetDate={}, status={}",
                event.getTargetDate(), execution.getStatus());

        } catch (JobExecutionAlreadyRunningException e) {
            log.warn("이미 실행 중인 Job - targetDate={}", event.getTargetDate());
        } catch (Exception e) {
            log.error("배치 트리거 실패 - targetDate={}", event.getTargetDate(), e);
        }
    }
}
```

### Outbox 패턴과 배치의 관계

배치에서 발생한 이벤트를 Outbox 테이블에 저장하고, 별도 배치(또는 Debezium CDC)가 이를 읽어 Kafka로 발행하는 패턴이다. 배치 트랜잭션과 이벤트 발행의 원자성을 보장한다.

```java
// 배치 Writer: 정산 결과 + Outbox 이벤트를 같은 트랜잭션으로 저장
@Override
public void write(Chunk<? extends Settlement> chunk) throws Exception {
    settlementRepository.saveAll(chunk.getItems());

    List<OutboxEvent> events = chunk.getItems().stream()
        .map(s -> OutboxEvent.builder()
            .aggregateId(s.getOrderId().toString())
            .eventType("SettlementCreated")
            .payload(objectMapper.writeValueAsString(s))
            .status(OutboxStatus.PENDING)
            .build())
        .collect(Collectors.toList());

    outboxEventRepository.saveAll(events);
    // 같은 트랜잭션으로 커밋 → 원자성 보장
}
```

---

## 마이크로서비스 환경에서 배치

### 아키텍처 옵션 비교

| 패턴 | 장점 | 단점 | 적합한 경우 |
|------|------|------|------------|
| 서비스 내장 배치 | 도메인 코드 재사용, 배포 단순 | 배치 부하가 서비스에 영향 | 소규모 배치 |
| 배치 전용 서비스 | 독립적 스케일링, 서비스 격리 | 도메인 API 호출 필요 | 대용량 배치 |
| 공유 배치 플랫폼 | 중앙 관리, 모니터링 통합 | 단일 장애점, 복잡도 | 대기업 환경 |

### Spring Cloud Task: 단발성 배치 실행 관리

Spring Cloud Task는 단발성 Spring Boot 애플리케이션(배치 포함)의 실행 상태를 관리한다.

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-task</artifactId>
</dependency>
```

```java
@SpringBootApplication
@EnableTask  // TaskExecution 메타데이터 자동 기록
public class BatchApplication {
    public static void main(String[] args) {
        SpringApplication.run(BatchApplication.class, args);
    }
}
```

실행 시 `TASK_EXECUTION`, `TASK_EXECUTION_PARAMS` 테이블에 시작/종료/상태가 자동 기록된다.

### Kubernetes Job/CronJob으로 배치 실행

```yaml
# kubernetes/batch-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: settlement-batch
spec:
  schedule: "0 2 * * *"  # 매일 새벽 2시
  concurrencyPolicy: Forbid  # 이전 Job이 실행 중이면 새 Job 시작 안 함
  failedJobsHistoryLimit: 3
  successfulJobsHistoryLimit: 5
  jobTemplate:
    spec:
      backoffLimit: 2  # 실패 시 최대 2회 재시도
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: settlement-batch
              image: example/settlement-batch:latest
              args:
                - "--spring.batch.job.name=settlementJob"
                - "--targetDate=$(date -d 'yesterday' '+%Y-%m-%d')"
              env:
                - name: SPRING_DATASOURCE_URL
                  valueFrom:
                    secretKeyRef:
                      name: db-secret
                      key: url
              resources:
                requests:
                  memory: "2Gi"
                  cpu: "1000m"
                limits:
                  memory: "4Gi"
                  cpu: "2000m"
```

---

## 대용량 배치 설계 체크리스트

### 청크 사이즈 결정 방법론

청크 사이즈는 다음 공식으로 추정한 뒤 실측으로 조정한다.

```
청크 사이즈 = min(
    메모리 안전 청크 사이즈,
    DB 배치 최적 사이즈,
    트랜잭션 롤백 허용 비용
)

메모리 안전 청크 사이즈 = 가용 힙 메모리 / (아이템 평균 크기 * 3)
// *3: reader 버퍼 + processor 결과 + writer 버퍼

예시: 1GB 가용, 아이템 2KB → 1024MB / (2KB * 3) ≈ 170,000
→ 실제로는 500~1,000 시작 후 측정
```

### 파티션 수 권장

```java
// 권장: 파티션 수 = CPU 코어 수 * 2
int partitionCount = Runtime.getRuntime().availableProcessors() * 2;

// Kubernetes 환경: resource.requests.cpu를 기준으로 계산
// CPU 2코어 요청 → 파티션 4개
```

### 타임아웃 설정

```yaml
spring:
  batch:
    job:
      enabled: false
  transaction:
    default-timeout: 300  # 기본 트랜잭션 타임아웃 300초

# Step별 타임아웃 (코드에서)
```

```java
@Bean
public Step heavyStep(JobRepository jobRepository,
                      PlatformTransactionManager txManager) {
    DefaultTransactionAttribute txAttr = new DefaultTransactionAttribute();
    txAttr.setTimeout(600);  // 이 Step의 각 청크 트랜잭션 타임아웃 600초

    return new StepBuilder("heavyStep", jobRepository)
        .<Order, Settlement>chunk(500, txManager)
        .transactionAttribute(txAttr)
        .reader(reader())
        .writer(writer())
        .build();
}
```

### 메모리 사용량 추정

```
총 힙 메모리 사용 ≈ 청크 사이즈 * 아이템 크기 * 파티션 수 * 3

예시:
- 청크 사이즈: 1,000건
- 아이템 크기: 1KB
- 파티션 수: 8개
- 계수: 3 (reader/processor/writer 각 보유)

→ 1,000 * 1KB * 8 * 3 = 24MB (최소)

실제로는 JVM 오버헤드, 로깅, Spring 컨텍스트 포함하여
최소 사용량의 10~20배를 힙으로 할당하는 것이 안전하다.
→ -Xmx512m 이상 권장
```

### 체크리스트 요약

```
[ ] 청크 사이즈: 실측 기반으로 결정 (100~1,000 범위에서 시작)
[ ] fetchSize: 청크 사이즈와 동일하게 설정
[ ] rewriteBatchedStatements=true (MySQL)
[ ] 파티션 수: CPU 코어 수 * 2
[ ] 커넥션 풀: 파티션 수 + 여유분 (최소 파티션 수 * 1.5)
[ ] 타임아웃: Step 청크 트랜잭션 타임아웃 설정
[ ] Skip 설정: 업무 허용 범위 내 skipLimit 설정
[ ] Retry 설정: 네트워크/DB 일시 오류 대비 retryLimit 설정
[ ] ExecutionContext: 재시작 지원 상태 저장 구현
[ ] 멱등성: 재실행 시 중복 처리 방지 (UPSERT 또는 상태 확인)
[ ] 모니터링: 메타데이터 테이블 조회 대시보드 구성
[ ] 알림: Job 실패 시 Slack/이메일 알림 (JobExecutionListener)
```
