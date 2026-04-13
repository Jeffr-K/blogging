---
title: "실전 사례: NestJS 서비스의 비즈니스 규칙 고립 검증"
author: jeffrey
date: 2026-04-13
tags: ["unit-testing", "real-world-case", "nestjs", "jest", "domian-logic"]
---

## 실전 사례: NestJS 서비스의 비즈니스 규칙 고립 검증

앞서 우리는 단위 테스트의 철학과 도구들을 배웠습니다. 이제 이 모든 지식을 합쳐 실제 백엔드 개발 현장에서 마주치는 **'복잡한 주문 정책'**을 검증해 보겠습니다. 좋은 단위 테스트는 데이터베이스나 외부 API 없이도, 우리의 비즈니스 지성이 코드로 완벽하게 보호되고 있음을 증명해야 합니다.

---

### 1. 실전 시나리오: 포인트 적립 시스템

회원이 상품을 구매했을 때 등급에 따라 포인트를 적립해 주는 로직입니다.

- **규칙 1**: 일반 회원은 결제 금액의 1%, VIP 회원은 5%를 적립한다.
- **규칙 2**: 10만원 이상 결제 시 보너스 포인트 1,000점을 추가 증정한다.
- **제약**: 이 과정에서 외부 사용자 활동 로그를 기록해야 하지만, 로그 기록 실패가 포인트 적립에 영향을 주어서는 안 된다.

### 2. 비즈니스 소스 코드 (PointService)

```typescript
@Injectable()
export class PointService {
  constructor(
    @Inject('IAuditLogger') private readonly logger: IAuditLogger,
  ) {}

  calculate(amount: number, isVip: boolean): number {
    let point = isVip ? amount * 0.05 : amount * 0.01;
    if (amount >= 100000) point += 1000;

    // 로깅 시도 (비즈니스 결과엔 영향 미치지 않음)
    try {
      this.logger.log(`Points calculated: ${point}`);
    } catch (e) {
      // 로깅 실패해도 무시
    }

    return Math.floor(point);
  }
}
```

### 3. 고립된 실전 단위 테스트 (PointService.spec.ts)

우리는 `IAuditLogger` 인터페이스를 **Mocking** 하여 고립시키고, 오직 `PointService`의 계산 로직(Pure Logic)만 타격합니다.

```typescript
describe('PointService (Real World Case)', () => {
    let service: PointService;
    let mockLogger: jest.Mocked<IAuditLogger>;

    beforeEach(() => {
        // [Arrange] 공통 준비: 로거 인터페이스 모킹
        mockLogger = { log: jest.fn() };
        service = new PointService(mockLogger);
    });

    it('VIP 회원이 10만원 미만 구매 시 5%의 포인트를 적립해야 한다.', () => {
        // [Arrange]
        const amount = 50000;
        const isVip = true;
        const expected = 2500; // 50000 * 0.05

        // [Act]
        const result = service.calculate(amount, isVip);

        // [Assert]
        expect(result).toBe(expected);
        expect(mockLogger.log).toHaveBeenCalled(); // 로깅이 호출되었는지 확인
    });

    it('일반 회원이 10만원 이상 구매 시 1% + 보너스 1000점을 적립해야 한다.', () => {
        // [Arrange]
        const amount = 100000;
        const isVip = false;
        const expected = 2000; // (100000 * 0.01) + 1000

        // [Act]
        const result = service.calculate(amount, isVip);

        // [Assert]
        expect(result).toBe(expected);
    });
});
```

---

### 4. 이 테스트가 가치 있는 이유

1. **DB 연결 불필요**: 실제 `User` 테이블이나 `AuditLog` 테이블을 건드리지 않고 메모리 내에서 즉시 실행됩니다.
2. **경계값의 수평적 확장**: 1원 차이(99,999원 vs 100,000원)에 따라 보너스 포인트가 갈리는 민감한 비즈니스 로직을 아주 저렴한 비용으로 수만 가지 케이스까지 늘릴 수 있습니다.
3. **독립성**: 만약 로거(Logger) 시스템이 고장 나도 이 테스트는 통과해야 합니다. 이 테스트가 실패했다면 그것은 명백히 **'포인트 계산 수식'**이 틀린 것입니다.

---

### 결론: 단위 테스트는 비즈니스 로직의 수호자다

단위 테스트는 거창한 도구가 아닙니다. 여러분이 설계한 비즈니스 규칙이 시간이 지나고 개발자가 바뀌어도 **'변함없이 지켜지고 있음'**을 기계적으로 증명하는 가장 강력한 수단입니다.

실전 환경의 복잡함에 매몰되지 마십시오. 문제를 작게 쪼개고 외부를 고립시키십시오. 그러면 여러분의 서비스는 그 어떤 거대한 비즈니스 파고에도 무너지지 않는 단단한 품질의 성채가 될 것입니다.
 Jennifer 정 (Master Backend Architect)
