---
title: "[TDD 시리즈] 25. Mutation Testing — 테스트가 테스트를 테스트한다"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "Mutation Testing", "Stryker", "PIT", "테스트 품질"]
---

# Mutation Testing — 테스트가 테스트를 테스트한다

코드 커버리지 100%인 프로젝트가 있다. 모든 라인, 모든 브랜치를 테스트가 지나간다. 그런데 이 테스트가 정말 의미 있는 검증을 하고 있을까?

```typescript
it('사용자를 저장한다', () => {
  const repo = new UserRepository(db);
  repo.save(user);
  // assert 없음
});
```

이 테스트는 `save`를 호출한다. 커버리지는 올라간다. 하지만 `save`가 실패해도, 아무것도 저장하지 않아도, 이 테스트는 통과한다. **커버리지는 코드가 실행됐다는 것을 말할 뿐, 검증했다는 것을 말하지 않는다.**

Mutation Testing은 이 문제를 정면으로 공격한다.

## Mutation Testing의 원리

Mutation Testing은 프로덕션 코드를 **의도적으로 조금 망가뜨린다(Mutant)**. 그리고 테스트 스위트가 이 망가진 코드를 잡아내는지 확인한다.

테스트가 Mutant를 잡으면 — **Mutant가 죽었다(Killed)**.
테스트가 Mutant를 잡지 못하면 — **Mutant가 살아남았다(Survived)**.

살아남은 Mutant는 테스트가 놓친 케이스다. 실제 버그가 들어와도 테스트를 통과할 수 있는 구멍이다.

## Mutant의 종류

Mutation Testing 도구들이 자동으로 생성하는 변형들이다.

**조건 변경**
```typescript
// 원본
if (age >= 18) { return true; }

// Mutant 1: >= → >
if (age > 18) { return true; }

// Mutant 2: >= → <
if (age < 18) { return true; }
```

**논리 연산자 변경**
```typescript
// 원본
if (isAdmin && isActive) { ... }

// Mutant: && → ||
if (isAdmin || isActive) { ... }
```

**반환값 변경**
```typescript
// 원본
function isValid(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

// Mutant: true ↔ false 반전
function isValid(email: string): boolean {
  return !EMAIL_REGEX.test(email);
}
```

**산술 연산자 변경**
```typescript
// 원본
const discount = price * 0.1;

// Mutant: * → /
const discount = price / 0.1;
```

**구문 삭제**
```typescript
// 원본
function processOrder(order: Order): void {
  validateOrder(order);  // ← Mutant: 이 줄 삭제
  saveOrder(order);
}
```

## Mutation Score

```
Mutation Score = 죽인 Mutant 수 / 전체 Mutant 수 × 100%
```

Mutation Score 80%는 20%의 Mutant가 살아남았다는 의미다. 테스트가 탐지하지 못한 결함 시나리오가 20%라는 것.

코드 커버리지 100%에 Mutation Score 40%는 얼마든지 가능하다. 이게 커버리지의 거짓말이다.

## Stryker로 TypeScript 프로젝트에 적용하기

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner
npx stryker init
```

`stryker.config.json`:
```json
{
  "packageManager": "npm",
  "reporters": ["html", "clear-text", "progress"],
  "testRunner": "jest",
  "coverageAnalysis": "perTest",
  "mutate": [
    "src/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/**/*.test.ts"
  ]
}
```

```bash
npx stryker run
```

### 결과 해석

```
Mutation testing is done. View full report: reports/mutation/index.html

All mutants:
Killed:   142 (78%)
Survived:  31 (17%)
No coverage: 8 (4%)
Timeout:   2 (1%)

Mutation score: 78.00 %
```

`No coverage`는 테스트가 아예 실행조차 안 한 코드의 Mutant다. 커버리지 문제와 Mutation 문제가 겹쳐있는 최악의 케이스.

### HTML 리포트로 살아남은 Mutant 분석

Stryker는 HTML 리포트를 생성한다. 각 파일마다 어떤 Mutant가 살아남았는지 라인별로 보여준다.

살아남은 Mutant 예시:

```
src/auth/validator.ts:23
  Original: if (user.role === 'admin' && user.isActive)
  Mutant:   if (user.role === 'admin' || user.isActive)  ← SURVIVED
```

이 Mutant가 살아남았다는 건, `isActive`가 `false`인 admin 유저가 접근을 거부당하는 케이스를 테스트하지 않았다는 의미다. 실제 버그가 될 수 있는 구멍이다.

## PIT (Java)와 Mutmut (Python)

**PIT — Java/JVM**

```xml
<!-- Maven -->
<plugin>
  <groupId>org.pitest</groupId>
  <artifactId>pitest-maven</artifactId>
  <version>1.15.0</version>
  <configuration>
    <targetClasses>
      <param>com.example.service.*</param>
    </targetClasses>
    <targetTests>
      <param>com.example.service.*Test</param>
    </targetTests>
  </configuration>
</plugin>
```

```bash
mvn org.pitest:pitest-maven:mutationCoverage
```

PIT는 JVM 바이트코드를 직접 변형하기 때문에 매우 빠르다. 바이트코드 레벨에서 변형이 일어나므로 소스코드를 다시 컴파일할 필요가 없다.

**Mutmut — Python**

```bash
pip install mutmut
mutmut run --paths-to-mutate src/
mutmut results
mutmut show 42  # 특정 Mutant 보기
```

## CI에서 실용적으로 사용하기

Mutation Testing은 느리다. 프로젝트 전체에 돌리면 수십 분이 걸릴 수 있다. 이걸 매 커밋마다 전체 실행하면 개발 흐름이 끊긴다.

실용적인 접근은 **변경된 코드에만 실행**하는 것이다.

```bash
# 변경된 파일만 대상으로
npx stryker run --mutate "$(git diff --name-only HEAD~1 HEAD | grep '\.ts$' | tr '\n' ',')"
```

Stryker는 `--since` 옵션도 지원한다:

```bash
npx stryker run --since origin/main
```

PR 단위로 변경된 코드의 Mutation Score를 체크하는 것이 현실적이다. 새로 추가하는 코드는 Mutation Score 기준을 통과해야 머지 가능하도록 설정한다.

GitHub Actions 예시:

```yaml
- name: Mutation Testing
  run: npx stryker run --since origin/main

- name: Check Mutation Score
  run: |
    SCORE=$(cat reports/mutation/mutation-testing-report.json | jq '.mutationScore')
    if (( $(echo "$SCORE < 75" | bc -l) )); then
      echo "Mutation score $SCORE% is below threshold 75%"
      exit 1
    fi
```

## Mutation Testing을 통해 배우는 것

Mutation Testing의 진짜 가치는 Mutation Score 숫자가 아니다. 살아남은 Mutant를 분석하면서 **"나는 이 코드의 어떤 동작을 검증하지 않았는가"**를 배우는 것이다.

경계값(`>=` vs `>`)을 놓쳤다면 경계 조건 테스트를 추가한다. 논리 연산자 변형을 잡지 못했다면 각 조건이 독립적으로 영향을 미치는지 테스트한다. 삭제된 구문을 잡지 못했다면 그 구문의 사이드 이펙트를 검증하는 테스트가 없다는 의미다.

Mutation Testing은 테스트 스위트의 X-레이 촬영이다. 겉으로는 튼튼해 보이는 테스트에서 보이지 않던 구멍을 드러낸다.
