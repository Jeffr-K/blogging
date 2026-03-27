---
title: "Spring Batch: 모니터링, 메트릭, 운영 관리"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "monitoring", "micrometer", "actuator"]
---

## 메타데이터 테이블로 이력 조회

Spring Batch는 Job과 Step의 실행 이력을 DB 메타데이터 테이블에 저장한다. 이 테이블을 활용하면 별도 모니터링 도구 없이도 실행 이력을 파악할 수 있다.

### BATCH_JOB_EXECUTION 조회

```sql
-- 최근 Job 실행 이력 (최근 10건)
SELECT
    JOB_EXECUTION_ID,
    JOB_INSTANCE_ID,
    CREATE_TIME,
    START_TIME,
    END_TIME,
    TIMESTAMPDIFF(SECOND, START_TIME, END_TIME) AS DURATION_SEC,
    STATUS,
    EXIT_CODE,
    EXIT_MESSAGE
FROM BATCH_JOB_EXECUTION
ORDER BY CREATE_TIME DESC
LIMIT 10;

-- 특정 Job의 실행 이력
SELECT
    je.JOB_EXECUTION_ID,
    ji.JOB_NAME,
    je.START_TIME,
    je.END_TIME,
    je.STATUS,
    je.EXIT_CODE
FROM BATCH_JOB_EXECUTION je
JOIN BATCH_JOB_INSTANCE ji ON je.JOB_INSTANCE_ID = ji.JOB_INSTANCE_ID
WHERE ji.JOB_NAME = 'dailyOrderJob'
ORDER BY je.START_TIME DESC;

-- 실패한 Job 조회
SELECT
    je.JOB_EXECUTION_ID,
    ji.JOB_NAME,
    je.START_TIME,
    je.EXIT_MESSAGE  -- 실패 원인 (스택 트레이스 포함)
FROM BATCH_JOB_EXECUTION je
JOIN BATCH_JOB_INSTANCE ji ON je.JOB_INSTANCE_ID = ji.JOB_INSTANCE_ID
WHERE je.STATUS = 'FAILED'
ORDER BY je.START_TIME DESC;
```

### BATCH_STEP_EXECUTION 조회

```sql
-- Step별 처리 통계
SELECT
    se.STEP_NAME,
    se.START_TIME,
    se.END_TIME,
    se.STATUS,
    se.READ_COUNT,       -- Reader가 읽은 건수
    se.WRITE_COUNT,      -- Writer가 쓴 건수
    se.COMMIT_COUNT,     -- 커밋 횟수
    se.ROLLBACK_COUNT,   -- 롤백 횟수
    se.SKIP_COUNT,       -- Skip된 건수
    se.FILTER_COUNT,     -- Processor에서 null 반환으로 필터링된 건수
    se.EXIT_CODE,
    se.EXIT_MESSAGE
FROM BATCH_STEP_EXECUTION se
WHERE se.JOB_EXECUTION_ID = ?  -- Job Execution ID 지정
ORDER BY se.START_TIME;

-- Job별 Step 처리량 집계 (성능 추세 파악)
SELECT
    ji.JOB_NAME,
    se.STEP_NAME,
    DATE(je.START_TIME) AS EXECUTION_DATE,
    AVG(se.WRITE_COUNT) AS AVG_WRITE_COUNT,
    MAX(TIMESTAMPDIFF(SECOND, se.START_TIME, se.END_TIME)) AS MAX_DURATION_SEC
FROM BATCH_STEP_EXECUTION se
JOIN BATCH_JOB_EXECUTION je ON se.JOB_EXECUTION_ID = je.JOB_EXECUTION_ID
JOIN BATCH_JOB_INSTANCE ji ON je.JOB_INSTANCE_ID = ji.JOB_INSTANCE_ID
WHERE je.START_TIME >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY ji.JOB_NAME, se.STEP_NAME, DATE(je.START_TIME)
ORDER BY EXECUTION_DATE DESC;
```

### JobExplorer 활용: 배치 이력 조회 API

```java
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/batch/history")
public class BatchHistoryController {

    private final JobExplorer jobExplorer;

    /**
     * 특정 Job의 최근 실행 이력 조회
     */
    @GetMapping("/jobs/{jobName}")
    public List<JobExecutionDto> getJobHistory(
            @PathVariable String jobName,
            @RequestParam(defaultValue = "10") int limit) {

        return jobExplorer.findJobInstancesByJobName(jobName, 0, limit)
                .stream()
                .flatMap(instance -> jobExplorer.getJobExecutions(instance).stream())
                .sorted(Comparator.comparing(JobExecution::getCreateTime).reversed())
                .limit(limit)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * 특정 Job Execution 상세 조회 (Step 포함)
     */
    @GetMapping("/executions/{executionId}")
    public JobExecutionDetailDto getExecutionDetail(
            @PathVariable Long executionId) {

        JobExecution execution = jobExplorer.getJobExecution(executionId);
        if (execution == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Execution not found: " + executionId);
        }

        return JobExecutionDetailDto.builder()
                .jobExecutionId(execution.getId())
                .jobName(execution.getJobInstance().getJobName())
                .status(execution.getStatus().name())
                .startTime(execution.getStartTime())
                .endTime(execution.getEndTime())
                .exitCode(execution.getExitStatus().getExitCode())
                .exitMessage(execution.getExitStatus().getExitDescription())
                .stepExecutions(execution.getStepExecutions().stream()
                        .map(this::toStepDto)
                        .collect(Collectors.toList()))
                .build();
    }

    /**
     * 실행 중인 Job 목록
     */
    @GetMapping("/running")
    public List<JobExecutionDto> getRunningJobs() {
        // 모든 Job 이름 조회 후 실행 중인 것 필터
        return jobExplorer.getJobNames()
                .stream()
                .flatMap(jobName ->
                        jobExplorer.findRunningJobExecutions(jobName).stream())
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private JobExecutionDto toDto(JobExecution execution) {
        return JobExecutionDto.builder()
                .jobExecutionId(execution.getId())
                .jobName(execution.getJobInstance().getJobName())
                .status(execution.getStatus().name())
                .startTime(execution.getStartTime())
                .endTime(execution.getEndTime())
                .build();
    }

    private StepExecutionDto toStepDto(StepExecution step) {
        return StepExecutionDto.builder()
                .stepName(step.getStepName())
                .status(step.getStatus().name())
                .readCount(step.getReadCount())
                .writeCount(step.getWriteCount())
                .skipCount(step.getSkipCount())
                .filterCount(step.getFilterCount())
                .commitCount(step.getCommitCount())
                .rollbackCount(step.getRollbackCount())
                .build();
    }
}
```

---

## Actuator 연동

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics, prometheus
  endpoint:
    health:
      show-details: always
```

### 헬스 체크

Spring Batch는 `BatchAutoConfiguration`을 통해 자동으로 헬스 인디케이터를 등록한다. `/actuator/health`에서 배치 메타데이터 DB 연결 상태를 확인할 수 있다.

```json
// GET /actuator/health 응답 예시
{
  "status": "UP",
  "components": {
    "batch": {
      "status": "UP",
      "details": {
        "dataSource": "jdbc:mysql://localhost:3306/batch_db"
      }
    },
    "db": {
      "status": "UP"
    }
  }
}
```

---

## Micrometer 메트릭 (Spring Batch 5.x)

### 설정

```yaml
# application.yml
spring:
  batch:
    metrics:
      enabled: true  # Spring Batch 메트릭 활성화 (기본값: true)
```

### 자동 생성 메트릭

Spring Batch 5.x는 다음 메트릭을 자동으로 생성한다:

| 메트릭 이름 | 타입 | 설명 |
|------------|------|------|
| `spring.batch.job` | Timer | Job 전체 실행 시간 |
| `spring.batch.step` | Timer | Step 실행 시간 |
| `spring.batch.item.read` | Timer | ItemReader.read() 소요 시간 |
| `spring.batch.item.process` | Timer | ItemProcessor.process() 소요 시간 |
| `spring.batch.chunk.write` | Timer | 청크 쓰기 소요 시간 |

각 메트릭은 `job.name`, `step.name`, `status` 등의 태그를 포함한다.

### Prometheus 스크레이핑 설정

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

```yaml
management:
  endpoints:
    web:
      exposure:
        include: prometheus
  metrics:
    export:
      prometheus:
        enabled: true
```

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'spring-batch'
    scrape_interval: 15s
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['batch-server:8080']
```

### Grafana 대시보드용 PromQL 예제

```promql
# Job 실행 시간 (초) - 최근 1시간
rate(spring_batch_job_seconds_sum[1h])
/ rate(spring_batch_job_seconds_count[1h])

# Job 성공/실패 카운트
increase(spring_batch_job_seconds_count{status="COMPLETED"}[1d])
increase(spring_batch_job_seconds_count{status="FAILED"}[1d])

# Step별 평균 처리 시간
rate(spring_batch_step_seconds_sum[5m])
/ rate(spring_batch_step_seconds_count[5m])

# 청크 쓰기 처리량 (초당 청크 수)
rate(spring_batch_chunk_write_seconds_count[5m])

# 특정 Job의 실행 시간 히스토그램
histogram_quantile(0.95,
  rate(spring_batch_job_seconds_bucket{job_name="dailyOrderJob"}[1h])
)
```

---

## 커스텀 메트릭

### MeterRegistry로 커스텀 카운터/게이지 등록

```java
@Component
@RequiredArgsConstructor
public class BatchMetricsCollector {

    private final MeterRegistry meterRegistry;

    // 처리 건수 카운터
    private Counter processedItemCounter;
    private Counter skippedItemCounter;

    @PostConstruct
    public void init() {
        processedItemCounter = Counter.builder("batch.items.processed")
                .description("배치에서 처리된 총 아이템 수")
                .tag("application", "batch-service")
                .register(meterRegistry);

        skippedItemCounter = Counter.builder("batch.items.skipped")
                .description("배치에서 건너뛴 총 아이템 수")
                .tag("application", "batch-service")
                .register(meterRegistry);
    }

    public void incrementProcessed(int count) {
        processedItemCounter.increment(count);
    }

    public void incrementSkipped(int count) {
        skippedItemCounter.increment(count);
    }
}
```

### ItemWriteListener에서 처리 건수 카운팅

```java
@Component
@RequiredArgsConstructor
public class MetricsItemWriteListener<T> implements ItemWriteListener<T> {

    private final MeterRegistry meterRegistry;

    @Override
    public void afterWrite(Chunk<? extends T> items) {
        // 처리 건수 카운팅
        meterRegistry.counter("batch.items.written",
                "step", getCurrentStepName()).increment(items.size());
    }

    @Override
    public void onWriteError(Exception exception, Chunk<? extends T> items) {
        // 쓰기 오류 카운팅
        meterRegistry.counter("batch.items.write.error",
                "exception", exception.getClass().getSimpleName()).increment(items.size());
    }

    private String getCurrentStepName() {
        // StepSynchronizationManager에서 현재 Step 이름 조회
        StepExecution stepExecution = StepSynchronizationManager.getContext().getStepExecution();
        return stepExecution != null ? stepExecution.getStepName() : "unknown";
    }
}

// Step에 Listener 등록
@Bean
public Step processOrderStep() {
    return new StepBuilder("processOrderStep", jobRepository)
            .<Order, ProcessedOrder>chunk(100, transactionManager)
            .reader(orderReader())
            .processor(orderProcessor())
            .writer(processedOrderWriter())
            .listener(metricsItemWriteListener)  // 리스너 등록
            .build();
}
```

---

## 로깅 설정

### MDC에 jobName, stepName 추가

MDC(Mapped Diagnostic Context)를 활용하면 모든 로그에 Job/Step 이름을 자동으로 포함시킬 수 있다.

```java
@Component
public class MdcJobExecutionListener implements JobExecutionListener {

    @Override
    public void beforeJob(JobExecution jobExecution) {
        MDC.put("jobName", jobExecution.getJobInstance().getJobName());
        MDC.put("jobExecutionId", String.valueOf(jobExecution.getId()));
        MDC.put("targetDate",
                jobExecution.getJobParameters().getString("targetDate", "unknown"));
    }

    @Override
    public void afterJob(JobExecution jobExecution) {
        MDC.remove("jobName");
        MDC.remove("jobExecutionId");
        MDC.remove("targetDate");
    }
}

@Component
public class MdcStepExecutionListener implements StepExecutionListener {

    @Override
    public void beforeStep(StepExecution stepExecution) {
        MDC.put("stepName", stepExecution.getStepName());
        MDC.put("stepExecutionId", String.valueOf(stepExecution.getId()));
    }

    @Override
    public ExitStatus afterStep(StepExecution stepExecution) {
        MDC.remove("stepName");
        MDC.remove("stepExecutionId");
        return stepExecution.getExitStatus();
    }
}
```

### 배치 전용 로그 파일 분리 (logback-spring.xml)

```xml
<!-- src/main/resources/logback-spring.xml -->
<configuration>

    <!-- 콘솔 Appender -->
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] [%X{jobName}/%X{stepName}] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <!-- 배치 전용 파일 Appender -->
    <appender name="BATCH_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/batch.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/batch.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
            <timeBasedFileNamingAndTriggeringPolicy
                class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                <maxFileSize>100MB</maxFileSize>
            </timeBasedFileNamingAndTriggeringPolicy>
            <maxHistory>30</maxHistory>
            <totalSizeCap>3GB</totalSizeCap>
        </rollingPolicy>
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] [job=%X{jobName}] [step=%X{stepName}] [execId=%X{jobExecutionId}] %-5level %logger - %msg%n</pattern>
        </encoder>
    </appender>

    <!-- 배치 패키지는 배치 파일로 분리 -->
    <logger name="com.example.batch" level="INFO" additivity="false">
        <appender-ref ref="BATCH_FILE"/>
        <appender-ref ref="CONSOLE"/>
    </logger>

    <!-- Spring Batch 내부 로그 -->
    <logger name="org.springframework.batch" level="INFO" additivity="false">
        <appender-ref ref="BATCH_FILE"/>
    </logger>

    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
    </root>

</configuration>
```

---

## 운영 이슈 대응

### 장시간 실행 배치 알림

```java
@Component
@RequiredArgsConstructor
public class LongRunningJobAlertListener implements JobExecutionListener {

    private final MeterRegistry meterRegistry;
    private final SlackNotifier slackNotifier;

    // 2시간 이상 실행되면 경고
    private static final Duration WARNING_THRESHOLD = Duration.ofHours(2);

    @Override
    public void afterJob(JobExecution jobExecution) {
        if (jobExecution.getStartTime() != null && jobExecution.getEndTime() != null) {
            Duration duration = Duration.between(
                    jobExecution.getStartTime(), jobExecution.getEndTime());

            // Micrometer Timer에 실행 시간 기록
            meterRegistry.timer("batch.job.custom.duration",
                    "jobName", jobExecution.getJobInstance().getJobName(),
                    "status", jobExecution.getStatus().name())
                    .record(duration);

            // 임계치 초과 시 알림
            if (duration.compareTo(WARNING_THRESHOLD) > 0) {
                slackNotifier.sendWarning(String.format(
                        "배치 장시간 실행 경고: %s가 %d분 동안 실행되었습니다.",
                        jobExecution.getJobInstance().getJobName(),
                        duration.toMinutes()));
            }
        }
    }
}
```

### 강제 종료 후 재시작 절차

배치 서버가 강제 종료(kill -9)되면 `BATCH_JOB_EXECUTION`의 STATUS가 `STARTED` 또는 `STARTING` 상태로 남는다. 이 경우 재시작이 불가능하므로 수동으로 상태를 변경해야 한다.

```sql
-- 1. 비정상 종료된 Job 확인
SELECT JOB_EXECUTION_ID, STATUS, START_TIME
FROM BATCH_JOB_EXECUTION
WHERE STATUS IN ('STARTED', 'STARTING', 'STOPPING')
  AND START_TIME < DATE_SUB(NOW(), INTERVAL 1 HOUR);  -- 1시간 이상 실행 중인 것

-- 2. 상태를 FAILED로 변경 (재시작 가능하도록)
UPDATE BATCH_JOB_EXECUTION
SET STATUS = 'FAILED', EXIT_CODE = 'FAILED', EXIT_MESSAGE = '서버 강제 종료로 인한 수동 상태 변경'
WHERE JOB_EXECUTION_ID = ?;

-- 3. Step도 동일하게 처리
UPDATE BATCH_STEP_EXECUTION
SET STATUS = 'FAILED', EXIT_CODE = 'FAILED'
WHERE JOB_EXECUTION_ID = ?
  AND STATUS IN ('STARTED', 'STARTING');
```

### JobOperator로 실행 중인 Job 제어

```java
@Service
@RequiredArgsConstructor
public class BatchOperationService {

    private final JobOperator jobOperator;
    private final JobExplorer jobExplorer;

    /**
     * 정상적으로 실행 중인 Job 중지 (graceful stop)
     * - 현재 청크 처리 완료 후 중지
     * - STATUS: STOPPED, 재시작 가능
     */
    public boolean stopJob(Long executionId) throws Exception {
        log.info("Job {} 중지 요청", executionId);
        boolean result = jobOperator.stop(executionId);
        log.info("Job {} 중지 요청 결과: {}", executionId, result ? "성공" : "이미 종료됨");
        return result;
    }

    /**
     * FAILED 상태의 Job 재시작
     * - 마지막으로 성공한 Step부터 재개
     */
    public Long restartJob(Long failedExecutionId) throws Exception {
        log.info("Job {} 재시작 요청", failedExecutionId);
        Long newExecutionId = jobOperator.restart(failedExecutionId);
        log.info("Job {} 재시작 → 새 Execution ID: {}", failedExecutionId, newExecutionId);
        return newExecutionId;
    }

    /**
     * ABANDONED 상태로 변경 (재시작 불필요한 경우)
     */
    public void abandonJob(Long executionId) throws Exception {
        jobOperator.abandon(executionId);
        log.info("Job {} ABANDONED 처리 완료", executionId);
    }
}
```

### 메타데이터 테이블 정기 정리

메타데이터 테이블을 방치하면 수십만 건이 쌓여 성능 저하가 발생한다. 주기적으로 정리해야 한다.

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class BatchMetadataCleanupScheduler {

    private final JobRepository jobRepository;
    private final JobExplorer jobExplorer;
    private final JdbcTemplate jdbcTemplate;

    /**
     * 매주 일요일 새벽 3시: 90일 이상 지난 실행 이력 삭제
     */
    @Scheduled(cron = "0 0 3 * * SUN")
    public void cleanupOldExecutions() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(90);
        log.info("배치 메타데이터 정리 시작 - 기준일: {}", cutoffDate);

        // 자식 테이블부터 삭제 (외래 키 제약)
        int deletedStepContexts = jdbcTemplate.update(
                "DELETE sec FROM BATCH_STEP_EXECUTION_CONTEXT sec " +
                "JOIN BATCH_STEP_EXECUTION se ON sec.STEP_EXECUTION_ID = se.STEP_EXECUTION_ID " +
                "JOIN BATCH_JOB_EXECUTION je ON se.JOB_EXECUTION_ID = je.JOB_EXECUTION_ID " +
                "WHERE je.CREATE_TIME < ?", cutoffDate);

        int deletedStepExecutions = jdbcTemplate.update(
                "DELETE se FROM BATCH_STEP_EXECUTION se " +
                "JOIN BATCH_JOB_EXECUTION je ON se.JOB_EXECUTION_ID = je.JOB_EXECUTION_ID " +
                "WHERE je.CREATE_TIME < ?", cutoffDate);

        int deletedJobContexts = jdbcTemplate.update(
                "DELETE jec FROM BATCH_JOB_EXECUTION_CONTEXT jec " +
                "JOIN BATCH_JOB_EXECUTION je ON jec.JOB_EXECUTION_ID = je.JOB_EXECUTION_ID " +
                "WHERE je.CREATE_TIME < ?", cutoffDate);

        int deletedJobParams = jdbcTemplate.update(
                "DELETE jep FROM BATCH_JOB_EXECUTION_PARAMS jep " +
                "JOIN BATCH_JOB_EXECUTION je ON jep.JOB_EXECUTION_ID = je.JOB_EXECUTION_ID " +
                "WHERE je.CREATE_TIME < ?", cutoffDate);

        int deletedJobExecutions = jdbcTemplate.update(
                "DELETE FROM BATCH_JOB_EXECUTION WHERE CREATE_TIME < ?", cutoffDate);

        // 더 이상 실행 이력이 없는 JobInstance 삭제
        int deletedJobInstances = jdbcTemplate.update(
                "DELETE ji FROM BATCH_JOB_INSTANCE ji " +
                "LEFT JOIN BATCH_JOB_EXECUTION je ON ji.JOB_INSTANCE_ID = je.JOB_INSTANCE_ID " +
                "WHERE je.JOB_INSTANCE_ID IS NULL");

        log.info("메타데이터 정리 완료 - JobExecution: {}건, StepExecution: {}건, JobInstance: {}건 삭제",
                deletedJobExecutions, deletedStepExecutions, deletedJobInstances);
    }
}
```

---

## Spring Cloud Data Flow 간략 소개

Spring Cloud Data Flow(SCDF)는 배치 작업을 UI로 관리하고 모니터링하는 통합 플랫폼이다.

### 주요 기능

- **Task/Batch 실행 관리**: UI에서 Job을 트리거하고 실행 이력 확인
- **재시작**: 실패한 Task를 UI에서 직접 재시작
- **Kubernetes/Cloud 네이티브**: Pod로 배치를 실행하고 자동 스케일링
- **모니터링 통합**: Grafana, Prometheus와 기본 연동

```yaml
# Spring Batch 앱을 SCDF Task로 등록하기 위한 설정
spring:
  cloud:
    task:
      closecontextEnabled: true  # Task 완료 시 컨텍스트 자동 종료
```

**도입 기준:** 배치 Job이 10개 이상이고, 운영팀이 비개발자라면 SCDF 도입을 고려한다. 소규모 팀이거나 배치가 단순하다면 Actuator + Grafana 조합으로 충분하다.

---

## 실무 팁 요약

1. **메타데이터 정기 정리**: 90일 이상 된 이력은 주기적으로 삭제. 방치하면 조인 쿼리 성능 저하
2. **EXIT_MESSAGE 활용**: 실패 시 스택 트레이스가 `EXIT_MESSAGE`에 저장됨. DB 조회만으로 원인 파악 가능
3. **Micrometer 메트릭 + AlertManager**: Job 실행 시간이 임계치 초과 시 자동 알림 설정
4. **JobExplorer를 API로 노출**: 운영팀이 Slack 알림으로 이력 조회 API를 호출할 수 있도록 설계
5. **graceful stop**: `JobOperator.stop()`은 현재 청크를 완료한 후 멈추므로 데이터 정합성이 보장됨
