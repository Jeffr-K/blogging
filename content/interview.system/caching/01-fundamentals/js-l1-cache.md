---
title: "자바스크립트로 L1 캐시를 제어할 수 있을까?"
date: 2026-04-13
tags: [cache, l1-cache, javascript, v8, data-oriented-design, cpu]
---

## 결론부터

> "자바스크립트 코드가 직접 L1 캐시 주소를 제어할 수는 없지만, L1 캐시 효율을 극대화하는 코드를 짤 수는 있다."

자바스크립트 엔진(V8 등)이 고도로 최적화되면서, 우리가 작성한 배열이나 객체가 CPU의 L1/L2 캐시를 얼마나 잘 타느냐에 따라 **성능 차이가 수십 배까지** 벌어지기도 합니다.

---

## 먼저: 캐시 라인(Cache Line)이란

CPU는 메모리에서 데이터를 가져올 때 딱 그 바이트만 가져오지 않습니다. **캐시 라인 단위(보통 64바이트)로 뭉텅이로** 가져와 L1 캐시에 올립니다.

```
메모리 주소: [0x00][0x04][0x08] ... [0x3C]  ← 64바이트 = 캐시 라인 1개
                 ↑ 이 주소 하나를 읽으면 64바이트 전체가 L1에 올라옴

Int32 (4바이트) 기준으로 캐시 라인 하나에 16개 원소가 들어감
```

**공간 지역성(Spatial Locality):** 연속된 메모리 접근 → 이미 캐시에 있음 → 빠름  
**시간 지역성(Temporal Locality):** 최근에 접근한 데이터 재접근 → 아직 캐시에 있음 → 빠름

---

## 1. TypedArray vs 일반 배열

### 일반 배열: 메모리 파편화

```javascript
// 일반 배열: 각 원소가 힙 여기저기에 흩어져 있음
const arr = [1, 2, 3, 4, 5];

// 내부적으로 이런 식:
// arr[0] → 0x7f3a2100 (힙 어딘가)
// arr[1] → 0x7f3a8820 (완전히 다른 주소!)
// → 매 접근마다 캐시 미스 가능성
```

### TypedArray: 연속 메모리

```javascript
// TypedArray: 64바이트 연속 블록으로 배치
const arr = new Int32Array(16); // 정확히 캐시 라인 1개

// arr[0] → 0x7f3a0000
// arr[1] → 0x7f3a0004  ← 바로 옆!
// arr[2] → 0x7f3a0008  ← 바로 옆!
// → arr[0] 읽을 때 arr[1]~arr[15]도 L1에 올라옴 → 이후 접근 무료

// 성능 비교 (10만 원소 합산)
function sumNormal() {
  const arr = Array.from({ length: 100000 }, (_, i) => i);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum;
}

function sumTyped() {
  const arr = new Int32Array(100000);
  for (let i = 0; i < arr.length; i++) arr[i] = i;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum;
}

// TypedArray가 3~5배 빠름 (L1 캐시 히트율 차이)
```

---

## 2. 2차원 배열 순회: 캐시 미스를 직접 느끼는 예제

컴구 교재에 나오는 내용이 JS에도 그대로 적용됩니다.

```javascript
const SIZE = 1000;
const arr = new Int32Array(SIZE * SIZE); // 1000×1000 행렬 (4MB)

// 메모리 레이아웃 (Row-major, C/JS 기본):
// [0,0][0,1][0,2]...[0,999] | [1,0][1,1]...[1,999] | ...
//  ←── 행(row) 방향이 연속 ───→

// ✅ 전략 A: 행 우선 순회 (Row-major) → L1 캐시 친화적
console.time("row-major");
for (let i = 0; i < SIZE; i++) {
  for (let j = 0; j < SIZE; j++) {
    arr[i * SIZE + j] = i + j;
    //    ↑ j가 1씩 증가 = 연속 메모리 = 캐시 라인 타고 이동
  }
}
console.timeEnd("row-major"); // ~5ms

// ❌ 전략 B: 열 우선 순회 (Column-major) → L1 캐시 미스 폭발
console.time("col-major");
for (let j = 0; j < SIZE; j++) {
  for (let i = 0; i < SIZE; i++) {
    arr[i * SIZE + j] = i + j;
    //    ↑ i가 1씩 증가 = SIZE(1000) * 4 = 4000바이트 점프
    //    캐시 라인 64바이트를 훌쩍 넘어감 → 매번 캐시 미스
  }
}
console.timeEnd("col-major"); // ~40ms (약 8배 느림)
```

### 캐시 미스가 왜 생기나

```
Row-major 접근:
  [★][★][★][★][★][★][★][★][★][★][★][★][★][★][★][★]
   ↑ 캐시 라인 하나(64바이트 = Int32 16개)로 16번 연속 히트

Col-major 접근:
  row 0 → row 1 → row 2 ... (각 row는 4000바이트 떨어짐)
  캐시 라인을 매번 새로 로딩 → 1000×1000 = 100만 번 캐시 미스
```

---

## 3. AoS vs SoA: 객체 설계와 캐시

**Array of Structures (AoS)** vs **Structure of Arrays (SoA)** — 게임 엔진과 고성능 컴퓨팅의 핵심 패턴입니다.

```javascript
// ❌ AoS (Array of Structures): 일반적인 방식
const particles_AoS = [
  { x: 1.0, y: 2.0, z: 3.0, mass: 1.5 },
  { x: 4.0, y: 5.0, z: 6.0, mass: 2.0 },
  { x: 7.0, y: 8.0, z: 9.0, mass: 0.5 },
];

// "모든 x 좌표를 업데이트" 작업 시:
// particle[0].x → particle[1].x → particle[2].x
// 메모리 간격이 구조체 크기(32바이트)만큼 뜀
// x만 필요한데 y, z, mass까지 캐시에 올라옴 → 캐시 오염

// ✅ SoA (Structure of Arrays): 캐시 친화적
const particles_SoA = {
  x:    new Float32Array([1.0, 4.0, 7.0]),
  y:    new Float32Array([2.0, 5.0, 8.0]),
  z:    new Float32Array([3.0, 6.0, 9.0]),
  mass: new Float32Array([1.5, 2.0, 0.5]),
};

// "모든 x 좌표를 업데이트" 작업 시:
// x[0] → x[1] → x[2] → x[3] ...
// 모두 연속 메모리! 캐시 라인에 x 값만 빽빽하게 들어옴

// 성능 비교: 10만 파티클 x 좌표 일괄 이동
function moveAoS(particles, dx) {
  for (let i = 0; i < particles.length; i++) {
    particles[i].x += dx; // 매번 멀리 점프
  }
}

function moveSoA(particles, dx) {
  const x = particles.x;
  for (let i = 0; i < x.length; i++) {
    x[i] += dx; // 연속 메모리 순차 접근
  }
}

// SoA가 3~8배 빠름 (작업 패턴에 따라 다름)
```

### AoS vs SoA 선택 기준

```
AoS: "한 개체의 여러 속성을 함께 다룰 때" 유리
  → 특정 파티클의 x, y, z, mass를 모두 쓸 때
  → 일반적인 비즈니스 로직 (사용자 정보 한 명씩)

SoA: "여러 개체의 같은 속성을 한꺼번에 다룰 때" 유리
  → 물리 시뮬레이션, 게임 엔진, 데이터 처리
  → SIMD 명령어 최적화와도 잘 맞음
```

---

## 4. V8의 Hidden Classes (Shapes)

자바스크립트는 동적 언어지만 V8은 정적 타입 언어처럼 최적화하려 합니다.

```javascript
// ✅ Hidden Class가 일정하게 유지되는 경우
function createPoint(x, y) {
  return { x, y }; // 항상 같은 순서로 속성 생성
}
const p1 = createPoint(1, 2);
const p2 = createPoint(3, 4);
// p1, p2는 같은 Hidden Class → V8이 같은 메모리 레이아웃 사용
// → Inline Cache(IC) 적중 → 속성 접근이 배열 인덱싱만큼 빨라짐

// ❌ Hidden Class가 깨지는 경우
const obj1 = {};
obj1.x = 1; // Hidden Class A (x만)
obj1.y = 2; // Hidden Class B (x, y)  ← 새 클래스 생성

const obj2 = {};
obj2.y = 2; // Hidden Class C (y만)   ← 순서가 달라 A, B와 다른 클래스!
obj2.x = 1; // Hidden Class D (y, x)  ← 또 다른 클래스

// obj1과 obj2는 같은 속성인데 다른 Hidden Class
// → Inline Cache 미스 → 느린 속성 조회 경로 사용
```

```javascript
// ✅ Hidden Class를 일관되게 유지하는 방법

// 나쁨: 조건부 속성 추가
function makeUser(name, age, isAdmin) {
  const user = { name, age };
  if (isAdmin) user.permissions = ["read", "write"]; // 구조가 달라짐
  return user;
}

// 좋음: 초기화 시 모든 속성 명시
function makeUser(name, age, isAdmin) {
  return {
    name,
    age,
    permissions: isAdmin ? ["read", "write"] : null, // 항상 같은 구조
  };
}
```

---

## 5. Inline Cache (IC): V8의 속성 접근 최적화

```javascript
function getX(point) {
  return point.x;
}

const p1 = { x: 1, y: 2 };
const p2 = { x: 3, y: 2 };

// V8: getX(p1) 처음 호출 → "point는 {x, y} 구조구나" 기억
// getX(p2) 호출 → 같은 Hidden Class → 이전에 기억한 오프셋 재사용
// → 속성 이름 룩업 없이 직접 메모리 접근 (Monomorphic IC)

// ❌ 다형성(Polymorphic IC) 발생하면 느려짐
function getX(shape) {
  return shape.x;
}
getX({ x: 1, y: 2 });      // Hidden Class A
getX({ x: 3, y: 2, z: 1}); // Hidden Class B → 폴리모픽 됨
getX({ x: 5 });             // Hidden Class C → 메가모픽 → IC 포기
```

### IC 상태별 성능

```
Uninitialized: 첫 호출, 아직 최적화 안 됨
Monomorphic:   항상 같은 타입 → 가장 빠름 (L1 캐시처럼 직접 접근)
Polymorphic:   2~4가지 타입 → 약간 느림
Megamorphic:   5가지 이상 → IC 포기, 매번 동적 룩업
```

---

## 6. map/forEach가 캐시에게 고통받는 이유

### 자바스크립트 배열의 슬픈 실체: "진짜 배열이 아니다"

C나 Rust의 배열은 메모리가 `100, 104, 108...` 처럼 딱 붙어 있는 **연속 할당(Contiguous Allocation)**입니다. 하지만 자바스크립트 `[]`는 내부적으로 요소 타입에 따라 해시 테이블처럼 동작하기도 합니다.

### Pointer Chasing: map이 느린 진짜 이유

```javascript
const users = [
  { id: 1, name: "Alice", age: 30 },
  { id: 2, name: "Bob",   age: 25 },
  { id: 3, name: "Carol", age: 28 },
];

users.map(u => u.age * 2);
```

```
실제 메모리 구조:

배열 자체: [ref_A, ref_B, ref_C]  ← 연속 (캐시 히트 가능)
              ↓       ↓       ↓
           0x3f10  0xa820  0x1c40   ← 가리키는 객체들은 힙 여기저기!

map() 실행 흐름:
  1. 배열[0] 읽기   → ref_A 획득         (L1 캐시 히트 가능)
  2. ref_A 추적     → 0x3f10으로 점프     (L1 캐시 미스! 처음 보는 주소)
  3. u.age 읽기     → 0x3f10+offset      (L2/L3까지 올라가야 함)
  4. 배열[1] 읽기   → ref_B 획득         (L1 캐시 히트)
  5. ref_B 추적     → 0xa820으로 점프     (L1 캐시 미스! 또 다른 주소)
  ...
```

객체가 GC에 의해 힙 여기저기에 흩어져 있으면 **매 원소마다 캐시 미스**가 납니다.

### 깊은 참조: 캐시 미스가 곱셈으로 증가

```javascript
// ❌ 최악: 참조의 참조의 참조 (3단계 Pointer Chasing)
orders.map(order => order.user.profile.displayName);
//                         ↑         ↑           ↑
//                    캐시 미스 1  캐시 미스 2  캐시 미스 3
// 원소 1개당 최대 3번 캐시 미스 → 10만 건 = 30만 번 캐시 미스

// ✅ 미리 평탄화 (Flattening)
const names = orders.map(o => ({
  orderId: o.id,
  displayName: o.user.profile.displayName,  // 한 번만 추적
}));
// 이후 names.map(n => n.displayName) → 단순 구조, 캐시 히트
```

---

## 7. 비즈니스상 정렬할 수 없을 때의 대안

### A. 데이터 평탄화 (Data Flattening)

순서를 바꿀 수 없어도 **필요한 값만 별도 TypedArray로** 분리할 수 있습니다:

```javascript
// 정산 시스템: 주문 순서는 비즈니스상 고정
const orders = [
  { id: 1, amount: 15000, status: "paid",   userId: 42 },
  { id: 2, amount: 32000, status: "refund", userId: 17 },
  { id: 3, amount: 8500,  status: "paid",   userId: 42 },
  // ...10만 건
];

// ❌ 모든 주문의 금액 합산 (캐시 미스 빈번)
const total = orders.reduce((sum, o) => sum + o.amount, 0);
// 매 원소마다 객체 포인터 추적 발생

// ✅ 핫 패스용 TypedArray 별도 관리
const amounts = new Int32Array(orders.map(o => o.amount));

// 이후 집계는 TypedArray로
const total = amounts.reduce((sum, v) => sum + v, 0);
// 연속 메모리 → 캐시 라인 최대 활용 → 3~5배 빠름

// 정산 완료 후 결과를 다시 orders에 반영 (필요할 때만)
```

### B. V8 Elements Kind: 배열 타입을 지켜라

V8은 배열 원소 타입을 분석해 내부 표현 방식을 결정합니다:

```javascript
// 타입이 좋아지는 방향 (V8 내부 표현)
// SMI_ELEMENTS → DOUBLE_ELEMENTS → OBJECT_ELEMENTS
//   (가장 빠름)                        (가장 느림)

// ✅ SMI (Small Integer): 정수만 → 연속 메모리에 unboxed 저장
const prices = [100, 200, 300, 400];
// → SMI_ELEMENTS: 마치 C int[] 처럼 빽빽하게 저장

// ❌ 한 번이라도 float 섞으면 전체가 DOUBLE로 격하
prices.push(99.9);  // → DOUBLE_ELEMENTS로 전환
// 이미 들어간 정수들도 float으로 변환됨

// ❌❌ 객체 섞으면 OBJECT_ELEMENTS
prices.push({ discount: 10 }); // → 포인터 배열로 전환, Pointer Chasing

// ❌❌❌ 구멍(Hole) 생기면 HOLEY로 전환 (최악)
const arr = [1, 2, 3];
arr[100] = 4;  // 인덱스 3~99가 구멍 → HOLEY_ELEMENTS → 해시 테이블처럼 동작
```

```javascript
// V8 Elements Kind 확인 (Node.js)
// node --allow-natives-syntax test.js
function getKind(arr) {
  %DebugPrint(arr);  // V8 내부 정보 출력
}

// Elements Kind 저하를 막는 실천법
const N = 100000;

// ❌ 나쁨: 빈 배열에 push
const arr = [];
for (let i = 0; i < N; i++) arr.push(i * 1.5); // DOUBLE_ELEMENTS

// ✅ 좋음: 크기 미리 지정 + 타입 일관성
const arr = new Array(N);  // 크기 예약 (구멍 없음 보장)
for (let i = 0; i < N; i++) arr[i] = i * 1.5;  // 처음부터 DOUBLE_ELEMENTS

// ✅ 더 좋음: 타입 명시
const arr = new Float64Array(N);  // V8 고민할 필요 없음, 무조건 연속
for (let i = 0; i < N; i++) arr[i] = i * 1.5;
```

---

## 8. Hot Path vs Cold Path: 어디에만 집중할까

모든 코드를 최적화하면 가독성만 잃습니다. **반복 횟수가 많은 구간에서만** 이 지식을 씁니다.

```javascript
// 결제/정산 시스템 예시

// Cold Path (1회 실행): 최적화 불필요
async function createOrder(userId, items) {
  const user = await db.findUser(userId);          // DB I/O가 병목
  const inventory = await db.checkStock(items);    // DB I/O가 병목
  return await db.insertOrder({ user, items });    // DB I/O가 병목
  // CPU 캐시 최적화해봐야 DB 기다리는 시간 앞에선 의미 없음
}

// ✅ Hot Path (대량 반복): 캐시 최적화 가치 있음
function calculateSettlement(transactions) {
  // transactions: 수백만 건 처리
  // 여기서 수백만 번 반복하는 내부 루프가 병목

  // 핫 패스용 데이터 평탄화
  const amounts  = new Float64Array(transactions.map(t => t.amount));
  const statuses = new Uint8Array(transactions.map(t => t.status === "paid" ? 1 : 0));

  let total = 0;
  for (let i = 0; i < amounts.length; i++) {
    if (statuses[i]) total += amounts[i];  // 연속 메모리 순차 접근
  }
  return total;
}
```

```
판단 기준:
  루프 횟수 < 1,000:    신경 쓸 필요 없음
  루프 횟수 10만~100만: TypedArray + 타입 일관성 고려
  루프 횟수 > 1000만:   SoA + TypedArray + Worker Threads 고려
```

---

## 9. 실전: 성능 병목 찾기

```javascript
// Chrome DevTools로 캐시 미스 간접 측정
// Performance 탭 → "Memory" 체크 → 프로파일링

// 또는 직접 측정
function benchmark(name, fn, iterations = 1000) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();
  console.log(`${name}: ${((end - start) / iterations).toFixed(3)}ms/iter`);
}

// AoS vs SoA 비교
const N = 100000;
const aoS = Array.from({ length: N }, (_, i) => ({ x: i, y: i, vx: 0, vy: 0 }));
const soA = {
  x:  new Float64Array(N).map((_, i) => i),
  y:  new Float64Array(N).map((_, i) => i),
  vx: new Float64Array(N),
  vy: new Float64Array(N),
};

benchmark("AoS update", () => {
  for (let i = 0; i < N; i++) {
    aoS[i].x += aoS[i].vx; // 캐시 미스 빈번
    aoS[i].y += aoS[i].vy;
  }
});

benchmark("SoA update", () => {
  const { x, y, vx, vy } = soA;
  for (let i = 0; i < N; i++) {
    x[i] += vx[i]; // 연속 메모리
    y[i] += vy[i];
  }
});
```

---

## 10. 계층별 정리

| 레이어 | 자바스크립트에서의 구현 | 관련 CS 개념 |
|--------|----------------------|------------|
| CPU 레지스터 | V8 JIT 컴파일러가 변수를 레지스터에 유지 | 레지스터 할당 |
| L1/L2 캐시 | TypedArray, SoA, Row-major 접근 | 캐시 라인, 공간 지역성 |
| L3 캐시 | 작업 단위를 캐시 크기에 맞게 분할 (Cache Blocking) | 시간 지역성 |
| DRAM | 큰 배열 할당, GC 관리 | 페이지, 가상 메모리 |
| 운영체제 | 대량 메모리 할당 시 Page Fault 최소화 | mmap, hugepage |

---

## 핵심 요약

```
1. TypedArray 사용: 연속 메모리 배치 → 공간 지역성 극대화
2. Row-major 순회: 2D 배열은 행 방향으로 (캐시 라인과 일치)
3. SoA 설계: 같은 속성을 연속 배열로 → 일괄 처리 시 압도적
4. Hidden Class 유지: 객체 구조를 생성 후 바꾸지 않음
5. 속성 순서 일관성: 모든 인스턴스가 같은 순서로 속성 초기화
6. Pointer Chasing 최소화: map/forEach 내 깊은 참조(a.b.c) 피하기
7. Elements Kind 유지: 배열에 타입 섞지 않기, 구멍(hole) 만들지 않기
8. Hot Path에만 집중: 루프 10만 번 이상인 구간에서만 이 지식 적용
```

"자바스크립트로 L1 캐시를 제어한다"는 말은 **CPU가 L1 캐시에 우리 데이터를 효율적으로 채워 넣도록 메모리 레이아웃을 설계한다**는 뜻입니다. Rust나 C++로 가면 이 제어가 훨씬 명시적이 되고, 그때 이 개념들이 성능의 핵심이 됩니다.
