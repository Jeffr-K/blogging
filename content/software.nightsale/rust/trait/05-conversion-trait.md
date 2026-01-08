2. 값의 변환 트레이트 (Conversion Traits)
타입 A를 타입 B로 바꾸거나, 참조를 얻어올 때 사용합니다.

From<T> / Into<T>: 소유권을 넘기며 타입을 변환 (예: String::from("hi")).

TryFrom<T> / TryInto<T>: 실패 가능성이 있는 변환 (Result 반환).

AsRef<T> / AsMut<T>: 비용 없이 참조(또는 가변 참조)만 얻어옴.

Deref / DerefMut: 스마트 포인터를 역참조하여 내부 값에 접근.
