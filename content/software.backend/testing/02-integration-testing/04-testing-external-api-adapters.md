---
title: "외부 API 어댑터와 타사 서비스 연동 테스팅"
author: jeffrey
date: 2026-04-13
tags: ["api-testing", "msw", "wiremock", "integration-testing", "adapter-pattern"]
---

## 외부 API 어댑터와 타사 서비스 연동 테스팅

현대 백엔드 시스템은 섬처럼 고립되어 있지 않습니다. 결제는 Toss, 문자는 알림톡, 이메일은 AWS SES 등을 호출하며 끊임없이 외부와 소통하죠. 이러한 **'외부 API 연동 어댑터'**를 테스트할 때 단순히 모듈을 모킹하는 것은 위험합니다. 실제 네트워크 패킷 수준의 정합성을 확인하는 고도화된 통합 테스팅 전략이 필요합니다.

---

### 1. 단순 모킹의 함정 (The Mocking Trap)

개발자들이 흔히 저지르는 실수는 `axios.post` 자체를 `jest.fn()`으로 갈아끼우는 것입니다.

- **문제점**: 이 방식은 우리가 외부 서버로 보내는 HTTP 헤더(`Authorization`), 요청 바디의 `JSON Key`가 실제 타사 명세서와 일치하는지 전혀 검증해 주지 않습니다.
- **해결책**: 애플리케이션 외부에서 실제 HTTP 서버인 척 응답해 주는 **Mock Server**를 띄워야 합니다.

### 2. Mock Service Worker (MSW)와 WireMock 활용

#### 2.1 MSW 기반의 어댑터 테스트 전략 (NestJS)

MSW는 네트워크 레벨에서 요청을 가로채어, 애플리케이션 코드를 수정하지 않고도 실제 통신 과정을 테스트하게 해줍니다.

```typescript
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// 1. [Arrange] 가짜 외부 서버 정의
const server = setupServer(
  rest.post('https://api.third-party.com/v1/pay', (req, res, ctx) => {
    // 실제 전송된 페이로드 검증
    if (req.headers.get('x-api-key') !== 'VALID_KEY') {
      return res(ctx.status(401));
    }
    return res(ctx.status(200), ctx.json({ success: true }));
  }),
);

beforeAll(() => server.listen());
afterAll(() => server.close());

it('정확한 API 키와 함께 결제 요청을 보내야 한다.', async () => {
    // 2. [Act] 실제 Axios를 사용하는 어댑터 호출
    const result = await paymentAdapter.confirm('order_123');

    // 3. [Assert]
    expect(result.success).toBe(true);
});
```

### 3. 실패 시나리오의 정밀 테스팅

통합 테스트의 진가는 **'나쁜 상황'**을 재현할 때 드러납니다.

- **타임아웃(Timeout)**: 타사 API가 10초 동안 응답을 안 할 때 우리 앱의 서킷 브레이커가 작동하는가?
- **상태 코드 처리**: 500 에러를 받았을 때 내부적으로 정확히 재시도(Retry)를 수행하는가?
- **데이터 불일치**: 타사 API 명세가 예고 없이 바뀌어 예상치 못한 필드가 올 때 파서가 에러를 뱉는가?

---

### 전문가의 한마디: "외부 세계와의 계약(Contract)을 명시하라"

여러분이 사용하는 모든 외부 API 어댑터는 일종의 **'계약'**입니다. 이 계약이 깨졌을 때 가장 먼저 소리를 질러주는 것이 통합 테스트의 역할입니다.

코드 내부의 단일 기능은 단위 테스트로 지키고, 타사 시스템과의 **'연결 고리'**는 실제 HTTP 프로토콜 수준의 통합 테스트로 지키십시오. 그래야 배포 당일 "API 문법이 틀려서 결제가 안 돼요"라는 끔찍한 보고를 피할 수 있습니다.
 Jennifer 정 (Senior Integration Specialist)
