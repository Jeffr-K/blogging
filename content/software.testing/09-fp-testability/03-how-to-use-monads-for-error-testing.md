---
title: "모나드와 에러 테스팅: Either와 Option으로 예외를 정복하기"
author: jeffrey
date: 2026-04-13
tags: ["monad", "either", "option", "fp-ts", "error-handling", "how-to"]
---

## 모나드와 에러 테스팅: Either와 Option으로 예외를 정복하기

백엔드 로직의 절반은 에러 처리입니다. 하지만 `throw new Error()`를 남발하면 테스트 코드는 `expect(() => f()).toThrow()`와 같이 흐름이 끊기는 단언문으로 가득 차게 됩니다. **모나드(Monad)**는 에러를 '폭탄'처럼 터뜨리는 대신, 상자(`Either`) 안에 담긴 **'값'**으로 취급하게 해줍니다.

---

### 1. Either 모나드: 성공과 실패의 명시적 구분

`Either<E, A>`는 실패(`Left`) 혹은 성공(`Right`) 중 하나를 가집니다.

- **테스트 관점**: `process(input)`의 결과가 `Left`인지 `Right`인지만 확인하면 됩니다. 테스트 흐름이 비동기나 예외에 의해 끊기지 않고 물 흐르듯 이어집니다.

```typescript
import * as E from 'fp-ts/Either';

it('나이가 음수이면 에러(Left)가 발생해야 한다.', () => {
    const result = validateAge(-5);
    
    // Left인지 확인하고, 에러 메시지를 검증
    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
        expect(result.left).toBe('Age cannot be negative');
    }
});
```

### 2. Option 모나드: 존재하거나 존재하지 않거나

`null`이나 `undefined`는 테스팅 시 가장 큰 불청객입니다. `Option`은 이 불확실함을 제거합니다.

- **테스트 관점**: "값이 없는 경우"를 테스트할 때, `null` 체크를 하는 대신 `isNone()` 혹은 `isSome()`으로 명확히 의도를 선언할 수 있습니다.

### 3. Task / TaskEither: 비동기 테스팅의 평화

네트워크 호출은 실패할 가능성이 농후합니다. 이를 `TaskEither`로 감싸면 "미래에 성공하거나 실패할 값"이 됩니다.

- **테스트 관점**: 비동기 호출을 한 뒤 `await`을 통해 상자를 열기만 하면 됩니다. 성공일 때의 데이터 구조와 실패일 때의 데이터 구조를 동일한 수준의 로직으로 검증할 수 있습니다.

---

### 전문가의 팁: "에러도 비즈니스 데이터다"

에러를 시스템 크래시(Crash)로 보지 말고, 함수가 줄 수 있는 **'정당한 응답'** 중 하나로 보십시오.

모나드를 사용하여 에러를 반환값으로 다루기 시작하면, 여러분의 테스트 코드는 더 이상 예외 처리를 위한 방어적인 코드로 지저분해지지 않을 것입니다. 모든 상황이 '값'으로 수렴되는 평온한 테스팅의 세계를 경험해 보십시오.
 Jennifer 정 (Master Tech Lead)
