
# impl Keywords

### Trait Implementations

이 구문은 CreateUserCommandHandler가 CommandHandler라는 특정 인터페이스를 구현함을 선언하는 것입니다.

목적: 시스템이 "어떤 핸들러든 상관없으니 handle 기능이 있는 놈을 가져와!"라고 요구할 때, 이 구조체가 그 요구 조건에 부합하도록 만드는 것입니다.

호출 방법: 시스템(라우터나 디스패처)이 handler.handle(command)를 호출할 때 사용됩니다.

특징: * #[async_trait]가 붙은 이유는 해당 인터페이스가 비동기 함수를 포함하고 있기 때문입니다.

반드시 트레이트(인터페이스)에 정의된 형식(함수 이름, 매개변수, 반환 타입)을 똑같이 맞춰야 합니다.

### Default Implementations

### Struct Implementations

이 구문은 CreateUserCommandHandler라는 구조체 자신만의 고유한 함수들을 정의할 때 사용합니다.

목적: 객체를 생성하는 new 메서드나, 이 클래스(구조체) 내부에서만 쓰이는 보조 함수들을 정의합니다.

호출 방법: CreateUserCommandHandler::new(repo)와 같이 직접 호출합니다.

특징: 외부 트레이트(인터페이스)와 상관없이 이 타입이 무엇을 할 수 있는지를 정의하는 "본체" 로직입니다.

### 💡 왜 두 개를 나눠 쓰나요?

이 설계는 의존성 주입과 다형성 때문입니다.

new 는 고유 기능: 리포지토리를 어떻게 주입받아 객체를 만들지는 이 구조체만의 사정입니다.

handle은 공통 기능: 하지만 일단 만들어진 핸들러는 시스템 어디에서든 CommandHandler라는 똑같은 방식으로 실행되어야 합니다.

결론적으로: new로 배를 건조하고(impl Type), CommandHandler라는 면허를 따서(impl Trait for Type) 실제로 운전(handle)하는 구조라고 보시면 됩니다.

이제 이 구조가 왜 WithdrawUserCommandHandler에도 똑같이 적용되었는지 이해가 되시나요? 🫡 또 궁금한 점 있으시면 말씀해 주세요!
