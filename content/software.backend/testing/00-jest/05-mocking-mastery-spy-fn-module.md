---
title: "모킹 마스터리(Mocking): `fn`, `spyOn`부터 모듈 데이터 모킹까지"
author: jeffrey
date: 2026-04-13
tags: ["jest", "mocking", "spyon", "module-mock", "test-doubles"]
---

## 모킹 마스터리(Mocking): `fn`, `spyOn`부터 모듈 데이터 모킹까지

"테스트하고 싶은 것은 우리 회사의 비즈니스 로직인데, 자꾸 외부 데이터베이스나 유료 결제 API가 발목을 잡아요." 이 지점에서 가장 필요한 기술이 바로 **모킹(Mocking)**입니다. Jest는 자바스크립트 생태계에서 가장 강력하고 유연한 모킹 도구를 제공합니다.

---

### 1. `jest.fn()`: 가장 순수한 가짜 함수

`jest.fn()`은 아무런 로직이 없는 빈 함수(Spy)를 만듭니다. 주로 콜백 함수가 호출되었는지, 어떤 인자가 전달되었는지를 확인할 때 사용합니다.

```typescript
it('콜백 함수가 상품 개수만큼 호출되어야 한다', () => {
  const mockCallback = jest.fn();
  const products = ['Apple', 'Banana'];
  
  products.forEach(mockCallback);

  expect(mockCallback).toHaveBeenCalledTimes(2);
  expect(mockCallback).toHaveBeenCalledWith('Apple', 0, products);
});
```

### 2. `jest.spyOn()`: 원본을 유지하며 감시하기

`spyOn`은 객체의 실제 메서드를 그대로 유지하면서 호출 여부만 기록하거나, 필요할 때만 가짜 구현(Implementation)으로 덮어씌울 때 사용합니다.

```typescript
it('결제 서비스의 로그 기록 메서드를 감시한다', () => {
  const loggerSpy = jest.spyOn(logger, 'log');
  
  paymentService.pay(1000);

  expect(loggerSpy).toHaveBeenCalled();
  
  // 테스트 종료 후 원본 상태로 복구 (중요!)
  loggerSpy.mockRestore();
});
```

### 3. `jest.mock()`: 모듈 전체를 가짜로 대체하기

`axios`나 `prisma` 같은 외부 라이브러리 전체를 모킹해야 할 때 사용합니다. NestJS 테스트에서 가장 빈번하게 사용되는 기법입니다.

```typescript
jest.mock('axios');
import axios from 'axios';

it('API 호출 성공 시 데이터를 반환한다', async () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  mockedAxios.get.mockResolvedValue({ data: { id: 1 } });

  const result = await userService.fetchUser(1);
  expect(result.id).toBe(1);
});
```

---

### 🎯 Senior's Insight: `mockReturnValue` vs `mockImplementation`

시니어 개발자는 단순히 값을 반환하는 것과 로직을 시뮬레이션하는 것을 구분합니다.

- **`mockReturnValue`**: 단순히 특정 결과값이 필요할 때 사용합니다. (간결함)
- **`mockImplementation`**: 입력 인자에 따라 다른 값을 반환하거나, 에러를 던지는 등의 동적인 로직이 필요할 때 사용합니다.

또한, **"모킹은 최소화하라"**는 격언을 명심하십시오. 너무 많은 모킹은 테스트가 실제 코드와 멀어지게 만들며, 내부 구현에 종속된 취약한 테스트를 양산합니다. 가능하면 실제 객체를 사용하고, 경계(Boundary)에 있는 DB나 외부 서비스만 모킹하는 것이 정석입니다.

---

> [!IMPORTANT]
> `spyOn`으로 만든 모크는 반드시 `afterEach`에서 `jest.restoreAllMocks()` 등을 통해 초기화해주어야 다른 테스트에 영향을 주지 않습니다.

---

> [!NOTE]
> 다음 아티클에서는 거대한 객체나 UI 구조의 변경을 사진 찍듯 감지하는 **스냅샷 테스팅(Snapshot Testing)**의 세계로 떠나봅니다.
