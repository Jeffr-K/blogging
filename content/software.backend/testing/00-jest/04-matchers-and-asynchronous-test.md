---
title: "매처(Matchers) 심화와 비동기 테스트의 완벽한 통제"
author: jeffrey
date: 2026-04-13
tags: ["jest", "matchers", "asynchronous", "fake-timers", "advanced-testing"]
---

## 매처(Matchers) 심화와 비동기 테스트의 완벽한 통제

단위 테스트의 절반은 **'값의 비교'**이고, 나머지 절반은 **'시간과의 싸움'**입니다. Jest가 제공하는 풍부한 매처들을 활용하여 더 읽기 쉬운 단언(Assertion)을 작성하고, 비동기 로직과 타이머가 얽힌 복잡한 코드를 어떻게 결정론적으로 검증할 수 있는지 심층적으로 알아봅니다.

---

### 1. 비동기 테스트의 정석: resolves / rejects

`await`와 `try-catch`를 직접 쓰는 대신, Jest의 내장 기능을 사용하면 훨씬 간결한 테스트가 가능합니다.

```typescript
it('유효한 토큰일 경우 성공(Right)을 반환해야 한다.', async () => {
    // resolves를 사용하여 성공 케이스 검증
    await expect(authService.verify(validToken)).resolves.toEqual(true);
});

it('만료된 토큰일 경우 에러가 발생해야 한다.', async () => {
    // rejects를 사용하여 실패(Error) 케이스 검증
    await expect(authService.verify(expiredToken)).rejects.toThrow('Expired');
});
```

### 2. 가짜 타이머 (Fake Timers): 시간의 신이 되는 법

"3분 뒤에 세션이 만료되는지"를 확인하기 위해 실제 3분을 기다릴 수는 없습니다. Jest의 `useFakeTimers`는 시스템의 시간을 여러분의 손아귀에 쥐어줍니다.

```typescript
beforeEach(() => {
    jest.useFakeTimers();
});

it('3분 뒤에는 세션이 만료 상태로 변해야 한다.', () => {
    const session = new Session();
    
    // 3분을 강제로 건너뜀 (현실 시간은 1ms도 흐르지 않음)
    jest.advanceTimersByTime(3 * 60 * 1000); 
    
    expect(session.isExpired()).toBe(true);
});
```

### 3. 커스텀 매처 (Custom Matchers) 확장

"금액이 양수인가?"라는 반복적인 검증을 `expect(amount).toBePositive()`처럼 우리만의 언어로 만들 수 있습니다.

```typescript
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass,
    };
  },
});
```

---

### 전문가의 한마디: "테스트는 설명적이어야 한다"

테스트 코드를 읽을 때 `expect(res.data[0].status).toBe(1)`과 같은 코드는 암호문과 같습니다.

커스텀 매처와 직관적인 비동기 검증 도구를 사용하십시오. `expect(response).toBeActiveAccount()`와 같이 코드가 비즈니스 언어로 읽힐 때, 그 테스트는 비로소 살아있는 명세서로서의 가치를 가지게 됩니다.
 Jennifer 정 (Master Automation Architect)

---

> [!NOTE]
> 다음 아티클에서는 외부 의존성을 우아하게 격리하는 Jest의 정수, **모킹(Mocking) 마스터리**를 다룹니다.
