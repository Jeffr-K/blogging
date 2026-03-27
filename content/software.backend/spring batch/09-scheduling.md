---
title: "Spring Batch: 스케줄링 연동 (Scheduler, Quartz, ShedLock)"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "scheduling", "quartz", "shedlock"]
---

## Spring @Scheduled + JobLauncher 패턴

가장 단순한 스케줄링 방식이다. 단일 서버 환경이거나, 분산 락을 별도로 적용하는 경우에 사용한다.

### 기본 설정

```java
// 메인 클래스 또는 @Configuration 클래스에 추가
@SpringBootApplication
@EnableScheduling  // 스케줄링 활성화
public class BatchApplication {
    public static void main(String[] args) {
        SpringApplication.run(BatchApplication.class, args);
    }
}
```

```yaml
# application.yml - 자동 실행 비활성화 (스케줄러가 직접 실행)
spring:
  batch:
    job:
      enabled: false
```

### 전체 스케줄러 코드 예제

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class BatchScheduler {

    private final JobLauncher jobLauncher;
    private final Job dailyOrderJob;
    private final Job weeklyReportJob;

    /**
     * 매일 새벽 2시 실행
     * cron 표현식: 초 분 시 일 월 요일
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void runDailyOrderJob() {
        String targetDate = LocalDate.now().minusDays(1)
                .format(DateTimeFormatter.ISO_LOCAL_DATE);

        JobParameters params = new JobParametersBuilder()
                .addString("targetDate", targetDate)
                .addLong("timestamp", System.currentTimeMillis())  // 중복 실행 방지 키
                .toJobParameters();

        try {
            log.info("[스케줄러] dailyOrderJob 실행 시작 - targetDate: {}", targetDate);
            JobExecution execution = jobLauncher.run(dailyOrderJob, params);
            log.info("[스케줄러] dailyOrderJob 완료 - 상태: {}, 처리 시간: {}ms",
                    execution.getStatus(),
                    Duration.between(execution.getStartTime(), execution.getEndTime()).toMillis());

        } catch (JobExecutionAlreadyRunningException e) {
            log.warn("[스케줄러] dailyOrderJob이 이미 실행 중입니다. 실행을 건너뜁니다.");
        } catch (JobInstanceAlreadyCompleteException e) {
            log.warn("[스케줄러] {} 날짜 Job이 이미 완료되었습니다.", targetDate);
        } catch (Exception e) {
            log.error("[스케줄러] dailyOrderJob 실행 실패", e);
            // 알림 발송 로직 추가 가능
        }
    }

    /**
     * 매주 월요일 오전 6시 실행
     */
    @Scheduled(cron = "0 0 6 * * MON")
    public void runWeeklyReportJob() {
        JobParameters params = new JobParametersBuilder()
                .addString("weekStart", LocalDate.now().minusWeeks(1).toString())
                .addString("weekEnd", LocalDate.now().minusDays(1).toString())
                .addLong("timestamp", System.currentTimeMillis())
                .toJobParameters();

        try {
            log.info("[스케줄러] weeklyReportJob 실행 시작");
            jobLauncher.run(weeklyReportJob, params);
        } catch (Exception e) {
            log.error("[스케줄러] weeklyReportJob 실행 실패", e);
        }
    }

    /**
     * 30분마다 실행 (fixedDelay: 이전 실행 완료 후 30분)
     */
    @Scheduled(fixedDelay = 30 * 60 * 1000)
    public void runIncrementalSyncJob() {
        // fixedDelay를 사용하면 이전 실행이 끝난 후 대기하므로
        // 실행 시간이 주기를 초과해도 겹치지 않음
    }
}
```

---

## 클러스터 환경에서의 중복 실행 문제

### 위험성

```
서버 A: 새벽 2시 → dailyOrderJob 실행 시작
서버 B: 새벽 2시 → dailyOrderJob 실행 시작 (동시!)

결과:
- 동일 데이터를 두 번 처리
- DB 중복 INSERT / 잘못된 집계
- Spring Batch 메타데이터 충돌
```

### 해결책 비교

| 방법 | 복잡도 | 적합한 상황 |
|------|-------|------------|
| **단일 배치 서버** | 낮음 | 배치 전용 서버를 별도 운영 |
| **ShedLock** | 낮음 | 기존 @Scheduled 유지, DB/Redis 락만 추가 |
| **Quartz 클러스터링** | 높음 | 정교한 스케줄 관리, 관리 UI 필요 |

---

## Quartz 연동

### 의존성

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-quartz</artifactId>
</dependency>
```

### QuartzJobBean 구현

```java
@Component
@RequiredArgsConstructor
public class DailyOrderBatchJob extends QuartzJobBean {

    private final JobLauncher jobLauncher;
    private final ApplicationContext applicationContext;

    @Override
    protected void executeInternal(JobExecutionContext context) {
        // Quartz는 Job 인스턴스를 새로 생성하므로
        // Spring Bean을 ApplicationContext에서 직접 가져와야 할 수 있음
        Job dailyOrderJob = applicationContext.getBean("dailyOrderJob", Job.class);

        String targetDate = LocalDate.now().minusDays(1)
                .format(DateTimeFormatter.ISO_LOCAL_DATE);

        JobParameters params = new JobParametersBuilder()
                .addString("targetDate", targetDate)
                .addLong("timestamp", System.currentTimeMillis())
                .toJobParameters();

        try {
            log.info("[Quartz] DailyOrderBatchJob 실행 - targetDate: {}", targetDate);
            JobExecution execution = jobLauncher.run(dailyOrderJob, params);
            log.info("[Quartz] 완료 - 상태: {}", execution.getStatus());
        } catch (Exception e) {
            log.error("[Quartz] 실행 실패", e);
        }
    }
}
```

### JobDetailFactoryBean + CronTriggerFactoryBean 설정

```java
@Configuration
public class QuartzJobConfig {

    @Bean
    public JobDetail dailyOrderJobDetail() {
        return JobBuilder.newJob(DailyOrderBatchJob.class)
                .withIdentity("dailyOrderBatchJob")
                .withDescription("매일 주문 데이터 처리")
                .storeDurably()  // Trigger가 없어도 Job 유지
                .build();
    }

    @Bean
    public Trigger dailyOrderJobTrigger(JobDetail dailyOrderJobDetail) {
        // 매일 새벽 2시 실행
        CronScheduleBuilder scheduleBuilder =
                CronScheduleBuilder.cronSchedule("0 0 2 * * ?")
                        .withMisfireHandlingInstructionDoNothing();  // 실행 누락 시 무시

        return TriggerBuilder.newTrigger()
                .forJob(dailyOrderJobDetail)
                .withIdentity("dailyOrderJobTrigger")
                .withSchedule(scheduleBuilder)
                .build();
    }

    // Spring Boot 방식 (FactoryBean 스타일)
    @Bean
    public JobDetailFactoryBean dailyOrderJobDetailFactory() {
        JobDetailFactoryBean factory = new JobDetailFactoryBean();
        factory.setJobClass(DailyOrderBatchJob.class);
        factory.setName("dailyOrderBatchJobFactory");
        factory.setGroup("batchGroup");
        factory.setDurability(true);
        return factory;
    }

    @Bean
    public CronTriggerFactoryBean dailyOrderCronTrigger(
            JobDetail dailyOrderJobDetailFactory) {
        CronTriggerFactoryBean trigger = new CronTriggerFactoryBean();
        trigger.setJobDetail(dailyOrderJobDetailFactory);
        trigger.setName("dailyOrderCronTrigger");
        trigger.setGroup("batchGroup");
        trigger.setCronExpression("0 0 2 * * ?");  // 새벽 2시
        trigger.setMisfireInstruction(CronTrigger.MISFIRE_INSTRUCTION_DO_NOTHING);
        return trigger;
    }
}
```

### Quartz JDBC JobStore 설정 (DB 기반 클러스터링)

```yaml
# application.yml
spring:
  quartz:
    job-store-type: jdbc           # 메모리(RAM) 대신 DB에 스케줄 저장
    jdbc:
      initialize-schema: always    # Quartz 테이블 자동 생성 (운영에서는 never)
    properties:
      org.quartz:
        scheduler:
          instanceName: BatchScheduler
          instanceId: AUTO           # 각 인스턴스에 고유 ID 자동 부여
        jobStore:
          class: org.quartz.impl.jdbcjobstore.JobStoreTX
          driverDelegateClass: org.quartz.impl.jdbcjobstore.StdJDBCDelegate
          tablePrefix: QRTZ_
          isClustered: true          # 클러스터링 활성화 (핵심!)
          clusterCheckinInterval: 10000  # 10초마다 heartbeat
        threadPool:
          threadCount: 5
```

**클러스터링 동작 원리:**
1. 각 서버가 `QRTZ_SCHEDULER_STATE` 테이블에 주기적으로 heartbeat를 기록한다
2. Trigger가 실행될 때 Quartz는 DB 락(`QRTZ_LOCKS`)을 획득한 서버만 실행한다
3. 한 서버가 다운되면 다른 서버가 해당 서버의 Job을 인계받는다

### Quartz 스키마 테이블 목록

| 테이블 | 역할 |
|--------|------|
| `QRTZ_JOB_DETAILS` | Job 정의 저장 |
| `QRTZ_TRIGGERS` | Trigger 정의 저장 |
| `QRTZ_CRON_TRIGGERS` | Cron Trigger 표현식 |
| `QRTZ_SIMPLE_TRIGGERS` | Simple Trigger 설정 |
| `QRTZ_FIRED_TRIGGERS` | 실행 중인 Trigger 상태 |
| `QRTZ_SCHEDULER_STATE` | 클러스터 노드 heartbeat |
| `QRTZ_LOCKS` | 클러스터 분산 락 |
| `QRTZ_CALENDARS` | 휴일/예외 날짜 정의 |

---

## ShedLock (더 간단한 분산 락)

기존 `@Scheduled`를 그대로 유지하면서 분산 락만 추가한다. 구현이 훨씬 단순하다.

### 의존성

```xml
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-spring</artifactId>
    <version>5.13.0</version>
</dependency>

<!-- JDBC 기반 락 (DB 사용) -->
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-provider-jdbc-template</artifactId>
    <version>5.13.0</version>
</dependency>
```

### DB 테이블 생성

```sql
-- MySQL / MariaDB
CREATE TABLE shedlock (
    name        VARCHAR(64)  NOT NULL,
    lock_until  TIMESTAMP(3) NOT NULL,
    locked_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    locked_by   VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
```

### ShedLock 설정 및 사용

```java
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")  // 기본 최대 락 보유 시간
public class ShedLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new JdbcTemplate(dataSource))
                        .usingDbTime()  // DB 서버 시간 기준 (서버 간 시간 차이 방지)
                        .build()
        );
    }
}

@Component
@RequiredArgsConstructor
@Slf4j
public class ShedLockBatchScheduler {

    private final JobLauncher jobLauncher;
    private final Job dailyOrderJob;

    @Scheduled(cron = "0 0 2 * * *")
    @SchedulerLock(
            name = "dailyOrderJob",           // 락 이름 (shedlock 테이블의 name 컬럼)
            lockAtLeastFor = "PT1M",          // 최소 1분간 락 유지 (빠르게 끝나도)
            lockAtMostFor = "PT2H"            // 최대 2시간 (비정상 종료 시 자동 해제)
    )
    public void runDailyOrderJob() {
        // 이 메서드는 클러스터 내 단 하나의 인스턴스에서만 실행됨
        String targetDate = LocalDate.now().minusDays(1).toString();

        try {
            JobParameters params = new JobParametersBuilder()
                    .addString("targetDate", targetDate)
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();

            log.info("[ShedLock] dailyOrderJob 실행 - targetDate: {}", targetDate);
            jobLauncher.run(dailyOrderJob, params);
        } catch (Exception e) {
            log.error("[ShedLock] 실행 실패", e);
        }
    }
}
```

**동작 원리:**
1. 스케줄 시간이 되면 모든 서버가 실행을 시도한다
2. `shedlock` 테이블에 INSERT를 시도 → 성공한 서버만 실행한다
3. `lockAtMostFor` 시간이 지나면 자동으로 락이 해제된다 (서버 다운 대비)
4. `lockAtLeastFor`는 빠르게 끝난 후 다른 서버가 즉시 재실행하는 것을 방지한다

### Redis 기반 ShedLock

```xml
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-provider-redis-spring</artifactId>
    <version>5.13.0</version>
</dependency>
```

```java
@Bean
public LockProvider lockProvider(RedisConnectionFactory connectionFactory) {
    return new RedisLockProvider(connectionFactory, "production");
    // Redis에 "shedlock:production:dailyOrderJob" 키로 저장됨
}
```

### Quartz vs ShedLock 선택 기준

| 기준 | Quartz | ShedLock |
|------|--------|---------|
| **설정 복잡도** | 높음 | 낮음 |
| **스케줄 변경** | DB/UI에서 동적 변경 가능 | 코드 변경 필요 |
| **스케줄 관리 UI** | 있음 (별도 플러그인) | 없음 |
| **장애 복구** | 자동 (클러스터가 인계) | 수동 (lockAtMostFor 후 해제) |
| **의존성** | Quartz DB 스키마 필요 | 단순 테이블 1개 |
| **추천 상황** | 정교한 스케줄 관리, 운영팀이 동적 변경 | 대부분의 배치 스케줄링 |

---

## 실무 팁

### 배치 서버 단일화 vs 분산 락 트레이드오프

```
배치 서버 단일화:
+ 구현 단순 (분산 락 불필요)
+ 배치 서버 리소스를 웹 서버와 분리
- SPOF (배치 서버 장애 시 전체 배치 중단)
- 서버 유지보수 시 스케줄 놓칠 수 있음

분산 락 (ShedLock/Quartz):
+ 배치 서버 장애 시 다른 서버가 자동 실행
+ 롤링 배포 중에도 스케줄 보장
- 분산 락 관리 복잡도 추가
- 락 보유 시간 설정에 주의 필요
```

### 배치 실행 시간이 스케줄 주기보다 길어질 때

```java
// 문제: 배치가 1시간 걸리는데 30분마다 스케줄링
// @Scheduled(fixedRate = 30 * 60 * 1000) → 동시 실행 발생!

// 해결 1: fixedDelay 사용 (이전 실행 완료 후 대기)
@Scheduled(fixedDelay = 30 * 60 * 1000)  // 완료 후 30분 대기
public void safeSchedule() { ... }

// 해결 2: ShedLock의 lockAtLeastFor 활용
@SchedulerLock(
        name = "heavyBatchJob",
        lockAtLeastFor = "PT50M",   // 최소 50분 락 유지
        lockAtMostFor = "PT3H"      // 최대 3시간
)
@Scheduled(cron = "0 0 * * * *")  // 매 시간
public void heavyBatchSchedule() {
    // 실행 시간이 1시간 이상이면 lockAtLeastFor로 인해
    // 다음 스케줄 시간에 다른 서버가 실행 못 함 → 자연스럽게 순차 실행
}

// 해결 3: 실행 중 여부 확인 후 스킵
@Component
public class SafeScheduler {
    private final AtomicBoolean running = new AtomicBoolean(false);

    @Scheduled(cron = "0 0/30 * * * *")
    public void conditionalSchedule() {
        if (!running.compareAndSet(false, true)) {
            log.warn("이전 배치가 아직 실행 중. 이번 스케줄을 건너뜁니다.");
            return;
        }
        try {
            runBatchJob();
        } finally {
            running.set(false);
        }
    }
}
```

### 운영 환경 cron 표현식 레퍼런스

```java
// Quartz cron (7자리: 초 분 시 일 월 요일 년)
"0 0 2 * * ?"      // 매일 새벽 2시
"0 0 6 ? * MON"    // 매주 월요일 오전 6시
"0 0 0 1 * ?"      // 매월 1일 자정
"0 0/30 9-18 * * ?" // 업무 시간(9-18시) 30분마다

// Spring @Scheduled cron (6자리: 초 분 시 일 월 요일)
"0 0 2 * * *"       // 매일 새벽 2시
"0 0 6 * * MON"     // 매주 월요일 오전 6시
"0 0 0 1 * *"       // 매월 1일 자정
```
