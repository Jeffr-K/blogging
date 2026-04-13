---
title: "테스트 더블: Mock, Spy, Stub의 전략적 활용"
author: jeffrey
date: 2026-04-13
tags: ["test-double", "mock", "stub", "spy", "jest-mocks", "unit-testing"]
---

## 테스트 더블: Mock, Spy, Stub의 전략적 활용

훌륭한 배우에게는 위험한 장면을 대신해 줄 스턴트맨(더블)이 있듯, 훌륭한 단위 테스트에는 복잡한 외부 의존성을 대신해 줄 **'테스트 더블(Test Double)'**이 있습니다. 하지만 무작정 가짜 객체를 만든다고 다 좋은 테스트는 아닙니다. 각 더블의 성격과 용도를 정확히 이해해야 '진짜' 고립된 테스트를 완성할 수 있습니다.

---

### 1. 테스트 더블의 종류와 역할

영화 현장처럼, 테스팅 세계에도 용도에 맞는 '스턴트맨'들이 있습니다.

- **Stub (스텁)**: "상태(State)"를 모사합니다. 호출되면 미리 준비된 고정된 데이터를 반환합니다. 로직의 경로를 결정하는 데 사용됩니다.
- **Mock (모의 객체)**: "상위 작용(Interaction)"을 확인합니다. 특정 함수가 호출되었는지, 몇 번 호출되었는지, 어떤 인자가 넘어갔는지 그 '행위' 자체를 검증합니다.
- **Spy (스파이)**: "기록"을 남깁니다. 실제 객체처럼 동작하면서도 뒤에서 호출 이력을 몰래 기록합니다. 실제 동작을 유지하면서 감시하고 싶을 때 사용합니다.
- **Fake (페이크)**: 실제로 동작하는 "간이 버전"입니다. 인메모리 DB가 대표적인 예시입니다.

### 2. NestJS와 Jest에서의 실전 활용

#### 2.1 Stub 활용: "유저가 있다고 가정하자"

```typescript
// 유저가 존재할 때의 '상태'를 스텁으로 정의
const mockUserRepo = {
    findById: jest.fn().mockResolvedValue({ id: 1, name: 'Jeffrey' })
};
```

#### 2.2 Mock 활용: "메일이 정말로 발송되었는가?"

```typescript
// 메일 발송이라는 '행위'를 모킹하여 확인
it('결제 완료 시 사용자에게 알림 메일을 보내야 한다.', async () => {
    const mailSpy = jest.spyOn(mailService, 'send');
    
    await paymentService.complete(orderId);
    
    // 호출 여부와 인자 검증
    expect(mailSpy).toHaveBeenCalledWith(expect.stringContaining('@'));
});
```

### 3. 과도한 모킹(Over-Mocking)의 위험성

시니어 엔지니어는 모킹을 최소화하려 노력합니다.

- **문제점**: 내부 구현을 너무 시시콜콜하게 모킹하면(White-box Testing), 소스 코드의 로직을 살짝만 리팩토링해도 테스트가 우수수 깨집니다.
- **해결책**: 가급적 **'출력(Output)'**과 **'상태 변화'**를 검증하는 데 집중하고, 모킹은 반드시 필요한 외부 I/O(DB, Network)에만 한정하십시오.

---

### 전문가의 한마디: "스턴트맨은 배우를 빛내기 위해 존재한다"

테스트 더블의 목적은 테스트 대상(SUT, System Under Test)을 빛나게 하는 것입니다.

너무 복잡한 가짜 객체를 만드느라 시간을 쏟지 마십시오. 테스트 더블이 복잡해진다면 그것은 테스트 대상이 너무 많은 책임을 지고 있다는 **'설계적 경고'**입니다. 가장 좋은 테스트 더블은 여러분이 그 존재를 잊을 정도로 가볍고 명확하게 제 역할을 수행하는 것입니다.
 Jennifer 정 (Senior Automation Architect)
