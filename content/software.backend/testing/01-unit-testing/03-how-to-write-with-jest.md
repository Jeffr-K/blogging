---
title: "Jest와 AAA 패턴으로 시작하는 표준 작성 가이드"
author: jeffrey
date: 2026-04-13
tags: ["jest", "aaa-pattern", "how-to", "unit-testing", "nestjs"]
---

## Jest와 AAA 패턴으로 시작하는 표준 작성 가이드

테스트 코드는 그 자체로 하나의 '문학 작품'이어야 합니다. 중구난방으로 작성된 테스트는 오히려 유지보수 비용을 높이는 짐이 되곤 합니다. 2026년 현재 가장 널리 쓰이는 테스팅 프레임워크인 **Jest**와, 테스트의 구조를 정립해 주는 **AAA 패턴**을 통해 '누가 봐도 명확한' 단위 테스트를 작성하는 법을 배워봅시다.

---

### 1. AAA 패턴: 테스트의 3단계 구조

모든 훌륭한 단위 테스트는 다음 세 단계의 흐름을 따릅니다.

1. **Arrange (준비)**: 테스트에 필요한 객체들을 생성하고, 입력값(Input)과 기대값(Output)을 설정하는 단계입니다.
2. **Act (실행)**: 실제 테스트하고자 하는 대상(함수나 메서드)을 호출하는 단계입니다.
3. **Assert (검증)**: 호출 결과가 준비해둔 기대값과 일치하는지 확인하는 단계입니다.

### 2. 실전 예제: 주문 할인 계산기 테스팅

NestJS 서비스를 대상으로 AAA 패턴을 적용해 보겠습니다.

#### 2.1 테스트 대상 소스 코드 (discount.service.ts)

```typescript
@Injectable()
export class DiscountService {
  calculate(amount: number): number {
    return amount >= 100000 ? amount * 0.9 : amount;
  }
}
```

#### 2.2 AAA 패턴을 적용한 테스트 코드 (discount.service.spec.ts)

```typescript
describe('DiscountService', () => {
    let service: DiscountService;

    beforeEach(() => {
        service = new DiscountService();
    });

    it('10만원 이상 구매 시 10% 할인을 적용해야 한다.', () => {
        // [Arrange] 준비
        const amount = 100000;
        const expected = 90000;

        // [Act] 실행
        const result = service.calculate(amount);

        // [Assert] 검증
        expect(result).toBe(expected);
        expect(result).toBeLessThan(amount); // 보조 검증 (선택적)
    });
});
```

### 3. Jest의 강력한 매처(Matcher) 활용

단순한 `toBe` 외에도 Jest는 풍부한 검증 도구를 제공합니다.

- **객체 비교**: `toStrictEqual()` (내용물과 타입까지 완벽 검토)
- **에러 검증**: `toThrow()` (특정 에러가 발생하는지 확인)
- **배열 확인**: `toContain()` (특정 요소가 포함되었는지 확인)
- **불리언**: `toBeTruthy()`, `toBeFalsy()`

### 4. 주의사항: "단 한 가지만 검증하라"

하나의 `it` 블록 안에서 너무 많은 것을 검증하려 하지 마십시오.

- **나쁜 예**: 회원가입 테스트 안에서 이메일 발송 여부, DB 저장 여부, 환영 메시지 생성을 한꺼번에 검토.
- **좋은 예**: 각 행위(Behavior)별로 `it` 블록을 쪼갭니다. 그래야 테스트가 실패했을 때 어떤 기능에 문제가 생겼는지 즉각적으로 알 수 있습니다.

---

### 시니어의 팁: "테스트 코드는 소스 코드보다 더 깨끗해야 한다"

테스트 코드가 지저분하면 개발팀은 어느 순간 테스트 수정을 귀찮아하게 되고, 결국 테스트를 주석 처리(Skip) 하는 비극이 발생합니다.

가독성 있는 변수명, 명확한 AAA 구조, 그리고 간결한 Assert 문을 유지하십시오. 잘 짜여진 테스트 코드는 여러분의 프로젝트를 지탱하는 가장 든든한 기술적 뿌리가 될 것입니다.
 Jennifer 정 (Senior QA Engineer)
