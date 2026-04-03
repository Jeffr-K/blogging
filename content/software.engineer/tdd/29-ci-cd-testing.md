---
title: "[TDD 시리즈] 29. CI/CD에서의 테스트 전략"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "CI/CD", "GitHub Actions", "테스트 자동화", "Flaky Test", "커버리지 게이트"]
---

# CI/CD에서의 테스트 전략

테스트를 잘 써도 CI에 통합되지 않으면 의미가 절반이다. 로컬에서만 돌리는 테스트는 "안 돌려도 배포는 된다"는 문화를 만든다. CI/CD 파이프라인은 테스트를 선택이 아닌 필수로 만드는 장치다. 그 장치를 잘 설계하는 것이 이번 글의 주제다.

## 테스트를 CI에 통합하는 원칙

파이프라인 설계의 핵심 원칙은 단순하다. **빠른 피드백을 먼저, 비싼 검증을 나중에.**

PR을 올린 개발자가 30분을 기다려야 결과를 볼 수 있다면 그 사이에 다른 작업으로 컨텍스트를 전환한다. 돌아왔을 때 실패 이유를 다시 파악하는 데 또 시간이 걸린다. 2분 안에 핵심 피드백을 주는 파이프라인과 30분짜리 파이프라인의 생산성 차이는 숫자보다 크다.

## 테스트 단계 분리

테스트를 한 번에 다 돌리지 않는다. 단계를 나눠서 순서대로 실행한다.

```
[단위 테스트] → [통합 테스트] → [E2E 테스트]
   ~1-2분            ~5-10분          ~15-30분
```

단위 테스트가 실패하면 통합 테스트를 실행할 이유가 없다. 앞 단계 실패 시 다음 단계를 건너뛰면 전체 피드백 시간을 줄인다.

PR 단계에서는 단위 테스트와 통합 테스트까지만 돌린다. E2E는 main 브랜치 머지 후, 스테이징 배포 파이프라인에서 실행한다. E2E를 모든 PR마다 돌리면 파이프라인이 느려지고 flaky test로 인한 노이즈가 팀 전체를 지치게 한다.

## GitHub Actions 실전 예시

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  unit-test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Check coverage gate
        run: npm run test:coverage-check

      - name: Upload coverage report
        uses: codecov/codecov-action@v4
        with:
          fail_ci_if_error: true

  integration-test:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-test   # 단위 테스트 통과 후 실행
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb

  e2e-test:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [unit-test, integration-test]
    if: github.ref == 'refs/heads/main'  # main 브랜치 머지 시에만 실행
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload E2E artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

## Fast Feedback: PR 올리면 2분 안에 결과를

2분 안에 단위 테스트 결과를 받으려면 테스트 자체가 빨라야 한다. 단위 테스트가 느려지는 주요 원인들:

- 테스트 안에서 실제 타이머 (`setTimeout`, `sleep`)를 사용
- 파일 시스템 접근
- 모듈 초기화 비용이 큰 설정을 각 테스트마다 반복

Jest 기준으로 단위 테스트가 500개인데 10초 이상 걸린다면 어딘가 느린 테스트가 있다는 신호다.

```bash
# 느린 테스트 찾기
npx jest --verbose --testPathPattern="unit" 2>&1 | grep -E "✓|✗" | sort -k2 -rn | head -20
```

타이머는 항상 가짜 타이머로 대체한다.

```typescript
// 느린 테스트 — 실제 타이머 사용
it('3초 후에 토큰이 만료된다', async () => {
  const token = createToken({ expiresIn: 3000 });
  await new Promise(resolve => setTimeout(resolve, 3100));
  expect(token.isExpired()).toBe(true);
});

// 빠른 테스트 — 가짜 타이머
it('3초 후에 토큰이 만료된다', () => {
  jest.useFakeTimers();
  const token = createToken({ expiresIn: 3000 });
  jest.advanceTimersByTime(3100);
  expect(token.isExpired()).toBe(true);
  jest.useRealTimers();
});
```

## 병렬 테스트 실행

테스트 스위트가 커지면 직렬 실행의 한계에 부딪힌다. 병렬 실행으로 시간을 줄이는 방법은 여러 가지다.

Jest는 기본적으로 파일 단위로 병렬 실행한다. `--maxWorkers` 옵션으로 워커 수를 조정한다.

GitHub Actions에서는 `matrix` 전략으로 테스트를 샤딩한다.

```yaml
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]  # 4개 병렬 실행
    steps:
      - name: Run tests (shard ${{ matrix.shard }}/4)
        run: npx jest --shard=${{ matrix.shard }}/4
```

Java/Spring 프로젝트에서는 Gradle의 `--parallel` 옵션과 `maxParallelForks`를 활용한다.

```kotlin
// build.gradle.kts
tasks.test {
    maxParallelForks = (Runtime.getRuntime().availableProcessors() / 2).coerceAtLeast(1)
}
```

## Flaky Test 관리

Flaky test는 CI를 신뢰할 수 없게 만드는 가장 큰 원인이다. "빌드가 실패했는데 다시 돌리면 된다"는 문화가 생기면 진짜 실패도 무시하게 된다.

Flaky test의 주요 원인:

- **시간 의존**: `new Date()`를 테스트 안에서 직접 사용
- **순서 의존**: 테스트가 실행 순서에 따라 다른 결과
- **외부 네트워크**: 테스트에서 실제 API를 호출
- **공유 상태**: 테스트 간 DB 상태가 격리되지 않음
- **비동기 타이밍**: race condition으로 인한 간헐적 실패

단기 대응으로 재시도 정책을 설정할 수 있지만, 재시도는 증상 완화일 뿐이다.

```yaml
# GitHub Actions — 불안정한 테스트에 재시도 (임시 방편)
- name: Run tests with retry
  uses: nick-fields/retry@v3
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: npm run test:integration
```

근본 해결은 flaky한 테스트를 격리하고 수정하는 것이다. 팀 대시보드에서 어떤 테스트가 얼마나 자주 flaky한지 추적하고, 일정 임계값을 넘으면 해당 테스트를 quarantine(격리) 태그로 마킹해 CI에서 제외한다. 제외된 테스트는 별도 이슈로 등록해 반드시 수정한다.

## 테스트 커버리지 게이트

커버리지 숫자를 팀 목표로 삼으면 안 된다. 하지만 커버리지가 **낮아지는 방향**으로 PR이 들어오면 빌드를 실패시키는 것은 유효하다.

```json
// package.json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 75,
        "lines": 75,
        "statements": 75
      }
    }
  }
}
```

이 설정은 "75% 이상을 유지해라"가 아니라 "기존 커버리지보다 낮아지면 머지를 막아라"는 원칙으로 사용해야 한다. 커버리지가 높다고 테스트 품질이 높은 것이 아님을 팀이 알고 있어야 의미 있는 게이트가 된다.

## Branch 전략과 테스트 차별화

모든 브랜치에서 동일한 테스트 스위트를 돌릴 필요는 없다.

```
feature branch PR:
  ✓ Lint + 타입 체크
  ✓ 단위 테스트 (전체)
  ✓ 통합 테스트 (변경된 모듈 관련)
  ✗ E2E 테스트 (생략)
  목표: 2-5분 이내 피드백

main 브랜치 머지:
  ✓ 단위 테스트 (전체)
  ✓ 통합 테스트 (전체)
  ✓ E2E 테스트 (핵심 시나리오)
  ✓ 성능 테스트 (선택적)
  목표: 배포 전 전체 검증

스케줄 실행 (야간):
  ✓ 전체 E2E 스위트
  ✓ 취약점 스캔
  ✓ 부하 테스트
```

CI 파이프라인은 "돌리기 위한 것"이 아니라 "빠른 피드백을 주기 위한 것"이다. 그 목표를 명확히 하면 무엇을 언제 돌릴지 결정 기준이 생긴다.
