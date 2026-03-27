---
title: "Spring Batch: Chunk 지향 처리와 Tasklet"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "chunk", "tasklet", "step"]
---

## Chunk 처리 개념

Chunk 지향 처리는 데이터를 N개씩 묶어서 읽기 → 처리 → 쓰기를 반복하는 패턴이다. 전체 데이터를 메모리에 올리지 않고, 지정한 크기(commit-interval)만큼씩 처리해 대용량 데이터를 다룰 수 있다.

```
┌─────────────────────────────────────────────────────────────────┐
│  Chunk 처리 흐름 (commit-interval = 3)                           │
│                                                                  │
│  ┌──────────┐  read()  ┌─────────────────────────────────────┐ │
│  │ItemReader│ ───────▶ │ item1, item2, item3 (청크 누적)      │ │
│  └──────────┘          └──────────────┬──────────────────────┘ │
│                                        │ 청크 크기 도달            │
│                                        ▼                         │
│  ┌─────────────┐                ┌────────────────────────┐      │
│  │ItemProcessor│ ◀──────────── │ item1, item2, item3     │      │
│  └──────┬──────┘  process()    └────────────────────────┘      │
│         │                                                        │
│         │ [result1, result2, result3]                           │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ ItemWriter   │  write(chunk) — 한 번의 JDBC Batch 호출        │
│  └──────────────┘                                               │
│         │                                                        │
│         ▼                                                        │
│    COMMIT ──────────────────▶ 다음 청크 반복                     │
│                                                                  │
│  ItemReader.read() == null 이면 반복 종료                        │
└─────────────────────────────────────────────────────────────────┘
```

### commit-interval이 트랜잭션 경계

`chunk(N, transactionManager)`에서 `N`이 `commit-interval`이다. 이 값이 트랜잭션 경계가 된다.

- N개를 읽고, N개를 처리하고, N개를 쓴 뒤 **커밋**한다
- 쓰기 실패 시 해당 청크 전체가 **롤백**된다
- 이전에 커밋된 청크는 롤백되지 않는다

### Read 실패 vs Write 실패 시 롤백 범위

| 실패 단계 | 롤백 범위 | 비고 |
|----------|---------|------|
| Read 실패 | 현재 청크의 Write 롤백 (Read 자체는 비트랜잭션적) | Reader는 커서 위치를 되돌릴 수 없음 |
| Process 실패 | 현재 청크의 Write 롤백 | 예외 발생 시 Writer 호출 안 됨 |
| Write 실패 | 현재 청크 전체 롤백 | 쓴 데이터 전체 롤백 |

### ItemReader가 롤백 안 되는 이유

`ItemReader`는 대부분 DB 커서나 파일 스트림을 사용한다. 트랜잭션이 롤백되더라도 커서 위치는 이미 진행되어 있어 되돌릴 수 없다. 이 때문에 Reader는 트랜잭션 경계 밖에서 동작하며, 재시작 시에는 `ExecutionContext`에 저장된 오프셋으로 위치를 복원한다.

---

## StepBuilder 5.x 전체 코드

```java
@Configuration
@RequiredArgsConstructor
public class OrderStepConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    @Bean
    public Step orderProcessStep() {
        return new StepBuilder("orderProcessStep", jobRepository)
            .<Order, OrderDto>chunk(100, transactionManager)  // <InputType, OutputType>
            .reader(orderReader())
            .processor(orderProcessor())
            .writer(orderWriter())
            .build();
    }
}
```

**제네릭 타입 의미**:
- `<Order, OrderDto>` — `ItemReader`가 `Order`를 반환하고, `ItemWriter`가 `OrderDto`를 받는다
- `ItemProcessor<Order, OrderDto>`가 중간에서 변환을 담당한다
- Reader와 Writer의 타입이 같다면 `<Order, Order>`로 선언하고 Processor를 생략한다

**transactionManager 주입 이유**:
5.x부터는 어떤 트랜잭션 관리자를 사용할지 명시적으로 전달해야 한다. JPA를 사용한다면 `JpaTransactionManager`, JDBC만 사용한다면 `DataSourceTransactionManager`를 전달한다. 여러 데이터소스를 다루는 환경에서 어떤 트랜잭션 관리자를 사용하는지 명확히 드러낸다는 이점이 있다.

---

## Step 리스너 전체

Step의 각 처리 단계에 리스너를 등록해 횡단 관심사를 처리할 수 있다.

### StepExecutionListener — beforeStep에서 파라미터 세팅 패턴

```java
@Component
@StepScope
public class OrderStepExecutionListener implements StepExecutionListener {

    private StepExecution stepExecution;

    @Override
    public void beforeStep(StepExecution stepExecution) {
        this.stepExecution = stepExecution;

        // Job 파라미터를 Step ExecutionContext에 복사
        LocalDate targetDate = stepExecution
            .getJobParameters()
            .getLocalDate("targetDate");

        stepExecution.getExecutionContext()
            .put("targetDate", targetDate);

        log.info("[Step 시작] {}, 대상 날짜: {}", stepExecution.getStepName(), targetDate);
    }

    @Override
    public ExitStatus afterStep(StepExecution stepExecution) {
        log.info("[Step 완료] 읽기: {}건, 쓰기: {}건, 스킵: {}건",
            stepExecution.getReadCount(),
            stepExecution.getWriteCount(),
            stepExecution.getSkipCount());

        // 스킵이 너무 많으면 커스텀 ExitStatus 반환
        if (stepExecution.getSkipCount() > 1000) {
            return new ExitStatus("COMPLETED_WITH_SKIPS");
        }

        return stepExecution.getExitStatus();
    }
}
```

### ItemReadListener — onReadError 로깅 패턴

```java
@Component
public class OrderReadListener implements ItemReadListener<Order> {

    @Override
    public void beforeRead() {
        // 읽기 전 처리 (보통 생략)
    }

    @Override
    public void afterRead(Order item) {
        log.debug("읽기 완료: orderId={}", item.getId());
    }

    @Override
    public void onReadError(Exception ex) {
        log.error("읽기 오류 발생: {}", ex.getMessage(), ex);
        // 알림 발송, 별도 테이블 기록 등
    }
}
```

### ItemProcessListener — onProcessError

```java
@Component
public class OrderProcessListener implements ItemProcessListener<Order, OrderDto> {

    @Override
    public void beforeProcess(Order item) {
        log.debug("처리 시작: orderId={}", item.getId());
    }

    @Override
    public void afterProcess(Order item, OrderDto result) {
        if (result == null) {
            log.debug("필터링됨: orderId={}", item.getId());
        }
    }

    @Override
    public void onProcessError(Order item, Exception e) {
        log.error("처리 오류 — orderId={}, 오류: {}", item.getId(), e.getMessage());
    }
}
```

### ItemWriteListener — afterWrite 카운트 집계 패턴

```java
@Component
@StepScope
public class OrderWriteListener implements ItemWriteListener<OrderDto> {

    private final AtomicLong totalWritten = new AtomicLong(0);

    @Override
    public void beforeWrite(Chunk<? extends OrderDto> items) {
        log.debug("쓰기 시작: {}건", items.size());
    }

    @Override
    public void afterWrite(Chunk<? extends OrderDto> items) {
        long count = totalWritten.addAndGet(items.size());
        if (count % 10_000 == 0) {
            log.info("누적 쓰기 완료: {}건", count);
        }
    }

    @Override
    public void onWriteError(Exception exception, Chunk<? extends OrderDto> items) {
        log.error("쓰기 오류 — {}건 실패: {}", items.size(), exception.getMessage());
        items.forEach(item ->
            log.error("  실패 아이템: orderId={}", item.getOrderId()));
    }
}
```

### ChunkListener — afterChunkError

```java
@Component
public class OrderChunkListener implements ChunkListener {

    @Override
    public void beforeChunk(ChunkContext context) {
        log.debug("청크 시작 — Step: {}",
            context.getStepContext().getStepName());
    }

    @Override
    public void afterChunk(ChunkContext context) {
        StepContext stepContext = context.getStepContext();
        log.debug("청크 완료 — 읽기: {}, 쓰기: {}",
            stepContext.getStepExecution().getReadCount(),
            stepContext.getStepExecution().getWriteCount());
    }

    @Override
    public void afterChunkError(ChunkContext context) {
        log.error("청크 오류 발생 — Step: {}",
            context.getStepContext().getStepName());
        // 청크 실패 시 별도 알림 처리 가능
    }
}
```

### 리스너 등록 방법

```java
@Bean
public Step orderProcessStep(
        OrderStepExecutionListener stepListener,
        OrderReadListener readListener,
        OrderProcessListener processListener,
        OrderWriteListener writeListener,
        OrderChunkListener chunkListener) {

    return new StepBuilder("orderProcessStep", jobRepository)
        .<Order, OrderDto>chunk(100, transactionManager)
        .reader(orderReader())
        .processor(orderProcessor())
        .writer(orderWriter())
        .listener(stepListener)    // StepExecutionListener
        .listener(readListener)    // ItemReadListener
        .listener(processListener) // ItemProcessListener
        .listener(writeListener)   // ItemWriteListener
        .listener(chunkListener)   // ChunkListener
        .build();
}
```

---

## Tasklet 처리

Chunk 처리가 맞지 않는 단순 작업(파일 이동, DB 초기화, 외부 API 단건 호출 등)에는 `Tasklet`을 사용한다.

### Tasklet 인터페이스 + RepeatStatus

```java
@FunctionalInterface
public interface Tasklet {
    RepeatStatus execute(StepContribution contribution,
                         ChunkContext chunkContext) throws Exception;
}
```

`RepeatStatus`는 두 가지 값을 가진다:
- `RepeatStatus.FINISHED` — 작업 완료, Step 종료
- `RepeatStatus.CONTINUABLE` — 작업 계속, `execute()` 다시 호출

`CONTINUABLE`을 반환하면 `execute()`가 반복 호출된다. 무한 루프에 빠지지 않도록 종료 조건을 반드시 설정해야 한다.

```java
// CONTINUABLE 활용 예 — 대기 폴링
@Bean
public Tasklet waitForFileTasklet() {
    return (contribution, chunkContext) -> {
        File file = new File("/data/ready.flag");
        if (file.exists()) {
            log.info("파일 감지됨. 처리 시작.");
            return RepeatStatus.FINISHED;
        }
        log.info("파일 대기 중...");
        Thread.sleep(5_000);
        return RepeatStatus.CONTINUABLE;
    };
}
```

### 파일 이동 Tasklet

```java
@Component
@StepScope
public class FileMoveTasklet implements Tasklet {

    @Value("#{jobParameters['sourceFilePath']}")
    private String sourceFilePath;

    @Value("#{jobParameters['targetFilePath']}")
    private String targetFilePath;

    @Override
    public RepeatStatus execute(StepContribution contribution,
                                ChunkContext chunkContext) throws Exception {
        Path source = Paths.get(sourceFilePath);
        Path target = Paths.get(targetFilePath);

        // 대상 디렉토리 생성
        Files.createDirectories(target.getParent());

        // 파일 이동
        Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);

        log.info("파일 이동 완료: {} → {}", source, target);

        // StepContribution을 통해 처리 건수 기록
        contribution.incrementWriteCount(1);

        return RepeatStatus.FINISHED;
    }
}
```

```java
@Bean
public Step fileMoveStep() {
    return new StepBuilder("fileMoveStep", jobRepository)
        .tasklet(fileMoveTasklet, transactionManager)
        .build();
}
```

### DB 초기화 Tasklet

```java
@Component
public class TempTableCleanupTasklet implements Tasklet {

    private final JdbcTemplate jdbcTemplate;

    public TempTableCleanupTasklet(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public RepeatStatus execute(StepContribution contribution,
                                ChunkContext chunkContext) throws Exception {
        // 임시 테이블 데이터 삭제
        int deleted = jdbcTemplate.update(
            "DELETE FROM batch_temp_order WHERE created_at < ?",
            LocalDate.now().minusDays(7)
        );

        log.info("임시 데이터 정리 완료: {}건 삭제", deleted);
        contribution.incrementWriteCount(deleted);

        return RepeatStatus.FINISHED;
    }
}
```

### ExecutionContext 접근 패턴

```java
@Component
@StepScope
public class SummaryTasklet implements Tasklet {

    @Override
    public RepeatStatus execute(StepContribution contribution,
                                ChunkContext chunkContext) throws Exception {

        // Step ExecutionContext 접근
        ExecutionContext stepContext = chunkContext
            .getStepContext()
            .getStepExecution()
            .getExecutionContext();

        // Job ExecutionContext 접근 (다른 Step에서 저장한 값 읽기)
        ExecutionContext jobContext = chunkContext
            .getStepContext()
            .getStepExecution()
            .getJobExecution()
            .getExecutionContext();

        long processedCount = jobContext.getLong("processedCount", 0L);
        long errorCount = jobContext.getLong("errorCount", 0L);

        log.info("최종 집계 — 처리: {}건, 오류: {}건", processedCount, errorCount);

        // 다음 Step에서 사용할 값 저장
        jobContext.putString("summaryMessage",
            String.format("처리 %d건 완료 (오류 %d건)", processedCount, errorCount));

        return RepeatStatus.FINISHED;
    }
}
```

---

## Tasklet Step vs Chunk Step 선택 기준

| 기준 | Tasklet Step | Chunk Step |
|------|-------------|------------|
| 데이터 건수 | 단건 또는 소량 | 대량 (수천~수억 건) |
| 처리 단위 | 작업 전체가 한 단위 | N개씩 묶어서 반복 |
| 트랜잭션 | Tasklet 전체가 하나의 트랜잭션 | 청크 단위 트랜잭션 |
| 재시작 지원 | 기본적으로 처음부터 재실행 | ExecutionContext로 중단 지점 복원 |
| 사용 사례 | 파일 이동, DB 초기화, 알림 발송 | CSV 처리, 대량 DB 이관, 정산 |
| 구현 복잡도 | 낮음 | 높음 (Reader/Processor/Writer 분리) |

> **실무 팁**: 대부분의 배치 Job은 Tasklet Step과 Chunk Step을 혼합해서 사용한다. 전처리(파일 이동, 임시 테이블 초기화)는 Tasklet으로, 본 처리(대량 데이터 변환)는 Chunk로, 후처리(알림 발송, 결과 파일 이동)는 다시 Tasklet으로 구성하는 패턴이 일반적이다.
