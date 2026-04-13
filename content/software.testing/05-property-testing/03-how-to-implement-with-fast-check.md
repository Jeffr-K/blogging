---
title: "Fast-check를 이용한 NestJS 실전 구현 가이드"
author: jeffrey
date: 2026-04-13
tags: ["fast-check", "how-to", "nestjs", "jest", "property-testing"]
---

## Fast-check를 이용한 NestJS 실전 구현 가이드

개념을 이해했다면 이제 도구를 손에 쥘 차례입니다. TypeScript 생태계에서 속성 기반 테스팅의 정점은 **`fast-check`**입니다. Jest와 완벽하게 통합되며, 강력한 임의 데이터 생성기(Arbitrary)를 제공하는 이 도구를 NestJS 프로젝트에 녹여내는 방법을 단계별로 살펴보겠습니다.

---

### 1. 환경 설정 및 설치

먼저 필요한 패키지를 설치합니다. Jest가 이미 설치된 환경을 가정합니다.

```bash
npm install --save-dev fast-check
```

### 2. NestJS 유효성 검사 로직 테스팅 (Practice)

예를 들어, "비밀번호는 최소 8자 이상이어야 하며, 공백을 포함할 수 없다"는 비즈니스 규칙을 검증하는 서비스가 있다고 가정해 보겠습니다.

#### 2.1 테스트 대상 소스 코드 (src/auth/auth.utils.ts)

```typescript
// 단순한 유효성 검사 함수
export const isValidPassword = (password: string): boolean => {
  if (password.length < 8) return false;
  if (password.includes(' ')) return false;
  return true;
};
```

#### 2.2 속성 기반 테스트 코드 (test/auth.utils.spec.ts)

하드코딩된 예제 대신, `fc.string()`을 사용하여 수만 가지 문자열을 생성합니다.

```typescript
import * as fc from 'fast-check';
import { isValidPassword } from '../src/auth/auth.utils';

describe('Password Validation - Property Based', () => {
    it('8자 미만의 모든 문자열은 반드시 실패해야 한다 (Invariant 1)', () => {
        fc.assert(
            fc.property(
                // 1. 데이터 생성기 정의 (0자 ~ 7자 사이의 문자열)
                fc.string({ maxLength: 7 }), 
                (password) => {
                    // 2. 불변의 속성 검증
                    expect(isValidPassword(password)).toBe(false);
                }
            )
        );
    });

    it('공백이 포함된 모든 문자열은 반드시 실패해야 한다 (Invariant 2)', () => {
        fc.assert(
            fc.property(
                // 공백을 포함하는 랜덤 문자열 생성
                fc.string().map(s => s + ' '), 
                (password) => {
                    expect(isValidPassword(password)).toBe(false);
                }
            )
        );
    });
});
```

---

### 3. 주요 Arbitrary (데이터 생성기) 활용법

`fast-check`는 거의 모든 데이터 타입을 생성할 수 있는 빌트인 생성기를 제공합니다.

- `fc.integer()` / `fc.float()`: 숫자 범위 테스트
- `fc.array(fc.integer())`: 동적 길이의 배열 테스트
- `fc.record({ id: fc.uuid(), age: fc.integer({min: 0}) })`: 복잡한 객체 구조 테스트
- `fc.oneof(...)`: 여러 선택지 중 하나를 무작위로 선택

### 4. 슈링크(Shrinking)의 위력 체감하기

위 테스트를 돌리다가 만약 `isValidPassword`에 버그가 있다면 (예: 특정 특수문자 처리를 못함), `fast-check`는 다음과 같은 결과를 출력합니다.

```text
Property failed after 153 tests
{ seed: 1827364, path: "152:0:2", endOnFailure: true }
Counterexample: ["!@#$    "]  <-- 버그가 발생한 최소 데이터
Shrunk 12 times
```

이처럼 실패한 수만 개의 데이터 중 **'가장 단순한 반례'**를 깎아서 보여주므로, 개발자는 즉시 디버깅에 착수할 수 있습니다.

---

### 전문가의 팁: "시드를 고정하라"

속성 기반 테스팅은 기본적으로 매번 다른 데이터를 생성합니다. CI 환경에서 실패한 케이스를 로컬에서 재현하고 싶다면, 결과 보고서에 찍힌 **`seed`** 값을 옵션에 넣어 실행하십시오. 그러면 동일한 무작위 데이터 셋이 그대로 재현되어 디버깅 효율을 극대화할 수 있습니다.

이제 여러분의 NestJS 서비스에 기계의 힘을 빌려보십시오.
 Jennifer 정 (Master QA Engineer)
