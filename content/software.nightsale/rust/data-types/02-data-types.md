---
title: "Episode 4. Data Types"
author: anonymous.rs
date: 2025-12-22
tags: ["rust", "Data Types"]
---

### Integers

### Using _ as Visual Separator for Numbers

숫자를 읽을 때 가독성의 문제가 있다. 커다란 숫자를 읽을 때, `_` 을 사용하여 숫자를 구분할 수 있다.

```rust
fn main() {
    let number = 1_000_000;
    let sixteen_bit_signed: i16 = -32_768;
}
```

해당 밑줄은 컴파일러가 무시한다.

### The usize and isize Types

서명되지 않은 정수는 32비트 시스템의 u32 와 동등하다. 하지만 64bit 시스템의 u64 와도 동등하다. 만약 64bit 컴퓨터라면 메모리 공간이 더 많다. usize 

```rust
fn main() {
    let days: usize = 55;
    let years: isize = -15_000;
}
```

이 코드는 32bit 시스템에서는 u32 가 되고, 64bit 시스템에서는 u64 가 된다. isize 도 이와 같다. 

이와 같은 유형은 각 시스템의 메모리 소비를 최소화하는데 유용하며 시스템별 재사용 가능성을 높여준다.

### Strings and Raw Strings

##### 문자열 리터럴

문자열 리터럴은 문자열로 컴파일할 때 컴파일러가 아는 텍스트의 값이다.

```rust
fn main() {
    println!("Hello, world!");
}
```

러스트는 문자열 리터럴에서의 특수 기호는 다음처럼 처리해야한다:

```rust
fn main() {
    println!("Hello, world! \n");
    println!("\tOnce upon a time");
    println!("Juliet said \"I love you\"");
    
    let file_path: &str = "C:\\My Documents\\new\\videos";
    println!("{file_path}");
}
```

> 원시 문자열이란?

원시 문자열은 문자열 리터럴의 특수 기호를 처리하지 않는 문자열이다. 원시 문자열은 r#"..."# 형태로 작성한다.

원시 문자열은 다음처럼 사용할 수 있다:

```rust
fn main() {
    let raw_string = r#"This is a raw string with special characters like \n and \t"#;
    println!("{}", raw_string);
}

> 원시 문자열의 사용

원시 문자열은 다음처럼 사용할 수 있다:

```rust
fn main() {
    let raw_string = r#"This is a raw string with special characters like \n and \t"#;
    println!("{}", raw_string);
    
    let raw_path = r"C:\My Documents\new\videos";
    println!("{}", raw_path);
}
```
### Intro to Methods

```rust
fn main() {
    let value: i32 = -15;
    println!("{}", value.abs());

    let empty_space = "  my content        ";
    println!("{}", empty_space.trim());
}
```

### Floating Point Types

부동 소수점은 소수점, 분수 유형 구성을 가진 타입을 의미한다.

32bit float, 64bit float

Double 과 같다.

```rust
fn main() {
    let pi: f64 = 3.14159; // 8bite
    let pi: f32 = 3.14159; // 4bite

    println!("pi: {}", pi);
    println!("{}", pi.floor());
    println!("{}", pi.ceil());
    println!("{}", pi.round());
}
```

기본설정은 64bit 가 낫다. 15-17자리로 정확도도 높다. 반면 32bit는 6자리정도로 정확도가 낮다. 10진수 값을 나타내는데 동그라미 오류가 있을 수 있다는 걸 알아야한다(?)

부동점수는 메모리에 있는 비트 한정수를 이용해 숫자를 저장한다(?)

### Formatting Floats with Format Specifier

> A format specifier customizes the printed representation of the interpolated value.

```rust
fn main() {
    let pi: f64 = 3.14159123456112;
    let pi: f32 = 3.14159;

    println!("The currrent value {pi:.2}"); // 3.14
    println!("The currrent value {pi:.4}"); // 3.1416
    println!("The currrent value {pi:.6}"); // 3.141591

    println!("The currrent value {:.8}", pi); // 3.14159123
}
```

### Casting Types with the as Keyword

`Rust` 에서 타입 캐스팅을 하기 위해서는 `as` 키워드를 이용한다.

```rust
fn main() {
    let miles_away: i32 = 50;
    let miles_away_i8 = miles_away as i8;
    let miles_away_u8 = miles_away as u8;
}
```

> 타입 캐스팅의 조건
>
> 

전혀 다른 타입으로의 캐스팅:

```rust
fn main() {
    let miles_away: f64 = 100.329032;
    let miles_away_f32 = miles_away as f32;
    let miles_away_i32 = miles_away as i32; // 정수로의 변환

    println!("{miles_away_i32}")
}
```

### Math Operations

어떤 작업을 수행하는 기호를 오퍼레이터라고 부른다.

```rust
fn main() {
    let addition = 5 + 4;
    let subtraction = 10 - 6;
    let multiplication = 3 * 4;
    let division = 10 / 2;
    let remainder = 10 % 3;
    let floor_division = 10 / 3;
    let decimal_division = 10.0 / 3.0;

    println!("addition: {addition}, subtraction: {subtraction}, multiplication: {multiplication}, division: {division}");
}
```

> [!attention] 바닥 나누기
>
> 

### Augmented Assignment Operators

```rust
fn main() {
    let mut year = 2025;
            
    year = year + 1;
    year += 1;
    year -= 1;
    year *= 2;
    year /= 2;
    year %= 2;

    println!("The new year: {year}");
}
```

### Intro to Boolean Types

```rust
fn main() {
    let is_handsome = true;
    
    println!("is handsome: {is_handsome}");

    let age: i32 = 35;

    let is_adult = age >= 18;
    let is_child = age < 18;

    println!("is adult: {is_adult}, is child: {is_child}");
}
```

### Boolean Inversion with `!`

```rust
fn main() {
    let is_handsome = true;
    
    println!("is handsome: {is_handsome}");

    let age: i32 = 35;

    let is_adult = age >= 18;
    let is_child = age < 18;

    println!("is adult: {is_adult}, is child: {is_child}");

    let is_not_handsome = !is_handsome;
    println!("is not handsome: {is_not_handsome}");

    let is_not_adult = !is_adult;
    println!("is not adult: {is_not_adult}");
}
```

### Equality and Inequailty Operators

```rust
fn main() {
    let is_handsome = true;
    
    println!("is handsome: {is_handsome}");

    let age: i32 = 35;

    let is_adult = age >= 18;
    let is_child = age < 18;

    println!("is adult: {is_adult}, is child: {is_child}");

    let is_not_handsome = !is_handsome;
    println!("is not handsome: {is_not_handsome}");

    let is_not_adult = !is_adult;
    println!("is not adult: {is_not_adult}");

    let is_equal = 5 == 5;
    let is_not_equal = 5 != 5;

    println!("is equal: {is_equal}, is not equal: {is_not_equal}");
}
```

### And Logic with `&&`

```rust
fn main() {

}
```

### Or Logic with `||`

```rust
fn main() {

}
```

### The Character Type

```rust
fn main() {

}
```

### The Array Type

```rust
fn main() {

}
```

### Reading and Writing Array Elements

```rust
fn main() {

}
```

### The Display Trait

```rust
fn main() {

}
```

### The Debug Trait

```rust
fn main() {
    let season: [&str; 4] = ["Spring", "Summer", "Fall", "Winter"];

    println!("{}", 5);
    println!("{}", true);
    println!("{}", 3.14);
    println!("{seasons:#?}");
    println!("{:?}", season);
}
```

### The dbg! Macro

```rust
fn main() {
    let season: [&str; 4] = ["Spring", "Summer", "Fall", "Winter"];

    dbg!(season);
}
```

### The Tuple Type

```rust
fn main() {

}
```

### Ranges and Range Iteration

```rust
fn main() {

}
```

### Intro to Generics

```rust
fn main() {

}
```
