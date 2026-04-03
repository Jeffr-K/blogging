---
title: "[TDD 시리즈] 24. Property-Based Testing — 내가 생각 못한 케이스를 찾아라"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "Property-Based Testing", "fast-check", "Hypothesis", "테스트 자동화"]
---

# Property-Based Testing — 내가 생각 못한 케이스를 찾아라

예시 기반 테스트(Example-Based Testing)에는 구조적인 한계가 있다. 테스트를 쓰는 사람이 생각한 케이스만 검증한다. `add(2, 3) === 5`를 테스트했다고 해서 `add(-1, -2147483648)`이 올바르게 동작한다는 보장은 없다. 우리는 "내가 중요하다고 생각하는" 입력값을 고르고, 버그는 정확히 우리가 생각하지 못한 곳에 숨는다.

Property-Based Testing은 이 문제를 뒤집는다. 개발자가 개별 입력값을 고르는 대신, 프레임워크가 수백 개의 랜덤 입력값을 자동으로 생성해서 돌린다. 개발자는 "이 입력으로 이 결과가 나와야 한다"가 아니라 "어떤 입력을 넣어도 이 성질은 항상 참이어야 한다"를 기술한다. 이걸 **Property(속성)**라고 부른다.

## 예시 기반 테스트의 한계

전형적인 예시 기반 테스트를 보자.

```typescript
describe('encode/decode', () => {
  it('기본 문자열을 인코딩 후 디코딩하면 원래 값이 나온다', () => {
    expect(decode(encode('hello'))).toBe('hello');
    expect(decode(encode('world'))).toBe('world');
    expect(decode(encode(''))).toBe('');
  });
});
```

세 가지 케이스다. 개발자가 선택한 세 가지. 빈 문자열, 일반 단어 두 개. 여기서 우리가 놓친 것들: 한글, 이모지, null 바이트, 매우 긴 문자열, 특수문자, 유니코드 경계 문자들. 이 케이스들을 모두 수동으로 나열할 수는 없다.

## Property란 무엇인가

Property는 "항상 참이어야 하는 불변 조건"이다. 특정 입력값이 아니라 입력값의 **범주**에 대해 성립해야 하는 성질이다.

`encode/decode`의 Property: "임의의 문자열 `s`에 대해 `decode(encode(s)) === s`다."

이게 전부다. 어떤 문자열이 들어와도 이 성질은 참이어야 한다. Property-Based Testing 프레임워크는 이 조건을 수백 번, 랜덤한 입력으로 검증한다.

## fast-check로 작성하는 Property 테스트 (TypeScript)

```bash
npm install --save-dev fast-check
```

```typescript
import * as fc from 'fast-check';
import { encode, decode } from './codec';

describe('encode/decode property', () => {
  it('임의의 문자열을 인코딩 후 디코딩하면 원래 값이 나온다', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(decode(encode(s))).toBe(s);
      })
    );
  });
});
```

`fc.string()`은 임의의 문자열을 생성하는 Arbitrary다. `fc.assert`는 이 Arbitrary로 기본 100번(설정 가능) 테스트를 실행한다. 반례가 발견되면 즉시 실패하고 반례를 출력한다.

## Shrinking: 반례를 최소 케이스로 줄이는 과정

Property-Based Testing의 핵심 기능 중 하나가 **Shrinking**이다. 랜덤 입력으로 반례를 찾았을 때, 그 입력값은 종종 매우 복잡하다. 길이 500짜리 문자열이 반례라면 디버깅하기 어렵다.

Shrinking은 반례를 자동으로 단순화한다. "이 반례보다 작은 반례가 있는가?"를 반복해서 물으며 최소 케이스를 찾는다. 최종적으로 "이 버그를 재현하는 가장 단순한 입력"을 보여준다.

```
Property failed after 1 tests
{ seed: 1742893021, path: "0:0:1", endOnFailure: true }
Counterexample: ["é"]  ← Shrinking 결과: 1글자 유니코드 문자
Shrunk 15 time(s)
```

Shrinking 없이는 "랜덤 482자 문자열"이 반례로 나왔을 것이다. Shrinking 덕분에 `"é"` 한 글자로 좁혀진다.

## 좋은 Property 작성법

### 1. 역함수 (Inverse)

두 함수가 서로의 역함수라면 왕복하면 원래 값이 나온다.

```typescript
// 직렬화/역직렬화
fc.assert(
  fc.property(fc.anything(), (data) => {
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  })
);

// 압축/압축해제
fc.assert(
  fc.property(fc.uint8Array(), (bytes) => {
    expect(decompress(compress(bytes))).toEqual(bytes);
  })
);
```

### 2. 불변 조건 (Invariant)

연산 전후에도 항상 성립해야 하는 조건.

```typescript
// 정렬 후에도 길이는 같다
fc.assert(
  fc.property(fc.array(fc.integer()), (arr) => {
    expect(sort(arr).length).toBe(arr.length);
  })
);

// 정렬 결과는 항상 오름차순이다
fc.assert(
  fc.property(fc.array(fc.integer()), (arr) => {
    const sorted = sort(arr);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i]).toBeLessThanOrEqual(sorted[i + 1]);
    }
  })
);
```

### 3. 다른 구현과 비교 (Oracle)

느리지만 정확한 구현(oracle)과 빠른 최적화 구현을 비교한다.

```typescript
// 나이브한 구현과 최적화 구현이 같은 결과를 내야 한다
fc.assert(
  fc.property(fc.array(fc.integer()), (arr) => {
    expect(optimizedSort(arr)).toEqual(naiveSort(arr));
  })
);
```

레거시 코드를 리팩토링할 때 특히 강력하다. 기존 구현을 oracle로 두고 새 구현이 동일하게 동작하는지 검증한다.

### 4. 대칭성 (Symmetry)

```typescript
// 덧셈의 교환 법칙
fc.assert(
  fc.property(fc.integer(), fc.integer(), (a, b) => {
    expect(add(a, b)).toBe(add(b, a));
  })
);

// 집합 합집합의 교환 법칙
fc.assert(
  fc.property(fc.set(fc.string()), fc.set(fc.string()), (a, b) => {
    expect(union(a, b)).toEqual(union(b, a));
  })
);
```

## Hypothesis로 작성하는 Property 테스트 (Python)

```bash
pip install hypothesis
```

```python
from hypothesis import given, strategies as st
from hypothesis import settings
from myapp.codec import encode, decode

@given(st.text())
def test_encode_decode_roundtrip(s: str):
    assert decode(encode(s)) == s

@given(st.lists(st.integers()))
def test_sort_preserves_length(lst: list[int]):
    assert len(sorted(lst)) == len(lst)

@given(st.lists(st.integers()))
def test_sort_is_ordered(lst: list[int]):
    result = sorted(lst)
    for i in range(len(result) - 1):
        assert result[i] <= result[i + 1]

# 더 많은 케이스가 필요하면 설정 조정
@settings(max_examples=500)
@given(st.text(alphabet=st.characters(blacklist_categories=('Cs',))))
def test_parser_never_crashes(input_text: str):
    # 파서는 어떤 입력에도 예외를 던지면 안 된다 (에러 객체를 반환해야 함)
    result = parse(input_text)
    assert result is not None
```

Hypothesis는 실패한 케이스를 데이터베이스에 저장해서 다음 실행에도 재현한다. Shrinking도 자동으로 처리된다.

## 커스텀 Arbitrary 만들기

실제 코드는 단순한 정수나 문자열보다 복잡한 도메인 객체를 다룬다.

```typescript
// fast-check로 도메인 객체 생성
const userArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  email: fc.emailAddress(),
  age: fc.integer({ min: 0, max: 150 }),
  roles: fc.array(fc.constantFrom('admin', 'user', 'guest'), { minLength: 1 }),
});

fc.assert(
  fc.property(userArbitrary, (user) => {
    const serialized = serializeUser(user);
    const deserialized = deserializeUser(serialized);
    expect(deserialized).toEqual(user);
  })
);
```

## Property-Based Testing이 빛나는 영역

모든 코드에 Property-Based Testing을 적용할 필요는 없다. 특히 유용한 영역이 있다.

**파서와 직렬화**: 임의의 입력을 처리하는 코드. 파서는 어떤 입력에도 크래시 없이 에러를 반환해야 한다. 직렬화는 왕복 검증(roundtrip)이 자연스러운 Property다.

**알고리즘**: 정렬, 검색, 그래프 알고리즘은 수학적 불변 조건이 명확하다.

**리팩토링**: 기존 구현을 oracle로 두고 새 구현을 검증한다. 회귀 버그를 잡는 가장 강력한 방법이다.

**암호화/해싱**: 역함수 성질, 결정론적 성질 검증.

반면 UI 렌더링, 비즈니스 규칙처럼 "올바른 출력"을 일반화하기 어려운 영역은 예시 기반 테스트가 더 적합하다.

## 예시 기반 테스트와 함께 쓰기

Property-Based Testing이 예시 기반 테스트를 대체하는 게 아니다. 보완한다.

예시 기반 테스트는 "중요한 특정 케이스"를 문서화한다. 경계값, 비즈니스 규칙, 알려진 버그 재현. Property-Based Testing은 "내가 생각하지 못한 케이스"를 자동으로 탐색한다.

두 가지를 함께 쓸 때 테스트 스위트가 가장 강력해진다. 예시 기반으로 의도를 문서화하고, Property 기반으로 가정을 검증한다.
