---
title: "함수형 프로그래밍(FP)과 순수 함수 기반 테스팅"
author: jeffrey
date: 2026-04-13
tags: ["fp", "pure-function", "immutability", "side-effects", "testability"]
---

## 함수형 프로그래밍(FP)과 순수 함수 기반 테스팅

테스트 코드를 작성할 때 가장 우리를 괴롭히는 것은 **'비결정성(Nondeterminism)'**입니다. 어제는 통과했는데 오늘은 실패하는 테스트, 로컬에서는 잘 되는데 CI에서만 실패하는 테스트는 대개 부수 효과(Side Effect)에서 기인합니다. 함수형 프로그래밍(FP)은 이를 **순수 함수(Pure Function)**와 **불변성(Immutability)**으로 해결하여, 테스트의 신뢰도를 극한으로 끌어올립니다.

---

### 1. 부수 효과(Side Effect)의 격리와 테스트 고통

많은 백엔드 로직이 다음과 같은 '오염된' 구조를 가집니다.

```typescript
// [Bad] 테스트하기 힘든 소스 코드 (제어 불가능한 외부 상태에 의존)
@Injectable()
export class PointService {
  async calculateBonus(userId: number) {
    const user = await this.db.findUser(userId); // I/O 부수 효과
    const today = new Date(); // 전역 상태(현재 시간) 의존

    if (user.isVip && today.getDay() === 0) { // 일요일 VIP 보너스
      return user.points * 1.5;
    }
    return user.points;
  }
}
```

위 코드를 테스트하려면 반드시 DB를 Mocking 해야 하고, `Date` 객체를 글로벌하게 가로채야(Clock Mocking) 합니다. 테스트 코드가 복잡해지는 주범입니다.

### 2. 순수 함수로의 '비즈니스 로직 탈출'

FP의 핵심 전략은 **"상태를 바꾸는 행위(I/O)"**와 **"값을 계산하는 행위(Logic)"**를 철저히 분리하는 것입니다. 계산 로직을 순수 함수로 추출하면, 테스트는 그저 값만 넣고 결과를 확인하는 아주 단순한 작업이 됩니다.

#### 2.1 순수 함수 기반의 설계 개선 (NestJS)

```typescript
// [Good] 로직을 순수하게 추출 (Domain Logic)
// 이 함수는 DB도, 시간도 모릅니다. 오직 입력값으로만 판단합니다.
export const getBonusPoints = (points: number, isVip: boolean, dayOfWeek: number): number => {
  const SUNDAY = 0;
  if (isVip && dayOfWeek === SUNDAY) {
    return points * 1.5;
  }
  return points;
};

// 서비스 클래스는 이 순수 함수를 '조합'만 합니다 (Orchestration)
@Injectable()
export class PointService {
  async calculateBonus(userId: number) {
    const user = await this.db.findUser(userId);
    const now = new Date();

    // 순수 함수 호출: 비즈니스 로직의 결함은 여기서만 테스트하면 됨
    return getBonusPoints(user.points, user.isVip, now.getDay());
  }
}
```

### 3. 왜 순수 함수인가? (테스팅 임팩트)

1. **결정성 (Determinism)**: 같은 값을 넣으면 항상 같은 결과가 나옵니다. "가끔 실패하는 테스트"라는 개념 자체가 사라집니다.
2. **고속성 (Speed)**: Mocking 라이브러리도, 외부 연결도 필요 없습니다. 자바스크립트 엔진 메모리 내에서 즉시 실행되므로 수만 개의 테스트도 단 수 초 내에 끝납니다.
3. **불변성 (Immutability)**: 원본 데이터를 수정하지 않고 새 값을 반환하므로, 테스트 도중 객체의 상태가 변질되어 다른 테스트에 영향을 주는 버그가 원천 차단됩니다.

---

### 전문가의 한마디: "I/O는 껍데기일 뿐이다"

우리가 진짜 테스트하고 싶은 것은 "데이터베이스에 값이 들어갔는가"보다 **"비즈니스 규칙이 정확히 계산되었는가"**입니다. 

로직의 정수를 순수 함수로 떼어내십시오. 그러면 여러분의 테스트 코드는 Mocking의 늪에서 벗어나, 아름다운 **'수학적 증명'**의 과정으로 변모할 것입니다. 이것이 함수형 사고가 테스팅에 주는 가장 강력한 무기입니다.
