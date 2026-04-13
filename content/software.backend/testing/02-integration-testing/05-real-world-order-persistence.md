---
title: "실전 사례: 주문 저장 및 트랜잭션 무결성 검증"
author: jeffrey
date: 2026-04-13
tags: ["integration-testing", "transaction-integrity", "database-consistency", "nestjs", "typeorm"]
---

## 실전 사례: 주문 저장 및 트랜잭션 무결성 검증

백엔드 시스템에서 가장 치명적인 버그는 **'데이터 불일치'**에서 옵니다. 주문은 완료되었는데 결제 정보가 누락되거나, 재고는 줄어들지 않는 식이죠. 이러한 **'트랜잭션(Transaction) 무결성'**은 단위 테스트에서는 절대 검증할 수 없습니다. 실제 데이터베이스 시스템과 부딪히며 증명해야 하는 통합 테스팅의 핵심 영역입니다.

---

### 1. 실전 시나리오: 주문 및 재고 처리

"사용자가 상품을 주문하면, 주문 데이터가 생성됨과 동시에 해당 상품의 재고가 차감되어야 한다. 만약 재고 차감 중 에러가 발생하면 전체 주문은 롤백되어야 한다."

### 2. NestJS 기반의 트랜잭션 소스 코드

```typescript
@Injectable()
export class OrderService {
  constructor(private dataSource: DataSource) {}

  async placeOrder(orderData: CreateOrderDto) {
    // 1. 트랜잭션 시작
    return await this.dataSource.transaction(async (manager) => {
      // 2. 주문 저장
      const order = await manager.save(Order, orderData);

      // 3. 재고 차감 (여기서 실패하면 롤백되어야 함)
      const stock = await manager.findOne(Stock, { where: { productId: orderData.productId } });
      if (stock.quantity < orderData.quantity) {
        throw new Error('재고 부족');
      }
      stock.quantity -= orderData.quantity;
      await manager.save(stock);

      return order;
    });
  }
}
```

### 3. 실전 통합 테스트: 데이터 원자성 증명

단순히 "성공"만 테스트하는 게 아니라, **"실패 시 롤백"** 여부를 실제 DB 조회를 통해 확인하는 것이 포인트입니다.

```typescript
describe('OrderService - Transaction Integrity', () => {
    it('재고가 부족하여 에러가 발생하면, 주문 데이터도 DB에 생성되지 않아야 한다 (Atomicity)', async () => {
        // [Arrange] 
        // 1. 재고 5개 준비
        await stockRepo.save({ productId: 99, quantity: 5 });
        // 2. 10개 주문 시도 (실패 예상)
        const dtoDate = { productId: 99, userId: 1, quantity: 10 };

        // [Act]
        try {
            await orderService.placeOrder(dtoDate);
        } catch (e) {
            // 에러가 발생하는 것은 당연
        }

        // [Assert]
        // 핵심: 에러가 났을 때 주문 데이터가 정말로 DB에 없는지 확인
        const orderInDb = await orderRepo.findOne({ where: { productId: 99 } });
        expect(orderInDb).toBeFalsy(); // 롤백되어 데이터가 없어야 함!
    });
});
```

---

### 4. 통합 테스트가 증명한 가치

1. **상호작용 검증**: `Order` 엔터티와 `Stock` 엔터티가 동일한 트랜잭션 매니저(`manager`)를 타고 흐르는지 실제 DB 상태로 증명했습니다. 
2. **제약 조건 확인**: 만약 `productId`가 외래키(FK)로 묶여있다면, 가짜 데이터를 넣었을 때 DB가 내뿜는 `FK Violation` 에러를 이 단계에서 잡을 수 있습니다. 
3. **레이스 컨디션 맛보기**: 여러 테스트를 동시에 돌려보며, 가끔 발생하는 데드락(Deadlock)이나 격리 수준(Isolation Level) 이슈를 미리 탐지할 수 있는 기반이 됩니다.

---

### 결론: 통합 테스트는 데이터의 최후 보루다

여러분의 서버가 아무리 화려한 아키텍처를 가졌더라도, 결국 남는 것은 데이터베이스에 기록된 데이터입니다. 

단위 테스트를 통해 로직의 완결성을 기했다면, 통합 테스트를 통해 **"우리의 시스템이 현실 세계(DB, Network)에 발을 딛고도 안전하게 데이터를 보존하는지"**를 증명하십시오. 트랜잭션 무결성을 통과한 코드만이 상용 환경으로 나갈 자격을 얻습니다.
 Jennifer 정 (Senior Persistence Specialist)
