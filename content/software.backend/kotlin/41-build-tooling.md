---
title: "[Kotlin 시리즈] 41. 빌드 & 툴링 — Gradle Kotlin DSL, KSP, 코드 품질"
author: oscar.rs
date: 2026-03-23
tags: ["kotlin", "gradle", "KSP", "detekt", "ktlint", "kover", "버전카탈로그"]
---

# 빌드 & 툴링 — Gradle Kotlin DSL, KSP, 코드 품질

## Gradle Kotlin DSL

### build.gradle.kts 기본 구조

```kotlin
plugins {
    kotlin("jvm") version "2.0.0"
    kotlin("plugin.serialization") version "2.0.0"
    application
}

group = "com.example"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("stdlib"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.0")

    testImplementation(kotlin("test"))
    testImplementation("io.kotest:kotest-runner-junit5:5.8.0")
    testImplementation("io.mockk:mockk:1.13.8")
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        freeCompilerArgs.addAll("-Xcontext-receivers")
    }
}

tasks.test {
    useJUnitPlatform()
}

application {
    mainClass.set("com.example.MainKt")
}
```

---

## 버전 카탈로그 (libs.versions.toml)

```toml
# gradle/libs.versions.toml
[versions]
kotlin = "2.0.0"
coroutines = "1.8.0"
serialization = "1.7.0"
kotest = "5.8.0"
mockk = "1.13.8"
ktor = "2.3.0"

[libraries]
kotlin-stdlib = { module = "org.jetbrains.kotlin:kotlin-stdlib", version.ref = "kotlin" }
coroutines-core = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "coroutines" }
coroutines-test = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-test", version.ref = "coroutines" }
serialization-json = { module = "org.jetbrains.kotlinx:kotlinx-serialization-json", version.ref = "serialization" }
kotest-runner = { module = "io.kotest:kotest-runner-junit5", version.ref = "kotest" }
mockk = { module = "io.mockk:mockk", version.ref = "mockk" }
ktor-server-core = { module = "io.ktor:ktor-server-core", version.ref = "ktor" }

[bundles]
kotest = ["kotest-runner"]
ktor-server = ["ktor-server-core"]

[plugins]
kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
```

```kotlin
// build.gradle.kts에서 사용
dependencies {
    implementation(libs.coroutines.core)
    implementation(libs.serialization.json)
    testImplementation(libs.bundles.kotest)
    testImplementation(libs.mockk)
}

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}
```

---

## 멀티 모듈

```kotlin
// settings.gradle.kts
rootProject.name = "my-project"

include(":core")
include(":api")
include(":service")
include(":persistence")
```

```kotlin
// core/build.gradle.kts
plugins {
    kotlin("jvm")
}
dependencies { }

// service/build.gradle.kts
dependencies {
    implementation(project(":core"))
    implementation(project(":persistence"))
}

// api/build.gradle.kts
dependencies {
    api(project(":core"))         // api — 전이 의존성 노출
    implementation(project(":service"))  // implementation — 캡슐화
}
```

### Convention Plugin (buildSrc)

```kotlin
// buildSrc/build.gradle.kts
plugins {
    `kotlin-dsl`
}

// buildSrc/src/main/kotlin/kotlin-common.gradle.kts
plugins {
    kotlin("jvm")
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

tasks.test {
    useJUnitPlatform()
}

// 각 모듈에서 재사용
// feature/build.gradle.kts
plugins {
    id("kotlin-common")
}
```

---

## KSP (Kotlin Symbol Processing)

KAPT의 후속. 어노테이션 프로세서를 Kotlin 네이티브로 작성합니다.

```kotlin
// build.gradle.kts
plugins {
    id("com.google.devtools.ksp") version "2.0.0-1.0.21"
}

dependencies {
    ksp("com.example:my-processor:1.0.0")
}
```

### 간단한 KSP 프로세서

```kotlin
// 프로세서 모듈
class BuilderProcessor(private val codeGenerator: CodeGenerator) : SymbolProcessor {
    override fun process(resolver: Resolver): List<KSAnnotated> {
        val symbols = resolver.getSymbolsWithAnnotation("com.example.Builder")

        symbols.filterIsInstance<KSClassDeclaration>().forEach { classDecl ->
            generateBuilder(classDecl)
        }

        return emptyList()
    }

    private fun generateBuilder(classDecl: KSClassDeclaration) {
        val className = classDecl.simpleName.asString()
        val packageName = classDecl.packageName.asString()

        val file = codeGenerator.createNewFile(
            Dependencies(false, classDecl.containingFile!!),
            packageName,
            "${className}Builder",
        )

        file.writer().use { writer ->
            writer.write("package $packageName\n\n")
            writer.write("class ${className}Builder {\n")
            // 빌더 코드 생성...
            writer.write("}\n")
        }
    }
}
```

---

## 코드 품질

### Detekt — 정적 분석

```kotlin
// build.gradle.kts
plugins {
    id("io.gitlab.arturbosch.detekt") version "1.23.0"
}

detekt {
    config.setFrom("detekt.yml")
    buildUponDefaultConfig = true
}
```

```yaml
# detekt.yml
complexity:
  LongMethod:
    threshold: 30
  ComplexMethod:
    threshold: 10

naming:
  FunctionNaming:
    functionPattern: '[a-z][a-zA-Z0-9]*'

style:
  MagicNumber:
    ignoreNumbers: ['-1', '0', '1', '2']
```

```bash
./gradlew detekt
```

### ktlint — 코드 포맷

```kotlin
// build.gradle.kts
plugins {
    id("org.jlleitschuh.gradle.ktlint") version "12.1.0"
}

ktlint {
    version.set("1.2.0")
    android.set(false)
    reporters {
        reporter(ReporterType.PLAIN)
        reporter(ReporterType.HTML)
    }
}
```

```bash
./gradlew ktlintCheck   # 검사
./gradlew ktlintFormat  # 자동 수정
```

### Kover — 코드 커버리지

```kotlin
// build.gradle.kts
plugins {
    id("org.jetbrains.kotlinx.kover") version "0.7.6"
}

kover {
    reports {
        total {
            html { onCheck = true }
            xml { onCheck = true }
        }

        filters {
            excludes {
                classes("*.generated.*", "*.BuildConfig")
            }
        }
    }
}
```

```bash
./gradlew koverHtmlReport  # HTML 커버리지 리포트 생성
./gradlew koverVerify      # 커버리지 임계값 검사
```

---

## 컴파일러 플러그인

### all-open — Spring/JPA 호환

```kotlin
// Spring과 함께 — 프록시 생성을 위해 final 제거
plugins {
    kotlin("plugin.spring") version "2.0.0"
    kotlin("plugin.jpa") version "2.0.0"
}
// 또는 직접 설정
allOpen {
    annotation("org.springframework.stereotype.Component")
    annotation("jakarta.persistence.Entity")
}
```

### no-arg — JPA 기본 생성자

```kotlin
// JPA 엔티티에 인자 없는 생성자 자동 생성
noArg {
    annotation("jakarta.persistence.Entity")
    annotation("jakarta.persistence.MappedSuperclass")
}
```

---

## 유용한 태스크

```bash
# 컴파일
./gradlew compileKotlin
./gradlew compileTestKotlin

# 테스트
./gradlew test
./gradlew test --tests "*.UserServiceTest.사용자 생성 성공"

# 실행
./gradlew run
./gradlew run --args="--port=9090"

# 빌드
./gradlew build
./gradlew jar
./gradlew shadowJar  # fat jar (shadow 플러그인)

# 정리
./gradlew clean
./gradlew clean build  # 깨끗한 빌드
```

---

## 정리

- **Gradle Kotlin DSL** (`build.gradle.kts`) — 타입 안전, IDE 지원, 자동완성
- **버전 카탈로그** (`libs.versions.toml`) — 중앙 의존성 관리
- **멀티 모듈** — `api` vs `implementation` 노출 범위 구분
- **Convention Plugin** (buildSrc) — 공통 빌드 설정 재사용
- **KSP** — 어노테이션 기반 코드 생성 (KAPT 대체)
- **Detekt** — 정적 분석, 코드 냄새 감지
- **ktlint** — 코드 포맷 자동화
- **Kover** — 코드 커버리지 측정
