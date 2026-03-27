---
title: "Spring Batch: ItemReader 심화 — 커스텀 구현과 최적화"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "itemreader", "custom", "optimization"]
---

## 개요

Spring Batch의 `ItemReader`는 데이터를 읽어오는 추상화 계층이다. 기본 제공 구현체(JdbcPagingItemReader, FlatFileItemReader 등)로 대부분의 케이스를 처리할 수 있지만, 외부 REST API 호출이나 Kafka 같은 메시지 큐, 또는 초대용량 테이블에서의 NoOffset 페이징 같은 요구사항은 커스텀 구현이 필요하다.

---

## 커스텀 ItemStreamReader 구현: 외부 REST API Reader

`ItemStreamReader`는 `ItemReader`에 `open()`, `update()`, `close()` 라이프사이클을 추가한 인터페이스다. 이를 구현하면 재시작(restart) 시 이전 오프셋부터 이어서 읽을 수 있다.

### 시나리오

외부 결제 API를 페이지 단위로 호출해 주문 데이터를 읽어온다. API는 `page`와 `size` 파라미터를 받고, 빈 페이지를 반환하면 데이터가 끝난 것으로 간주한다.

### 전체 구현 코드

```java
@Slf4j
public class RestApiItemReader<T> implements ItemStreamReader<T> {

    private static final String CURRENT_OFFSET_KEY = "rest.api.current.offset";
    private static final String CURRENT_PAGE_INDEX_KEY = "rest.api.current.page.index";

    private final RestApiClient<T> apiClient;
    private final int pageSize;
    private final Class<T> itemType;

    private List<T> currentPageData = new ArrayList<>();
    private int currentIndexInPage = 0;
    private int currentPage = 0;
    private boolean exhausted = false;

    public RestApiItemReader(RestApiClient<T> apiClient, int pageSize, Class<T> itemType) {
        this.apiClient = apiClient;
        this.pageSize = pageSize;
        this.itemType = itemType;
    }

    /**
     * open(): Step 시작 시 호출. ExecutionContext에서 이전 오프셋을 복원한다.
     * 재시작(restart) 시 이전 상태부터 이어서 읽을 수 있도록 한다.
     */
    @Override
    public void open(ExecutionContext executionContext) throws ItemStreamException {
        log.info("RestApiItemReader.open() 호출 - API 클라이언트 초기화");

        // ExecutionContext에서 이전 실행 상태 복원
        if (executionContext.containsKey(CURRENT_PAGE_INDEX_KEY)) {
            this.currentPage = executionContext.getInt(CURRENT_PAGE_INDEX_KEY);
            this.currentIndexInPage = executionContext.getInt(CURRENT_OFFSET_KEY);
            log.info("재시작 감지 - page={}, indexInPage={}", currentPage, currentIndexInPage);

            // 이전 페이지 데이터 재로드
            if (currentIndexInPage > 0) {
                this.currentPageData = apiClient.fetchPage(currentPage, pageSize);
            }
        }

        // API 클라이언트 초기화 (인증 토큰 갱신 등)
        apiClient.initialize();
    }

    /**
     * read(): 아이템 하나를 반환한다. null을 반환하면 Step이 종료된다.
     */
    @Override
    public T read() throws Exception {
        if (exhausted) {
            return null;
        }

        // 현재 페이지 데이터가 소진된 경우 다음 페이지 호출
        if (currentIndexInPage >= currentPageData.size()) {
            fetchNextPage();
        }

        // 다음 페이지도 비어있으면 데이터 끝
        if (currentPageData.isEmpty()) {
            exhausted = true;
            return null;
        }

        return currentPageData.get(currentIndexInPage++);
    }

    private void fetchNextPage() {
        currentPage++;
        currentIndexInPage = 0;

        log.info("다음 페이지 호출 - page={}", currentPage);
        List<T> nextPage = apiClient.fetchPage(currentPage, pageSize);

        if (nextPage == null || nextPage.isEmpty()) {
            currentPageData = Collections.emptyList();
            log.info("더 이상 데이터 없음 - 마지막 page={}", currentPage);
        } else {
            currentPageData = nextPage;
        }
    }

    /**
     * update(): 청크 커밋 직전에 호출. 현재 오프셋을 ExecutionContext에 저장한다.
     * 이 정보가 DB에 저장되어 재시작 시 복원된다.
     */
    @Override
    public void update(ExecutionContext executionContext) throws ItemStreamException {
        executionContext.putInt(CURRENT_PAGE_INDEX_KEY, currentPage);
        executionContext.putInt(CURRENT_OFFSET_KEY, currentIndexInPage);
        log.debug("ExecutionContext 업데이트 - page={}, indexInPage={}", currentPage, currentIndexInPage);
    }

    /**
     * close(): Step 종료 시 호출. 리소스를 정리한다.
     */
    @Override
    public void close() throws ItemStreamException {
        log.info("RestApiItemReader.close() - 리소스 정리");
        apiClient.shutdown();
        currentPageData.clear();
    }
}
```

### API 클라이언트 구현 (WebClient 활용)

```java
@Component
public class PaymentApiClient implements RestApiClient<PaymentDto> {

    private final WebClient webClient;
    private String accessToken;

    public PaymentApiClient(WebClient.Builder webClientBuilder,
                            @Value("${payment.api.base-url}") String baseUrl) {
        this.webClient = webClientBuilder
            .baseUrl(baseUrl)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .build();
    }

    @Override
    public void initialize() {
        // 인증 토큰 갱신
        this.accessToken = fetchNewAccessToken();
        log.info("API 클라이언트 초기화 완료 - 토큰 갱신");
    }

    @Override
    public List<PaymentDto> fetchPage(int page, int size) {
        try {
            PaymentPageResponse response = webClient.get()
                .uri(uriBuilder -> uriBuilder
                    .path("/api/v1/payments")
                    .queryParam("page", page)
                    .queryParam("size", size)
                    .queryParam("status", "COMPLETED")
                    .build())
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .bodyToMono(PaymentPageResponse.class)
                .timeout(Duration.ofSeconds(30))
                .block();

            return response != null ? response.getContent() : Collections.emptyList();
        } catch (WebClientResponseException e) {
            log.error("API 호출 실패 - page={}, status={}", page, e.getStatusCode());
            throw new ItemStreamException("REST API 호출 실패", e);
        }
    }

    @Override
    public void shutdown() {
        // 커넥션 풀 정리 등
    }

    private String fetchNewAccessToken() {
        // OAuth2 토큰 요청 구현
        return webClient.post()
            .uri("/oauth/token")
            .bodyValue(Map.of("grant_type", "client_credentials"))
            .retrieve()
            .bodyToMono(TokenResponse.class)
            .map(TokenResponse::getAccessToken)
            .block();
    }
}
```

### Job 설정에서 Bean 등록

```java
@Configuration
public class RestApiJobConfig {

    @Bean
    @StepScope
    public RestApiItemReader<PaymentDto> paymentApiReader(PaymentApiClient apiClient) {
        return new RestApiItemReader<>(apiClient, 100, PaymentDto.class);
    }

    @Bean
    public Step paymentApiStep(JobRepository jobRepository,
                               PlatformTransactionManager transactionManager,
                               RestApiItemReader<PaymentDto> paymentApiReader,
                               ItemProcessor<PaymentDto, Settlement> settlementProcessor,
                               ItemWriter<Settlement> settlementWriter) {
        return new StepBuilder("paymentApiStep", jobRepository)
            .<PaymentDto, Settlement>chunk(100, transactionManager)
            .reader(paymentApiReader)
            .processor(settlementProcessor)
            .writer(settlementWriter)
            .faultTolerant()
            .retryLimit(3)
            .retry(WebClientRequestException.class)
            .build();
    }
}
```

---

## Kafka 기반 ItemReader

대용량 이벤트 스트림을 배치로 처리할 때 `KafkaItemReader`를 사용한다. Spring Batch에서 공식 지원하며, 파티션별 오프셋을 `ExecutionContext`에 저장해 재시작을 지원한다.

### 의존성 추가

```groovy
dependencies {
    implementation 'org.springframework.batch:spring-batch-infrastructure'
    implementation 'org.springframework.kafka:spring-kafka'
}
```

### KafkaItemReader 설정

```java
@Configuration
public class KafkaBatchConfig {

    @Bean
    @StepScope
    public KafkaItemReader<String, OrderEvent> kafkaOrderReader(
            @Value("#{jobParameters['targetDate']}") String targetDate) {

        // 읽을 파티션 지정 (0, 1, 2번 파티션)
        Map<TopicPartition, Long> partitionOffsets = new LinkedHashMap<>();
        partitionOffsets.put(new TopicPartition("order-events", 0), 0L);
        partitionOffsets.put(new TopicPartition("order-events", 1), 0L);
        partitionOffsets.put(new TopicPartition("order-events", 2), 0L);

        Properties consumerProperties = new Properties();
        consumerProperties.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "kafka:9092");
        consumerProperties.put(ConsumerConfig.GROUP_ID_CONFIG, "batch-order-" + targetDate);
        consumerProperties.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG,
            StringDeserializer.class);
        consumerProperties.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG,
            JsonDeserializer.class);
        consumerProperties.put(JsonDeserializer.TRUSTED_PACKAGES, "*");
        consumerProperties.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

        return new KafkaItemReaderBuilder<String, OrderEvent>()
            .name("kafkaOrderReader")
            .consumerProperties(consumerProperties)
            .topic("order-events")
            .partitions(0, 1, 2)
            .partitionOffsets(partitionOffsets)
            .pollTimeout(Duration.ofSeconds(30))   // 데이터 없을 때 대기 시간
            .saveState(true)                        // 재시작 지원 활성화
            .build();
    }
}
```

### 파티션 오프셋 관리와 재시작 동작

`KafkaItemReader`는 `saveState(true)` 설정 시, 각 파티션별 오프셋을 `ExecutionContext`에 저장한다. 재시작 시 마지막으로 커밋된 오프셋 이후부터 다시 읽기 시작한다.

```java
// ExecutionContext에 저장되는 형태 (내부 구현)
// "kafkaOrderReader.partition.0.offset" = 10500
// "kafkaOrderReader.partition.1.offset" = 9800
// "kafkaOrderReader.partition.2.offset" = 11200
```

**주의:** Kafka 배치 Reader는 `pollTimeout` 내에 데이터가 없으면 `null`을 반환해 Step을 종료한다. 따라서 특정 시점까지의 이벤트만 처리하려면 별도 종료 조건 로직이 필요하다.

```java
// 특정 오프셋까지만 읽는 커스텀 래퍼
@Slf4j
public class BoundedKafkaItemReader<K, V> implements ItemStreamReader<V> {

    private final KafkaItemReader<K, V> delegate;
    private final Map<Integer, Long> endOffsets; // 파티션별 종료 오프셋
    private int readCount = 0;
    private final long maxItems;

    @Override
    public V read() throws Exception {
        if (readCount >= maxItems) {
            log.info("최대 읽기 건수 도달 - readCount={}", readCount);
            return null;
        }
        V item = delegate.read();
        if (item != null) readCount++;
        return item;
    }

    // open, update, close는 delegate에 위임
}
```

---

## 대용량 쿼리 최적화

### JdbcPagingItemReader에서 커버링 인덱스 활용

대용량 테이블에서 페이지가 뒤로 갈수록 느려지는 이유는 **오프셋 스캔** 때문이다. `LIMIT 100 OFFSET 1000000`은 100만 건을 읽고 버린 뒤 100건을 반환한다.

```sql
-- 느린 쿼리 (100만 번째 페이지)
SELECT * FROM orders WHERE status = 'COMPLETED'
ORDER BY id
LIMIT 100 OFFSET 1000000;  -- 100만 건 스캔 후 버림

-- 커버링 인덱스 활용 (INDEX: idx_orders_status_id)
SELECT o.*
FROM orders o
INNER JOIN (
    SELECT id FROM orders WHERE status = 'COMPLETED'
    ORDER BY id LIMIT 100 OFFSET 1000000
) sub ON o.id = sub.id;
```

커버링 인덱스를 사용하면 인덱스만으로 오프셋 탐색을 완료하고, 실제 데이터는 필요한 100건만 읽는다.

```java
@Bean
@StepScope
public JdbcPagingItemReader<Order> coveringIndexOrderReader(DataSource dataSource) {
    Map<String, Order> sortKeys = Map.of("id", Order.ASC);

    MySqlPagingQueryProvider queryProvider = new MySqlPagingQueryProvider();
    // 커버링 인덱스 서브쿼리 활용
    queryProvider.setSelectClause("o.*");
    queryProvider.setFromClause("""
        orders o
        INNER JOIN (
            SELECT id FROM orders WHERE status = :status ORDER BY id
        ) sub ON o.id = sub.id
        """);
    queryProvider.setWhereClause("o.status = :status");
    queryProvider.setSortKeys(Map.of("o.id", Order.ASCENDING));

    return new JdbcPagingItemReaderBuilder<Order>()
        .name("coveringIndexOrderReader")
        .dataSource(dataSource)
        .queryProvider(queryProvider)
        .parameterValues(Map.of("status", "COMPLETED"))
        .pageSize(1000)
        .rowMapper(new BeanPropertyRowMapper<>(Order.class))
        .build();
}
```

### NoOffset 페이징 패턴 (id > lastId)

오프셋 방식의 근본적인 해결책은 **NoOffset 페이징**이다. 마지막으로 읽은 ID를 기억하고 `WHERE id > :lastId`로 다음 페이지를 조회한다.

```java
@Slf4j
public class NoOffsetJdbcItemReader<T> implements ItemStreamReader<T> {

    private static final String LAST_ID_KEY = "last.processed.id";

    private final JdbcTemplate jdbcTemplate;
    private final String sql;
    private final RowMapper<T> rowMapper;
    private final int pageSize;

    private long lastId = 0;
    private Queue<T> buffer = new LinkedList<>();
    private boolean exhausted = false;

    @Override
    public void open(ExecutionContext executionContext) {
        if (executionContext.containsKey(LAST_ID_KEY)) {
            this.lastId = executionContext.getLong(LAST_ID_KEY);
            log.info("재시작 - lastId={} 부터 재개", lastId);
        }
    }

    @Override
    public T read() {
        if (buffer.isEmpty()) {
            if (exhausted) return null;
            fetchNextBatch();
        }
        return buffer.poll();
    }

    private void fetchNextBatch() {
        // WHERE id > :lastId ORDER BY id LIMIT :pageSize
        List<T> items = jdbcTemplate.query(sql, rowMapper, lastId, pageSize);

        if (items.isEmpty()) {
            exhausted = true;
            return;
        }

        // 마지막 ID 업데이트는 별도 메커니즘 필요
        // (T가 id 필드를 가지고 있다고 가정)
        buffer.addAll(items);
        log.debug("배치 로드 완료 - count={}, lastId={}", items.size(), lastId);
    }

    @Override
    public void update(ExecutionContext executionContext) {
        executionContext.putLong(LAST_ID_KEY, lastId);
    }

    @Override
    public void close() {
        buffer.clear();
    }
}
```

### 실제 NoOffset 쿼리 설정 예시

```java
@Bean
@StepScope
public JdbcCursorItemReader<Order> noOffsetOrderReader(DataSource dataSource,
        @Value("#{jobParameters['minId']}") Long minId,
        @Value("#{jobParameters['maxId']}") Long maxId) {

    return new JdbcCursorItemReaderBuilder<Order>()
        .name("noOffsetOrderReader")
        .dataSource(dataSource)
        // NoOffset: 전체 범위를 커서로 스캔 (한 번만 스캔)
        .sql("""
            SELECT id, user_id, amount, status, created_at
            FROM orders
            WHERE id BETWEEN :minId AND :maxId
              AND status = 'COMPLETED'
            ORDER BY id
            """)
        .preparedStatementSetter(ps -> {
            ps.setLong(1, minId);
            ps.setLong(2, maxId);
        })
        .rowMapper(new BeanPropertyRowMapper<>(Order.class))
        .fetchSize(1000)   // JDBC fetchSize = 네트워크 왕복 최소화
        .build();
}
```

### 성능 비교 (1,000만 건 기준)

| 방식 | 100만 번째 페이지 응답 시간 | 메모리 사용 |
|------|--------------------------|------------|
| OFFSET 페이징 | ~15초 | 낮음 |
| 커버링 인덱스 | ~3초 | 낮음 |
| NoOffset (id >) | ~50ms | 낮음 |
| JdbcCursorItemReader | N/A (커서 방식) | 높음 (ResultSet 유지) |

### QuerydslNoOffsetPagingReader 패턴

Spring Batch + QueryDSL 조합에서 `QuerydslNoOffsetPagingReader`는 인기 있는 오픈소스 패턴이다 (jojoldu/spring-batch-plus 참고).

```java
// 핵심 아이디어: QueryDSL로 NoOffset 페이징 구현
@Slf4j
public class QuerydslNoOffsetPagingReader<T> extends AbstractPagingItemReader<T> {

    private final JPAQueryFactory queryFactory;
    private final Function<JPAQueryFactory, JPAQuery<T>> queryFunction;
    private final NumberPath<Long> idPath;
    private Long lastId = null;

    @Override
    protected void doReadPage() {
        JPAQuery<T> query = queryFactory
            .selectFrom(/* entity */)
            .where(
                lastId != null ? idPath.gt(lastId) : null,
                // 추가 조건들
                status.eq(OrderStatus.COMPLETED)
            )
            .orderBy(idPath.asc())
            .limit(getPageSize());

        List<T> results = query.fetch();

        if (!results.isEmpty()) {
            // 마지막 ID 추출 (리플렉션 또는 IdExtractor 인터페이스)
            lastId = extractLastId(results);
        }

        results.forEach(getResults()::add);
    }
}
```

**실무 팁:** NoOffset 방식은 정렬 기준 컬럼(보통 `id`)에 인덱스가 있어야 효과적이다. 복합 정렬(`created_at DESC, id DESC`)이 필요한 경우 `(created_at, id)` 복합 인덱스를 생성해야 한다.

---

## Zero Downtime 읽기 패턴

배치 처리 중 원본 테이블을 장시간 읽으면 인덱스 경합, 커넥션 점유, 실시간 서비스 응답 지연이 발생한다.

### 패턴 1: 스냅샷 테이블 기반 읽기

```java
@Configuration
public class SnapshotReadJobConfig {

    /**
     * Step 1: 원본 테이블 스냅샷 생성 (빠른 INSERT ... SELECT)
     * Step 2: 스냅샷 테이블에서 배치 처리 (원본 락 없음)
     * Step 3: 스냅샷 테이블 삭제
     */
    @Bean
    public Job snapshotBasedJob(JobRepository jobRepository,
                                Step createSnapshotStep,
                                Step processSnapshotStep,
                                Step dropSnapshotStep) {
        return new JobBuilder("snapshotBasedJob", jobRepository)
            .start(createSnapshotStep)
            .next(processSnapshotStep)
            .next(dropSnapshotStep)
            .build();
    }

    @Bean
    public Step createSnapshotStep(JobRepository jobRepository,
                                   PlatformTransactionManager transactionManager,
                                   JdbcTemplate jdbcTemplate) {
        return new StepBuilder("createSnapshotStep", jobRepository)
            .tasklet((contribution, chunkContext) -> {
                String targetDate = (String) chunkContext.getStepContext()
                    .getJobParameters().get("targetDate");

                // 스냅샷 테이블 생성 (원본 테이블 락 최소화)
                jdbcTemplate.execute("""
                    CREATE TABLE orders_snapshot_%s
                    AS SELECT * FROM orders
                    WHERE DATE(created_at) = '%s'
                      AND status = 'COMPLETED'
                    """.formatted(targetDate.replace("-", ""), targetDate));

                log.info("스냅샷 테이블 생성 완료 - targetDate={}", targetDate);
                return RepeatStatus.FINISHED;
            }, transactionManager)
            .build();
    }

    @Bean
    @StepScope
    public JdbcCursorItemReader<Order> snapshotTableReader(DataSource dataSource,
            @Value("#{jobParameters['targetDate']}") String targetDate) {
        String tableName = "orders_snapshot_" + targetDate.replace("-", "");

        return new JdbcCursorItemReaderBuilder<Order>()
            .name("snapshotTableReader")
            .dataSource(dataSource)
            .sql("SELECT * FROM " + tableName + " ORDER BY id")
            .rowMapper(new BeanPropertyRowMapper<>(Order.class))
            .fetchSize(1000)
            .build();
    }
}
```

### 패턴 2: created_at 범위 기반 읽기

```java
@Bean
@StepScope
public JdbcPagingItemReader<Order> rangeBasedOrderReader(DataSource dataSource,
        @Value("#{jobParameters['startTime']}") String startTime,
        @Value("#{jobParameters['endTime']}") String endTime) {

    MySqlPagingQueryProvider queryProvider = new MySqlPagingQueryProvider();
    queryProvider.setSelectClause("id, user_id, amount, status, created_at");
    queryProvider.setFromClause("orders");
    // 명시적인 시간 범위로 실시간 데이터 영향 최소화
    queryProvider.setWhereClause(
        "created_at >= :startTime AND created_at < :endTime AND status = 'COMPLETED'"
    );
    queryProvider.setSortKeys(Map.of("id", Order.ASCENDING));

    return new JdbcPagingItemReaderBuilder<Order>()
        .name("rangeBasedOrderReader")
        .dataSource(dataSource)
        .queryProvider(queryProvider)
        .parameterValues(Map.of("startTime", startTime, "endTime", endTime))
        .pageSize(500)
        .rowMapper(new BeanPropertyRowMapper<>(Order.class))
        .build();
}
```

**실무 팁:** `created_at` 범위를 어제 `00:00:00` ~ `23:59:59`로 고정하면 오늘 생성되는 데이터는 전혀 읽지 않으므로 실시간 서비스와의 간섭이 없다. `(status, created_at, id)` 복합 인덱스를 생성해 커버링 인덱스로 활용한다.

---

## Multi-DataSource Reader

여러 DB에서 데이터를 읽어 합치는 패턴은 레거시 시스템 통합이나 마이크로서비스 데이터 집계에서 자주 사용된다.

```java
@Slf4j
public class MultiDataSourceItemReader<T> extends AbstractItemCountingItemStreamItemReader<T> {

    private final List<JdbcCursorItemReader<T>> readers;
    private int currentReaderIndex = 0;
    private JdbcCursorItemReader<T> currentReader;

    public MultiDataSourceItemReader(List<JdbcCursorItemReader<T>> readers) {
        this.readers = readers;
        setName("multiDataSourceItemReader");
    }

    @Override
    protected void doOpen() throws Exception {
        if (readers.isEmpty()) {
            throw new ItemStreamException("읽기 대상 Reader가 없습니다");
        }
        currentReader = readers.get(0);
        currentReader.open(new ExecutionContext());
        log.info("MultiDataSourceItemReader 시작 - 총 {}개 DataSource", readers.size());
    }

    @Override
    protected T doRead() throws Exception {
        while (currentReaderIndex < readers.size()) {
            T item = currentReader.read();

            if (item != null) {
                return item;
            }

            // 현재 Reader 소진 → 다음 Reader로 전환
            currentReader.close();
            currentReaderIndex++;

            if (currentReaderIndex < readers.size()) {
                currentReader = readers.get(currentReaderIndex);
                currentReader.open(new ExecutionContext());
                log.info("DataSource 전환 - index={}", currentReaderIndex);
            }
        }
        return null; // 모든 Reader 소진
    }

    @Override
    protected void doClose() throws Exception {
        if (currentReader != null) {
            currentReader.close();
        }
        log.info("MultiDataSourceItemReader 종료");
    }
}
```

### 설정 예시

```java
@Bean
@StepScope
public MultiDataSourceItemReader<LegacyOrder> multiDbOrderReader(
        @Qualifier("primaryDataSource") DataSource primaryDs,
        @Qualifier("secondaryDataSource") DataSource secondaryDs) {

    JdbcCursorItemReader<LegacyOrder> primaryReader = new JdbcCursorItemReaderBuilder<LegacyOrder>()
        .name("primaryReader")
        .dataSource(primaryDs)
        .sql("SELECT * FROM orders WHERE region = 'KR' ORDER BY id")
        .rowMapper(new BeanPropertyRowMapper<>(LegacyOrder.class))
        .build();

    JdbcCursorItemReader<LegacyOrder> secondaryReader = new JdbcCursorItemReaderBuilder<LegacyOrder>()
        .name("secondaryReader")
        .dataSource(secondaryDs)
        .sql("SELECT * FROM orders WHERE region = 'US' ORDER BY id")
        .rowMapper(new BeanPropertyRowMapper<>(LegacyOrder.class))
        .build();

    return new MultiDataSourceItemReader<>(List.of(primaryReader, secondaryReader));
}
```

---

## 실무 팁 정리

**청크 사이즈와 fetchSize 일치**
`JdbcCursorItemReader`의 `fetchSize`는 JDBC 드라이버가 한 번에 가져오는 행 수다. 청크 사이즈와 동일하게 설정하면 네트워크 왕복을 최소화할 수 있다.

```java
.fetchSize(chunkSize) // 청크 사이즈와 동일하게
```

**재시작 시 Reader 이름 고정**
`ItemStreamReader`의 이름(`setName()`)이 `ExecutionContext`의 키 접두사로 사용된다. 이름을 변경하면 이전 상태를 찾지 못해 처음부터 다시 읽는다. 운영 배포 시 Reader 이름은 절대 변경하지 않는다.

**ConnectionPool 고갈 방지**
`JdbcCursorItemReader`는 Step이 완료될 때까지 JDBC 커넥션 하나를 점유한다. 대규모 병렬 Step에서 커넥션 풀이 고갈되지 않도록 `maximumPoolSize`를 파티션 수 이상으로 설정한다.

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20  # 파티션 수(10) + 여유분
      connection-timeout: 30000
```
