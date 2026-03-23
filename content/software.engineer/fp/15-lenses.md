---
title: "[FP 시리즈] 15. 렌즈 (Lenses)"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "렌즈", "lenses", "불변성", "FP"]
---

# 렌즈 (Lenses)

중첩된 불변 객체를 업데이트하는 일은 번거롭습니다. 렌즈는 이 문제를 해결하는 함수형 패턴입니다.

## 문제: 깊은 불변 업데이트

```typescript
type Address = { street: string; city: string; zip: string };
type User = { name: string; age: number; address: Address };

const user: User = {
  name: '홍길동',
  age: 30,
  address: { street: '세종대로', city: '서울', zip: '04524' },
};

// 도시만 바꾸려면
const updated = {
  ...user,
  address: {
    ...user.address,
    city: '부산',
  },
};
```

두 단계만 깊어도 spread가 중첩됩니다. 더 깊어지면:

```typescript
type Company = { name: string; ceo: { profile: { address: Address } } };

const updated = {
  ...company,
  ceo: {
    ...company.ceo,
    profile: {
      ...company.ceo.profile,
      address: {
        ...company.ceo.profile.address,
        city: '부산',
      },
    },
  },
};
// 매우 번거롭고 실수하기 쉬움
```

## 렌즈란

**특정 필드에 포커스를 맞추는 get/set 쌍**입니다.

```typescript
type Lens<S, A> = {
  get: (s: S) => A;       // 전체에서 부분을 읽기
  set: (a: A, s: S) => S; // 전체에서 부분을 업데이트한 새 전체 반환
};
```

`S`는 전체 구조, `A`는 포커스할 부분입니다.

```typescript
// User의 address.city에 대한 렌즈
const cityLens: Lens<User, string> = {
  get: user => user.address.city,
  set: (city, user) => ({
    ...user,
    address: { ...user.address, city },
  }),
};

// 사용
cityLens.get(user);              // '서울'
cityLens.set('부산', user);      // city가 '부산'인 새 User
```

## 렌즈 합성

렌즈의 강점은 **합성**입니다. 작은 렌즈들을 합쳐 더 깊은 곳에 포커스할 수 있습니다.

```typescript
function composeLens<S, A, B>(outer: Lens<S, A>, inner: Lens<A, B>): Lens<S, B> {
  return {
    get: s => inner.get(outer.get(s)),
    set: (b, s) => outer.set(inner.set(b, outer.get(s)), s),
  };
}

// 작은 렌즈들
const addressLens: Lens<User, Address> = {
  get: user => user.address,
  set: (address, user) => ({ ...user, address }),
};

const cityLens2: Lens<Address, string> = {
  get: addr => addr.city,
  set: (city, addr) => ({ ...addr, city }),
};

// 합성 — User에서 city로 직접 포커스
const userCityLens = composeLens(addressLens, cityLens2);

userCityLens.get(user);         // '서울'
userCityLens.set('부산', user); // city가 '부산'인 새 User
```

## modify: get + transform + set

렌즈에 `modify`를 추가하면 함수로 값을 변환할 수 있습니다.

```typescript
function modify<S, A>(lens: Lens<S, A>, fn: (a: A) => A, s: S): S {
  return lens.set(fn(lens.get(s)), s);
}

// 나이 1 증가
modify(ageLens, age => age + 1, user);

// 도시 대문자로
modify(userCityLens, city => city.toUpperCase(), user);
```

## 실용적인 렌즈 빌더

매번 렌즈를 직접 만들기 번거로우므로 헬퍼를 씁니다.

```typescript
// 객체 키에 대한 렌즈를 자동으로 생성
function lens<S, K extends keyof S>(key: K): Lens<S, S[K]> {
  return {
    get: s => s[key],
    set: (a, s) => ({ ...s, [key]: a }),
  };
}

const nameLens = lens<User, 'name'>('name');
const addressLens2 = lens<User, 'address'>('address');
const cityLens3 = lens<Address, 'city'>('city');

// 합성
const userCityLens2 = composeLens(addressLens2, cityLens3);
```

## 배열 안의 특정 요소에 렌즈

```typescript
// 인덱스로 배열 요소에 포커스
function indexLens<T>(index: number): Lens<T[], T> {
  return {
    get: arr => arr[index],
    set: (item, arr) => arr.map((x, i) => (i === index ? item : x)),
  };
}

type Cart = { items: CartItem[] };
const cartItemsLens = lens<Cart, 'items'>('items');
const firstItemLens = indexLens<CartItem>(0);
const firstCartItemLens = composeLens(cartItemsLens, firstItemLens);

const cart = { items: [{ id: '1', name: '사과', qty: 1 }] };
modify(firstCartItemLens, item => ({ ...item, qty: item.qty + 1 }), cart);
// { items: [{ id: '1', name: '사과', qty: 2 }] }
```

## 실무 라이브러리

직접 구현하기보다 라이브러리를 씁니다.

### monocle-ts / optics-ts

```typescript
import * as O from 'optics-ts';

const userOptic = O.optic<User>();

// 렌즈 정의
const cityOptic = userOptic.prop('address').prop('city');

// 사용
O.get(cityOptic)(user);           // '서울'
O.set(cityOptic)('부산')(user);   // 새 User
O.modify(cityOptic)(s => s.toUpperCase())(user);
```

### immer (렌즈보다 실용적인 대안)

TypeScript 실무에서는 렌즈보다 `immer`가 더 많이 쓰입니다.

```typescript
import { produce } from 'immer';

const updated = produce(user, draft => {
  draft.address.city = '부산'; // 변이 스타일로 작성, 내부적으로 불변
});
```

렌즈는 함수를 합성해 재사용 가능한 "접근 경로"를 만들 때 유리합니다. immer는 한 번의 업데이트를 직관적으로 표현할 때 유리합니다.

## 정리

- **렌즈**: 중첩 구조의 특정 부분에 포커스하는 get/set 쌍
- **합성**: 작은 렌즈를 조합해 더 깊은 곳에 접근
- **modify**: 함수로 값을 변환

렌즈는 불변성을 유지하면서 복잡한 중첩 구조를 다루는 가장 체계적인 방법입니다. Redux 상태처럼 깊이 중첩된 구조를 자주 업데이트하는 코드에서 특히 유용합니다.
