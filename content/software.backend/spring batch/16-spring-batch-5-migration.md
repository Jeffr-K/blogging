---
title: "Spring Batch 5.x 완전 마이그레이션 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-batch", "migration", "spring-batch-5", "spring-boot-3"]
---

## 개요

Spring Batch 5.x는 Spring Boot 3.x와 함께 출시된 메이저 버전 업그레이드다. Java 17, Jakarta EE 10, Spring Framework 6.x로의 전환이 핵심이다. 단순 버전 업그레이드가 아니라 API 시그니처가 상당히 변경되었으므로, 마이그레이션 시 체계적인 접근이 필요하다.

---

## Spring Batch 5.x 핵심 변경사항

### 최소 요구사항

| 항목 | Spring Batch 4.x | Spring Batch 5.x |
|------|----------------|----------------|
| Java | Java 8 이상 | **Java 17 이상** |
| Spring Framework | 5.x | **6.x** |
| Spring Boot | 2.x | **3.x** |
| Jakarta EE | `javax.*` | **`jakarta.*`** |
| 데이터베이스 | 대부분 지원 | MariaDB 10.3+, MySQL 5.7+, PostgreSQL 9.6+ |

### Jakarta EE 10 마이그레이션

`javax.batch.*` 패키지가 `jakarta.batch.*`로 변경된다. 이는 JDK/JEE 진영의 네임스페이스 변경이며, 코드 전반에 걸쳐 import 문을 수정해야 한다.

```java
// 4.x
import javax.sql.DataSource;
import javax.annotation.PostConstruct;

// 5.x
import javax.sql.DataSource;      // java.sql은 그대로 (JDK 표준)
import jakarta.annotation.PostConstruct;  // jakarta로 변경
```

---

## API 변경사항 (코드 전후 비교)

### 1. JobBuilderFactory / StepBuilderFactory 제거

가장 많은 코드를 수정해야 하는 변경점이다. 두 팩토리 클래스가 완전히 제거되어 직접 `JobBuilder`와 `StepBuilder`를 생성해야 한다.

```java
// ===== 4.x (제거됨) =====
@Configuration
public class OldJobConfig {

    @Autowired
    private JobBuilderFactory jobBuilderFactory;  // 제거됨

    @Autowired
    private StepBuilderFactory stepBuilderFactory;  // 제거됨

    @Bean
    public Job myJob(Step myStep) {
        return jobBuilderFactory.get("myJob")
            .start(myStep)
            .build();
    }

    @Bean
    public Step myStep(ItemReader<Order> reader, ItemWriter<Order> writer) {
        return stepBuilderFactory.get("myStep")
            .<Order, Order>chunk(100)
            .reader(reader)
            .writer(writer)
            .build();
    }
}

// ===== 5.x (새 방식) =====
@Configuration
@RequiredArgsConstructor
public class NewJobConfig {

    private final JobRepository jobRepository;            // 직접 주입
    private final PlatformTransactionManager transactionManager;  // 직접 주입

    @Bean
    public Job myJob(Step myStep) {
        return new JobBuilder("myJob", jobRepository)     // jobRepository 직접 전달
            .start(myStep)
            .build();
    }

    @Bean
    public Step myStep(ItemReader<Order> reader, ItemWriter<Order> writer) {
        return new StepBuilder("myStep", jobRepository)   // jobRepository 직접 전달
            .<Order, Order>chunk(100, transactionManager) // transactionManager 필수
            .reader(reader)
            .writer(writer)
            .build();
    }
}
```

### 2. ItemWriter write(List) → write(Chunk)

커스텀 `ItemWriter`를 구현한 경우 메서드 시그니처를 변경해야 한다.

```java
// ===== 4.x =====
public class OldCustomWriter implements ItemWriter<Order> {

    @Override
    public void write(List<? extends Order> items) throws Exception {
        for (Order item : items) {
            process(item);
        }
    }
}

// ===== 5.x =====
public class NewCustomWriter implements ItemWriter<Order> {

    @Override
    public void write(Chunk<? extends Order> chunk) throws Exception {
        // chunk.getItems()로 List<Order> 접근
        List<? extends Order> items = chunk.getItems();

        for (Order item : items) {
            process(item);
        }

        // Chunk는 추가 메타정보 제공
        log.info("처리 중 chunk - size={}, skipCount={}",
            chunk.size(), chunk.getSkips().size());
    }
}
```

**`Chunk` 클래스 주요 메서드:**

```java
chunk.getItems()        // 정상 처리 아이템 목록 (List<? extends T>)
chunk.getSkips()        // Skip된 아이템 목록
chunk.size()            // 아이템 수
chunk.isEmpty()         // 비어있는지 여부
```

### 3. JobParameters 타입 변경

`Date` 타입 지원이 제거되고 Java Time API(`LocalDate`, `LocalDateTime`, `LocalTime`)가 추가되었다.

```java
// ===== 4.x =====
JobParameters params = new JobParametersBuilder()
    .addDate("targetDate", new Date())           // Date 타입 지원
    .addLong("timestamp", System.currentTimeMillis())
    .addString("mode", "FULL")
    .toJobParameters();

// ===== 5.x =====
JobParameters params = new JobParametersBuilder()
    // Date 제거 → LocalDate/LocalDateTime/LocalTime 사용
    .addLocalDate("targetDate", LocalDate.now())
    .addLocalDateTime("startedAt", LocalDateTime.now())
    .addLocalTime("cutoffTime", LocalTime.of(2, 0))
    .addLong("timestamp", System.currentTimeMillis())
    .addString("mode", "FULL")
    .toJobParameters();

// ===== Step에서 파라미터 접근 =====
// 4.x
@Value("#{jobParameters['targetDate']}")
private Date targetDate;  // Date 타입

// 5.x
@Value("#{jobParameters['targetDate']}")
private LocalDate targetDate;  // LocalDate 타입으로 변경
```

**JobParameters를 외부에서 전달할 때 (CLI):**

```bash
# 4.x: Date는 ISO 8601 문자열
java -jar batch.jar targetDate(date)=2026-03-26

# 5.x: LocalDate 형식
java -jar batch.jar targetDate(localdate)=2026-03-26
java -jar batch.jar startedAt(localdatetime)=2026-03-26T02:00:00
```

### 4. @EnableBatchProcessing 변경

Spring Boot 3.x에서는 `@EnableBatchProcessing`을 명시적으로 사용하면 Spring Boot의 자동 구성과 **충돌**할 수 있다.

```java
// ===== 4.x =====
@SpringBootApplication
@EnableBatchProcessing  // Spring Boot 2.x에서는 관례적으로 사용
public class BatchApplication {
    public static void main(String[] args) {
        SpringApplication.run(BatchApplication.class, args);
    }
}

// ===== 5.x 권장 방식 (Spring Boot 3.x) =====
@SpringBootApplication
// @EnableBatchProcessing 제거! Spring Boot 자동 구성에 맡김
public class BatchApplication {
    public static void main(String[] args) {
        SpringApplication.run(BatchApplication.class, args);
    }
}
```

**`@EnableBatchProcessing`을 유지해야 하는 경우:**
Spring Boot 자동 구성을 사용하지 않고 커스텀 `JobRepository` 설정이 필요한 경우 `DefaultBatchConfiguration`을 상속한다.

```java
// ===== 5.x: DefaultBatchConfiguration 상속 방식 =====
@Configuration
public class CustomBatchConfig extends DefaultBatchConfiguration {

    @Autowired
    private DataSource batchDataSource;

    @Override
    protected DataSource getDataSource() {
        return batchDataSource;  // 배치 메타데이터 전용 DataSource
    }

    @Override
    protected PlatformTransactionManager getTransactionManager() {
        return new DataSourceTransactionManager(batchDataSource);
    }

    @Override
    protected String getTablePrefix() {
        return "BATCH_";  // 기본값이지만 커스터마이징 가능
    }
}
```

**spring.batch.job.enabled 설정:**

```yaml
spring:
  batch:
    job:
      enabled: false   # 앱 시작 시 자동 실행 방지 (권장)
      name: ""         # 5.x에서 단수형 (이전: names)
```

### 5. JobRepository 직접 주입

5.x에서는 `JobBuilder`와 `StepBuilder`에 `JobRepository`를 직접 전달해야 한다.

```java
// ===== 5.x: JobRepositoryFactoryBean 커스텀 설정 =====
@Configuration
public class BatchInfrastructureConfig {

    @Bean
    public JobRepository jobRepository(DataSource dataSource,
                                       PlatformTransactionManager txManager) throws Exception {
        JobRepositoryFactoryBean factory = new JobRepositoryFactoryBean();
        factory.setDataSource(dataSource);
        factory.setTransactionManager(txManager);
        factory.setDatabaseType("MYSQL");
        factory.setTablePrefix("BATCH_");
        factory.setIsolationLevelForCreate("ISOLATION_SERIALIZABLE");
        factory.afterPropertiesSet();
        return factory.getObject();
    }

    @Bean
    public JobLauncher jobLauncher(JobRepository jobRepository) throws Exception {
        TaskExecutorJobLauncher launcher = new TaskExecutorJobLauncher();
        launcher.setJobRepository(jobRepository);
        launcher.setTaskExecutor(new SimpleAsyncTaskExecutor());
        launcher.afterPropertiesSet();
        return launcher;
    }
}
```

### 6. 메타데이터 스키마 변경

Spring Batch 5.x에서 메타데이터 스키마가 일부 변경되었다.

```sql
-- 주요 변경: VARCHAR2 → VARCHAR 통일 (Oracle 호환성)
-- 4.x (Oracle)
JOB_NAME VARCHAR2(100)

-- 5.x (표준화)
JOB_NAME VARCHAR(100)

-- 새 컬럼 추가 (BATCH_JOB_EXECUTION)
CREATE_TIME DATETIME NOT NULL  -- Job 생성 시각 (start_time과 구분)
```

**마이그레이션 스크립트 실행 필수:** 기존 4.x 스키마에서 5.x로 업그레이드 시 공식 마이그레이션 SQL을 적용해야 한다.

```bash
# 공식 마이그레이션 스크립트 위치
spring-batch-core/src/main/resources/org/springframework/batch/core/migration/
├── 5.0/
│   ├── migration-mysql.sql
│   ├── migration-postgresql.sql
│   └── migration-oracle.sql
```

### 7. spring.batch.job.names → spring.batch.job.name (단수)

```yaml
# ===== 4.x =====
spring:
  batch:
    job:
      names: settlementJob  # 복수형 (여러 Job 쉼표 구분 가능)

# ===== 5.x =====
spring:
  batch:
    job:
      name: settlementJob  # 단수형 (하나의 Job만 지정)
```

---

## Spring Boot 3.x + Spring Batch 5.x 버전 호환표

| Spring Boot | Spring Batch | Java | Spring Framework |
|-------------|-------------|------|-----------------|
| 3.0.x | 5.0.x | 17+ | 6.0.x |
| 3.1.x | 5.1.x | 17+ | 6.0.x |
| 3.2.x | 5.2.x | 17+ | 6.1.x |
| 3.3.x | 5.3.x | 17+ | 6.1.x |
| 3.4.x | 5.4.x | 17+ | 6.2.x |

```groovy
// build.gradle (Spring Boot BOM 사용 시 버전 자동 관리)
plugins {
    id 'org.springframework.boot' version '3.4.3'
    id 'io.spring.dependency-management' version '1.1.7'
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-batch'
    // spring-batch 버전은 BOM이 자동 관리
}
```

---

## 단계별 마이그레이션 절차

### 1단계: 의존성 업그레이드

```groovy
// build.gradle 변경
plugins {
    id 'org.springframework.boot' version '3.4.3'  // 2.x → 3.x
    id 'io.spring.dependency-management' version '1.1.7'
    id 'java'
}

java {
    sourceCompatibility = JavaVersion.VERSION_17    // 8/11 → 17
}
```

### 2단계: javax → jakarta 패키지 변경

IDE의 "Find and Replace" 또는 OpenRewrite 마이그레이션 레시피를 사용한다.

```bash
# OpenRewrite를 사용한 자동 마이그레이션
./gradlew rewriteRun -Drewrite.activeRecipes=org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_4
```

주요 변경 패키지:
```
javax.annotation.* → jakarta.annotation.*
javax.validation.* → jakarta.validation.*
javax.persistence.* → jakarta.persistence.*
javax.transaction.* → jakarta.transaction.*
```

### 3단계: @EnableBatchProcessing 제거

Spring Boot 3.x 자동 구성에 맡기고 해당 어노테이션을 제거한다.

### 4단계: JobBuilderFactory/StepBuilderFactory 교체

```bash
# 프로젝트 전체에서 다음 패턴 검색
grep -r "JobBuilderFactory\|StepBuilderFactory" src/
```

모든 위치에서 다음 패턴으로 교체:

```java
// Before
@Autowired JobBuilderFactory jobBuilderFactory;
jobBuilderFactory.get("jobName").start(step).build()

// After
@Autowired JobRepository jobRepository;
new JobBuilder("jobName", jobRepository).start(step).build()
```

### 5단계: ItemWriter 시그니처 변경

```bash
# 커스텀 ItemWriter 구현체 검색
grep -r "implements ItemWriter" src/
grep -r "void write(List" src/
```

모든 `write(List<? extends T> items)` → `write(Chunk<? extends T> chunk)` 변경.

### 6단계: JobParameters 타입 변경

`Date` → `LocalDate`/`LocalDateTime` 변경 및 해당 `@Value` 어노테이션의 필드 타입 변경.

### 7단계: 메타데이터 DB 스키마 마이그레이션

```sql
-- MySQL 마이그레이션 (공식 스크립트 기반)
ALTER TABLE BATCH_JOB_EXECUTION
    ADD COLUMN CREATE_TIME DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- VARCHAR2를 사용하던 Oracle 환경
ALTER TABLE BATCH_JOB_INSTANCE
    MODIFY JOB_NAME VARCHAR(100);
```

### 8단계: spring.batch.job.names → spring.batch.job.name

`application.yml` 또는 `application.properties`에서 프로퍼티 키 변경.

---

## 자주 발생하는 컴파일 오류와 해결 방법

### 오류 1: Cannot find symbol JobBuilderFactory

```
error: cannot find symbol
    private JobBuilderFactory jobBuilderFactory;
```

**해결:** `JobBuilderFactory` 임포트 제거, `JobRepository` 직접 주입으로 교체.

### 오류 2: write(List) method not found

```
error: write(List<? extends Order>) is not applicable
    (argument mismatch; Chunk<Order> cannot be converted to List<Order>)
```

**해결:** 커스텀 `ItemWriter`의 `write` 메서드 시그니처를 `Chunk` 파라미터로 변경.

### 오류 3: No qualifying bean of type 'JobRepository'

```
No qualifying bean of type 'JobRepository' available:
expected at least 1 bean which qualifies as autowire candidate
```

**해결:** Spring Boot 자동 구성이 비활성화된 경우. `@EnableBatchProcessing`을 유지하면서 `DefaultBatchConfiguration`을 상속하거나, `@EnableBatchProcessing`을 완전히 제거하고 Spring Boot 자동 구성을 사용한다.

### 오류 4: addDate method not found

```
error: cannot find symbol
    .addDate("targetDate", new Date())
```

**해결:** `addDate` 메서드 제거됨. `addLocalDate`, `addLocalDateTime`, `addLocalTime` 중 적절한 것으로 교체.

### 오류 5: spring.batch.job.names deprecated

```
Deprecated configuration property 'spring.batch.job.names'
```

**해결:** `spring.batch.job.name` (단수)으로 변경. 5.x에서는 하나의 Job만 지정 가능.

### 오류 6: @EnableBatchProcessing과 자동 구성 충돌

```
The bean 'jobRepository' could not be registered.
A bean with that name has already been defined.
```

**해결:** `@EnableBatchProcessing`을 제거하고 Spring Boot 자동 구성에 맡기거나, `spring.batch.autoconfigure.enabled=false`로 자동 구성을 비활성화하고 수동 구성.

```yaml
# 수동 구성 선택 시
spring:
  batch:
    autoconfigure:
      enabled: false
```

---

## 마이그레이션 체크리스트

```
[ ] Java 17로 업그레이드 (빌드 툴, CI/CD 파이프라인 포함)
[ ] Spring Boot 3.x로 업그레이드
[ ] javax.* → jakarta.* 패키지 변경 (IDE 또는 OpenRewrite 사용)
[ ] @EnableBatchProcessing 제거 (Spring Boot 자동 구성 활용)
[ ] JobBuilderFactory → new JobBuilder(name, jobRepository) 교체
[ ] StepBuilderFactory → new StepBuilder(name, jobRepository) 교체
[ ] chunk(size) → chunk(size, transactionManager) 교체
[ ] ItemWriter.write(List) → write(Chunk) 시그니처 변경
[ ] Date 타입 JobParameter → LocalDate/LocalDateTime 변경
[ ] spring.batch.job.names → spring.batch.job.name 변경
[ ] 메타데이터 DB 마이그레이션 스크립트 적용
[ ] 통합 테스트로 Job 실행 검증
[ ] 기존 메타데이터 데이터 호환성 확인
```
