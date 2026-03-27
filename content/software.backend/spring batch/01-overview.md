---
title: "Spring Batch: 배치 처리와 핵심 아키텍처"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "batch", "architecture"]
---

## 배치(Batch) vs 실시간(Real-time) 처리

배치 처리와 실시간 처리는 서로 다른 문제를 해결하기 위해 존재한다. 두 방식을 비교하면 다음과 같다.

| 구분 | 배치(Batch) | 실시간(Real-time) |
|------|------------|-----------------|
| 처리 시점 | 예약된 특정 시각 (야간, 월말 등) | 이벤트 발생 즉시 |
| 데이터 규모 | 수백만 ~ 수억 건 | 건당 처리 |
| 응답 필요성 | 없음 (사용자 대기 없음) | 즉각적인 응답 필요 |
| 트랜잭션 방식 | 청크(Chunk) 단위 묶음 커밋 | 건별 커밋 |
| 실패 처리 | 재시작, Skip, Retry로 복구 | 즉시 예외 처리 |
| 자원 사용 | 유휴 시간에 집중 사용 | 평상시 분산 |
| 예시 | 월말 정산, 대용량 리포트 | 결제 승인, 실시간 알림 |

---

## 배치가 필요한 대표 상황

**야간 정산**
하루 동안 발생한 수백만 건의 거래를 집계해 정산 테이블에 기록한다. 사용자가 없는 새벽 시간에 처리함으로써 DB 부하를 분산한다.

**대용량 리포트 생성**
월간/분기 보고서를 생성할 때 수천만 행의 데이터를 읽어 집계한다. 실시간으로 처리하면 타임아웃이 발생하므로 배치로 사전 생성한다.

**외부 시스템 동기화**
ERP, CRM 등 외부 시스템과 데이터를 주기적으로 맞춘다. API 호출 제한이 있거나 파일 기반 인터페이스를 사용하는 경우가 많다.

**월말 마감 처리**
청구서 생성, 포인트 만료, 구독 갱신 등 기간 마감 시 일괄 처리해야 하는 업무가 해당한다.

---

## 배치의 핵심 요구사항

**안정성 (Reliability) — 실패 시 재시작**
1000만 건 처리 중 700만 건에서 실패했을 때, 처음부터 다시 실행하면 안 된다. 실패 지점부터 이어서 재시작할 수 있어야 한다.

**추적 가능성 (Traceability) — 이력 저장**
언제, 어떤 파라미터로, 몇 건을 처리했고, 몇 건이 실패했는지 모든 실행 이력이 남아야 한다. 감사(audit)와 장애 대응에 필수다.

**대용량 처리 (Scalability)**
메모리에 모든 데이터를 올리지 않고, 일정량씩 읽어서 처리하는 스트리밍 방식이 필요하다. JVM 힙이 아닌 DB 커서나 페이징으로 데이터를 순차 처리한다.

---

## Spring Batch가 해결하는 문제

직접 배치를 구현하면 반드시 마주치는 문제들이 있다.

```
직접 구현 시 고민해야 하는 것들:
- 실행 이력을 어떻게 저장할까? (DB 테이블 직접 설계)
- 실패 지점을 어떻게 기억할까? (오프셋/커서 관리)
- 청크 단위 트랜잭션은 어떻게 묶을까? (직접 TransactionTemplate 사용)
- 특정 예외는 건너뛰고 나머지는 처리하려면? (try-catch 범벅)
- 동일 작업 재실행 방지는 어떻게? (상태 테이블 직접 관리)
```

Spring Batch는 이 모든 문제를 프레임워크 레벨에서 해결한다.

| 문제 | Spring Batch 해결책 |
|------|-------------------|
| 실행 이력 저장 | JobRepository + 메타데이터 테이블 자동 관리 |
| 재시작 지점 관리 | ExecutionContext에 오프셋 자동 저장/복원 |
| 청크 트랜잭션 | ChunkOrientedTasklet + PlatformTransactionManager |
| Skip / Retry | `.faultTolerant().skip().retry()` 선언적 설정 |
| 재실행 방지 | JobInstance + JobParameters 기반 중복 실행 방지 |
| 흐름 제어 | Step Flow (on/to/end/fail/stopAndRestart) |

---

## Spring Batch vs Quartz vs @Scheduled 역할 구분

세 가지는 서로 경쟁하는 기술이 아니라 **레이어가 다른 도구**다.

| 구분 | 역할 | 특징 |
|------|------|------|
| `@Scheduled` | 트리거 (언제 실행할지) | 단순 주기 실행, 클러스터 중복 실행 위험 |
| Quartz | 트리거 + 스케줄 관리 | JDBC JobStore로 클러스터 중복 실행 방지 |
| Spring Batch | 배치 작업 실행 엔진 | 청크 처리, 재시작, 이력 관리 등 배치 로직 전담 |

실무에서는 `Quartz → Spring Batch Job 호출` 또는 `@Scheduled → JobLauncher.run()` 형태로 조합해서 사용한다.

```java
// 전형적인 조합 패턴
@Scheduled(cron = "0 0 2 * * *")
public void runBatchJob() throws Exception {
    JobParameters params = new JobParametersBuilder()
        .addLocalDate("targetDate", LocalDate.now())
        .toJobParameters();
    jobLauncher.run(settlementJob, params);
}
```

---

## Spring Batch 5.x (Spring Boot 3.x) 기준

이 시리즈는 **Spring Batch 5.x / Spring Boot 3.x** 기준으로 작성되었다. 주요 전제 조건은 다음과 같다.

- Java 17 이상
- Jakarta EE 10 (`javax.*` → `jakarta.*`)
- `JobBuilderFactory` / `StepBuilderFactory` 제거됨 → `JobBuilder` / `StepBuilder` 직접 사용
- `ItemWriter.write(List)` → `ItemWriter.write(Chunk<? extends T>)` 시그니처 변경
- `@EnableBatchProcessing` 동작 방식 변경

---

## 핵심 아키텍처 도메인 모델

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                          │
│                                                             │
│   ┌──────────────┐    run()    ┌──────────────────────┐    │
│   │ JobLauncher  │────────────▶│        Job           │    │
│   └──────────────┘             │                      │    │
│          │                     │  ┌──────────────┐    │    │
│          │                     │  │    Step 1    │    │    │
│          │                     │  │ ┌──────────┐ │    │    │
│          │                     │  │ │ItemReader│ │    │    │
│          │                     │  │ └────┬─────┘ │    │    │
│          │                     │  │      ▼       │    │    │
│          │                     │  │ ┌──────────┐ │    │    │
│          │                     │  │ │ItemProc  │ │    │    │
│          │                     │  │ └────┬─────┘ │    │    │
│          │                     │  │      ▼       │    │    │
│          │                     │  │ ┌──────────┐ │    │    │
│          │                     │  │ │ItemWriter│ │    │    │
│          │                     │  │ └──────────┘ │    │    │
│          │                     │  └──────────────┘    │    │
│          │                     │                      │    │
│          │                     │  ┌──────────────┐    │    │
│          │                     │  │    Step 2    │    │    │
│          │                     │  └──────────────┘    │    │
│          │                     └──────────────────────┘    │
│          │                              │                   │
│          │         ┌────────────────────┘                  │
│          ▼         ▼                                       │
│   ┌──────────────────────┐                                 │
│   │    JobRepository     │  ← 모든 실행 이력 영속화          │
│   └──────────────────────┘                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Job / JobInstance / JobExecution / JobParameters 관계

### Job
배치 작업의 설계도(명세). `@Configuration`에 `@Bean`으로 등록한 불변 객체다.

### JobInstance
`Job 이름 + JobParameters`의 조합으로 식별되는 논리적 실행 단위다. 예를 들어 `settlementJob`을 `targetDate=2026-03-27` 파라미터로 실행하면 하나의 `JobInstance`가 생성된다. 같은 파라미터로 다시 실행을 시도하면 이미 완료된 `JobInstance`가 존재하므로 `JobInstanceAlreadyCompleteException`이 발생한다.

### JobExecution
`JobInstance`의 실제 실행 시도 기록이다. 한 `JobInstance`는 여러 `JobExecution`을 가질 수 있다(첫 실행 실패 → 재시작 = 2개의 `JobExecution`). 시작 시각, 종료 시각, 상태(`BatchStatus`), 종료 코드(`ExitStatus`) 등을 포함한다.

### JobParameters
Job 실행 시 전달하는 파라미터다. `JobInstance`를 식별하는 기준이 되며, 타입은 `String`, `Long`, `Double`, `LocalDate`(5.x부터)를 지원한다.

```
Job (설계도)
 └── JobInstance (Job + JobParameters의 조합, 논리적 단위)
      ├── JobExecution (1번째 실행 시도 → FAILED)
      └── JobExecution (2번째 실행 시도 → COMPLETED)
```

```java
// JobParameters 생성 예시
JobParameters params = new JobParametersBuilder()
    .addString("filePath", "/data/orders_20260327.csv")   // identifying
    .addLocalDate("targetDate", LocalDate.of(2026, 3, 27)) // identifying
    .addLong("timestamp", System.currentTimeMillis(), false) // non-identifying
    .toJobParameters();
```

`identifying=false`로 지정한 파라미터는 `JobInstance` 식별에 사용되지 않는다. 매번 새 `JobInstance`를 만들고 싶을 때 타임스탬프를 non-identifying으로 추가하는 패턴도 있지만, `JobParametersIncrementer`를 사용하는 것이 더 적절하다.

---

## Step / StepExecution / ExecutionContext 관계

### Step
Job을 구성하는 독립적인 처리 단위다. 각 Step은 자신의 `ItemReader`, `ItemProcessor`, `ItemWriter`를 가진다(청크 기반의 경우).

### StepExecution
Step의 실제 실행 기록이다. `JobExecution`에 속하며, 읽기 건수(`readCount`), 쓰기 건수(`writeCount`), 스킵 건수(`skipCount`) 등을 추적한다.

### ExecutionContext
Key-Value 형태의 데이터 저장소로 재시작 시 상태 복원에 사용된다. **Step 수준**과 **Job 수준** 두 가지가 있다.

```
JobExecution
 ├── ExecutionContext (Job 수준 — 모든 Step에서 공유)
 └── StepExecution (Step별 실행 기록)
      ├── ExecutionContext (Step 수준 — 해당 Step 내에서만)
      ├── readCount
      ├── writeCount
      ├── skipCount
      └── BatchStatus / ExitStatus
```

```java
// StepExecutionListener에서 ExecutionContext 활용
@Override
public void beforeStep(StepExecution stepExecution) {
    ExecutionContext stepContext = stepExecution.getExecutionContext();
    ExecutionContext jobContext = stepExecution.getJobExecution().getExecutionContext();

    // Step 수준 저장
    stepContext.putString("startTime", LocalDateTime.now().toString());

    // Job 수준 저장 (다른 Step에서 읽기 가능)
    jobContext.putLong("totalCount", 0L);
}
```

---

## 메타데이터 테이블 6개

Spring Batch는 실행 이력을 DB에 자동으로 저장한다. 테이블 6개가 사용된다.

| 테이블명 | 설명 |
|---------|------|
| `BATCH_JOB_INSTANCE` | Job 인스턴스 정보 (Job 이름 + 파라미터 해시) |
| `BATCH_JOB_EXECUTION` | Job 실행 기록 (상태, 시작/종료 시각) |
| `BATCH_JOB_EXECUTION_PARAMS` | Job 실행 시 사용된 파라미터 |
| `BATCH_JOB_EXECUTION_CONTEXT` | Job 수준 ExecutionContext 직렬화 저장 |
| `BATCH_STEP_EXECUTION` | Step 실행 기록 (읽기/쓰기/스킵 건수 등) |
| `BATCH_STEP_EXECUTION_CONTEXT` | Step 수준 ExecutionContext 직렬화 저장 |

```yaml
# application.yml
spring:
  batch:
    jdbc:
      initialize-schema: always   # 개발 환경
      # initialize-schema: never  # 운영 환경 (스키마 수동 관리)
    job:
      enabled: false              # 애플리케이션 시작 시 자동 실행 방지
```

> **실무 팁**: 운영 DB와 배치 메타데이터 DB를 분리하는 것을 권장한다. 메타데이터가 쌓이면 운영 DB에 부담이 생기고, 인덱스나 Lock 이슈가 발생할 수 있다. 별도의 경량 DB(예: 전용 MySQL 인스턴스)를 사용하거나, `spring.batch.jdbc.initialize-schema=never`로 설정 후 별도 DataSource를 `@BatchDataSource`로 지정한다.

---

## Spring Batch 5.x 프로젝트 설정

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-batch</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
</dependency>
```

```java
@SpringBootApplication
public class BatchApplication {
    public static void main(String[] args) {
        SpringApplication.run(BatchApplication.class, args);
    }
}
```

Spring Boot 3.x에서는 `@EnableBatchProcessing`을 명시하지 않아도 자동 구성이 동작한다. 커스텀이 필요한 경우 `DefaultBatchConfiguration`을 상속해서 오버라이드한다.

```java
// 커스텀이 필요한 경우
@Configuration
public class BatchConfig extends DefaultBatchConfiguration {

    @Override
    protected DataSource getDataSource() {
        return batchDataSource(); // 별도 DataSource 지정
    }
}
```
