3. 기본 동작 및 연산 트레이트 (Common Behavior)
우리가 흔히 쓰는 연산자(+, ==)나 기본 동작을 정의합니다.

Debug: {:?}로 출력 가능하게 함.

Display: {}로 사용자에게 보여줄 문자열 정의.

Clone: 명시적으로 객체를 복제 (.clone()).

Default: 기본값 생성 (Default::default()).

PartialEq / Eq: 값이 같은지 비교 (==).

PartialOrd / Ord: 값의 크기를 비교 (<, >).

Hash: 해시맵의 키로 사용할 수 있도록 해시값 생성.
