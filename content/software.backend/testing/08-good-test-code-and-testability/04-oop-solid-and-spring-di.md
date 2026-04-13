---
title: "SOLID 원칙과 스프링(Spring) 기반의 설계 미학: 엔터프라이즈 테스팅"
author: jeffrey
date: 2026-04-13
tags: ["spring", "java", "solid", "di", "testing-strategy", "junit", "mockito"]
---

## SOLID 원칙과 스프링(Spring) 기반의 설계 미학: 엔터프라이즈 테스팅

엔터프라이즈 환경에서의 테스팅은 단순히 기능을 확인하는 것을 넘어, 수십 개의 서비스가 얽힌 복잡한 **'의존성 그래프(Dependency Graph)'**를 어떻게 효과적으로 제어하느냐의 싸움입니다. **Spring Framework**의 핵심인 **DI(Dependency Injection)**는 사실상 **'테스트 코드를 짜기 위한 배려'**에서 탄생했습니다.

---

### 1. 스프링 DI와 테스트 고립 (Isolation)의 상관관계

스프링이 없다면 우리는 의존 객체를 직접 생성(`new`) 해야 합니다. 이는 테스트 코드에서도 똑같이 적용되어, 테스트 하나를 위해 수많은 객체를 수동으로 조립해야 하는 고통(Object Mother)을 초래합니다.

- **스프링의 한 수**: `@Service`, `@Repository` 등으로 빈(Bean)을 등록하고 주입받음으로써, 테스트 시점에 실제 빈 대신 **가짜(Mock)**를 언제든 끼워 넣을 수 있는 **'느슨한 결합(Loose Coupling)'**을 강제합니다.

### 2. SOLID 원칙이 주는 테스트 이득 (Spring Case Study)

#### 2.1 SRP(단일 책임)와 테스트 가독성

하나의 클래스가 너무 많은 책임을 지면(JUnit에서 Mock 개수가 5개를 넘을 때), 테스트 코드는 이미 읽기 힘든 '스파게티'가 됩니다.

```java
// [Bad] 너무 많은 책임을 지는 서비스 (Spring)
@Service
public class OrderService {
    @Autowired private PaymentClient paymentClient;
    @Autowired private StockRepository stockRepository;
    @Autowired private MailSender mailSender;
    @Autowired private CouponProcessor couponProcessor;
    @Autowired private AuditLogger auditLogger; // ... 너무 많다!
}
```

이런 서비스는 단위 테스트를 한 번 하려면 5개의 `@Mock` 객체를 정의하고 `when(...)` 설정을 지겹게 해야 합니다. **SRP를 위반한 설계**가 테스트 코드를 통해 우리에게 경고를 보내는 순간입니다.

#### 2.2 DIP(의존성 역전)와 Mockito의 환상 궁합

DIP를 준수하여 인터페이스(Interface)를 사용하면, `Mockito` 같은 라이브러리를 통해 실제 인프라 없이 비즈니스 로직만 고립시킬 수 있습니다.

```java
// [Good] DIP 기반의 고립된 단위 테스트 (Java/JUnit)
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock private PaymentClient paymentClient; // 구체 클래스가 아닌 인터페이스 모킹
    @InjectMocks private OrderService orderService;

    @Test
    void 결제_성공_시_주문_상태가_변경되어야_함() {
        // Arrange
        given(paymentClient.pay(any())).willReturn(true);
        
        // Act & Assert (스프링 컨텍스트 없이 순수 Java로 실행되므로 초고속)
        orderService.processOrder(1L);
    }
}
```

### 3. @SpringBootTest vs Plain Unit Test (시니어의 선택)

많은 엔지니어가 습관적으로 `@SpringBootTest`를 사용하여 전체 ApplicationContext를 띄웁니다. 하지만 이는 **'나쁜 테스트 코드'**로 가는 지름길입니다.

1. **지연 시간**: Context 로딩에 수 초~수십 초가 걸리면 테스트 주기가 파괴됩니다.
2. **커플링**: 전체 인프라가 엮여 있어 실패 원인을 특정하기 어렵습니다.
3. **진정한 단위 테스트**: 오직 `Mockito`와 생성자 주입만을 활용한 **'순수 단위 테스트'**는 스프링에 의존하지 않으므로 변경에 안전하며 속도가 압도적입니다.

---

### 4. 시무 (Senior's Sight): "의존성을 드러내는 것이 미덕이다"

생성자 주입(Constructor Injection)을 사용하십시오. 필드 주입(`@Autowired` on field)은 테스트 코드에서 의존성을 숨기고 리플렉션을 강제하게 만듭니다.

**생성자 주입**을 하면, 테스트 코드에서 객체를 생성할 때 어떤 Mock이 필요한지 빨간색 컴파일 에러로 알려줍니다. 이는 우리에게 **"당신의 클래스가 현재 이만큼의 책임을 지고 있고, 이만큼의 외부 의존성이 필요합니다"**라는 명확한 설계 피드백을 줍니다.

테스트하기 불편한 코드는 설계가 뒤틀린 것입니다. 스프링이라는 강력한 무기를 '테스트 가능한 깨끗한 거버넌스'를 구축하는 데 사용하십시오.
Jennifer 정 (Enterprise Java Architect)
