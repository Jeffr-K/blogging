Rust 디자인 패턴: 가드(Guard) 패턴과 RAII

가드(Guard) 패턴은 객체 외부에서 객체 내부로의 접근을 제한하기 위한 디자인 패턴입니다.

만약 내부 값에 접근하기 위해서는, 래퍼 구조체(Wrapper Struct)인 가드(Guard)를 통해야 합니다.

이때, 가드 객체를 일반적인 객체처럼 다루기 위해 Deref와 DerefMut 트레잇(Trait)을 구현합니다.
