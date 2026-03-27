# Gradle 완전 학습 인덱스

---

## 1. 개요 & 배경

### 빌드 도구란?
- 빌드 도구가 필요한 이유 (컴파일, 의존성, 테스트, 패키징 자동화)
- Make → Ant → Maven → Gradle 발전 흐름
- Maven vs Gradle 비교
  - XML(선언형) vs Groovy/Kotlin DSL(프로그래밍)
  - Convention over Configuration
  - 빌드 속도 (증분 빌드, 빌드 캐시, 데몬)
- Gradle의 핵심 설계 원칙 — 유연성, 성능, 확장성

### Gradle 핵심 구성요소 미리보기
- `Project` — 빌드의 기본 단위
- `Task` — 빌드 작업의 최소 단위
- `Plugin` — 기능 묶음 (Java, Spring Boot 등)
- `Dependency` — 의존성 관리
- `Build Script` — `build.gradle` / `build.gradle.kts`

---

## 2. 설치 & 프로젝트 구조

### 설치
- SDKMAN으로 설치 (`sdk install gradle`)
- Homebrew (`brew install gradle`)
- 수동 설치 및 환경변수 설정
- `gradle --version` 확인

### Gradle Wrapper (실무 표준)
- Wrapper란? — 프로젝트에 Gradle 버전을 고정하는 방법
- `gradle wrapper` — Wrapper 파일 생성
- `gradlew` / `gradlew.bat` — OS별 실행 스크립트
- `gradle/wrapper/gradle-wrapper.properties` — 버전 관리
- Wrapper를 통한 CI/CD 일관성 확보
- Wrapper 버전 업그레이드 (`./gradlew wrapper --gradle-version 8.x`)

### 프로젝트 구조
```
project/
├── gradle/wrapper/           # Wrapper 파일
├── gradlew / gradlew.bat     # Wrapper 실행 스크립트
├── settings.gradle.kts       # 프로젝트 이름, 서브프로젝트 선언
├── build.gradle.kts          # 빌드 스크립트
├── gradle.properties         # 전역 속성
└── src/
    ├── main/java/
    ├── main/resources/
    ├── test/java/
    └── test/resources/
```
- `settings.gradle.kts` vs `build.gradle.kts` 역할 구분
- `gradle.properties` — JVM 옵션, 속성값 저장

### Groovy DSL vs Kotlin DSL
- Groovy DSL (`build.gradle`) — 유연하지만 IDE 지원 약함
- Kotlin DSL (`build.gradle.kts`) — 타입 안전, IDE 자동완성, 실무 권장
- 두 DSL 주요 문법 차이 비교

---

## 3. 빌드 스크립트 기초

### settings.gradle.kts
- `rootProject.name` — 프로젝트 이름 설정
- `include(":module-a", ":module-b")` — 서브프로젝트 등록
- `pluginManagement` 블록 — 플러그인 저장소/버전 중앙 관리
- `dependencyResolutionManagement` 블록 — 의존성 저장소 중앙 관리

### build.gradle.kts 구조
- `plugins {}` — 플러그인 적용
- `group`, `version` — 프로젝트 메타데이터
- `repositories {}` — 의존성 저장소
- `dependencies {}` — 의존성 선언
- `tasks {}` — 태스크 구성

### 빌드 생명주기 3단계
- **초기화 (Initialization)** — `settings.gradle.kts` 실행, 프로젝트 트리 구성
- **구성 (Configuration)** — 모든 `build.gradle.kts` 실행, Task 그래프 구성
  - 이 단계에서 모든 Task 코드가 실행됨 (Task Action은 아직 실행 안 됨)
- **실행 (Execution)** — 요청된 Task와 의존 Task 실행

---

## 4. Task

### Task 기본
- Task란? — 빌드의 최소 실행 단위 (컴파일, 복사, 테스트 등)
- `./gradlew tasks` — 사용 가능한 Task 목록 조회
- `./gradlew <taskName>` — Task 실행
- `./gradlew <taskName> --dry-run` — 실행 없이 Task 순서 확인

### 기본 제공 Task (Java Plugin 기준)
- `compileJava` / `compileTestJava`
- `processResources` / `processTestResources`
- `classes` / `testClasses`
- `test`
- `jar`
- `build` — 전체 빌드 (assemble + check)
- `clean` — 빌드 출력 디렉터리 삭제
- `assemble` — 아티팩트 생성
- `check` — 검증 (test 포함)

### 커스텀 Task 정의
```kotlin
// 간단한 Task 등록
tasks.register("hello") {
    doLast {
        println("Hello, Gradle!")
    }
}

// 타입이 있는 Task
tasks.register<Copy>("copyDocs") {
    from("docs")
    into(layout.buildDirectory.dir("docs"))
}
```
- `doFirst {}` vs `doLast {}` — Task Action 추가
- `dependsOn` — Task 의존성 선언
- `finalizedBy` — Task 완료 후 실행할 Task
- `mustRunAfter` / `shouldRunAfter` — 순서 힌트

### Task 타입
- `Copy` — 파일 복사
- `Delete` — 파일 삭제
- `Exec` — 외부 명령 실행
- `JavaExec` — Java 클래스 실행
- `Zip` / `Tar` — 압축
- `Test` — 테스트 실행
- 커스텀 Task 클래스 — `DefaultTask` 상속

### Task 입출력 (Incremental Build)
- `@InputFiles` / `@OutputFiles` / `@Input` / `@OutputDirectory`
- 입출력이 변경되지 않으면 Task UP-TO-DATE로 건너뜀
- `@TaskAction` — Task의 실제 작업 메서드

### Task 구성 vs 실행 구분
- 구성 단계에서 실행 단계 코드를 쓰면 안 되는 이유
- `doLast {}` / `doFirst {}` — 실행 단계에서 실행됨
- 람다 블록 내 코드 — 구성 단계에서 실행됨 (주의!)

---

## 5. 플러그인 (Plugin)

### 플러그인이란?
- Task, 설정, 컨벤션을 재사용 가능한 단위로 묶은 것
- 플러그인 적용 방법 — `plugins {}` 블록 (권장)

### 핵심 플러그인

#### Java 플러그인
- `id("java")` 적용
- 소스 셋 (SourceSets) — `main`, `test`
- 표준 디렉터리 레이아웃 적용
- `java { sourceCompatibility / targetCompatibility / toolchain }`

#### Java Library 플러그인
- `id("java-library")`
- `api` vs `implementation` 의존성 구성 차이
- ABI(Application Binary Interface) 개념

#### Kotlin 플러그인
- `id("org.jetbrains.kotlin.jvm")`
- `compileOptions`, `jvmToolchain` 설정
- Kotlin + Java 혼용 소스 컴파일 순서

#### Spring Boot 플러그인
- `id("org.springframework.boot")`
- `bootJar` Task — 실행 가능한 Fat JAR 생성
- `bootRun` Task — 로컬 실행
- `bootBuildImage` Task — OCI 이미지 생성
- `bootJar.enabled` / `jar.enabled` 설정

#### Spring Dependency Management 플러그인
- `id("io.spring.dependency-management")`
- BOM(Bill of Materials) 임포트
- `importBom()` vs `mavenBom()`

#### 기타 주요 플러그인
- `application` — 실행 가능한 JVM 애플리케이션
- `jacoco` — 코드 커버리지
- `checkstyle` / `pmd` / `spotbugs` — 정적 분석
- `maven-publish` — Maven 저장소 퍼블리시
- `signing` — 아티팩트 서명

### 플러그인 버전 관리
- `plugins {}` 블록에서 버전 지정
- Version Catalog (`libs.versions.toml`)와 조합
- `pluginManagement {}` (settings.gradle.kts)로 중앙 관리

---

## 6. 의존성 관리

### 저장소 (Repositories)
- `mavenCentral()` — Maven Central
- `google()` — Google Maven 저장소
- `mavenLocal()` — 로컬 Maven 캐시 (`~/.m2`)
- `maven { url = uri("https://...") }` — 커스텀 저장소
- 저장소 우선순위 (선언 순서)

### 의존성 선언
```kotlin
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    runtimeOnly("com.mysql:mysql-connector-j")
}
```

### 의존성 구성 (Configuration)
- `implementation` — 컴파일 + 런타임, 소비자에게 노출 안 됨 (권장)
- `api` — 컴파일 + 런타임, 소비자에게 노출됨 (java-library만)
- `compileOnly` — 컴파일만 (런타임 제외) — Lombok, JSP API 등
- `runtimeOnly` — 런타임만 (컴파일 제외) — JDBC 드라이버 등
- `testImplementation` — 테스트 컴파일 + 런타임
- `testCompileOnly` / `testRuntimeOnly`
- `annotationProcessor` — APT (Lombok, QueryDSL QClass 생성 등)

### 의존성 버전 지정
- 고정 버전: `"group:artifact:1.0.0"`
- 동적 버전: `"group:artifact:1.+"` (권장하지 않음)
- BOM 임포트로 버전 통합 관리

### 의존성 전이 (Transitive Dependencies)
- 의존성이 의존성을 가져오는 구조
- `./gradlew dependencies` — 의존성 트리 확인
- `./gradlew dependencyInsight --dependency <name>` — 특정 의존성 경로 추적

### 의존성 충돌 해결
- Gradle 기본 전략 — 가장 높은 버전 선택
- `resolutionStrategy.force("group:artifact:version")` — 버전 강제
- `exclude(group = "...", module = "...")` — 특정 의존성 제외
- `resolutionStrategy.eachDependency {}` — 동적 버전 교체

### Version Catalog (`libs.versions.toml`)
- 버전을 중앙 파일에서 관리
- `[versions]`, `[libraries]`, `[bundles]`, `[plugins]` 섹션
- `libs.spring.boot.web` 형태로 참조
- 멀티 모듈에서 버전 일관성 확보

---

## 7. 멀티 모듈 프로젝트

### 멀티 모듈 구조
```
root-project/
├── settings.gradle.kts     # include(":api", ":core", ":batch")
├── build.gradle.kts        # 공통 설정
├── api/
│   └── build.gradle.kts
├── core/
│   └── build.gradle.kts
└── batch/
    └── build.gradle.kts
```

### settings.gradle.kts에서 모듈 등록
- `include(":api")` — 서브프로젝트 등록
- `project(":api").projectDir = file("modules/api")` — 경로 커스터마이징

### 모듈 간 의존성
- `implementation(project(":core"))` — 다른 모듈 의존
- 순환 의존성 금지 (Gradle 빌드 실패)

### 공통 설정 적용 방법
- 루트 `build.gradle.kts`에서 `subprojects {}` / `allprojects {}`
  - `subprojects` — 모든 서브프로젝트에 적용
  - `allprojects` — 루트 포함 모든 프로젝트
- `subprojects {}` 사용 시 주의 — 구성 시간 증가
- **Convention Plugin (권장)** — 재사용 가능한 빌드 로직 플러그인화
  - `buildSrc/` 디렉터리 또는 별도 모듈
  - `my-java-conventions.gradle.kts` 패턴

### buildSrc
- 빌드 로직을 공유하는 특수 모듈
- `buildSrc/src/main/kotlin/` — 커스텀 플러그인, Convention Plugin
- 자동으로 빌드 클래스패스에 포함
- Composite Build와의 차이

### Composite Build
- 독립된 프로젝트를 포함하는 방법
- `includeBuild("../shared-lib")` (settings.gradle.kts)
- 로컬 개발 시 SNAPSHOT 의존성 대체

---

## 8. 빌드 성능 최적화

### Gradle 데몬 (Daemon)
- 데몬이란? — JVM 프로세스를 재사용해 빌드 시간 단축
- 기본 활성화 (Gradle 3.0+)
- `./gradlew --no-daemon` — 데몬 비활성화
- `./gradlew --stop` — 데몬 종료
- `org.gradle.daemon=true` (gradle.properties)

### 증분 빌드 (Incremental Build)
- 변경된 Task만 재실행 — UP-TO-DATE 체크
- Task 입출력 선언의 중요성
- `--rerun-tasks` — 강제 전체 재실행

### 빌드 캐시 (Build Cache)
- 이전 빌드 결과를 캐시하여 재사용 (CI/CD 서버 간 공유 가능)
- `org.gradle.caching=true` (gradle.properties)
- 로컬 캐시 (`~/.gradle/caches/`)
- 원격 캐시 (Gradle Enterprise, self-hosted)
- 캐시 가능한 Task — `@CacheableTask`

### 병렬 실행 (Parallel Execution)
- `org.gradle.parallel=true` — 독립적인 프로젝트/Task 병렬 실행
- 멀티 모듈에서 효과적

### Configuration Cache
- 구성 단계 결과를 캐시 — 두 번째 실행부터 구성 단계 건너뜀
- `org.gradle.configuration-cache=true`
- 호환되지 않는 플러그인 주의

### JVM 튜닝
- `org.gradle.jvmargs=-Xmx2g -XX:+HeapDumpOnOutOfMemoryError` (gradle.properties)
- Kotlin DSL 컴파일 메모리 요구량
- `org.gradle.workers.max=4` — 워커 수 제한

### 빌드 스캔 (Build Scan)
- `./gradlew build --scan` — 빌드 분석 리포트 생성
- 병목 구간, 느린 Task, 캐시 히트율 분석
- Gradle Enterprise (유료) / Develocity

---

## 9. 소스 셋 & 테스트 구성

### 소스 셋 (Source Sets)
- `main` / `test` — 기본 소스 셋
- 커스텀 소스 셋 추가 (통합 테스트, 성능 테스트 등)
```kotlin
sourceSets {
    create("intTest") {
        compileClasspath += sourceSets.main.get().output
        runtimeClasspath += sourceSets.main.get().output
    }
}
```
- 소스 셋별 의존성 구성 자동 생성 (`intTestImplementation` 등)

### 통합 테스트 분리 패턴
- `integrationTest` 소스 셋 + Task 구성
- `./gradlew integrationTest` — 별도 실행
- `check` Task에 통합 여부 설정

### Test Task 구성
- JUnit 5 설정 — `useJUnitPlatform()`
- 병렬 테스트 실행 — `maxParallelForks`
- 테스트 필터링 — `--tests "com.example.*"`
- 테스트 결과 리포트 (`build/reports/tests/`)
- `testLogging` — 콘솔 출력 설정

### JaCoCo (코드 커버리지)
- `id("jacoco")` 플러그인
- `jacocoTestReport` Task — HTML/XML 리포트 생성
- `jacocoTestCoverageVerification` — 커버리지 임계값 설정
- `test.finalizedBy(jacocoTestReport)` — 테스트 후 자동 리포트

---

## 10. 아티팩트 퍼블리시

### maven-publish 플러그인
- `id("maven-publish")`
- `publishing { publications {} repositories {} }` 블록
- `MavenPublication` — 퍼블리시할 내용 정의
- `./gradlew publishToMavenLocal` — 로컬 Maven 캐시에 배포
- `./gradlew publish` — 원격 저장소 배포

### POM 메타데이터 설정
- `pom {}` 블록 — 라이선스, 개발자, SCM 정보
- `versionMapping` — 동적 버전을 고정 버전으로 변환

### 저장소 인증
- 환경변수 또는 `gradle.properties`로 자격증명 관리
- `credentials {}` 블록

### GitHub Packages / Nexus / Artifactory
- 사내 Maven 저장소 연동 패턴
- SNAPSHOT vs RELEASE 저장소 분리

---

## 11. 커스텀 플러그인 개발

### 플러그인 개발 방식
- **Script Plugin** — 다른 빌드 스크립트 파일 `apply from: "other.gradle.kts"`
- **Precompiled Script Plugin** (buildSrc / Convention Plugin) — 권장
- **Binary Plugin** — JAR로 배포하는 독립 플러그인

### Convention Plugin 패턴
```kotlin
// buildSrc/src/main/kotlin/my-java-conventions.gradle.kts
plugins {
    id("java")
    id("checkstyle")
}
java {
    toolchain { languageVersion = JavaLanguageVersion.of(17) }
}
// 공통 설정...
```
- 각 모듈에서 `id("my-java-conventions")` 한 줄로 공통 설정 적용

### Plugin 인터페이스 구현
- `Plugin<Project>` 구현
- `project.plugins.apply()` / `project.tasks.register()`
- `Extension` — 플러그인 설정 DSL 추가 (`project.extensions.create()`)

### 커스텀 Task 클래스
- `@InputFiles`, `@OutputDirectory` 어노테이션
- `@TaskAction` 메서드
- `Property<T>`, `RegularFileProperty`, `DirectoryProperty` — Lazy 속성

---

## 12. CI/CD 연동

### GitHub Actions
- `./gradlew build` 기본 빌드
- Gradle 캐시 액션 (`actions/cache` + `~/.gradle/caches`)
- Gradle Wrapper 검증 (`gradle/wrapper-validation-action`)
- 빌드 스캔 자동 퍼블리시

### Jenkins / GitLab CI
- Gradle Wrapper 통한 빌드 (`./gradlew clean build`)
- 테스트 리포트 아카이빙
- Docker 이미지 빌드 (`bootBuildImage`)

### 환경별 설정
- `-P` 파라미터로 속성 전달 (`./gradlew build -PenableOptimizations=true`)
- 환경변수 → `gradle.properties` 주입
- 프로파일별 의존성 전환 패턴

---

## 13. 실무 팁 & 안티패턴

### 자주 쓰는 명령어
- `./gradlew build` — 전체 빌드
- `./gradlew test` — 테스트만 실행
- `./gradlew bootRun` — 로컬 서버 실행
- `./gradlew dependencies --configuration runtimeClasspath` — 런타임 의존성 트리
- `./gradlew properties` — 프로젝트 속성 전체 출력
- `./gradlew help --task <taskName>` — Task 상세 도움말
- `./gradlew --profile` — 빌드 프로파일 리포트 생성

### 디버깅
- `./gradlew build --info` — 상세 로그
- `./gradlew build --debug` — 전체 디버그 로그
- `./gradlew build --stacktrace` — 스택 트레이스 출력
- `println(...)` — build script 내 디버그 출력

### 안티패턴
- `allprojects {}` / `subprojects {}` 남용 — 구성 시간 증가, Convention Plugin으로 대체
- Task 구성 블록 내 무거운 로직 — 구성 시간 증가
- 동적 버전 (`1.+`) 사용 — 재현 불가능한 빌드
- `implementation` 대신 `compile` 사용 (deprecated 제거됨)
- `buildDir` 직접 사용 — `layout.buildDirectory` 사용 권장 (Lazy 평가)
- `groovy.lang.GString` 불일치 — Kotlin DSL에서 Groovy 코드 그대로 복붙

### 보안
- `gradle.properties`에 비밀값 저장 시 `.gitignore`에 추가
- `credentials {}` 블록으로 하드코딩 방지
- Wrapper JAR 무결성 검증 (`gradle/wrapper/gradle-wrapper.jar` SHA 확인)
- 의존성 검증 (`verification-metadata.xml`)

---

## 14. 버전별 주요 변경사항

### Gradle 7.x
- Version Catalog GA
- Java Toolchain 지원
- Configuration Cache 실험적 도입
- `api` / `implementation` 엄격 적용

### Gradle 8.x
- Configuration Cache 안정화
- `--warning-mode all` 기본 강화
- `buildDir` → `layout.buildDirectory` 권장
- Kotlin DSL 성능 개선
- `Project.buildDir` Deprecated
- Isolated Projects (실험적) — 모듈 간 완전한 격리로 최대 병렬화
- Java Toolchain 자동 다운로드

### Spring Boot 3.x + Gradle
- `org.springframework.boot:spring-boot-gradle-plugin:3.x`
- `bootBuildImage` — Buildpacks 기반 이미지 빌드
- GraalVM Native Image — `nativeCompile` Task
- `springBoot { mainClass = "com.example.MainKt" }` 설정
