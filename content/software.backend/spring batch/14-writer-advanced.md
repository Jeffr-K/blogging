---
title: "Spring Batch: ItemWriter 심화 — 대용량 쓰기 최적화"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "itemwriter", "jdbc-batch", "optimization"]
---

## 개요

배치 처리에서 쓰기 성능은 전체 처리 속도를 결정하는 핵심 요소다. 1건씩 INSERT하는 방식과 JDBC Batch INSERT를 비교하면 수십 배의 성능 차이가 발생한다. 이 글에서는 JDBC Batch 최적화부터 S3, Elasticsearch, Kafka 등 다양한 외부 시스템에 쓰는 커스텀 `ItemWriter` 구현까지 다룬다.

---

## JDBC Batch INSERT 최적화

### hibernate.jdbc.batch_size 설정

JPA를 사용하는 경우 하이버네이트 배치 설정이 필수다.

```yaml
spring:
  jpa:
    properties:
      hibernate:
        jdbc:
          batch_size: 500          # 한 번에 JDBC 배치로 전송할 쿼리 수
        order_inserts: true         # INSERT 문을 엔티티별로 그룹화
        order_updates: true         # UPDATE 문을 엔티티별로 그룹화
        generate_statistics: true   # 개발 시 배치 동작 확인용
```

`order_inserts=true`가 중요하다. 배치 처리 중 여러 엔티티 타입이 섞이면 배치가 깨진다. 이 옵션을 켜면 같은 타입끼리 모아서 한 번에 배치 전송한다.

### MySQL JDBC URL 최적화

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/batch_db?rewriteBatchedStatements=true&useSSL=false&characterEncoding=UTF-8
```

`rewriteBatchedStatements=true`는 MySQL JDBC 드라이버에서 개별 INSERT 문을 하나의 멀티 VALUE INSERT로 재작성한다. 이 옵션 없이는 JDBC `addBatch()`를 호출해도 서버에 개별 쿼리가 전송된다.

```sql
-- rewriteBatchedStatements=false (기본)
INSERT INTO orders (id, amount) VALUES (1, 1000);
INSERT INTO orders (id, amount) VALUES (2, 2000);
INSERT INTO orders (id, amount) VALUES (3, 3000);

-- rewriteBatchedStatements=true (최적화)
INSERT INTO orders (id, amount) VALUES (1, 1000), (2, 2000), (3, 3000);
```

### 실제 성능 비교 (100만 건 INSERT, MySQL 8.0)

| 방식 | 처리 시간 | TPS |
|------|---------|-----|
| 1건씩 INSERT (JPA save) | 약 520초 | ~1,900 |
| Batch 100건 (rewriteBatched OFF) | 약 85초 | ~11,700 |
| Batch 100건 (rewriteBatched ON) | 약 18초 | ~55,500 |
| Batch 1,000건 (rewriteBatched ON) | 약 9초 | ~111,000 |

**주의:** Batch 사이즈가 무조건 클수록 좋은 것은 아니다. 1,000건 이상에서는 메모리 사용량 증가와 트랜잭션 롤백 비용이 커진다. 실측 후 500~1,000 사이에서 결정한다.

---

## JdbcBatchItemWriter 심화

### ItemPreparedStatementSetter 방식

```java
@Bean
public JdbcBatchItemWriter<Settlement> settlementWriter(DataSource dataSource) {
    return new JdbcBatchItemWriterBuilder<Settlement>()
        .dataSource(dataSource)
        .sql("""
            INSERT INTO settlements (order_id, user_id, amount, fee, settled_at)
            VALUES (?, ?, ?, ?, ?)
            """)
        .itemPreparedStatementSetter((item, ps) -> {
            ps.setLong(1, item.getOrderId());
            ps.setLong(2, item.getUserId());
            ps.setBigDecimal(3, item.getAmount());
            ps.setBigDecimal(4, item.getFee());
            ps.setTimestamp(5, Timestamp.valueOf(item.getSettledAt()));
        })
        .build();
}
```

### NamedParameterJdbcTemplate 방식 (가독성 높음)

```java
@Bean
public JdbcBatchItemWriter<Settlement> namedParamSettlementWriter(DataSource dataSource) {
    return new JdbcBatchItemWriterBuilder<Settlement>()
        .dataSource(dataSource)
        .sql("""
            INSERT INTO settlements (order_id, user_id, amount, fee, settled_at)
            VALUES (:orderId, :userId, :amount, :fee, :settledAt)
            """)
        .beanMapped()  // Settlement 필드명과 :파라미터명을 자동 매핑
        .build();
}
```

### UPSERT SQL 예제

이미 정산된 데이터를 다시 실행해도 안전하게 처리하는 멱등성 보장 패턴이다.

```java
@Bean
public JdbcBatchItemWriter<Settlement> upsertSettlementWriter(DataSource dataSource) {
    return new JdbcBatchItemWriterBuilder<Settlement>()
        .dataSource(dataSource)
        // MySQL UPSERT
        .sql("""
            INSERT INTO settlements (order_id, user_id, amount, fee, settled_at)
            VALUES (:orderId, :userId, :amount, :fee, :settledAt)
            ON DUPLICATE KEY UPDATE
                amount = VALUES(amount),
                fee = VALUES(fee),
                settled_at = VALUES(settled_at),
                updated_at = NOW()
            """)
        .beanMapped()
        .assertUpdates(false)  // UPSERT 시 영향 행이 0일 수 있으므로 false
        .build();
}
```

**`assertUpdates=false` 사용 시점:**
- `ON DUPLICATE KEY UPDATE` UPSERT (조건에 따라 0행 업데이트 가능)
- 조건부 UPDATE (`WHERE status = 'PENDING'` 등)
- Soft delete 후 재처리 시 이미 삭제된 행 업데이트
- 기본값(`true`)은 UPDATE 영향 행이 0이면 예외를 던져 데이터 누락을 방지한다.

---

## 커스텀 ItemWriter 구현

### 외부 API 호출 Writer (Bulk API 활용)

```java
@Slf4j
@RequiredArgsConstructor
public class BulkApiItemWriter<T> implements ItemWriter<T> {

    private final ExternalApiClient apiClient;
    private final int bulkSize;

    @Override
    public void write(Chunk<? extends T> chunk) throws Exception {
        List<? extends T> items = chunk.getItems();

        // Bulk API는 한 번에 처리할 수 있는 최대 크기가 있음
        // 청크 사이즈 > bulkSize인 경우 분할 전송
        List<List<? extends T>> batches = partition(items, bulkSize);

        for (List<? extends T> batch : batches) {
            BulkRequest<T> request = BulkRequest.<T>builder()
                .items(batch)
                .idempotencyKey(UUID.randomUUID().toString())
                .build();

            BulkResponse response = apiClient.bulkCreate(request);

            if (!response.isSuccess()) {
                log.error("Bulk API 실패 - failedCount={}, errors={}",
                    response.getFailedCount(), response.getErrors());
                throw new ItemWriteException("Bulk API 부분 실패: " + response.getErrors());
            }

            log.info("Bulk API 성공 - processedCount={}", batch.size());
        }
    }

    private <E> List<List<E>> partition(List<E> list, int size) {
        List<List<E>> result = new ArrayList<>();
        for (int i = 0; i < list.size(); i += size) {
            result.add(list.subList(i, Math.min(i + size, list.size())));
        }
        return result;
    }
}
```

### S3 파일 업로드 Writer 전체 코드

```java
@Slf4j
public class S3ItemWriter<T> implements ItemWriter<T>, ItemStream {

    private static final String FILE_INDEX_KEY = "s3.writer.file.index";

    private final S3Client s3Client;
    private final String bucketName;
    private final String keyPrefix;
    private final ObjectMapper objectMapper;
    private final int itemsPerFile;

    private int currentFileIndex = 0;
    private int currentItemCount = 0;
    private List<T> currentBatch = new ArrayList<>();

    @Override
    public void open(ExecutionContext executionContext) throws ItemStreamException {
        if (executionContext.containsKey(FILE_INDEX_KEY)) {
            this.currentFileIndex = executionContext.getInt(FILE_INDEX_KEY);
            log.info("S3Writer 재시작 - fileIndex={}", currentFileIndex);
        }
    }

    @Override
    public void write(Chunk<? extends T> chunk) throws Exception {
        currentBatch.addAll(chunk.getItems());
        currentItemCount += chunk.getItems().size();

        // itemsPerFile 초과 시 S3 업로드
        while (currentBatch.size() >= itemsPerFile) {
            List<T> uploadBatch = new ArrayList<>(currentBatch.subList(0, itemsPerFile));
            uploadToS3(uploadBatch);
            currentBatch = new ArrayList<>(currentBatch.subList(itemsPerFile, currentBatch.size()));
            currentFileIndex++;
        }
    }

    private void uploadToS3(List<T> items) throws JsonProcessingException {
        String key = "%s/part-%05d.json".formatted(keyPrefix, currentFileIndex);
        byte[] content = objectMapper.writeValueAsBytes(items);

        PutObjectRequest request = PutObjectRequest.builder()
            .bucket(bucketName)
            .key(key)
            .contentType("application/json")
            .contentLength((long) content.length)
            .build();

        s3Client.putObject(request, RequestBody.fromBytes(content));
        log.info("S3 업로드 완료 - key={}, count={}", key, items.size());
    }

    @Override
    public void update(ExecutionContext executionContext) throws ItemStreamException {
        executionContext.putInt(FILE_INDEX_KEY, currentFileIndex);
    }

    @Override
    public void close() throws ItemStreamException {
        // 남은 데이터 업로드
        if (!currentBatch.isEmpty()) {
            try {
                uploadToS3(currentBatch);
            } catch (JsonProcessingException e) {
                throw new ItemStreamException("S3 최종 업로드 실패", e);
            }
        }
        log.info("S3Writer 종료 - 총 {}개 파일 업로드", currentFileIndex + 1);
    }
}
```

### Elasticsearch Bulk 인덱싱 Writer

```java
@Slf4j
@RequiredArgsConstructor
public class ElasticsearchBulkItemWriter<T> implements ItemWriter<T> {

    private final ElasticsearchClient esClient;
    private final String indexName;
    private final Function<T, String> idExtractor;

    @Override
    public void write(Chunk<? extends T> chunk) throws Exception {
        List<BulkOperation> operations = chunk.getItems().stream()
            .map(item -> BulkOperation.of(op -> op
                .index(idx -> idx
                    .index(indexName)
                    .id(idExtractor.apply(item))
                    .document(item)
                )
            ))
            .collect(Collectors.toList());

        BulkRequest bulkRequest = BulkRequest.of(req -> req
            .index(indexName)
            .operations(operations)
        );

        BulkResponse response = esClient.bulk(bulkRequest);

        if (response.errors()) {
            long errorCount = response.items().stream()
                .filter(item -> item.error() != null)
                .count();
            log.error("ES Bulk 인덱싱 오류 - errorCount={}", errorCount);

            // 오류 상세 로깅
            response.items().stream()
                .filter(item -> item.error() != null)
                .forEach(item -> log.error("인덱싱 실패 id={}, error={}",
                    item.id(), item.error().reason()));

            throw new ItemWriteException("Elasticsearch Bulk 인덱싱 부분 실패");
        }

        log.info("ES 인덱싱 완료 - count={}, took={}ms",
            chunk.size(), response.took());
    }
}
```

### Kafka 메시지 발행 Writer

```java
@Slf4j
@RequiredArgsConstructor
public class KafkaItemWriter<T> implements ItemWriter<T> {

    private final KafkaTemplate<String, T> kafkaTemplate;
    private final String topicName;
    private final Function<T, String> keyExtractor;

    @Override
    public void write(Chunk<? extends T> chunk) throws Exception {
        List<CompletableFuture<SendResult<String, T>>> futures = chunk.getItems().stream()
            .map(item -> kafkaTemplate.send(topicName, keyExtractor.apply(item), item)
                .toCompletableFuture())
            .collect(Collectors.toList());

        // 청크의 모든 메시지 전송 완료 대기
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
            .get(30, TimeUnit.SECONDS);

        log.info("Kafka 발행 완료 - topic={}, count={}", topicName, chunk.size());
    }
}
```

**실무 팁:** Kafka Writer는 트랜잭션 외부 동작이므로, 배치 트랜잭션 롤백 시 이미 발행된 메시지가 취소되지 않는다. 컨슈머에서 멱등성을 보장하거나, Kafka 트랜잭션(`transactional.id` 설정)을 사용해야 한다.

---

## StagingItemWriter 패턴

대용량 UPSERT 시 임시 테이블을 거치는 2단계 쓰기 패턴이다. 직접 운영 테이블에 행 단위로 UPSERT하면 인덱스 경합과 락 경쟁이 심하다.

```java
@Configuration
public class StagingWriteJobConfig {

    /**
     * Step 1: 임시 테이블에 빠르게 INSERT (인덱스 없음, 최고속 삽입)
     * Step 2: 임시 → 운영 테이블 MERGE (단일 SQL, 한 번의 테이블 스캔)
     */
    @Bean
    public Job stagingWriteJob(JobRepository jobRepository,
                               Step writeToStagingStep,
                               Step mergeToFinalStep) {
        return new JobBuilder("stagingWriteJob", jobRepository)
            .start(writeToStagingStep)
            .next(mergeToFinalStep)
            .build();
    }

    @Bean
    public JdbcBatchItemWriter<Settlement> stagingWriter(DataSource dataSource) {
        return new JdbcBatchItemWriterBuilder<Settlement>()
            .dataSource(dataSource)
            // 임시 테이블: 인덱스 없음, 제약 없음 → 최고 속도
            .sql("""
                INSERT INTO settlements_staging (order_id, user_id, amount, fee, settled_at)
                VALUES (:orderId, :userId, :amount, :fee, :settledAt)
                """)
            .beanMapped()
            .build();
    }

    @Bean
    public Step mergeToFinalStep(JobRepository jobRepository,
                                 PlatformTransactionManager txManager,
                                 JdbcTemplate jdbcTemplate) {
        return new StepBuilder("mergeToFinalStep", jobRepository)
            .tasklet((contribution, chunkContext) -> {
                // 단일 MERGE SQL로 한 번에 처리
                int mergedCount = jdbcTemplate.update("""
                    INSERT INTO settlements (order_id, user_id, amount, fee, settled_at)
                    SELECT order_id, user_id, amount, fee, settled_at
                    FROM settlements_staging
                    ON DUPLICATE KEY UPDATE
                        amount = VALUES(amount),
                        fee = VALUES(fee),
                        settled_at = VALUES(settled_at)
                    """);

                log.info("MERGE 완료 - mergedCount={}", mergedCount);

                // 임시 테이블 비우기
                jdbcTemplate.execute("TRUNCATE TABLE settlements_staging");

                return RepeatStatus.FINISHED;
            }, txManager)
            .build();
    }
}
```

**성능 효과:** 100만 건 기준, 직접 UPSERT 대비 스테이징 패턴이 2~3배 빠르다. 임시 테이블에 인덱스가 없어 INSERT가 매우 빠르고, MERGE는 단일 테이블 스캔으로 처리되기 때문이다.

---

## MultiResourceItemWriter 심화

### 10만 건마다 새 CSV 파일 생성

```java
@Bean
@StepScope
public MultiResourceItemWriter<Settlement> multiCsvWriter(
        @Value("#{jobParameters['targetDate']}") String targetDate,
        FlatFileItemWriter<Settlement> delegateWriter) {

    return new MultiResourceItemWriterBuilder<Settlement>()
        .name("multiCsvWriter")
        .delegate(delegateWriter)
        .itemCountLimitPerResource(100_000)  // 10만 건마다 파일 분리
        .resource(new FileSystemResource(
            "/output/settlements/%s/settlement".formatted(targetDate)
        ))
        .resourceSuffixCreator(suffixCreator())  // 파일명 접미사 커스터마이징
        .build();
}

/**
 * 기본: settlement1.csv, settlement2.csv
 * 커스텀: settlement_part001.csv, settlement_part002.csv
 */
@Bean
public ResourceSuffixCreator suffixCreator() {
    return index -> "_part%03d.csv".formatted(index);
}
```

### 파일명에 파티션 번호/날짜 포함 패턴

```java
@Bean
@StepScope
public MultiResourceItemWriter<Settlement> partitionedCsvWriter(
        @Value("#{stepExecutionContext['partitionIndex']}") int partitionIndex,
        @Value("#{jobParameters['targetDate']}") String targetDate,
        FlatFileItemWriter<Settlement> delegateWriter) {

    String filePattern = "/output/settlements/%s/settlement_p%02d"
        .formatted(targetDate, partitionIndex);

    return new MultiResourceItemWriterBuilder<Settlement>()
        .name("partitionedCsvWriter-" + partitionIndex)
        .delegate(delegateWriter)
        .itemCountLimitPerResource(100_000)
        .resource(new FileSystemResource(filePattern))
        .resourceSuffixCreator(index -> "_%03d.csv".formatted(index))
        .build();
}
```

### FlatFileItemWriter 델리게이트 설정

```java
@Bean
@StepScope
public FlatFileItemWriter<Settlement> settlementCsvDelegate() {
    return new FlatFileItemWriterBuilder<Settlement>()
        .name("settlementCsvDelegate")
        // MultiResourceItemWriter가 resource를 관리하므로 여기서는 설정하지 않음
        .delimited()
        .delimiter(",")
        .names("orderId", "userId", "amount", "fee", "settledAt")
        .headerCallback(writer -> writer.write("order_id,user_id,amount,fee,settled_at"))
        .build();
}
```

---

## 트랜잭션 외 Writer: 이메일 발송 패턴

이메일, SMS, 외부 API 호출 같은 동작은 DB 트랜잭션과 달리 롤백이 불가능하다. 트랜잭션이 롤백되어도 이미 발송된 이메일은 취소할 수 없다.

### 잘못된 패턴 (트랜잭션 내에서 이메일 발송)

```java
// 위험: DB 저장 실패 시 트랜잭션 롤백, 하지만 이메일은 이미 발송됨
@Override
public void write(Chunk<? extends Notification> chunk) throws Exception {
    for (Notification notification : chunk.getItems()) {
        jdbcTemplate.update("INSERT INTO notifications ...", ...);  // DB 저장
        emailService.send(notification.getEmail(), notification.getMessage());  // 이메일 발송 (롤백 불가)
    }
}
```

### 올바른 패턴: TransactionSynchronizationAdapter 활용

```java
@Slf4j
@RequiredArgsConstructor
public class TransactionalEmailWriter implements ItemWriter<Notification> {

    private final NotificationRepository notificationRepository;
    private final EmailService emailService;

    @Override
    public void write(Chunk<? extends Notification> chunk) throws Exception {
        List<Notification> notifications = new ArrayList<>(chunk.getItems());

        // 1. DB에 알림 기록 저장 (트랜잭션 내)
        notificationRepository.saveAll(notifications);

        // 2. 트랜잭션 커밋 성공 후에만 이메일 발송 등록
        TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    // 이 시점은 트랜잭션이 완전히 커밋된 후
                    // DB 저장이 확정된 후에만 이메일 발송
                    sendEmailsAfterCommit(notifications);
                }

                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) {
                        log.warn("트랜잭션 롤백 - 이메일 발송 취소, count={}",
                            notifications.size());
                    }
                }
            }
        );
    }

    private void sendEmailsAfterCommit(List<Notification> notifications) {
        for (Notification notification : notifications) {
            try {
                emailService.send(notification.getEmail(), notification.getMessage());
                log.info("이메일 발송 완료 - to={}", notification.getEmail());
            } catch (Exception e) {
                // 이메일 발송 실패는 별도 재시도 큐에 적재
                log.error("이메일 발송 실패 - to={}, error={}",
                    notification.getEmail(), e.getMessage());
                // 이미 DB는 커밋됐으므로 예외를 던지면 안 됨
                // 별도 재시도 메커니즘 사용
                retryQueue.enqueue(notification);
            }
        }
    }
}
```

### 비동기 이메일 발송 패턴

더 안전한 방법은 Outbox 패턴이다. 이메일 발송 요청을 같은 트랜잭션 내에 DB에 기록하고, 별도 스케줄러가 발송을 처리한다.

```java
@Override
public void write(Chunk<? extends Notification> chunk) throws Exception {
    List<Notification> notifications = new ArrayList<>(chunk.getItems());

    // 1. 알림 기록 저장
    notificationRepository.saveAll(notifications);

    // 2. 이메일 발송 요청을 outbox 테이블에 저장 (같은 트랜잭션)
    List<EmailOutbox> outboxItems = notifications.stream()
        .map(n -> EmailOutbox.builder()
            .to(n.getEmail())
            .subject("알림: " + n.getTitle())
            .body(n.getMessage())
            .status(OutboxStatus.PENDING)
            .build())
        .collect(Collectors.toList());

    emailOutboxRepository.saveAll(outboxItems);

    // 트랜잭션 커밋 후 별도 EmailOutboxProcessor가 PENDING 건을 처리
}
```

---

## 실무 팁 정리

**청크 사이즈 = JDBC Batch 사이즈 일치**
`JdbcBatchItemWriter`의 배치 크기는 청크 사이즈와 동일하다. 청크 사이즈 100이면 100건을 하나의 JDBC 배치로 전송한다. 청크 사이즈를 늘리면 DB 왕복 횟수가 줄어 성능이 향상되지만, 롤백 비용도 증가한다.

**GenerationType.IDENTITY와 배치 INSERT**
JPA에서 `@GeneratedValue(strategy = GenerationType.IDENTITY)`를 사용하면 하이버네이트 배치 INSERT가 비활성화된다. INSERT 후 생성된 ID를 개별로 조회해야 하기 때문이다. 배치 성능이 중요한 엔티티는 `SEQUENCE` 전략을 사용한다.

```java
// 배치 INSERT 불가 (IDENTITY)
@GeneratedValue(strategy = GenerationType.IDENTITY)

// 배치 INSERT 가능 (SEQUENCE)
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "order_seq")
@SequenceGenerator(name = "order_seq", sequenceName = "order_sequence",
    allocationSize = 50)  // allocationSize = 배치 사이즈와 유사하게
```

**Writer 예외와 Skip 처리**
`JdbcBatchItemWriter`에서 DB 제약 조건 위반이 발생하면 청크 전체가 롤백된다. 특정 예외를 Skip 처리하려면 Step에서 `faultTolerant().skip(DataIntegrityViolationException.class)`를 설정한다.
