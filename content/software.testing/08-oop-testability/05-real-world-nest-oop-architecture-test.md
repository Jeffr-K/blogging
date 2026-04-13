---
title: "실전 사례: 복잡한 NestJS 서비스 아키텍처의 OOP 기반 검증"
author: jeffrey
date: 2026-04-13
tags: ["real-world-case", "nestjs", "oop-architecture", "strategy-pattern", "factory-pattern", "test-strategy"]
---

## 실전 사례: 복잡한 NestJS 서비스 아키텍처의 OOP 기반 검증

현실의 결제 시스템은 매우 복잡합니다. 사용자가 '카카오페이'로 결제하면 카카오 전용 로직을, '토스'로 결제하면 토스 전용 로직을 타야 하죠. 이 거대한 분기 로직을 하나의 서비스 파일에 다 밀어 넣으면 테스팅은 지옥이 됩니다. 이번 실무 사례에서는 OOP의 정수인 **'전략 및 팩토리 패턴'**을 활용하여 이 거대 로직을 어떻게 찢고 검증했는지 공유합니다.

---

### 1. 설계: 전략 패턴과 팩토리의 조화

- **PaymentStrategy (Interface)**: `pay(amount)` 메서드 정의.
- **KakaoStrategy, TossStrategy (Implementations)**: 각 사별 API 연동 로직.
- **PaymentFactory**: 사용자 선택에 따라 적절한 `PaymentStrategy`를 반환.

### 2. 테스팅 전략: "나누어 정복하라"

#### 1) 개별 전략 테스트 (Unit)

`KakaoStrategy`가 카카오 API 명세에 맞춰 올바른 페이로드를 생성하고 전송하는지 직접 검증합니다. 이때 `TossStrategy`는 신경 쓸 필요가 없습니다.

#### 2) 팩토리 테스트 (Unit)

"카카오 페이 코드를 넘겼을 때 정말로 `KakaoStrategy` 인스턴스가 반환되는가?"라는 **'선택의 논리'**만 검증합니다.

#### 3) 메인 서비스 테스트 (Mocking Strategy)

정작 결제를 주관하는 `OrderService`는 실제 결제사가 누군지 몰라도 됩니다. 단지 팩토리가 주는 `Strategy`의 `pay()` 메서드를 호출하는지만 확인하면 됩니다.

```typescript
it('주문 생성 시 선택된 결제 전략을 실행해야 한다.', async () => {
    // [Arrange] 
    const mockStrategy = { pay: jest.fn() }; // 가짜 전략
    const mockFactory = { getStrategy: () => mockStrategy }; // 가짜 팩토리
    
    // [Act]
    await orderService.placeOrder('order-id', 'KAKAO');
    
    // [Assert]
    expect(mockStrategy.pay).toHaveBeenCalled(); // 전략이 실행되었는지만 확인!
});
```

---

### 3. 사후 분석: OOP 설계가 주는 테스트의 경쾌함

이 설계가 가져온 혁신은 다음과 같습니다.

1. **테스트 고립**: 결제사가 100개로 늘어나도 `OrderService` 테스트는 단 한 줄도 고칠 필요가 없습니다.
2. **높은 커버리지**: 각 전략이 독립되어 있으므로 복잡한 결제 에러 케이스를 각 전용 테스트 파일에서 아주 정밀하게 타격할 수 있습니다.
3. **용이한 목킹**: 인터페이스 기반 설계 덕분에 테스트 코드 상에서 커다란 외부 연동 객체를 만들 필요 없이 단순한 함수 하나만 뚫어주면 됩니다.

---

### 전문가의 총평: "객체 간의 통신을 테스트하라"

OOP 테스팅의 정수는 객체 내부의 코드를 일일이 확인하는 것이 아니라, 객체들이 **'약속된 계약(Interface)에 따라 서로 소통하는가'**를 확인하는 것입니다.

복잡한 비즈니스를 개별 책임을 가진 작고 단단한 객체들로 찢으십시오. 그리고 그 객체들이 팩토리와 전략 패턴을 통해 유유히 흐르게 하십시오. 그 흐름을 테스트로 포착하는 순간, 여러분의 아키텍처는 세상에서 가장 견고하고 관리하기 쉬운 살아있는 유기체가 될 것입니다.
 Jennifer 정 (Senior Solution Architect)
