---
title: "[FP 시리즈] 1. 순수 함수, 부수 효과, 참조 투명성"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "순수함수", "부수효과", "참조투명성", "FP"]
---

# 순수 함수, 부수 효과, 참조 투명성

함수형 프로그래밍의 출발점은 **순수 함수**입니다. 부수 효과와 참조 투명성은 순수 함수를 설명하는 두 가지 측면입니다. 셋을 함께 이해하면 FP가 왜 이 방향을 선택했는지 보입니다.

## 순수 함수란

두 가지 조건을 만족하는 함수입니다.

1. **같은 입력에 항상 같은 출력**
2. **부수 효과 없음**

```typescript
// 순수 함수
function add(a: number, b: number): number {
  return a + b;
}

add(2, 3); // 항상 5
add(2, 3); // 항상 5
```

반면 이런 함수는 순수하지 않습니다.

```typescript
let count = 0;

// 순수하지 않음 - 호출할 때마다 결과가 다름
function increment(): number {
  return ++count;
}

increment(); // 1
increment(); // 2 (같은 입력인데 다른 출력)
```

## 부수 효과

함수가 반환값 외에 **외부 세계에 영향을 미치는 모든 것**이 부수 효과입니다.

```typescript
// 부수 효과의 예시들

// 1. 외부 변수 변경
let total = 0;
function addToTotal(n: number) {
  total += n; // 부수 효과: 외부 상태 변경
}

// 2. 콘솔 출력
function greet(name: string) {
  console.log(`Hello, ${name}`); // 부수 효과: I/O
}

// 3. API 호출
async function fetchUser(id: number) {
  const res = await fetch(`/api/users/${id}`); // 부수 효과: 네트워크
  return res.json();
}

// 4. 인자로 받은 객체 변경
function addItem(cart: string[], item: string) {
  cart.push(item); // 부수 효과: 입력 변이(mutation)
}
```

부수 효과 자체가 나쁜 것은 아닙니다. 프로그램은 결국 무언가를 출력하고, 데이터를 저장하고, 화면에 표시해야 합니다. 문제는 **부수 효과가 예측하기 어렵게 흩어져 있을 때**입니다.

FP는 부수 효과를 없애는 게 아니라 **명시적으로 격리**하는 방향을 선택합니다.

```typescript
// 순수하지 않은 버전 - 부수 효과가 숨어있음
function processOrder(orderId: string) {
  const order = db.find(orderId);    // 숨겨진 I/O
  order.status = 'processed';        // 숨겨진 변이
  db.save(order);                    // 숨겨진 I/O
  sendEmail(order.userId, '처리완료'); // 숨겨진 I/O
  return order;
}

// 순수 버전 - 로직과 효과 분리
function calculateOrderStatus(order: Order): Order {
  return { ...order, status: 'processed' }; // 순수: 새 객체 반환
}

// 효과는 바깥에서 명시적으로 처리
async function handleOrder(orderId: string) {
  const order = await db.find(orderId);
  const processed = calculateOrderStatus(order); // 순수 로직 호출
  await db.save(processed);
  await sendEmail(processed.userId, '처리완료');
}
```

## 참조 투명성

**표현식을 그 결과값으로 교체해도 프로그램의 동작이 바뀌지 않는 성질**입니다.

```typescript
const x = add(2, 3); // add(2, 3)을 5로 교체해도 동작이 같음
const y = x * 2;     // 5 * 2 = 10

// 위와 동일
const y2 = add(2, 3) * 2; // 10
```

참조 투명성이 없으면 코드를 부분적으로 이해하기 어렵습니다.

```typescript
let i = 0;

function next(): number {
  return i++;
}

const a = next() + next();
// a는 0 + 1 = 1

// next()를 그 결과로 교체하려고 해도 불가능
// 첫 번째 next()는 0, 두 번째는 1이기 때문
```

반면 순수 함수는 어디서든 교체 가능합니다.

```typescript
const double = (x: number) => x * 2;

// 이 두 코드는 완전히 동일
const result1 = double(5) + double(3);
const result2 = 10 + 6;
```

## 왜 중요한가

### 테스트가 쉬워집니다

순수 함수는 입력과 출력만 검증하면 됩니다. 외부 상태를 설정하거나 모킹할 필요가 없습니다.

```typescript
// 테스트하기 어려운 버전
function getDiscountedPrice(productId: string): number {
  const product = db.getProduct(productId); // DB 필요
  const discount = discountService.getRate(); // 외부 서비스 필요
  return product.price * (1 - discount);
}

// 테스트하기 쉬운 버전
function applyDiscount(price: number, discountRate: number): number {
  return price * (1 - discountRate);
}

// 테스트
expect(applyDiscount(10000, 0.1)).toBe(9000);
expect(applyDiscount(10000, 0.2)).toBe(8000);
```

### 추론이 쉬워집니다

함수를 보면 무슨 일을 하는지 바로 알 수 있습니다. 외부 상태를 확인하러 다닐 필요가 없습니다.

### 병렬 실행이 안전합니다

순수 함수는 공유 상태를 변경하지 않으므로 race condition이 없습니다.

## 정리

- **순수 함수**: 같은 입력 → 같은 출력, 부수 효과 없음
- **부수 효과**: 반환값 외의 외부 영향 (I/O, 상태 변경 등) — 없애는 게 아니라 격리하는 것이 목표
- **참조 투명성**: 표현식을 결과값으로 교체 가능 — 코드를 국소적으로 이해할 수 있게 해줌

세 개념은 하나의 원칙을 다른 각도에서 바라본 것입니다: **함수가 하는 일을 함수 시그니처만으로 알 수 있어야 한다.**
