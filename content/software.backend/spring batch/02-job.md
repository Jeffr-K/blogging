---
title: "Spring Batch: Job 구성과 흐름 제어"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "job", "step-flow"]
---

## JobBuilder 방식 (Spring Batch 5.x)

Spring Batch 4.x까지는 `JobBuilderFactory`와 `StepBuilderFactory`를 주입받아 사용했다.

```java
// 4.x 방식 (Deprecated)
@Autowired
private JobBuilderFactory jobBuilderFactory;

@Bean
public Job myJob() {
    return jobBuilderFactory.get("myJob")
        .start(step1())
        .build();
}
```

Spring Batch 5.x에서는 두 Factory가 완전히 제거되었다. `JobRepository`를 직접 생성자에 전달하는 방식으로 바뀌었다.

```java
// 5.x 방식
@Bean
public Job myJob(JobRepository jobRepository) {
    return new JobBuilder("myJob", jobRepository)
        .start(step1(jobRepository, transactionManager))
        .build();
}
```

**변경 배경**: Factory 방식은 내부적으로 `JobRepository`를 자동 주입받아 감추고 있었는데, 이로 인해 여러 `JobRepository`를 사용하는 다중 데이터소스 환경에서 어떤 Repository가 사용되는지 불명확했다. 5.x에서는 명시적으로 전달하도록 변경되어 의도가 분명해졌다.

---

## JobParameters

### 지원 타입

| 타입 | 예시 |
|------|------|
| `String` | 파일 경로, 코드 값 |
| `Long` | 순번, 타임스탬프 |
| `Double` | 환율, 비율 |
| `LocalDate` | 처리 대상 날짜 (5.x에서 추가) |

4.x까지는 `Date` 타입이었지만, 5.x에서 `LocalDate` / `LocalDateTime`으로 교체되었다.

```java
JobParameters params = new JobParametersBuilder()
    .addString("filePath", "/data/orders.csv")
    .addLong("batchId", 100L)
    .addDouble("exchangeRate", 1320.5)
    .addLocalDate("targetDate", LocalDate.of(2026, 3, 27))
    .toJobParameters();
```

### identifying vs non-identifying 파라미터

`identifying=true`(기본값)인 파라미터는 `JobInstance`를 식별하는 기준이 된다. 동일한 identifying 파라미터 조합으로 이미 `COMPLETED`된 JobInstance가 있으면 재실행이 거부된다.

`identifying=false`인 파라미터는 `JobInstance` 식별에 사용되지 않는다. 실행 로그나 디버깅 목적으로 파라미터를 기록하고 싶지만, JobInstance 식별에는 영향을 주고 싶지 않을 때 사용한다.

```java
JobParameters params = new JobParametersBuilder()
    .addLocalDate("targetDate", LocalDate.of(2026, 3, 27))       // identifying (기본)
    .addString("filePath", "/data/orders.csv", true)              // identifying 명시
    .addLong("executionTime", System.currentTimeMillis(), false)  // non-identifying
    .addString("operator", "admin", false)                        // non-identifying
    .toJobParameters();
```

---

## JobParametersIncrementer

같은 Job을 반복 실행할 때마다 새로운 `JobInstance`를 만들기 위해 파라미터를 자동으로 증가시키는 인터페이스다.

### RunIdIncrementer (기본 제공)

`run.id`라는 Long 타입 파라미터를 1씩 증가시킨다.

```java
@Bean
public Job myJob(JobRepository jobRepository) {
    return new JobBuilder("myJob", jobRepository)
        .incrementer(new RunIdIncrementer())
        .start(step1(jobRepository, transactionManager))
        .build();
}
```

### 날짜 기반 커스텀 Incrementer

```java
public class DailyJobParametersIncrementer implements JobParametersIncrementer {

    @Override
    public JobParameters getNext(JobParameters parameters) {
        if (parameters == null || parameters.isEmpty()) {
            return new JobParametersBuilder()
                .addLocalDate("targetDate", LocalDate.now())
                .toJobParameters();
        }

        LocalDate lastDate = parameters.getLocalDate("targetDate");
        LocalDate nextDate = (lastDate != null) ? lastDate.plusDays(1) : LocalDate.now();

        return new JobParametersBuilder(parameters)
            .addLocalDate("targetDate", nextDate)
            .toJobParameters();
    }
}
```

```java
@Bean
public Job myJob(JobRepository jobRepository) {
    return new JobBuilder("myJob", jobRepository)
        .incrementer(new DailyJobParametersIncrementer())
        .start(step1(jobRepository, transactionManager))
        .build();
}
```

---

## Job 흐름 제어

### 순차 실행

```java
@Bean
public Job sequentialJob(JobRepository jobRepository,
                          Step validateStep,
                          Step processStep,
                          Step reportStep) {
    return new JobBuilder("sequentialJob", jobRepository)
        .start(validateStep)
        .next(processStep)
        .next(reportStep)
        .build();
}
```

### 조건부 흐름

Step의 `ExitStatus`에 따라 다음 Step을 분기한다.

```java
@Bean
public Job conditionalJob(JobRepository jobRepository,
                           Step validateStep,
                           Step processStep,
                           Step errorHandlingStep,
                           Step notificationStep) {
    return new JobBuilder("conditionalJob", jobRepository)
        .start(validateStep)
            .on("FAILED").to(errorHandlingStep)  // 실패 시 에러 처리 Step으로
            .on("*").to(processStep)             // 그 외엔 정상 처리 Step으로
        .from(processStep)
            .on("*").to(notificationStep)
        .from(errorHandlingStep)
            .on("*").end()
        .end()
        .build();
}
```

`on()` 패턴 매칭 규칙:
- `"COMPLETED"` — 정확히 일치
- `"FAILED"` — 정확히 일치
- `"*"` — 0개 이상의 문자 (와일드카드)
- `"C*"` — C로 시작하는 모든 상태
- `"?AILED"` — 한 문자 + AILED

---

## BatchStatus vs ExitStatus

이 두 개념은 자주 혼동된다.

| 구분 | BatchStatus | ExitStatus |
|------|------------|------------|
| 타입 | Enum | 문자열 (String) |
| 역할 | 프레임워크 내부 상태 관리 | 흐름 제어용 상태 표현 |
| 커스텀 가능 여부 | 불가 | 가능 (임의 문자열) |
| 저장 위치 | `BATCH_JOB_EXECUTION.STATUS` | `BATCH_JOB_EXECUTION.EXIT_CODE` |
| 주요 값 | STARTING, STARTED, STOPPING, STOPPED, FAILED, COMPLETED, ABANDONED | EXECUTING, COMPLETED, NOOP, FAILED, STOPPED, 커스텀 문자열 |

`BatchStatus`는 Spring Batch 프레임워크가 내부적으로 관리하는 상태다. `ExitStatus`는 Step이나 Job이 종료될 때 반환하는 문자열로, `on()` 메서드의 패턴 매칭 대상이 된다.

```java
// ExitStatus를 직접 반환하는 Step 예제
@Bean
public Step validationStep(JobRepository jobRepository,
                            PlatformTransactionManager transactionManager) {
    return new StepBuilder("validationStep", jobRepository)
        .tasklet((contribution, chunkContext) -> {
            boolean hasData = checkDataExists();

            if (!hasData) {
                // 커스텀 ExitStatus 설정
                contribution.setExitStatus(new ExitStatus("NO_DATA"));
                return RepeatStatus.FINISHED;
            }

            contribution.setExitStatus(ExitStatus.COMPLETED);
            return RepeatStatus.FINISHED;
        }, transactionManager)
        .build();
}
```

```java
@Bean
public Job validationJob(JobRepository jobRepository, Step validationStep, Step processStep) {
    return new JobBuilder("validationJob", jobRepository)
        .start(validationStep)
            .on("NO_DATA").end()          // 데이터 없으면 COMPLETED로 종료
            .on("COMPLETED").to(processStep)
            .on("FAILED").fail()          // FAILED 상태로 Job 종료
        .end()
        .build();
}
```

---

## end() / fail() / stopAndRestart() 차이

| 메서드 | Job BatchStatus | 설명 |
|--------|----------------|------|
| `end()` | `COMPLETED` | 정상 종료. 재실행 불가(이미 완료) |
| `fail()` | `FAILED` | 실패 종료. 동일 파라미터로 재실행 가능 |
| `stopAndRestart(Step)` | `STOPPED` | 일시 정지. 재실행 시 지정한 Step부터 재개 |

```java
@Bean
public Job controlFlowJob(JobRepository jobRepository,
                           Step step1,
                           Step step2,
                           Step reviewStep) {
    return new JobBuilder("controlFlowJob", jobRepository)
        .start(step1)
            .on("COMPLETED").to(step2)
            .on("FAILED").fail()             // Job을 FAILED 상태로 종료
        .from(step2)
            .on("NEEDS_REVIEW").stopAndRestart(reviewStep) // 수동 검토 후 reviewStep부터 재시작
            .on("*").end()                   // 나머지는 COMPLETED로 종료
        .end()
        .build();
}
```

`stopAndRestart(step)`의 활용 사례: 자동화 배치 중간에 사람의 검토가 필요한 경우(예: 비정상 거래 감지 시 담당자 확인 후 재개).

---

## JobExecutionListener 구현

### 어노테이션 방식

```java
@Component
public class JobNotificationListener {

    private final SlackNotifier slackNotifier;

    public JobNotificationListener(SlackNotifier slackNotifier) {
        this.slackNotifier = slackNotifier;
    }

    @BeforeJob
    public void beforeJob(JobExecution jobExecution) {
        String jobName = jobExecution.getJobInstance().getJobName();
        JobParameters params = jobExecution.getJobParameters();
        log.info("[Batch] Job 시작: {}, 파라미터: {}", jobName, params);
    }

    @AfterJob
    public void afterJob(JobExecution jobExecution) {
        String jobName = jobExecution.getJobInstance().getJobName();
        BatchStatus status = jobExecution.getStatus();

        if (status == BatchStatus.FAILED) {
            String errorMessage = buildErrorMessage(jobExecution);
            slackNotifier.sendAlert(jobName, errorMessage);
        } else if (status == BatchStatus.COMPLETED) {
            long writeCount = jobExecution.getStepExecutions().stream()
                .mapToLong(StepExecution::getWriteCount)
                .sum();
            slackNotifier.sendSuccess(jobName, writeCount);
        }
    }

    private String buildErrorMessage(JobExecution jobExecution) {
        return jobExecution.getStepExecutions().stream()
            .filter(se -> se.getStatus() == BatchStatus.FAILED)
            .map(se -> String.format("Step: %s, 원인: %s",
                se.getStepName(),
                se.getExitStatus().getExitDescription()))
            .collect(Collectors.joining("\n"));
    }
}
```

### Slack 알림 예제 (RestTemplate 활용)

```java
@Component
public class SlackNotifier {

    private final RestTemplate restTemplate;

    @Value("${slack.webhook.url}")
    private String webhookUrl;

    public SlackNotifier(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public void sendAlert(String jobName, String errorMessage) {
        String payload = """
            {
                "text": ":red_circle: *배치 실패 알림*",
                "attachments": [{
                    "color": "danger",
                    "fields": [
                        {"title": "Job", "value": "%s", "short": true},
                        {"title": "시각", "value": "%s", "short": true},
                        {"title": "오류 내용", "value": "%s", "short": false}
                    ]
                }]
            }
            """.formatted(jobName, LocalDateTime.now(), errorMessage);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> request = new HttpEntity<>(payload, headers);

        try {
            restTemplate.postForEntity(webhookUrl, request, String.class);
        } catch (Exception e) {
            log.error("Slack 알림 전송 실패", e);
        }
    }

    public void sendSuccess(String jobName, long processedCount) {
        String payload = """
            {
                "text": ":white_check_mark: *배치 완료*: %s (%,d건 처리)"
            }
            """.formatted(jobName, processedCount);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        restTemplate.postForEntity(webhookUrl, new HttpEntity<>(payload, headers), String.class);
    }
}
```

---

## 전체 Job @Configuration 예제

```java
@Configuration
@RequiredArgsConstructor
public class OrderBatchJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final DataSource dataSource;
    private final JobNotificationListener jobNotificationListener;

    @Bean
    public Job orderProcessingJob() {
        return new JobBuilder("orderProcessingJob", jobRepository)
            .incrementer(new RunIdIncrementer())
            .listener(jobNotificationListener)
            .start(validateOrderStep())
                .on("NO_DATA").end()
                .on("FAILED").fail()
                .on("*").to(processOrderStep())
            .from(processOrderStep())
                .on("FAILED").to(errorReportStep())
                .on("*").to(sendNotificationStep())
            .from(errorReportStep())
                .on("*").fail()
            .from(sendNotificationStep())
                .on("*").end()
            .end()
            .build();
    }

    @Bean
    public Step validateOrderStep() {
        return new StepBuilder("validateOrderStep", jobRepository)
            .tasklet(validateOrderTasklet(), transactionManager)
            .build();
    }

    @Bean
    public Step processOrderStep() {
        return new StepBuilder("processOrderStep", jobRepository)
            .<Order, OrderResult>chunk(500, transactionManager)
            .reader(orderItemReader(null))    // @StepScope로 파라미터 주입 (다음 파일 참조)
            .processor(orderItemProcessor())
            .writer(orderItemWriter())
            .build();
    }

    @Bean
    public Step errorReportStep() {
        return new StepBuilder("errorReportStep", jobRepository)
            .tasklet(errorReportTasklet(), transactionManager)
            .build();
    }

    @Bean
    public Step sendNotificationStep() {
        return new StepBuilder("sendNotificationStep", jobRepository)
            .tasklet(notificationTasklet(), transactionManager)
            .build();
    }

    // Reader, Processor, Writer, Tasklet 빈 정의는 생략
    // @StepScope 활용은 04-item-reader.md 참조
}
```

> **실무 팁**: Job 설정 클래스가 비대해지지 않도록 Reader/Writer/Processor는 별도 `@Configuration` 클래스로 분리하고, Job 설정 클래스에서는 흐름 제어에만 집중하는 것이 좋다. 예: `OrderReaderConfig`, `OrderWriterConfig`, `OrderJobConfig`.
