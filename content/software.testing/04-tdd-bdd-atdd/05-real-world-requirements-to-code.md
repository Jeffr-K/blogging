---
title: "실전 사례: 복잡한 비즈니스 요구사항을 코드로 치환하기"
author: jeffrey
date: 2026-04-13
tags: ["tdd", "bdd", "atdd", "real-world-case", "software-architecture", "nestjs"]
---

## 실전 사례: 복잡한 비즈니스 요구사항을 코드로 치환하기

이론은 이해하기 쉽지만, 실제 비동기 처리와 DB 연동이 얽힌 복잡한 비즈니스 조건 속에서 TDD/BDD/ATDD를 조화롭게 사용하기는 쉽지 않습니다. 이번 실전 사례에서는 **'신규 회원 가입 시 조건별 쿠폰 자동 지급 시스템'**이라는 주제로, 요구사항이 어떻게 코드로 '승화'되는지 그 드라마틱한 과정을 살펴보겠습니다.

---

### 1단계: ATDD - 목표 지점 합의 (The Acceptance Criteria)

기획자와 개발자가 모여 **인수 조건**을 정의합니다.

- **인수 조건**: 사용자가 회원가입을 완료했을 때, 추천인 코드가 있다면 추천인과 가입자 모두에게 '10% 할인 쿠폰'을 지급해야 한다. (추천인이 없으면 가입자에게만 '웰컴 쿠폰' 지급)

### 2단계: BDD - 행위의 선언 (The Behavior)

이 인수 조건을 `Given-When-Then` 시나리오로 구체화합니다. (API 레벨의 E2E 테스트로 작성)

```typescript
// BDD 스타일의 인수 테스트
describe('회원가입 쿠폰 지급 시나리오', () => {
    it('추천인 코드를 입력하고 가입하면 양쪽 모두 쿠폰을 받아야 한다.', async () => {
        // [Given] 추천인이 이미 존재하고
        const referrer = await createUser('referrer@test.com');

        // [When] 가입자가 추천인 코드를 넣고 가입했을 때
        const response = await request(app)
            .post('/auth/register')
            .send({ email: 'new@test.com', referrerCode: referrer.code });

        // [Then] 가입자와 추천인 모두 쿠폰함에 10% 쿠폰이 하나씩 있어야 한다.
        expect(response.status).toBe(201);
        expect(await getCouponCount('new@test.com')).toBe(1);
        expect(await getCouponCount('referrer@test.com')).toBe(1);
    });
});
```

### 3단계: TDD - 세부 로직 조각 (The Implementation)

이제 위 큰 테스트(Red)를 통과시키기 위해, 내부의 `CouponService`를 TDD로 정교하게 깎아 나갑니다.

```typescript
// CouponService.spec.ts (TDD Inner Loop)
describe('CouponService', () => {
    it('추천인 쿠폰을 생성할 때 만료일은 오늘로부터 30일 뒤여야 한다.', () => {
        const coupon = service.createReferralCoupon(userId);
        expect(coupon.expiredAt).toBe(thirtyDaysLater);
    });
});
```

---

### 4. 결과: 설계와 품질이 결합된 코드

이 과정을 거친 코드는 다음과 같은 강점을 가집니다.

1. **요구사항 누락 방지**: ATDD로 먼저 못을 박았기 때문에 추천인에게 쿠폰을 안 주는 버그는 원천 차단됩니다.
2. **높은 테스트 가능성**: TDD를 위해 생성된 서비스들은 자연스럽게 **의존성 주입(DI)**을 받게 되어, 나중에 유지보수하기 매우 쉬워집니다.
3. **신뢰감 있는 배포**: 내부 로직(TDD)부터 전체 흐름(ATDD)까지 이중으로 보호받고 있으므로, 고치고 배포하는 것이 두렵지 않습니다.

---

### 전문가의 총평: "테스트는 개발의 끝이 아니라 시작이다"

요구사항을 보자마자 `Service` 클래스에 타이핑을 시작하지 마십시오.

잠시 멈추고 **"무엇이 이 기능의 성공인가?(ATDD)"**를 자문하고, **"사용자는 어떤 경험을 하는가?(BDD)"**를 선언한 뒤, **"작은 논리들을 어떻게 하나씩 증명할까?(TDD)"**의 순서로 접근하십시오. 이 전략적인 사고 방식이 여러분을 단순 코더(Coder)에서 위대한 엔지니어(Engineer)로 도약시켜 줄 것입니다.
 Jennifer 정 (Master Software Architect)
