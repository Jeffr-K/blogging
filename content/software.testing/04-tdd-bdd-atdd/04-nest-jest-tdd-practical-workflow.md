---
title: "NestJS와 Jest를 이용한 실전 TDD 워크플로우 가이드"
author: jeffrey
date: 2026-04-13
tags: ["how-to", "tdd-workflow", "nestjs", "jest", "red-green-refactor"]
---

## NestJS와 Jest를 이용한 실전 TDD 워크플로우 가이드

이제 관념적인 이론을 버리고 실제 코드로 리듬을 타볼 시간입니다. NestJS 프로젝트에서 새로운 기능을 개발할 때, 어떻게 **TDD** 사이클이 우리의 설계를 이끌어가는지 '배송비 계산기'를 만드는 과정을 통해 단계별로 체험해 보겠습니다.

---

### Phase 1: Red - 실패하는 테스트 작성

우선 배송비 정책을 정의하는 테스트를 먼저 만듭니다. (아직 서비스 클래스도 생성하지 않은 상태입니다.)

```typescript
// src/shipping/shipping.service.spec.ts
describe('ShippingService', () => {
    let service: ShippingService;

    it('5만원 미만 구매 시 배송비 3000원을 부과해야 한다.', () => {
        // [Arrange]
        const amount = 30000;
        // [Act]
        const fee = service.calculateFee(amount); // 컴파일 에러 발생 (정상!)
        // [Assert]
        expect(fee).toBe(3000);
    });
});
```

컴파일조차 되지 않는 이 상태가 TDD의 시작입니다. 이제 테스트를 돌리면 당연히 실패합니다.

### Phase 2: Green - 최소한의 코드로 통과

테스트를 통과시키기 위해 가장 게으른 방식으로 코드를 작성합니다. 심지어 값을 하드코딩해도 좋습니다.

```typescript
// src/shipping/shipping.service.ts
@Injectable()
export class ShippingService {
  calculateFee(amount: number): number {
    return 3000; // 일단 무조건 3000 반환 (Green 성공!)
  }
}
```

이제 테스트는 통과합니다. 마음의 평화를 얻은 뒤, 다음 조건(5만원 이상 무료 배송)을 추가하여 다시 Red를 만듭니다.

```typescript
it('5만원 이상 구매 시 배송비는 0원이어야 한다.', () => {
    expect(service.calculateFee(50000)).toBe(0); // 다시 실패(Red)!
});
```

이 실패를 고치기 위해 실제 `if` 문을 추가하여 다시 Green으로 만듭니다.

### Phase 3: Refactor - 설계 다듬기

이제 기능은 완성되었습니다. 테스트라는 든든한 아군이 있으니 코드를 예쁘게 고칩니다.

```typescript
// [Refactor] 상수화 및 가독성 개선
export class ShippingService {
  private readonly FREE_SHIPPING_LIMIT = 50000;
  private readonly DEFAULT_FEE = 3000;

  calculateFee(amount: number): number {
    return amount >= this.FREE_SHIPPING_LIMIT ? 0 : this.DEFAULT_FEE;
  }
}
```

리팩토링 후에도 테스트가 여전히 Green이라면 성공입니다!

---

### 시니어의 팁: "한 입에 먹기 좋게 갈기갈기 찢어라"

TDD가 실패하는 가장 큰 이유는 한꺼번에 너무 큰 기능을 테스트하려 하기 때문입니다.

- 처음에는 아주 사소한 성공(예: 입력이 0일 때 0 반환)부터 시작하십시오.
- 한 발짝씩 나아가며 테스트 케이스를 촘촘히 쌓으십시오.

TDD의 리듬에 익숙해지면, 여러분은 더 이상 "이 코드가 동작할까?"라고 불안해하지 않게 됩니다. 코드가 동작한다는 사실을 이미 테스트로 확인하며 한 줄 한 줄 써 내려가기 때문입니다. 이 **'통제된 리듬'**이 주는 쾌감을 꼭 느껴보시길 바랍니다.
 Jennifer 정 (Master Backend Lead)
