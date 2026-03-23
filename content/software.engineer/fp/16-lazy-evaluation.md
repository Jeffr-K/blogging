---
title: "[FP 시리즈] 16. 지연 평가 (Lazy Evaluation)"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "지연평가", "lazy evaluation", "generator", "FP"]
---

# 지연 평가 (Lazy Evaluation)

지연 평가는 **필요할 때까지 계산을 미루는** 전략입니다. 반대는 즉시 평가(Eager Evaluation)입니다.

## 즉시 평가 vs 지연 평가

```typescript
// 즉시 평가 — 모든 값을 먼저 계산
const result = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  .map(x => x * 2)      // 10개 전부 변환
  .filter(x => x > 10)  // 10개 전부 검사
  .slice(0, 3);          // 그제야 3개만 취함
// 10 * 2번의 연산 후 3개만 사용

// 지연 평가 — 필요한 만큼만 계산
const lazyResult = take(3,
  filter(x => x > 10,
    map(x => x * 2,
      range(1, 10))));
// 3개를 얻는 데 필요한 만큼만 연산
```

## JavaScript Generator로 지연 평가 구현

Generator 함수는 `yield`로 값을 하나씩 생성합니다. 요청이 있을 때만 다음 값을 계산합니다.

```typescript
// 무한 수열 — 즉시 평가로는 불가능
function* naturals(start = 1): Generator<number> {
  let n = start;
  while (true) {
    yield n++;
  }
}

// 지연 map
function* lazyMap<T, U>(
  iter: Iterable<T>,
  fn: (x: T) => U,
): Generator<U> {
  for (const x of iter) {
    yield fn(x);
  }
}

// 지연 filter
function* lazyFilter<T>(
  iter: Iterable<T>,
  pred: (x: T) => boolean,
): Generator<T> {
  for (const x of iter) {
    if (pred(x)) yield x;
  }
}

// 앞 n개만 취하기
function* lazyTake<T>(iter: Iterable<T>, n: number): Generator<T> {
  let count = 0;
  for (const x of iter) {
    if (count >= n) return;
    yield x;
    count++;
  }
}

// 활용: 1부터 시작해 짝수인 것의 2배를, 처음 5개
const result = [...lazyTake(
  lazyMap(
    lazyFilter(naturals(), x => x % 2 === 0),
    x => x * 2,
  ),
  5,
)];
// [4, 8, 12, 16, 20]
// 무한 수열에서 필요한 만큼만 계산
```

## 지연 파이프라인

체이닝 스타일로 만들면 더 읽기 좋습니다.

```typescript
class LazySequence<T> {
  constructor(private readonly source: Iterable<T>) {}

  static from<T>(source: Iterable<T>): LazySequence<T> {
    return new LazySequence(source);
  }

  static range(start: number, end?: number): LazySequence<number> {
    return new LazySequence(
      (function* () {
        let i = start;
        while (end === undefined || i <= end) yield i++;
      })(),
    );
  }

  map<U>(fn: (x: T) => U): LazySequence<U> {
    const source = this.source;
    return new LazySequence(
      (function* () {
        for (const x of source) yield fn(x);
      })(),
    );
  }

  filter(pred: (x: T) => boolean): LazySequence<T> {
    const source = this.source;
    return new LazySequence(
      (function* () {
        for (const x of source) if (pred(x)) yield x;
      })(),
    );
  }

  take(n: number): LazySequence<T> {
    const source = this.source;
    return new LazySequence(
      (function* () {
        let count = 0;
        for (const x of source) {
          if (count++ >= n) return;
          yield x;
        }
      })(),
    );
  }

  toArray(): T[] {
    return [...this.source]; // 여기서 실제 계산 발생
  }

  first(): T | undefined {
    for (const x of this.source) return x; // 첫 번째 하나만 계산
  }
}

// 사용 — 선언적이고 읽기 쉬움, 실제 계산은 toArray/first에서
LazySequence.range(1)         // 1, 2, 3, ... (무한)
  .filter(x => x % 3 === 0)  // 3의 배수
  .map(x => x * x)            // 제곱
  .take(5)                    // 처음 5개
  .toArray();                  // [9, 36, 81, 144, 225]
```

## 실용적인 예시

### 대용량 데이터 처리

```typescript
// 파일을 줄 단위로 지연 처리 (Node.js)
async function* readLines(filePath: string): AsyncGenerator<string> {
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream });
  for await (const line of rl) {
    yield line;
  }
}

// 백만 줄짜리 CSV — 전부 메모리에 올리지 않고 처리
const errorLines = readLines('huge-log.csv');
for await (const line of lazyFilter(errorLines, l => l.includes('ERROR'))) {
  console.log(line);
}
```

### 비용 큰 계산의 지연

```typescript
// 값을 처음 접근할 때만 계산하는 lazy 프로퍼티
function lazy<T>(compute: () => T): () => T {
  let computed = false;
  let value: T;
  return () => {
    if (!computed) {
      value = compute();
      computed = true;
    }
    return value;
  };
}

const expensiveConfig = lazy(() => {
  console.log('설정 로드 중...');
  return loadConfig(); // 처음 호출 시 한 번만 실행
});

// expensiveConfig()를 호출하기 전까지 loadConfig는 실행 안 됨
```

### 조건부 단락 평가

지연 평가는 `&&`, `||`에도 이미 적용되어 있습니다.

```typescript
// false && expensiveOp() — expensiveOp는 실행 안 됨
// true || expensiveOp()  — expensiveOp는 실행 안 됨

// 함수로 표현
function lazyAnd(a: boolean, b: () => boolean): boolean {
  return a && b(); // a가 false면 b()는 호출 안 됨
}
```

## 무한 데이터 구조

지연 평가의 가장 강력한 응용입니다.

```typescript
// 피보나치 수열 (무한)
function* fibonacci(): Generator<number> {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// 처음 10개의 피보나치 수
const first10 = [...lazyTake(fibonacci(), 10)];
// [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

// 100보다 큰 첫 번째 피보나치 수
const firstOver100 = LazySequence.from(fibonacci())
  .filter(n => n > 100)
  .first();
// 144
```

## 정리

- **지연 평가**: 필요할 때까지 계산 미룸 — 불필요한 연산 방지
- **Generator**: JavaScript의 지연 평가 메커니즘 — `yield`로 값을 하나씩 생성
- **무한 시퀀스**: 지연 평가가 있어야만 가능

지연 평가는 대용량 데이터 처리, 무한 시퀀스, 비용이 큰 계산의 지연에 유용합니다. 즉시 평가가 기본인 JavaScript에서 Generator를 활용해 필요한 부분에만 선택적으로 적용합니다.
