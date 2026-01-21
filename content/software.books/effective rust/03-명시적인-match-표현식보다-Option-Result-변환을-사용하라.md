---
title: "effective rust: 명시적인 match 표현식보다 Option 과 Result 변환을 사용하라"
author: anonymous.rs
date: 2026-01-08
tags: ["rust", "effective rust", "Item 3"]
---

# 명시적인 match 표현식보다 Option 과 Result 변환을 사용하라

이번 아이템에서는 Option 과 Result 를 이용해 명시적인 Match 표현식으로 작성하기보다 두 표준 타입을 사용하는 것이 바람직한 경우를 살펴보자.

### match 표현식이 바람직하지 않은 경우

명시적인 match 표현식이 바람직하지 않은 첫번째 경우는 값이 있을때만 중요하고 값이 없거나 오류가 발생할 때는 무시해도 되는 경우다.

```rust
struct S {
    field: Option<i32>,
}

fn main() {
    let s = S { field: Some(42) };
    
    match &s.field {
        Some(i) => println!("field is {i}"),
        None => {}
    }
}
```

이러한 경우 `if let` 표현식을 사용하면 한 줄로 짧아질 뿐 아니라 의도가 분명히 드러난다.

```rust
struct S {
    field: Option<i32>,
}

fn main() {
    let s = S { field: Some(42) };
    
    if let Some(i) = &s.field {
        println!("field is {i}");
    }
}
```

하지만 대부분은 else 처리도 함께 해주어야 한다. 

이 갈래에서는 값이 없거나 오류가 발생한 경우를 주로 처리하게 된다. 이처럼 실패 경로를 잘 처리하도록 소프트웨어를 설계하기란 참 쉽지 않다.

아무리 구문 지원이 잘 되더라도 설계가 복잡해질 수 밖에 없다.

특히 연산에 실패한 경우를 처리할 방법을 결정하다보면 더욱 그렇다.

러스트에서는 Result enum 의 두 Variant 를 모두 처리하도록 코드를 작성해야 하기 때문에 오류 갈래를 완전히 무시할 순 없지만,

치명적인 실패인지만 판단하고 넘어갈 수 있다.

실패한 경우에 panic! 을 실행하면 프로그램이 중단되겠지만 멈추지 않고 실행된 나머지 코드는 실패 갈래를 해당하지 않고 정상적으로 수행됐다고 간주할 수 있다.

이러한 동작을 다음과 같이 명시적인 match 구문으로 작성하면 쓸데없이 코드가 장황해진다.

```rust
fn main() {
    let result = std::fs::File::open("/etc/passwd");
    
    let f = match result {
        Ok(f) => f,
        Err(_e) => panic!("Failed to open /etc/passwd!");
    }
    
    // 이 이후부터는 `f` 가 올바른 `std::fs::File` 라고 간주하게 된다.
}
```

Option 과 Result 는 둘 다 내부 값을 추출하되 값이 없으면 panic! 을 실행하는 메서드인 unwrap 과 expect 를 제공한다.

expect 를 사용하면 실패한 경우에 출력할 오류 메세지를 별도로 정의할 수 있지만 어느 것을 사용하더라도 코드를 짧고 간결하게 작성할 수 있다.

가령 다음과 같이 오류 처리를 .unwrap() 으로 대체할 수 있다.

```rust
let f = std::fs::File::open("/etc/passwd").unwrap();
```

이렇게 지정된 헬퍼 함수가 실행되는 과정에서 여전히 panic! 이 발생할 수 있다는 점에 주의해야 한다. 즉 이러한 함수(예: unwrap())을 사용하는 것은 곧 panic! 을 지정하는것과 같다.

그런데 오류 처리에 관련된 판단을 다른 곳으로 넘기는 것이 바람직한 경우가 많다. 특히 사용될 환경을 미리 알수 없는 라이브러리를 만들때가 그렇다. 오류를 넘겨 받는 쪽에서 쉽게 처리할 수 있게 만드려면

**Option 보다는 Result 로 표현하는 것이 좋다**. 설령 오류 타입끼리 변환할 일이 많더라도 말이다.

여기서 한가지 의문이 들 수 있다. 무엇을 오류로 봐야 할까? 앞선 코드의 경우 당연히 파일을 열지 못하는 것이 오류다. 이런 오류에 대한 정보를 자세히 알려주면 이를 처리하는 사용자가 후속 작업을 결정하는데 도움이 된다.

반면에 슬라이스가 비어 있을때 first() 를 실행해서 첫 번째 원소를 가져오지 못한 경우는 오류라고 보기 힘들다.

이럴 때는 반환 타입을 표준 라이브러리에서 제공하는 Option 으로 표현한다.

두 가지 타입 중 어느 것을 선택할지는 주어진 상황에 맞게 판단해야 하지만 오류에 유용한 정보를 전달할 수 있다면 가급적 Result 를 사용한다.

또한 Result 에는 #[must_use] 속성이 지정돼 있어서 라이브러리 사용자를 올바른 방향으로 유도할 수 있다.

가령, 반환된 Result 를 무시하도록 코드를 작성하면 컴파일러는 다음과 같은 경고 메세지를 출력한다.

```rust

```

명시적인 match 로 작성하면 오류를 호출자에 전달하는 오류 전파(error propagation)는 가능하겠지만, 고 언어스러운 보일러 플레이트 코드가 많아진다.

```rust
pub fn find_user(username: &str) -> Result<UserId, std::io::Error> {
    let f = match std::fs::File::open("/etc/passwd") {
        Ok(f) => f,
        Err(e) => return Err(From::from(e)),
    };
}
```

러스트의 물음표 연산자를 사용하면 이런 보일러 플레이트 코드를 확 줄 일 수 있다. 물음표 연산자는 Err 갈래를 표현하는 편의 구문으로서 오류 타입 변환이 필요하다면 수행하고 return Err(...) 표현식을 구성하는 작업을 문자 하나로 표현한다.

```rust
pub fn find_user(username: &str) -> Result<UserId, std::io::Error> {
    let f = std::fs::File::open("/etc/passwd")?;
}
```

러스트를 처음 접하는 사람들은 이 물음표 구문이 어색할 수 있다. 물음표가 눈에 잘 띄지 않고 코드 동작도 명확히 드러나지 않기 때문이다.

하지만 문자 하나만 적어도 타입 시스템이 작동하면서 각각의 타입으로 표현된 모든 경우를 검사하도록 보장하기 때문에 프로그래머는 핵심 경로에만 집중할 수 있다.

더구나 메서드 호출처럼 보이지만 #[inline] 으로 표시된 제네릭 함수로 되어 있어서 직접 작성한 코드와 동일한 기게어로 컴파일되어 오버헤드가 발생하지 않는다.

지금까지 본 두 사실을 감안하면 명시적인 match 표현식보다 Option 이나 Result 변환을 사용하라라고 조언할 수 있다.

앞선 예에서 나온 오류 타입은 모두 일정했다. 다시 말해 내부 메서드와 외부 메서드 모두 오류를 std::io::Error 로 표현했다. 하지만 실전에서는 이러한 경우가 거의 없다.

가령 한 함수가 안에서 다양한 작업을 수행하기 위해 호출한 여러 하위 라이브러리로부터 반환된 다양한 오류를 그 함수 안에서 처리해야 할 수도 있다.

오류 매핑에 대한 전반적인 내용은 아이템 4에서 살펴보기로 하고 여기서는 다음과 같이 오류를 수동으로 매핑할 때의 주의 사항만 간단히 짚고 넘어간다.

```rust
pub fn find_user(username: &str) -> Result<UserId, String> {
    let f = match std::fs::File::open("/etc/passwd") {
        Ok(f) => f,
        Err(e) => {
            return Err(format!("Failed to open password file: {:?}", e))
        }
    };
    
    ...코드 생략
}
```

이렇게 작성하기 보다 다음과 같이 .map_err() 변환을 이용하면 좀 더 간결하고 관용적으로 표현할 수 있다.

```rust
pub fn find_user(username: &str) -> Result<UserId, String> {
    let f = std::fs::File::open("/etc/passwd").map_err(|e| format!("Failed to open password file: {:?}", e))?;

    ...코드 생략
}
```

더 좋은 방법은 아예 이렇게 할 일이 없게 만드는 것이다. 즉 표준 트레이트 From 구현을 이용해(아이템 10) 내부 오류 타입에서 외부 오류 타입을 생성할 수 있다면, .map_err()를 호출하지 않아도

컴파일러가 자동으로 변환해준다.

이런 변환 기법은 다양한 상황에 적용하도록 일반화할 수 있다. 여기서 물음표 연산자는 강력하지만 광범위한 도구다.

단순히 물음표 연산자를 사용하기만 하지 말고 Option 과 Result 타입에서 제공하는 다양한 변환 메서드를 이용해 물음표 연산자를 적용하기 좋게 만들어서 사용하는 것이 좋다.

표준 라이브러리는 다양한 변환 메서드를 제공한다. 그림 1-1은 관련 타입(짙은색 박스) 끼리 변환해주는 메서드 중에서도 가장 많이 사용되는 것들을(옅은 색 박스)  보여주고 있다. 별표가 달린 메서드는 아이템 18에서 설명할 panic! 을 실행할 수 있는 메서드다.

[[그림]]

이 그림에는 표현되지 않았지만 레퍼런스를 사용하지 않는 경우도 많다. 예를 들면 다음과 같이 일부 데이터를 Option 타입으로 저장하는 구조체를 생각해보자.

```rust
struct InputData {
    payload: Option<Vec<u8>>,
}
```

다음과 같이 주어진 페이로드를 (&[u8]) -> Vec<u8> 시그니처를 통해 암호화 함수로 전달하는 메서드를 이 구조체에 구현할 때, 다음과 같이 단순히 레퍼런스를 구하면 오류가 발생한다.

```rust
impl InputData {
    fn encrypted(&self) -> Vec<u8> {
        encrypt(&self.payload.unwrap_or(vec![]))
    }
}
```

```rust
[[오류 메세지]]
```

이럴때는 Option 에서 제공하는 as_ref() 메서드를 사용해야 한다. 이 메서드는 Option 에 대한 레퍼런스(예: &Option<Vec<u8>>)를 레퍼런스에 대한 Option(예: Option<&Vec<u8>>) 으로 변환한다.

```rust
pub fn as_ref(&self) -> Option<&T> {
    encrypt(self.payload.as_ref().unwrap_or(&vec![]))
}
```


### 기억할 사항

- Option 과 Result 변환을 익히고 가급적 Option 보다는 Result 를 사용하라 레퍼런스 관련 변환이 필요하다면 .as_ref() 메서드를 사용하라.
- Option 과 Result 에 대해 명시적인 match 보다는 Option 과 Result 변환을 사용하라.
- 특히 이러한 변환을 사용해 결과 타입을 물음표 연산자를 적용할 수 있는 형태로 바꿔라.
