---
title: "프리 모나드(Free Monad)와 인터프리터: 효과(Effect)의 테스팅"
author: jeffrey
date: 2026-04-13
tags: ["free-monad", "effect-ts", "interpreter-pattern", "fp", "testability", "effects"]
---

## 프리 모나드(Free Monad)와 인터프리터: 효과(Effect)의 테스팅

전통적인 테스팅은 실제 부수 효과(I/O, DB)가 발생하는 지점을 Mocking 하여 가로채는 방식입니다. 하지만 **프리 모나드(Free Monad)**와 **인터프리터 패턴**은 근본적인 접근을 취합니다. 프로그램을 **"무엇을 할 것인가"**에 대한 **데이터 구조(Instruction Set)**로 먼저 정의하고, 이를 실제로 **"어떻게 실행할 것인가"**는 나중에 결정(Late Binding)하는 방식입니다.

이를 통해 테스트 환경에서는 실제 실행 대신 데이터만 읽어 들이는 **테스트 전용 인터프리터**를 사용하여 완벽한 격리 상태에서 비즈니스 로직을 검증할 수 있습니다.

---

### 1. 설계의 혁명: '수행'이 아닌 '기술(Description)'

- **전통적 방식**: `db.save(user)` -> 실제로 DB에 저장 시도 (Mocking 필요)
- **프리 모나드/Effect 방식**: `{ _tag: 'SaveUser', user }` -> 사용자 저장이라는 **'효과(Effect) 데이터'** 생성 (Mocking 불필요)

### 2. Effect.ts를 이용한 효과 시스템 테스팅 실전

현대적인 Effect 관리 라이브러리인 **Effect.ts**를 사용하여 외부 API 연동 로직을 설계하고 테스트해 보겠습니다.

#### 2.1 서비스 인터페이스 정의 (Layer & Service)

```typescript
// src/services/api.service.ts
import { Effect, Context } from "effect";

export interface ApiClient {
  readonly fetchData: (id: string) => Effect.Effect<never, Error, string>;
}

export const ApiClient = Context.Tag<ApiClient>();
```

#### 2.2 비즈니스 프로그램 (무엇을 할지 기술하는 태스크)

여기서는 실제 구현을 모릅니다. 오직 `ApiClient`라는 '태그'를 사용하여 무엇을 할지만 적습니다.

```typescript
// src/app.logic.ts [Logic as Data]
export const processData = (id: string) =>
  ApiClient.pipe(
    Effect.flatMap((client) => client.fetchData(id)),
    Effect.map((data) => `Processed: ${data}`)
  );
```

#### 2.3 테스트용 인터프리터 주입 (Layer Mocking)

테스트에서는 실제 API 클라이언트를 주입하지 않고, 테스트용 데이터를 반환하는 가짜 구현(Layer)을 주입합니다.

```typescript
// src/app.logic.spec.ts [Testing by Swapping Layers]
import { Layer, Effect } from 'effect';

describe('Effect System Testing', () => {
  it('API 호출의 반환 데이터를 가공하여 결과를 올바르게 리턴해야 한다.', async () => {
    // 1. 테스트 전용 레이어 생성 (이것이 인터프리터의 역할을 수행함)
    const TestApiLayer = Layer.succeed(ApiClient, {
      fetchData: (id) => Effect.succeed(`Mock Data for ${id}`),
    });

    // 2. 통합 효과 실행 (프로그램 + 테스트 레이어 결합)
    const result = await processData('123').pipe(
        Effect.provide(TestApiLayer),
        Effect.runPromise
    );

    // 3. 검증 (실제 데이터 처리가 완료되었는지 확인)
    expect(result).toBe('Processed: Mock Data for 123');
  });
});
```

### 3. 프리 모나드/Effect 테스팅의 이점

1. **완벽한 소유권 격리**: 비즈니스 로직은 "어떤 외부 라이브러리나 인프라"가 올 것인지 전혀 알 필요가 없습니다.
2. **사이드 이펙트의 가시화**: 모든 부수 효과가 타입 시스템(Effect<R, E, A>)에 명시되므로, 테스트에서 어떤 부분을 처리해야 할지 명확히 알 수 있습니다.
3. **병렬 및 재시도 테스트**: 실제 네트워크 환경에서는 테스트하기 어려운 **'자동 재시도(Retry)'**나 **'타임아웃'** 전략이 성공하는지도 Effect 내부 스케줄러로 손쉽게 테스트 가능합니다.

---

### 4. 시무 (Senior's Sight): "코드는 문장이고, 실행은 연기다"

전설적인 엔지니어들은 코드를 **'지시 사항의 목록(List of Instructions)'**으로 봅니다.

프리 모나드적 사고는 여러분이 로직을 짤 때 **"언젠가 누군가 내 지시를 읽어줄 테니, 나는 정확한 지시서만 써야지"**라는 마음가짐을 갖게 합니다. 이 지시서는 깨끗하며, 그 지시서가 맞는지 틀린 지는 실제 연극(운영) 단계가 아닌 대본 리딩(테스트) 단계에서 이미 결정됩니다.

이것이 테스팅이 도달할 수 있는 가장 우아하고 고차원적인 지점입니다.
Jennifer 정 (Effect & FP Architect)
