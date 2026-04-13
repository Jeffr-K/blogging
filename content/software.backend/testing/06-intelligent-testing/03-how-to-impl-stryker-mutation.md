---
title: "Stryker를 이용한 NestJS 뮤테이션 테스팅 실전 가이드"
author: jeffrey
date: 2026-04-13
tags: ["stryker", "mutation-testing", "nestjs", "how-to", "software-quality"]
---

## Stryker를 이용한 NestJS 뮤테이션 테스팅 실전 가이드

이론을 현실로 옮길 도구는 **Stryker Mutator**입니다. Stryker는 Jest, Mocha, Jasmine 등 주요 라이브러리와 완벽하게 통합되며 특히 TypeScript에 최적화되어 있습니다. NestJS 환경에서 Stryker를 설정하고, 여러분의 테스트 코드가 가진 '살상력'을 시각화하는 방법을 단계별로 알아봅니다.

---

### 1. Stryker 설치 및 초기화

먼저 프로젝트에 Stryker 관련 패키지를 설치합니다.

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner @stryker-mutator/typescript-checker
```

그다음 아래 명령어로 설정 파일을 생성합니다.

```bash
npx stryker init
```

### 2. NestJS 최적화 설정 (stryker.config.json)

NestJS는 고유의 구조가 있으므로, 효율적인 검사를 위해 설정을 다듬어야 합니다.

```json
{
  "$schema": "https://schema.stryker-mutator.io/config/stryker-config.schema.json",
  "mutator": "typescript",
  "packageManager": "npm",
  "reporters": ["html", "clear-text", "progress"], // HTML 리포트 생성
  "testRunner": "jest",
  "jest": {
    "projectType": "custom",
    "configFile": "jest.config.js",
    "enableFindRelatedTests": true
  },
  "mutate": [
    "src/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/main.ts" // 핵심 비즈니스 로직에 집중
  ],
  "thresholds": { "high": 80, "low": 60, "break": 50 } // 점수 미달 시 빌드 실패 설정
}
```

### 3. 뮤테이션 테스팅 실행

이제 사냥을 시작합니다.

```bash
npx stryker run
```

실행이 완료되면 `reports/mutation/index.html` 파일이 생성됩니다. 이 파일을 열면 어떤 라인의 소스 코드가 어떻게 변조되었고, 테스트가 그것을 죽였는지(Killed) 살려두었는지(Survived) 알 수 있는 아름다운 인터페이스를 만날 수 있습니다.

### 4. 사후 분석: 생존자(Survivor) 발견 처리법

리포트에서 **"Survived"**라고 뜬 코드를 발견했다면 다음 조치를 취하십시오.

1. **Assert 누락**: 함수를 호출만 하고 결과를 기대값과 비교하지 않았는지 확인하십시오.
2. **사각지대**: 해당 라인의 분기문(if-else)을 타는 테스트 케이스 자체가 아예 없는지 확인하십시오.
3. **무의미한 코드**: 코드를 변조해도 테스트가 성공한다면, 사실 그 코드는 비즈니스적으로 아무런 영향을 미치지 않는 **'죽은 코드(Dead Code)'**일 가능성이 큽니다. 과감히 삭제하거나 로직을 개선하십시오.

---

### 시니어의 팁: "전체보다는 핵심에 집중하라"

뮤테이션 테스팅은 CPU 리소스를 매우 많이 소모합니다. 소스 코드 한 줄당 수십 개의 테스트를 수행하기 때문이죠.

- **조언**: CI/CD 매 배포마다 전체를 돌리기보다는, **'핵심 도메인 로직'** 폴더에 대해서만 주기적으로 실행하거나, 중요한 릴리즈 직전에 한 번씩 성능을 점검하는 용도로 활용하십시오.

질보다 양으로 승부하는 1,000개의 단위 테스트보다, 뮤턴트 살상력이 90%가 넘는 정예 테스트 100개가 여러분의 시스템을 훨씬 더 안전하게 지켜줄 것입니다.
 Jennifer 정 (Master Automation Engineer)
