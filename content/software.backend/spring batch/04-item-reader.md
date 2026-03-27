---
title: "Spring Batch: ItemReader 완전 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "itemreader", "jdbc", "file"]
---

## ItemReader 기본 개념

```java
public interface ItemReader<T> {
    T read() throws Exception, UnexpectedInputException,
                    ParseException, NonTransientResourceException;
}
```

`read()`가 `null`을 반환하면 입력이 끝났다는 신호다. Spring Batch는 `null`을 받으면 해당 Step의 읽기를 종료하고 남은 아이템으로 마지막 청크를 처리한다.

### ItemStreamReader — 재시작 지원

```java
public interface ItemStreamReader<T> extends ItemStream, ItemReader<T> {}

public interface ItemStream {
    void open(ExecutionContext executionContext);   // 스트림 열기, 상태 복원
    void update(ExecutionContext executionContext); // 청크마다 현재 상태 저장
    void close();                                  // 스트림 닫기
}
```

- `open()`: 배치 시작(또는 재시작) 시 호출된다. `ExecutionContext`에 저장된 오프셋을 읽어 중단 지점부터 재개한다.
- `update()`: 청크가 커밋될 때마다 호출된다. 현재 위치를 `ExecutionContext`에 저장한다.
- `close()`: Step 종료 시 호출된다. 파일 스트림이나 DB 커넥션을 닫는다.

### Thread-safety 주의사항

Spring Batch의 기본 제공 `ItemStreamReader` 구현체(`FlatFileItemReader`, `JdbcCursorItemReader` 등)는 대부분 **Thread-safe하지 않다**. Multi-threaded Step에서 사용하려면 `SynchronizedItemStreamReader`로 래핑해야 한다.

```java
@Bean
public SynchronizedItemStreamReader<Order> synchronizedOrderReader() {
    return new SynchronizedItemStreamReaderBuilder<Order>()
        .delegate(orderFlatFileReader()) // Thread-safe하지 않은 원본 Reader
        .build();
}
```

---

## FlatFileItemReader

### CSV 파일 (DelimitedLineTokenizer)

```java
// 처리할 CSV 파일 예시
// orderId,customerId,amount,orderDate
// 1001,CUST001,50000,2026-03-27
// 1002,CUST002,30000,2026-03-27

@Bean
@StepScope
public FlatFileItemReader<Order> orderCsvReader(
        @Value("#{jobParameters['filePath']}") String filePath) {

    return new FlatFileItemReaderBuilder<Order>()
        .name("orderCsvReader")
        .resource(new FileSystemResource(filePath))
        .linesToSkip(1)         // 헤더 행 건너뜀
        .encoding("UTF-8")
        .strict(true)           // 파일 없으면 예외 발생 (false면 무시)
        .delimited()
            .delimiter(",")
            .names("orderId", "customerId", "amount", "orderDate")
        .targetType(Order.class)
        .build();
}
```

`@StepScope`를 선언하면 Step이 실행되는 시점에 Bean이 생성되므로 `#{jobParameters['filePath']}`와 같은 SpEL 표현식으로 JobParameters를 주입받을 수 있다.

### 고정 길이 파일 (FixedLengthTokenizer)

```java
// 처리할 고정 길이 파일 예시
// 1001CUST00150000000000002026-03-27
// 필드: orderId(4), customerId(7), amount(11), orderDate(10)

@Bean
public FlatFileItemReader<Order> fixedLengthOrderReader() {
    return new FlatFileItemReaderBuilder<Order>()
        .name("fixedLengthOrderReader")
        .resource(new ClassPathResource("data/orders.dat"))
        .fixedLength()
            .columns(
                new Range(1, 4),   // orderId
                new Range(5, 11),  // customerId
                new Range(12, 22), // amount
                new Range(23, 32)  // orderDate
            )
            .names("orderId", "customerId", "amount", "orderDate")
        .targetType(Order.class)
        .build();
}
```

### DefaultLineMapper + BeanWrapperFieldSetMapper (수동 조립)

타입 변환이나 커스텀 매핑이 필요할 때 직접 조립한다.

```java
@Bean
public FlatFileItemReader<Order> customMappedReader() {
    DefaultLineMapper<Order> lineMapper = new DefaultLineMapper<>();

    DelimitedLineTokenizer tokenizer = new DelimitedLineTokenizer();
    tokenizer.setNames("orderId", "customerId", "amount", "orderDate");
    tokenizer.setDelimiter(",");

    BeanWrapperFieldSetMapper<Order> fieldSetMapper = new BeanWrapperFieldSetMapper<>();
    fieldSetMapper.setTargetType(Order.class);
    // 날짜 타입 변환 커스터마이징
    fieldSetMapper.setConversionService(conversionService());

    lineMapper.setLineTokenizer(tokenizer);
    lineMapper.setFieldSetMapper(fieldSetMapper);

    FlatFileItemReader<Order> reader = new FlatFileItemReader<>();
    reader.setName("customMappedReader");
    reader.setResource(new ClassPathResource("data/orders.csv"));
    reader.setLinesToSkip(1);
    reader.setEncoding("UTF-8");
    reader.setLineMapper(lineMapper);
    return reader;
}
```

---

## JsonItemReader

```java
// JSON 파일 예시
// [
//   {"orderId": 1001, "customerId": "CUST001", "amount": 50000},
//   {"orderId": 1002, "customerId": "CUST002", "amount": 30000}
// ]

@Bean
public JsonItemReader<Order> orderJsonReader() {
    return new JsonItemReaderBuilder<Order>()
        .name("orderJsonReader")
        .jsonObjectReader(new JacksonJsonObjectReader<>(Order.class))
        .resource(new ClassPathResource("data/orders.json"))
        .build();
}
```

---

## MultiResourceItemReader

여러 CSV 파일을 순서대로 처리한다. 파일이 동적으로 생성되는 환경에서 유용하다.

```java
@Bean
@StepScope
public MultiResourceItemReader<Order> multiFileOrderReader(
        @Value("#{jobParameters['filePattern']}") String filePattern) throws IOException {

    // 패턴에 맞는 모든 리소스 조회
    Resource[] resources = ResourcePatternUtils
        .getResourcePatternResolver(new DefaultResourceLoader())
        .getResources(filePattern);

    // 파일명 기준 정렬 (처리 순서 보장)
    Arrays.sort(resources, Comparator.comparing(r -> r.getFilename()));

    return new MultiResourceItemReaderBuilder<Order>()
        .name("multiFileOrderReader")
        .resources(resources)
        .delegate(orderCsvReader(null)) // 단일 파일 처리 Reader 위임
        .build();
}
```

---

## JdbcCursorItemReader

DB 커서를 열어 한 행씩 읽는 방식이다. 단일 커넥션을 유지하면서 데이터를 스트리밍으로 가져온다.

```java
@Bean
@StepScope
public JdbcCursorItemReader<Order> orderCursorReader(
        @Value("#{jobParameters['targetDate']}") LocalDate targetDate) {

    return new JdbcCursorItemReaderBuilder<Order>()
        .name("orderCursorReader")
        .dataSource(dataSource)
        .sql("""
            SELECT order_id, customer_id, amount, order_date, status
            FROM orders
            WHERE order_date = ?
              AND status = 'PENDING'
            ORDER BY order_id
            """)
        .preparedStatementSetter(ps -> ps.setDate(1, Date.valueOf(targetDate)))
        .rowMapper(new BeanPropertyRowMapper<>(Order.class))
        .fetchSize(1000)  // 한 번의 네트워크 왕복으로 가져올 행 수
        .build();
}
```

**fetchSize 튜닝**: DB 드라이버가 한 번에 서버에서 가져오는 행 수를 설정한다. 기본값이 작으면 행마다 네트워크 왕복이 발생해 성능이 크게 저하된다. 일반적으로 chunk size와 같거나 2~5배 정도로 설정한다.

**단일 커넥션 장기 점유 주의**: 커서 방식은 처리가 완료될 때까지 DB 커넥션을 점유한다. 처리 시간이 길거나 커넥션 풀이 작은 환경에서는 커넥션 고갈이 발생할 수 있다. 이 경우 `JdbcPagingItemReader`를 사용한다.

---

## JdbcPagingItemReader

페이지 단위로 쿼리를 반복 실행하는 방식이다. 청크마다 커넥션을 반환하므로 커넥션 점유 문제가 없다.

### SqlPagingQueryProviderFactoryBean 사용

```java
@Bean
public JdbcPagingItemReader<Order> orderPagingReader() throws Exception {

    SqlPagingQueryProviderFactoryBean queryProvider = new SqlPagingQueryProviderFactoryBean();
    queryProvider.setDataSource(dataSource);
    queryProvider.setSelectClause("SELECT order_id, customer_id, amount, order_date, status");
    queryProvider.setFromClause("FROM orders");
    queryProvider.setWhereClause("WHERE status = 'PENDING'");
    queryProvider.setSortKeys(Map.of("order_id", Order.ASCENDING)); // 정렬 키 필수

    return new JdbcPagingItemReaderBuilder<Order>()
        .name("orderPagingReader")
        .dataSource(dataSource)
        .queryProvider(queryProvider.getObject())
        .parameterValues(Map.of("status", "PENDING"))
        .pageSize(500)
        .rowMapper(new BeanPropertyRowMapper<>(Order.class))
        .build();
}
```

**sortKeys가 필수인 이유**: 페이징 쿼리는 `OFFSET`과 `LIMIT`(또는 DB별 동등 문법)을 사용한다. 정렬 기준이 없으면 페이지가 넘어갈 때 이전 페이지 데이터가 다시 등장하거나 누락될 수 있다. 반드시 고유한 컬럼(보통 PK)을 정렬 기준으로 설정해야 한다.

### MySqlPagingQueryProvider 직접 구현

```java
@Bean
public JdbcPagingItemReader<Order> mysqlOrderReader() throws Exception {

    MySqlPagingQueryProvider queryProvider = new MySqlPagingQueryProvider();
    queryProvider.setSelectClause("order_id, customer_id, amount, order_date");
    queryProvider.setFromClause("orders o INNER JOIN customers c ON o.customer_id = c.id");
    queryProvider.setWhereClause("o.status = :status AND o.order_date = :targetDate");
    queryProvider.setSortKeys(Map.of(
        "o.order_date", Order.ASCENDING,
        "o.order_id", Order.ASCENDING
    ));

    return new JdbcPagingItemReaderBuilder<Order>()
        .name("mysqlOrderReader")
        .dataSource(dataSource)
        .queryProvider(queryProvider)
        .parameterValues(Map.of(
            "status", "PENDING",
            "targetDate", LocalDate.of(2026, 3, 27)
        ))
        .pageSize(500)
        .rowMapper(new BeanPropertyRowMapper<>(Order.class))
        .build();
}
```

---

## JpaCursorItemReader / JpaPagingItemReader

JPA를 사용하는 환경에서 엔티티를 직접 읽을 수 있다.

```java
// JpaCursorItemReader (Spring Batch 4.3+ 추가)
@Bean
@StepScope
public JpaCursorItemReader<Order> jpaOrderCursorReader(
        EntityManagerFactory entityManagerFactory,
        @Value("#{jobParameters['targetDate']}") LocalDate targetDate) {

    return new JpaCursorItemReaderBuilder<Order>()
        .name("jpaOrderCursorReader")
        .entityManagerFactory(entityManagerFactory)
        .queryString("SELECT o FROM Order o WHERE o.orderDate = :targetDate AND o.status = 'PENDING' ORDER BY o.id")
        .parameterValues(Map.of("targetDate", targetDate))
        .build();
}

// JpaPagingItemReader
@Bean
@StepScope
public JpaPagingItemReader<Order> jpaOrderPagingReader(
        EntityManagerFactory entityManagerFactory) {

    return new JpaPagingItemReaderBuilder<Order>()
        .name("jpaOrderPagingReader")
        .entityManagerFactory(entityManagerFactory)
        .queryString("SELECT o FROM Order o WHERE o.status = 'PENDING' ORDER BY o.id")
        .pageSize(500)
        .build();
}
```

---

## 커서 vs 페이징 선택 기준

| 기준 | JdbcCursorItemReader | JdbcPagingItemReader |
|------|---------------------|---------------------|
| 커넥션 점유 시간 | 처리 완료까지 1개 점유 | 청크마다 반환 |
| Thread-safety | Thread-safe 아님 | Thread-safe (병렬 가능) |
| 대용량 안전성 | 커넥션 타임아웃 위험 | 상대적으로 안전 |
| 재시작 지원 | ExecutionContext로 커서 위치 복원 | 페이지 번호 저장 후 복원 |
| 성능 | 빠름 (단일 쿼리) | 약간 느림 (반복 쿼리) |
| 적합한 상황 | 단일 스레드, 빠른 처리 | 멀티스레드, 안정성 우선 |

---

## 커스텀 ItemStreamReader 구현 — API 기반 Reader

외부 API를 호출해 데이터를 가져오는 Reader다. 페이지네이션을 지원하며, 재시작 시 마지막 처리한 페이지부터 재개한다.

```java
@Component
@StepScope
public class ExternalApiOrderReader implements ItemStreamReader<Order> {

    private static final String CURRENT_PAGE_KEY = "external.api.current.page";

    private final ExternalOrderApiClient apiClient;

    private int currentPage = 0;
    private int totalPages = Integer.MAX_VALUE;
    private Queue<Order> itemBuffer = new LinkedList<>();

    public ExternalApiOrderReader(ExternalOrderApiClient apiClient) {
        this.apiClient = apiClient;
    }

    @Override
    public void open(ExecutionContext executionContext) {
        // 재시작 시 이전 페이지 번호 복원
        if (executionContext.containsKey(CURRENT_PAGE_KEY)) {
            currentPage = executionContext.getInt(CURRENT_PAGE_KEY);
            log.info("API Reader 재시작: 페이지 {}부터 재개", currentPage);
        }
    }

    @Override
    public void update(ExecutionContext executionContext) {
        // 청크 커밋마다 현재 페이지 번호 저장
        executionContext.putInt(CURRENT_PAGE_KEY, currentPage);
    }

    @Override
    public void close() {
        itemBuffer.clear();
    }

    @Override
    public Order read() throws Exception {
        // 버퍼에 아이템이 있으면 반환
        if (!itemBuffer.isEmpty()) {
            return itemBuffer.poll();
        }

        // 모든 페이지 처리 완료
        if (currentPage >= totalPages) {
            return null; // 입력 종료
        }

        // 다음 페이지 API 호출
        PageResponse<Order> response = apiClient.fetchOrders(currentPage, 100);
        totalPages = response.getTotalPages();
        itemBuffer.addAll(response.getContent());
        currentPage++;

        return itemBuffer.isEmpty() ? null : itemBuffer.poll();
    }
}
```

```java
@Bean
public Step apiOrderStep() {
    return new StepBuilder("apiOrderStep", jobRepository)
        .<Order, OrderDto>chunk(100, transactionManager)
        .reader(externalApiOrderReader)
        .processor(orderProcessor())
        .writer(orderWriter())
        .build();
}
```

> **실무 팁**: `JdbcCursorItemReader`와 `JdbcPagingItemReader`는 용도가 명확히 다르다. 단일 스레드 배치에서 빠른 처리가 필요하다면 Cursor, 멀티스레드 병렬 처리나 커넥션 안정성이 중요하다면 Paging을 선택한다. JPA 환경이더라도 대용량 배치에서는 `JpaPagingItemReader`보다 `JdbcPagingItemReader`가 성능이 좋은 경우가 많다. JPA의 1차 캐시, 지연 로딩, 변경 감지 등이 배치 처리에는 오히려 오버헤드가 될 수 있기 때문이다.
