---
title: "Spring Batch: 테스트 전략 완전 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "testing", "springbatchtest", "testcontainers"]
---

## 테스트 전략 개요

Spring Batch 테스트는 레이어별로 나눠서 접근해야 한다. 전체를 통합 테스트로만 검증하면 느리고, 단위 테스트만으로는 Step 간 상호작용을 검증할 수 없다.

| 레이어 | 도구 | 속도 | 용도 |
|--------|------|------|------|
| **ItemProcessor 단위 테스트** | JUnit5 + Mockito | 빠름 | 비즈니스 로직 검증 |
| **ItemReader 단위 테스트** | StepScopeTestUtils | 보통 | Reader 동작 검증 |
| **ItemWriter 단위 테스트** | EmbeddedDatabase | 보통 | 쓰기 SQL 검증 |
| **Step 통합 테스트** | @SpringBatchTest | 느림 | Step 전체 흐름 검증 |
| **Job 통합 테스트** | @SpringBatchTest | 가장 느림 | Job 전체 시나리오 검증 |

---

## 의존성 설정

```xml
<dependency>
    <groupId>org.springframework.batch</groupId>
    <artifactId>spring-batch-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<!-- H2 인메모리 DB -->
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>test</scope>
</dependency>
```

---

## ItemProcessor 단위 테스트

Spring Context 없이 순수 Java로 테스트한다. 빠르고 의존성이 없다.

```java
class OrderProcessorTest {

    private OrderItemProcessor processor;

    @Mock
    private DiscountService discountService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        processor = new OrderItemProcessor(discountService);
    }

    @Test
    @DisplayName("일반 주문은 정상 처리되어야 한다")
    void processNormalOrder() throws Exception {
        // given
        Order order = Order.builder()
                .id(1L)
                .amount(new BigDecimal("10000"))
                .status("PENDING")
                .build();

        when(discountService.getDiscountRate(1L)).thenReturn(0.1);

        // when
        ProcessedOrder result = processor.process(order);

        // then
        assertThat(result).isNotNull();
        assertThat(result.getOrderId()).isEqualTo(1L);
        assertThat(result.getFinalAmount()).isEqualByComparingTo("9000");
        assertThat(result.getStatus()).isEqualTo("PROCESSED");
    }

    @Test
    @DisplayName("이미 처리된 주문은 null을 반환해야 한다 (필터링)")
    void filterAlreadyProcessedOrder() throws Exception {
        // given - 이미 처리된 주문
        Order order = Order.builder()
                .id(2L)
                .amount(new BigDecimal("5000"))
                .status("PROCESSED")  // 이미 처리됨
                .build();

        // when - null 반환 = Processor에서 필터링
        ProcessedOrder result = processor.process(order);

        // then
        assertThat(result).isNull();
        verify(discountService, never()).getDiscountRate(anyLong());
    }

    @Test
    @DisplayName("할인 서비스 호출 실패 시 예외가 전파되어야 한다")
    void propagateExceptionWhenDiscountServiceFails() {
        // given
        Order order = Order.builder().id(3L).amount(new BigDecimal("10000")).status("PENDING").build();
        when(discountService.getDiscountRate(3L))
                .thenThrow(new RuntimeException("할인 서비스 연결 실패"));

        // when & then
        assertThatThrownBy(() -> processor.process(order))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("할인 서비스 연결 실패");
    }
}
```

---

## ItemReader 단위 테스트

`@StepScope` 빈은 Step Context 없이는 초기화되지 않는다. `StepScopeTestUtils`를 활용한다.

```java
@SpringBatchTest
@SpringBootTest(classes = {BatchTestConfig.class, DateBasedJobConfig.class})
class OrderReaderTest {

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("targetDate에 해당하는 주문만 읽어야 한다")
    void readOrdersByTargetDate() throws Exception {
        // given - 테스트 데이터 삽입
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.update(
                "INSERT INTO orders (id, amount, status, created_at) VALUES (?, ?, ?, ?)",
                1L, new BigDecimal("10000"), "PENDING", "2026-03-27 10:00:00");
        jdbcTemplate.update(
                "INSERT INTO orders (id, amount, status, created_at) VALUES (?, ?, ?, ?)",
                2L, new BigDecimal("5000"), "PENDING", "2026-03-26 10:00:00");  // 다른 날짜

        // StepExecution Mock 설정
        StepExecution stepExecution = MetaDataInstanceFactory.createStepExecution(
                new JobParametersBuilder()
                        .addString("targetDate", "2026-03-27")
                        .toJobParameters()
        );

        // when - @StepScope 컨텍스트 내에서 Reader 실행
        List<Order> orders = StepScopeTestUtils.doInStepScope(stepExecution, () -> {
            JdbcCursorItemReader<Order> reader =
                    applicationContext.getBean("orderReader", JdbcCursorItemReader.class);
            reader.open(stepExecution.getExecutionContext());

            List<Order> result = new ArrayList<>();
            Order order;
            while ((order = reader.read()) != null) {
                result.add(order);
            }
            reader.close();
            return result;
        });

        // then - 2026-03-27 날짜 주문만 읽혀야 함
        assertThat(orders).hasSize(1);
        assertThat(orders.get(0).getId()).isEqualTo(1L);
    }
}

// MockStepExecution 생성 헬퍼
class MockStepExecutionFactory {

    public static StepExecution create(String targetDate) {
        return MetaDataInstanceFactory.createStepExecution(
                new JobParametersBuilder()
                        .addString("targetDate", targetDate)
                        .addLong("timestamp", System.currentTimeMillis())
                        .toJobParameters()
        );
    }

    public static StepExecution createWithContext(
            String targetDate, Map<String, Object> contextValues) {
        StepExecution stepExecution = create(targetDate);
        contextValues.forEach((key, value) ->
                stepExecution.getExecutionContext().put(key, value));
        return stepExecution;
    }
}
```

---

## ItemWriter 단위 테스트

```java
class ProcessedOrderWriterTest {

    private EmbeddedDatabase embeddedDatabase;
    private JdbcBatchItemWriter<ProcessedOrder> writer;

    @BeforeEach
    void setUp() {
        embeddedDatabase = new EmbeddedDatabaseBuilder()
                .setType(EmbeddedDatabaseType.H2)
                .addScript("schema/batch-schema.sql")   // 테스트용 DDL
                .addScript("schema/order-schema.sql")
                .build();

        writer = new JdbcBatchItemWriterBuilder<ProcessedOrder>()
                .dataSource(embeddedDatabase)
                .sql("INSERT INTO processed_orders (order_id, final_amount, processed_at) " +
                     "VALUES (:orderId, :finalAmount, :processedAt)")
                .beanMapped()
                .build();

        writer.afterPropertiesSet();
    }

    @AfterEach
    void tearDown() {
        embeddedDatabase.shutdown();
    }

    @Test
    @DisplayName("처리된 주문 목록이 DB에 저장되어야 한다")
    void writeProcessedOrders() throws Exception {
        // given
        List<ProcessedOrder> items = List.of(
                new ProcessedOrder(1L, new BigDecimal("9000"), LocalDateTime.now()),
                new ProcessedOrder(2L, new BigDecimal("4500"), LocalDateTime.now()),
                new ProcessedOrder(3L, new BigDecimal("18000"), LocalDateTime.now())
        );

        // Spring Batch 5.x: Chunk.of() 사용
        Chunk<ProcessedOrder> chunk = Chunk.of(
                items.toArray(new ProcessedOrder[0]));

        // when
        writer.write(chunk);

        // then
        JdbcTemplate jdbcTemplate = new JdbcTemplate(embeddedDatabase);
        int count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_orders", Integer.class);
        assertThat(count).isEqualTo(3);

        // 특정 레코드 검증
        BigDecimal amount = jdbcTemplate.queryForObject(
                "SELECT final_amount FROM processed_orders WHERE order_id = 1",
                BigDecimal.class);
        assertThat(amount).isEqualByComparingTo("9000");
    }
}
```

---

## @SpringBatchTest 통합 테스트

### 설정

```java
@SpringBatchTest           // JobLauncherTestUtils, JobRepositoryTestUtils 자동 등록
@SpringBootTest(classes = {
        BatchTestConfig.class,      // 테스트용 배치 설정
        DateBasedJobConfig.class    // 테스트할 Job 설정
})
@ActiveProfiles("test")
class DateBasedJobIntegrationTest {

    @Autowired
    private JobLauncherTestUtils jobLauncherTestUtils;

    @Autowired
    private JobRepositoryTestUtils jobRepositoryTestUtils;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        // 테스트 간 실행 이력 격리 (이전 테스트의 메타데이터 삭제)
        jobRepositoryTestUtils.removeJobExecutions();
    }

    // =========== Job 전체 실행 테스트 ===========

    @Test
    @DisplayName("Job이 정상 완료되어야 한다")
    void jobShouldComplete() throws Exception {
        // given - 테스트 데이터 삽입
        insertTestOrders("2026-03-27", 5);

        JobParameters params = new JobParametersBuilder()
                .addString("targetDate", "2026-03-27")
                .addLong("timestamp", System.currentTimeMillis())
                .toJobParameters();

        // when - Job 전체 실행
        JobExecution jobExecution = jobLauncherTestUtils.launchJob(params);

        // then
        assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        assertThat(jobExecution.getExitStatus().getExitCode()).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("처리된 주문이 DB에 저장되어야 한다")
    void processedOrdersShouldBeSaved() throws Exception {
        // given
        insertTestOrders("2026-03-27", 3);

        JobParameters params = new JobParametersBuilder()
                .addString("targetDate", "2026-03-27")
                .addLong("timestamp", System.currentTimeMillis())
                .toJobParameters();

        // when
        jobLauncherTestUtils.launchJob(params);

        // then
        int savedCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_orders WHERE DATE(processed_at) = '2026-03-27'",
                Integer.class);
        assertThat(savedCount).isEqualTo(3);
    }

    // =========== Step 단독 실행 테스트 ===========

    @Test
    @DisplayName("processOrderStep의 readCount와 writeCount가 일치해야 한다")
    void stepReadWriteCountShouldMatch() throws Exception {
        // given
        insertTestOrders("2026-03-27", 10);

        JobParameters params = new JobParametersBuilder()
                .addString("targetDate", "2026-03-27")
                .toJobParameters();

        // when - Step 단독 실행
        JobExecution jobExecution = jobLauncherTestUtils.launchStep("processOrderStep", params);

        // then - StepExecution 검증
        StepExecution stepExecution = getStepExecution(jobExecution, "processOrderStep");

        assertThat(stepExecution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        assertThat(stepExecution.getReadCount()).isEqualTo(10);
        assertThat(stepExecution.getWriteCount()).isEqualTo(10);
        assertThat(stepExecution.getSkipCount()).isEqualTo(0);
        assertThat(stepExecution.getFilterCount()).isEqualTo(0);
        assertThat(stepExecution.getRollbackCount()).isEqualTo(0);
    }

    private StepExecution getStepExecution(JobExecution jobExecution, String stepName) {
        return jobExecution.getStepExecutions()
                .stream()
                .filter(se -> se.getStepName().equals(stepName))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Step not found: " + stepName));
    }

    private void insertTestOrders(String date, int count) {
        for (int i = 1; i <= count; i++) {
            jdbcTemplate.update(
                    "INSERT INTO orders (id, amount, status, created_at) VALUES (?, ?, 'PENDING', ?)",
                    (long) i,
                    new BigDecimal(i * 1000),
                    date + " 10:00:00"
            );
        }
    }
}
```

---

## 테스트 DB 설정

### H2 인메모리 DB 설정

```java
@TestConfiguration
public class BatchTestConfig {

    @Bean
    @Primary
    public DataSource testDataSource() {
        return new EmbeddedDatabaseBuilder()
                .setType(EmbeddedDatabaseType.H2)
                .addScript("org/springframework/batch/core/schema-h2.sql")  // 배치 메타 스키마
                .addScript("test-schema.sql")  // 비즈니스 스키마
                .build();
    }
}
```

```yaml
# src/test/resources/application-test.yml
spring:
  datasource:
    url: jdbc:h2:mem:testdb;MODE=MySQL;DB_CLOSE_DELAY=-1
    driver-class-name: org.h2.Driver
    username: sa
    password:
  batch:
    jdbc:
      initialize-schema: always
    job:
      enabled: false
  jpa:
    hibernate:
      ddl-auto: create-drop
```

### Testcontainers + MySQL 실제 DB 테스트

Spring Boot 3.1+의 `@ServiceConnection`을 활용하면 설정이 단순해진다.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>mysql</artifactId>
    <scope>test</scope>
</dependency>
```

```java
@SpringBatchTest
@SpringBootTest(classes = {DateBasedJobConfig.class})
@Testcontainers
@ActiveProfiles("testcontainers")
class DateBasedJobContainerTest {

    // Spring Boot 3.1+ @ServiceConnection: 컨테이너 정보를 자동으로 DataSource에 주입
    @Container
    @ServiceConnection
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0")
            .withDatabaseName("batch_test")
            .withUsername("test")
            .withPassword("test")
            .withInitScript("init-schema.sql");

    @Autowired
    private JobLauncherTestUtils jobLauncherTestUtils;

    @Autowired
    private JobRepositoryTestUtils jobRepositoryTestUtils;

    @BeforeEach
    void setUp() {
        jobRepositoryTestUtils.removeJobExecutions();
    }

    @Test
    @DisplayName("실제 MySQL에서 Job이 정상 완료되어야 한다")
    void jobShouldCompleteWithRealMySQL() throws Exception {
        JobParameters params = new JobParametersBuilder()
                .addString("targetDate", "2026-03-27")
                .addLong("timestamp", System.currentTimeMillis())
                .toJobParameters();

        JobExecution execution = jobLauncherTestUtils.launchJob(params);
        assertThat(execution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
    }
}

// Spring Boot 3.1 이전: @DynamicPropertySource 방식
@SpringBatchTest
@SpringBootTest
@Testcontainers
class LegacyContainerTest {

    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0")
            .withDatabaseName("batch_test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
    }
}
```

---

## 청크 테스트 패턴

### 패턴 1: DB 입력 → 배치 실행 → DB 출력 검증

```java
@Test
@DisplayName("DB 입력 데이터가 처리되어 결과 테이블에 저장되어야 한다")
void dbInputToDbOutputTest() throws Exception {
    // given - 입력 데이터 준비
    jdbcTemplate.batchUpdate(
            "INSERT INTO orders (id, amount, status, created_at) VALUES (?, ?, 'PENDING', '2026-03-27 00:00:00')",
            List.of(
                    new Object[]{1L, new BigDecimal("10000")},
                    new Object[]{2L, new BigDecimal("20000")},
                    new Object[]{3L, new BigDecimal("30000")}
            )
    );

    JobParameters params = new JobParametersBuilder()
            .addString("targetDate", "2026-03-27")
            .addLong("timestamp", System.currentTimeMillis())
            .toJobParameters();

    // when
    JobExecution execution = jobLauncherTestUtils.launchJob(params);

    // then - 배치 실행 결과 검증
    assertThat(execution.getStatus()).isEqualTo(BatchStatus.COMPLETED);

    // DB 출력 검증
    List<Map<String, Object>> results = jdbcTemplate.queryForList(
            "SELECT order_id, final_amount FROM processed_orders ORDER BY order_id");

    assertThat(results).hasSize(3);
    assertThat(results.get(0).get("order_id")).isEqualTo(1L);
    assertThat((BigDecimal) results.get(0).get("final_amount"))
            .isEqualByComparingTo("9000");  // 10% 할인 적용 확인
}
```

### 패턴 2: 파일 입력 → 배치 실행 → 파일 출력 검증

```java
@Test
@DisplayName("입력 파일을 처리하여 출력 파일을 생성해야 한다")
void fileInputToFileOutputTest(@TempDir Path tempDir) throws Exception {
    // given - 입력 파일 생성
    Path inputFile = tempDir.resolve("orders.csv");
    Files.writeString(inputFile,
            "id,amount,status\n" +
            "1,10000,PENDING\n" +
            "2,20000,PENDING\n"
    );

    Path outputFile = tempDir.resolve("processed_orders.csv");

    JobParameters params = new JobParametersBuilder()
            .addString("inputFile", inputFile.toString())
            .addString("outputFile", outputFile.toString())
            .addLong("timestamp", System.currentTimeMillis())
            .toJobParameters();

    // when
    JobExecution execution = jobLauncherTestUtils.launchJob(params);

    // then
    assertThat(execution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
    assertThat(outputFile).exists();

    List<String> lines = Files.readAllLines(outputFile);
    assertThat(lines).hasSize(3);  // 헤더 1 + 데이터 2
    assertThat(lines.get(1)).contains("1");
}
```

### 테스트 격리: JobRepositoryTestUtils.removeJobExecutions()

```java
@BeforeEach
void isolateTest() {
    // 이전 테스트에서 생성된 모든 JobExecution 삭제
    // 동일한 JobParameters로 재실행 가능하게 만듦
    jobRepositoryTestUtils.removeJobExecutions();

    // 비즈니스 데이터도 초기화
    jdbcTemplate.execute("DELETE FROM processed_orders");
    jdbcTemplate.execute("DELETE FROM orders");
}
```

---

## Skip/Retry 테스트

```java
@Test
@DisplayName("처리 중 예외 발생 시 해당 아이템을 Skip하고 계속 처리해야 한다")
void skipOnProcessingException() throws Exception {
    // given - 10건 중 3번, 7번 데이터는 처리 시 예외 발생하도록 설정
    insertTestOrders(10);

    // Mock Processor: id가 3 또는 7인 주문 처리 시 예외 발생
    when(mockProcessor.process(argThat(o -> o.getId() == 3L || o.getId() == 7L)))
            .thenThrow(new DataProcessingException("처리 불가 주문"));
    when(mockProcessor.process(argThat(o -> o.getId() != 3L && o.getId() != 7L)))
            .thenAnswer(inv -> {
                Order order = inv.getArgument(0);
                return new ProcessedOrder(order.getId(), order.getAmount());
            });

    JobParameters params = new JobParametersBuilder()
            .addString("targetDate", "2026-03-27")
            .addLong("timestamp", System.currentTimeMillis())
            .toJobParameters();

    // when
    JobExecution jobExecution = jobLauncherTestUtils.launchStep("processOrderStep", params);

    // then
    StepExecution stepExecution = getStepExecution(jobExecution, "processOrderStep");

    assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
    assertThat(stepExecution.getReadCount()).isEqualTo(10);
    assertThat(stepExecution.getWriteCount()).isEqualTo(8);   // 10 - 2 skip
    assertThat(stepExecution.getSkipCount()).isEqualTo(2);    // 3번, 7번 skip
}

@Test
@DisplayName("skipLimit 초과 시 Step이 FAILED가 되어야 한다")
void stepShouldFailWhenSkipLimitExceeded() throws Exception {
    // given - skipLimit=2로 설정된 Step에서 3건 이상 예외 발생
    insertTestOrders(5);
    when(mockProcessor.process(any())).thenThrow(new DataProcessingException("항상 실패"));

    JobParameters params = new JobParametersBuilder()
            .addString("targetDate", "2026-03-27")
            .addLong("timestamp", System.currentTimeMillis())
            .toJobParameters();

    // when
    JobExecution jobExecution = jobLauncherTestUtils.launchStep("processOrderStep", params);

    // then - skipLimit 초과로 Step FAILED
    assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.FAILED);
}
```

---

## 실무 팁

### 테스트 속도 최적화

```java
// @SpringBatchTest는 Spring Context를 로드하므로 첫 실행이 느림
// 동일한 Context를 재사용하도록 @DirtiesContext를 최소화

// 나쁜 패턴: 각 테스트마다 Context 재생성
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)  // 지양

// 좋은 패턴: JobRepositoryTestUtils로 데이터만 초기화
@BeforeEach
void setUp() {
    jobRepositoryTestUtils.removeJobExecutions();  // Context 재생성 없이 격리
    jdbcTemplate.execute("TRUNCATE TABLE orders");
}
```

### 테스트 커버리지 체크리스트

```
ItemProcessor:
  [ ] 정상 케이스 (변환 결과 검증)
  [ ] null 반환 케이스 (필터링)
  [ ] 예외 케이스 (기대하는 예외 타입)
  [ ] 경계값 케이스 (빈 문자열, 0, 최대값)

Step 통합:
  [ ] 정상 완료 (COMPLETED 상태)
  [ ] readCount == writeCount (필터 없을 때)
  [ ] skip 동작 검증
  [ ] skipLimit 초과 시 FAILED
  [ ] 재시작 동작 (FAILED → restart → COMPLETED)

Job 통합:
  [ ] 동일 파라미터 재실행 방지
  [ ] 다른 날짜 파라미터로 재실행 허용
  [ ] Step 실패 시 Job FAILED
  [ ] 조건부 Flow (상태에 따른 다음 Step 분기)
```
