---
title: "[FP 시리즈] 21. 함수형 반응형 프로그래밍 (FRP)"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "FRP", "RxJS", "반응형", "observable", "FP"]
---

# 함수형 반응형 프로그래밍 (FRP)

FRP는 **시간에 따라 변하는 값과 이벤트 스트림을 함수형으로 다루는** 패러다임입니다. "이벤트가 들어오면 무엇을 할까"를 명령형으로 작성하는 대신, 값의 **흐름(stream)**을 선언적으로 표현합니다.

## 핵심 개념

- **Observable**: 시간에 따라 여러 값을 방출하는 스트림
- **Observer**: 스트림의 값을 받아 처리하는 구독자
- **Operator**: 스트림을 변환하는 순수 함수 (`map`, `filter`, `merge` 등)

Promise가 "미래의 하나의 값"이라면, Observable은 "미래의 여러 값".

```
Promise:    ─────────────●
Observable: ─●──●──●──●─●──●─...
```

## Observable 직접 구현

```typescript
type Observer<T> = {
  next: (value: T) => void;
  error: (err: Error) => void;
  complete: () => void;
};

type Unsubscribe = () => void;

class Observable<T> {
  constructor(
    private readonly subscribe: (observer: Observer<T>) => Unsubscribe,
  ) {}

  static create<T>(fn: (observer: Observer<T>) => Unsubscribe): Observable<T> {
    return new Observable(fn);
  }

  // 배열로부터 생성
  static from<T>(arr: T[]): Observable<T> {
    return new Observable(observer => {
      for (const item of arr) observer.next(item);
      observer.complete();
      return () => {};
    });
  }

  // 이벤트로부터 생성
  static fromEvent(element: EventTarget, event: string): Observable<Event> {
    return new Observable(observer => {
      const handler = (e: Event) => observer.next(e);
      element.addEventListener(event, handler);
      return () => element.removeEventListener(event, handler); // cleanup
    });
  }

  map<U>(fn: (value: T) => U): Observable<U> {
    return new Observable(observer =>
      this.subscribe({
        next: value => observer.next(fn(value)),
        error: err => observer.error(err),
        complete: () => observer.complete(),
      }),
    );
  }

  filter(pred: (value: T) => boolean): Observable<T> {
    return new Observable(observer =>
      this.subscribe({
        next: value => pred(value) && observer.next(value),
        error: err => observer.error(err),
        complete: () => observer.complete(),
      }),
    );
  }

  pipe<U>(operator: (obs: Observable<T>) => Observable<U>): Observable<U> {
    return operator(this);
  }

  collect(observer: Observer<T>): Unsubscribe {
    return this.subscribe(observer);
  }
}
```

## 실용적인 예시 (RxJS)

실무에서는 RxJS를 사용합니다.

```typescript
import { fromEvent, interval, of, from } from 'rxjs';
import { map, filter, debounceTime, switchMap, catchError, take } from 'rxjs/operators';

// 검색창 자동완성
const searchInput = document.getElementById('search')!;

fromEvent(searchInput, 'input').pipe(
  map(e => (e.target as HTMLInputElement).value), // 입력값 추출
  filter(query => query.length >= 2),             // 2글자 이상
  debounceTime(300),                              // 300ms 디바운스
  switchMap(query =>                              // 이전 요청 취소, 새 요청
    from(fetch(`/api/search?q=${query}`).then(r => r.json())).pipe(
      catchError(() => of([])), // 에러 시 빈 배열
    ),
  ),
).subscribe({
  next: results => renderResults(results),
  error: err => console.error(err),
});
```

명령형으로 구현하면 `setTimeout`, 요청 취소, 에러 처리를 각각 관리해야 합니다. Observable 파이프라인은 이것을 선언적으로 표현합니다.

## 시간을 다루는 연산자들

```typescript
import { interval, timer, merge, combineLatest } from 'rxjs';
import { take, delay, throttleTime } from 'rxjs/operators';

// 1초마다 값 방출
interval(1000).pipe(take(5)).subscribe(console.log); // 0, 1, 2, 3, 4

// 3초 후 시작
timer(3000, 1000).pipe(take(3)).subscribe(console.log);

// 두 스트림을 병합
const clicks = fromEvent(document, 'click');
const keypresses = fromEvent(document, 'keypress');
merge(clicks, keypresses).subscribe(e => console.log('이벤트:', e.type));

// 두 스트림의 최신 값을 조합
const userStream = /* User Observable */ of({ name: '홍길동' });
const settingsStream = /* Settings Observable */ of({ theme: 'dark' });

combineLatest([userStream, settingsStream]).subscribe(([user, settings]) => {
  renderApp(user, settings);
});
```

## 상태 관리: BehaviorSubject

Observable은 읽기 전용이지만, `Subject`는 외부에서 값을 방출할 수 있습니다.

```typescript
import { BehaviorSubject } from 'rxjs';

// BehaviorSubject: 현재 값을 가지고 있는 Subject
const count$ = new BehaviorSubject(0);

// 구독
count$.subscribe(n => console.log('count:', n)); // 즉시 0 출력

// 값 변경
count$.next(1); // count: 1
count$.next(2); // count: 2

// 현재 값 읽기
count$.getValue(); // 2

// React와 통합
function useObservable<T>(observable: Observable<T>, initial: T) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const sub = observable.subscribe(setValue);
    return () => sub.unsubscribe();
  }, [observable]);
  return value;
}
```

## FRP vs Promise/async-await

```typescript
// async/await — 단일 비동기 값, 취소 어려움
async function search(query: string) {
  const results = await fetch(`/api/search?q=${query}`);
  return results.json();
}

// Observable — 스트림, 취소 가능, 다양한 연산자
const search$ = (query: string) =>
  from(fetch(`/api/search?q=${query}`).then(r => r.json()));

// switchMap이 이전 요청을 자동으로 취소
input$.pipe(switchMap(search$)).subscribe(render);
```

| | Promise | Observable |
|--|---------|-----------|
| 값의 수 | 1개 | 0개 이상 |
| 취소 | 어려움 | `unsubscribe()` |
| 지연 실행 | 즉시 실행 | 구독 시 실행 (cold) |
| 연산자 | 제한적 | 100개 이상 |

## 실무 적용 범위

FRP/RxJS가 빛나는 곳:
- **복잡한 UI 인터랙션**: 드래그&드롭, 자동완성, 실시간 검색
- **WebSocket/SSE**: 지속적인 데이터 스트림
- **여러 이벤트 조합**: 키보드 + 마우스 + 타이머
- **경쟁 조건 방지**: `switchMap`, `exhaustMap` 등

반면 단순한 HTTP 요청은 async/await가 더 직관적입니다. 도구를 선택할 때는 복잡도를 기준으로 합니다.

## 정리

- **Observable**: 시간에 따른 값의 스트림 — Promise의 여러 값 버전
- **FRP**: 이벤트 스트림을 함수형으로 변환/조합 — 복잡한 비동기를 선언적으로
- **RxJS**: JavaScript/TypeScript의 대표 FRP 라이브러리

FRP는 **"언제 값이 오는지"와 "그 값으로 무엇을 할지"를 분리**합니다. 이벤트가 언제 올지 모르는 복잡한 비동기 시나리오에서 명령형보다 훨씬 명확한 코드를 만들 수 있습니다.
