---
title: "Episode 8. functions"
author: anonymous.rs
date: 2025-12-22
tags: ["rust", "Functional Programming with Domain Driven Design"]
---

### 주인공인 함수

함수를 주인공으로 취급하는 방식을 살펴보자.

```rust
fn plus3(x: i32) -> i32 {
     x + 3
}

fn times2(x: i32) -> i32 {
    x * 2
}

fn main() {
    let square = |x| x * x;
    let add_three = plus3;
    
    // 함수를 리스트에 포함
    let list_of_functions = vec![square, add_three, times2];

    // 순회 및 평가
    for func in list_of_functions {
        println!("{}", func(5));
    }
}
```

위의 코드는 개념적으로 **일급 함수(First-class functions)** 의 개념을 잘 보여주고 있지만, 러스트의 엄격한 타입 시스템 때문에 그대로 실행하면 컴파일 에러가 발생한다.

컴파일 에러가 발생하는 이유는 다음과 같다:

- 클로저의 고유 타입: `let square = |x| x * x;` 으로 정의된 클로저는 컴파일러가 생성한 익명의 고유 타입을 가진다.

- 함수 포인터와의 차이: `plus3` 과 `time2` 는 함수 포인터 타입인 `fn(i32) -> i32` 으로 취급될 수 있지만 위에서 만든 클로저인 `square` 와는 타입이 다르다.

- 벡터의 단일 타입 원칙: `Vec` 은 오직 한 가지 타입의 데이터만 담을 수 있기 때문에 서로 다른 타입인 클로저와 함수를 한 벡터에 넣으려 했기 때문에 에러가 발생할 수 있다.

### 이를 해결하기 위한 방법은 어떤것들이 있을까?

해결 방법으로는:

- 함수 포인터를 이용하라
- Trait Object 를 사용하라

정도로 구체화할 수 있다.

##### 함수 포인터(fn)을 사용하여 해결하기

만약 클로저가 외부 변수를 **캡쳐(Capture)**하지 않는다면, 간단하게 함수 포인터 타입으로 타입을 명시하여 해결할 수 있다.

```rust
fn plus3(x: i32) -> i32 { x + 3 }
fn times2(x: i32) -> i32 { x * 2 }

fn main() {
    let square: fn(i32) -> i32 = |x| x * x;
    let add_three: fn(i32) -> i32 = plus3;

    let list_of_functions = vec![square, add_three, times2];
    
    for func in list_of_functions {
        println!("{}", func(5));
    }
}
```

##### 트레이트 객체(Box<dyn Fn>) 을 사용하여 해결하기

만약 클로저가 외부 변수를 사용 또는 캡처(Capture)하거나 더 유연하게 함수들을 관리하고 싶다면 **동적 디스패치**를 사용해야 한다. 힙(Heap) 메모리에 할당하여 타입을 추상화하는 방식이다.

```rust
fn plus3(x: i32) -> i32 { x + 3 }
fn times2(x: i32) -> i32 { x * 2 }

fn main() {
    let y = 10;
    
    let closure_with_capture = move |x| x + y;

    let list_of_functions: Vec<Box<dyn Fn(i32) -> i32>> = vec![
        Box::new(|x| x * x),
        Box::new(plus3),
        Box::new(times2),
        Box::new(closure_with_capture),
    ];

    for func in list_of_functions {
        println!("{}", func(5));
    }
}
```

<u>`let closure_with_capture = move |x| x + y;` 의 타입은 무엇일까?</u> 보통 `move` 키워드를 이용해 `x+y` 연산을 실행하는 `Fn` 타입이라고 생각하기 쉽지만, 이 타입의 실체는 *컴파일러만 알고 있는 익명의 특별한 구조체 타입* 이다.

```rust
//! 컴파일러가 생성하는 가상의 구조체 모습.
struct ClosureUniqueName {
    y: i32,
}

//+ 구조체가 "함수처럼 호출될 수 있도록" 트레이트를 구현.
impl Fn(i32) -> i32 for ClosureUniqueName {
    fn call(&self, x: i32) -> i32 {
        x + self.y
    }
}
```

외부 변수를 사용하지 않는 함수 포인터 타입은 상관이 없지만, 외부 변수를 캡처하는 함수는 외부 변수인 `y` 를 내부에 저장해야 한다. 이때, `y` 를 복사해서 가질지, 참조할지에 따라 구조체의 모양이 완전히 달라지기 때문에 데이터를 품고 있는(Stateful) 클로저는 일반적인 함수 포인터인 `Fn` 에 담을 수 없게 된다.

따라서 정리하자면, 우리가 이 클로저를 변수에 저장하거나 벡터에 넣으려면 정확한 타입을 명시하는 대신, `impl Fn(i32) -> i32` 또는 `Box<dyn Fn(i32) -> i32` 와 같은 Trait 인터페이스를 빌려서 표현해야 하는 것이다.

<u>두 방식의 차이점은 다음과 같다:</u>

<u>함수 포인터:</u>

- 특징: 캡처가 없는 클로저와 함수에 사용할 수 있다.
- 장점: 성능이 빠르고 메모리 할당이 없다.
- 단점: 외부 변수를 사용하는 클로저는 사용이 불가능하다.

<u>트레이트 객체(Box<dyn Fn>):</u>

- 특징: 모든 함수 및 클로저 사용이 가능하다.
- 장점: 유연성이 매우 높다.
- 단점: 힙 할당 및 런타임 오버헤드가 소폭 발생할 수 있다.

이러한 차이가 있지만 Rust 진영에서는 보통 `Box<dyn Fn>`을 사용하는 추세다.

### 입력으로서의 함수

함수를 주인공(일급 객체)으로 다룬다는 것은 함수를 다른 함수의 **인자(Argument)**로 넘길 수 있음을 의미한다. 이를 통해 로직을 추상화하고 재사용성을 극대화하는 **고차 함수(Higher-order Function)**를 구현할 수 있다.

> [!caution] 주의: 클로저 매개변수에서의 impl Trait 제한
>  함수(fn) 정의와 달리, 변수에 할당하는 클로저의 매개변수에는 impl Trait 문법을 사용할 수 없다.
>  // ❌ 컴파일 에러 발생: `impl Trait`은 클로저 매개변수에 허용되지 않음
>  let eval_with_5_then_add_2 = |f: impl Fn(i32) -> i32| { f(5) + 2 };

이 제약을 해결하고 함수를 입력으로 받으려면 상황에 따라 다음의 세 가지 전략을 선택해야 한다.


##### 1. 일반 함수(fn)와 제네릭 사용 (정적 디스패치)

가장 권장되는 방식이다. 클로저 대신 일반 함수를 정의하고 제네릭(T: Fn...)이나 impl Trait을 사용한다. 컴파일 시점에 타입이 결정되므로 성능 최적화가 완벽하게 이루어진다.

```rust
fn eval_with_5_then_add_2(f: impl Fn(i32) -> i32) -> i32 {
    f(5) + 2
}

fn main() {
    let add1 = |x| x + 1;
    let result = eval_with_5_then_add_2(add1);
    println!("결과: {}", result); // 8
}
```

##### 2. 트레이트 객체 사용 (동적 디스패치)

반드시 변수에 담긴 클로저 형태를 유지해야 하거나, 런타임에 다양한 함수를 갈아끼워야 한다면 &dyn Fn을 사용한다.

```rust
fn main() {
    // &dyn Fn을 사용하여 어떤 함수든 참조로 받을 수 있게 함
    let eval_with_5_then_add_2 = |f: &dyn Fn(i32) -> i32| { f(5) + 2 };

    let add1 = |x| x + 1;
    let result = eval_with_5_then_add_2(&add1);
}
```

##### 3. 함수 포인터(fn) 사용

외부 변수를 캡처하지 않는 순수 함수만 인자로 받는다면 가장 가벼운 방식이다.

```rust
let eval_with_5_then_add_2 = |f: fn(i32) -> i32| { f(5) + 2 };
```

##### 어떤 방식을 선택해야 할까?

러스트에서 함수를 입력으로 받을 때는 **정적 디스패치(Static Dispatch)**와 **동적 디스패치(Dynamic Dispatch)** 사이의 트레이드오프를 이해해야 한다.

| 방식 | 문법 | 특징 |
| :--- | :--- | :--- |
| **정적 디스패치** | `impl Fn` / `<F: Fn>` | 컴파일 타임에 모든 타입이 결정되어 실행 속도가 가장 빠름 (인라인 최적화 가능) |
| **동적 디스패치** | `&dyn Fn` / `Box<dyn Fn>` | 런타임에 호출될 함수를 결정하므로 유연하지만, 브이테이블(vtable) 조회를 위한 미세한 오버헤드가 발생합니다. |

결론적으로, 대부분의 라이브러리나 공용 유틸리티를 만들 때는 fn 정의와 함께 제네릭(impl Fn)을 사용하는 것이 러스트다운 방식이다.

반면, 복잡한 비즈니스 로직에서 함수들의 리스트를 순회하거나 런타임 전략을 교체해야 할 때는 dyn Fn이 주인공이 된다.

### 출력으로서의 함수

함수를 출력으로 반환하는 큰 이유는 특정 매개변수를 함수에 고정(bake-in)할 수 있기 때문이다. 

예를 들어 다음과 같이 세 가지 서로 다른 더하기 함수가 있다고 가정한다.

```rust
let add1 = |x| x + 1;
let add2 = |x| x + 2;
let add3 = |x| x + 3;
```

여기서 만약 중복을 제거하려면 어떻게 해야할까? 여기서 중복을 제거하려면 특정 값을 미리 설정한 더하기 함수를 반환하는 `가산기 생성기(adder generator)`를 만들면 된다.

러스트에서 함수를 반환할 때는 반환 타입을 `impl Fn` 으로 명시하고, 내부 변수 값을 클로저 안으로 옮기기 위해 `move` 키워드를 사용한다.

```rust
let adder_generator = |n| move |x| n + x;
```

그럼 실제로 사용하면:

```rust
let add5 = adder_generator(5);
let add6 = adder_generator(6);
let add7 = adder_generator(7);

let result = add5(2) + add6(3) + add7(4);
```

### 커링(currying)

함수를 반환하는 이 트릭을 사용하면 여러 매개변수를 받는 함수를, 단일 매개변수를 연이어 받는 함수로 변환할 수 있다.

이 방법을 **커링(currying)**이라고 한다.

예를 들어 두 개의 매개변수를 받는 `add` 함수가 있다고 가정한다.

```rust
let add = |x| move |y| x + y;
```

##### 어떻게 커링하는가?

커링된 함수는 한 번에 모든 인자를 전달하는 것이 아니라, 인자를 하나씩 전달하며 중간 단계의 함수를 거쳐 최종 결과에 도달한다.

```rust
fn main() {
    let add = |x| move |y| x + y;

    // 1. 첫 번째 인자 x를 전달하여 '중간 함수'를 생성한다.
    let add5 = add(5); 

    // 2. 두 번째 인자 y를 전달하여 '최종 결과'를 얻는다.
    let result = add5(10); 

    // 또는 한 번에 연쇄적으로 호출할 수도 있다.
    let direct_result = add(5)(10);

    println!("결과: {}", result); // 15
}
```

##### 커링의 장점

커링은 단순히 호출 방식을 바꾸는 것이 아니라 **부분 적용(Partial Application)**을 가능하게 한다.

1. 설정의 재사용: add(5)를 통해 '5를 더하는 함수'라는 새로운 전문 함수를 만들어 내고, 이를 여러 곳에서 재사용할 수 있다.

2. 함수 합성의 기초: 인자가 하나인 함수들은 서로 연결(Chaining)하기가 훨씬 쉽다. 이는 복잡한 비즈니스 로직을 작은 단위의 함수 결합으로 풀어내는 기반이 된다.

3. 지연 실행: 필요한 인자가 모두 모일 때까지 계산을 뒤로 미룰 수 있다.

결국 커링은 함수를 하나의 거대한 로직 덩어리가 아니라, 작고 유연한 조립식 부품으로 다루기 위한 핵심적인 기법이다.

##### 부분 적용(Partial Application)이란?

모든 함수가 커리 함수라면, 다중 매개 변수 함수에 인수 하나만 전달해도 나머지 매개변수들을 입력받는 새로운 함수를 얻을 수 있다는 뜻이다.

```rust
// 1. 커링된 함수 정의
// `greeting` 을 입력받아, `name` 을 입력받는 클로저를 반환한다.
let say_greeting = |greeting: String| {
    move |name: String| println!("{}, {}!", greeting, name)
};
```

하지만 하나의 인수만 전달하여 새로운 함수를 만들 수 있다.

```rust
// 2. 하나의 인수("Hello")만 전달하여 새로운 함수를 생성한다. (부분 적용)
// 이 시점에 `Hello` 라는 값은 반환되는 클로저 내부로 `move` 되어 고정된다.
let say_hello = say_greeting("Hello".to_string());
```

이 함수들은 이제 하나 남은 매개 변수인 name 을 입력 받아 화면에 출력한다.

```rust
// 3. 이제 하나 남은 매개변수인 name만 입력받아 화면에 출력한다.
say_hello("Alex".to_string());  // 출력: "Hello, Alex!"
say_hello("Gemini".to_string()); // 출력: "Hello, Gemini!"
```

이 부분 적용 패턴은 매우 중요하다.

### 완전 함수

수학 함수는 모든 가능한 입력을 출력으로 연결한다. 함수형 프로그래밍에서도 같으 방식으로 함수를 디자인한다. 즉, 모든 입력값에 해당하는 출력값이 존재하도록 말이다. 이러한 함수를 완전 함수(total function)이라고 한다.

왜 이렇게 해야할까?

가능한 명확하게 표현하고 모든 효과를 타입 시그니처에 명시적으로 기록하기 위함이다.

예를 들어보면, twelveDivideBy 라는 함수는 `12` 를 입력값으로 나눈 결과를 정수로 반환한다. 의사코드는 다음과 같다:

```rust
fn twelve_divide_by(x: i32) -> i32 {
    match x {
        6 -> 2,
        5 -> 2,
        4 -> 3,
        3 -> 4,
        2 -> 6,
        1 -> 12,
        0 -> ???
    }
}
```

이제 입력값이 0일 때 출력은 무엇일까? 12를 0으로 나누는 것은 정의되지 않은 동작이다. 가능한 모든 입력값에 출력값이 존재하지 않아도 된다면 0일 경우는 예외를 발생시키면 된다.

```rust
  0 -> panic!("Cannot divide by zero")
```

이렇게 정의된 함수의 시그니처는 다음과 같다:

```rust
let twelve_divide_by = |x: i32| {} // 함수 시그니처 타입 어케 만드는지 모름
```

이 방식은 사실 좋은 방식이 아니다. 항상 정수를 반환하지 않고 예외를 반환하기 때문이다. 하지만 이 사실이 함수의 타입 시그니처에 드러나지 않았다.

따라서 타입 시그니처에 이러한 사실을 명시하는 고민은 다음과 같다:

<u>"모든 입력값에 대해 유효한 출력값을 반환하며 예외가 발생하지 않도록 하려면 어떻게 해야할까?"</u>

한 가지 방법은 입력값을 제한하여 잘못된 값을 없애는 방법이다. 이 예제에서 새로운 타입인 `NonZeroInteger` 을 만들어 0 이 포함되지 않도록 해보자.

```rust
use std::num::NonZeroI32;

let twelve_divide_by = |x: NonZeroI32| {
    match x.get() {
        6 => 2,
        5 => 2,
        4 => 3,
        3 => 4,
        2 => 6,
        1 => 12,
    }
};
```

`std::num::NonZeroI32` 을 사용하여 0이 아닌 정수를 나타내는 타입을 정의한다.

이러면 타입 시그니처는 다음과 같다.

```rust
type TwelveDivideBy = fn(NonZeroI32) -> i32;
```

또 다른 방법은 출력값을 확장하는 방법이 있다. 이 방식은 0을 입력값으로 허용하지만 유의미한 정수와 정의되지 않은 값을 포괄하도록 출력값을 확장한다.

```rust
const twelve_divided_by: fn(i32) -> Option<i32> = |x| match x {
    0 => None,
    _ => Some(x),
};
```

이 방식으로 정의된 함수의 시그니처는 다음과 같다:

```rust
type TwelveDividedBy = fn(i32) -> Option<i32>;
```

### 함수 합성

함수 합성이란, 앞선 함수의 결과를 다음 함수의 입력으로 연결하여 함수를 결합하는 방식이다.

예를 들어서 두개의 함수를 정의한다. 

1. 사과를 입력 받아 바나나를 출력하는 함수
2. 바나나를 입력 받아 체리를 출력하는 함수

이 두 함수를 결합하면 새로운 합성 함수가 만들어진다. 이러한 합성의 중요한 측면 중 하나는 정보 은닉(Information hiding)이다. 최종 합성된 함수가 더 작은 함수들로 이루어져 있다는 것을 알 수 없으며,

더 작은 함수들이 무엇을 처리했는지 알 수 없다.

결국 두 함수의 첫번째 함수 출력 타입과 연결될 다음 함수의 입력 타입이 동일하기만 하면 두 함수를 결합시킬 수 있다. 이를 **파이핑(piping)**이라고 한다.

타입스크립트에서는 `fp-ts` 패키지의 `pipe()` 가 있어 쉽게 함수를 결합할 수 있다.

하지만 러스트는 명확성과 제로 코스트 추상화를 중시하기 때문에:

- 메서드 체이닝으로도 충분하다: 이미 `.` 연산자를 통한 체이닝이 강력하다.
- 트레이트(trait)의 존재: 특정 기능을 확장하고 싶을 때 함수를 만들기보다 해당 타입에 새로운 트레잇을 구현하여 메서드를 추가하는 방식을 권장한다.

##### 1. 표준 라이브러리(std) 방식: 메서드 체이닝
러스트에서 가장 권장되고 널리 쓰이는 방식입니다. 별도의 합성 함수를 만들기보다, 타입에 메서드를 정의하여 . 연산자로 연결합니다.

특징: Iterator, Option, Result 등에서 기본적으로 제공됩니다.

장점: 가독성이 뛰어나고 표준 라이브러리만으로 충분합니다.

```rust
let result = vec![1, 2, 3]
    .into_iter()
    .map(|x| x + 1)  // 첫 번째 합성
    .filter(|x| x > 2) // 두 번째 합성
    .collect::<Vec<_>>();
```

##### 2. 사용자 정의 합성 (Custom Implementation)

함수형 언어의 pipe나 compose를 직접 구현하여 사용하는 방식입니다.

##### A. 클로저를 통한 수동 합성

가장 직관적이며 추가 비용이 없는 방식입니다.

```rust
let add_one = |x| x + 1;
let times_two = |x| x * x;

// 두 함수를 직접 결합하여 새로운 함수 생성
let composed = |x| times_two(add_one(x));
```

##### B. 제네릭 pipe 함수 구현

타입스크립트의 pipe와 유사한 헬퍼를 만들어 정적 디스패치를 활용할 수 있습니다.

```rust
fn pipe<A, B, C, F, G>(f: F, g: G) -> impl Fn(A) -> C
where
    F: Fn(A) -> B,
    G: Fn(B) -> C,
{
    move |x| g(f(x))
}
```

##### 3. 외부 크레이트(Crate) 활용

더 세련된 문법(Syntactic Sugar)을 원할 때 선택할 수 있는 강력한 도구들입니다.

##### A. pipe 크레이트

Elixir의 |> 연산자와 유사한 매크로를 제공합니다.

```rust
use pipe::pipe;

let result = pipe!(
    input 
    => func_a 
    => func_b
);
```

##### B. tap 크레이트

메서드 체이닝 중간에 값을 바꾸지 않고 로깅을 하거나, 일반 함수를 체이닝에 끼워 넣을 때 매우 유용합니다.

```rust
use tap::prelude::*;

let val = 5.pipe(add_one).tap(|x| println!("중간 값: {}", x));
```

### Rust 는 메서드 채이닝을 사용하는데 `fp-ts` 패키지 같은게 있는게 유리하지 않을까?

타입스크립트에서 Array.map().filter()와 같은 **메서드 체이닝(Method Chaining)**은 매우 편리하고 익숙한 방식이다. 하지만 실무에서, 특히 규모가 큰 프로젝트에서 fp-ts의 pipe나 flow 같은 함수형 도구를 사용하는 데에는 명확한 이유가 있다.

그 차이점과 fp-ts를 사용하는 이유를 정리해 보았다.

##### 1. 확장성(Extensibility)의 한계

메서드 체이닝의 가장 큰 단점은 객체가 해당 메서드를 미리 가지고 있어야 한다는 점이다.

메서드 체이닝: 만약 내가 만든 커스텀 함수 myTransform을 체이닝 중간에 넣고 싶다면, Array.prototype에 직접 함수를 등록(프로토타입 오염)하지 않는 한 불가능하다. 결국 myTransform(data.map(f1).filter(f2))처럼 코드가 괄호로 감싸지며 왼쪽에서 오른쪽으로 읽히는 흐름이 깨지게 된다.

fp-ts (pipe): pipe는 데이터와 함수가 완전히 분리되어 있다. 입력과 출력 타입만 맞으면 그 어떤 외부 라이브러리 함수나 내가 만든 함수도 체인 중간에 끼워 넣을 수 있다.

```typescript
// 메서드 체이닝: 커스텀 함수를 끼워넣기 어렵다.
const result = myFunc(data.map(f1).filter(f2)); // 흐름이 깨짐

// fp-ts pipe: 어떤 함수든 자유롭게 연결 가능하다.
pipe(
  data,
  map(f1),
  filter(f2),
  myFunc // 내가 만든 함수를 그대로 연결
);
```

또는

```typescript
const text = "hello";

// ❌ 에러: String 타입에는 addHeart라는 메서드가 없다.
// text.toUpperCase().addHeart(); 

// ✅ 대안: 함수로 감싸기 (가독성이 안쪽에서 바깥으로 읽혀서 나쁘다)
const result = addHeart(text.toUpperCase());
```

fp-ts 는:

```typescript
import { pipe } from 'fp-ts/function';

// ✅ 데이터의 흐름이 왼쪽에서 오른쪽으로 흐른다.
const result = pipe(
  "hello",
  (s) => s.toUpperCase(),
  addHeart
);
```

##### 러스트의 마법: 확장 트레이트 (Extension Trait)

```rust
// 1. 새로운 기능을 담을 트레이트를 정의한다.
trait StringExt {
    fn add_heart(&self) -> String;
}

// 2. 기존의 String 타입에 이 트레이트를 구현한다. (확장)
impl StringExt for String {
    fn add_heart(&self) -> String {
        format!("{} ❤️", self)
    }
}

fn main() {
    let text = String::from("hello");

    // 3. 마치 원래 String에 있었던 메서드처럼 체이닝이 가능하다!
    // 데이터의 흐름이 왼쪽에서 오른쪽으로 깔끔하게 이어진다.
    let result = text.to_uppercase().add_heart();

    println!("{}", result); // "HELLO ❤️"
}
```

##### 2. 트리 쉐이킹 (Tree Shaking)과 번들 크기

메서드 체이닝은 클래스나 객체 기반이다.

- 메서드 체이닝: 클래스 안에 100개의 메서드가 있다면, 내가 그중 1개만 써도 자바스크립트 번들에는 100개의 메서드 코드가 모두 포함될 가능성이 높다. (객체에 묶여 있기 때문)

- fp-ts: 모든 로직이 개별 함수 단위로 쪼개져 있다. 내가 map과 filter만 사용한다면, 사용하지 않는 나머지 수십 개의 함수는 빌드 시점에 제거되어 결과물 용량이 훨씬 가벼워진다.

##### 3. 복잡한 에러 처리 (Option, Either)

메서드 체이닝은 중간에 null이나 에러가 발생했을 때 처리가 까다롭다.

- 메서드 체이닝: 중간에 값이 undefined가 되면 Optional Chaining(?.)을 남발하거나 if문으로 흐름을 끊어야 한다.

- fp-ts: Option이나 Either 같은 타입을 사용하면, 값이 없거나 에러가 난 상황을 하나의 "상태"로 취급한다. pipe 라인 전체에서 에러 처리를 우아하게 유지하며 끝까지 밀고 나갈 수 있다.

##### 4. 타입스크립트 vs 러스트

| 비교 항목 | 타입스크립트 (표준) | fp-ts (함수형) | 러스트 (Rust) |
| :--- | :--- | :--- | :--- |
| **중심** | 객체 / 클래스 | 순수 함수 | 트레이트 (Trait) |
| **연결 방식** | 메서드 체이닝 | `pipe` 함수 | 메서드 체이닝 |
| **확장성** | 낮음 (프로토타입 오염 위험) | 매우 높음 | 매우 높음 (Extension Trait) |

러스트는 이 두 방식의 장점을 합쳤다. 

러스트는 Trait을 사용하면 외부에서 정의된 타입에도 `Extension Trait` 기법을 활용하여 나만의 메서드를 추가할 수 있다.

그래서 러스트에서는 `fp-ts` 같은 라이브러리 없이도 메서드 체이닝(obj.func()) 만으로 충분한 확장성을 누릴 수 있는 것이다.

반면, 타입스크립트는 언어 구조상 클래스를 직접 수정할 수 없기에 그 대안으로 `fp-ts` 같은 함수형 라이브러리를 써서 확장성을 확보하는 것이다.
