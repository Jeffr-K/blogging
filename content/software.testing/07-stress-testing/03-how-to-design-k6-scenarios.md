---
title: "실전 K6 시나리오 설계: 가상 사용자(VU)와 합격 기준(Thresholds)"
author: jeffrey
date: 2026-04-13
tags: ["k6", "how-to", "performance-scenario", "load-testing", "thresholds"]
---

## 실전 K6 시나리오 설계: 가상 사용자(VU)와 합격 기준(Thresholds)

성능 테스트 스크립트를 작성할 때 가장 흔히 하는 실수는 "무조건 빠르게, 많이" 요청을 보내는 것입니다. 하지만 실제 사용자는 기계처럼 초당 100번씩 클릭하지 않습니다. 이번 아티클에서는 실제 유저의 행동을 모사하고, 비즈니스 목적에 맞는 합격 기준을 설정하는 **전략적 시나리오 설계법**을 알아봅니다.

---

### 1. 부하 전략 설정 (Stages & VU)

K6의 `options` 객체를 통해 부하의 모양을 결정합니다.

```javascript
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // 30초 동안 20명까지 램프업 (Ramp-up)
    { duration: '1m', target: 20 },  // 1분 동안 20명 유지 (Steady-state)
    { duration: '20s', target: 0 },  // 20초 동안 종료 (Ramp-down)
  ],
};
```

### 2. 합격 기준 설정 (Thresholds)

테스트 결과가 "성공"인가 "실패"인가를 결정하는 핵심 지표입니다. CI/CD 파이프라인에서 배포를 막을지 결정하는 기준이 됩니다.

```javascript
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95%의 응답이 500ms 이내여야 함
    'http_req_failed': ['rate<0.01'],   // 에러율이 1% 미만이어야 함
  },
```

### 3. 유저 행위 모사 (Check & Sleep)

단순 호출이 아니라, 응답 결과가 올바른지 검증(`check`)하고 유저가 페이지를 읽는 시간(`sleep`)을 부여해야 정확한 부하 측정이 가능합니다.

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export default function () {
  // 1. [Act] API 호출
  const res = http.get('https://api.myapp.com/products');

  // 2. [Assert] 응답 검증 (기능 테스트 성격)
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body has products': (r) => r.json().length > 0,
  });

  // 3. Think Time (실제 유저처럼 1~3초 대기)
  sleep(Math.random() * 2 + 1);
}
```

---

### 시니어의 팁: "시나리오는 돈이 흐르는 길을 따라가야 한다"

모든 API를 테스트하려 하지 마십시오.

- **가장 비싼 경로**: 결제, 장바구니 담기, 상품 구매 확정.
- **가장 잦은 경로**: 메인 홈 조회, 상품 상세 조회, 검색.

이 두 가지 범주에 속하는 API들을 엮어 하나의 **'사용자 시나리오'**로 구성하십시오. 단순히 `/health` 체크 API를 10만 번 호출하는 것은 여러분의 시스템 성능을 증명하는 데 아무런 도움이 되지 않습니다. 실전과 똑같이 움직이십시오. 그것이 K6를 가장 잘 쓰는 방법입니다.
 Jennifer 정 (Senior QA Architect)
