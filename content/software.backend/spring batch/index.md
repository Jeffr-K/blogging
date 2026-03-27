# Spring Batch 완전 학습 인덱스

---

## 1. 개요 & 배경

### 배치 처리란?
- 배치(Batch) vs 실시간(Real-time) 처리 비교
- 배치가 필요한 대표적인 상황
  - 대용량 데이터 정산 / 집계
  - 주기적인 리포트 생성
  - 외부 시스템 데이터 동기화
  - 야간 마감 처리 / 월말 정산
- 배치 처리의 핵심 요구사항 — 안정성, 재시작 가능성, 추적 가능성

### Spring Batch란?
- Spring Batch가 해결하는 문제 (직접 구현 대비)
- JSR-352 (Batch Applications for Java EE) 표준과의 관계
- Spring Batch 5.x 주요 변화 (Spring Boot 3.x 기반)
- Spring Batch vs Quartz vs Spring Scheduler 역할 구분

### 핵심 아키텍처 미리보기
- `Job` → `Step` → `ItemReader` → `ItemProcessor` → `ItemWriter` 흐름
- `JobRepository` — 모든 메타데이터의 저장소
- `JobLauncher` — Job 실행 진입점

---

## 2. 아키텍처 & 도메인 모델

### Job
- `Job` — 배치 작업의 최상위 단위
- `JobInstance` — Job + JobParameters의 실행 단위
- `JobExecution` — JobInstance의 실제 실행 기록 (시도마다 생성)
- `JobParameters` — Job 실행 시 전달되는 파라미터 (식별자 역할)
  - `String`, `Long`, `Double`, `Date` 타입
  - identifying vs non-identifying 파라미터

### Step
- `Step` — Job을 구성하는 독립적인 처리 단위
- `StepExecution` — Step의 실제 실행 기록
- `ExecutionContext` — Step/Job 간 데이터 공유 저장소 (직렬화 주의)
- Chunk-oriented Step vs Tasklet Step

### JobRepository & 메타데이터 테이블
- `JobRepository`의 역할 — 실행 이력 영속화
- 메타데이터 테이블 구조
  - `BATCH_JOB_INSTANCE`
  - `BATCH_JOB_EXECUTION`
  - `BATCH_JOB_EXECUTION_PARAMS`
  - `BATCH_JOB_EXECUTION_CONTEXT`
  - `BATCH_STEP_EXECUTION`
  - `BATCH_STEP_EXECUTION_CONTEXT`
- 스키마 초기화 설정 (`spring.batch.jdbc.initialize-schema`)
- 메타데이터 DB를 운영 DB와 분리하는 패턴

### JobLauncher
- `JobLauncher.run(Job, JobParameters)`
- 동기(Synchronous) vs 비동기(Asynchronous) 실행
- `TaskExecutorJobLauncher`

---

## 3. Job 구성

### Job 정의 방식 (Spring Batch 5.x)
- `JobBuilder` / `JobBuilderFactory` (deprecated in 5.x)
- `new JobBuilder("jobName", jobRepository)` — 5.x 방식
- `@Configuration` 클래스에서 `@Bean`으로 등록

### Job 실행 조건
- `JobParameters`로 동일 Job의 재실행 구분
  - 같은 JobParameters → 이미 완료된 JobInstance 재실행 불가 (`JobInstanceAlreadyCompleteException`)
  - 타임스탬프 파라미터 추가로 매번 새 인스턴스 생성 패턴
- `JobParametersIncrementer` — 파라미터 자동 증가
  - `RunIdIncrementer` (기본 제공)
  - 커스텀 Incrementer 구현

### Job 흐름 제어
- 순차 실행: `start(step1).next(step2).next(step3)`
- 조건부 흐름: `on("FAILED").to(failStep).on("*").to(nextStep)`
- `BatchStatus` vs `ExitStatus` 차이
  - `BatchStatus` — 프레임워크 내부 상태 (COMPLETED, FAILED, STOPPED 등)
  - `ExitStatus` — 흐름 제어용 문자열 상태 (커스텀 가능)
- `end()` vs `fail()` vs `stopAndRestart()`

### Job 리스너
- `JobExecutionListener` — beforeJob / afterJob
- `@BeforeJob` / `@AfterJob` 어노테이션 방식
- 슬랙 알림, 로그 기록 등 횡단 관심사 처리 패턴

---

## 4. Step — Chunk 지향 처리

### Chunk 처리란?
- 데이터를 N개씩 묶어서 읽기 → 처리 → 쓰기 반복
- `commit-interval` (chunk size) — 한 트랜잭션에서 처리할 아이템 수
- 청크 처리 트랜잭션 경계
  - 읽기 실패: 현재 청크 롤백
  - 쓰기 실패: 현재 청크 롤백
  - `ItemReader`는 롤백 안 되는 경우 (상태 주의)

### StepBuilder (Spring Batch 5.x)
- `new StepBuilder("stepName", jobRepository)`
- `.<InputType, OutputType>chunk(chunkSize, transactionManager)`
- `.reader()`, `.processor()`, `.writer()`
- `.faultTolerant()` — 내결함성 설정 진입

### Step 리스너
- `StepExecutionListener` — beforeStep / afterStep
- `ItemReadListener` — beforeRead / afterRead / onReadError
- `ItemProcessListener` — beforeProcess / afterProcess / onProcessError
- `ItemWriteListener` — beforeWrite / afterWrite / onWriteError
- `ChunkListener` — beforeChunk / afterChunk / afterChunkError

---

## 5. Step — Tasklet 처리

### Tasklet이란?
- 단순 작업 단위 — `execute()` 한 번 호출
- `RepeatStatus.FINISHED` vs `RepeatStatus.CONTINUABLE`
- 트랜잭션 적용 범위 (Tasklet 전체가 하나의 트랜잭션)

### 활용 사례
- 파일 이동 / 삭제 / 압축
- DB 테이블 초기화 / 임시 데이터 정리
- 외부 API 단순 호출
- 집계 결과 알림 발송

### 커스텀 Tasklet 구현
- `Tasklet` 인터페이스 구현
- `StepContribution`, `ChunkContext` 활용
- `ExecutionContext`를 통한 상태 저장

---

## 6. ItemReader

### 기본 개념
- `ItemReader<T>` — `read()` 반환 null이면 입력 끝
- Thread-safety 주의 (대부분의 기본 구현체는 Non Thread-safe)
- `ItemStreamReader` — `open()`, `update()`, `close()` 생명주기

### 파일 기반 Reader
- `FlatFileItemReader` — CSV, 구분자 기반 파일
  - `DelimitedLineTokenizer` — 구분자 기반
  - `FixedLengthTokenizer` — 고정 길이
  - `DefaultLineMapper` + `BeanWrapperFieldSetMapper`
  - 인코딩 설정, 건너뛸 라인 수(`linesToSkip`)
- `JsonItemReader` — JSON 배열 파일
  - `JacksonJsonObjectReader`
- `MultiResourceItemReader` — 여러 파일을 순서대로 처리

### DB 기반 Reader
- `JdbcCursorItemReader` — DB 커서 방식 (단일 커넥션, 빠름)
  - `RowMapper` 설정
  - `fetchSize` — 네트워크 왕복 최소화
- `JdbcPagingItemReader` — 페이징 방식 (커넥션 반환 후 재조회)
  - `PagingQueryProvider` — DB별 페이징 쿼리 생성
  - `SqlPagingQueryProviderFactoryBean`
  - 정렬 키(`sortKeys`) 필수 — 중복 방지
- `JpaCursorItemReader` (Spring Batch 4.3+) — JPA 커서
- `JpaPagingItemReader` — JPA 페이징
- **커서 vs 페이징 선택 기준**
  - 커서: 빠르지만 커넥션 오래 점유, Thread-safe 아님
  - 페이징: 약간 느리지만 병렬 처리 가능

### 커스텀 Reader
- `ItemReader<T>` 직접 구현
- `ItemStreamReader` 구현 — 재시작 지원을 위한 상태 저장
- API 기반 Reader, 메시지 큐 기반 Reader 패턴

---

## 7. ItemProcessor

### 기본 개념
- `ItemProcessor<I, O>` — `process()` null 반환 시 해당 아이템 필터링
- Reader 타입과 Writer 타입이 다를 때 변환 역할
- 비즈니스 검증 / 변환 / 필터링 로직 위치

### 활용 패턴
- 도메인 객체 → DTO 변환
- 조건에 맞지 않는 아이템 null 반환으로 필터링
- 외부 API / DB 조회로 데이터 보강 (Enrichment)
- 유효성 검사 + `SkipPolicy`와 조합

### CompositeItemProcessor
- 여러 Processor를 체인으로 연결
- `setDelegates(List<ItemProcessor>)` 설정
- 단계별 변환이 필요한 복잡한 처리

### ValidatingItemProcessor
- `Validator<T>` 연동
- JSR-303 (`@Valid`) 통합
- 검증 실패 시 skip 또는 예외

---

## 8. ItemWriter

### 기본 개념
- `ItemWriter<T>` — `write(Chunk<? extends T> chunk)` (Spring Batch 5.x)
- 청크 단위로 묶어서 한 번에 쓰기

### 파일 기반 Writer
- `FlatFileItemWriter` — CSV, 구분자 파일 쓰기
  - `BeanWrapperFieldExtractor`
  - `DelimitedLineAggregator`
  - `shouldDeleteIfExists` / `appendAllowed`
- `JsonFileItemWriter` — JSON 파일 쓰기
- `MultiResourceItemWriter` — 일정 아이템 수마다 새 파일 생성

### DB 기반 Writer
- `JdbcBatchItemWriter` — JDBC Batch INSERT/UPDATE (성능 최고)
  - `sql` + `beanMapped()` / `columnMapped()`
  - `assertUpdates` — 업데이트 건수 검증
- `JpaItemWriter` — JPA `merge()` 기반
  - 배치 INSERT 성능 주의 (`IDENTITY` 전략 문제)
- `HibernateItemWriter`

### 커스텀 Writer
- `ItemWriter<T>` 직접 구현
- 외부 API 호출, 메시지 발행, 이메일 발송 등

### CompositeItemWriter
- 여러 Writer에 동시에 쓰기
- 트랜잭션 공유 주의사항

### ClassifierCompositeItemWriter
- 아이템 타입/조건에 따라 다른 Writer로 분기
- `Classifier<T, ItemWriter<? super T>>` 구현

---

## 9. 내결함성 (Fault Tolerance)

### Skip
- 처리 중 특정 예외 발생 시 해당 아이템 건너뜀
- `.faultTolerant().skip(SomeException.class).skipLimit(10)`
- `SkipPolicy` — 커스텀 스킵 정책 구현
- Read / Process / Write 단계별 스킵 동작 차이
  - Write 스킵: 청크를 아이템 단위로 재처리 (binary search 방식)
- `SkipListener` — 스킵된 아이템 기록

### Retry
- 처리 실패 시 지정 횟수만큼 재시도
- `.faultTolerant().retry(SomeException.class).retryLimit(3)`
- `RetryPolicy` / `BackOffPolicy` — 커스텀 재시도 정책
- `RetryListener` — 재시도 이벤트 처리
- Skip + Retry 조합 시 동작 순서

### noSkip / noRetry
- 특정 예외는 절대 스킵/재시도 하지 않도록 설정
- 치명적 예외 보호 (`FatalStepExecutionException`)

---

## 10. 재시작 (Restart)

### 재시작 기본 원리
- 실패한 `JobInstance`를 동일 `JobParameters`로 재실행
- `StepExecution`의 마지막 성공 상태부터 재개
- `ExecutionContext`에 저장된 커서/오프셋으로 재개 위치 복원

### ItemStream과 재시작
- `ItemStreamReader` — `update(ExecutionContext)`로 진행 상태 저장
- `ItemStreamWriter` — 파일 append 모드 재시작
- 기본 제공 Reader들은 대부분 재시작 지원

### 재시작 불가 설정
- `preventRestart()` — Job 재시작 금지 (매번 새로 실행)
- `startLimit(n)` — Step 최대 실행 횟수 제한

### 재시작 시나리오별 처리
- 부분 성공 후 실패: 성공한 청크는 건너뜀
- Step 중간 실패: 해당 Step부터 재시작
- 이미 완료된 Step 재실행: `allowStartIfComplete(true)`

---

## 11. 병렬 처리

### Multi-threaded Step
- `TaskExecutor`를 Step에 적용 → 청크 단위 병렬 처리
- Thread-safe ItemReader 필수 (`SynchronizedItemStreamReader`로 래핑)
- `throttleLimit` — 동시 실행 스레드 수 제한 (deprecated in 5.x, TaskExecutor 직접 제어)
- 재시작 지원 제한 (커서 위치 공유 불가)

### Parallel Steps (Split Flow)
- 여러 Step을 동시에 실행 (`split(taskExecutor).add(flow1, flow2)`)
- 독립적인 Step들을 병렬로 처리
- 모든 병렬 Step 완료 후 다음 Step 진행

### Partitioning (파티셔닝)
- 데이터를 파티션으로 분할 → 각 파티션을 Worker Step에서 병렬 처리
- `Partitioner` — 파티션 정의 (`ExecutionContext` 맵 반환)
- `PartitionHandler` — Worker 실행 방식 결정
  - `TaskExecutorPartitionHandler` — 로컬 멀티스레드
  - `MessageChannelPartitionHandler` — 원격 Worker (Spring Integration)
- 범위 기반 파티셔닝 (`ColumnRangePartitioner` 패턴)
- **대용량 처리에 가장 효과적인 방법**

### Remote Chunking
- Manager가 데이터를 읽어 Worker에 전달 → Worker가 처리/쓰기
- Spring Integration / Kafka / RabbitMQ 기반 통신
- 네트워크 부하 주의 (I/O 병목 시 비효율)

---

## 12. JobParameters & 실행 관리

### JobParameters 활용
- 실행 날짜, 파일 경로, 처리 대상 범위 등 외부 주입
- `@Value("#{jobParameters['targetDate']}")` — SpEL로 주입
- `@StepScope` / `@JobScope` — 런타임 바인딩을 위한 필수 설정
  - Step/Job 빌드 시점이 아닌 실행 시점에 Bean 생성
  - Lazy Proxy 원리

### @JobScope vs @StepScope
- `@JobScope` — Job 실행 시 생성, Job 종료 시 소멸
- `@StepScope` — Step 실행 시 생성, Step 종료 시 소멸
- Late Binding (지연 바인딩) 패턴

### Job 실행 방식
- `CommandLineJobRunner` — CLI 실행
- `JobLauncherApplicationRunner` — Spring Boot 자동 실행
  - `spring.batch.job.enabled=false` — 자동 실행 비활성화
  - `spring.batch.job.name` — 실행할 Job 지정
- 프로그래밍 방식 `JobLauncher.run()` — API 트리거

---

## 13. 스케줄링 연동

### Spring Scheduler
- `@Scheduled(cron = "0 0 2 * * *")` — 새벽 2시 실행
- `@EnableScheduling`
- Scheduler + JobLauncher 조합 패턴
- 클러스터 환경에서의 중복 실행 문제

### Quartz 연동
- `QuartzJobBean` + `JobLauncher`
- `JobDetailFactoryBean` / `CronTriggerFactoryBean`
- Quartz 클러스터링 — JDBC JobStore로 중복 실행 방지
- DB 기반 잠금으로 단일 실행 보장

### ShedLock
- 분산 환경에서 스케줄 중복 실행 방지
- `@SchedulerLock(name = "jobName")`
- DB / Redis 기반 락

---

## 14. 모니터링 & 운영

### Spring Batch Admin / Spring Cloud Data Flow
- Spring Batch Admin (deprecated) 대안
- Spring Cloud Data Flow — 배치/스트림 통합 관리
- Kubernetes 기반 배포 시 고려사항

### Actuator 연동
- `/actuator/health` — 배치 헬스 체크
- 메타데이터 테이블 기반 모니터링

### 메트릭 (Micrometer)
- `spring.batch.metrics.enabled=true` (Spring Batch 5.x)
- Job/Step 실행 시간, 읽기/처리/쓰기 카운트
- Prometheus + Grafana 대시보드 구성

### 로깅 & 추적
- `JobExecution` / `StepExecution` 상태 조회 SQL
- 배치 실행 이력 조회 API 패턴
- 실패 원인 파악 — `exitDescription` 필드
- MDC 기반 Job/Step 컨텍스트 로그

### 운영 이슈 대응
- 장시간 실행 배치 모니터링
- 배치 강제 종료 후 재시작 절차
- 메타데이터 테이블 정기 정리 (`JobExplorer` + `JobOperator`)
- `JobOperator.stop()` — 실행 중인 Job 중지

---

## 15. 테스트

### 단위 테스트
- `ItemReader` / `ItemProcessor` / `ItemWriter` 단독 테스트
- Mockito 활용 의존성 Mock 처리
- `StepScopeTestUtils` — `@StepScope` Bean 테스트

### 통합 테스트
- `@SpringBatchTest` (Spring Batch 4.1+)
  - `JobLauncherTestUtils` — Job/Step 실행
  - `JobRepositoryTestUtils` — 실행 이력 정리
  - `StepScopeTestExecutionListener`
- `@SpringBootTest` + `@SpringBatchTest` 조합
- `jobLauncherTestUtils.launchJob(jobParameters)` — Job 전체 테스트
- `jobLauncherTestUtils.launchStep("stepName")` — Step 단독 테스트

### 테스트 DB 설정
- H2 인메모리 DB — 빠른 단위 테스트
- Testcontainers — 실제 DB 환경 통합 테스트
- 메타데이터 테이블 자동 초기화 설정

### 청크 테스트 패턴
- `JobRepositoryTestUtils.removeJobExecutions()` — 테스트 간 격리
- `AssertFile` — 출력 파일 내용 검증
- 아이템 카운트, 스킵 카운트 검증

---

## 16. 실무 패턴 & 베스트 프랙티스

### 대용량 처리 설계
- `JdbcCursorItemReader` vs `JdbcPagingItemReader` 선택
- 적절한 chunk size 설정 (일반적으로 100~1000, 측정 기반)
- 파티셔닝으로 병렬화 — CPU / IO 바운드 구분
- DB 인덱스 최적화 (Reader 쿼리 기준)

### 멱등성 (Idempotency) 확보
- 배치는 언제든 재실행 가능해야 함
- UPSERT 패턴 (`INSERT ON DUPLICATE KEY UPDATE`)
- 처리 완료 플래그 컬럼 활용
- 중복 처리 방지 로직

### 배치 실패 알림
- `JobExecutionListener.afterJob()`에서 FAILED 상태 감지
- 슬랙, 이메일, PagerDuty 알림 패턴
- 실패 원인 `exitDescription` 파싱

### Job 분리 전략
- 하나의 Job은 하나의 책임
- 공통 Step 재사용 패턴
- Job Flow 복잡도 제한 (Step 수 기준)
- 배치 서버 분리 vs 애플리케이션 내장

### 안티패턴
- Step 안에서 또 다른 Service 트랜잭션 남발 — 트랜잭션 경계 혼란
- `JpaItemWriter` + `IDENTITY` 전략 — 배치 INSERT 불가 (SEQUENCE 또는 `JdbcBatchItemWriter` 사용)
- chunk size = 1 — 트랜잭션 오버헤드
- 메타데이터 테이블 무한 누적 — 정기 정리 필수
- `@StepScope` 없이 JobParameters SpEL 바인딩 — NPE 또는 잘못된 값

---

## 17. Spring Batch 5.x 변경사항

### Spring Boot 3.x / Spring Batch 5.x 주요 변화
- Java 17 최소 요구사항
- Jakarta EE 10 (`javax` → `jakarta`)
- `JobBuilderFactory` / `StepBuilderFactory` 제거 → `JobBuilder` / `StepBuilder` 직접 사용
- `ItemWriter.write(List)` → `ItemWriter.write(Chunk)` 시그니처 변경
- `JobParameters` 타입 변경 (날짜 타입 제거, `LocalDate`/`LocalDateTime` 지원 추가)
- `@EnableBatchProcessing` 자동 구성 변경 — `DefaultBatchConfiguration` 상속 방식

### 마이그레이션 포인트
- `JobBuilderFactory` → `JobBuilder(name, jobRepository)`
- `StepBuilderFactory` → `StepBuilder(name, jobRepository)`
- `write(List<? extends T>)` → `write(Chunk<? extends T>)`
- `spring.batch.job.names` → `spring.batch.job.name` (단수 변경)
- 메타데이터 스키마 변경 여부 확인
