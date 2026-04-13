---
title: "고급 설정: Global Setup/Teardown과 커스텀 테스트 환경"
author: jeffrey
date: 2026-04-13
tags: ["jest", "global-setup", "global-teardown", "test-environment", "advanced-config"]
---

## 고급 설정: Global Setup/Teardown과 커스텀 테스트 환경

수백 개의 테스트 파일이 존재할 때, 매번 데이터베이스를 초기화하거나 외부 서버를 띄우는 작업은 엄청난 오버헤드를 발생시킵니다. Jest의 **Global Lifecycle**과 **Test Environment** 설정을 이용하면, 전체 테스트 프로세스의 생명주기를 한곳에서 효율적으로 관리할 수 있습니다.

---

### 1. Global Setup & Teardown

`beforeAll`이 개별 테스트 파일의 시작을 알린다면, `globalSetup`은 Jest 엔진이 돌아가기 전 **딱 한 번** 실행됩니다. Docker를 띄우거나 전역 시드 데이터를 넣을 때 최적입니다.

```javascript
// jest.config.js
module.exports = {
  globalSetup: './setup.js',
  globalTeardown: './teardown.js',
};

// setup.js
module.exports = async () => {
  console.log('--- 테스트용 Docker 컨테이너 실행 ---');
  await startDatabaseContainer();
};
```

> [!CAUTION]
> `globalSetup` 내에서 정의한 전역 변수는 개별 테스트 파일에서 직접 접근할 수 없습니다. 데이터를 공유하려면 `process.env`를 활용하거나 파일/DB에 써야 합니다.

---

### 2. Test Environment: 브라우저인가, 서버인가?

Jest는 기본적으로 `node` 환경이나 `jsdom`(브라우저 환경 모사) 환경에서 돌아갑니다.

- **`node`**: 일반적인 백엔드, NestJS 로직 테스트에 적합. (속도가 빠름)
- **`jsdom`**: 프론트엔드 컴포넌트 테스트(RTL)에 필수. `window`, `document` 객체를 제공.

**파일별 환경 지정하기:**

```typescript
/**
 * @jest-environment jsdom
 */
test('이 테스트 파일만 브라우저 환경에서 실행됩니다', () => {
  expect(document.body).toBeDefined();
});
```

---

### 3. Custom Environment (최상급 난이도)

때로는 `node` 환경만으로는 부족하여, 모든 테스트 파일마다 공통적인 데이터베이스 커넥션을 주입하거나 특별한 전역 객체를 심어야 할 때가 있습니다.

```javascript
// CustomEnv.js
const NodeEnvironment = require('jest-environment-node');

class CustomEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();
    this.global.sharedConnection = await connectToDB();
  }
}
```

---

### 🎯 Senior's Insight: 인프라에 대한 테스트 격리

시니어급 프로젝트에서는 `globalSetup`에서 데이터베이스 스키마를 생성하고, 개별 테스트 파일에서는 `Transaction(Rollback)` 전략을 사용하여 각 테스트가 서로 영향을 주지 않도록 격리(Isolation)합니다.

결과적으로 **"순수 로직은 Unit으로, 상태가 따르는 로직은 DB 롤백이 포함된 Integration"**으로 철저히 계층화하여, 전체 테스트 수행 시간을 최소화하면서도 정확도는 극대화하는 설계를 갖추는 것이 핵심입니다.

### 결론: 도구의 한계를 설정이 극복한다

Jest 공식 문서의 방대한 옵션들은 대부분 "어떻게 하면 더 빠르고 편리한 환경을 구축할 수 있을까?"에 대한 답입니다. 설정을 탐구하는 것을 겁내지 마십시오. 잘 짜인 테스트 환경 하나가 팀 전체의 생산성을 수 배 이상 끌어올릴 수 있습니다.

---

> [!NOTE]
> 이제 Jest의 모든 도구를 갖추었습니다. 마지막 단계에서는 이 모든 지식을 결합하여 대규모 프로젝트에서 테스트 성능을 '미친 듯이' 끌어올리는 튜닝 비법을 공개합니다.
