---
title: "실전 사례: 회원가입부터 주문 확정까지의 전체 사용자 여정"
author: jeffrey
date: 2026-04-13
tags: ["e2e-testing", "real-world-case", "user-journey", "nestjs", "supertest"]
---

## 실전 사례: 회원가입부터 주문 확정까지의 전체 사용자 여정

E2E 테스트의 진가는 파편화된 기능 검증이 아니라, 데이터가 시스템의 여러 레이어를 관통하며 흐르는 **'사용자 시나리오'**를 검증할 때 드러납니다. 이번 실전 사례에서는 쇼핑몰 서비스의 가장 핵심적인 **'골든 패스(Golden Path)'**인 회원가입부터 주문 완료까지의 전체 여정을 하나의 테스트 흐름으로 완성해 보겠습니다.

---

### 1. 골든 패스(Golden Path) 시나리오

1. **회원가입**: 새로운 사용자가 이메일로 가입한다.
2. **로그인**: 가입한 계정으로 로그인하여 JWT 토큰을 획득한다.
3. **상품 조회**: 판매 중인 상품 목록을 확인한다.
4. **장바구니 담기**: 특정 상품을 골라 장바구니에 추가한다.
5. **주문 및 결제**: 장바구니에 담긴 물건을 최종 결제하고 주문 상태를 확인한다.

### 2. 실전 E2E 테스트 코드 (checkout.e2e-spec.ts)

```typescript
describe('E2E: Complete Shopping Journey', () => {
    let app: INestApplication;
    let accessToken: string;

    it('골든 패스: 사용자는 가입부터 결제까지 막힘없이 수행해야 한다.', async () => {
        // [1단계: 회원가입]
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({ email: 'user@test.com', password: 'password123' })
            .expect(201);

        // [2단계: 로그인 및 토큰 획득]
        const loginRes = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: 'user@test.com', password: 'password123' })
            .expect(200);
        accessToken = loginRes.body.accessToken;

        // [3단계: 상품 목록 조회]
        const productRes = await request(app.getHttpServer())
            .get('/products')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);
        const productId = productRes.body[0].id;

        // [4단계: 장바구니 담기]
        await request(app.getHttpServer())
            .post('/cart')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ productId, quantity: 1 })
            .expect(201);

        // [5단계: 최종 주문 처리]
        const orderRes = await request(app.getHttpServer())
            .post('/orders/checkout')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(201);

        // [검증] 주문 상태가 'PAID' 인지 최종 결과 확인
        expect(orderRes.body.status).toBe('PAID');
        expect(orderRes.body.items.length).toBeGreaterThan(0);
    });
});
```

---

### 3. 이 사례가 증명하는 것

1. **상태의 유지 (Statefulness)**: 회원가입 후 로그인이 되고, 그 토큰으로 다음 액션이 가능한지 '세션의 생명주기'를 성공적으로 검증했습니다. 
2. **API 정합성**: 각 API의 응답 형식이 다음 API의 입력 형식으로 문제없이 이어지는지(예: `productId` 전달) 확인했습니다. 
3. **인프라 결합도**: DB 저장부터 인증 미들웨어 통과까지 시스템 전체가 하나로 묶여 동작함을 증명했습니다.

---

### 전문가의 한마디: "시나리오는 비즈니스의 목숨줄이다"

여러분의 시스템에 이와 같은 **'골든 패스'** 시나리오가 단 5개만 있어도, 배포 당일 주요 기능이 마비되는 대재앙은 막을 수 있습니다. 

잔가지 같은 부차적인 기능(비밀번호 변경, 프로필 이미지 업로드 등)은 단위 테스트로 촘촘히 메우고, 돈이 흐르는 **'핵심 결제 경로'**는 이와 같은 E2E 시나리오로 철통같이 방어하십시오. 그것이 엔지니어가 비즈니스에 줄 수 있는 가장 큰 가치인 **'신뢰'**입니다.
 Jennifer 정 (Senior Solution Architect)
