---
title: "실전 사례: fp-ts를 이용한 복잡한 금융 결제 로직의 무결성 검증"
author: jeffrey
date: 2026-04-13
tags: ["fp-ts", "real-world-case", "banking-logic", "task-either", "test-strategy", "functional-programming"]
---

## 실전 사례: fp-ts를 이용한 복잡한 금융 결제 로직의 무결성 검증

금융 시스템에서 '소수점 하나 차이'는 수억 원의 손실을 의미합니다. 이런 곳일수록 변수가 많은 가상 객체(Mock) 보다는 **'수학적 불변성'**에 기댄 함수형 설계가 빛을 발합니다. 이번 실무 사례에서는 `fp-ts` 라이브러리를 통해 다중 수수료 정책과 복잡한 세금 계산이 얽힌 정산 시스템을 어떻게 설계하고 100% 무결성을 증명했는지 공유합니다.

---

### 1. 요구사항: 다단계 정산 파이프라인

"주문 데이터를 받아 국가별 세금을 계산하고, 플랫폼 수수료를 차감한 뒤, 최종 정산 금액을 상점 계좌로 입금한다. 중간에 하나라도 계산 오류가 나면 전체 중단하고 원인을 반환한다."

### 2. 설계: Pipe로 구축된 데이터 고속도로

우리는 모든 세부 로직을 `Either`를 반환하는 순수 함수로 찢었습니다.

```typescript
// 1. 순수 로직 (Core)
const calculateTax = (order: Order) => E.right({ ...order, tax: order.price * 0.1 });
const applyCoupon = (order: OrderWithTax) => E.right({ ...order, total: order.price - order.coupon });

// 2. 파이프라인 조립
const processSettlement = (order: Order) => pipe(
  order,
  calculateTax,
  E.chain(applyCoupon),
  E.chain(deductFee),
  E.map(toResponse)
);
```

### 3. 테스팅 전략: "Mocking이 사라진 평화"

- **순수성 검증**: `processSettlement` 함수는 그 자체로 거대한 순수 함수입니다. 우리는 실제 DB나 결제 API 없이도 수만 가지의 주문 페이로드(Payload)를 넣어보며 결과값의 정확성을 0.001ms 단위로 검증했습니다.
- **속성 기반 테스팅(PBT)과의 결합**: `fast-check`를 이 파이프라인에 연결하여 "그 어떤 주문 금액이 들어와도 정산 금액은 0보다 크거나 같아야 한다"라는 **불변 속성(Invariant)**을 기계적으로 수만 번 증명했습니다.

### 4. 사후 분석: 엔지니어가 얻은 것

1. **에러 추적의 명확성**: `Left` 타입에 담긴 에러 코드를 통해 어느 단계(세금? 수수료?)에서 계산이 틀어졌는지 즉각 파악 가능해졌습니다.
2. **리팩토링의 자유**: 파이프라인 내부 함수의 순서를 바꾸거나 로직을 고쳐도, 입력과 출력의 데이터 타입만 맞으면 배포 즉시 안전함이 보장되었습니다.

---

### 전문가의 총평: "단단함은 설계에서 온다"

결제 로직이 복잡하다고 해서 테스트 코드가 복잡할 필요는 없습니다.

함수형으로 설계된 시스템은 마치 '레고 블록'과 같습니다. 각 블록(함수)을 검증하고, 조립된 전체 모양을 검증하십시오. `fp-ts`와 같은 도구는 여러분에게 그 조립을 가장 안전하게 도와주는 '매뉴얼'이 되어줄 것입니다. 복잡함에 맞서지 말고, 순수함으로 그 복잡함을 감싸 안으십시오.
 Jennifer 정 (Master Functional Architect)
