---
title: "Spring Batch: ItemProcessor와 ItemWriter 완전 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "itemprocessor", "itemwriter"]
---

## ItemProcessor 기본 개념

```java
public interface ItemProcessor<I, O> {
    O process(I item) throws Exception;
}
```

- `process()`가 `null`을 반환하면 해당 아이템은 **필터링**된다. `ItemWriter`로 전달되지 않는다.
- `I`는 `ItemReader`가 반환하는 타입, `O`는 `ItemWriter`가 받는 타입이다.
- Reader와 Writer의 타입이 다를 때 **변환** 역할을 담당한다.

비즈니스 검증/변환 로직을 `Processor`에 두는 이유:
- `ItemReader`는 데이터 읽기에만 집중한다 (단일 책임)
- `ItemWriter`는 쓰기에만 집중한다
- 두 관심사 사이의 변환/검증 로직이 `Processor`에 자연스럽게 위치한다
- 단독 테스트가 쉽다 (Reader/Writer 목 없이 Processor만 테스트 가능)

---

## 활용 패턴 코드 예제

### Order → OrderDto 변환 Processor

```java
@Component
public class OrderToOrderDtoProcessor implements ItemProcessor<Order, OrderDto> {

    @Override
    public OrderDto process(Order order) throws Exception {
        return OrderDto.builder()
            .orderId(order.getId())
            .customerName(order.getCustomer().getName())
            .totalAmount(order.getAmount())
            .formattedDate(order.getOrderDate().format(DateTimeFormatter.ofPattern("yyyy/MM/dd")))
            .build();
    }
}
```

### 조건 필터링 — 금액 0 이하 null 반환

```java
@Component
public class ValidOrderFilterProcessor implements ItemProcessor<Order, Order> {

    @Override
    public Order process(Order order) throws Exception {
        if (order.getAmount() <= 0) {
            log.debug("금액 0 이하 주문 필터링: orderId={}", order.getId());
            return null; // ItemWriter로 전달되지 않음
        }

        if (order.getStatus() != OrderStatus.PENDING) {
            log.debug("처리 대상 아닌 주문 필터링: orderId={}, status={}",
                order.getId(), order.getStatus());
            return null;
        }

        return order;
    }
}
```

### 외부 API 조회로 데이터 보강 (Enrichment)

```java
@Component
public class OrderEnrichmentProcessor implements ItemProcessor<Order, EnrichedOrder> {

    private final CustomerApiClient customerApiClient;
    private final ProductApiClient productApiClient;

    public OrderEnrichmentProcessor(CustomerApiClient customerApiClient,
                                     ProductApiClient productApiClient) {
        this.customerApiClient = customerApiClient;
        this.productApiClient = productApiClient;
    }

    @Override
    public EnrichedOrder process(Order order) throws Exception {
        // 외부 API로 추가 정보 조회
        CustomerInfo customer = customerApiClient.getCustomer(order.getCustomerId());
        ProductInfo product = productApiClient.getProduct(order.getProductId());

        return EnrichedOrder.builder()
            .order(order)
            .customerGrade(customer.getGrade())
            .productCategory(product.getCategory())
            .discountRate(calculateDiscount(customer.getGrade(), product.getCategory()))
            .build();
    }

    private double calculateDiscount(CustomerGrade grade, String category) {
        // 비즈니스 로직...
        return grade == CustomerGrade.VIP ? 0.1 : 0.0;
    }
}
```

외부 API 호출이 많다면 Processor 내에서 캐시를 사용하는 것이 좋다.

```java
// 같은 고객 정보를 반복 조회하지 않도록 캐싱
private final Map<String, CustomerInfo> customerCache = new HashMap<>();

private CustomerInfo getCustomerCached(String customerId) {
    return customerCache.computeIfAbsent(customerId, customerApiClient::getCustomer);
}
```

### @StepScope + JobParameters 주입

```java
@Component
@StepScope
public class DateFilterProcessor implements ItemProcessor<Order, Order> {

    private final LocalDate targetDate;

    public DateFilterProcessor(
            @Value("#{jobParameters['targetDate']}") LocalDate targetDate) {
        this.targetDate = targetDate;
    }

    @Override
    public Order process(Order order) throws Exception {
        if (!order.getOrderDate().equals(targetDate)) {
            return null; // 대상 날짜가 아니면 필터링
        }
        return order;
    }
}
```

---

## CompositeItemProcessor

여러 `ItemProcessor`를 체인으로 연결해 순서대로 실행한다. 앞 Processor의 출력이 다음 Processor의 입력이 된다.

```java
@Bean
public CompositeItemProcessor<Order, OrderDto> compositeOrderProcessor() {
    CompositeItemProcessor<Order, OrderDto> processor = new CompositeItemProcessor<>();
    processor.setDelegates(List.of(
        new ValidOrderFilterProcessor(),     // Order → Order (필터링)
        new OrderEnrichmentProcessor(...),   // Order → EnrichedOrder
        new EnrichedOrderToDtoProcessor()    // EnrichedOrder → OrderDto
    ));
    return processor;
}
```

**타입 변환 체인**: `CompositeItemProcessor`는 내부적으로 `Object` 타입으로 전달하므로 각 단계의 입출력 타입이 연속되도록 작성해야 한다. 첫 번째의 출력 타입이 두 번째의 입력 타입과 일치해야 한다.

```
Order → [ValidOrderFilter] → Order
Order → [OrderEnrichment] → EnrichedOrder
EnrichedOrder → [EnrichedOrderToDto] → OrderDto
```

```java
@Bean
public Step orderProcessStep() {
    return new StepBuilder("orderProcessStep", jobRepository)
        .<Order, OrderDto>chunk(100, transactionManager) // 전체 체인의 입출력 타입
        .reader(orderReader())
        .processor(compositeOrderProcessor())
        .writer(orderDtoWriter())
        .build();
}
```

---

## ValidatingItemProcessor

Bean Validation(`@Valid`)과 연동해 아이템 유효성을 검사한다.

```java
@Component
public class OrderValidatingProcessor implements ItemProcessor<Order, Order> {

    private final Validator validator;

    public OrderValidatingProcessor(Validator validator) {
        this.validator = validator;
    }

    @Override
    public Order process(Order order) throws Exception {
        Set<ConstraintViolation<Order>> violations = validator.validate(order);

        if (!violations.isEmpty()) {
            String message = violations.stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining(", "));

            // Skip을 원하면 SkipPolicy와 조합해서 예외를 던진다
            throw new ValidationException("주문 유효성 검사 실패 — orderId="
                + order.getId() + ", " + message);
        }

        return order;
    }
}
```

**검증 실패 시 예외 vs Skip 처리**: `process()`에서 예외를 던지면 Step의 `.faultTolerant().skip(ValidationException.class)`와 조합해 해당 아이템을 건너뛸 수 있다. `null`을 반환하면 조용히 필터링되어 로그에 남지 않으므로, 중요한 비즈니스 검증에는 예외를 던지고 Skip/Retry 정책으로 처리하는 것이 추적성 측면에서 더 좋다.

---

## ItemWriter (Spring Batch 5.x)

```java
// Spring Batch 4.x
public interface ItemWriter<T> {
    void write(List<? extends T> items) throws Exception;
}

// Spring Batch 5.x — List → Chunk 변경
public interface ItemWriter<T> {
    void write(Chunk<? extends T> chunk) throws Exception;
}
```

`Chunk<T>`는 `Iterable<T>`를 구현하므로 기존 `for-each` 코드는 그대로 동작한다. 다만 `List`를 직접 받던 코드는 마이그레이션이 필요하다.

---

## FlatFileItemWriter

```java
@Bean
@StepScope
public FlatFileItemWriter<OrderDto> orderCsvWriter(
        @Value("#{jobParameters['outputFilePath']}") String outputFilePath) {

    // 필드 추출
    BeanWrapperFieldExtractor<OrderDto> fieldExtractor = new BeanWrapperFieldExtractor<>();
    fieldExtractor.setNames(new String[]{"orderId", "customerName", "totalAmount", "formattedDate"});

    // CSV 형식으로 조합
    DelimitedLineAggregator<OrderDto> lineAggregator = new DelimitedLineAggregator<>();
    lineAggregator.setDelimiter(",");
    lineAggregator.setFieldExtractor(fieldExtractor);

    return new FlatFileItemWriterBuilder<OrderDto>()
        .name("orderCsvWriter")
        .resource(new FileSystemResource(outputFilePath))
        .lineAggregator(lineAggregator)
        .shouldDeleteIfExists(true) // 파일 존재 시 삭제 후 새로 생성
        // .appendAllowed(true)     // 파일 존재 시 이어쓰기 (재시작 지원)
        .headerCallback(writer ->
            writer.write("ORDER_ID,CUSTOMER_NAME,TOTAL_AMOUNT,ORDER_DATE"))
        .footerCallback(writer ->
            writer.write("TOTAL RECORDS: generated at " + LocalDateTime.now()))
        .build();
}
```

**`shouldDeleteIfExists` vs `appendAllowed`**:
- `shouldDeleteIfExists(true)`: 매 실행마다 새 파일 생성
- `appendAllowed(true)`: 재시작 시 기존 파일 끝에 이어 쓰기 (재시작 지원에 필요)

두 옵션은 동시에 설정할 수 없다.

---

## JdbcBatchItemWriter

JDBC Batch를 사용해 여러 행을 한 번의 DB 왕복으로 처리한다. DB Writer 중 가장 성능이 좋다.

### beanMapped() 방식 — 객체 필드와 SQL 파라미터 자동 매핑

```java
@Bean
public JdbcBatchItemWriter<OrderDto> orderJdbcWriter() {
    return new JdbcBatchItemWriterBuilder<OrderDto>()
        .dataSource(dataSource)
        .sql("""
            INSERT INTO processed_orders
                (order_id, customer_name, total_amount, order_date, processed_at)
            VALUES
                (:orderId, :customerName, :totalAmount, :formattedDate, NOW())
            ON DUPLICATE KEY UPDATE
                total_amount = :totalAmount,
                processed_at = NOW()
            """)
        .beanMapped()          // OrderDto의 필드명과 :파라미터명 자동 매핑
        .assertUpdates(true)   // 각 아이템에 대해 update 건수가 1 이상인지 검증
        .build();
}
```

### columnMapped() 방식 — Map으로 직접 매핑

```java
@Bean
public JdbcBatchItemWriter<Map<String, Object>> mapBasedWriter() {
    return new JdbcBatchItemWriterBuilder<Map<String, Object>>()
        .dataSource(dataSource)
        .sql("INSERT INTO summary (date, count, amount) VALUES (:date, :count, :amount)")
        .columnMapped() // Map의 키와 :파라미터명 매핑
        .build();
}
```

**성능이 좋은 이유**: `JdbcBatchItemWriter`는 내부적으로 `NamedParameterJdbcTemplate.batchUpdate()`를 호출한다. 이는 JDBC `PreparedStatement.addBatch()` / `executeBatch()`를 사용해 여러 행을 하나의 네트워크 패킷에 묶어 전송한다. 행마다 네트워크 왕복이 발생하는 일반 INSERT보다 수십 배 빠르다.

**`assertUpdates` 옵션**: UPDATE 쿼리를 사용할 때 영향받은 행이 0이면 `EmptyResultDataAccessException`을 던진다. 처리해야 할 레코드가 존재하지 않는 상황을 빠르게 감지할 수 있다.

---

## JpaItemWriter

```java
@Bean
public JpaItemWriter<OrderEntity> jpaOrderWriter(EntityManagerFactory entityManagerFactory) {
    return new JpaItemWriterBuilder<OrderEntity>()
        .entityManagerFactory(entityManagerFactory)
        .build();
}
```

`JpaItemWriter`는 내부적으로 `EntityManager.merge()`를 호출한다. 엔티티가 존재하면 업데이트, 없으면 삽입한다.

**IDENTITY 전략에서 배치 INSERT 불가 문제**:
```java
// 이런 엔티티는 JpaItemWriter로 배치 INSERT가 불가능하다
@Entity
public class OrderEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // 문제
    private Long id;
}
```

`IDENTITY` 전략은 INSERT 후 DB가 생성한 ID를 즉시 조회해야 한다. 이 때문에 Hibernate가 `addBatch()`를 포기하고 행마다 INSERT를 실행한다.

**해결책 1 — SEQUENCE 전략 사용**:
```java
@Entity
public class OrderEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE,
                    generator = "order_seq")
    @SequenceGenerator(name = "order_seq",
                       sequenceName = "order_sequence",
                       allocationSize = 50) // ID를 50개씩 미리 확보
    private Long id;
}
```

**해결책 2 — JdbcBatchItemWriter 사용**:
대용량 INSERT가 주 목적이라면 처음부터 `JdbcBatchItemWriter`를 사용한다. JPA의 편의성보다 성능이 중요한 배치 환경에서는 이 선택이 현실적이다.

---

## CompositeItemWriter

여러 Writer에 같은 아이템을 동시에 쓴다. 모든 Writer가 동일한 트랜잭션에 참여한다.

```java
@Bean
public CompositeItemWriter<OrderDto> compositeWriter() {
    return new CompositeItemWriterBuilder<OrderDto>()
        .delegates(List.of(
            orderJdbcWriter(),     // DB에 저장
            orderCsvWriter(null),  // CSV 파일로 출력
            orderAuditWriter()     // 감사 로그 테이블에 기록
        ))
        .build();
}
```

**트랜잭션 공유 동작**: 파일 Writer(`FlatFileItemWriter`)는 트랜잭션에 참여하지 않는다. DB Writer가 롤백되더라도 이미 파일에 쓴 내용은 되돌려지지 않는다. 재시작 시 파일에 중복 기록이 생길 수 있으므로 `appendAllowed(true)`와 조합하거나, 파일 쓰기를 별도 Step으로 분리하는 방법을 고려한다.

---

## ClassifierCompositeItemWriter

아이템의 타입이나 속성에 따라 서로 다른 Writer로 분기한다.

```java
// 분기 기준을 담은 Classifier 구현
public class OrderTypeClassifier implements Classifier<OrderDto, ItemWriter<? super OrderDto>> {

    private final ItemWriter<OrderDto> domesticWriter;
    private final ItemWriter<OrderDto> overseasWriter;
    private final ItemWriter<OrderDto> cancelledWriter;

    public OrderTypeClassifier(ItemWriter<OrderDto> domesticWriter,
                                ItemWriter<OrderDto> overseasWriter,
                                ItemWriter<OrderDto> cancelledWriter) {
        this.domesticWriter = domesticWriter;
        this.overseasWriter = overseasWriter;
        this.cancelledWriter = cancelledWriter;
    }

    @Override
    public ItemWriter<? super OrderDto> classify(OrderDto order) {
        return switch (order.getOrderType()) {
            case DOMESTIC -> domesticWriter;
            case OVERSEAS -> overseasWriter;
            case CANCELLED -> cancelledWriter;
        };
    }
}
```

```java
@Bean
public ClassifierCompositeItemWriter<OrderDto> classifierWriter() {
    ClassifierCompositeItemWriter<OrderDto> writer = new ClassifierCompositeItemWriter<>();
    writer.setClassifier(new OrderTypeClassifier(
        domesticOrderWriter(),
        overseasOrderWriter(),
        cancelledOrderWriter()
    ));
    return writer;
}
```

```java
@Bean
public Step classifiedOrderStep() {
    return new StepBuilder("classifiedOrderStep", jobRepository)
        .<OrderDto, OrderDto>chunk(100, transactionManager)
        .reader(orderReader())
        .writer(classifierWriter())
        // ClassifierCompositeItemWriter는 ItemStream을 직접 구현하지 않으므로
        // 내부 Writer들을 별도로 스트림 등록해야 한다
        .stream(domesticOrderWriter())
        .stream(overseasOrderWriter())
        .stream(cancelledOrderWriter())
        .build();
}
```

> **실무 팁**: `ClassifierCompositeItemWriter`를 사용할 때는 내부 Writer가 `ItemStream`을 구현하는 경우(`FlatFileItemWriter` 등) Step에 `.stream()`으로 등록해야 한다. 그렇지 않으면 재시작 시 `open()`/`close()`가 호출되지 않아 파일이 정상적으로 관리되지 않는다.
