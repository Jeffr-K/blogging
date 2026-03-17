2. Eventual Consistency & Saga: "애그리거트 간의 조율"
이제 이벤트가 안전하게 전파되면, 다른 애그리거트들이 이를 받아 자신의 상태를 바꿉니다.

Scenario (하트 충전):
Payment 애그리거트: PaymentVerified 이벤트 저장 (Outbox).
Outbox Worker: 이벤트를 NATS로 발행.
Wallet
 모듈: 이벤트를 수신하여 Wallet.charge() 실행 후 WalletCharged 이벤트 저장 (Outbox).
이 과정에서 
Wallet
 충전이 실패한다면? Saga 패턴이 발동하여 Payment 애그리거트에게 
Refund
 명령이나 PaymentFailed 상태로 되돌리는 **보상 트랜잭션(Compensating Transaction)**을 날립니다.

---

# 분산 시스템의 결함 복구 전략: 보상 트랜잭션 (Compensating Transaction)

소개팅 앱 '매파'와 같은 서비스에서 **결제 완료와 재화 충전**은 서로 다른 모듈(Payment, Wallet)에 속한 별개의 작업입니다. 이처럼 여러 애그리거트나 마이크로서비스에 걸쳐 있는 작업을 처리할 때, 정통적인 DB 트랜잭션(`COMMIT/ROLLBACK`)은 성능과 확장성 문제로 사용하기 어렵습니다.

이때 활용되는 것이 **Saga 패턴**이며, 그 중심에는 실패한 작업을 논리적으로 되돌리는 **보상 트랜잭션(Compensating Transaction)**이 있습니다.

---

## 1. 보상 트랜잭션이란?

보상 트랜잭션은 **이미 완료된(Committed) 작업의 효과를 취소하거나 상쇄하는 새로운 작업**을 의미합니다. 

이벤트 소싱(Event Sourcing) 시스템에서는 이미 발생한 과거의 기록(Event)을 지울 수 없습니다. 대신, 그 반대의 효과를 내는 **새로운 이벤트**를 발행하여 시스템을 결과적으로 일관된 상태(Eventual Consistency)로 만듭니다.

---

## 2. 시나리오: 하트 충전 실패

결제 모듈에서 결제는 성공했지만, 지갑 모듈에서 알 수 없는 이유로 충전이 실패한 상황을 가정해 봅시다.

### **[비즈니스 흐름]**
1. **결제 완료**: `PurchaseVerifiedEvent`가 발생합니다. (상태: VERIFIED)
2. **충전 시도**: 지갑 모듈이 이 이벤트를 듣고 `charge()`를 실행합니다.
3. **충전 실패**: 지갑 동결이나 유효성 검사 실패로 `YooseulChargeFailedEvent`가 발생합니다.
4. **보상 트랜잭션 실행**: 결제 모듈이 실패 이벤트를 수신하고, 이미 완료된 결제를 **'환불(Refunded)'** 상태로 변경합니다.

---

## 3. 구현 핵심: 멱등성 (Idempotency)

보상 트랜잭션은 네트워크 지연이나 재시도로 인해 **여러 번 실행될 가능성**이 있습니다. 따라서 모든 보상 로직은 중복 실행되어도 안전해야 합니다.

```typescript
// Payment Aggregate 내부
public refund(): void {
  // 이미 환불 처리가 되었다면 중복 이벤트를 발생시키지 않음 (멱등성 보장)
  if (this.status === PaymentStatus.REFUNDED) return;
  
  // 환불 이벤트 발생
  this.applyEvent(new PurchaseRefundedEvent(this.id, new Date()));
}
```

---

## 4. 왜 'UNDO'가 아닌 'REDO'인가?

많은 개발자가 실패 시 데이터를 직접 삭제(`DELETE`)하거나 이전 상태로 덮어쓰려 합니다. 하지만 이벤트 소싱 아키텍처에서 보상 트랜잭션은 반드시 **새로운 사건**으로 기록되어야 합니다.

- **추적성(Traceability)**: "왜 이 결제가 환불되었나?"라는 물음에 대해 "충전이 실패했기 때문에 환불되었다"는 인과관계를 로그로 완벽히 증명할 수 있습니다.
- **감사(Audit)**: 금융 법규나 정산 시, 실패한 내역 자체가 중요한 근거가 됩니다. 기록을 지우는 것은 금기 사항입니다.

---

## 5. 결론: 분산 시스템의 신뢰를 쌓는 법

모든 시스템이 완벽할 수는 없습니다. 중요한 것은 **실패했을 때 어떻게 우아하게 복구하느냐**입니다. 

결제 성공 후 데이터가 꼬이는 것을 두려워하지 마세요. **보상 트랜잭션**이라는 안전장치를 설계해 두었다면, 시스템은 잠시 어긋나더라도 결국(Eventually) 올바른 진실에 도달하게 될 것입니다.

---
