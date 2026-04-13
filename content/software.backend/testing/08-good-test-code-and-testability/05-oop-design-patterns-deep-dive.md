---
title: "엔터프라이즈 디자인 패턴과 테스트 가독성: 복잡함을 다루는 우아한 기술"
author: jeffrey
date: 2026-04-13
tags: ["design-patterns", "oop", "strategy", "proxy", "decorator", "testability"]
---

## 엔터프라이즈 디자인 패턴과 테스트 가독성: 복잡함을 다루는 우아한 기술

엔터프라이즈 시스템의 실무 로직은 결코 단순하지 않습니다. "VIP 회원이면서 쿠폰을 사용했고, 현금 영수증을 발행하는 경우..."와 같은 무수히 많은 조건이 얽혀있죠. 10년 차 전문가에게 디자인 패턴은 단순히 코드를 구조화하는 도구가 아니라, **'테스트 케이스의 폭발적 증가(Combinatorial Explosion)'**를 막는 최후의 보루입니다.

---

### 1. 전략 패턴 (Strategy Pattern): 테스트 코드의 OCP 실현

하나의 거대한 서비스 클래스에 모든 할인 정책이 `if-else`로 들어있다면, 테스트 코드 한 곳에 수십 개의 시나리오가 뭉쳐있게 됩니다.

- **패턴 도입 전**: 새로운 할인 정책 추가 시 기존 거대 테스트 파일을 수정해야 함. (Side Effect 위험)
- **패턴 도입 후**: 정책별로 독립된 클래스를 갖고, 각 클래스는 **자신만의 고립된 테스트 파일**을 갖습니다.

```java
// [Strategy Pattern 적용 시의 고립된 테스트]
@Test
void 수능_할인_전략은_신분증_지위가_인증되면_20퍼센트_할인한다() {
    DiscountStrategy strategy = new ExamDiscountStrategy();
    assertThat(strategy.calculate(10000)).isEqualTo(8000);
}
```

### 2. 프록시(Proxy)와 데코레이터(Decorator): 기능의 '횡단'을 비즈니스 로직과 분리

백엔드에서 흔히 발생하는 로깅(Logging), 캐싱(Caching), 보안 체크(Security)를 생각해 봅시다.

- **문제점**: 이 모든 부가 기능을 비즈니스 로직(Service Layer)에 때려 박으면, 순수한 비즈니스 규칙만 테스트하기 위해 불필요한 인프라 객체들을 잔뜩 Mocking 해야 합니다.
- **해결**: **데코레이터 패턴**을 통해 비즈니스 객체와 부가 기능 객체를 감쌉니다. 테스트는 **'순수한 비즈니스 객체'**만 검증하면 됩니다.

```typescript
// [Decorator Pattern 적용 시 테스팅 전략]
// 1. 순수한 결제 로직만 테스트 (Mocking 최소화)
const result = paymentService.pay(amount); 

// 2. 캐싱 기능을 담당하는 데코레이터의 '동작 여부'만 별도로 테스트
const cacheDecorator = new PaymentCacheDecorator(paymentService, cacheManager);
await cacheDecorator.pay(amount);
expect(cacheManager.get).toHaveBeenCalled();
```

### 3. 디자인 패턴이 Mocking 비용을 낮추는 원리

1. **인터페이스 기반 결합**: 전략 패턴 등을 활용하면, 구체적인 구현체 대신 인터페이스만 Mocking 하여 주입하면 됩니다. 이는 테스트 설정(`given/when`)을 매우 단순하게 만듭니다.
2. **조합성 (Composition)**: 복잡한 기능을 조립하여 만들 때, 이미 검증된 작은 단위(Strategy 등)들을 신뢰할 수 있으므로 상위 레벨의 테스트는 상호작용(Interaction) 검증만으로 충분해집니다.
3. **가독성 (Semantic Meaning)**: "금액이 10000보다 클 때..."라는 설명 대신 "VipDiscount 전략일 때..."라는 비즈니스 의미가 테스트 코드에 담기게 됩니다.

---

### 4. 시무 (Senior's Sight): "패턴은 테스트를 짧게 만든다"

여러분의 테스트 파일이 수천 줄이 되어간다면, 그것은 코드에 **'다형성(Polymorphism)'**이 부족하다는 결정적인 신호입니다.

**전략 패턴**으로 분기를 쪼개고, **데코레이터**로 부가 기능을 떼어내십시오. 그러면 한 아티클의 테스트 코드는 단 보름달(15줄~30줄) 내외로 줄어들 것입니다. 짧은 테스트 코드는 버그를 숨길 곳이 없게 만듭니다.

디자인 패턴은 여러분의 아키텍처를 유연하게 만들 뿐만 아니라, 여러분의 테스트 코드를 **'가장 완벽한 기술 문서'**로 승격시켜 주는 마법의 도구입니다.
 Jennifer 정 (Design Pattern Specialist)
