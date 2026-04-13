---
title: "NestJS 환경에서의 전역 Jest 설정 및 환경 최적화 (How)"
author: jeffrey
date: 2026-04-13
tags: ["jest-config", "nestjs", "how-to", "path-alias", "module-mapper"]
---

## NestJS 환경에서의 전역 Jest 설정 및 환경 최적화

NestJS 프로젝트를 시작하면 이미 어느 정도의 Jest 설정이 되어있습니다. 하지만 프로젝트가 커짐에 따라 **경로 별칭(@domain, @application)**이 작동하지 않거나, 테스트 데이터베이스 초기화가 필요한 순간이 옵니다. 이러한 복잡한 요구사항을 해결하는 **`jest.config.js`**의 정석 설정을 알아봅니다.

---

### 1. 전역 설정의 시작: 패키지 설치

먼저 TypeScript 프로젝트에서 Jest를 원활하게 사용하기 위한 필수 패키지들을 확인해야 합니다.

```bash
# 기본 NestJS 프로젝트라면 이미 설치되어 있겠지만, 누락되었다면
npm install --save-dev jest ts-jest @types/jest
```

- **`ts-jest`**: Jest는 기본적으로 JavaScript 전용입니다. 이를 TypeScript에 대응시키기 위한 전처리기로서, 실시간 컴파일과 타입 체크를 담당합니다.
- **Tip**: 속도가 중요하다면 `ts-jest` 대신 `@swc/jest`를 고려해볼 수도 있지만, `ts-jest`는 타입 안정성이 더 뛰어나다는 장점이 있습니다.

---

### 2. 전역 설정의 핵심: jest.config.js

`package.json` 안에 설정을 넣는 것보다 별도의 파일을 두는 것이 유지보수와 주석 관리에 유리합니다.

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest', // TypeScript 지원
  },
  collectCoverageFrom: ['**/*.(t|j)s'], // 커버리지 수집 대상
  coverageDirectory: '../coverage',
  testEnvironment: 'node', // 백엔드이므로 node 환경 지정
};
```

### 3. 경로 별칭(Path Alias) 연동: moduleNameMapper

TypeScript의 `paths` 설정을 사용한다면, Jest에게도 이 별칭이 어디를 가리키는지 알려줘야 합니다.

```javascript
moduleNameMapper: {
  '^@domain/(.*)$': '<rootDir>/domain/$1',
  '^@application/(.*)$': '<rootDir>/application/$1',
  '^@infrastructure/(.*)$': '<rootDir>/infrastructure/$1',
},
```

### 4. 글로벌 셋업과 티어다운 (Setup & Teardown)

모든 테스트가 시작되기 전 DB를 띄우거나 환경 변수를 주입해야 할 때 사용합니다.

```javascript
setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
```

- **test-setup.ts**: 여기에서 `jest-extended`와 같은 커스텀 매처를 로드하거나, 테스트마다 공통으로 적용될 `beforeEach` 로직을 작성할 수 있습니다.

---

### 5. 시니어의 팁: "테스트 소음(Noise)을 줄여라"

테스트 실행 시 터미널을 가득 채우는 `console.log`는 테스트 결과를 확인하는 데 방해만 됩니다.

- **조언**: `silent: true` 설정을 사용하거나, `jest-fail-on-console` 라이브러리를 통해 의도치 않은 로그가 남았을 때 테스트를 실패하게 만드십시오. 테스트 리포트는 오직 성공과 실패의 정보만을 담은 깨끗한 상태여야 합니다.

이제 여러분의 NestJS 프로젝트는 그 어떤 복잡한 모듈 관계 속에서도 흔들림 없이 테스트를 수행할 준비가 되었습니다.
 Jennifer 정 (Senior Tech Lead)

---

> [!NOTE]
> 이제 도구가 준비되었습니다. 다음 아티클에서는 Jest가 제공하는 화려한 **매처(Matchers)**들과 **비동기 테스트**의 완벽한 통제법을 다룹니다.
