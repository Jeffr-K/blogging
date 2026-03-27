---
title: "Spring Batch: 내결함성 — Skip, Retry, 재시작"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "fault-tolerance", "skip", "retry", "restart"]
---

## Skip

특정 예외가 발생한 아이템을 건너뛰고 나머지 아이템을 계속 처리하는 기능이다. 100만 건 중 단 1건의 파싱 오류로 전체 배치가 중단되는 상황을 막는다.

### 기본 설정

```java
@Bean
public Step orderProcessStep() {
    return new StepBuilder("orderProcessStep", jobRepository)
        .<Order, OrderDto>chunk(100, transactionManager)
        .reader(orderReader())
        .processor(orderProcessor())
        .writer(orderWriter())
        .faultTolerant()
            .skip(ParseException.class)          // 파싱 오류 Skip
            .skip(ValidationException.class)     // 유효성 오류 Skip
            .noSkip(CriticalException.class)     // 이 예외는 절대 Skip 안 함
            .skipLimit(100)                      // 최대 100건까지만 Skip 허용
        .build();
}
```

`skipLimit`에 도달하면 해당 예외를 더 이상 Skip하지 않고 Step이 실패한다.

### Read / Process / Write 단계별 Skip 동작

| 단계 | Skip 동작 |
|------|----------|
| Read | 해당 아이템을 건너뛰고 다음 아이템 읽기 |
| Process | 해당 아이템을 건너뛰고 현재 청크 내 다음 아이템 처리 |
| Write | **청크를 아이템 단위로 재처리 (binary search 방식)** |

**Write Skip이 특별한 이유**: Writer는 청크 전체를 한 번에 받는다. 청크 내 어떤 아이템이 Write 오류를 일으키는지 알 수 없으므로, Spring Batch는 다음 전략을 사용한다.

```
청크 [A, B, C, D] 쓰기 실패
 ↓
아이템 단위로 재시도:
  [A] → 성공
  [B] → 성공
  [C] → 실패 → Skip (SkipListener에 기록)
  [D] → 성공
 ↓
청크 커밋 (C만 Skip, 나머지 3건 처리 완료)
```

이 과정에서 각 아이템은 개별 트랜잭션으로 처리되므로 성능 비용이 있다. Write 오류가 자주 발생하는 환경이라면 청크 크기를 줄이는 것이 좋다.

### SkipPolicy 커스텀 — 최대 스킵 비율 제한

단순 건수 제한이 아닌 비율로 Skip을 제한할 때 사용한다.

```java
public class RateLimitedSkipPolicy implements SkipPolicy {

    private final double maxSkipRate;  // 최대 Skip 비율 (예: 0.05 = 5%)
    private final AtomicLong readCount = new AtomicLong(0);
    private final AtomicLong skipCount = new AtomicLong(0);

    public RateLimitedSkipPolicy(double maxSkipRate) {
        this.maxSkipRate = maxSkipRate;
    }

    @Override
    public boolean shouldSkip(Throwable t, long skipCount) throws SkipLimitExceededException {
        if (t instanceof FatalException) {
            return false; // 치명적 예외는 Skip 불가
        }

        long total = readCount.get();
        long skipped = this.skipCount.incrementAndGet();

        if (total > 0) {
            double currentRate = (double) skipped / total;
            if (currentRate > maxSkipRate) {
                throw new SkipLimitExceededException(
                    (int) skipCount,
                    new RuntimeException(
                        String.format("Skip 비율 초과: %.2f%% > %.2f%%",
                            currentRate * 100, maxSkipRate * 100)));
            }
        }

        return t instanceof ParseException
            || t instanceof ValidationException;
    }

    public void incrementReadCount() {
        readCount.incrementAndGet();
    }
}
```

```java
@Bean
public Step orderProcessStep() {
    RateLimitedSkipPolicy skipPolicy = new RateLimitedSkipPolicy(0.05); // 5% 초과 시 실패

    return new StepBuilder("orderProcessStep", jobRepository)
        .<Order, OrderDto>chunk(100, transactionManager)
        .reader(orderReader())
        .processor(orderProcessor())
        .writer(orderWriter())
        .faultTolerant()
            .skipPolicy(skipPolicy) // 커스텀 SkipPolicy 적용
        .build();
}
```

### SkipListener — 스킵 아이템 DB 저장 패턴

```java
@Component
@StepScope
public class OrderSkipListener implements SkipListener<Order, OrderDto> {

    private final SkippedItemRepository skippedItemRepository;
    private final String jobName;

    public OrderSkipListener(SkippedItemRepository skippedItemRepository,
                              @Value("#{stepExecution.jobExecution.jobInstance.jobName}") String jobName) {
        this.skippedItemRepository = skippedItemRepository;
        this.jobName = jobName;
    }

    @Override
    public void onSkipInRead(Throwable t) {
        log.warn("[Skip-Read] 읽기 중 Skip 발생: {}", t.getMessage());
        skippedItemRepository.save(SkippedItem.builder()
            .jobName(jobName)
            .phase("READ")
            .errorMessage(t.getMessage())
            .skippedAt(LocalDateTime.now())
            .build());
    }

    @Override
    public void onSkipInProcess(Order item, Throwable t) {
        log.warn("[Skip-Process] 처리 중 Skip — orderId={}: {}", item.getId(), t.getMessage());
        skippedItemRepository.save(SkippedItem.builder()
            .jobName(jobName)
            .phase("PROCESS")
            .itemId(String.valueOf(item.getId()))
            .itemData(item.toString())
            .errorMessage(t.getMessage())
            .skippedAt(LocalDateTime.now())
            .build());
    }

    @Override
    public void onSkipInWrite(OrderDto item, Throwable t) {
        log.warn("[Skip-Write] 쓰기 중 Skip — orderId={}: {}", item.getOrderId(), t.getMessage());
        skippedItemRepository.save(SkippedItem.builder()
            .jobName(jobName)
            .phase("WRITE")
            .itemId(String.valueOf(item.getOrderId()))
            .itemData(item.toString())
            .errorMessage(t.getMessage())
            .skippedAt(LocalDateTime.now())
            .build());
    }
}
```

---

## Retry

처리 실패 시 지정된 횟수만큼 재시도한다. 일시적인 오류(DB 락, 네트워크 지연, 외부 API 타임아웃 등)에 효과적이다.

### 기본 설정

```java
@Bean
public Step orderProcessStep() {
    return new StepBuilder("orderProcessStep", jobRepository)
        .<Order, OrderDto>chunk(100, transactionManager)
        .reader(orderReader())
        .processor(orderProcessor())
        .writer(orderWriter())
        .faultTolerant()
            .retry(TransientDataAccessException.class)  // DB 일시 오류 재시도
            .retry(HttpServerErrorException.class)      // HTTP 5xx 재시도
            .noRetry(HttpClientErrorException.class)    // HTTP 4xx는 재시도 안 함
            .retryLimit(3)                              // 최대 3회 재시도
        .build();
}
```

### BackOffPolicy 설정

재시도 사이의 대기 시간을 설정한다.

```java
@Bean
public Step orderProcessStep() {
    // 고정 대기: 매 재시도마다 1초 대기
    FixedBackOffPolicy fixedBackOff = new FixedBackOffPolicy();
    fixedBackOff.setBackOffPeriod(1000L);

    // 지수 백오프: 1초 → 2초 → 4초 (최대 30초)
    ExponentialBackOffPolicy exponentialBackOff = new ExponentialBackOffPolicy();
    exponentialBackOff.setInitialInterval(1000L);
    exponentialBackOff.setMultiplier(2.0);
    exponentialBackOff.setMaxInterval(30_000L);

    return new StepBuilder("orderProcessStep", jobRepository)
        .<Order, OrderDto>chunk(100, transactionManager)
        .reader(orderReader())
        .processor(orderProcessor())
        .writer(orderWriter())
        .faultTolerant()
            .retry(TransientDataAccessException.class)
            .retryLimit(5)
            .backOffPolicy(exponentialBackOff) // 지수 백오프 적용
        .build();
}
```

### RetryPolicy 커스텀 구현

예외 타입에 따라 다른 재시도 횟수를 적용한다.

```java
@Bean
public Step orderProcessStep() {
    Map<Class<? extends Throwable>, Boolean> retryableExceptions = new HashMap<>();
    retryableExceptions.put(TransientDataAccessException.class, true);  // 재시도
    retryableExceptions.put(HttpServerErrorException.class, true);      // 재시도
    retryableExceptions.put(HttpClientErrorException.class, false);     // 재시도 안 함

    SimpleRetryPolicy retryPolicy = new SimpleRetryPolicy(3, retryableExceptions);

    // 예외 분류 기반 재시도 정책
    ExceptionClassifierRetryPolicy classifierPolicy = new ExceptionClassifierRetryPolicy();
    classifierPolicy.setExceptionClassifier(classifiable -> {
        if (classifiable instanceof HttpServerErrorException) {
            return new SimpleRetryPolicy(5); // HTTP 5xx는 5회
        }
        if (classifiable instanceof TransientDataAccessException) {
            return new SimpleRetryPolicy(3); // DB 오류는 3회
        }
        return new NeverRetryPolicy(); // 나머지는 재시도 안 함
    });

    return new StepBuilder("orderProcessStep", jobRepository)
        .<Order, OrderDto>chunk(100, transactionManager)
        .reader(orderReader())
        .processor(orderProcessor())
        .writer(orderWriter())
        .faultTolerant()
            .retryPolicy(classifierPolicy)
        .build();
}
```

---

## Skip + Retry 조합

Retry를 모두 소진한 후에도 실패하면 Skip으로 처리하는 패턴이다.

```java
@Bean
public Step orderProcessStep(OrderSkipListener skipListener) {

    ExponentialBackOffPolicy backOff = new ExponentialBackOffPolicy();
    backOff.setInitialInterval(1000L);
    backOff.setMultiplier(2.0);
    backOff.setMaxInterval(10_000L);

    return new StepBuilder("orderProcessStep", jobRepository)
        .<Order, OrderDto>chunk(100, transactionManager)
        .reader(orderReader())
        .processor(orderProcessor())
        .writer(orderWriter())
        .faultTolerant()
            // HTTP 5xx: 3회 재시도, 그래도 실패하면 Skip
            .retry(HttpServerErrorException.class)
            .retryLimit(3)
            .backOffPolicy(backOff)
            .skip(HttpServerErrorException.class)
            .skipLimit(50)
            // HTTP 4xx: 재시도 없이 바로 Skip
            .skip(HttpClientErrorException.BadRequest.class)
            .skipLimit(100)
            // DB 오류: 재시도만, Skip 안 함 (데이터 일관성)
            .retry(TransientDataAccessException.class)
            .retryLimit(5)
            .noSkip(DataIntegrityViolationException.class) // 무결성 오류는 절대 Skip 안 함
        .listener(skipListener) // Skip된 아이템 기록
        .build();
}
```

### SkipListener로 실패 아이템 별도 테이블에 기록

```java
// 실패 아이템 테이블 스키마
// CREATE TABLE batch_skipped_item (
//     id BIGINT AUTO_INCREMENT PRIMARY KEY,
//     job_name VARCHAR(100),
//     step_name VARCHAR(100),
//     phase VARCHAR(20),        -- READ, PROCESS, WRITE
//     item_id VARCHAR(100),
//     item_data TEXT,
//     error_type VARCHAR(200),
//     error_message TEXT,
//     skipped_at DATETIME
// );

@Component
@StepScope
public class FailedItemRecordingListener implements SkipListener<Order, OrderDto> {

    private final JdbcTemplate jdbcTemplate;
    private final StepExecution stepExecution;

    @BeforeStep
    public void beforeStep(StepExecution stepExecution) {
        this.stepExecution = stepExecution; // 실제로는 필드 주입 사용
    }

    private void recordSkip(String phase, String itemId, String itemData, Throwable t) {
        jdbcTemplate.update("""
            INSERT INTO batch_skipped_item
                (job_name, step_name, phase, item_id, item_data, error_type, error_message, skipped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            """,
            stepExecution.getJobExecution().getJobInstance().getJobName(),
            stepExecution.getStepName(),
            phase,
            itemId,
            itemData,
            t.getClass().getName(),
            t.getMessage()
        );
    }

    @Override
    public void onSkipInRead(Throwable t) {
        recordSkip("READ", null, null, t);
    }

    @Override
    public void onSkipInProcess(Order item, Throwable t) {
        recordSkip("PROCESS", String.valueOf(item.getId()), item.toString(), t);
    }

    @Override
    public void onSkipInWrite(OrderDto item, Throwable t) {
        recordSkip("WRITE", String.valueOf(item.getOrderId()), item.toString(), t);
    }
}
```

---

## 재시작 (Restart)

### 재시작 기본 원리

실패한 `JobInstance`를 동일한 `JobParameters`로 재실행하면, Spring Batch는 마지막으로 `COMPLETED`된 Step 이후부터 재개한다.

```
1차 실행 (실패):
  Step1 → COMPLETED
  Step2 → COMPLETED
  Step3 → FAILED (500만 건 중 300만 건 처리 후 실패)

2차 실행 (동일 JobParameters):
  Step1 → SKIPPED (이미 COMPLETED)
  Step2 → SKIPPED (이미 COMPLETED)
  Step3 → STARTED (중단된 지점부터 재개)
```

재시작 시 Step3의 `ItemStreamReader`는 `ExecutionContext`에 저장된 오프셋(300만)을 복원해 301만 번째 아이템부터 읽기 시작한다.

### ExecutionContext에 커서 위치 저장/복원

```java
@Component
@StepScope
public class RestartableApiReader implements ItemStreamReader<Order> {

    private static final String OFFSET_KEY = "api.reader.offset";

    private final OrderApiClient apiClient;
    private long currentOffset = 0;
    private Queue<Order> buffer = new LinkedList<>();
    private boolean done = false;

    @Override
    public void open(ExecutionContext executionContext) {
        // 재시작 시 저장된 오프셋 복원
        if (executionContext.containsKey(OFFSET_KEY)) {
            this.currentOffset = executionContext.getLong(OFFSET_KEY);
            log.info("재시작: offset={}부터 재개", currentOffset);
        }
    }

    @Override
    public void update(ExecutionContext executionContext) {
        // 청크 커밋마다 현재 오프셋 저장
        executionContext.putLong(OFFSET_KEY, currentOffset);
    }

    @Override
    public void close() {
        buffer.clear();
    }

    @Override
    public Order read() throws Exception {
        if (done) return null;

        if (buffer.isEmpty()) {
            List<Order> page = apiClient.fetchOrders(currentOffset, 100);
            if (page.isEmpty()) {
                done = true;
                return null;
            }
            buffer.addAll(page);
            currentOffset += page.size();
        }

        return buffer.poll();
    }
}
```

### JdbcCursorItemReader 재시작 시 동작

`JdbcCursorItemReader`는 `ItemStreamReader`를 구현하며, `ExecutionContext`에 `read.count`를 저장한다. 재시작 시 `read.count`만큼 `ResultSet.next()`를 빠르게 이동해 중단 지점을 찾는다.

단, 커넥션을 새로 열고 처음부터 커서를 이동하므로, 재시작 포인트 탐색에 시간이 걸릴 수 있다. 대용량 데이터라면 `JdbcPagingItemReader`가 재시작에 더 효율적이다.

### JdbcPagingItemReader 재시작 시 동작

`JdbcPagingItemReader`는 `ExecutionContext`에 현재 페이지 번호(`startAfterValues`)를 저장한다. 재시작 시 마지막 처리된 정렬 키 값을 WHERE 조건에 추가해 해당 페이지부터 쿼리를 실행한다.

```sql
-- 1차 실행 (페이지 50에서 실패, 마지막 처리 order_id = 5000)
SELECT ... FROM orders WHERE order_id > 0 ORDER BY order_id LIMIT 100

-- 재시작 (페이지 50부터 재개)
SELECT ... FROM orders WHERE order_id > 5000 ORDER BY order_id LIMIT 100
```

---

## 재시작 관련 설정

### preventRestart() — 매번 새로 실행

```java
@Bean
public Job dailyReportJob(JobRepository jobRepository) {
    return new JobBuilder("dailyReportJob", jobRepository)
        .preventRestart()  // 실패해도 재시작 불가, 항상 처음부터
        .start(reportStep())
        .build();
}
```

보고서 생성처럼 부분 재시작이 의미 없는 경우에 사용한다.

### startLimit() — Step 최대 실행 횟수 제한

```java
@Bean
public Step riskyStep() {
    return new StepBuilder("riskyStep", jobRepository)
        .<Order, OrderDto>chunk(100, transactionManager)
        .reader(orderReader())
        .processor(orderProcessor())
        .writer(orderWriter())
        .startLimit(3)  // 이 Step은 최대 3번만 실행 가능 (재시작 포함)
        .build();
}
```

3번 실패하면 `StartLimitExceededException`이 발생하며 Step 실행 자체가 거부된다.

### allowStartIfComplete(true) — 완료된 Step 재실행

```java
@Bean
public Step cleanupStep() {
    return new StepBuilder("cleanupStep", jobRepository)
        .tasklet(cleanupTasklet(), transactionManager)
        .allowStartIfComplete(true) // 이미 완료되었어도 재시작 시 다시 실행
        .build();
}
```

초기화/정리 Step처럼 재시작할 때마다 반드시 다시 실행해야 하는 경우에 사용한다.

---

## 재시작 시나리오별 처리

| 시나리오 | 기본 동작 | 권장 설정 |
|---------|----------|---------|
| 처음부터 재실행하고 싶다 | 불가 (완료된 JobInstance는 재실행 불가) | 새 JobParameters 사용 또는 `JobOperator`로 JobInstance 삭제 |
| 중단된 Step부터 재개 | 기본 동작 | 별도 설정 불필요 |
| 완료된 Step도 다시 실행 | 불가 | `allowStartIfComplete(true)` |
| 재시작 자체를 막고 싶다 | 재시작 가능 | `preventRestart()` |
| Step 실행 횟수를 제한하고 싶다 | 무제한 | `startLimit(N)` |
| 매번 새 실행으로 취급하고 싶다 | 재시작 모드 | `RunIdIncrementer` 또는 타임스탬프 파라미터 |

> **실무 팁**: 운영 환경에서 배치가 실패했을 때 가장 흔한 실수는 "JobParameters를 바꿔서 재실행"이다. JobParameters를 바꾸면 새 JobInstance가 생성되어 처음부터 실행된다. 재시작이 필요하다면 반드시 **동일한 JobParameters**로 재실행해야 한다. 수동으로 재실행할 때는 `JobOperator.restart(executionId)` 또는 `JobLauncher.run(job, originalParams)`를 사용한다.
